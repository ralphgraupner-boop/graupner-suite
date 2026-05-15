"""Geteilte Helfer + Konstanten für module_mail_inbox-Routen."""
import re
import hashlib
from email.header import decode_header
from datetime import datetime, timezone

from database import db

# Strenger Filter: nur Kontaktformular-Mails
JIMDO_FROM_PATTERN = re.compile(r"no-reply@jimdo\.com", re.IGNORECASE)
SUBJECT_DOMAIN = "tischlerei-graupner.de"
ALT_SUBJECT_PATTERN = re.compile(r"Anfrage\s+von\s+", re.IGNORECASE)
# Jimdo-Variante: Betreff wie "Nachricht über https://www.tischlerei-graupner.de/..."
NACHRICHT_UEBER_PATTERN = re.compile(r"Nachricht\s+über\s+https?://", re.IGNORECASE)

# Postfächer in denen wir suchen (Inbox UND der Filter-Ordner für Anfragen)
SEARCH_FOLDERS = ["INBOX", '"INBOX.anfrage von"']


def _content_hash(parsed: dict) -> str:
    """Stabiler Inhalts-Hash für Re-Send-Duplikatserkennung.

    Wird aus normalisierten Feldern gebildet, sodass dieselbe Anfrage –
    auch wenn sie mit neuer Message-ID erneut zugestellt wird oder über
    ein zweites Postfach reinkommt – als Duplikat erkannt wird.

    Liefert "" wenn zu wenige Felder befüllt sind (dann keine Hash-Prüfung,
    fallback auf Message-ID-Prüfung).
    """
    em = (parsed.get("email") or "").strip().lower()
    nach = re.sub(r"\s+", " ", (parsed.get("nachricht") or "").strip().lower())[:200]
    tel = re.sub(r"\D+", "", (parsed.get("telefon") or ""))
    if not (em and nach):
        return ""
    raw = f"{em}|{nach}|{tel}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

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

def _normalize_phone(p: str) -> str:
    """Normalisiert Telefon für Duplikatsvergleich: nur Ziffern, führende 0 → +49."""
    if not p:
        return ""
    digits = re.sub(r"\D+", "", p)
    if not digits:
        return ""
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = "49" + digits[1:]
    return digits


async def _find_kunde_duplicates(email: str, phone: str) -> list[dict]:
    """Sucht in module_kunden nach Treffern per E-Mail (case-insensitive)
    oder Telefon (normalisiert). Liefert max. 5 Treffer mit Kerndaten."""
    matches: dict[str, dict] = {}
    em = (email or "").strip().lower()
    if em:
        async for k in db.module_kunden.find(
            {"email": {"$regex": f"^{re.escape(em)}$", "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "kontakt_status": 1, "created_at": 1, "nachricht": 1},
        ).limit(5):
            matches[k["id"]] = {**k, "match_reason": "email"}
    ph_norm = _normalize_phone(phone)
    if ph_norm:
        async for k in db.module_kunden.find(
            {"phone": {"$exists": True, "$ne": ""}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "kontakt_status": 1, "created_at": 1, "nachricht": 1},
        ).limit(50):
            if _normalize_phone(k.get("phone", "")) == ph_norm:
                if k["id"] in matches:
                    matches[k["id"]]["match_reason"] = "email+phone"
                else:
                    matches[k["id"]] = {**k, "match_reason": "phone"}
                if len(matches) >= 5:
                    break
    return list(matches.values())

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
