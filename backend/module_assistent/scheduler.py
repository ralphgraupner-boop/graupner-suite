"""Täglicher Assistent-Task – läuft um 06:00 UTC (08:00 deutsche Zeit).

Robust gegen Container-Restarts: prüft bei jedem Start, ob der letzte
erfolgreiche Lauf älter als 23 h ist und holt ihn ggf. sofort nach.
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from database import db, logger


async def assistent_daily_task():
    """Läuft täglich um 06:00 UTC. Catch-up nach Container-Restart."""
    logger.info("🤖 assistent_daily_task gestartet — prüfe Catch-up-Bedarf...")

    # Catch-up bei Start
    try:
        letzter = await db.module_assistent_log.find_one(
            {"status": "success", "trigger": {"$ne": "heartbeat"}},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        if letzter:
            zuletzt = datetime.fromisoformat(letzter["created_at"].replace("Z", "+00:00"))
            alter_std = (datetime.now(timezone.utc) - zuletzt).total_seconds() / 3600
            if alter_std > 23:
                logger.warning(f"⚠️ Letzter Assistent-Lauf vor {alter_std:.1f} h — Catch-up jetzt!")
                from .routes import run_all_checks
                await run_all_checks()
                await db.module_assistent_log.insert_one({
                    "id": str(uuid.uuid4()),
                    "status": "success",
                    "trigger": "catchup_after_restart",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
        else:
            logger.info("Kein vorheriger Lauf — übergehe Catch-up beim Erststart")
    except Exception as e:
        logger.error(f"Assistent Catch-up-Pruefung fehlgeschlagen: {e}")

    # Hauptschleife mit Heartbeat
    HEARTBEAT_INTERVAL = 3600  # 1 h
    while True:
        try:
            now = datetime.now(timezone.utc)
            next_run = now.replace(hour=6, minute=0, second=0, microsecond=0)
            if now.hour >= 6:
                next_run += timedelta(days=1)
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Assistent: nächster Check-Lauf um {next_run.strftime('%d.%m.%Y %H:%M')} UTC")
            while wait_seconds > 0:
                sleep_now = min(HEARTBEAT_INTERVAL, wait_seconds)
                await asyncio.sleep(sleep_now)
                wait_seconds -= sleep_now
                try:
                    await db.module_assistent_log.insert_one({
                        "id": str(uuid.uuid4()),
                        "trigger": "heartbeat",
                        "status": "alive",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    cursor = db.module_assistent_log.find(
                        {"trigger": "heartbeat"}, {"_id": 0, "id": 1, "created_at": 1}
                    ).sort("created_at", -1)
                    keep = [d["id"] async for d in cursor.limit(48)]
                    if keep:
                        await db.module_assistent_log.delete_many(
                            {"trigger": "heartbeat", "id": {"$nin": keep}}
                        )
                except Exception as he:
                    logger.warning(f"Assistent Heartbeat-Schreibfehler: {he}")
            logger.info("Assistent: starte täglichen Check-Lauf...")
            from .routes import run_all_checks
            await run_all_checks()
            await db.module_assistent_log.insert_one({
                "id": str(uuid.uuid4()),
                "status": "success",
                "trigger": "schedule",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.error(f"Assistent Scheduler Fehler: {e}")
            await asyncio.sleep(3600)
