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
