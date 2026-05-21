"""Routes fuer module_benachrichtigungen.

Endpunkte (Prefix wird in server.py gesetzt: /api/module-benachrichtigungen):

  GET    /me              -> eigene Einstellungen (jeder eingeloggte User)
  GET    /defaults        -> Standard-Werte pro Rolle (zur Anzeige in UI)
  GET    /{username}      -> Einstellungen eines anderen Users (NUR Admin)
  PUT    /{username}      -> Einstellungen eines anderen Users setzen (NUR Admin)
"""
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from routes.auth import get_current_user

router = APIRouter()


# ==================== Schluessel + Defaults ====================

# Alle bekannten Benachrichtigungs-Schluessel (zentrale Quelle).
PREF_KEYS = [
    "popup_papierkorb",
    "popup_kundenlink_expiry",
]


def defaults_for_role(role: str) -> Dict[str, bool]:
    """Standard-Werte pro Rolle. Admin = alles an, andere = alles aus."""
    role = (role or "").lower()
    if role == "admin":
        return {k: True for k in PREF_KEYS}
    # buchhaltung, mitarbeiter, unbekannt
    return {k: False for k in PREF_KEYS}


# ==================== Helper ====================

def _doc_id(username: str) -> str:
    return f"benachrichtigungen:{username}"


def _username_of(user) -> str:
    if isinstance(user, dict):
        return user.get("username") or ""
    return getattr(user, "username", "") or ""


def _role_of(user) -> str:
    if isinstance(user, dict):
        return (user.get("role") or "").lower()
    return (getattr(user, "role", "") or "").lower()


def _require_admin(user):
    if _role_of(user) != "admin":
        raise HTTPException(403, "Nur Admin darf andere User verwalten.")


async def _get_user_role_from_db(username: str) -> str:
    u = await db.users.find_one({"username": username}, {"_id": 0, "role": 1})
    if not u:
        return ""
    return (u.get("role") or "").lower()


async def _load_prefs(username: str, role_hint: str = "") -> Dict[str, bool]:
    """Liefert die effektiven Prefs fuer den User.

    - Wenn ein DB-Dokument existiert: nimm die gespeicherten Werte, fuelle
      fehlende Schluessel mit den Default-Werten der Rolle auf.
    - Wenn kein DB-Dokument existiert: gib die Defaults der Rolle zurueck.
    """
    role = role_hint or await _get_user_role_from_db(username)
    defaults = defaults_for_role(role)

    doc = await db.module_benachrichtigungen_prefs.find_one(
        {"id": _doc_id(username)}, {"_id": 0}
    )
    if not doc:
        return defaults
    saved = (doc.get("prefs") or {}) if isinstance(doc.get("prefs"), dict) else {}
    return {k: bool(saved.get(k, defaults[k])) for k in PREF_KEYS}


# ==================== Models ====================

class PrefsUpdate(BaseModel):
    prefs: Dict[str, bool]


# ==================== Endpoints ====================

@router.get("/me")
async def get_my_prefs(user=Depends(get_current_user)):
    """Eigene Benachrichtigungs-Einstellungen lesen."""
    username = _username_of(user)
    if not username:
        raise HTTPException(401, "Nicht eingeloggt")
    role = _role_of(user) or await _get_user_role_from_db(username)
    prefs = await _load_prefs(username, role)
    return {"username": username, "role": role, "prefs": prefs}


@router.get("/defaults")
async def get_role_defaults(user=Depends(get_current_user)):
    """Default-Werte pro Rolle (fuer UI-Anzeige 'Standard wiederherstellen')."""
    return {
        "keys": PREF_KEYS,
        "defaults": {
            "admin": defaults_for_role("admin"),
            "buchhaltung": defaults_for_role("buchhaltung"),
            "mitarbeiter": defaults_for_role("mitarbeiter"),
        },
    }


@router.get("/{username}")
async def get_user_prefs(username: str, user=Depends(get_current_user)):
    """Einstellungen eines anderen Users lesen. Nur Admin."""
    _require_admin(user)
    role = await _get_user_role_from_db(username)
    if not role:
        raise HTTPException(404, "Benutzer nicht gefunden")
    prefs = await _load_prefs(username, role)
    return {"username": username, "role": role, "prefs": prefs}


@router.put("/{username}")
async def update_user_prefs(username: str, payload: PrefsUpdate, user=Depends(get_current_user)):
    """Einstellungen eines anderen Users schreiben. Nur Admin."""
    _require_admin(user)
    role = await _get_user_role_from_db(username)
    if not role:
        raise HTTPException(404, "Benutzer nicht gefunden")
    # Nur erlaubte Keys uebernehmen, alles andere ignorieren
    cleaned = {k: bool(payload.prefs.get(k, False)) for k in PREF_KEYS}
    await db.module_benachrichtigungen_prefs.update_one(
        {"id": _doc_id(username)},
        {
            "$set": {
                "username": username,
                "prefs": cleaned,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": _username_of(user),
            },
            "$setOnInsert": {"id": _doc_id(username)},
        },
        upsert=True,
    )
    return {"username": username, "role": role, "prefs": cleaned}
