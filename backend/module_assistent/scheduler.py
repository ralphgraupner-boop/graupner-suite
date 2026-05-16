"""Täglicher Assistent-Task – läuft um 06:00 UTC (08:00 deutsche Zeit)."""
import asyncio
from datetime import datetime, timezone, timedelta
from database import logger


async def assistent_daily_task():
    """Läuft täglich um 06:00 UTC und führt alle Checks aus."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            next_run = now.replace(hour=6, minute=0, second=0, microsecond=0)
            if now.hour >= 6:
                next_run += timedelta(days=1)
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Assistent: nächster Check-Lauf um {next_run.strftime('%d.%m.%Y %H:%M')} UTC")
            await asyncio.sleep(wait_seconds)
            logger.info("Assistent: starte täglichen Check-Lauf...")
            from .routes import run_all_checks
            await run_all_checks()
        except Exception as e:
            logger.error(f"Assistent Scheduler Fehler: {e}")
            await asyncio.sleep(3600)
