"""CRUD für persönliche Notizen / Bugs / Ideen.

Collection: module_feedback
Dokument-Struktur:
{
  id: str (uuid),
  title: str,
  description: str,
  typ: "bug" | "feature" | "idee" | "test",
  status: "offen" | "in_arbeit" | "erledigt",
  prio: "hoch" | "normal" | "niedrig",
  created_at: iso-str,
  created_by: username,
  updated_at: iso-str,
  done_at: iso-str | null,
}
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from routes.auth import get_current_user

router = APIRouter()

ALLOWED_TYP = {"bug", "feature", "idee", "test"}
ALLOWED_STATUS = {"offen", "in_arbeit", "erledigt"}
ALLOWED_PRIO = {"hoch", "normal", "niedrig"}

# Erledigte Einträge werden nach 30 Tagen automatisch aus der Standard-Liste
# ausgeblendet. Sie bleiben in der DB erhalten und können mit
# `include_archived=true` weiterhin abgerufen werden.
ARCHIVE_DAYS = 30


class FeedbackCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str = ""
    typ: str = "bug"
    prio: str = "normal"


class FeedbackUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = None
    typ: Optional[str] = None
    prio: Optional[str] = None
    status: Optional[str] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_enum(value: str | None, allowed: set[str], field: str) -> None:
    if value is not None and value not in allowed:
        raise HTTPException(400, f"Ungültiger Wert für {field}: {value}")


@router.get("/list")
async def list_items(
    status: str = "alle",
    typ: str = "alle",
    limit: int = 200,
    include_archived: bool = False,
    user=Depends(get_current_user),
):
    q: dict = {}
    if status != "alle":
        _validate_enum(status, ALLOWED_STATUS, "status")
        q["status"] = status
    if typ != "alle":
        _validate_enum(typ, ALLOWED_TYP, "typ")
        q["typ"] = typ

    # Archiv-Filter: erledigte Einträge älter als 30 Tage standardmäßig ausblenden.
    if not include_archived:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=ARCHIVE_DAYS)).isoformat()
        q["$or"] = [
            {"status": {"$ne": "erledigt"}},
            {"done_at": {"$gte": cutoff}},
            {"done_at": None},
        ]

    items: list[dict] = []
    cursor = db.module_feedback.find(q, {"_id": 0}).sort([("status", 1), ("prio", 1), ("created_at", -1)]).limit(limit)
    async for d in cursor:
        items.append(d)
    return items


@router.get("/count")
async def count_open(user=Depends(get_current_user)):
    """Schneller Zähler für das Badge im Floating-Widget.
    Berücksichtigt nur noch nicht erledigte Einträge (also ohne Archiv-Bezug)."""
    offen = await db.module_feedback.count_documents({"status": "offen"})
    in_arbeit = await db.module_feedback.count_documents({"status": "in_arbeit"})
    # Wie viele erledigte sind aktuell sichtbar (letzte 30 Tage)?
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ARCHIVE_DAYS)).isoformat()
    archived = await db.module_feedback.count_documents({
        "status": "erledigt",
        "done_at": {"$lt": cutoff},
    })
    return {
        "offen": offen,
        "in_arbeit": in_arbeit,
        "total_open": offen + in_arbeit,
        "archived": archived,
    }


@router.post("")
async def create_item(payload: FeedbackCreate, user=Depends(get_current_user)):
    _validate_enum(payload.typ, ALLOWED_TYP, "typ")
    _validate_enum(payload.prio, ALLOWED_PRIO, "prio")
    now = _now()
    entry = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "description": (payload.description or "").strip(),
        "typ": payload.typ,
        "prio": payload.prio,
        "status": "offen",
        "created_at": now,
        "created_by": getattr(user, "username", "system"),
        "updated_at": now,
        "done_at": None,
    }
    await db.module_feedback.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.patch("/{item_id}")
async def update_item(item_id: str, payload: FeedbackUpdate, user=Depends(get_current_user)):
    existing = await db.module_feedback.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Eintrag nicht gefunden")

    _validate_enum(payload.typ, ALLOWED_TYP, "typ")
    _validate_enum(payload.prio, ALLOWED_PRIO, "prio")
    _validate_enum(payload.status, ALLOWED_STATUS, "status")

    updates: dict = {"updated_at": _now()}
    for field in ("title", "description", "typ", "prio", "status"):
        val = getattr(payload, field)
        if val is not None:
            updates[field] = val.strip() if isinstance(val, str) else val

    # done_at automatisch mitpflegen
    if payload.status == "erledigt" and existing.get("status") != "erledigt":
        updates["done_at"] = _now()
    elif payload.status and payload.status != "erledigt" and existing.get("done_at"):
        updates["done_at"] = None

    await db.module_feedback.update_one({"id": item_id}, {"$set": updates})
    out = await db.module_feedback.find_one({"id": item_id}, {"_id": 0})
    return out


@router.delete("/{item_id}")
async def delete_item(item_id: str, user=Depends(get_current_user)):
    r = await db.module_feedback.delete_one({"id": item_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"ok": True, "deleted": 1}


@router.post("/{item_id}/toggle-done")
async def toggle_done(item_id: str, user=Depends(get_current_user)):
    """Ein-Klick-Wechsel zwischen 'offen' und 'erledigt'."""
    existing = await db.module_feedback.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Eintrag nicht gefunden")
    now = _now()
    if existing.get("status") == "erledigt":
        new_status, done_at = "offen", None
    else:
        new_status, done_at = "erledigt", now
    await db.module_feedback.update_one(
        {"id": item_id},
        {"$set": {"status": new_status, "done_at": done_at, "updated_at": now}},
    )
    out = await db.module_feedback.find_one({"id": item_id}, {"_id": 0})
    return out
