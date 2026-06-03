"""Wolke Push-Retry Scheduler.

Hintergrund-Task: prueft alle 30 Sekunden offene Wolke-Aufgaben, die noch
nicht bestaetigt wurden (erhalten_am=None), und sendet die Push-Benachrichtigung
erneut, sofern:
  - status == 'offen'
  - type == 'aufgabe'
  - erhalten_am ist null/leer
  - retry_count < max_versuche
  - naechster_retry_at <= jetzt

Nach jedem Retry wird retry_count erhoeht und naechster_retry_at um
retry_intervall_min Minuten in die Zukunft gesetzt. Bei Erreichen von
max_versuche stoppt der Loop fuer diese Wolke automatisch.
"""
import asyncio
from datetime import datetime, timezone, timedelta
from database import db, logger


WOLKE_SCHEDULER_TICK_SEC = 30


async def _process_due_retries():
    """Eine Runde: alle faelligen Wolken pushen."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    query = {
        "type": "aufgabe",
        "status": "offen",
        "$and": [
            {"$or": [{"erhalten_am": None}, {"erhalten_am": ""}, {"erhalten_am": {"$exists": False}}]},
            {"$or": [{"naechster_retry_at": {"$lte": now_iso}}, {"naechster_retry_at": None}]},
        ],
    }
    due = await db.module_wolke.find(query, {"_id": 0}).to_list(200)
    if not due:
        return
    # Lazy-Import um Zirkel zu vermeiden (push.py importiert nichts aus module_wolke)
    from routes.push import send_push_to_user

    for w in due:
        max_v = int(w.get("max_versuche") or 10)
        cnt = int(w.get("retry_count") or 0)
        if cnt >= max_v:
            # Stop-Marker setzen, damit dieser Eintrag nicht jede Runde geprueft wird
            await db.module_wolke.update_one(
                {"id": w["id"]},
                {"$set": {"naechster_retry_at": None, "retry_stopped_at": now_iso}},
            )
            continue
        username = (w.get("empfaenger_username") or "").strip()
        if not username:
            # Kein Empfaenger auflösbar -> stoppen, vermeidet Endlos-Loop
            await db.module_wolke.update_one(
                {"id": w["id"]},
                {"$set": {"naechster_retry_at": None, "retry_stopped_at": now_iso, "retry_stop_reason": "kein_username"}},
            )
            continue
        absender = w.get("absender_name") or "Wolke"
        text = (w.get("text") or "")[:120]
        try:
            sent = await send_push_to_user(
                username=username,
                title=f"📬 Wolke (Erinnerung {cnt + 1}/{max_v})",
                body=f"{absender}: {text}",
                url="/module/wolke?tab=erhalten",
                entity_type="wolke",
                entity_id=w["id"],
            )
        except Exception as e:
            logger.warning(f"Wolke-Retry Push-Fehler ({w.get('id')}): {e}")
            sent = 0
        intervall_min = int(w.get("retry_intervall_min") or 5)
        next_at = (now + timedelta(minutes=intervall_min)).isoformat()
        await db.module_wolke.update_one(
            {"id": w["id"]},
            {"$set": {
                "retry_count": cnt + 1,
                "naechster_retry_at": next_at,
                "letzter_push_at": now_iso,
                "letzter_push_ok": sent > 0,
            }},
        )
        logger.info(f"Wolke-Retry {cnt + 1}/{max_v} an '{username}' fuer wolke={w['id']} (sent={sent})")


async def wolke_retry_loop():
    """Endlos-Loop, alle 30 s eine Runde. Wird in server.py per asyncio.create_task gestartet."""
    logger.info(f"Wolke-Retry-Scheduler gestartet (Tick {WOLKE_SCHEDULER_TICK_SEC}s).")
    while True:
        try:
            await _process_due_retries()
        except Exception as e:
            logger.warning(f"Wolke-Retry-Scheduler Runde fehlgeschlagen: {e}")
        await asyncio.sleep(WOLKE_SCHEDULER_TICK_SEC)
