"""
Portal v3 – Auth-Utilities (isoliert)
Passwort-Generator, bcrypt-Hash, Token, Customer-Auth-Dependency.
"""
import secrets
import string
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Header, HTTPException

from database import JWT_SECRET, db

PORTAL_V3_TOKEN_AUD = "portal-v3-customer"


def generate_password(length: int = 10) -> str:
    """Klartext-Passwort mit guter Lesbarkeit (ohne 0/O/1/l/I)."""
    alphabet = "".join(c for c in (string.ascii_letters + string.digits) if c not in "0O1lI")
    return "".join(secrets.choice(alphabet) for _ in range(length))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def generate_login_token(length: int = 32) -> str:
    """URL-sicherer Token (persistiert pro Account, Teil der Einladungs-URL)."""
    return secrets.token_urlsafe(length)


def create_session_token(account_id: str, ttl_hours: int = 24 * 7) -> str:
    """JWT für eingeloggte Portal-Kunden (unabhängig vom Suite-JWT)."""
    payload = {
        "sub": account_id,
        "aud": PORTAL_V3_TOKEN_AUD,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _decode_session_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"], audience=PORTAL_V3_TOKEN_AUD)


async def get_current_customer(authorization: str = Header(None)):
    """FastAPI-Dependency für Kunden-Routes im Portal v3."""
    if not authorization:
        raise HTTPException(401, "Token fehlt")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(401, "Ungültiges Authorization-Format")
    try:
        payload = _decode_session_token(parts[1])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sitzung abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Ungültiger Token")
    account_id = payload.get("sub")
    if not account_id:
        raise HTTPException(401, "Token ungültig")
    account = await db.portal3_accounts.find_one(
        {"id": account_id},
        {"_id": 0, "password_hash": 0},
    )
    if not account:
        raise HTTPException(401, "Account nicht gefunden")
    if not account.get("active", True):
        raise HTTPException(403, "Account ist deaktiviert")
    return account
