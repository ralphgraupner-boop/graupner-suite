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

# Erlaubte Filter-Typen (UI + Backend)
FILTER_TYPES = {
    "subject_contains",   # Betreff enthält (case-insensitive)
    "subject_startswith", # Betreff beginnt mit
    "from_contains",      # Absender enthält
    "from_equals",        # Absender ist exakt
}

# Hart ausgeschlossen: Antworten, Weiterleitungen, Auto-Responses
# Diese greifen IMMER, unabhängig davon was die Regeln sagen — denn
# eine "Re:", "AW:", "Fwd:"-Mail ist per Definition KEINE neue Anfrage.
REPLY_PREFIXES = (
    "re:", "aw:", "fw:", "fwd:", "wg:",
    "read:",                 # Lesebestätigungen (z.B. DEVK)
    "undeliverable:",        # Bounce
    "automatic reply:",      # Out-of-Office (engl.)
    "automatische antwort:", # Out-of-Office (dt.)
    "out of office:",
    "abwesenheit",           # variant ohne Doppelpunkt
)

# Default-Regeln für Bestandspostfächer ohne explizite Filter
DEFAULT_FILTER_RULES = [
    {"type": "from_contains", "value": "no-reply@jimdo.com"},
    {"type": "subject_contains", "value": "Anfrage von"},
    {"type": "subject_contains", "value": "Nachricht über"},
]


def _is_reply_or_auto(subject: str) -> bool:
    """Erkennt Antwort-/Weiterleitungs-/Auto-Response-Betreffs.
    Prüft den Anfang des (getrimmten, lower-cased) Subjects gegen REPLY_PREFIXES.
    Robust gegen mehrfaches Verschachteln wie "Fwd: Re: AW: ..." — solange
    das erste Token matcht, reicht das."""
    s = (subject or "").strip().lower()
    if not s:
        return False
    for p in REPLY_PREFIXES:
        if s.startswith(p):
            return True
    return False


def filter_matches(rules: list, subject: str, from_email: str) -> bool:
    """Prüft, ob mindestens eine Regel auf die Mail passt (OR-Logik).
    Zusätzlich: Mails mit Antwort-/Weiterleitungs-Präfix im Betreff werden
    IMMER abgelehnt — denn das sind keine neuen Anfragen."""
    if not rules:
        return False
    # Harter Ausschluss BEVOR wir überhaupt regeln prüfen
    if _is_reply_or_auto(subject):
        return False
    s = (subject or "").lower()
    f = (from_email or "").lower()
    for r in rules:
        t = (r.get("type") or "").strip()
        v = (r.get("value") or "").strip().lower()
        if not t or not v:
            continue
        if t == "subject_contains" and v in s:
            return True
        if t == "subject_startswith" and s.startswith(v):
            return True
        if t == "from_contains" and v in f:
            return True
        if t == "from_equals" and f == v:
            return True
    return False


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
class FilterRule(BaseModel):
    type: str = Field(..., description="subject_contains | subject_startswith | from_contains | from_equals")
    value: str = Field(..., min_length=1, max_length=200)


class AccountIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    server: str = Field(..., min_length=1, max_length=200)
    port: int = Field(default=993, ge=1, le=65535)
    username: str = Field(..., min_length=1, max_length=200)
    password: Optional[str] = ""  # leer = keine Änderung beim Update
    active: bool = True
    filter_rules: list[FilterRule] = Field(default_factory=list)


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
    filter_rules: list = Field(default_factory=list)


# ───────────────────────────── Helfer ──────────────────────────────────────
def _normalize_rules(raw_rules) -> list | bool:
    """Validiert und säubert eine Liste von FilterRules.
    Liefert: List bei Erfolg (auch leer), False bei ungültigem Typ."""
    if not raw_rules:
        return []
    out = []
    for r in raw_rules:
        if hasattr(r, "model_dump"):
            r = r.model_dump()
        elif hasattr(r, "dict"):
            r = r.dict()
        if not isinstance(r, dict):
            continue
        t = (r.get("type") or "").strip()
        v = (r.get("value") or "").strip()
        if not t or not v:
            continue
        if t not in FILTER_TYPES:
            return False
        out.append({"type": t, "value": v})
    return out


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
        "filter_rules": d.get("filter_rules") or [],
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
        "filter_rules": list(DEFAULT_FILTER_RULES),
        "created_at": now,
        "updated_at": now,
        "source": "env_migration",
    })
    logger.info(f"module_mail_inbox: ENV-Postfach '{user}' nach DB migriert.")


async def _ensure_filter_rules_present():
    """Bestandskonten ohne filter_rules-Feld bekommen die Defaults."""
    async for d in db[ACCOUNTS_COLL].find({"filter_rules": {"$exists": False}}, {"_id": 0, "id": 1}):
        await db[ACCOUNTS_COLL].update_one(
            {"id": d["id"]},
            {"$set": {"filter_rules": list(DEFAULT_FILTER_RULES)}},
        )


async def get_active_accounts() -> list[dict]:
    """Liefert alle aktiven Postfächer (mit entschlüsseltem Passwort).
    Wird vom Scanner verwendet – NICHT direkt an Frontend zurückgeben."""
    await _ensure_seed()
    await _ensure_filter_rules_present()
    out = []
    async for d in db[ACCOUNTS_COLL].find({"active": True}, {"_id": 0}):
        out.append({
            "id": d["id"],
            "label": d.get("label", ""),
            "server": d.get("server", ""),
            "port": d.get("port", 993),
            "username": d.get("username", ""),
            "password": decrypt_password(d.get("password_enc", "")),
            "filter_rules": d.get("filter_rules") or list(DEFAULT_FILTER_RULES),
        })
    return out


# ───────────────────────────── Routen ──────────────────────────────────────
@router.get("/accounts")
async def list_accounts(user=Depends(get_current_user)):
    await _ensure_seed()
    await _ensure_filter_rules_present()
    items = []
    async for d in db[ACCOUNTS_COLL].find({}, {"_id": 0}).sort("created_at", 1):
        items.append(_to_out(d))
    return items


@router.post("/accounts")
async def create_account(body: AccountIn, user=Depends(get_current_user)):
    await _ensure_seed()
    if not body.password:
        raise HTTPException(400, "Passwort ist beim Anlegen Pflicht.")
    rules = _normalize_rules(body.filter_rules)
    if rules is False:
        raise HTTPException(400, "Ungültiger Filter-Typ. Erlaubt: subject_contains, subject_startswith, from_contains, from_equals.")
    final_rules = rules if rules else list(DEFAULT_FILTER_RULES)
    if len(final_rules) < 2:
        raise HTTPException(400, "Bitte mindestens 2 Filter-Regeln pro Postfach definieren.")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "label": body.label.strip(),
        "server": body.server.strip(),
        "port": body.port,
        "username": body.username.strip(),
        "password_enc": encrypt_password(body.password),
        "active": body.active,
        "filter_rules": final_rules,
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
    rules = _normalize_rules(body.filter_rules)
    if rules is False:
        raise HTTPException(400, "Ungültiger Filter-Typ. Erlaubt: subject_contains, subject_startswith, from_contains, from_equals.")
    final_rules = rules if rules else list(DEFAULT_FILTER_RULES)
    if len(final_rules) < 2:
        raise HTTPException(400, "Bitte mindestens 2 Filter-Regeln pro Postfach definieren.")
    update = {
        "label": body.label.strip(),
        "server": body.server.strip(),
        "port": body.port,
        "username": body.username.strip(),
        "active": body.active,
        "filter_rules": final_rules,
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
