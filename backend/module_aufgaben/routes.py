"""
Routes für module_aufgaben – interne Aufgaben (Auto waschen, Werkzeugpflege, Lager …).

Module-First:
- Schreibt NUR in module_aufgaben (eigene Collection)
- Liest optional Mitarbeiter-Liste aus users (read-only) für Zuweisung
- KEIN Eingriff in Kunden / Projekte / Einsätze
"""
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db, logger
from routes.auth import get_current_user
from .settings import _get_or_create_settings

router = APIRouter()


VALID_KATEGORIEN = ["auto", "werkzeug", "lager", "fahrzeug", "buero", "sonstige"]
VALID_PRIORITAETEN = ["niedrig", "normal", "hoch"]
VALID_STATUS = ["offen", "in_arbeit", "erledigt"]
VALID_WIEDERHOLUNG = ["einmalig", "taeglich", "woechentlich", "monatlich"]


# ==================== MODELS ====================

class AufgabeCreate(BaseModel):
    titel: str
    beschreibung: str = ""
    kategorie: str = "sonstige"
    prioritaet: str = "normal"
    zugewiesen_an: str = ""  # username, leer = nicht zugewiesen
    faellig_am: str = ""  # ISO-Date, leer = ohne Frist
    wiederholung: str = "einmalig"


class AufgabeUpdate(BaseModel):
    titel: Optional[str] = None
    beschreibung: Optional[str] = None
    kategorie: Optional[str] = None
    prioritaet: Optional[str] = None
    zugewiesen_an: Optional[str] = None
    faellig_am: Optional[str] = None
    wiederholung: Optional[str] = None
    status: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


# ==================== HELPERS ====================

async def _require_enabled():
    s = await _get_or_create_settings()
    if not s.get("feature_enabled"):
        raise HTTPException(403, "Modul Aufgaben ist deaktiviert (Einstellungen)")


def _validate_enums(data: dict):
    if "kategorie" in data and data["kategorie"] not in VALID_KATEGORIEN:
        raise HTTPException(400, f"kategorie muss eine von {VALID_KATEGORIEN} sein")
    if "prioritaet" in data and data["prioritaet"] not in VALID_PRIORITAETEN:
        raise HTTPException(400, f"prioritaet muss eine von {VALID_PRIORITAETEN} sein")
    if "status" in data and data["status"] not in VALID_STATUS:
        raise HTTPException(400, f"status muss einer von {VALID_STATUS} sein")
    if "wiederholung" in data and data["wiederholung"] not in VALID_WIEDERHOLUNG:
        raise HTTPException(400, f"wiederholung muss eine von {VALID_WIEDERHOLUNG} sein")


# ==================== SETTINGS ====================

@router.get("/admin/settings")
async def get_settings(user=Depends(get_current_user)):
    return await _get_or_create_settings()


@router.put("/admin/settings")
async def update_settings(payload: dict, user=Depends(get_current_user)):
    if (user or {}).get("role") != "admin":
        raise HTTPException(403, "Nur Admin")
    if "feature_enabled" in payload:
        await db.module_aufgaben_settings.update_one(
            {"id": "module_aufgaben_settings"},
            {"$set": {"feature_enabled": bool(payload["feature_enabled"])}},
            upsert=True,
        )
    return await _get_or_create_settings()


# ==================== ENUMS / META ====================

@router.get("/meta")
async def meta(user=Depends(get_current_user)):
    return {
        "kategorien": VALID_KATEGORIEN,
        "prioritaeten": VALID_PRIORITAETEN,
        "status": VALID_STATUS,
        "wiederholungen": VALID_WIEDERHOLUNG,
    }


# ==================== MITARBEITER (read-only Hilfsdaten) ====================

@router.get("/mitarbeiter")
async def list_mitarbeiter(user=Depends(get_current_user)):
    """Liste der zuweisbaren Mitarbeiter aus users-Collection (read-only)."""
    cursor = db.users.find(
        {"active": {"$ne": False}},
        {"_id": 0, "username": 1, "vorname": 1, "nachname": 1, "role": 1},
    )
    items = await cursor.to_list(200)
    return [
        {
            "username": u.get("username", ""),
            "anzeige_name": (
                f"{u.get('vorname','')} {u.get('nachname','')}".strip() or u.get("username", "")
            ),
            "role": u.get("role", ""),
        }
        for u in items
        if u.get("username")
    ]


# ==================== AUFGABEN CRUD ====================

@router.get("")
async def list_aufgaben(
    status: str = "",
    kategorie: str = "",
    zugewiesen_an: str = "",
    user=Depends(get_current_user),
):
    await _require_enabled()
    query: dict = {}
    if status:
        query["status"] = status
    if kategorie:
        query["kategorie"] = kategorie
    if zugewiesen_an:
        query["zugewiesen_an"] = zugewiesen_an

    items = await db.module_aufgaben.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@router.get("/{aufgabe_id}")
async def get_aufgabe(aufgabe_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    item = await db.module_aufgaben.find_one({"id": aufgabe_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    return item


@router.post("")
async def create_aufgabe(payload: AufgabeCreate, user=Depends(get_current_user)):
    await _require_enabled()
    data = payload.model_dump()
    if not data["titel"].strip():
        raise HTTPException(400, "Titel darf nicht leer sein")
    _validate_enums(data)

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": str(uuid4()),
        "titel": data["titel"].strip(),
        "beschreibung": (data.get("beschreibung") or "").strip(),
        "kategorie": data["kategorie"],
        "prioritaet": data["prioritaet"],
        "zugewiesen_an": (data.get("zugewiesen_an") or "").strip(),
        "faellig_am": (data.get("faellig_am") or "").strip(),
        "wiederholung": data["wiederholung"],
        "status": "offen",
        "erledigt_am": None,
        "erledigt_von": None,
        "created_at": now,
        "updated_at": now,
        "created_by": (user or {}).get("username", "unknown"),
    }
    await db.module_aufgaben.insert_one(item)
    item.pop("_id", None)
    logger.info(f"Aufgabe angelegt: {item['titel']} (von {item['created_by']})")
    return item


@router.put("/{aufgabe_id}")
async def update_aufgabe(aufgabe_id: str, payload: AufgabeUpdate, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.module_aufgaben.find_one({"id": aufgabe_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Aufgabe nicht gefunden")

    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    _validate_enums(data)

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ("titel", "beschreibung", "kategorie", "prioritaet",
                  "zugewiesen_an", "faellig_am", "wiederholung", "status"):
        if field in data:
            value = data[field]
            update[field] = value.strip() if isinstance(value, str) else value

    # Status -> Zeitstempel
    if data.get("status") == "erledigt":
        update["erledigt_am"] = datetime.now(timezone.utc).isoformat()
        update["erledigt_von"] = (user or {}).get("username", "unknown")
    elif data.get("status") in ("offen", "in_arbeit"):
        update["erledigt_am"] = None
        update["erledigt_von"] = None

    await db.module_aufgaben.update_one({"id": aufgabe_id}, {"$set": update})
    return await db.module_aufgaben.find_one({"id": aufgabe_id}, {"_id": 0})


@router.patch("/{aufgabe_id}/status")
async def update_status(aufgabe_id: str, payload: StatusUpdate, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.module_aufgaben.find_one({"id": aufgabe_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if payload.status not in VALID_STATUS:
        raise HTTPException(400, f"status muss einer von {VALID_STATUS} sein")

    update = {
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.status == "erledigt":
        update["erledigt_am"] = datetime.now(timezone.utc).isoformat()
        update["erledigt_von"] = (user or {}).get("username", "unknown")
    else:
        update["erledigt_am"] = None
        update["erledigt_von"] = None

    await db.module_aufgaben.update_one({"id": aufgabe_id}, {"$set": update})
    return await db.module_aufgaben.find_one({"id": aufgabe_id}, {"_id": 0})


@router.delete("/{aufgabe_id}")
async def delete_aufgabe(aufgabe_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.module_aufgaben.find_one({"id": aufgabe_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if (user or {}).get("role") != "admin" and existing.get("created_by") != (user or {}).get("username"):
        raise HTTPException(403, "Nur eigene Aufgaben löschen oder als Admin")
    await db.module_aufgaben.delete_one({"id": aufgabe_id})
    return {"deleted": True, "id": aufgabe_id}


# ==================== STATS ====================

@router.get("/stats/uebersicht")
async def stats_uebersicht(user=Depends(get_current_user)):
    """Zähler für Dashboard / Sidebar-Badge."""
    await _require_enabled()
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    result = {"offen": 0, "in_arbeit": 0, "erledigt": 0, "gesamt": 0}
    async for r in db.module_aufgaben.aggregate(pipeline):
        if r["_id"] in result:
            result[r["_id"]] = r["count"]
        result["gesamt"] += r["count"]
    return result
