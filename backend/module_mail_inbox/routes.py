"""
Routes für module_mail_inbox.

POST /api/module-mail-inbox/scan?weeks=6&max=30
   → IMAP scan, schreibt neue Vorschläge in module_mail_inbox
GET  /list?status=vorschlag
POST /accept/{id}    → legt Kunde in module_kunden an
POST /reject/{id}    → markiert ignoriert
GET  /audit          → komplette Liste
"""
import os
import re
import uuid
import imaplib
import email
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from database import db, logger
from routes.auth import get_current_user
from routes.anfragen_fetcher import _extract_body
from .parser import parse_anfrage
from .spam_filter import evaluate_spam

router = APIRouter()

# Strenger Filter: nur Kontaktformular-Mails
JIMDO_FROM_PATTERN = re.compile(r"no-reply@jimdo\.com", re.IGNORECASE)
SUBJECT_DOMAIN = "tischlerei-graupner.de"
ALT_SUBJECT_PATTERN = re.compile(r"Anfrage\s+von\s+", re.IGNORECASE)

# Postfächer in denen wir suchen (Inbox UND der Filter-Ordner für Anfragen)
SEARCH_FOLDERS = ["INBOX", '"INBOX.anfrage von"']


def _decode(s: str | None) -> str:
    if not s:
        return ""
    try:
        parts = decode_header(s)
        out = []
        for content, charset in parts:
            if isinstance(content, bytes):
                out.append(content.decode(charset or "utf-8", errors="replace"))
            else:
                out.append(content)
        return "".join(out)
    except Exception:
        return s


@router.post("/scan")
async def scan(weeks: int = 6, max_count: int = 30, user=Depends(get_current_user)):
    server = os.environ.get("IMAP_SERVER")
    port = int(os.environ.get("IMAP_PORT", "993"))
    username = os.environ.get("IMAP_USER")
    password = os.environ.get("IMAP_PASSWORD")
    if not (server and username and password):
        raise HTTPException(500, "IMAP nicht konfiguriert")

    weeks = max(1, min(weeks, 26))
    max_count = max(1, min(max_count, 100))
    since_dt = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    since_str = since_dt.strftime("%d-%b-%Y")

    found, skipped, dup = 0, 0, 0

    try:
        imap = imaplib.IMAP4_SSL(server, port)
        imap.login(username, password)
        for folder in SEARCH_FOLDERS:
            try:
                typ, _ = imap.select(folder, readonly=True)
                if typ != "OK":
                    continue
            except Exception as fe:  # noqa: BLE001
                logger.warning(f"mail-inbox: Ordner {folder} nicht selektierbar: {fe}")
                continue

            # Suche: Mails mit "Anfrage" im Subject oder von Jimdo, seit X Wochen
            try:
                typ, data = imap.search(
                    None,
                    f'(SINCE "{since_str}")',
                    '(OR (FROM "no-reply@jimdo.com") (SUBJECT "Anfrage von"))',
                )
            except imaplib.IMAP4.error:
                continue
            if typ != "OK" or not data or not data[0]:
                continue

            uids = data[0].split()
            uids = uids[-max_count:]
            uids.reverse()
            remaining = max_count - found
            uids = uids[:remaining]

            for uid in uids:
                if found >= max_count:
                    break
                try:
                    typ, raw = imap.fetch(uid, "(RFC822)")
                    if typ != "OK" or not raw or not raw[0]:
                        continue
                    msg = email.message_from_bytes(raw[0][1])

                    from_name, from_email = parseaddr(msg.get("From", ""))
                    subject = _decode(msg.get("Subject", ""))

                    # Erkennung: Jimdo-Format ODER altes "Anfrage von"-Subject
                    is_jimdo = bool(JIMDO_FROM_PATTERN.search(from_email or ""))
                    is_alt = bool(ALT_SUBJECT_PATTERN.search(subject or ""))
                    if not (is_jimdo or is_alt):
                        skipped += 1
                        continue
                    # Wenn Jimdo, muss tischlerei-graupner.de im Subject sein
                    if is_jimdo and SUBJECT_DOMAIN not in subject.lower():
                        skipped += 1
                        continue

                    message_id = (msg.get("Message-ID") or "").strip()

                    exists = await db.module_mail_inbox.find_one(
                        {"message_id": message_id} if message_id else {"email_uid": f"{folder}/{uid.decode()}"},
                        {"_id": 0, "id": 1},
                    )
                    if exists:
                        dup += 1
                        continue

                    body = _extract_body(msg)
                    parsed = parse_anfrage(body, subject=subject, from_email=from_email)

                    reply_to = ""
                    rt_raw = msg.get("Reply-To") or ""
                    if rt_raw:
                        _, reply_to = parseaddr(rt_raw)

                    if not parsed.get("email") and reply_to and "@" in reply_to:
                        parsed["email"] = reply_to
                    if not parsed.get("email") and from_email and "@" in from_email and "jimdo.com" not in from_email.lower():
                        parsed["email"] = from_email

                    # Spam-Bewertung
                    spam = evaluate_spam(parsed, body_excerpt=body, from_email=from_email)
                    initial_status = "spam_verdacht" if spam["is_spam"] else "vorschlag"

                    received_at_iso = ""
                    d = msg.get("Date")
                    if d:
                        try:
                            received_at_iso = parsedate_to_datetime(d).isoformat()
                        except Exception:
                            received_at_iso = d

                    entry = {
                        "id": str(uuid.uuid4()),
                        "email_uid": f"{folder}/{uid.decode()}",
                        "message_id": message_id,
                        "folder": folder,
                        "from_email": from_email,
                        "from_name": _decode(from_name),
                        "reply_to": reply_to,
                        "subject": subject,
                        "received_at": received_at_iso,
                        "body_excerpt": (body or "")[:2000],
                        "parsed": parsed,
                        "spam": spam,
                        "status": initial_status,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await db.module_mail_inbox.insert_one(entry)
                    found += 1
                except Exception as e:  # noqa: BLE001
                    logger.warning(f"mail-inbox scan: Mail-Fehler {e}")
                    continue

        try:
            imap.close()
        except Exception:
            pass
        imap.logout()
    except imaplib.IMAP4.error as e:
        raise HTTPException(500, f"IMAP-Login fehlgeschlagen: {e}") from e

    return {
        "ok": True,
        "found": found,
        "duplicates_skipped": dup,
        "non_matching_skipped": skipped,
        "weeks": weeks,
        "max_count": max_count,
    }


@router.get("/list")
async def list_inbox(status: str = "vorschlag", limit: int = 100, user=Depends(get_current_user)):
    if status == "all":
        q = {}
    else:
        q = {"status": status}
    items = []
    async for d in db.module_mail_inbox.find(q, {"_id": 0}).sort("received_at", -1).limit(limit):
        items.append(d)
    return items


@router.post("/accept/{entry_id}")
async def accept(entry_id: str, user=Depends(get_current_user)):
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    if entry.get("status") == "übernommen":
        raise HTTPException(400, "Bereits übernommen")
    parsed = entry.get("parsed") or {}

    new_kunde_id = str(uuid.uuid4())
    full_name = " ".join(p for p in [parsed.get("vorname", ""), parsed.get("nachname", "")] if p).strip()
    new_kunde = {
        "id": new_kunde_id,
        "anrede": parsed.get("anrede", ""),
        "vorname": parsed.get("vorname", ""),
        "nachname": parsed.get("nachname", ""),
        "name": full_name or entry.get("from_name", ""),
        "email": parsed.get("email") or entry.get("reply_to", "") or "",
        "phone": parsed.get("telefon", ""),
        "kontakt_status": "Anfrage",
        "quelle": "Jimdo Kontaktformular",
        "anliegen": parsed.get("nachricht", ""),
        "source_url": parsed.get("source_url", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": getattr(user, "username", "system"),
        "imported_from_mail_id": entry_id,
    }
    await db.module_kunden.insert_one(new_kunde)

    await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {
            "status": "übernommen",
            "kunde_id": new_kunde_id,
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": getattr(user, "username", None),
        }},
    )
    return {"ok": True, "kunde_id": new_kunde_id, "kunde_name": new_kunde["name"]}


@router.post("/reject/{entry_id}")
async def reject(entry_id: str, user=Depends(get_current_user)):
    r = await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {
            "status": "ignoriert",
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": getattr(user, "username", None),
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"ok": True}


@router.post("/reject-all-spam")
async def reject_all_spam(user=Depends(get_current_user)):
    """Massen-Ignorieren: alle Einträge mit Status 'spam_verdacht' auf 'ignoriert' setzen."""
    r = await db.module_mail_inbox.update_many(
        {"status": "spam_verdacht"},
        {"$set": {
            "status": "ignoriert",
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": getattr(user, "username", None),
            "auto_rejected_as_spam": True,
        }},
    )
    return {"ok": True, "rejected": r.modified_count}
