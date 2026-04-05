from fastapi import APIRouter, HTTPException, Depends
from database import db, logger
from auth import get_current_user
from datetime import datetime, timezone
import uuid
import imaplib
import email
from email.header import decode_header
import re


router = APIRouter()


def decode_mime_header(header_value):
    """Decode MIME encoded header"""
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
    """Extract email address from From header"""
    match = re.search(r'<(.+?)>', from_header)
    if match:
        return match.group(1)
    match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', from_header)
    if match:
        return match.group(0)
    return from_header


def extract_name(from_header):
    """Extract name from From header"""
    match = re.match(r'^"?([^"<]+)"?\s*<', from_header)
    if match:
        return match.group(1).strip()
    return from_header.split("@")[0] if "@" in from_header else from_header


def get_email_body(msg):
    """Extract text body from email message"""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")
                break
            elif ct == "text/html" and not body and "attachment" not in cd:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                raw = payload.decode(charset, errors="replace")
                body = re.sub(r'<[^>]+>', ' ', raw)
                body = re.sub(r'\s+', ' ', body).strip()
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            body = payload.decode(charset, errors="replace")
    return body.strip()


@router.get("/imap/settings")
async def get_imap_settings(user=Depends(get_current_user)):
    """Get IMAP settings"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    return {
        "imap_server": settings.get("imap_server", ""),
        "imap_port": settings.get("imap_port", 993),
        "imap_user": settings.get("imap_user", ""),
        "imap_password": settings.get("imap_password", ""),
        "imap_folder": settings.get("imap_folder", "INBOX"),
        "imap_enabled": settings.get("imap_enabled", False),
    }


@router.post("/imap/fetch")
async def fetch_imap_emails(user=Depends(get_current_user)):
    """Fetch new emails via IMAP and create Anfragen"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}

    server = settings.get("imap_server", "")
    port = settings.get("imap_port", 993)
    imap_user = settings.get("imap_user", "")
    password = settings.get("imap_password", "")
    folder = settings.get("imap_folder", "INBOX")

    if not server or not imap_user or not password:
        raise HTTPException(400, "IMAP-Einstellungen unvollständig. Bitte unter Einstellungen konfigurieren.")

    try:
        mail = imaplib.IMAP4_SSL(server, port)
        mail.login(imap_user, password)
        mail.select(folder, readonly=False)

        # Search for unseen emails
        status, data = mail.search(None, "UNSEEN")
        if status != "OK":
            mail.logout()
            return {"fetched": 0, "message": "Keine neuen E-Mails"}

        email_ids = data[0].split()
        created = 0

        for eid in email_ids[-50:]:  # Max 50 at a time
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

            # Check if already imported (by message-id)
            message_id = msg.get("Message-ID", "")
            if message_id:
                existing = await db.anfragen.find_one({"email_message_id": message_id})
                if existing:
                    continue

            # Create Anfrage
            anfrage = {
                "id": str(uuid.uuid4()),
                "name": sender_name,
                "email": sender_email,
                "phone": "",
                "address": "",
                "notes": f"Betreff: {subject}",
                "photos": [],
                "categories": [],
                "reparaturgruppe": "",
                "customer_type": "Privat",
                "firma": "",
                "anrede": "",
                "source": "e-mail",
                "obj_address": "",
                "nachricht": body[:2000] if body else subject,
                "email_message_id": message_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.anfragen.insert_one(anfrage)
            anfrage.pop("_id", None)
            created += 1

            # Mark as seen
            mail.store(eid, "+FLAGS", "\\Seen")

        mail.logout()

        # Push notification if new emails
        if created > 0:
            try:
                from routes.push import send_push_to_all
                await send_push_to_all(
                    title=f"{created} neue E-Mail-Anfrage{'n' if created > 1 else ''}",
                    body=f"{created} E-Mail{'s' if created > 1 else ''} als Anfragen importiert",
                    url="/anfragen"
                )
            except Exception as e:
                logger.warning(f"Push after IMAP failed: {e}")

        return {"fetched": created, "message": f"{created} neue Anfrage{'n' if created != 1 else ''} importiert"}

    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP error: {e}")
        raise HTTPException(500, f"IMAP-Fehler: {str(e)}")
    except Exception as e:
        logger.error(f"IMAP fetch error: {e}")
        raise HTTPException(500, f"Fehler beim E-Mail-Abruf: {str(e)}")


@router.post("/imap/test")
async def test_imap(body: dict, user=Depends(get_current_user)):
    """Test IMAP connection"""
    server = body.get("imap_server", "")
    port = body.get("imap_port", 993)
    imap_user = body.get("imap_user", "")
    password = body.get("imap_password", "")

    if not server or not imap_user or not password:
        raise HTTPException(400, "IMAP-Daten unvollständig")

    try:
        mail = imaplib.IMAP4_SSL(server, port)
        mail.login(imap_user, password)
        status, folders = mail.list()
        mail.logout()
        folder_list = []
        if status == "OK":
            for f in folders:
                decoded = f.decode() if isinstance(f, bytes) else str(f)
                match = re.search(r'"([^"]+)"$|(\S+)$', decoded)
                if match:
                    folder_list.append(match.group(1) or match.group(2))
        return {"success": True, "message": f"IMAP-Verbindung erfolgreich zu {server}", "folders": folder_list}
    except Exception as e:
        raise HTTPException(400, f"IMAP-Fehler: {str(e)}")
