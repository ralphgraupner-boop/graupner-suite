"""
Routes für module_termine – Termine mit Status-Workflow ("GO" → Google Kalender).

Module-First:
- Eigene Collection module_termine
- Datenmaske: kunde_id, projekt_id, aufgabe_id, monteur_username verlinkt nur per ID
- Composite-Endpoint /enrich/{id} liest Stammdaten lesend aus zuständigen Modulen
"""
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db, logger
from routes.auth import get_current_user
from .settings import _get_or_create_settings

router = APIRouter()


VALID_STATUS = ["wartet_auf_go", "bestaetigt", "im_kalender", "abgesagt"]
VALID_TYP = ["besichtigung", "ausfuehrung", "abnahme", "intern", "sonstiges"]


# ==================== MODELS ====================

class TerminCreate(BaseModel):
    titel: str
    typ: str = "ausfuehrung"
    start: str  # ISO datetime, z.B. "2026-04-30T14:00"
    ende: str = ""  # optional
    ort: str = ""  # optional Adresse / Ortsangabe
    beschreibung: str = ""

    # Datenmaske-Verknüpfungen (alle optional, nur Verweise per ID)
    kunde_id: str = ""
    projekt_id: str = ""
    aufgabe_id: str = ""
    monteur_username: str = ""


class TerminUpdate(BaseModel):
    titel: Optional[str] = None
    typ: Optional[str] = None
    start: Optional[str] = None
    ende: Optional[str] = None
    ort: Optional[str] = None
    beschreibung: Optional[str] = None
    kunde_id: Optional[str] = None
    projekt_id: Optional[str] = None
    aufgabe_id: Optional[str] = None
    monteur_username: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str
    grund: str = ""  # z.B. Absage-Grund


# ==================== HELPERS ====================

async def _require_enabled():
    s = await _get_or_create_settings()
    if not s.get("feature_enabled"):
        raise HTTPException(403, "Modul Termine ist deaktiviert")


def _validate_enums(data: dict):
    if "status" in data and data["status"] not in VALID_STATUS:
        raise HTTPException(400, f"status muss einer von {VALID_STATUS} sein")
    if "typ" in data and data["typ"] not in VALID_TYP:
        raise HTTPException(400, f"typ muss einer von {VALID_TYP} sein")


# ==================== SETTINGS ====================

@router.get("/admin/settings")
async def get_settings(user=Depends(get_current_user)):
    return await _get_or_create_settings()


@router.put("/admin/settings")
async def update_settings(payload: dict, user=Depends(get_current_user)):
    if (user or {}).get("role") != "admin":
        raise HTTPException(403, "Nur Admin")
    update = {}
    if "feature_enabled" in payload:
        update["feature_enabled"] = bool(payload["feature_enabled"])
    if "google_calendar_enabled" in payload:
        update["google_calendar_enabled"] = bool(payload["google_calendar_enabled"])
    if update:
        await db.module_termine_settings.update_one(
            {"id": "module_termine_settings"},
            {"$set": update},
            upsert=True,
        )
    return await _get_or_create_settings()


# ==================== META ====================

@router.get("/meta")
async def meta(user=Depends(get_current_user)):
    return {
        "status": VALID_STATUS,
        "typen": VALID_TYP,
        "status_labels": {
            "wartet_auf_go": "Wartet auf GO",
            "bestaetigt": "Bestätigt",
            "im_kalender": "Im Kalender",
            "abgesagt": "Abgesagt",
        },
    }


# ==================== CRUD ====================

@router.get("")
async def list_termine(
    status: str = "",
    kunde_id: str = "",
    projekt_id: str = "",
    monteur_username: str = "",
    user=Depends(get_current_user),
):
    await _require_enabled()
    query: dict = {}
    if status:
        query["status"] = status
    if kunde_id:
        query["kunde_id"] = kunde_id
    if projekt_id:
        query["projekt_id"] = projekt_id
    if monteur_username:
        query["monteur_username"] = monteur_username
    items = await db.module_termine.find(query, {"_id": 0}).sort("start", 1).to_list(2000)
    return items


@router.get("/wartet-auf-go")
async def list_wartet_auf_go(user=Depends(get_current_user)):
    """Schnellzugriff für Sidebar-Badge: alle Termine, die auf GO warten."""
    await _require_enabled()
    items = await db.module_termine.find(
        {"status": "wartet_auf_go"}, {"_id": 0}
    ).sort("start", 1).to_list(500)
    return {"count": len(items), "items": items}


@router.get("/{termin_id}")
async def get_termin(termin_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    item = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Termin nicht gefunden")
    return item


@router.get("/{termin_id}/enrich")
async def get_termin_enriched(termin_id: str, user=Depends(get_current_user)):
    """
    DATENMASKE: Termin + verlinkte Stammdaten aus anderen Modulen (read-only).
    Liefert kunde_detail, projekt_detail, aufgabe_detail, monteur_detail jeweils,
    wenn die jeweilige ID gesetzt ist.
    """
    await _require_enabled()
    termin = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not termin:
        raise HTTPException(404, "Termin nicht gefunden")

    kunde_detail = None
    if termin.get("kunde_id"):
        kunde_detail = await db.module_kunden.find_one(
            {"id": termin["kunde_id"]},
            {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1, "firma": 1,
             "email": 1, "phone": 1, "strasse": 1, "hausnummer": 1, "plz": 1, "ort": 1,
             "anrede": 1},
        )

    projekt_detail = None
    if termin.get("projekt_id"):
        projekt_detail = await db.module_projekte.find_one(
            {"id": termin["projekt_id"]},
            {"_id": 0, "id": 1, "titel": 1, "kategorie": 1, "status": 1, "beschreibung": 1},
        )

    aufgabe_detail = None
    if termin.get("aufgabe_id"):
        aufgabe_detail = await db.module_aufgaben.find_one(
            {"id": termin["aufgabe_id"]},
            {"_id": 0, "id": 1, "titel": 1, "kategorie": 1, "prioritaet": 1, "status": 1},
        )

    monteur_detail = None
    if termin.get("monteur_username"):
        u = await db.users.find_one(
            {"username": termin["monteur_username"]},
            {"_id": 0, "username": 1, "vorname": 1, "nachname": 1, "role": 1},
        )
        if u:
            monteur_detail = {
                "username": u.get("username", ""),
                "anzeige_name": (
                    f"{u.get('vorname','')} {u.get('nachname','')}".strip() or u.get("username", "")
                ),
                "role": u.get("role", ""),
            }

    return {
        **termin,
        "kunde_detail": kunde_detail,
        "projekt_detail": projekt_detail,
        "aufgabe_detail": aufgabe_detail,
        "monteur_detail": monteur_detail,
    }


@router.post("")
async def create_termin(payload: TerminCreate, user=Depends(get_current_user)):
    await _require_enabled()
    data = payload.model_dump()
    if not data["titel"].strip():
        raise HTTPException(400, "Titel darf nicht leer sein")
    if not data["start"].strip():
        raise HTTPException(400, "Startzeit darf nicht leer sein")
    _validate_enums(data)

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": str(uuid4()),
        "titel": data["titel"].strip(),
        "typ": data["typ"],
        "start": data["start"].strip(),
        "ende": (data.get("ende") or "").strip(),
        "ort": (data.get("ort") or "").strip(),
        "beschreibung": (data.get("beschreibung") or "").strip(),
        "kunde_id": (data.get("kunde_id") or "").strip(),
        "projekt_id": (data.get("projekt_id") or "").strip(),
        "aufgabe_id": (data.get("aufgabe_id") or "").strip(),
        "monteur_username": (data.get("monteur_username") or "").strip(),
        "status": "wartet_auf_go",
        "go_at": None,
        "go_by": None,
        "im_kalender_at": None,
        "google_event_id": None,
        "abgesagt_at": None,
        "abgesagt_grund": "",
        "created_at": now,
        "updated_at": now,
        "created_by": (user or {}).get("username", "unknown"),
    }
    await db.module_termine.insert_one(item)
    item.pop("_id", None)
    logger.info(f"Termin angelegt: {item['titel']} ({item['start']}) von {item['created_by']}")
    return item


@router.put("/{termin_id}")
async def update_termin(termin_id: str, payload: TerminUpdate, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Termin nicht gefunden")
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    _validate_enums(data)
    if "titel" in data and not data["titel"].strip():
        raise HTTPException(400, "Titel darf nicht leer sein")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ("titel", "typ", "start", "ende", "ort", "beschreibung",
                  "kunde_id", "projekt_id", "aufgabe_id", "monteur_username"):
        if field in data:
            update[field] = data[field].strip() if isinstance(data[field], str) else data[field]
    await db.module_termine.update_one({"id": termin_id}, {"$set": update})
    return await db.module_termine.find_one({"id": termin_id}, {"_id": 0})


@router.patch("/{termin_id}/go")
async def confirm_go(termin_id: str, user=Depends(get_current_user)):
    """User klickt "GO" → Termin geht in Status 'bestaetigt' (bereit für Kalender-Sync)."""
    await _require_enabled()
    existing = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Termin nicht gefunden")
    if existing["status"] not in ("wartet_auf_go", "abgesagt"):
        raise HTTPException(400, f"GO nicht möglich aus Status '{existing['status']}'")

    now = datetime.now(timezone.utc).isoformat()
    await db.module_termine.update_one(
        {"id": termin_id},
        {"$set": {
            "status": "bestaetigt",
            "go_at": now,
            "go_by": (user or {}).get("username", "unknown"),
            "abgesagt_at": None,
            "abgesagt_grund": "",
            "updated_at": now,
        }},
    )
    return await db.module_termine.find_one({"id": termin_id}, {"_id": 0})


@router.patch("/{termin_id}/cancel")
async def cancel_termin(termin_id: str, payload: StatusUpdate, user=Depends(get_current_user)):
    """Termin absagen mit Grund."""
    await _require_enabled()
    existing = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Termin nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()
    await db.module_termine.update_one(
        {"id": termin_id},
        {"$set": {
            "status": "abgesagt",
            "abgesagt_at": now,
            "abgesagt_grund": (payload.grund or "").strip(),
            "updated_at": now,
        }},
    )
    return await db.module_termine.find_one({"id": termin_id}, {"_id": 0})


@router.patch("/{termin_id}/mark-im-kalender")
async def mark_im_kalender(
    termin_id: str,
    payload: dict = None,  # erlaubt google_event_id mitzugeben
    user=Depends(get_current_user),
):
    """
    Wird vom Google-Kalender-Modul aufgerufen, NACHDEM der Eintrag in Google angelegt wurde.
    Hier nur Status-Update + event_id-Speicherung (Modul-Trennung).
    """
    await _require_enabled()
    existing = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Termin nicht gefunden")
    if existing["status"] != "bestaetigt":
        raise HTTPException(400, f"Nur 'bestaetigt'-Termine in Kalender markierbar (aktuell: {existing['status']})")

    now = datetime.now(timezone.utc).isoformat()
    update = {
        "status": "im_kalender",
        "im_kalender_at": now,
        "updated_at": now,
    }
    if payload and payload.get("google_event_id"):
        update["google_event_id"] = str(payload["google_event_id"])
    await db.module_termine.update_one({"id": termin_id}, {"$set": update})
    return await db.module_termine.find_one({"id": termin_id}, {"_id": 0})


@router.delete("/{termin_id}")
async def delete_termin(termin_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Termin nicht gefunden")
    if (user or {}).get("role") != "admin" and existing.get("created_by") != (user or {}).get("username"):
        raise HTTPException(403, "Nur eigene Termine löschen oder als Admin")
    await db.module_termine.delete_one({"id": termin_id})
    return {"deleted": True, "id": termin_id}


# ==================== STATS ====================

@router.get("/stats/uebersicht")
async def stats_uebersicht(user=Depends(get_current_user)):
    """Status-Counts für Dashboard / Sidebar."""
    await _require_enabled()
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    result = {s: 0 for s in VALID_STATUS}
    result["gesamt"] = 0
    async for r in db.module_termine.aggregate(pipeline):
        if r["_id"] in result:
            result[r["_id"]] = r["count"]
        result["gesamt"] += r["count"]
    return result
