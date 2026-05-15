"""
Portal v3 – Admin-Routes
Alle Endpoints unter /api/portal-v3/admin/*
Zugriff: nur mit JWT-Auth der Suite.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone

from database import db, logger
from auth import get_current_user
from utils import send_email
from utils.email_signatur import wrap_email_body
from .models import (
    PortalAccount,
    PortalAccountCreate,
    PortalAccountUpdate,
    PortalV2Settings,
    PortalV2SettingsUpdate,
)
from .auth import generate_password, hash_password, generate_login_token
from .mail_builder import build_invite_email

import os

router = APIRouter(prefix="/admin")

SETTINGS_ID = "portal3_settings_default"


# ============== SETTINGS ==============

async def _get_settings_doc() -> dict:
    doc = await db.portal3_settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if not doc:
        defaults = PortalV2Settings().model_dump()
        defaults["id"] = SETTINGS_ID
        await db.portal3_settings.insert_one(defaults)
        defaults.pop("_id", None)
        return defaults
    return doc


@router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    doc = await _get_settings_doc()
    doc.pop("id", None)
    return doc


@router.put("/settings")
async def update_settings(update: PortalV2SettingsUpdate, user=Depends(get_current_user)):
    current = await _get_settings_doc()
    changes = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
    if not changes:
        current.pop("id", None)
        return current
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.portal3_settings.update_one({"id": SETTINGS_ID}, {"$set": changes})
    new_doc = await db.portal3_settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    new_doc.pop("id", None)
    logger.info(f"Portal v3 Settings aktualisiert: {list(changes.keys())}")
    return new_doc


# ============== ACCOUNTS CRUD ==============

@router.get("/accounts")
async def list_accounts(user=Depends(get_current_user)):
    """Liste aller Portal-Accounts (ohne Passwort-Hash/Token)."""
    accounts = await db.portal3_accounts.find(
        {},
        {"_id": 0, "password_hash": 0, "token": 0},
    ).sort("created_at", -1).to_list(1000)
    return accounts


@router.post("/accounts")
async def create_account(payload: PortalAccountCreate, user=Depends(get_current_user)):
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(400, "E-Mail erforderlich")

    existing = await db.portal3_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(409, "Account mit dieser E-Mail existiert bereits")

    account = PortalAccount(
        name=payload.name.strip(),
        email=email,
        customer_id=payload.customer_id,
        notes=payload.notes or "",
    ).model_dump()
    await db.portal3_accounts.insert_one(account)
    account.pop("_id", None)
    account.pop("password_hash", None)
    account.pop("token", None)
    logger.info(f"Portal v3 Account angelegt: {account['name']} ({account['email']})")
    return account


@router.get("/accounts/{account_id}")
async def get_account(account_id: str, user=Depends(get_current_user)):
    account = await db.portal3_accounts.find_one(
        {"id": account_id},
        {"_id": 0, "password_hash": 0, "token": 0},
    )
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    return account


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, update: PortalAccountUpdate, user=Depends(get_current_user)):
    existing = await db.portal3_accounts.find_one({"id": account_id})
    if not existing:
        raise HTTPException(404, "Account nicht gefunden")

    changes = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
    if "email" in changes:
        changes["email"] = changes["email"].strip().lower()
        if changes["email"] != existing.get("email"):
            dup = await db.portal3_accounts.find_one({"email": changes["email"], "id": {"$ne": account_id}})
            if dup:
                raise HTTPException(409, "E-Mail wird bereits von anderem Account verwendet")
    if not changes:
        existing.pop("_id", None)
        existing.pop("password_hash", None)
        existing.pop("token", None)
        return existing
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.portal3_accounts.update_one({"id": account_id}, {"$set": changes})
    updated = await db.portal3_accounts.find_one(
        {"id": account_id},
        {"_id": 0, "password_hash": 0, "token": 0},
    )
    return updated


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user=Depends(get_current_user)):
    result = await db.portal3_accounts.delete_one({"id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Account nicht gefunden")
    logger.info(f"Portal v3 Account geloescht: {account_id}")
    return {"deleted": True, "id": account_id}


# ============== INVITE / PASSWORD RESET ==============

async def _prepare_invite(account_id: str, request: Request | None = None) -> tuple[dict, str, str]:
    """Generiert neues Passwort + Token, speichert Hash, liefert Klartext + URL."""
    account = await db.portal3_accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    if not account.get("email"):
        raise HTTPException(400, "Account hat keine E-Mail")

    password_plain = generate_password()
    password_hash = hash_password(password_plain)
    token = generate_login_token()

    now = datetime.now(timezone.utc).isoformat()
    await db.portal3_accounts.update_one(
        {"id": account_id},
        {"$set": {
            "password_hash": password_hash,
            "token": token,
            "invite_sent_at": now,
            "updated_at": now,
        }},
    )

    # Login-URL: Priorität: Settings → ENV → Origin-Header
    settings_doc = await _get_settings_doc()
    frontend_base = (settings_doc.get("public_base_url") or "").strip()
    if not frontend_base:
        frontend_base = os.environ.get("FRONTEND_PUBLIC_URL", "").strip()
    if not frontend_base and request is not None:
        origin = request.headers.get("origin") or request.headers.get("referer") or ""
        if origin:
            # Nimm nur scheme+host, kein Pfad
            from urllib.parse import urlparse
            p = urlparse(origin)
            if p.scheme and p.netloc:
                frontend_base = f"{p.scheme}://{p.netloc}"
    login_url = f"{frontend_base.rstrip('/')}/portal-v3/login/{token}"

    return account, password_plain, login_url


@router.post("/accounts/{account_id}/invite")
async def send_invite(account_id: str, request: Request, user=Depends(get_current_user)):
    """Generiert Passwort + Token und sendet Einladungs-Mail."""
    settings_doc = await _get_settings_doc()
    account, password_plain, login_url = await _prepare_invite(account_id, request)

    subject, html = await build_invite_email(
        customer_name=account.get("name", ""),
        customer_email=account["email"],
        login_url=login_url,
        password_plain=password_plain,
        settings_doc=settings_doc,
    )

    try:
        wrapped = wrap_email_body(html)
    except Exception:
        wrapped = html

    ok = send_email(
        to_email=account["email"],
        subject=subject,
        body_html=wrapped,
    )

    await db.portal3_activity.insert_one({
        "portal_id": account_id,
        "action": "invite_sent" if ok else "invite_failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    logger.info(f"Portal v3 Einladung {'gesendet' if ok else 'fehlgeschlagen'}: {account['email']}")
    return {
        "sent": bool(ok),
        "email": account["email"],
        "login_url": login_url,
    }


@router.post("/accounts/{account_id}/reset-password")
async def reset_password(account_id: str, request: Request, user=Depends(get_current_user)):
    """Neu-Generierung + erneute Einladungs-Mail."""
    return await send_invite(account_id, request, user)
