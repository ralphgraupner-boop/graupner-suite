"""
Portal v4 – Nachrichten (Chat Admin ↔ Kunde)
Admin-Routes + Customer-Routes kombiniert.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4

from database import db, logger
from auth import get_current_user
from utils import send_email, get_portal_bcc
from .auth import get_current_customer

router = APIRouter()


async def _notify_admin_inbox(account: dict, sender: str, sender_name: str, text: str):
    """Schickt eine Kontroll-Kopie an die in den Einstellungen hinterlegte Admin-BCC-Adresse.
    Fehler werden geloggt aber nicht weitergereicht (Chat darf nicht blockieren)."""
    try:
        bcc = await get_portal_bcc()
        if not bcc:
            return
        kunde_email = account.get("email") or "?"
        kunde_name = account.get("name") or kunde_email
        if sender == "admin":
            subject = f"[Portal-Kopie] An {kunde_name}: {text[:60]}"
            richtung = f"<b>Admin → Kunde</b> ({sender_name})"
        else:
            subject = f"[Portal-Kopie] Von {kunde_name}: {text[:60]}"
            richtung = f"<b>Kunde → Admin</b> ({sender_name})"
        body = f"""
            <p>Diese Nachricht wurde im <b>Kundenportal</b> ausgetauscht (nur zur Kontrolle / Analyse).</p>
            <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Richtung:</td><td>{richtung}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Kunde:</td><td>{kunde_name} ({kunde_email})</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Zeit:</td><td>{datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M UTC')}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666;">Portal-ID:</td><td><code>{account.get('id','')}</code></td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
            <div style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.5;">{text}</div>
            <p style="color:#999;font-size:11px;margin-top:24px;">Automatische Kontroll-Kopie – Antworten auf diese Mail kommen NICHT beim Kunden an.
            Der Kunde sieht und antwortet ausschließlich über das Portal.</p>
        """
        # Synchron OK, send_email ist sync — direkt an BCC schicken (nicht "to+bcc", sondern nur "to=bcc")
        send_email(to_email=bcc, subject=subject, body_html=body)
        logger.info(f"Portal v4 Kontroll-Kopie an {bcc} (Richtung: {sender}, Kunde: {kunde_email})")
    except Exception as e:
        logger.warning(f"Portal v4 Kontroll-Kopie fehlgeschlagen (Chat-Funktion läuft trotzdem): {e}")


class MessageCreate(BaseModel):
    text: str


# ============== ADMIN ==============

@router.get("/admin/accounts/{account_id}/messages")
async def admin_list_messages(account_id: str, user=Depends(get_current_user)):
    account = await db.portal4_accounts.find_one({"id": account_id}, {"_id": 0, "id": 1})
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    msgs = await db.portal4_messages.find(
        {"portal_id": account_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(5000)
    # mark customer-messages as read (admin seeing them)
    await db.portal4_messages.update_many(
        {"portal_id": account_id, "sender": "customer", "read_by_admin": {"$ne": True}},
        {"$set": {"read_by_admin": True, "read_by_admin_at": datetime.now(timezone.utc).isoformat()}},
    )
    return msgs


@router.post("/admin/accounts/{account_id}/messages")
async def admin_send_message(account_id: str, body: MessageCreate, user=Depends(get_current_user)):
    account = await db.portal4_accounts.find_one({"id": account_id}, {"_id": 0})
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
    await db.portal4_messages.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"Portal v4 Admin-Nachricht an {account.get('email')}")
    await _notify_admin_inbox(account, "admin", doc["sender_name"], text)
    return doc


@router.get("/admin/unread-summary")
async def admin_unread_summary(user=Depends(get_current_user)):
    """Wie viele ungelesene Kunden-Nachrichten gesamt."""
    total = await db.portal4_messages.count_documents({
        "sender": "customer",
        "read_by_admin": {"$ne": True},
    })
    return {"unread": total}


# ============== CUSTOMER ==============

@router.get("/messages")
async def customer_list_messages(account=Depends(get_current_customer)):
    msgs = await db.portal4_messages.find(
        {"portal_id": account["id"]},
        {"_id": 0},
    ).sort("created_at", 1).to_list(5000)
    # mark admin-messages as read
    await db.portal4_messages.update_many(
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
    await db.portal4_messages.insert_one(doc)
    doc.pop("_id", None)
    await db.portal4_activity.insert_one({
        "portal_id": account["id"],
        "action": "message_sent",
        "timestamp": now,
    })
    logger.info(f"Portal v4 Kunden-Nachricht von {account.get('email')}")
    await _notify_admin_inbox(account, "customer", doc["sender_name"], text)
    return doc
