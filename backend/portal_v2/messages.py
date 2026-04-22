"""
Portal v2 – Nachrichten (Chat Admin ↔ Kunde)
Admin-Routes + Customer-Routes kombiniert.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4

from database import db, logger
from auth import get_current_user
from .auth import get_current_customer

router = APIRouter()


class MessageCreate(BaseModel):
    text: str


# ============== ADMIN ==============

@router.get("/admin/accounts/{account_id}/messages")
async def admin_list_messages(account_id: str, user=Depends(get_current_user)):
    account = await db.portal2_accounts.find_one({"id": account_id}, {"_id": 0, "id": 1})
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    msgs = await db.portal2_messages.find(
        {"portal_id": account_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(5000)
    # mark customer-messages as read (admin seeing them)
    await db.portal2_messages.update_many(
        {"portal_id": account_id, "sender": "customer", "read_by_admin": {"$ne": True}},
        {"$set": {"read_by_admin": True, "read_by_admin_at": datetime.now(timezone.utc).isoformat()}},
    )
    return msgs


@router.post("/admin/accounts/{account_id}/messages")
async def admin_send_message(account_id: str, body: MessageCreate, user=Depends(get_current_user)):
    account = await db.portal2_accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Nachricht darf nicht leer sein")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid4()),
        "portal_id": account_id,
        "sender": "admin",
        "sender_name": (user or {}).get("username") or "Service",
        "text": text,
        "read_by_admin": True,
        "read_by_customer": False,
        "created_at": now,
    }
    await db.portal2_messages.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"Portal v2 Admin-Nachricht an {account.get('email')}")
    return doc


@router.get("/admin/unread-summary")
async def admin_unread_summary(user=Depends(get_current_user)):
    """Wie viele ungelesene Kunden-Nachrichten gesamt."""
    total = await db.portal2_messages.count_documents({
        "sender": "customer",
        "read_by_admin": {"$ne": True},
    })
    return {"unread": total}


# ============== CUSTOMER ==============

@router.get("/messages")
async def customer_list_messages(account=Depends(get_current_customer)):
    msgs = await db.portal2_messages.find(
        {"portal_id": account["id"]},
        {"_id": 0},
    ).sort("created_at", 1).to_list(5000)
    # mark admin-messages as read
    await db.portal2_messages.update_many(
        {"portal_id": account["id"], "sender": "admin", "read_by_customer": {"$ne": True}},
        {"$set": {"read_by_customer": True, "read_by_customer_at": datetime.now(timezone.utc).isoformat()}},
    )
    return msgs


@router.post("/messages")
async def customer_send_message(body: MessageCreate, account=Depends(get_current_customer)):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Nachricht darf nicht leer sein")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid4()),
        "portal_id": account["id"],
        "sender": "customer",
        "sender_name": account.get("name") or account.get("email"),
        "text": text,
        "read_by_admin": False,
        "read_by_customer": True,
        "created_at": now,
    }
    await db.portal2_messages.insert_one(doc)
    doc.pop("_id", None)
    await db.portal2_activity.insert_one({
        "portal_id": account["id"],
        "action": "message_sent",
        "timestamp": now,
    })
    logger.info(f"Portal v2 Kunden-Nachricht von {account.get('email')}")
    return doc
