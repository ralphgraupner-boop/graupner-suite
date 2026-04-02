from fastapi import APIRouter
import json
from models import PushSubscription, PushUnsubscribe
from database import db, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, logger
from pywebpush import webpush, WebPushException

router = APIRouter()


@router.post("/push/subscribe")
async def push_subscribe(subscription: PushSubscription):
    """Browser Push-Benachrichtigung abonnieren"""
    from datetime import datetime, timezone
    existing = await db.push_subscriptions.find_one({"endpoint": subscription.endpoint})
    if existing:
        await db.push_subscriptions.update_one(
            {"endpoint": subscription.endpoint},
            {"$set": {"keys": subscription.keys, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.push_subscriptions.insert_one({
            "endpoint": subscription.endpoint,
            "keys": subscription.keys,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"message": "Push-Benachrichtigung aktiviert"}


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
async def push_test():
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


async def send_push_to_all(title: str, body: str, url: str = "/"):
    """Push-Benachrichtigung an alle Abonnenten senden"""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID keys not configured, skipping push")
        return
    subscriptions = await db.push_subscriptions.find({}, {"_id": 0}).to_list(100)
    logger.info(f"Sending push to {len(subscriptions)} subscribers: {title}")
    payload = json.dumps({"title": title, "body": body, "url": url})
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=payload,
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
