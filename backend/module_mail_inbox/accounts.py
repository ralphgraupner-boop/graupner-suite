"""
module_mail_inbox/accounts.py

Verwaltung mehrerer IMAP-Postfächer für den Anfragen-Scanner.

Konzept:
  - Eine Mongo-Collection: module_mail_inbox_accounts
  - Pro Eintrag: id, label, server, port, username, password_enc, active, created_at, updated_at
  - Passwörter werden mit Fernet (symmetric) verschlüsselt; Schlüssel aus
    ENV `IMAP_ENC_KEY`. Wenn nicht gesetzt, fallen wir auf JWT_SECRET-Hash zurück
    (selbst dann reproduzierbar pro Umgebung).
  - Migration: beim ersten Aufruf von list_accounts() wird – falls Collection
    leer – das alte ENV-Postfach als "Hauptpostfach" automatisch importiert.
"""
import os
import uuid
import base64
import hashlib
import imaplib
from datetime import datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db, logger
from routes.auth import get_current_user

router = APIRouter()

ACCOUNTS_COLL = "module_mail_inbox_accounts"


# ───────────────────────────── Verschlüsselung ─────────────────────────────
def _get_fernet() -> Fernet:
    """Liefert ein Fernet-Cipher.
    Bevorzugt env-Schlüssel `IMAP_ENC_KEY`, sonst deterministisch aus JWT_SECRET."""
    raw_key = os.environ.get("IMAP_ENC_KEY")
    if raw_key:
        try:
            return Fernet(raw_key.encode())
        except Exception:
            pass
    seed = (os.environ.get("JWT_SECRET") or "graupner-suite-default").encode()
    digest = hashlib.sha256(seed).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_password(password: str) -> str:
    if not password:
        return ""
    return _get_fernet().encrypt(password.encode()).decode()


def decrypt_password(token: str) -> str:
    if not token:
        return ""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        # Falls Klartext (z.B. Migration vergessen) → so zurückgeben
        return token


def _mask_password(raw: str) -> str:
    """Maskiert ein Passwort für API-Antworten (nur Länge sichtbar)."""
    if not raw:
        return ""
    return "•" * 8


# ───────────────────────────── Pydantic-Modelle ────────────────────────────
class AccountIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    server: str = Field(..., min_length=1, max_length=200)
    port: int = Field(default=993, ge=1, le=65535)
    username: str = Field(..., min_length=1, max_length=200)
    password: Optional[str] = ""  # leer = keine Änderung beim Update
    active: bool = True


class AccountOut(BaseModel):
    id: str
    label: str
    server: str
    port: int
    username: str
    password_masked: str
    active: bool
    created_at: str
    updated_at: str
    last_test_at: Optional[str] = ""
    last_test_ok: Optional[bool] = None
    last_test_message: Optional[str] = ""


# ───────────────────────────── Helfer ──────────────────────────────────────
def _to_out(d: dict) -> dict:
    return {
        "id": d["id"],
        "label": d.get("label", ""),
        "server": d.get("server", ""),
        "port": d.get("port", 993),
        "username": d.get("username", ""),
        "password_masked": _mask_password(d.get("password_enc", "")),
        "active": bool(d.get("active", True)),
        "created_at": d.get("created_at", ""),
        "updated_at": d.get("updated_at", ""),
        "last_test_at": d.get("last_test_at", ""),
        "last_test_ok": d.get("last_test_ok"),
        "last_test_message": d.get("last_test_message", ""),
    }


async def _ensure_seed():
    """Wenn Collection leer und ENV gesetzt → einmalig migrieren."""
    count = await db[ACCOUNTS_COLL].count_documents({})
    if count > 0:
        return
    server = os.environ.get("IMAP_SERVER")
    user = os.environ.get("IMAP_USER")
    password = os.environ.get("IMAP_PASSWORD")
    port = int(os.environ.get("IMAP_PORT", "993"))
    if not (server and user and password):
        return
    now = datetime.now(timezone.utc).isoformat()
    await db[ACCOUNTS_COLL].insert_one({
        "id": str(uuid.uuid4()),
        "label": "Hauptpostfach",
        "server": server,
        "port": port,
        "username": user,
        "password_enc": encrypt_password(password),
        "active": True,
        "created_at": now,
        "updated_at": now,
        "source": "env_migration",
    })
    logger.info(f"module_mail_inbox: ENV-Postfach '{user}' nach DB migriert.")


async def get_active_accounts() -> list[dict]:
    """Liefert alle aktiven Postfächer (mit entschlüsseltem Passwort).
    Wird vom Scanner verwendet – NICHT direkt an Frontend zurückgeben."""
    await _ensure_seed()
    out = []
    async for d in db[ACCOUNTS_COLL].find({"active": True}, {"_id": 0}):
        out.append({
            "id": d["id"],
            "label": d.get("label", ""),
            "server": d.get("server", ""),
            "port": d.get("port", 993),
            "username": d.get("username", ""),
            "password": decrypt_password(d.get("password_enc", "")),
        })
    return out


# ───────────────────────────── Routen ──────────────────────────────────────
@router.get("/accounts")
async def list_accounts(user=Depends(get_current_user)):
    await _ensure_seed()
    items = []
    async for d in db[ACCOUNTS_COLL].find({}, {"_id": 0}).sort("created_at", 1):
        items.append(_to_out(d))
    return items


@router.post("/accounts")
async def create_account(body: AccountIn, user=Depends(get_current_user)):
    await _ensure_seed()
    if not body.password:
        raise HTTPException(400, "Passwort ist beim Anlegen Pflicht.")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "label": body.label.strip(),
        "server": body.server.strip(),
        "port": body.port,
        "username": body.username.strip(),
        "password_enc": encrypt_password(body.password),
        "active": body.active,
        "created_at": now,
        "updated_at": now,
        "created_by": getattr(user, "username", None),
    }
    await db[ACCOUNTS_COLL].insert_one(entry)
    return _to_out(entry)


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, body: AccountIn, user=Depends(get_current_user)):
    existing = await db[ACCOUNTS_COLL].find_one({"id": account_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Postfach nicht gefunden.")
    update = {
        "label": body.label.strip(),
        "server": body.server.strip(),
        "port": body.port,
        "username": body.username.strip(),
        "active": body.active,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": getattr(user, "username", None),
    }
    if body.password:  # nur bei expliziter Eingabe ändern
        update["password_enc"] = encrypt_password(body.password)
    await db[ACCOUNTS_COLL].update_one({"id": account_id}, {"$set": update})
    merged = {**existing, **update}
    return _to_out(merged)


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user=Depends(get_current_user)):
    total = await db[ACCOUNTS_COLL].count_documents({})
    if total <= 1:
        raise HTTPException(400, "Mindestens ein Postfach muss erhalten bleiben.")
    r = await db[ACCOUNTS_COLL].delete_one({"id": account_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Postfach nicht gefunden.")
    return {"ok": True}


@router.post("/accounts/{account_id}/test")
async def test_account(account_id: str, user=Depends(get_current_user)):
    """Testet die IMAP-Verbindung für ein gespeichertes Postfach."""
    d = await db[ACCOUNTS_COLL].find_one({"id": account_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Postfach nicht gefunden.")
    server = d.get("server", "")
    port = int(d.get("port", 993))
    username = d.get("username", "")
    password = decrypt_password(d.get("password_enc", ""))
    ok, msg, folder_count = False, "", 0
    try:
        imap = imaplib.IMAP4_SSL(server, port)
        imap.login(username, password)
        typ, data = imap.list()
        if typ == "OK":
            folder_count = len(data) if data else 0
        try:
            imap.logout()
        except Exception:
            pass
        ok = True
        msg = f"Verbunden – {folder_count} Ordner sichtbar."
    except imaplib.IMAP4.error as e:
        msg = f"Login fehlgeschlagen: {e}"
    except Exception as e:  # noqa: BLE001
        msg = f"Verbindungsfehler: {e}"
    now = datetime.now(timezone.utc).isoformat()
    await db[ACCOUNTS_COLL].update_one(
        {"id": account_id},
        {"$set": {"last_test_at": now, "last_test_ok": ok, "last_test_message": msg}},
    )
    return {"ok": ok, "message": msg, "folder_count": folder_count}


@router.post("/accounts/test-credentials")
async def test_credentials(body: AccountIn, user=Depends(get_current_user)):
    """Test-Verbindung mit Live-Eingabe (vor dem Speichern)."""
    if not body.password:
        raise HTTPException(400, "Passwort ist für den Test erforderlich.")
    try:
        imap = imaplib.IMAP4_SSL(body.server, body.port)
        imap.login(body.username, body.password)
        typ, data = imap.list()
        folder_count = len(data) if (typ == "OK" and data) else 0
        try:
            imap.logout()
        except Exception:
            pass
        return {"ok": True, "message": f"Verbunden – {folder_count} Ordner sichtbar.", "folder_count": folder_count}
    except imaplib.IMAP4.error as e:
        raise HTTPException(400, f"Login fehlgeschlagen: {e}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Verbindungsfehler: {e}")
