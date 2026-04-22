"""
Portal v2 – Admin-Routes
Alle Endpoints unter /api/portal-v2/admin/*
Zugriff: nur mit JWT-Auth der Suite.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from database import db, logger
from auth import get_current_user
from .models import (
    PortalAccount,
    PortalAccountCreate,
    PortalAccountUpdate,
    PortalV2Settings,
    PortalV2SettingsUpdate,
)

router = APIRouter(prefix="/admin")

SETTINGS_ID = "portal2_settings_default"


# ============== SETTINGS ==============

async def _get_settings_doc() -> dict:
    doc = await db.portal2_settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if not doc:
        defaults = PortalV2Settings().model_dump()
        defaults["id"] = SETTINGS_ID
        await db.portal2_settings.insert_one(defaults)
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
    await db.portal2_settings.update_one({"id": SETTINGS_ID}, {"$set": changes})
    new_doc = await db.portal2_settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    new_doc.pop("id", None)
    logger.info(f"Portal v2 Settings aktualisiert: {list(changes.keys())}")
    return new_doc


# ============== ACCOUNTS CRUD ==============

@router.get("/accounts")
async def list_accounts(user=Depends(get_current_user)):
    """Liste aller Portal-Accounts (ohne Passwort-Hash/Token)."""
    accounts = await db.portal2_accounts.find(
        {},
        {"_id": 0, "password_hash": 0, "token": 0},
    ).sort("created_at", -1).to_list(1000)
    return accounts


@router.post("/accounts")
async def create_account(payload: PortalAccountCreate, user=Depends(get_current_user)):
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(400, "E-Mail erforderlich")

    existing = await db.portal2_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(409, "Account mit dieser E-Mail existiert bereits")

    account = PortalAccount(
        name=payload.name.strip(),
        email=email,
        customer_id=payload.customer_id,
        notes=payload.notes or "",
    ).model_dump()
    await db.portal2_accounts.insert_one(account)
    account.pop("_id", None)
    account.pop("password_hash", None)
    account.pop("token", None)
    logger.info(f"Portal v2 Account angelegt: {account['name']} ({account['email']})")
    return account


@router.get("/accounts/{account_id}")
async def get_account(account_id: str, user=Depends(get_current_user)):
    account = await db.portal2_accounts.find_one(
        {"id": account_id},
        {"_id": 0, "password_hash": 0, "token": 0},
    )
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    return account


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, update: PortalAccountUpdate, user=Depends(get_current_user)):
    existing = await db.portal2_accounts.find_one({"id": account_id})
    if not existing:
        raise HTTPException(404, "Account nicht gefunden")

    changes = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
    if "email" in changes:
        changes["email"] = changes["email"].strip().lower()
        if changes["email"] != existing.get("email"):
            dup = await db.portal2_accounts.find_one({"email": changes["email"], "id": {"$ne": account_id}})
            if dup:
                raise HTTPException(409, "E-Mail wird bereits von anderem Account verwendet")
    if not changes:
        existing.pop("_id", None)
        existing.pop("password_hash", None)
        existing.pop("token", None)
        return existing
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.portal2_accounts.update_one({"id": account_id}, {"$set": changes})
    updated = await db.portal2_accounts.find_one(
        {"id": account_id},
        {"_id": 0, "password_hash": 0, "token": 0},
    )
    return updated


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user=Depends(get_current_user)):
    result = await db.portal2_accounts.delete_one({"id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Account nicht gefunden")
    logger.info(f"Portal v2 Account geloescht: {account_id}")
    return {"deleted": True, "id": account_id}
