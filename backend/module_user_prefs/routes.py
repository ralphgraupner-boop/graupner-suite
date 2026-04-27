"""
Routes für module_user_prefs.

Speichert pro User:
- sidebar_order: Liste von Pfaden in gewünschter Reihenfolge (z.B. ["/dashboard", "/module/kunden", ...])
- sidebar_hidden: Liste von Pfaden, die ausgeblendet werden sollen (für Personalisierung)

Pfade unbekannter (alter) Sidebar-Items werden ignoriert; neue Items werden ans Ende gehängt.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from routes.auth import get_current_user

router = APIRouter()


class UserPrefs(BaseModel):
    sidebar_order: Optional[List[str]] = None
    sidebar_hidden: Optional[List[str]] = None


def _doc_id(username: str) -> str:
    return f"prefs:{username}"


async def _get_prefs(username: str) -> dict:
    doc = await db.module_user_prefs.find_one({"id": _doc_id(username)}, {"_id": 0})
    if not doc:
        return {
            "id": _doc_id(username),
            "username": username,
            "sidebar_order": [],
            "sidebar_hidden": [],
            "updated_at": None,
        }
    return doc


@router.get("/me")
async def get_my_prefs(user=Depends(get_current_user)):
    """Liefert die UI-Präferenzen des aktuellen Users."""
    username = (user or {}).get("username", "")
    if not username:
        raise HTTPException(401, "Nicht eingeloggt")
    return await _get_prefs(username)


@router.put("/me")
async def save_my_prefs(payload: UserPrefs, user=Depends(get_current_user)):
    """Speichert sidebar_order / sidebar_hidden des aktuellen Users."""
    username = (user or {}).get("username", "")
    if not username:
        raise HTTPException(401, "Nicht eingeloggt")

    update: dict = {
        "username": username,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.sidebar_order is not None:
        # Validierung: Liste, max 50 Einträge, jeder String startet mit '/'
        order = [s for s in payload.sidebar_order if isinstance(s, str) and s.startswith("/")]
        if len(order) > 50:
            order = order[:50]
        update["sidebar_order"] = order
    if payload.sidebar_hidden is not None:
        hidden = [s for s in payload.sidebar_hidden if isinstance(s, str) and s.startswith("/")]
        if len(hidden) > 50:
            hidden = hidden[:50]
        update["sidebar_hidden"] = hidden

    await db.module_user_prefs.update_one(
        {"id": _doc_id(username)},
        {"$set": update, "$setOnInsert": {"id": _doc_id(username)}},
        upsert=True,
    )
    return await _get_prefs(username)


@router.delete("/me")
async def reset_my_prefs(user=Depends(get_current_user)):
    """Setzt die Sidebar-Reihenfolge auf Standard zurück."""
    username = (user or {}).get("username", "")
    if not username:
        raise HTTPException(401, "Nicht eingeloggt")
    await db.module_user_prefs.delete_one({"id": _doc_id(username)})
    return {"ok": True, "reset": True}
