"""Lese-Routen für module_mail_inbox: Liste, Stats, Detail, Customer-Mails."""
import imaplib
import email
from email.utils import parseaddr, parsedate_to_datetime
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from database import db, logger
from routes.auth import get_current_user
from routes.anfragen_fetcher import _extract_body
from .accounts import get_active_accounts
from .helpers import _decode

router = APIRouter()


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
    # Keyword-Priorisierung (additiv): Helfer aus routes.anfragen wiederverwenden, nicht kopieren
    from routes.anfragen import _load_keyword_config, _stufe_of, _STUFE_RANK
    config = await _load_keyword_config()
    for d in items:
        d["prioritaet_stufe"] = _stufe_of(_mail_suchtext(d), config)
    # items sind bereits received_at desc -> stabile Sortierung nach Stufe (Rot oben) genügt
    items.sort(key=lambda x: _STUFE_RANK.get(x.get("prioritaet_stufe"), 9))
    return items


def _mail_suchtext(d: dict) -> str:
    """Durchsuchbarer Text eines Mail-Inbox-Eintrags (Subject + Auszug + geparste Felder)."""
    parsed = d.get("parsed") or {}
    parts = [
        d.get("subject"), d.get("body_excerpt"), d.get("from_name"),
        parsed.get("nachricht"), parsed.get("vorname"), parsed.get("nachname"),
        parsed.get("strasse"), parsed.get("ort"),
    ]
    return " ".join([str(p) for p in parts if p])


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
