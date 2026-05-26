"""Routes für module_wolke — siehe __init__.py."""
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from routes.auth import get_current_user

router = APIRouter()

VALID_TYPES = ["memo", "aufgabe"]
VALID_STATUS = ["offen", "erledigt"]


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _now_iso() -> str:
    return _iso(datetime.now(timezone.utc))


async def _get_mitarbeiter_for_user(user) -> Optional[dict]:
    """Sucht den Mitarbeiter-Datensatz zum eingeloggten User.
    Reihenfolge: vorname+nachname == username, dann email == users.email.
    """
    username = (getattr(user, "username", "") or (user or {}).get("username", "") or "").strip()
    email = (getattr(user, "email", "") or (user or {}).get("email", "") or "").strip()
    if username:
        parts = username.split()
        if len(parts) >= 2:
            m = await db.mitarbeiter.find_one(
                {"vorname": parts[0], "nachname": " ".join(parts[1:])},
                {"_id": 0},
            )
            if m:
                return m
        m = await db.mitarbeiter.find_one(
            {"$expr": {"$eq": [{"$concat": ["$vorname", " ", "$nachname"]}, username]}},
            {"_id": 0},
        )
        if m:
            return m
    if email:
        m = await db.mitarbeiter.find_one({"email": email}, {"_id": 0})
        if m:
            return m
    return None


def _username(user) -> str:
    return (getattr(user, "username", None) or (user or {}).get("username", "") or "").strip()


def _mitarbeiter_label(m: dict) -> str:
    return f"{(m or {}).get('vorname','')} {(m or {}).get('nachname','')}".strip()


async def _kunde_label(kunde_id: str) -> str:
    if not kunde_id:
        return ""
    k = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0, "vorname": 1, "nachname": 1, "firma": 1, "name": 1})
    if not k:
        return ""
    return (
        k.get("firma")
        or " ".join([s for s in [k.get("vorname", ""), k.get("nachname", "")] if s]).strip()
        or k.get("name")
        or ""
    )


class WolkeCreate(BaseModel):
    type: str
    empfaenger_id: str
    kunde_id: Optional[str] = ""
    text: str


@router.post("")
async def create_wolke(body: WolkeCreate, user=Depends(get_current_user)):
    if body.type not in VALID_TYPES:
        raise HTTPException(400, f"type muss einer von {VALID_TYPES} sein")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "text darf nicht leer sein")
    if not body.empfaenger_id:
        raise HTTPException(400, "empfaenger_id fehlt")

    empf = await db.mitarbeiter.find_one({"id": body.empfaenger_id}, {"_id": 0})
    if not empf:
        raise HTTPException(404, "Empfänger-Mitarbeiter nicht gefunden")

    absender = await _get_mitarbeiter_for_user(user)
    absender_id = (absender or {}).get("id", "")
    absender_name = _mitarbeiter_label(absender or {}) or _username(user) or "Unbekannt"

    kunde_id = (body.kunde_id or "").strip()
    kunde_label = await _kunde_label(kunde_id) if kunde_id else ""

    # Memos gelten sofort als 'erledigt' (Counter zählt sie nicht).
    status = "erledigt" if body.type == "memo" else "offen"
    now = _now_iso()
    doc = {
        "id": str(uuid4()),
        "type": body.type,
        "absender_id": absender_id,
        "absender_name": absender_name,
        "empfaenger_id": empf.get("id", ""),
        "empfaenger_name": _mitarbeiter_label(empf),
        "kunde_id": kunde_id,
        "kunde_label": kunde_label,
        "text": text,
        "status": status,
        "created_at": now,
        "created_by_user": _username(user),
        "erledigt_am": now if status == "erledigt" else None,
        "erledigt_von": absender_id if status == "erledigt" else None,
    }
    await db.module_wolke.insert_one({**doc})  # avoid _id mutation in response
    return doc


def _normalize_status_filter(status: str) -> dict:
    if not status or status == "all":
        return {}
    if status not in VALID_STATUS:
        raise HTTPException(400, f"status muss einer von {VALID_STATUS} oder 'all' sein")
    return {"status": status}


@router.get("/erhalten")
async def list_erhalten(status: str = "all", user=Depends(get_current_user)):
    me = await _get_mitarbeiter_for_user(user)
    if not me:
        return []
    q = {"empfaenger_id": me.get("id", "")}
    q.update(_normalize_status_filter(status))
    docs = await db.module_wolke.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@router.get("/gesendet")
async def list_gesendet(status: str = "all", user=Depends(get_current_user)):
    me = await _get_mitarbeiter_for_user(user)
    if not me:
        return []
    q = {"absender_id": me.get("id", "")}
    q.update(_normalize_status_filter(status))
    docs = await db.module_wolke.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@router.get("/count-offen")
async def count_offen(user=Depends(get_current_user)):
    me = await _get_mitarbeiter_for_user(user)
    if not me:
        return {"count": 0}
    n = await db.module_wolke.count_documents({
        "empfaenger_id": me.get("id", ""),
        "type": "aufgabe",
        "status": "offen",
    })
    return {"count": n}


@router.patch("/{wolke_id}/erledigt")
async def mark_erledigt(wolke_id: str, user=Depends(get_current_user)):
    doc = await db.module_wolke.find_one({"id": wolke_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Wolke nicht gefunden")
    me = await _get_mitarbeiter_for_user(user)
    is_admin = (getattr(user, "role", "") or (user or {}).get("role", "")) == "admin"
    if not is_admin and (not me or me.get("id") != doc.get("empfaenger_id")):
        raise HTTPException(403, "Nur der Empfänger oder ein Admin darf erledigen")
    if doc.get("status") == "erledigt":
        return doc
    now = _now_iso()
    await db.module_wolke.update_one(
        {"id": wolke_id},
        {"$set": {
            "status": "erledigt",
            "erledigt_am": now,
            "erledigt_von": (me or {}).get("id", "") or "admin",
        }},
    )
    doc["status"] = "erledigt"
    doc["erledigt_am"] = now
    doc["erledigt_von"] = (me or {}).get("id", "") or "admin"
    return doc


@router.delete("/{wolke_id}")
async def delete_wolke(wolke_id: str, user=Depends(get_current_user)):
    doc = await db.module_wolke.find_one({"id": wolke_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Wolke nicht gefunden")
    me = await _get_mitarbeiter_for_user(user)
    is_admin = (getattr(user, "role", "") or (user or {}).get("role", "")) == "admin"
    if not is_admin and (not me or me.get("id") != doc.get("absender_id")):
        raise HTTPException(403, "Nur der Absender oder ein Admin darf löschen")
    await db.module_wolke.delete_one({"id": wolke_id})
    return {"ok": True}


@router.get("/mitarbeiter")
async def list_mitarbeiter(user=Depends(get_current_user)):
    """Empfänger-Auswahl: aktive Mitarbeiter mit Anzeige-Name."""
    cursor = db.mitarbeiter.find(
        {"$or": [{"status": "aktiv"}, {"status": {"$exists": False}}, {"status": ""}]},
        {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "email": 1, "position": 1},
    )
    out = []
    async for m in cursor:
        out.append({
            "id": m.get("id", ""),
            "name": _mitarbeiter_label(m),
            "email": m.get("email", ""),
            "position": m.get("position", ""),
        })
    out.sort(key=lambda x: x["name"].lower())
    return out
