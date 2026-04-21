"""
Anfragen-Fetcher Modul (isoliert)

Holt gezielt nur Kontaktformular-Mails aus IMAP und legt sie als Anfragen an.
Laesst alle anderen E-Mails unberuehrt (kein SEEN-Flag, BODY.PEEK[]).
Speichert Datum der letzten Abfrage, sodass beim naechsten Aufruf nur neue Mails
seit diesem Datum abgeholt werden.

Betterbird & Co merken nichts davon.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from email.header import decode_header
from email.utils import parseaddr
import imaplib
import email
import re
import uuid

from database import db, logger
from auth import get_current_user
from utils.anrede_detector import detect_anrede

router = APIRouter()


def _get_imap_creds():
    """IMAP-Credentials aus .env - gleiche Methode wie routes/imap.py"""
    return {
        "server": os.environ.get("IMAP_SERVER", ""),
        "port": int(os.environ.get("IMAP_PORT", 993)),
        "user": os.environ.get("IMAP_USER", ""),
        "password": os.environ.get("IMAP_PASSWORD", ""),
    }

# Marker im Betreff oder Body, die eine Kontaktformular-Mail identifizieren
FORM_SUBJECT_MARKERS = ["Neue Kundenanfrage", "Kontaktformular", "Kontaktanfrage", "Neue Anfrage"]
FORM_BODY_MARKERS = ["Neue Kundenanfrage eingegangen", "Kontaktdaten", "Kontaktformular"]


def _decode(s: str) -> str:
    """Dekodiert MIME-encoded Header in UTF-8 String"""
    if not s:
        return ""
    parts = decode_header(s)
    out = ""
    for text, enc in parts:
        if isinstance(text, bytes):
            try:
                out += text.decode(enc or "utf-8", errors="ignore")
            except Exception:
                out += text.decode("utf-8", errors="ignore")
        else:
            out += text or ""
    return out


def _extract_body(msg) -> str:
    """Extrahiert den text/plain Body aus einer Mail"""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            disp = str(part.get("Content-Disposition") or "")
            if ct == "text/plain" and "attachment" not in disp.lower():
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        return payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                except Exception:
                    continue
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                return payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")
        except Exception:
            return ""
    return ""


def _parse_form_body(body: str) -> dict:
    """Extrahiert Felder aus dem Kontaktformular-Body (gleiche Regex wie imap.py)"""
    out = {"vorname": "", "nachname": "", "email": "", "phone": "", "address": "", "nachricht": "", "anrede": ""}
    fields = r"(?:Name|Telefon|E-Mail|Adresse|Firma|Anliegen|Themen|Kategorien)"

    def _grab(field_name, dotall=False):
        flags = re.DOTALL if dotall else 0
        pat = rf"{field_name}:\s*(.+?)(?=\s+{fields}[:\s]|\s+Nachricht[\s:]|\Z)"
        m = re.search(pat, body, flags)
        return m.group(1).strip() if m else ""

    raw_name = _grab("Name")
    if raw_name:
        # Anrede abtrennen
        for prefix in ("Herr", "Frau", "Divers"):
            if raw_name.startswith(prefix + " "):
                out["anrede"] = prefix
                raw_name = raw_name[len(prefix):].strip()
                break
        parts = raw_name.split()
        out["vorname"] = parts[0] if parts else ""
        out["nachname"] = " ".join(parts[1:]) if len(parts) > 1 else ""

    out["email"] = _grab("E-Mail")
    out["phone"] = _grab("Telefon")
    out["address"] = _grab("Adresse")

    msg_match = re.search(
        r"Nachricht[:\s]+(.+?)(?=\s*[\U0001F4F7\U0001F4CB]|\s*\d+\s*Bild\(er\)|\s*Diese Anfrage finden|\s*Eingegangen am|\s*Quelle:|\s*Tischlerei|\s*Handy:|\s*Hinweis:\s*DSGVO|\Z)",
        body, re.DOTALL,
    )
    if msg_match:
        out["nachricht"] = msg_match.group(1).strip()

    return out


async def _get_last_fetch() -> datetime:
    """Liest letzten Abruf-Zeitpunkt. Default: 30 Tage zurueck."""
    state = await db.anfragen_fetcher_state.find_one({"_id": "default"})
    if state and state.get("last_fetch"):
        try:
            return datetime.fromisoformat(state["last_fetch"])
        except Exception:
            pass
    return datetime.now(timezone.utc) - timedelta(days=30)


async def _set_last_fetch(dt: datetime) -> None:
    await db.anfragen_fetcher_state.update_one(
        {"_id": "default"},
        {"$set": {"last_fetch": dt.isoformat()}},
        upsert=True,
    )


@router.post("/anfragen/fetch")
async def fetch_anfragen(user=Depends(get_current_user)):
    """Holt ausschliesslich Kontaktformular-Mails aus IMAP und legt Anfragen an."""
    creds = _get_imap_creds()
    server = creds["server"]
    port = creds["port"]
    username = creds["user"]
    password = creds["password"]

    if not (server and username and password):
        raise HTTPException(400, "IMAP-Daten unvollstaendig (bitte .env mit IMAP_SERVER, IMAP_USER, IMAP_PASSWORD konfigurieren).")

    since_dt = await _get_last_fetch()
    now_dt = datetime.now(timezone.utc)

    fetched = 0
    skipped = 0
    errors = []
    details = []

    try:
        imap = imaplib.IMAP4_SSL(server, port)
        imap.login(username, password)
        imap.select("INBOX", readonly=False)

        # Optimierte Suche: direkt im IMAP nach Betreff-Mustern filtern
        # -> viel weniger Mails zu parsen
        since_str = since_dt.strftime("%d-%b-%Y")
        # Mehrere SUBJECT-Queries (ODER) -> alle IDs zusammenfuehren
        subject_terms = ["Neue Kundenanfrage", "Neue Anfrage", "Kontaktanfrage", "Kontaktformular"]
        all_ids = set()
        for term in subject_terms:
            try:
                status, data = imap.search(None, f'(SINCE "{since_str}" SUBJECT "{term}")')
                if status == "OK" and data and data[0]:
                    for i in data[0].split():
                        all_ids.add(i)
            except Exception as e:
                logger.debug(f"IMAP-Subject-Search fehlgeschlagen fuer '{term}': {e}")
        ids = sorted(all_ids, key=lambda x: int(x))

        for num in ids:
            try:
                # PEEK -> keine SEEN-Flag-Aenderung
                status, msg_data = imap.fetch(num, "(BODY.PEEK[])")
                if status != "OK" or not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)
                subject = _decode(msg.get("Subject", ""))
                from_hdr = _decode(msg.get("From", ""))
                body = _extract_body(msg)

                # Filter: Betreff ODER Body muss Formular-Marker enthalten
                is_form = any(m.lower() in subject.lower() for m in FORM_SUBJECT_MARKERS) or \
                          any(m.lower() in body.lower() for m in FORM_BODY_MARKERS)
                if not is_form:
                    continue

                extracted = _parse_form_body(body)

                # Namen auch aus Betreff parsen (Format: "Neue Anfrage: Herr Max Mustermann - ...")
                if not extracted["nachname"] and subject:
                    m = re.search(r'(?:Neue\s+(?:Anfrage|Kundenanfrage|Kontaktanfrage)|Kontaktformular)[:\s-]+(?:(Herr|Frau|Divers)\s+)?([A-ZÄÖÜa-zäöüß][\wäöüßÄÖÜ\-]+)\s+([A-ZÄÖÜa-zäöüß][\wäöüßÄÖÜ\-]+)', subject)
                    if m:
                        if m.group(1):
                            extracted["anrede"] = m.group(1)
                        extracted["vorname"] = m.group(2).strip()
                        extracted["nachname"] = m.group(3).strip()

                # Fallback: Absender wenn Felder nicht im Body
                # ABER: eigene Domain (@tischlerei-graupner.de) nicht als Kunden-Email uebernehmen
                if not extracted["email"]:
                    _, addr = parseaddr(from_hdr)
                    if addr and "tischlerei-graupner.de" not in addr.lower():
                        extracted["email"] = addr
                if not extracted["nachname"] and from_hdr:
                    name_part = from_hdr.split("<")[0].strip().strip('"')
                    if "tischlerei-graupner" not in name_part.lower() and "service24" not in name_part.lower():
                        parts = name_part.split()
                        if len(parts) >= 2:
                            extracted["vorname"] = parts[0]
                            extracted["nachname"] = " ".join(parts[1:])

                # Duplikat-Check: gleiche email UND gleicher nachname (beide muessen matchen)
                existing = None
                if extracted["email"] and extracted["nachname"]:
                    existing = await db.anfragen.find_one({
                        "email": {"$regex": f"^{re.escape(extracted['email'])}$", "$options": "i"},
                        "nachname": {"$regex": f"^{re.escape(extracted['nachname'])}$", "$options": "i"},
                    }, {"_id": 0, "id": 1, "name": 1})
                elif extracted["nachname"]:
                    # Nur nachname -> exakter Match
                    existing = await db.anfragen.find_one({
                        "nachname": {"$regex": f"^{re.escape(extracted['nachname'])}$", "$options": "i"},
                    }, {"_id": 0, "id": 1, "name": 1})
                if existing:
                    skipped += 1
                    details.append({
                        "status": "skipped",
                        "subject": subject,
                        "reason": f"Anfrage existiert bereits ({existing.get('name','')})",
                    })
                    continue

                # Neue Anfrage anlegen
                full_name = f"{extracted['vorname']} {extracted['nachname']}".strip() or "Unbekannt"
                anfrage = {
                    "id": str(uuid.uuid4()),
                    "name": full_name,
                    "vorname": extracted["vorname"],
                    "nachname": extracted["nachname"],
                    "anrede": detect_anrede(
                        name=full_name,
                        vorname=extracted["vorname"],
                        nachname=extracted["nachname"],
                        existing_anrede=extracted.get("anrede", ""),
                    ),
                    "email": extracted["email"],
                    "phone": extracted["phone"],
                    "address": extracted["address"],
                    "objektadresse": extracted["address"],
                    "nachricht": extracted["nachricht"],
                    "notes": f"Quelle: Kontaktformular (auto-abgeholt)\nBetreff: {subject}",
                    "source": "anfragen_fetcher",
                    "customer_type": "Privat",
                    "categories": [],
                    "status": "neu",
                    "photos": [],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.anfragen.insert_one(anfrage)
                fetched += 1
                details.append({
                    "status": "imported",
                    "subject": subject,
                    "name": full_name,
                    "email": extracted["email"],
                })
                logger.info(f"Anfragen-Fetcher: Neue Anfrage importiert: {full_name} ({extracted['email']})")
            except Exception as e:
                errors.append(str(e))
                logger.error(f"Anfragen-Fetcher Fehler bei Mail {num}: {e}")

        imap.close()
        imap.logout()
    except imaplib.IMAP4.error as ie:
        raise HTTPException(500, f"IMAP-Fehler: {ie}")
    except Exception as e:
        logger.error(f"Anfragen-Fetcher unerwarteter Fehler: {e}")
        raise HTTPException(500, f"Fehler: {e}")

    await _set_last_fetch(now_dt)

    return {
        "fetched": fetched,
        "skipped": skipped,
        "errors": len(errors),
        "last_fetch": now_dt.isoformat(),
        "details": details,
    }


@router.get("/anfragen/fetch/status")
async def fetch_status(user=Depends(get_current_user)):
    """Zeigt wann das letzte Mal Anfragen abgerufen wurden."""
    state = await db.anfragen_fetcher_state.find_one({"_id": "default"})
    return {
        "last_fetch": state.get("last_fetch") if state else None,
    }
