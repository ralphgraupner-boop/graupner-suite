"""module_assistent – stiller Beobachter für Ralph.

Liest Daten aus anderen Modulen, erkennt Muster, erzeugt Hinweise.
Phase 1: Nur für Admin sichtbar. Kein Mitarbeiter bekommt Hinweise.
Collections: module_assistent_hinweise, module_assistent_log, module_assistent_settings
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from database import db, logger
from auth import get_current_user

router = APIRouter()


# ==================== HILFSFUNKTIONEN ====================

def _erstelle_hinweis(
    typ: str,
    prioritaet: str,
    titel: str,
    nachricht: str,
    referenz_id: str = "",
    modul: str = "",
    kunde_id: str = "",
    kunde_name: str = "",
    aktionen: list = None,
    gueltig_tage: int = 7,
) -> dict:
    """Erstellt ein Hinweis-Dokument (wird noch nicht gespeichert)."""
    now = datetime.now(timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "typ": typ,
        "prioritaet": prioritaet,
        "titel": titel,
        "nachricht": nachricht,
        "kontext": {
            "modul": modul,
            "referenz_id": referenz_id,
            "kunde_id": kunde_id,
            "kunde_name": kunde_name,
        },
        "aktionen": aktionen or [],
        "status": "ungelesen",
        "erstellt_am": now.isoformat(),
        "gelesen_am": None,
        "gueltig_bis": (now + timedelta(days=gueltig_tage)).isoformat(),
    }


async def _bereits_vorhanden(typ: str, referenz_id: str) -> bool:
    """Verhindert doppelte Hinweise für dieselbe Referenz."""
    existing = await db.module_assistent_hinweise.find_one({
        "typ": typ,
        "kontext.referenz_id": referenz_id,
        "status": {"$in": ["ungelesen", "gelesen"]},
    })
    return existing is not None


async def _speichere_hinweise(hinweise: list) -> int:
    """Speichert neue Hinweise, überspringt Duplikate."""
    gespeichert = 0
    for h in hinweise:
        if not await _bereits_vorhanden(h["typ"], h["kontext"]["referenz_id"]):
            await db.module_assistent_hinweise.insert_one(h)
            gespeichert += 1
    return gespeichert


# ==================== ALLE CHECKS AUSFÜHREN ====================

async def run_all_checks() -> dict:
    """Führt alle aktiven Checks aus und speichert Hinweise."""
    from .checks import (
        check_angebote, check_termine, check_kunden,
        check_einsaetze, check_mitarbeiter,
    )

    settings = await db.module_assistent_settings.find_one({"id": "config"}, {"_id": 0}) or {}
    if not settings.get("aktiv", True):
        logger.info("Assistent: deaktiviert, kein Check-Lauf")
        return {"status": "deaktiviert", "hinweise": 0}

    started = datetime.now(timezone.utc)
    alle_hinweise = []
    fehler = []

    checks = [
        ("angebote", check_angebote, settings.get("check_angebote", True)),
        ("termine", check_termine, settings.get("check_termine", True)),
        ("kunden", check_kunden, settings.get("check_kunden", True)),
        ("einsaetze", check_einsaetze, settings.get("check_einsaetze", True)),
        ("mitarbeiter", check_mitarbeiter, settings.get("check_mitarbeiter", False)),
    ]

    for name, fn, aktiv in checks:
        if not aktiv:
            continue
        try:
            ergebnis = await fn()
            alle_hinweise.extend(ergebnis)
        except Exception as e:
            logger.error(f"Assistent Check '{name}' fehlgeschlagen: {e}")
            fehler.append(name)

    gespeichert = await _speichere_hinweise(alle_hinweise)

    log_eintrag = {
        "id": str(uuid.uuid4()),
        "started_at": started.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "hinweise_erzeugt": len(alle_hinweise),
        "hinweise_gespeichert": gespeichert,
        "fehler": fehler,
    }
    await db.module_assistent_log.insert_one(log_eintrag)

    # Abgelaufene Hinweise aufräumen
    await db.module_assistent_hinweise.delete_many({
        "gueltig_bis": {"$lt": datetime.now(timezone.utc).isoformat()},
        "status": "ignoriert",
    })

    logger.info(f"Assistent: {gespeichert} neue Hinweise gespeichert, {len(fehler)} Fehler")
    return {"status": "ok", "hinweise_neu": gespeichert, "fehler": fehler}


# ==================== API-ENDPUNKTE ====================

@router.get("/hinweise")
async def get_hinweise(
    status: Optional[str] = None,
    typ: Optional[str] = None,
    user=Depends(get_current_user),
):
    """Alle aktiven Hinweise – ungelesen zuerst, dann nach Priorität."""
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["ungelesen", "gelesen"]}
    if typ:
        query["typ"] = typ

    prioritaet_order = {"kritisch": 0, "hoch": 1, "hinweis": 2, "info": 3}
    items = await db.module_assistent_hinweise.find(query, {"_id": 0}).to_list(200)
    items.sort(key=lambda x: (
        0 if x["status"] == "ungelesen" else 1,
        prioritaet_order.get(x.get("prioritaet", "info"), 9),
    ))
    return items


@router.get("/hinweise/count")
async def get_hinweise_count(user=Depends(get_current_user)):
    """Anzahl ungelesener Hinweise (für Badge in Navigation)."""
    count = await db.module_assistent_hinweise.count_documents({"status": "ungelesen"})
    return {"count": count}


@router.post("/hinweise/{hinweis_id}/lesen")
async def mark_gelesen(hinweis_id: str, user=Depends(get_current_user)):
    """Hinweis als gelesen markieren."""
    result = await db.module_assistent_hinweise.update_one(
        {"id": hinweis_id},
        {"$set": {"status": "gelesen", "gelesen_am": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Hinweis nicht gefunden")
    return {"ok": True}


@router.post("/hinweise/{hinweis_id}/ignorieren")
async def mark_ignoriert(hinweis_id: str, user=Depends(get_current_user)):
    """Hinweis dauerhaft ignorieren."""
    result = await db.module_assistent_hinweise.update_one(
        {"id": hinweis_id},
        {"$set": {"status": "ignoriert", "gelesen_am": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Hinweis nicht gefunden")
    return {"ok": True}


@router.post("/hinweise/alle-lesen")
async def mark_alle_gelesen(user=Depends(get_current_user)):
    """Alle ungelesenen Hinweise als gelesen markieren."""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.module_assistent_hinweise.update_many(
        {"status": "ungelesen"},
        {"$set": {"status": "gelesen", "gelesen_am": now}},
    )
    return {"ok": True, "aktualisiert": result.modified_count}


@router.post("/run")
async def run_checks_manual(user=Depends(get_current_user)):
    """Alle Checks sofort manuell ausführen (für Tests)."""
    logger.info("Assistent: manueller Check-Lauf ausgelöst")
    result = await run_all_checks()
    return result


@router.get("/log")
async def get_log(user=Depends(get_current_user)):
    """Protokoll der letzten 30 Check-Läufe."""
    items = await db.module_assistent_log.find(
        {}, {"_id": 0}
    ).sort("started_at", -1).limit(30).to_list(30)
    return items


@router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    """Assistent-Konfiguration laden."""
    settings = await db.module_assistent_settings.find_one({"id": "config"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "config",
            "aktiv": True,
            "check_angebote": True,
            "check_termine": True,
            "check_kunden": True,
            "check_einsaetze": True,
            "check_mitarbeiter": False,
            "hinweis_aufbewahrung_tage": 30,
        }
    return settings


@router.put("/settings")
async def save_settings(body: dict, user=Depends(get_current_user)):
    """Assistent-Konfiguration speichern."""
    body["id"] = "config"
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_assistent_settings.update_one(
        {"id": "config"}, {"$set": body}, upsert=True,
    )
    return {"ok": True}



# ==========================================================================
# KI-ASSISTENT (Voice-to-Action MVP) — gemeinsamer Endpoint fuer
# GlobalAssistantSheet (Bottom-Sheet) + AssistentPage (Verlauf).
# Whisper wird im Frontend ueber /voice-intake/transcribe-and-structure
# erledigt; hier kommt bereits transkribierter Text rein.
# ==========================================================================

from pydantic import BaseModel  # noqa: E402
from .ai_chat import gpt_intent  # noqa: E402
from .ai_tools import execute_tool, TOOLS_SCHEMA  # noqa: E402


class AskRequest(BaseModel):
    text: str
    konversation_id: Optional[str] = None
    quelle: Optional[str] = "sheet"  # "sheet" oder "page"


@router.get("/tools")
async def list_tools(user=Depends(get_current_user)):
    """Welche Tools die KI nutzen darf (fuer Hilfe/Doku im Frontend)."""
    return {"tools": TOOLS_SCHEMA}


@router.post("/ask")
async def assistent_ask(payload: AskRequest, user=Depends(get_current_user)):
    """Ralph spricht/tippt — KI versteht und fuehrt Action aus.

    1. Konversation laden oder anlegen
    2. GPT-5.2 -> Intent + Tool-Auswahl
    3. Tool ausfuehren
    4. Audit + Konversations-Eintrag speichern
    5. Antwort zurueck
    """
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(400, "Text darf nicht leer sein")

    username = (user or {}).get("username", "unknown")
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1) Konversation finden oder anlegen
    konv_id = payload.konversation_id
    if konv_id:
        konv = await db.module_assistent_konversation.find_one(
            {"id": konv_id, "user": username}, {"_id": 0}
        )
        if not konv:
            konv_id = None
    if not konv_id:
        konv_id = str(uuid.uuid4())
        await db.module_assistent_konversation.insert_one({
            "id": konv_id,
            "user": username,
            "titel": text[:60] + ("…" if len(text) > 60 else ""),
            "erstellt_am": now_iso,
            "letzte_aktivitaet": now_iso,
            "beitraege": [],
        })

    # 2) User-Beitrag in Konversation eintragen
    await db.module_assistent_konversation.update_one(
        {"id": konv_id},
        {
            "$push": {"beitraege": {
                "rolle": "user",
                "text": text,
                "quelle": payload.quelle or "sheet",
                "zeit": now_iso,
            }},
            "$set": {"letzte_aktivitaet": now_iso},
        },
    )

    # 3) GPT-5.2 -> Intent
    intent = await gpt_intent(text, session_id=konv_id)
    tool_name = intent.get("tool")
    args = intent.get("args") or {}
    antwort_text = intent.get("antwort") or ""

    # 4) Tool ausfuehren (falls vorgesehen)
    tool_result = None
    if tool_name:
        tool_result = await execute_tool(tool_name, args, user or {})
        # Wenn Berechtigung fehlt: Ralph persoenlich Bescheid geben
        if tool_result and tool_result.get("error") == "keine_berechtigung":
            antwort_text = (
                f"Das darf ich fuer dich nicht ausfuehren, Ralph — dir fehlt die "
                f"Berechtigung fuer '{tool_result.get('bereich')}'. Bitte einen Admin fragen."
            )
        # Filter / Massen-Update: Tool-Hinweis (Anzahl + Bestaetigungs-Rueckfrage)
        # in die sichtbare Antwort heben (der LLM-Text kennt die Anzahl nicht vorab)
        elif tool_result and tool_result.get("hinweis") and tool_name in (
            "kunden_filtern", "kunden_massen_update",
        ):
            antwort_text = tool_result["hinweis"]

    # 5) Audit
    audit_id = str(uuid.uuid4())
    await db.module_assistent_audit.insert_one({
        "id": audit_id,
        "konversation_id": konv_id,
        "user": username,
        "eingabe": text,
        "tool": tool_name,
        "args": args,
        "ergebnis": tool_result,
        "antwort": antwort_text,
        "erfolg": bool(tool_result and tool_result.get("ok")) if tool_name else True,
        "zeit": now_iso,
        "quelle": payload.quelle or "sheet",
    })

    # 6) KI-Antwort in Konversation eintragen
    await db.module_assistent_konversation.update_one(
        {"id": konv_id},
        {
            "$push": {"beitraege": {
                "rolle": "ki",
                "text": antwort_text,
                "tool": tool_name,
                "tool_ergebnis": tool_result,
                "audit_id": audit_id,
                "zeit": datetime.now(timezone.utc).isoformat(),
            }},
            "$set": {"letzte_aktivitaet": datetime.now(timezone.utc).isoformat()},
        },
    )

    return {
        "konversation_id": konv_id,
        "audit_id": audit_id,
        "antwort": antwort_text,
        "tool": tool_name,
        "tool_ergebnis": tool_result,
    }


@router.get("/konversationen")
async def list_konversationen(user=Depends(get_current_user)):
    """Letzte 30 Konversationen des eingeloggten Users."""
    username = (user or {}).get("username", "unknown")
    items = await db.module_assistent_konversation.find(
        {"user": username},
        {"_id": 0, "id": 1, "titel": 1, "erstellt_am": 1, "letzte_aktivitaet": 1, "beitraege": 1},
    ).sort("letzte_aktivitaet", -1).limit(30).to_list(30)
    # Nur Anzahl der Beitraege, nicht den Inhalt
    for it in items:
        it["anzahl_beitraege"] = len(it.get("beitraege", []))
        it.pop("beitraege", None)
    return items


@router.get("/konversation/{konv_id}")
async def get_konversation(konv_id: str, user=Depends(get_current_user)):
    """Vollstaendiger Verlauf einer Konversation."""
    username = (user or {}).get("username", "unknown")
    konv = await db.module_assistent_konversation.find_one(
        {"id": konv_id, "user": username}, {"_id": 0}
    )
    if not konv:
        raise HTTPException(404, "Konversation nicht gefunden")
    return konv


@router.delete("/konversation/{konv_id}")
async def delete_konversation(konv_id: str, user=Depends(get_current_user)):
    """Konversation des eigenen Users loeschen."""
    username = (user or {}).get("username", "unknown")
    r = await db.module_assistent_konversation.delete_one({"id": konv_id, "user": username})
    if r.deleted_count == 0:
        raise HTTPException(404, "Konversation nicht gefunden")
    return {"ok": True}
