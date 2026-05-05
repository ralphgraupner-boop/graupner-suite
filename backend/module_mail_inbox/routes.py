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
from .parser import parse_anfrage, is_complete_form, MIN_COMPLETENESS, COMPLETENESS_FIELDS
from .spam_filter import evaluate_spam
from .accounts import get_active_accounts, filter_matches, _is_reply_or_auto

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
    - Wenn IRGENDEIN Regel-Wert nicht-ASCII ist (Umlaute etc.) → fallback auf
      reines SINCE und alle Mails holen, clientseitig filtern. So gehen
      keine Treffer verloren weil imaplib keine Umlaute kann.
    - Sonst: gezielte IMAP-Search aus den ASCII-Rules (schneller).
    """
    has_non_ascii = any(
        not _is_ascii((r.get("value") or "")) for r in (rules or [])
    )
    base = f'(SINCE "{since_str}")'
    if has_non_ascii or not rules:
        return (base,)
    parts = []
    for r in rules:
        t = (r.get("type") or "").strip()
        v = (r.get("value") or "").strip()
        if not t or not v:
            continue
        v_safe = v.replace('"', '')
        if t in ("subject_contains", "subject_startswith"):
            parts.append(f'(SUBJECT "{v_safe}")')
        elif t in ("from_contains", "from_equals"):
            parts.append(f'(FROM "{v_safe}")')
    if not parts:
        return (base,)
    if len(parts) == 1:
        return (base, parts[0])
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

                        # Vollständigkeitsprüfung: ein echtes Kontaktformular hat
                        # mindestens MIN_COMPLETENESS gefüllte Felder.
                        # Spart uns Mails wie "Anfrage" mit nur 1 Zeile Text.
                        complete_ok, filled_count = is_complete_form(parsed)
                        if not complete_ok:
                            a_skipped += 1
                            logger.info(
                                f"mail-inbox[{acc_label}]: übersprungen (nur {filled_count}/{len(COMPLETENESS_FIELDS)} Felder ausgefüllt) – {subject!r}"
                            )
                            continue

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


@router.get("/stats")
async def stats(days: int = 30, user=Depends(get_current_user)):
    """Statistik pro Postfach (account_label):
    Anzahl Mails der letzten N Tage, aufgeteilt nach Status.
    Gibt zusätzlich Conversion-Rate (übernommen / gesamt) zurück."""
    days = max(1, min(days, 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {
            "_id": {"label": {"$ifNull": ["$account_label", "(unbekannt)"]}},
            "total": {"$sum": 1},
            "uebernommen": {"$sum": {"$cond": [{"$eq": ["$status", "übernommen"]}, 1, 0]}},
            "vorschlag": {"$sum": {"$cond": [{"$eq": ["$status", "vorschlag"]}, 1, 0]}},
            "ignoriert": {"$sum": {"$cond": [{"$eq": ["$status", "ignoriert"]}, 1, 0]}},
            "spam_verdacht": {"$sum": {"$cond": [{"$eq": ["$status", "spam_verdacht"]}, 1, 0]}},
            "manuell_importiert": {"$sum": {"$cond": [{"$eq": ["$manual_import", True]}, 1, 0]}},
        }},
        {"$sort": {"total": -1}},
    ]

    by_account = []
    grand = {"total": 0, "uebernommen": 0, "vorschlag": 0, "ignoriert": 0, "spam_verdacht": 0, "manuell_importiert": 0}
    async for d in db.module_mail_inbox.aggregate(pipeline):
        label = d["_id"].get("label") or "(unbekannt)"
        total = d.get("total", 0)
        uebernommen = d.get("uebernommen", 0)
        conv = round((uebernommen / total) * 100, 1) if total else 0.0
        item = {
            "label": label,
            "total": total,
            "uebernommen": uebernommen,
            "vorschlag": d.get("vorschlag", 0),
            "ignoriert": d.get("ignoriert", 0),
            "spam_verdacht": d.get("spam_verdacht", 0),
            "manuell_importiert": d.get("manuell_importiert", 0),
            "conversion_pct": conv,
        }
        by_account.append(item)
        for k in list(grand.keys()):
            grand[k] += d.get(k, 0)

    grand_conv = round((grand["uebernommen"] / grand["total"]) * 100, 1) if grand["total"] else 0.0
    grand["conversion_pct"] = grand_conv

    return {
        "ok": True,
        "days": days,
        "since": since,
        "total": grand,
        "by_account": by_account,
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
async def accept(entry_id: str, body: dict | None = None, user=Depends(get_current_user)):
    """Übernimmt eine Mail-Anfrage als neuen Kunden.
    Optional darf der Frontend-Body folgende Felder überschreiben/ergänzen:
      vorname, nachname, anrede, email, phone (= telefon), strasse, plz, ort,
      anliegen (Beschreibung), bemerkung, kontakt_status, customer_type, kategorie
    """
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    if entry.get("status") == "übernommen":
        raise HTTPException(400, "Bereits übernommen")
    parsed = entry.get("parsed") or {}
    body = body or {}

    def _pick(field_in_body: str, fallback: str = "") -> str:
        v = body.get(field_in_body)
        return v.strip() if isinstance(v, str) and v.strip() else fallback

    new_kunde_id = str(uuid.uuid4())
    vorname = _pick("vorname", parsed.get("vorname", ""))
    nachname = _pick("nachname", parsed.get("nachname", ""))
    anrede = _pick("anrede", parsed.get("anrede", ""))
    full_name = " ".join(p for p in [vorname, nachname] if p).strip()

    new_kunde = {
        "id": new_kunde_id,
        "anrede": anrede,
        "vorname": vorname,
        "nachname": nachname,
        "name": full_name or entry.get("from_name", ""),
        "email": _pick("email", parsed.get("email") or entry.get("reply_to", "") or ""),
        "phone": _pick("phone", parsed.get("telefon", "")),
        "strasse": _pick("strasse", parsed.get("strasse", "")),
        "plz": _pick("plz", parsed.get("plz", "")),
        "ort": _pick("ort", parsed.get("ort", "")),
        "kontakt_status": _pick("kontakt_status", "Anfrage"),
        "customer_type": _pick("customer_type", "Privat"),
        "quelle": _pick("quelle", "Jimdo Kontaktformular"),
        "anliegen": _pick("anliegen", parsed.get("nachricht", "")),
        "bemerkung": _pick("bemerkung", ""),
        "categories": body.get("categories") if isinstance(body.get("categories"), list) else [],
        "source_url": parsed.get("source_url", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": getattr(user, "username", "system") if not isinstance(user, dict) else (user.get("username") or "system"),
        "imported_from_mail_id": entry_id,
    }
    await db.module_kunden.insert_one(new_kunde)

    await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {
            "status": "übernommen",
            "kunde_id": new_kunde_id,
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": user.get("username") if isinstance(user, dict) else getattr(user, "username", None),
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


@router.post("/preview-delete")
async def preview_delete(body: dict, user=Depends(get_current_user)):
    """Lösch-Aktion aus der „Übersprungene anzeigen"-Vorschau.
    Erwartet: { message_id, subject?, from_email? }
    Wirkung:
      - Tombstone für die message_id wird angelegt → nie wieder importiert
      - Falls die Mail doch schon in der Haupt-Collection liegt
        (z.B. zuvor manuell importiert), wird sie zusätzlich entfernt.
    """
    mid = (body or {}).get("message_id") or ""
    if not mid:
        raise HTTPException(400, "message_id erforderlich")
    subject = (body or {}).get("subject", "")
    from_email = (body or {}).get("from_email", "")
    now = datetime.now(timezone.utc).isoformat()
    await db.module_mail_inbox_deleted.update_one(
        {"message_id": mid},
        {"$set": {
            "message_id": mid,
            "subject": subject,
            "from_email": from_email,
            "deleted_at": now,
            "deleted_by": getattr(user, "username", None),
            "source": "preview-delete",
        }},
        upsert=True,
    )
    removed = 0
    existing = await db.module_mail_inbox.find_one({"message_id": mid}, {"_id": 0, "id": 1, "status": 1})
    if existing and existing.get("status") != "übernommen":
        r = await db.module_mail_inbox.delete_one({"message_id": mid})
        removed = r.deleted_count
    return {"ok": True, "tombstoned": True, "removed_from_db": removed}


@router.post("/preview-bulk-delete")
async def preview_bulk_delete(body: dict, user=Depends(get_current_user)):
    """Massen-Lösch-Aktion: legt für eine Liste von message_ids Tombstones an.
    Erwartet: { items: [{message_id, subject?, from_email?}, ...] }
    Skipt Mails ohne message_id (kann nicht permanent ignoriert werden).
    Skipt bereits übernommene Einträge (würde Kunden-Verknüpfung trennen).
    """
    items = (body or {}).get("items") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(400, "items (Liste) erforderlich")
    now = datetime.now(timezone.utc).isoformat()
    user_name = getattr(user, "username", None)
    tombstoned, skipped_no_mid, removed = 0, 0, 0
    for it in items:
        if not isinstance(it, dict):
            continue
        mid = (it.get("message_id") or "").strip()
        if not mid:
            skipped_no_mid += 1
            continue
        await db.module_mail_inbox_deleted.update_one(
            {"message_id": mid},
            {"$set": {
                "message_id": mid,
                "subject": it.get("subject", ""),
                "from_email": it.get("from_email", ""),
                "deleted_at": now,
                "deleted_by": user_name,
                "source": "preview-bulk-delete",
            }},
            upsert=True,
        )
        tombstoned += 1
        existing = await db.module_mail_inbox.find_one({"message_id": mid}, {"_id": 0, "id": 1, "status": 1})
        if existing and existing.get("status") != "übernommen":
            r = await db.module_mail_inbox.delete_one({"message_id": mid})
            removed += r.deleted_count
    return {
        "ok": True,
        "tombstoned": tombstoned,
        "skipped_no_message_id": skipped_no_mid,
        "removed_from_db": removed,
    }




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

                        # Reply-/Forward-/Auto-Response-Mails tauchen hier GAR NICHT auf.
                        # Das sind per Definition keine neuen Anfragen und würden
                        # die "Übersprungene"-Liste unbrauchbar zumüllen.
                        if _is_reply_or_auto(subject):
                            continue

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



# ───────────────── Mail-Detail ansehen ─────────────────
@router.post("/reevaluate-spam")
async def reevaluate_spam(user=Depends(get_current_user)):
    """Bewertet alle vorhandenen Mails neu mit dem aktuellen Parser + Spam-Filter.
    - Re-parst body_excerpt mit aktueller Parser-Logik (z.B. neue Jimdo-Formate)
    - Re-evaluiert Spam-Score
    - Mails die übernommen sind bleiben in der DB, ihre `parsed`-Felder werden
      aber aktualisiert (z.B. damit Anrede/Telefon nachträglich korrekt sind).
    - Status (vorschlag ↔ spam_verdacht) wird aktualisiert. Übernommen/Ignoriert
      bleibt unverändert."""
    moved_to_vorschlag = 0
    moved_to_spam = 0
    reparsed = 0
    async for d in db.module_mail_inbox.find(
        {},
        {"_id": 0, "id": 1, "parsed": 1, "body_excerpt": 1, "from_email": 1, "status": 1, "subject": 1},
    ):
        new_parsed = parse_anfrage(
            d.get("body_excerpt") or "",
            subject=d.get("subject") or "",
            from_email=d.get("from_email") or "",
        )
        # Reply-To-Fallback wie beim Scan
        if not new_parsed.get("email") and d.get("from_email") and "jimdo" not in (d.get("from_email") or "").lower():
            new_parsed["email"] = d.get("from_email")
        new_spam = evaluate_spam(new_parsed, body_excerpt=d.get("body_excerpt") or "", from_email=d.get("from_email") or "")
        update = {"parsed": new_parsed, "spam": new_spam}
        # Status nur bei vorschlag/spam_verdacht ändern, nicht bei übernommen/ignoriert
        if d.get("status") in ("vorschlag", "spam_verdacht"):
            new_status = "spam_verdacht" if new_spam["is_spam"] else "vorschlag"
            if new_status != d.get("status"):
                update["status"] = new_status
                if new_status == "vorschlag":
                    moved_to_vorschlag += 1
                else:
                    moved_to_spam += 1
        await db.module_mail_inbox.update_one({"id": d["id"]}, {"$set": update})
        reparsed += 1
    return {
        "ok": True,
        "reparsed": reparsed,
        "moved_to_vorschlag": moved_to_vorschlag,
        "moved_to_spam": moved_to_spam,
    }


@router.post("/mail-detail")
async def mail_detail(body: dict, user=Depends(get_current_user)):
    """Lädt eine konkrete IMAP-Mail (Body + Header) zur Anzeige.
    body = {account_id, folder, uid}. Read-only."""
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
        typ, raw = imap.fetch(uid.encode() if isinstance(uid, str) else uid, "(BODY.PEEK[])")
        if typ != "OK" or not raw or not raw[0]:
            raise HTTPException(404, "Mail (UID) nicht gefunden.")
        msg = email.message_from_bytes(raw[0][1])

        from_name, from_email = parseaddr(msg.get("From", ""))
        to_name, to_email = parseaddr(msg.get("To", ""))
        reply_to = ""
        rt_raw = msg.get("Reply-To") or ""
        if rt_raw:
            _, reply_to = parseaddr(rt_raw)
        subject = _decode(msg.get("Subject", ""))
        date_str = msg.get("Date") or ""
        try:
            date_iso = parsedate_to_datetime(date_str).isoformat()
        except Exception:
            date_iso = date_str

        body_text = _extract_body(msg) or ""
        return {
            "ok": True,
            "subject": subject,
            "from_name": _decode(from_name),
            "from_email": from_email,
            "to_email": to_email,
            "reply_to": reply_to,
            "date": date_iso,
            "body": body_text[:50000],  # Sicherung gegen Riesen-Mails
            "account_label": acc.get("label", ""),
            "folder": folder,
            "uid": uid if isinstance(uid, str) else uid.decode(),
        }
    finally:
        try:
            imap.close()
        except Exception:
            pass
        try:
            imap.logout()
        except Exception:
            pass


# ───────────────── Mailverlauf eines Kunden ─────────────────
@router.post("/customer-mails")
async def customer_mails(body: dict, user=Depends(get_current_user)):
    """Sucht in allen aktiven IMAP-Postfächern nach Mails eines Kunden
    (From/To/CC enthält die Mail-Adresse). Gibt max. 30 Header-Einträge zurück.
    body = {email, max_count?: 30, weeks?: 26}"""
    customer_email = ((body or {}).get("email") or "").strip().lower()
    if not customer_email or "@" not in customer_email:
        raise HTTPException(400, "Gültige Email-Adresse erforderlich.")
    max_count = max(1, min(int((body or {}).get("max_count") or 30), 100))
    weeks = max(1, min(int((body or {}).get("weeks") or 26), 52))

    accounts = await get_active_accounts()
    if not accounts:
        return {"ok": True, "items": [], "count": 0, "message": "Kein aktives Postfach."}

    since_dt = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    since_str = since_dt.strftime("%d-%b-%Y")
    items = []

    # Alle relevanten Ordner durchsuchen (INBOX + gesendet)
    SEARCH_BOXES = ["INBOX", '"INBOX.Sent"', '"Sent"', '"INBOX.Sent Items"', '"INBOX.anfrage von"']

    for acc in accounts:
        if len(items) >= max_count:
            break
        try:
            imap = imaplib.IMAP4_SSL(acc["server"], int(acc.get("port") or 993))
            imap.login(acc["username"], acc.get("password", ""))
        except Exception:  # noqa: BLE001
            continue

        try:
            for folder in SEARCH_BOXES:
                if len(items) >= max_count:
                    break
                try:
                    typ, _ = imap.select(folder, readonly=True)
                    if typ != "OK":
                        continue
                except Exception:
                    continue
                try:
                    typ, data = imap.search(
                        None,
                        f'(SINCE "{since_str}")',
                        f'(OR (OR (FROM "{customer_email}") (TO "{customer_email}")) (CC "{customer_email}"))',
                    )
                except imaplib.IMAP4.error:
                    continue
                if typ != "OK" or not data or not data[0]:
                    continue
                uids = data[0].split()
                uids.reverse()
                uids = uids[: max_count - len(items)]
                for uid in uids:
                    try:
                        typ, raw = imap.fetch(uid, "(BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])")
                        if typ != "OK" or not raw or not raw[0]:
                            continue
                        m = email.message_from_bytes(raw[0][1])
                        f_name, f_email = parseaddr(m.get("From", ""))
                        t_name, t_email = parseaddr(m.get("To", ""))
                        subj = _decode(m.get("Subject", ""))
                        d = m.get("Date") or ""
                        try:
                            d_iso = parsedate_to_datetime(d).isoformat()
                        except Exception:
                            d_iso = d
                        # Richtung erkennen
                        direction = "ein"
                        if customer_email in (f_email or "").lower():
                            direction = "ein"
                        elif customer_email in (t_email or "").lower():
                            direction = "aus"
                        items.append({
                            "account_id": acc["id"],
                            "account_label": acc.get("label", ""),
                            "folder": folder,
                            "uid": uid.decode(),
                            "subject": subj,
                            "from_name": _decode(f_name),
                            "from_email": f_email,
                            "to_email": t_email,
                            "date": d_iso,
                            "direction": direction,
                        })
                        if len(items) >= max_count:
                            break
                    except Exception:
                        continue
            try:
                imap.close()
            except Exception:
                pass
            try:
                imap.logout()
            except Exception:
                pass
        except Exception:
            try:
                imap.logout()
            except Exception:
                pass

    # Nach Datum absteigend
    def _key(d):
        try:
            return parsedate_to_datetime(d.get("date") or "").isoformat()
        except Exception:
            return d.get("date") or ""
    items.sort(key=_key, reverse=True)

    return {"ok": True, "count": len(items), "items": items[:max_count], "limit": max_count}
