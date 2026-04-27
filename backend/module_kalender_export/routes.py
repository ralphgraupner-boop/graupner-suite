"""Routes für module_kalender_export."""
import secrets
from uuid import uuid4
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from database import db, logger
from routes.auth import get_current_user
from utils import send_email
from .ics_generator import build_ics_event, build_ics_calendar

router = APIRouter()


# ==================== MODELS ====================

class SendRequest(BaseModel):
    sachbearbeiter: bool = True             # Mail an eingeloggten User selbst
    mitarbeiter_usernames: List[str] = []   # Mehrfachauswahl Mitarbeiter
    auch_kunde: bool = False                # Mail an verknüpften Kunden (kunde_id)
    externe_mails: List[str] = []           # zusätzliche freie E-Mail-Adressen


# ==================== HELPERS ====================

async def _get_user_email(username: str) -> Optional[str]:
    u = await db.users.find_one({"username": username}, {"_id": 0, "email": 1})
    return (u or {}).get("email") if u else None


async def _get_user_display(username: str) -> str:
    u = await db.users.find_one({"username": username}, {"_id": 0, "vorname": 1, "nachname": 1})
    if not u:
        return username
    n = f"{u.get('vorname','')} {u.get('nachname','')}".strip()
    return n or username


async def _get_kunde(kunde_id: str) -> Optional[dict]:
    if not kunde_id:
        return None
    return await db.module_kunden.find_one(
        {"id": kunde_id},
        {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1, "firma": 1,
         "email": 1, "phone": 1, "strasse": 1, "hausnummer": 1, "plz": 1, "ort": 1},
    )


def _kunde_name(kunde: dict) -> str:
    if not kunde:
        return ""
    return (
        f"{kunde.get('vorname','')} {kunde.get('nachname','')}".strip()
        or kunde.get("name", "")
        or kunde.get("firma", "")
        or "Kunde"
    )


def _kunde_address(kunde: dict) -> str:
    if not kunde:
        return ""
    return " ".join([
        f"{kunde.get('strasse','')} {kunde.get('hausnummer','')}".strip(),
        f"{kunde.get('plz','')} {kunde.get('ort','')}".strip(),
    ]).strip()


# ==================== AUDIT-LOG ====================

async def _log_send(termin_id: str, recipients: list, by_user: str, ok: bool, error: str = ""):
    await db.module_kalender_export_log.insert_one({
        "id": str(uuid4()),
        "termin_id": termin_id,
        "recipients": recipients,
        "sent_by": by_user,
        "ok": ok,
        "error": error,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ==================== ENDPOINTS ====================

@router.get("/termin/{termin_id}/preview-recipients")
async def preview_recipients(termin_id: str, user=Depends(get_current_user)):
    """Welche Empfänger sind bei diesem Termin verfügbar (für UI-Auswahl)?"""
    termin = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not termin:
        raise HTTPException(404, "Termin nicht gefunden")

    sachbearbeiter_email = await _get_user_email((user or {}).get("username", ""))
    monteur_email = None
    if termin.get("monteur_username"):
        monteur_email = await _get_user_email(termin["monteur_username"])

    kunde = await _get_kunde(termin.get("kunde_id", ""))

    # Mitarbeiter-Liste (alle aktiven User außer Sachbearbeiter selbst)
    mit = []
    async for u in db.users.find({"active": {"$ne": False}}, {"_id": 0, "username": 1, "vorname": 1, "nachname": 1, "email": 1, "role": 1}):
        if u.get("username") == (user or {}).get("username"):
            continue
        mit.append({
            "username": u.get("username", ""),
            "anzeige_name": f"{u.get('vorname','')} {u.get('nachname','')}".strip() or u.get("username", ""),
            "email": u.get("email", ""),
            "role": u.get("role", ""),
        })

    return {
        "termin_id": termin_id,
        "sachbearbeiter": {
            "username": (user or {}).get("username", ""),
            "email": sachbearbeiter_email or "",
        },
        "monteur": {
            "username": termin.get("monteur_username", ""),
            "email": monteur_email or "",
        } if termin.get("monteur_username") else None,
        "kunde": {
            "id": (kunde or {}).get("id", ""),
            "name": _kunde_name(kunde) if kunde else "",
            "email": (kunde or {}).get("email", ""),
        } if kunde else None,
        "mitarbeiter_verfuegbar": mit,
    }


@router.get("/termin/{termin_id}/preview-ics")
async def preview_ics(termin_id: str, user=Depends(get_current_user)):
    """ICS-Vorschau (zum Herunterladen oder Test)."""
    termin = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not termin:
        raise HTTPException(404, "Termin nicht gefunden")
    kunde = await _get_kunde(termin.get("kunde_id", ""))
    organizer_email = await _get_user_email((user or {}).get("username", "")) or "noreply@graupner.local"

    ics = build_ics_event(termin, kunde, organizer_email=organizer_email)
    return Response(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="termin-{termin_id}.ics"'},
    )


@router.post("/termin/{termin_id}/send")
async def send_termin(termin_id: str, payload: SendRequest, user=Depends(get_current_user)):
    """Sendet ICS-Mail an alle ausgewählten Empfänger und markiert Termin als 'im_kalender'."""
    termin = await db.module_termine.find_one({"id": termin_id}, {"_id": 0})
    if not termin:
        raise HTTPException(404, "Termin nicht gefunden")

    sachbearbeiter = (user or {}).get("username", "")
    sachbearbeiter_email = await _get_user_email(sachbearbeiter)

    # Empfängerliste zusammenstellen
    recipients = []
    if payload.sachbearbeiter and sachbearbeiter_email:
        recipients.append({"name": await _get_user_display(sachbearbeiter), "email": sachbearbeiter_email, "role": "Sachbearbeiter"})

    for un in (payload.mitarbeiter_usernames or []):
        em = await _get_user_email(un)
        if em:
            recipients.append({"name": await _get_user_display(un), "email": em, "role": "Mitarbeiter"})

    kunde = await _get_kunde(termin.get("kunde_id", ""))
    if payload.auch_kunde and kunde and kunde.get("email"):
        recipients.append({"name": _kunde_name(kunde), "email": kunde["email"], "role": "Kunde"})

    for em in (payload.externe_mails or []):
        em = (em or "").strip()
        if "@" in em:
            recipients.append({"name": em, "email": em, "role": "Extern"})

    # Duplikate entfernen (gleiche Mail)
    seen = set()
    unique_recipients = []
    for r in recipients:
        key = r["email"].lower()
        if key not in seen:
            unique_recipients.append(r)
            seen.add(key)

    if not unique_recipients:
        raise HTTPException(400, "Keine Empfänger ausgewählt oder keine E-Mail-Adressen verfügbar")

    organizer_email = sachbearbeiter_email or "noreply@graupner.local"
    ics_content = build_ics_event(termin, kunde, organizer_email=organizer_email, organizer_name=await _get_user_display(sachbearbeiter))
    ics_bytes = ics_content.encode("utf-8")

    # Body bauen (HTML)
    when = termin.get("start", "")
    addr = (termin.get("ort") or _kunde_address(kunde)).strip()
    maps_url = f"https://www.google.com/maps/dir/?api=1&destination={addr.replace(' ', '+')}" if addr else ""
    kunde_phone = (kunde or {}).get("phone", "")

    sent_ok = []
    sent_fail = []
    for r in unique_recipients:
        body = f"""
<html><body style='font-family:Arial,sans-serif;max-width:600px'>
<h2 style='color:#16a34a'>📅 Terminvorschlag</h2>
<p>Hallo <strong>{r['name']}</strong>,</p>
<p>folgender Termin ist für dich relevant. Im Anhang findest du eine Kalenderdatei (.ics) – einfach öffnen, dann landet der Termin in deinem Kalender (Google, Outlook, Apple, Thunderbird).</p>

<table style='border-collapse:collapse;margin:16px 0'>
  <tr><td style='padding:6px;font-weight:bold'>Titel:</td><td style='padding:6px'>{termin.get('titel','')}</td></tr>
  <tr><td style='padding:6px;font-weight:bold'>Wann:</td><td style='padding:6px'>{when}{(' – ' + termin.get('ende','')) if termin.get('ende') else ''}</td></tr>
  {f"<tr><td style='padding:6px;font-weight:bold'>Wo:</td><td style='padding:6px'>{addr}{f' (<a href={maps_url}>Route in Google Maps</a>)' if maps_url else ''}</td></tr>" if addr else ''}
  {f"<tr><td style='padding:6px;font-weight:bold'>Kunde:</td><td style='padding:6px'>{_kunde_name(kunde)}{f' – Tel.: {kunde_phone}' if kunde_phone else ''}</td></tr>" if kunde else ''}
  {f"<tr><td style='padding:6px;font-weight:bold'>Beschreibung:</td><td style='padding:6px;white-space:pre-wrap'>{termin.get('beschreibung','')}</td></tr>" if termin.get('beschreibung') else ''}
</table>

<p style='margin-top:24px;color:#666;font-size:12px'>
Gesendet von Tischlerei R. Graupner – Graupner Suite<br>
Veranstalter: {await _get_user_display(sachbearbeiter)} ({organizer_email})
</p>
</body></html>
"""
        try:
            send_email(
                to_email=r["email"],
                subject=f"📅 Terminvorschlag: {termin.get('titel','')}{(' – ' + when[:16]) if when else ''}",
                body_html=body,
                attachments=[{"filename": "termin.ics", "data": ics_bytes}],
            )
            sent_ok.append(r["email"])
        except Exception as e:
            logger.error(f"Termin-Mail an {r['email']} fehlgeschlagen: {e}")
            sent_fail.append({"email": r["email"], "error": str(e)})

    await _log_send(
        termin_id=termin_id,
        recipients=[{"email": r["email"], "role": r["role"]} for r in unique_recipients],
        by_user=sachbearbeiter,
        ok=len(sent_fail) == 0,
        error="; ".join(f"{f['email']}: {f['error']}" for f in sent_fail) if sent_fail else "",
    )

    # Status auf im_kalender setzen, wenn mindestens ein Versand ok war und der Termin in 'bestaetigt' ist
    if sent_ok and termin.get("status") == "bestaetigt":
        now = datetime.now(timezone.utc).isoformat()
        await db.module_termine.update_one(
            {"id": termin_id},
            {"$set": {
                "status": "im_kalender",
                "im_kalender_at": now,
                "updated_at": now,
            }},
        )

    return {
        "ok": len(sent_fail) == 0,
        "sent": sent_ok,
        "failed": sent_fail,
        "count_sent": len(sent_ok),
        "count_failed": len(sent_fail),
    }


# ==================== HISTORY ====================

@router.get("/termin/{termin_id}/log")
async def termin_log(termin_id: str, user=Depends(get_current_user)):
    items = await db.module_kalender_export_log.find(
        {"termin_id": termin_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return items


# ==================== MONTEUR-FEED (Abo-URL) ====================

async def _get_or_create_token(username: str) -> str:
    doc = await db.module_kalender_feed_tokens.find_one({"username": username}, {"_id": 0, "token": 1})
    if doc and doc.get("token"):
        return doc["token"]
    token = secrets.token_urlsafe(24)
    await db.module_kalender_feed_tokens.update_one(
        {"username": username},
        {"$set": {"username": username, "token": token, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return token


@router.get("/feed-info/{username}")
async def feed_info(username: str, user=Depends(get_current_user)):
    """Liefert die persönliche Abo-URL für einen Mitarbeiter (Admin sieht alle, andere nur eigene)."""
    if (user or {}).get("role") != "admin" and (user or {}).get("username") != username:
        raise HTTPException(403, "Nur eigene oder als Admin")
    token = await _get_or_create_token(username)
    # URL relativ – Frontend setzt REACT_APP_BACKEND_URL davor
    return {
        "username": username,
        "token": token,
        "feed_path": f"/api/module-kalender-export/feed/{username}/{token}.ics",
        "hint": "URL in Google-Kalender unter 'Weitere Kalender > Per URL hinzufügen' eintragen.",
    }


@router.post("/feed-info/{username}/regenerate")
async def feed_regenerate(username: str, user=Depends(get_current_user)):
    if (user or {}).get("role") != "admin" and (user or {}).get("username") != username:
        raise HTTPException(403, "Nur eigene oder als Admin")
    new_token = secrets.token_urlsafe(24)
    await db.module_kalender_feed_tokens.update_one(
        {"username": username},
        {"$set": {"username": username, "token": new_token, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"username": username, "token": new_token}


@router.get("/feed/{username}/{token}.ics")
async def monteur_feed(username: str, token: str):
    """Public ICS-Feed (Token-geschützt). Wird von Google/Outlook-Abo aufgerufen."""
    doc = await db.module_kalender_feed_tokens.find_one({"username": username, "token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Feed nicht gefunden oder Token ungültig")

    # Termine dieses Monteurs (alle Status außer abgesagt)
    cursor = db.module_termine.find(
        {"monteur_username": username, "status": {"$ne": "abgesagt"}},
        {"_id": 0},
    ).sort("start", 1)
    termine = await cursor.to_list(2000)

    events = []
    for t in termine:
        kunde = await _get_kunde(t.get("kunde_id", ""))
        events.append((t, kunde))

    ics = build_ics_calendar(events, calendar_name=f"Graupner Suite – {username}")
    return Response(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "max-age=300"},  # 5 Min Cache
    )
