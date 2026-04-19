from fastapi import APIRouter, HTTPException, Depends
from database import db, logger
from auth import get_current_user
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
import uuid
import imaplib
import email
from email.header import decode_header
import re
import os
import base64

router = APIRouter()

DEFAULT_KEYWORDS = ["neue anfrage", "anfrage von"]


def keyword_match(text, keywords):
    """Check if any keyword appears in text"""
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in keywords)


def parse_vcf(vcf_text):
    """Parse a VCF/vCard file and extract contact info"""
    contact = {}
    lines = vcf_text.replace("\r\n ", "").replace("\r\n\t", "").split("\r\n")
    if len(lines) <= 1:
        lines = vcf_text.replace("\n ", "").replace("\n\t", "").split("\n")
    for line in lines:
        line = line.strip()
        if not line or line.startswith("BEGIN:") or line.startswith("END:") or line.startswith("VERSION:"):
            continue
        # Handle property;params:value format
        if ":" not in line:
            continue
        prop_part, _, value = line.partition(":")
        prop = prop_part.split(";")[0].upper()
        if prop == "FN":
            contact["name"] = value.strip()
        elif prop == "N":
            parts = value.split(";")
            family = parts[0].strip() if len(parts) > 0 else ""
            given = parts[1].strip() if len(parts) > 1 else ""
            prefix = parts[3].strip() if len(parts) > 3 else ""
            if prefix in ("Herr", "Frau"):
                contact["anrede"] = prefix
            contact["vorname"] = given
            contact["nachname"] = family
            if not contact.get("name"):
                contact["name"] = f"{given} {family}".strip()
        elif prop == "EMAIL":
            contact["email"] = value.strip().lower()
        elif prop == "TEL":
            contact["phone"] = value.strip()
        elif prop in ("ADR", "ITEM1.ADR", "ITEM2.ADR"):
            parts = value.split(";")
            addr_parts = [p.strip() for p in parts if p.strip()]
            if addr_parts:
                contact["address"] = ", ".join(addr_parts)
        elif prop == "ORG":
            contact["firma"] = value.replace(";", " ").strip()
        elif prop == "TITLE":
            contact["rolle"] = value.strip()
    return contact


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

    # Pre-load bekannte E-Mails aus Kunden-Modul und Kontakt-Modul
    customer_by_email = {}
    async for c in db.module_kunden.find({}, {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "email": 1}):
        if c.get("email"):
            name = f"{c.get('vorname', '')} {c.get('nachname', '')}".strip()
            customer_by_email[c["email"].lower()] = {"id": c["id"], "name": name}
    kontakt_by_email = {}
    async for k in db.module_kunden.find({}, {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "email": 1}):
        if k.get("email"):
            name = f"{k.get('vorname', '')} {k.get('nachname', '')}".strip()
            key = k["email"].lower()
            if key not in kontakt_by_email:
                kontakt_by_email[key] = []
            kontakt_by_email[key].append({"id": k["id"], "name": name})

    # Load keywords for classification
    kw_doc = await db.settings.find_one({"id": "email_keywords"}, {"_id": 0})
    keywords = kw_doc["keywords"] if kw_doc and "keywords" in kw_doc else DEFAULT_KEYWORDS

    # Load Ignore-Liste (Absender/Domains die NICHT in die Suite sollen)
    ignore_doc = await db.settings.find_one({"id": "email_ignore_list"}, {"_id": 0})
    ignore_patterns = [p.lower().strip() for p in (ignore_doc.get("patterns", []) if ignore_doc else []) if p.strip()]

    for eid in email_ids[-50:]:
        status, msg_data = mail.fetch(eid, "(BODY.PEEK[])")
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

        # Ignore-Liste pruefen (Absender oder Domain soll nicht in Suite)
        if ignore_patterns:
            check_text = f"{sender_email.lower()} {sender_name.lower()} {subject.lower()}"
            if any(pat in check_text for pat in ignore_patterns):
                logger.info(f"IMAP: Ignoriere Mail von {sender_email} (Ignore-Pattern match)")
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

        # Classify with match details
        matched_customer = customer_by_email.get(sender_email)
        matched_kontakte = kontakt_by_email.get(sender_email, [])
        has_vcf = any(a["filename"].lower().endswith(".vcf") for a in attachment_meta)

        # Kontaktformular-Weiterleitungen immer als "anfrage" klassifizieren
        form_indicators = ["Neue Kundenanfrage eingegangen", "Kontaktdaten", "Kontaktformular", "Kontaktanfrage"]
        is_contact_form = any(ind.lower() in (subject + " " + body).lower() for ind in form_indicators)

        if is_contact_form:
            classification = "anfrage"
        elif matched_customer or matched_kontakte:
            classification = "bekannt"
        elif keyword_match(subject + " " + body, keywords):
            classification = "anfrage"
        else:
            classification = "neu"

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
            "matched_customer": matched_customer,
            "matched_kontakte": matched_kontakte[:5],
            "has_vcf": has_vcf,
            "status": "ungelesen",
            "assigned_to": None,
            "assigned_type": None,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.email_inbox.insert_one(inbox_entry)
        inbox_entry.pop("_id", None)
        fetched += 1
        mail.store(eid, "+FLAGS", "\\Seen")
        
        # Auto-import ins Kontakt-Modul wenn "anfrage" klassifiziert
        if classification == "anfrage":
            try:
                import re as _re
                
                # Prüfe ob es eine Kontaktformular-Weiterleitung ist
                is_forwarded_form = False
                extracted = {}
                
                form_indicators = ["Neue Kundenanfrage eingegangen", "Kontaktdaten", "Kontaktformular"]
                if any(ind.lower() in body.lower() for ind in form_indicators):
                    _fields = r'(?:Name|Telefon|E-Mail|Adresse|Firma|Anliegen|Themen|Kategorien)'
                    
                    name_match = _re.search(r'Name:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
                    phone_match = _re.search(r'Telefon:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
                    email_match = _re.search(r'E-Mail:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
                    addr_match = _re.search(r'Adresse:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
                    msg_match = _re.search(r'Nachricht[:\s]+(.+?)(?=\s*[\U0001F4F7\U0001F4CB]|\s*\d+\s*Bild\(er\)|\s*Diese Anfrage finden|\s*Eingegangen am|\s*Quelle:|\s*Tischlerei|\s*Handy:|\s*Hinweis:\s*DSGVO|\Z)', body, _re.DOTALL)
                    firma_match = _re.search(r'Firma:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
                    
                    if name_match and (phone_match or email_match):
                        is_forwarded_form = True
                        raw_name = name_match.group(1).strip()
                        raw_name = _re.sub(r'^(Herr|Frau|Divers)\s+\1\s+', r'\1 ', raw_name)
                        
                        anrede = ""
                        for prefix in ["Herr", "Frau", "Divers"]:
                            if raw_name.startswith(prefix + " "):
                                anrede = prefix
                                raw_name = raw_name[len(prefix):].strip()
                                break
                        
                        name_parts = raw_name.split()
                        vorname = name_parts[0] if len(name_parts) >= 1 else ""
                        nachname = " ".join(name_parts[1:]) if len(name_parts) >= 2 else ""
                        
                        extracted = {
                            "vorname": vorname,
                            "nachname": nachname,
                            "anrede": anrede,
                            "phone": phone_match.group(1).strip() if phone_match else "",
                            "email": email_match.group(1).strip() if email_match else "",
                            "address": addr_match.group(1).strip() if addr_match else "",
                            "nachricht": msg_match.group(1).strip() if msg_match else "",
                            "firma": firma_match.group(1).strip() if firma_match else "",
                        }
                        
                        # Prüfe ob bereits im Kontakt-Modul vorhanden
                        existing = None
                        if extracted["email"]:
                            existing = await db.module_kunden.find_one(
                                {"email": {"$regex": _re.escape(extracted["email"]), "$options": "i"}},
                                {"_id": 0, "id": 1}
                            )
                        
                        if existing:
                            logger.info(f"Kontaktformular-Weiterleitung: Kontakt existiert bereits ({extracted['email']})")
                            await db.email_inbox.update_one(
                                {"id": inbox_entry["id"]},
                                {"$set": {"assigned_type": "kontakt", "assigned_to": existing["id"], "classification": "bekannt"}}
                            )
                            continue
                
                # Kontakt im Kontakt-Modul anlegen
                if is_forwarded_form and extracted:
                    kontakt = {
                        "id": str(uuid.uuid4()),
                        "vorname": extracted["vorname"],
                        "nachname": extracted["nachname"],
                        "anrede": extracted["anrede"],
                        "email": extracted["email"],
                        "phone": extracted["phone"],
                        "firma": extracted["firma"],
                        "strasse": "",
                        "hausnummer": "",
                        "plz": "",
                        "ort": "",
                        "customer_type": "Privat",
                        "kontakt_status": "Anfrage",
                        "categories": [],
                        "notes": f"Quelle: Kontaktformular\nBetreff: {subject}\n\n{extracted.get('nachricht', '')}",
                        "source": "email_auto_import",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    # Adresse parsen wenn vorhanden
                    if extracted.get("address"):
                        addr = extracted["address"]
                        parts = addr.split(",")
                        if len(parts) >= 2:
                            kontakt["strasse"] = parts[0].strip()
                            rest = parts[1].strip().split(" ", 1)
                            kontakt["plz"] = rest[0] if rest else ""
                            kontakt["ort"] = rest[1] if len(rest) > 1 else ""
                    logger.info(f"Auto-Import (Kontaktformular) -> Kontakt-Modul: {extracted['vorname']} {extracted['nachname']}")
                else:
                    # Normale E-Mail-Anfrage
                    name_parts = (sender_name or "Unbekannt").split(" ", 1)
                    kontakt = {
                        "id": str(uuid.uuid4()),
                        "vorname": name_parts[0] if name_parts else "",
                        "nachname": name_parts[1] if len(name_parts) > 1 else "",
                        "anrede": "",
                        "email": sender_email,
                        "phone": "",
                        "firma": "",
                        "strasse": "",
                        "hausnummer": "",
                        "plz": "",
                        "ort": "",
                        "customer_type": "Privat",
                        "kontakt_status": "Anfrage",
                        "categories": [],
                        "notes": f"Betreff: {subject}\n\n{body[:1000]}",
                        "source": "email_auto_import",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    logger.info(f"Auto-Import -> Kontakt-Modul: {sender_name} ({sender_email})")
                
                await db.module_kunden.insert_one(kontakt)
                kontakt.pop("_id", None)
                
                # Update inbox entry
                await db.email_inbox.update_one(
                    {"id": inbox_entry["id"]},
                    {"$set": {"assigned_type": "kontakt", "assigned_to": kontakt["id"]}}
                )
            except Exception as e:
                logger.error(f"Fehler beim Auto-Import: {e}")

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
    """E-Mail als Kontakt im Kontakt-Modul anlegen (Status: Anfrage)"""
    mail_doc = await db.email_inbox.find_one({"id": email_id}, {"_id": 0})
    if not mail_doc:
        raise HTTPException(404, "E-Mail nicht gefunden")

    import re as _re
    body = mail_doc.get("body", "")
    vorname = ""
    nachname = ""
    kontakt_email = mail_doc["from_email"]
    phone = ""
    anrede = ""
    firma = ""
    address = ""
    notes = f"Betreff: {mail_doc['subject']}"

    # Prüfe ob Kontaktformular-Weiterleitung (strukturierte Felder)
    form_indicators = ["Neue Kundenanfrage eingegangen", "Kontaktdaten", "Kontaktformular"]
    if any(ind.lower() in body.lower() for ind in form_indicators):
        _fields = r'(?:Name|Telefon|E-Mail|Adresse|Firma|Anliegen|Themen|Kategorien)'
        name_match = _re.search(r'Name:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
        phone_match = _re.search(r'Telefon:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
        email_match = _re.search(r'E-Mail:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
        addr_match = _re.search(r'Adresse:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)
        msg_match = _re.search(r'Nachricht[:\s]+(.+?)(?=\s*[\U0001F4F7\U0001F4CB]|\s*\d+\s*Bild\(er\)|\s*Diese Anfrage finden|\s*Eingegangen am|\s*Quelle:|\s*Tischlerei|\s*Handy:|\s*Hinweis:\s*DSGVO|\Z)', body, _re.DOTALL)
        firma_match = _re.search(r'Firma:\s*(.+?)(?=\s+' + _fields + r'[:\s]|\s+Nachricht[\s:]|\Z)', body)

        if name_match:
            raw_name = name_match.group(1).strip()
            raw_name = _re.sub(r'^(Herr|Frau|Divers)\s+\1\s+', r'\1 ', raw_name)
            for prefix in ["Herr", "Frau", "Divers"]:
                if raw_name.startswith(prefix + " "):
                    anrede = prefix
                    raw_name = raw_name[len(prefix):].strip()
                    break
            parts = raw_name.split()
            vorname = parts[0] if parts else ""
            nachname = " ".join(parts[1:]) if len(parts) > 1 else ""
        if email_match:
            kontakt_email = email_match.group(1).strip()
        if phone_match:
            phone = phone_match.group(1).strip()
        if addr_match:
            address = addr_match.group(1).strip()
        if firma_match:
            firma = firma_match.group(1).strip()
        if msg_match:
            notes = f"Betreff: {mail_doc['subject']}\n\n{msg_match.group(1).strip()}"
    else:
        # Kein Kontaktformular - Absenderdaten verwenden
        from_name = mail_doc.get("from_name", "")
        parts = from_name.strip().split(" ", 1)
        vorname = parts[0] if parts else ""
        nachname = parts[1] if len(parts) > 1 else ""
        notes = f"Betreff: {mail_doc['subject']}\n\n{body[:2000]}"

    kontakt = {
        "id": str(uuid.uuid4()),
        "vorname": vorname,
        "nachname": nachname,
        "email": kontakt_email,
        "phone": phone,
        "anrede": anrede,
        "firma": firma,
        "strasse": "",
        "hausnummer": "",
        "plz": "",
        "ort": "",
        "customer_type": "Privat",
        "kontakt_status": "Anfrage",
        "categories": [],
        "notes": notes,
        "source": "e-mail",
        "email_message_id": mail_doc.get("message_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Adresse parsen
    if address:
        addr_parts = address.split(",")
        if len(addr_parts) >= 2:
            kontakt["strasse"] = addr_parts[0].strip()
            rest = addr_parts[1].strip().split(" ", 1)
            kontakt["plz"] = rest[0] if rest else ""
            kontakt["ort"] = rest[1] if len(rest) > 1 else ""

    await db.module_kunden.insert_one(kontakt)
    kontakt.pop("_id", None)

    display_name = f"{vorname} {nachname}".strip() or kontakt_email

    await db.email_inbox.update_one(
        {"id": email_id},
        {"$set": {"status": "zugeordnet", "assigned_to": kontakt["id"], "assigned_type": "kontakt"}}
    )
    return {"ok": True, "kontakt_id": kontakt["id"], "message": f"Kontakt '{display_name}' im Kontakt-Modul angelegt"}


@router.post("/imap/inbox/{email_id}/assign-customer")
async def assign_to_customer(email_id: str, body: dict, user=Depends(get_current_user)):
    """E-Mail einem Kunden aus dem Kunden-Modul oder Kontakt-Modul zuordnen"""
    customer_id = body.get("customer_id")
    if not customer_id:
        raise HTTPException(400, "customer_id erforderlich")

    mail_doc = await db.email_inbox.find_one({"id": email_id}, {"_id": 0})
    if not mail_doc:
        raise HTTPException(404, "E-Mail nicht gefunden")

    # Suche in Kunden-Modul
    customer = await db.module_kunden.find_one({"id": customer_id}, {"_id": 0})
    target_collection = "module_kunden"
    if not customer:
        # Suche in Kontakt-Modul
        customer = await db.module_kunden.find_one({"id": customer_id}, {"_id": 0})
        target_collection = "module_kunden"
    if not customer:
        raise HTTPException(404, "Kunde/Kontakt nicht gefunden")

    customer_name = f"{customer.get('vorname', '')} {customer.get('nachname', '')}".strip() or customer.get('firma', 'Unbekannt')

    # E-Mail-Verlauf zum Kunden/Kontakt hinzufuegen
    db_col = db.module_kunden if target_collection == "module_kunden" else db.module_kunden
    await db_col.update_one(
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
    return {"ok": True, "message": f"E-Mail dem Kunden {customer_name} zugeordnet"}


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


# ── Keyword management ──

@router.get("/imap/keywords")
async def get_keywords(user=Depends(get_current_user)):
    doc = await db.settings.find_one({"id": "email_keywords"}, {"_id": 0})
    if doc and "keywords" in doc:
        return doc["keywords"]
    return DEFAULT_KEYWORDS


@router.put("/imap/keywords")
async def update_keywords(body: dict, user=Depends(get_current_user)):
    keywords = [k for k in body.get("keywords", []) if k.strip()]
    await db.settings.update_one(
        {"id": "email_keywords"},
        {"$set": {"id": "email_keywords", "keywords": keywords}},
        upsert=True,
    )
    return keywords


# ── Komplett löschen (IMAP + DB) ──

@router.delete("/imap/inbox/{email_id}/permanent")
async def permanent_delete_email(email_id: str, user=Depends(get_current_user)):
    """Delete email from inbox AND from IMAP server"""
    mail_doc = await db.email_inbox.find_one({"id": email_id}, {"_id": 0})
    if not mail_doc:
        raise HTTPException(404, "E-Mail nicht gefunden")

    # Try to delete from IMAP
    message_id = mail_doc.get("message_id")
    if message_id:
        try:
            creds = _get_imap_creds()
            if creds["server"] and creds["user"] and creds["password"]:
                imap = imaplib.IMAP4_SSL(creds["server"], creds["port"])
                imap.login(creds["user"], creds["password"])
                imap.select("INBOX", readonly=False)
                status, data = imap.search(None, f'HEADER Message-ID "{message_id}"')
                if status == "OK" and data[0]:
                    for eid in data[0].split():
                        imap.store(eid, "+FLAGS", "\\Deleted")
                    imap.expunge()
                imap.logout()
        except Exception as e:
            logger.warning(f"IMAP delete failed: {e}")

    # Delete attachments from DB
    for att in mail_doc.get("attachments", []):
        await db.email_attachments.delete_one({"id": att["id"]})

    # Delete from inbox
    await db.email_inbox.delete_one({"id": email_id})
    return {"ok": True, "message": "E-Mail komplett gelöscht"}


# ── VCF parsing endpoint ──

@router.post("/imap/parse-vcf/{att_id}")
async def parse_vcf_attachment(att_id: str, user=Depends(get_current_user)):
    """Parse a VCF attachment and check if contact exists"""
    att = await db.email_attachments.find_one({"id": att_id}, {"_id": 0})
    if not att:
        raise HTTPException(404, "Anhang nicht gefunden")

    try:
        vcf_text = base64.b64decode(att["data_b64"]).decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(400, "VCF konnte nicht gelesen werden")

    contact = parse_vcf(vcf_text)
    if not contact:
        raise HTTPException(400, "Keine Kontaktdaten in der VCF-Datei gefunden")

    # Check if contact already exists
    existing_customer = None
    existing_anfrage = None
    if contact.get("email"):
        existing_customer = await db.customers.find_one({"email": {"$regex": f"^{re.escape(contact['email'])}$", "$options": "i"}}, {"_id": 0, "id": 1, "name": 1, "email": 1})
        existing_anfrage = await db.anfragen.find_one({"email": {"$regex": f"^{re.escape(contact['email'])}$", "$options": "i"}}, {"_id": 0, "id": 1, "name": 1, "email": 1})
    if not existing_customer and contact.get("name"):
        existing_customer = await db.customers.find_one({"name": {"$regex": re.escape(contact["name"]), "$options": "i"}}, {"_id": 0, "id": 1, "name": 1, "email": 1})

    return {
        "contact": contact,
        "existing_customer": existing_customer,
        "existing_anfrage": existing_anfrage,
        "already_exists": bool(existing_customer or existing_anfrage),
    }



# ==================== E-MAIL IGNORE-LISTE ====================

DEFAULT_IGNORE_PATTERNS = [
    "paypal.com",
    "noreply@paypal",
    "service@paypal",
    "@amazon.de",
    "no-reply@",
    "noreply@",
    "newsletter@",
    "newsletter",
    "info@facebook",
    "update@linkedin",
    "notify@twitter",
    "notify@xing",
    "werbung@",
    "info@ebay",
    "rewe-newsletter",
    "dhl.de",
    "dpd.de",
    "hermesworld.com",
]


@router.get("/imap/ignore-list")
async def get_ignore_list(user=Depends(get_current_user)):
    """Gibt die Liste der Absender/Domains zurueck, die NICHT in die Suite importiert werden."""
    doc = await db.settings.find_one({"id": "email_ignore_list"}, {"_id": 0})
    if not doc:
        # Beim ersten Abruf Standard-Liste anlegen
        doc = {"id": "email_ignore_list", "patterns": DEFAULT_IGNORE_PATTERNS}
        await db.settings.insert_one(doc)
        # _id wieder entfernen fuer JSON-Response
        doc = {"id": "email_ignore_list", "patterns": DEFAULT_IGNORE_PATTERNS}
    return {"patterns": doc.get("patterns", [])}


class IgnoreListUpdate(BaseModel):
    patterns: List[str]


@router.put("/imap/ignore-list")
async def update_ignore_list(payload: IgnoreListUpdate, user=Depends(get_current_user)):
    """Aktualisiert die Ignore-Liste komplett."""
    cleaned = [p.strip().lower() for p in payload.patterns if p.strip()]
    await db.settings.update_one(
        {"id": "email_ignore_list"},
        {"$set": {"patterns": cleaned}},
        upsert=True,
    )
    logger.info(f"Ignore-Liste aktualisiert ({len(cleaned)} Eintraege)")
    return {"patterns": cleaned, "count": len(cleaned)}


@router.post("/imap/ignore-list/cleanup")
async def cleanup_by_ignore_list(user=Depends(get_current_user)):
    """Loescht bereits vorhandene Inbox-Eintraege, die gegen die aktuelle Ignore-Liste matchen."""
    doc = await db.settings.find_one({"id": "email_ignore_list"}, {"_id": 0})
    patterns = [p.lower() for p in (doc.get("patterns", []) if doc else []) if p.strip()]
    if not patterns:
        return {"deleted": 0}

    deleted = 0
    cursor = db.email_inbox.find({}, {"_id": 0, "id": 1, "from_email": 1, "from_name": 1, "subject": 1})
    async for mail_doc in cursor:
        check = f"{(mail_doc.get('from_email') or '').lower()} {(mail_doc.get('from_name') or '').lower()} {(mail_doc.get('subject') or '').lower()}"
        if any(pat in check for pat in patterns):
            await db.email_inbox.delete_one({"id": mail_doc["id"]})
            deleted += 1
    logger.info(f"Ignore-Cleanup: {deleted} Mails aus Inbox entfernt")
    return {"deleted": deleted}
