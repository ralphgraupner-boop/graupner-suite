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
from .accounts import get_active_accounts, filter_matches

router = APIRouter()

# Strenger Filter: nur Kontaktformular-Mails
JIMDO_FROM_PATTERN = re.compile(r"no-reply@jimdo\.com", re.IGNORECASE)
SUBJECT_DOMAIN = "tischlerei-graupner.de"
ALT_SUBJECT_PATTERN = re.compile(r"Anfrage\s+von\s+", re.IGNORECASE)
# Jimdo-Variante: Betreff wie "Nachricht über https://www.tischlerei-graupner.de/..."
NACHRICHT_UEBER_PATTERN = re.compile(r"Nachricht\s+über\s+https?://", re.IGNORECASE)

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


def _is_ascii(s: str) -> bool:
    try:
        s.encode("ascii")
        return True
    except UnicodeEncodeError:
        return False


def _build_imap_search_args(since_str: str, rules: list) -> tuple:
    """Baut die IMAP-Search-Argumente aus den Filter-Rules.
    - imaplib unterstützt keine Umlaute → Rules mit non-ASCII-Werten werden
      übersprungen (clientseitige Filter fängt sie trotzdem korrekt ab).
    - Pro Rule wird eine IMAP-Bedingung erzeugt; mehrere werden via OR verknüpft.
    - Wenn keine ASCII-Rule übrig bleibt, Fallback auf reines SINCE.
    """
    parts = []
    for r in rules or []:
        t = (r.get("type") or "").strip()
        v = (r.get("value") or "").strip()
        if not t or not v or not _is_ascii(v):
            continue
        v_safe = v.replace('"', '')
        if t in ("subject_contains", "subject_startswith"):
            parts.append(f'(SUBJECT "{v_safe}")')
        elif t in ("from_contains", "from_equals"):
            parts.append(f'(FROM "{v_safe}")')
    base = f'(SINCE "{since_str}")'
    if not parts:
        return (base,)
    if len(parts) == 1:
        return (base, parts[0])
    # OR-Verknüpfung mehrerer Bedingungen: IMAP OR ist binär,
    # daher reduzieren wir nach links: OR a (OR b (OR c d))
    expr = parts[-1]
    for p in reversed(parts[:-1]):
        expr = f"(OR {p} {expr})"
    return (base, expr)


@router.post("/scan")
async def scan(weeks: int = 6, max_count: int = 30, user=Depends(get_current_user)):
    """Scannt alle aktiven IMAP-Postfächer (aus module_mail_inbox_accounts).
    Read-only – markiert auf dem Server NICHTS als gelesen.
    Pro Mail wird zusätzlich `account_id` und `account_label` gespeichert."""
    accounts = await get_active_accounts()
    if not accounts:
        raise HTTPException(500, "Kein aktives IMAP-Postfach konfiguriert.")

    weeks = max(1, min(weeks, 26))
    max_count = max(1, min(max_count, 100))
    since_dt = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    since_str = since_dt.strftime("%d-%b-%Y")

    total_found, total_skipped, total_dup = 0, 0, 0
    per_account = []

    for acc in accounts:
        acc_id = acc["id"]
        acc_label = acc.get("label", "")
        acc_user = acc.get("username", "")
        acc_rules = acc.get("filter_rules") or []
        a_found, a_skipped, a_dup, a_error = 0, 0, 0, ""

        try:
            imap = imaplib.IMAP4_SSL(acc["server"], int(acc.get("port") or 993))
            imap.login(acc_user, acc.get("password", ""))
        except imaplib.IMAP4.error as e:
            a_error = f"Login fehlgeschlagen: {e}"
            per_account.append({
                "account_id": acc_id, "label": acc_label, "username": acc_user,
                "found": 0, "duplicates_skipped": 0, "non_matching_skipped": 0,
                "error": a_error,
            })
            continue
        except Exception as e:  # noqa: BLE001
            a_error = f"Verbindungsfehler: {e}"
            per_account.append({
                "account_id": acc_id, "label": acc_label, "username": acc_user,
                "found": 0, "duplicates_skipped": 0, "non_matching_skipped": 0,
                "error": a_error,
            })
            continue

        try:
            for folder in SEARCH_FOLDERS:
                if a_found >= max_count:
                    break
                try:
                    typ, _ = imap.select(folder, readonly=True)
                    if typ != "OK":
                        continue
                except Exception as fe:  # noqa: BLE001
                    logger.warning(f"mail-inbox[{acc_label}]: Ordner {folder} nicht selektierbar: {fe}")
                    continue

                try:
                    search_args = _build_imap_search_args(since_str, acc_rules)
                    typ, data = imap.search(None, *search_args)
                except imaplib.IMAP4.error:
                    # Fallback: nur SINCE, dafür clientseitig filtern
                    try:
                        typ, data = imap.search(None, f'(SINCE "{since_str}")')
                    except imaplib.IMAP4.error:
                        continue
                if typ != "OK" or not data or not data[0]:
                    continue

                uids = data[0].split()
                uids = uids[-max_count:]
                uids.reverse()
                remaining = max_count - a_found
                uids = uids[:remaining]

                for uid in uids:
                    if a_found >= max_count:
                        break
                    try:
                        typ, raw = imap.fetch(uid, "(RFC822)")
                        if typ != "OK" or not raw or not raw[0]:
                            continue
                        msg = email.message_from_bytes(raw[0][1])

                        from_name, from_email = parseaddr(msg.get("From", ""))
                        subject = _decode(msg.get("Subject", ""))

                        # ── Custom-Filter pro Postfach (OR-Logik) ──
                        if not filter_matches(acc_rules, subject, from_email):
                            a_skipped += 1
                            continue
                        # Sicherheits-Schranke: Jimdo-Mails MÜSSEN tischlerei-graupner.de
                        # im Subject enthalten (sonst Spam-Jimdo-Mails durchlassen)
                        if "no-reply@jimdo.com" in (from_email or "").lower() and SUBJECT_DOMAIN not in (subject or "").lower():
                            a_skipped += 1
                            continue

                        message_id = (msg.get("Message-ID") or "").strip()

                        # 1) Duplikatsprüfung in Haupt-Collection
                        exists = await db.module_mail_inbox.find_one(
                            {"message_id": message_id} if message_id else {"email_uid": f"{folder}/{uid.decode()}"},
                            {"_id": 0, "id": 1},
                        )
                        if exists:
                            a_dup += 1
                            continue

                        # 2) Tombstone-Check
                        if message_id:
                            tomb = await db.module_mail_inbox_deleted.find_one(
                                {"message_id": message_id}, {"_id": 0, "message_id": 1},
                            )
                            if tomb:
                                a_dup += 1
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
                            "account_id": acc_id,
                            "account_label": acc_label,
                            "account_username": acc_user,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                        await db.module_mail_inbox.insert_one(entry)
                        a_found += 1
                    except Exception as e:  # noqa: BLE001
                        logger.warning(f"mail-inbox[{acc_label}] scan: Mail-Fehler {e}")
                        continue

            try:
                imap.close()
            except Exception:
                pass
            try:
                imap.logout()
            except Exception:
                pass
        except Exception as e:  # noqa: BLE001
            a_error = f"Scan-Fehler: {e}"
            try:
                imap.logout()
            except Exception:
                pass

        total_found += a_found
        total_skipped += a_skipped
        total_dup += a_dup
        per_account.append({
            "account_id": acc_id,
            "label": acc_label,
            "username": acc_user,
            "found": a_found,
            "duplicates_skipped": a_dup,
            "non_matching_skipped": a_skipped,
            "error": a_error,
        })

    return {
        "ok": True,
        "found": total_found,
        "duplicates_skipped": total_dup,
        "non_matching_skipped": total_skipped,
        "weeks": weeks,
        "max_count": max_count,
        "accounts_scanned": len(accounts),
        "per_account": per_account,
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



async def _tombstone(entry: dict, user) -> None:
    """Legt einen Tombstone an, damit die Mail beim nächsten Scan
    nicht erneut importiert wird."""
    mid = (entry or {}).get("message_id") or ""
    if not mid:
        return
    await db.module_mail_inbox_deleted.update_one(
        {"message_id": mid},
        {"$set": {
            "message_id": mid,
            "subject": entry.get("subject", ""),
            "from_email": entry.get("from_email", ""),
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": getattr(user, "username", None),
        }},
        upsert=True,
    )


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, user=Depends(get_current_user)):
    """Endgültig löschen: Eintrag raus aus Haupt-Collection, Message-ID
    bleibt als Tombstone erhalten (verhindert Re-Import beim nächsten Scan)."""
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    if entry.get("status") == "übernommen":
        raise HTTPException(400, "Übernommene Einträge können nicht gelöscht werden – stattdessen den Kunden löschen.")
    await _tombstone(entry, user)
    await db.module_mail_inbox.delete_one({"id": entry_id})
    return {"ok": True, "deleted": 1}


@router.post("/delete-all-spam")
async def delete_all_spam(user=Depends(get_current_user)):
    """Alle Einträge mit Status 'spam_verdacht' endgültig löschen.
    Tombstones werden pro Message-ID angelegt."""
    deleted = 0
    async for e in db.module_mail_inbox.find({"status": "spam_verdacht"}, {"_id": 0}):
        await _tombstone(e, user)
        await db.module_mail_inbox.delete_one({"id": e["id"]})
        deleted += 1
    return {"ok": True, "deleted": deleted}



# ───────────────────────── Preview & Manuelle Übernahme ─────────────────────
@router.post("/scan-preview")
async def scan_preview(weeks: int = 6, max_count: int = 100, user=Depends(get_current_user)):
    """Wie /scan, aber speichert NICHTS. Liefert eine Liste aller Mails der
    letzten X Wochen mit `would_match` (Filter trifft) und `would_skip_reason`
    (warum übersprungen). Ralph kann manuell entscheiden welche er importiert.
    """
    accounts = await get_active_accounts()
    if not accounts:
        raise HTTPException(500, "Kein aktives IMAP-Postfach konfiguriert.")

    weeks = max(1, min(weeks, 26))
    max_count = max(1, min(max_count, 200))
    since_dt = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    since_str = since_dt.strftime("%d-%b-%Y")

    items = []  # list of dicts
    per_account_summary = []

    for acc in accounts:
        acc_id = acc["id"]
        acc_label = acc.get("label", "")
        acc_user = acc.get("username", "")
        acc_rules = acc.get("filter_rules") or []
        a_total, a_match, a_skip, a_dup = 0, 0, 0, 0

        try:
            imap = imaplib.IMAP4_SSL(acc["server"], int(acc.get("port") or 993))
            imap.login(acc_user, acc.get("password", ""))
        except Exception as e:  # noqa: BLE001
            per_account_summary.append({
                "account_id": acc_id, "label": acc_label, "username": acc_user,
                "total": 0, "matched": 0, "skipped": 0, "duplicates": 0,
                "error": f"Login: {e}",
            })
            continue

        try:
            for folder in SEARCH_FOLDERS:
                if a_total >= max_count:
                    break
                try:
                    typ, _ = imap.select(folder, readonly=True)
                    if typ != "OK":
                        continue
                except Exception:  # noqa: BLE001
                    continue
                # In Preview-Mode bewusst KEINE Filter-Search → wir sehen ALLES
                try:
                    typ, data = imap.search(None, f'(SINCE "{since_str}")')
                except imaplib.IMAP4.error:
                    continue
                if typ != "OK" or not data or not data[0]:
                    continue
                uids = data[0].split()
                # Neueste zuerst
                uids.reverse()
                remaining = max_count - a_total
                uids = uids[:remaining]

                for uid in uids:
                    if a_total >= max_count:
                        break
                    try:
                        typ, raw = imap.fetch(uid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID REPLY-TO)])")
                        if typ != "OK" or not raw or not raw[0]:
                            continue
                        msg = email.message_from_bytes(raw[0][1])
                        from_name, from_email = parseaddr(msg.get("From", ""))
                        subject = _decode(msg.get("Subject", ""))
                        message_id = (msg.get("Message-ID") or "").strip()
                        date_str = msg.get("Date") or ""
                        try:
                            date_iso = parsedate_to_datetime(date_str).isoformat()
                        except Exception:
                            date_iso = date_str

                        # Filter prüfen
                        match_filter = filter_matches(acc_rules, subject, from_email)
                        skip_reason = ""
                        if not match_filter:
                            skip_reason = "Kein Filter-Treffer"
                        elif "no-reply@jimdo.com" in (from_email or "").lower() and SUBJECT_DOMAIN not in (subject or "").lower():
                            match_filter = False
                            skip_reason = "Jimdo-Mail aber Subject ohne tischlerei-graupner.de"

                        # Schon im Inbox? oder Tombstone?
                        is_dup = False
                        dup_status = ""
                        if message_id:
                            ex = await db.module_mail_inbox.find_one({"message_id": message_id}, {"_id": 0, "status": 1})
                            if ex:
                                is_dup = True
                                dup_status = f"in DB ({ex.get('status', '?')})"
                            else:
                                tomb = await db.module_mail_inbox_deleted.find_one({"message_id": message_id}, {"_id": 0})
                                if tomb:
                                    is_dup = True
                                    dup_status = "Tombstone (zuvor gelöscht)"

                        items.append({
                            "account_id": acc_id,
                            "account_label": acc_label,
                            "folder": folder,
                            "uid": uid.decode(),
                            "message_id": message_id,
                            "from_name": _decode(from_name),
                            "from_email": from_email,
                            "subject": subject,
                            "date": date_iso,
                            "would_match": bool(match_filter),
                            "skip_reason": skip_reason,
                            "is_duplicate": is_dup,
                            "duplicate_status": dup_status,
                        })
                        a_total += 1
                        if is_dup:
                            a_dup += 1
                        elif match_filter:
                            a_match += 1
                        else:
                            a_skip += 1
                    except Exception:  # noqa: BLE001
                        continue
            try:
                imap.close()
            except Exception:
                pass
            try:
                imap.logout()
            except Exception:
                pass
        except Exception as e:  # noqa: BLE001
            try:
                imap.logout()
            except Exception:
                pass
            per_account_summary.append({
                "account_id": acc_id, "label": acc_label, "username": acc_user,
                "total": a_total, "matched": a_match, "skipped": a_skip,
                "duplicates": a_dup, "error": str(e),
            })
            continue

        per_account_summary.append({
            "account_id": acc_id, "label": acc_label, "username": acc_user,
            "total": a_total, "matched": a_match, "skipped": a_skip,
            "duplicates": a_dup, "error": "",
        })

    # nach Datum absteigend sortieren
    def _date_key(d):
        try:
            return parsedate_to_datetime(d.get("date") or "").isoformat()
        except Exception:
            return d.get("date") or ""
    items.sort(key=_date_key, reverse=True)

    return {
        "ok": True,
        "count": len(items),
        "items": items,
        "per_account": per_account_summary,
        "weeks": weeks,
    }


@router.post("/import-mail")
async def import_mail(body: dict, user=Depends(get_current_user)):
    """Importiert eine Mail manuell (auch wenn der Filter sie übersprungen hätte).
    body = {account_id, folder, uid}
    """
    acc_id = (body or {}).get("account_id", "")
    folder = (body or {}).get("folder", "")
    uid = (body or {}).get("uid", "")
    if not (acc_id and folder and uid):
        raise HTTPException(400, "account_id, folder und uid sind Pflicht.")

    accounts = await get_active_accounts()
    acc = next((a for a in accounts if a["id"] == acc_id), None)
    if not acc:
        raise HTTPException(404, "Postfach nicht gefunden oder nicht aktiv.")

    try:
        imap = imaplib.IMAP4_SSL(acc["server"], int(acc.get("port") or 993))
        imap.login(acc["username"], acc.get("password", ""))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"IMAP-Login fehlgeschlagen: {e}")

    try:
        typ, _ = imap.select(folder, readonly=True)
        if typ != "OK":
            raise HTTPException(404, f"Ordner '{folder}' nicht öffenbar.")
        typ, raw = imap.fetch(uid.encode() if isinstance(uid, str) else uid, "(RFC822)")
        if typ != "OK" or not raw or not raw[0]:
            raise HTTPException(404, "Mail (UID) nicht gefunden.")
        msg = email.message_from_bytes(raw[0][1])

        from_name, from_email = parseaddr(msg.get("From", ""))
        subject = _decode(msg.get("Subject", ""))
        message_id = (msg.get("Message-ID") or "").strip()

        # Duplikat?
        if message_id:
            ex = await db.module_mail_inbox.find_one({"message_id": message_id}, {"_id": 0, "id": 1})
            if ex:
                raise HTTPException(409, "Diese Mail ist bereits in der Anfragen-Liste.")
            tomb = await db.module_mail_inbox_deleted.find_one({"message_id": message_id}, {"_id": 0})
            if tomb:
                # Tombstone entfernen, da bewusst manuell importiert
                await db.module_mail_inbox_deleted.delete_one({"message_id": message_id})

        body_text = _extract_body(msg)
        parsed = parse_anfrage(body_text, subject=subject, from_email=from_email)

        reply_to = ""
        rt_raw = msg.get("Reply-To") or ""
        if rt_raw:
            _, reply_to = parseaddr(rt_raw)
        if not parsed.get("email") and reply_to and "@" in reply_to:
            parsed["email"] = reply_to
        if not parsed.get("email") and from_email and "@" in from_email and "jimdo.com" not in from_email.lower():
            parsed["email"] = from_email

        spam = evaluate_spam(parsed, body_excerpt=body_text, from_email=from_email)
        # Manuell importiert → wir trauen Ralph, kein automatisches Spam-Verdacht
        initial_status = "vorschlag"

        received_at_iso = ""
        d = msg.get("Date")
        if d:
            try:
                received_at_iso = parsedate_to_datetime(d).isoformat()
            except Exception:
                received_at_iso = d

        entry = {
            "id": str(uuid.uuid4()),
            "email_uid": f"{folder}/{uid}",
            "message_id": message_id,
            "folder": folder,
            "from_email": from_email,
            "from_name": _decode(from_name),
            "reply_to": reply_to,
            "subject": subject,
            "received_at": received_at_iso,
            "body_excerpt": (body_text or "")[:2000],
            "parsed": parsed,
            "spam": spam,
            "status": initial_status,
            "account_id": acc_id,
            "account_label": acc.get("label", ""),
            "account_username": acc.get("username", ""),
            "manual_import": True,
            "manual_import_by": getattr(user, "username", None),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.module_mail_inbox.insert_one(entry)
        try:
            imap.close()
        except Exception:
            pass
        try:
            imap.logout()
        except Exception:
            pass
        return {"ok": True, "id": entry["id"], "subject": subject}
    except HTTPException:
        try:
            imap.logout()
        except Exception:
            pass
        raise
    except Exception as e:  # noqa: BLE001
        try:
            imap.logout()
        except Exception:
            pass
        raise HTTPException(500, f"Import fehlgeschlagen: {e}")
