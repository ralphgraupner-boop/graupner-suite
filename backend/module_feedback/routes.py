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

Zusätzliche Collection: module_feedback_history
Pro Notiz werden Änderungen und manuelle Bemerkungen in chronologischer
Reihenfolge gespeichert.
{
  id: str (uuid),
  feedback_id: str (= module_feedback.id),
  type: "change" | "kommentar",
  text: str,                # für change: "Status: offen → erledigt"
                            # für kommentar: freier Text vom User
  created_at: iso-str,
  created_by: username,
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


class KommentarIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_enum(value: str | None, allowed: set[str], field: str) -> None:
    if value is not None and value not in allowed:
        raise HTTPException(400, f"Ungültiger Wert für {field}: {value}")


async def _log_history(feedback_id: str, htype: str, text: str, username: str | None) -> None:
    """Schreibt einen History-Eintrag (Änderung oder Bemerkung)."""
    if htype not in ("change", "kommentar"):
        return
    entry = {
        "id": str(uuid.uuid4()),
        "feedback_id": feedback_id,
        "type": htype,
        "text": text,
        "created_at": _now(),
        "created_by": username or "system",
    }
    await db.module_feedback_history.insert_one(entry)



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
    await _log_history(entry["id"], "change", "Notiz angelegt", entry["created_by"])
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
    change_logs: list[str] = []

    field_labels = {
        "title": "Titel",
        "description": "Beschreibung",
        "typ": "Typ",
        "prio": "Prio",
        "status": "Status",
    }
    for field in ("title", "description", "typ", "prio", "status"):
        val = getattr(payload, field)
        if val is None:
            continue
        new_val = val.strip() if isinstance(val, str) else val
        old_val = (existing.get(field) or "")
        if new_val == old_val:
            continue
        updates[field] = new_val
        if field == "description":
            # Beschreibung kann lang sein – nur "geändert" loggen, ohne kompletten Text
            change_logs.append("Beschreibung geändert")
        else:
            old_disp = old_val or "(leer)"
            new_disp = new_val or "(leer)"
            change_logs.append(f"{field_labels[field]}: {old_disp} → {new_disp}")

    # done_at automatisch mitpflegen
    if payload.status == "erledigt" and existing.get("status") != "erledigt":
        updates["done_at"] = _now()
    elif payload.status and payload.status != "erledigt" and existing.get("done_at"):
        updates["done_at"] = None

    await db.module_feedback.update_one({"id": item_id}, {"$set": updates})

    # History-Einträge pro tatsächlicher Änderung
    username = getattr(user, "username", None)
    for line in change_logs:
        await _log_history(item_id, "change", line, username)

    out = await db.module_feedback.find_one({"id": item_id}, {"_id": 0})
    return out


@router.delete("/{item_id}")
async def delete_item(item_id: str, user=Depends(get_current_user)):
    r = await db.module_feedback.delete_one({"id": item_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    # Auch History-Einträge der Notiz aufräumen (Datensparsamkeit)
    await db.module_feedback_history.delete_many({"feedback_id": item_id})
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
    await _log_history(
        item_id, "change",
        f"Status: {existing.get('status', '?')} → {new_status}",
        getattr(user, "username", None),
    )
    out = await db.module_feedback.find_one({"id": item_id}, {"_id": 0})
    return out


# ─────────────────── History / Bemerkungen ───────────────────
@router.get("/{item_id}/history")
async def get_history(item_id: str, user=Depends(get_current_user)):
    """Liefert den vollständigen Verlauf einer Notiz – Änderungen + Bemerkungen
    – chronologisch (älteste zuerst)."""
    exists = await db.module_feedback.find_one({"id": item_id}, {"_id": 0, "id": 1})
    if not exists:
        raise HTTPException(404, "Eintrag nicht gefunden")
    items: list[dict] = []
    cursor = db.module_feedback_history.find({"feedback_id": item_id}, {"_id": 0}).sort("created_at", 1)
    async for d in cursor:
        items.append(d)
    return items


@router.post("/{item_id}/kommentar")
async def add_kommentar(item_id: str, payload: KommentarIn, user=Depends(get_current_user)):
    """Fügt eine manuelle Bemerkung zu einer Notiz hinzu."""
    exists = await db.module_feedback.find_one({"id": item_id}, {"_id": 0, "id": 1})
    if not exists:
        raise HTTPException(404, "Eintrag nicht gefunden")
    text = payload.text.strip()
    if not text:
        raise HTTPException(400, "Text darf nicht leer sein")
    await _log_history(item_id, "kommentar", text, getattr(user, "username", None))
    # updated_at am Hauptobjekt aktualisieren, damit Sortierung „zuletzt geändert"
    # auch beim Kommentieren funktioniert.
    await db.module_feedback.update_one({"id": item_id}, {"$set": {"updated_at": _now()}})
    # Den frisch erstellten History-Eintrag zurückgeben
    last = await db.module_feedback_history.find_one(
        {"feedback_id": item_id},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return last


@router.delete("/history/{history_id}")
async def delete_history_item(history_id: str, user=Depends(get_current_user)):
    """Eine einzelne Bemerkung wieder entfernen.
    Automatische Change-Logs sollen erhalten bleiben – wir lassen aber
    bewusst auch deren Löschen zu, falls Ralph mal Müll im Verlauf hat."""
    r = await db.module_feedback_history.delete_one({"id": history_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Verlauf-Eintrag nicht gefunden")
    return {"ok": True, "deleted": 1}
