from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Header
import json
from uuid import uuid4
from models import PushSubscription, PushUnsubscribe
from database import db, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, JWT_SECRET, logger
from pywebpush import webpush, WebPushException
from auth import get_current_user
import jwt as _jwt

router = APIRouter()


def _username_from_auth_header(authorization: str) -> str:
    """Liest username aus Authorization-Header, ohne Exception zu werfen.
    Liefert leeren String, wenn kein/ungueltiger Token. Wird in /push/subscribe
    genutzt, um Subscriptions an den eingeloggten User zu binden (Auto-Nachtragen
    beim Login: Frontend ruft subscribe nach Login erneut)."""
    if not authorization:
        return ""
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return ""
    try:
        payload = _jwt.decode(parts[1], JWT_SECRET, algorithms=["HS256"])
        return (payload.get("username") or "").strip()
    except Exception:
        return ""


@router.post("/push/subscribe")
async def push_subscribe(subscription: PushSubscription, authorization: str = Header(None)):
    """Browser Push-Benachrichtigung abonnieren.
    Bindet die Subscription an den eingeloggten User (username aus JWT),
    damit gezielt an einzelne Empfaenger gepusht werden kann."""
    from datetime import datetime, timezone
    username = _username_from_auth_header(authorization) or (subscription.username or "").strip()
    existing = await db.push_subscriptions.find_one({"endpoint": subscription.endpoint})
    if existing:
        token = existing.get("push_token") or str(uuid4())
        update_doc = {
            "keys": subscription.keys,
            "push_token": token,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if username:
            update_doc["username"] = username
        await db.push_subscriptions.update_one(
            {"endpoint": subscription.endpoint},
            {"$set": update_doc},
        )
    else:
        await db.push_subscriptions.insert_one({
            "endpoint": subscription.endpoint,
            "keys": subscription.keys,
            "push_token": str(uuid4()),
            "username": username or "",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"message": "Push-Benachrichtigung aktiviert", "user_bound": bool(username)}


@router.delete("/push/subscribe")
async def push_unsubscribe(subscription: PushSubscription):
    """Browser Push-Benachrichtigung deaktivieren"""
    await db.push_subscriptions.delete_one({"endpoint": subscription.endpoint})
    return {"message": "Push-Benachrichtigung deaktiviert"}


@router.post("/push/unsubscribe")
async def push_unsubscribe_post(data: PushUnsubscribe):
    """Browser Push-Benachrichtigung deaktivieren (POST)"""
    await db.push_subscriptions.delete_one({"endpoint": data.endpoint})
    return {"message": "Push-Benachrichtigung deaktiviert"}


@router.get("/push/vapid-key")
async def get_vapid_key():
    """VAPID Public Key für Push-Benachrichtigungen"""
    return {"vapid_public_key": VAPID_PUBLIC_KEY}


@router.post("/push/test")
async def push_test(user=Depends(get_current_user)):
    """Test Push-Benachrichtigung an alle Abonnenten"""
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(100)
    if not subs:
        return {"success": False, "message": "Keine Push-Subscriptions vorhanden. Bitte zuerst aktivieren.", "subscribers": 0}
    await send_push_to_all(
        title="Test-Benachrichtigung",
        body="Wenn Sie das lesen, funktionieren Push-Benachrichtigungen!",
        url="/dashboard"
    )
    return {"success": True, "message": f"Push an {len(subs)} Gerät(e) gesendet", "subscribers": len(subs)}


async def _cleanup_dead_subscriptions(days: int = 30) -> int:
    """Löscht Push-Subscriptions, die seit `days` Tagen nicht mehr erneuert wurden.
    'last_activity' = updated_at falls vorhanden, sonst created_at.
    Gibt Anzahl gelöschter Einträge zurück.
    """
    from datetime import datetime, timezone, timedelta
    cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    candidates = await db.push_subscriptions.find(
        {}, {"_id": 1, "updated_at": 1, "created_at": 1}
    ).to_list(10000)
    dead = [c["_id"] for c in candidates
            if (c.get("updated_at") or c.get("created_at") or "") < cutoff_iso]
    if dead:
        await db.push_subscriptions.delete_many({"_id": {"$in": dead}})
        logger.info(f"push_cleanup: {len(dead)} tote Subscriptions entfernt (älter als {days}d)")
    return len(dead)


async def send_push_to_all(title: str, body: str, url: str = "/", entity_type: str = None, entity_id: str = None):
    """Push-Benachrichtigung an alle Abonnenten senden.
    Wenn entity_type+entity_id gesetzt sind, zeigt der Service Worker
    zwei Action-Buttons („Öffnen" / „Erledigt") an.
    Vor dem Versand werden tote Subscriptions (>30d ohne Update) entfernt.
    """
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID keys not configured, skipping push")
        return
    # Tote Subscriptions vor jedem Versand wegputzen
    try:
        await _cleanup_dead_subscriptions(days=30)
    except Exception as e:
        logger.warning(f"push_cleanup übersprungen: {e}")
    subscriptions = await db.push_subscriptions.find({}, {"_id": 0}).to_list(100)
    logger.info(f"Sending push to {len(subscriptions)} subscribers: {title}")
    for sub in subscriptions:
        payload_data = {"title": title, "body": body, "url": url}
        if entity_type and entity_id:
            payload_data["entity_type"] = entity_type
            payload_data["entity_id"] = entity_id
            payload_data["push_token"] = sub.get("push_token", "")
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=json.dumps(payload_data),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": "mailto:info@graupner-suite.de"}
            )
            logger.info(f"Push sent successfully to {sub['endpoint'][:50]}")
        except WebPushException as e:
            logger.error(f"Push failed for {sub['endpoint'][:50]}: {e}")
            is_gone = False
            if hasattr(e, 'response') and e.response is not None and hasattr(e.response, 'status_code'):
                is_gone = e.response.status_code in (404, 410)
            if not is_gone and ("410" in str(e) or "Gone" in str(e) or "expired" in str(e)):
                is_gone = True
            if is_gone:
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
                logger.info(f"Removed expired subscription: {sub['endpoint'][:50]}")
        except Exception as e:
            logger.error(f"Push unexpected error: {e}")


async def send_push_to_user(username: str, title: str, body: str, url: str = "/", entity_type: str = None, entity_id: str = None):
    """Push-Benachrichtigung gezielt an alle Geraete EINES Users.
    Nutzt das gleiche Payload-Format wie send_push_to_all. Liefert Anzahl
    erfolgreich versendeter Pushes zurueck (fuer Retry-Scheduler-Log)."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID keys not configured, skipping push")
        return 0
    if not username:
        return 0
    subscriptions = await db.push_subscriptions.find({"username": username}, {"_id": 0}).to_list(100)
    if not subscriptions:
        logger.info(f"send_push_to_user: keine Subscriptions fuer username='{username}'")
        return 0
    sent_ok = 0
    for sub in subscriptions:
        payload_data = {"title": title, "body": body, "url": url}
        if entity_type and entity_id:
            payload_data["entity_type"] = entity_type
            payload_data["entity_id"] = entity_id
            payload_data["push_token"] = sub.get("push_token", "")
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=json.dumps(payload_data),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": "mailto:info@graupner-suite.de"},
            )
            sent_ok += 1
        except WebPushException as e:
            is_gone = False
            if hasattr(e, 'response') and e.response is not None and hasattr(e.response, 'status_code'):
                is_gone = e.response.status_code in (404, 410)
            if not is_gone and ("410" in str(e) or "Gone" in str(e) or "expired" in str(e)):
                is_gone = True
            if is_gone:
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
                logger.info(f"send_push_to_user: tote Subscription entfernt ({sub['endpoint'][:50]})")
            else:
                logger.error(f"send_push_to_user fail: {e}")
        except Exception as e:
            logger.error(f"send_push_to_user unexpected: {e}")
    return sent_ok


# ============== QUICK-ACTION ENDPOINT ==============
# Wird vom Service Worker beim Klick auf den „Erledigt"-Button aufgerufen.
# Authentifizierung über push_token (an Subscription gebunden).

@router.post("/push/quick-action")
async def push_quick_action(data: dict):
    from datetime import datetime, timezone, timedelta
    token = data.get("push_token")
    entity_type = data.get("entity_type")
    entity_id = data.get("entity_id")
    action = data.get("action")

    if not token or not entity_type or not entity_id or not action:
        raise HTTPException(400, "push_token, entity_type, entity_id, action erforderlich")

    sub = await db.push_subscriptions.find_one({"push_token": token}, {"_id": 0})
    if not sub:
        raise HTTPException(401, "Ungültiger Push-Token")

    if action not in ("done", "snooze", "erhalten"):
        raise HTTPException(400, "Unbekannte Aktion")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Collection-Mapping
    COL = {
        "quote": ("quotes", {"followup_sent": True, "followup_done_at": now_iso}),
        "invoice": ("invoices", {"followup_seen": True, "followup_seen_at": now_iso}),
        "task": ("module_aufgaben", {"status": "erledigt", "erledigt_am": now_iso}),
        "termin": ("module_termine", {"status": "erledigt", "erledigt_am": now_iso}),
        "wolke": ("module_wolke", {"erhalten_am": now_iso, "erhalten_via": "push"}),
    }
    if entity_type not in COL:
        raise HTTPException(400, f"Unbekannter entity_type: {entity_type}")
    coll_name, done_update = COL[entity_type]
    coll = db[coll_name]

    # Wolke: Push-Tipp „Erhalten" markiert nur als erhalten (NICHT als erledigt).
    # Erledigt bleibt der explizite Workflow-Schritt im UI.
    if action == "erhalten":
        if entity_type != "wolke":
            raise HTTPException(400, "Aktion 'erhalten' nur fuer wolke")
        # username aus subscription holen
        erh_von = sub.get("username", "") or "push"
        res = await coll.update_one(
            {"id": entity_id},
            {"$set": {"erhalten_am": now_iso, "erhalten_via": "push", "erhalten_von": erh_von}},
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Wolke nicht gefunden")
        return {"ok": True, "message": "Erhalten bestaetigt"}

    if action == "done":
        res = await coll.update_one({"id": entity_id}, {"$set": done_update})
        if res.matched_count == 0:
            raise HTTPException(404, "Eintrag nicht gefunden")
        return {"ok": True, "message": "Als erledigt markiert"}

    # SNOOZE
    try:
        hours = int(data.get("snooze_hours", 2))
    except (TypeError, ValueError):
        hours = 2
    if hours not in (1, 2, 4, 8):
        raise HTTPException(400, "snooze_hours muss 1, 2, 4 oder 8 sein")

    snooze_until = (now + timedelta(hours=hours)).isoformat()
    # followup_sent/seen=True versteckt den Eintrag aus der Prüfung,
    # snooze_until wird beim nächsten Check geprüft und zurückgesetzt
    update_doc = {"snooze_until": snooze_until}
    if entity_type == "quote":
        update_doc["followup_sent"] = True
    elif entity_type == "invoice":
        update_doc["followup_seen"] = True

    res = await coll.update_one({"id": entity_id}, {"$set": update_doc})
    if res.matched_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"ok": True, "message": f"Erinnerung in {hours} Std", "snooze_until": snooze_until}


# ============== VOICE TRANSCRIPTION (für Mein Assistent) ==============
# Anonymer Endpoint, Auth über push_token. Nutzt Whisper.

@router.post("/push/voice")
async def push_voice(
    audio: UploadFile = File(...),
    token: str = Form(...),
    language: str = Form("de"),
):
    """Transkribiert Audio für den Assistent. Auth über push_token."""
    sub = await db.push_subscriptions.find_one({"push_token": token}, {"_id": 0})
    if not sub:
        raise HTTPException(401, "Ungültiger Push-Token")
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Leere Datei")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Datei zu groß (max 25 MB)")
    # Importiert hier um Zirkel-Imports zu vermeiden
    from module_voice_intake.routes import _transcribe_bytes
    text = await _transcribe_bytes(data, audio.filename or "aufnahme.webm", language)
    return {"text": text}


@router.post("/push/cleanup")
async def push_cleanup(days: int = 30, user=Depends(get_current_user)):
    """Manueller Cleanup: löscht Push-Subscriptions älter als `days` Tage.
    Gibt Vorher/Nachher-Zahlen zur Kontrolle zurück.
    """
    before = await db.push_subscriptions.count_documents({})
    removed = await _cleanup_dead_subscriptions(days=days)
    after = await db.push_subscriptions.count_documents({})
    return {"before": before, "removed": removed, "after": after, "cutoff_days": days}
