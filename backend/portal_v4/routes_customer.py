"""
Portal v4 – Kunden-Routes (öffentlich / Portal-Token-auth).
Login per Token-Link ODER Email+Passwort.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone

from database import db, logger
from .auth import (
    verify_password,
    create_session_token,
    get_current_customer,
)

router = APIRouter()


class LoginBody(BaseModel):
    # Entweder token ODER email, beide ergeben account-match
    token: str | None = None
    email: str | None = None
    password: str


class LoginPreflight(BaseModel):
    token: str


@router.post("/login/preflight")
async def login_preflight(body: LoginPreflight):
    """
    Schritt 1 des Token-Flows: UI zeigt Name/Email, Kunde tippt nur Passwort.
    Gibt NIE zurück ob ein Account existiert, nur ob Login möglich ist.
    """
    if not body.token:
        raise HTTPException(400, "Token fehlt")
    account = await db.portal4_accounts.find_one(
        {"token": body.token, "active": True},
        {"_id": 0, "name": 1, "email": 1, "password_hash": 1},
    )
    if not account or not account.get("password_hash"):
        # Generischer Fehler, kein Account-Leak
        raise HTTPException(404, "Ungültiger Einladungslink")
    return {
        "name": account.get("name", ""),
        "email": account.get("email", ""),
    }


@router.post("/login")
async def login(body: LoginBody):
    if not body.password:
        raise HTTPException(400, "Passwort fehlt")

    query = {"active": True}
    if body.token:
        query["token"] = body.token
    elif body.email:
        query["email"] = body.email.strip().lower()
    else:
        raise HTTPException(400, "Token oder E-Mail erforderlich")

    account = await db.portal4_accounts.find_one(query, {"_id": 0})
    if not account or not account.get("password_hash"):
        raise HTTPException(401, "Zugangsdaten ungültig")

    if not verify_password(body.password, account["password_hash"]):
        raise HTTPException(401, "Zugangsdaten ungültig")

    session = create_session_token(account["id"])
    now = datetime.now(timezone.utc).isoformat()
    await db.portal4_accounts.update_one(
        {"id": account["id"]},
        {"$set": {"last_login": now, "updated_at": now}},
    )
    await db.portal4_activity.insert_one({
        "portal_id": account["id"],
        "action": "login",
        "timestamp": now,
    })
    logger.info(f"Portal v4 Login: {account['email']}")
    return {
        "session": session,
        "account": {
            "id": account["id"],
            "name": account.get("name"),
            "email": account.get("email"),
        },
    }


@router.get("/me")
async def me(account=Depends(get_current_customer)):
    return {
        "id": account["id"],
        "name": account.get("name"),
        "email": account.get("email"),
        "last_login": account.get("last_login"),
    }
