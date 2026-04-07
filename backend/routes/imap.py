from fastapi import APIRouter, HTTPException, Depends
from database import db, logger
from auth import get_current_user
from datetime import datetime, timezone
import uuid
import imaplib
import email
from email.header import decode_header
import re
import os
import base64

router = APIRouter()


def decode_mime_header(header_value):
    if not header_value:
        return ""
    parts = decode_header(header_value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return " ".join(decoded)


def extract_email_address(from_header):
    match = re.search(r'<(.+?)>', from_header)
    if match:
        return match.group(1).lower()
    match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', from_header)
    if match:
        return match.group(0).lower()
    return from_header.lower()


def extract_name(from_header):
    match = re.match(r'^"?([^"<]+)"?\s*<', from_header)
    if match:
        return match.group(1).strip()
    return from_header.split("@")[0] if "@" in from_header else from_header


def get_email_body(msg):
    body = ""
    html_body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")
            elif ct == "text/html" and "attachment" not in cd:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                html_body = payload.decode(charset, errors="replace")
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            ct = msg.get_content_type()
            if ct == "text/html":
                html_body = payload.decode(charset, errors="replace")
            else:
                body = payload.decode(charset, errors="replace")
    # Prefer plain text, fall back to cleaned HTML
    if body.strip():
        return body.strip()
    if html_body:
        clean = re.sub(r'<br\s*/?>', '\n', html_body)
        clean = re.sub(r'<[^>]+>', ' ', clean)
        clean = re.sub(r'&nbsp;', ' ', clean)
        clean = re.sub(r'\s+', ' ', clean).strip()
        return clean
    return ""


def get_attachments(msg):
    attachments = []
    if not msg.is_multipart():
        return attachments
    for part in msg.walk():
        cd = str(part.get("Content-Disposition", ""))
        if "attachment" in cd or "inline" in cd:
            filename = part.get_filename()
            if filename:
                filename = decode_mime_header(filename)
                payload = part.get_payload(decode=True)
                if payload:
                    attachments.append({
                        "filename": filename,
                        "content_type": part.get_content_type(),
                        "size": len(payload),
                        "data_b64": base64.b64encode(payload).decode("ascii"),
                    })
    return attachments


def _get_imap_creds():
    """Get IMAP credentials from env"""
    return {
        "server": os.environ.get("IMAP_SERVER", ""),
        "port": int(os.environ.get("IMAP_PORT", 993)),
        "user": os.environ.get("IMAP_USER", ""),
        "password": os.environ.get("IMAP_PASSWORD", ""),
    }


# ── IMAP settings endpoints ──

@router.get("/imap/settings")
async def get_imap_settings(user=Depends(get_current_user)):
    creds = _get_imap_creds()
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    return {
        "imap_server": creds["server"],
        "imap_port": creds["port"],
        "imap_user": creds["user"],
        "imap_enabled": settings.get("imap_enabled", False),
        "imap_folder": settings.get("imap_folder", "INBOX"),
    }


@router.post("/imap/test")
async def test_imap(user=Depends(get_current_user)):
    creds = _get_imap_creds()
    if not creds["server"] or not creds["user"] or not creds["password"]:
        raise HTTPException(400, "IMAP-Daten unvollständig in .env")
    try:
        mail = imaplib.IMAP4_SSL(creds["server"], creds["port"])
        mail.login(creds["user"], creds["password"])
        status, folders = mail.list()
        mail.logout()
        folder_list = []
        if status == "OK":
            for f in folders:
                decoded = f.decode() if isinstance(f, bytes) else str(f)
                match = re.search(r'"([^"]+)"$|(\S+)$', decoded)
                if match:
                    folder_list.append(match.group(1) or match.group(2))
        return {"success": True, "message": f"IMAP-Verbindung zu {creds['server']} erfolgreich", "folders": folder_list}
    except Exception as e:
        raise HTTPException(400, f"IMAP-Fehler: {str(e)}")


# ── Fetch emails to inbox ──

@router.post("/imap/fetch")
async def fetch_imap_emails(user=Depends(get_current_user)):
    creds = _get_imap_creds()
    if not creds["server"] or not creds["user"] or not creds["password"]:
        raise HTTPException(400, "IMAP-Einstellungen unvollständig.")
    try:
        count = await fetch_imap_to_inbox(creds)
        return {"fetched": count, "message": f"{count} neue E-Mail{'s' if count != 1 else ''} abgerufen"}
    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP error: {e}")
        raise HTTPException(500, f"IMAP-Fehler: {str(e)}")
    except Exception as e:
        logger.error(f"IMAP fetch error: {e}")
        raise HTTPException(500, f"Fehler beim E-Mail-Abruf: {str(e)}")


async def fetch_imap_to_inbox(creds: dict) -> int:
    """Fetch IMAP emails into email_inbox collection"""
    mail = imaplib.IMAP4_SSL(creds["server"], creds["port"])
    mail.login(creds["user"], creds["password"])

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    folder = settings.get("imap_folder", "INBOX")
    mail.select(folder, readonly=False)

    status, data = mail.search(None, "UNSEEN")
    if status != "OK":
        mail.logout()
        return 0

    email_ids = data[0].split()
    fetched = 0

    # Pre-load known emails from customers and anfragen
    known_emails = set()
    async for c in db.customers.find({}, {"email": 1, "_id": 0}):
        if c.get("email"):
            known_emails.add(c["email"].lower())
    async for a in db.anfragen.find({}, {"email": 1, "_id": 0}):
        if a.get("email"):
            known_emails.add(a["email"].lower())

    for eid in email_ids[-50:]:
        status, msg_data = mail.fetch(eid, "(RFC822)")
        if status != "OK":
            continue

        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)

        from_header = decode_mime_header(msg.get("From", ""))
        subject = decode_mime_header(msg.get("Subject", ""))
        date_header = msg.get("Date", "")
        sender_email = extract_email_address(from_header)
        sender_name = extract_name(from_header)
        body = get_email_body(msg)
        message_id = msg.get("Message-ID", "")

        # Skip duplicates
        if message_id:
            existing = await db.email_inbox.find_one({"message_id": message_id})
            if existing:
                continue

        # Extract attachments metadata (store data separately)
        raw_attachments = get_attachments(msg)
        attachment_meta = []
        for att in raw_attachments:
            att_id = str(uuid.uuid4())
            # Store attachment data in separate collection
            await db.email_attachments.insert_one({
                "id": att_id,
                "filename": att["filename"],
                "content_type": att["content_type"],
                "size": att["size"],
                "data_b64": att["data_b64"],
            })
            attachment_meta.append({
                "id": att_id,
                "filename": att["filename"],
                "content_type": att["content_type"],
                "size": att["size"],
            })

        # Classify
        is_known = sender_email in known_emails
        classification = "bekannt" if is_known else "neu"

        inbox_entry = {
            "id": str(uuid.uuid4()),
            "message_id": message_id,
            "from_name": sender_name,
            "from_email": sender_email,
            "subject": subject,
            "body": body[:5000],
            "date": date_header,
            "attachments": attachment_meta,
            "classification": classification,
            "status": "ungelesen",
            "assigned_to": None,
            "assigned_type": None,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.email_inbox.insert_one(inbox_entry)
        inbox_entry.pop("_id", None)
        fetched += 1
        mail.store(eid, "+FLAGS", "\\Seen")

    mail.logout()
    return fetched


# Also expose for background polling
async def fetch_imap_emails_internal(settings: dict) -> int:
    creds = _get_imap_creds()
    if not creds["server"] or not creds["user"] or not creds["password"]:
        return 0
    return await fetch_imap_to_inbox(creds)


# ── Inbox endpoints ──

@router.get("/imap/inbox")
async def get_inbox(user=Depends(get_current_user)):
    emails = []
    async for doc in db.email_inbox.find({"status": {"$ne": "archiviert"}}, {"_id": 0}).sort("fetched_at", -1):
        doc.pop("_id", None)
        emails.append(doc)
    return emails


@router.get("/imap/inbox/stats")
async def get_inbox_stats(user=Depends(get_current_user)):
    total = await db.email_inbox.count_documents({"status": {"$ne": "archiviert"}})
    unread = await db.email_inbox.count_documents({"status": "ungelesen"})
    bekannt = await db.email_inbox.count_documents({"classification": "bekannt", "status": {"$ne": "archiviert"}})
    return {"total": total, "unread": unread, "bekannt": bekannt}


@router.put("/imap/inbox/{email_id}/read")
async def mark_read(email_id: str, user=Depends(get_current_user)):
    result = await db.email_inbox.update_one({"id": email_id}, {"$set": {"status": "gelesen"}})
    if result.matched_count == 0:
        raise HTTPException(404, "E-Mail nicht gefunden")
    return {"ok": True}


@router.post("/imap/inbox/{email_id}/create-anfrage")
async def create_anfrage_from_email(email_id: str, user=Depends(get_current_user)):
    """Create a new Anfrage from an inbox email"""
    mail_doc = await db.email_inbox.find_one({"id": email_id}, {"_id": 0})
    if not mail_doc:
        raise HTTPException(404, "E-Mail nicht gefunden")

    anfrage = {
        "id": str(uuid.uuid4()),
        "name": mail_doc["from_name"],
        "email": mail_doc["from_email"],
        "phone": "",
        "address": "",
        "notes": f"Betreff: {mail_doc['subject']}",
        "photos": [],
        "categories": [],
        "reparaturgruppen": [],
        "customer_type": "Privat",
        "firma": "",
        "anrede": "",
        "source": "e-mail",
        "obj_address": "",
        "nachricht": mail_doc["body"][:2000],
        "email_message_id": mail_doc.get("message_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.anfragen.insert_one(anfrage)
    anfrage.pop("_id", None)

    # Mark email as assigned
    await db.email_inbox.update_one(
        {"id": email_id},
        {"$set": {"status": "zugeordnet", "assigned_to": anfrage["id"], "assigned_type": "anfrage"}}
    )
    return {"ok": True, "anfrage_id": anfrage["id"], "message": "Anfrage erstellt"}


@router.post("/imap/inbox/{email_id}/assign-customer")
async def assign_to_customer(email_id: str, body: dict, user=Depends(get_current_user)):
    """Assign email to existing customer"""
    customer_id = body.get("customer_id")
    if not customer_id:
        raise HTTPException(400, "customer_id erforderlich")

    mail_doc = await db.email_inbox.find_one({"id": email_id}, {"_id": 0})
    if not mail_doc:
        raise HTTPException(404, "E-Mail nicht gefunden")

    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(404, "Kunde nicht gefunden")

    # Add note to customer
    note = f"[E-Mail {mail_doc['date']}] {mail_doc['subject']}: {mail_doc['body'][:500]}"
    await db.customers.update_one(
        {"id": customer_id},
        {"$push": {"email_history": {
            "id": str(uuid.uuid4()),
            "email_id": email_id,
            "subject": mail_doc["subject"],
            "body": mail_doc["body"][:2000],
            "from": mail_doc["from_email"],
            "date": mail_doc["date"],
            "added_at": datetime.now(timezone.utc).isoformat(),
        }}}
    )

    await db.email_inbox.update_one(
        {"id": email_id},
        {"$set": {"status": "zugeordnet", "assigned_to": customer_id, "assigned_type": "kunde"}}
    )
    return {"ok": True, "message": f"E-Mail dem Kunden {customer.get('name', '')} zugeordnet"}


@router.delete("/imap/inbox/{email_id}")
async def archive_email(email_id: str, user=Depends(get_current_user)):
    result = await db.email_inbox.update_one({"id": email_id}, {"$set": {"status": "archiviert"}})
    if result.matched_count == 0:
        raise HTTPException(404, "E-Mail nicht gefunden")
    return {"ok": True}


@router.get("/imap/attachment/{att_id}")
async def get_attachment(att_id: str, user=Depends(get_current_user)):
    att = await db.email_attachments.find_one({"id": att_id}, {"_id": 0})
    if not att:
        raise HTTPException(404, "Anhang nicht gefunden")
    return {
        "id": att["id"],
        "filename": att["filename"],
        "content_type": att["content_type"],
        "size": att["size"],
        "data_b64": att["data_b64"],
    }
