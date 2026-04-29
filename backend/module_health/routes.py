"""
module_health – Status- und Aktualitäts-Check.

Module-First, read-only. Eigenes Prefix /api/module-health.
Liefert:
- App-Version (aus VERSION-Datei oder git)
- Umgebungs-Indikator (basierend auf DB_NAME / FRONTEND_URL)
- Datenbestände (Counts der wichtigsten Collections)
- Backup-Status (letztes Backup aus auto_backup_log)
- Server-Zeit (UTC + Hamburg-Zeit)
"""
import os
import subprocess
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from database import db
from routes.auth import get_current_user

router = APIRouter()


def _get_version() -> dict:
    """Liest Version aus /app/VERSION oder git."""
    version_file = "/app/VERSION"
    if os.path.exists(version_file):
        try:
            with open(version_file) as f:
                return {"version": f.read().strip(), "source": "file"}
        except Exception:
            pass
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd="/app", stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        date = subprocess.check_output(
            ["git", "log", "-1", "--format=%ci"],
            cwd="/app", stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        return {"version": sha, "build_date": date, "source": "git"}
    except Exception:
        return {"version": "unknown", "source": "none"}


def _detect_environment() -> dict:
    """Erkennt Umgebung anhand DB_NAME und CORS_ORIGINS."""
    db_name = os.environ.get("DB_NAME", "")
    cors = os.environ.get("CORS_ORIGINS", "")
    is_preview = "preview" in db_name.lower() or "preview" in cors.lower() or "preview" in (os.environ.get("FRONTEND_URL", "") or "").lower()
    return {
        "db_name": db_name,
        "is_preview": bool(is_preview),
        "label": "PREVIEW / TEST" if is_preview else "LIVE / PRODUKTIV",
        "color": "amber" if is_preview else "red",
    }


@router.get("/status")
async def status(user=Depends(get_current_user)):
    counts = {}
    for col in ["module_kunden", "module_projekte", "module_aufgaben", "module_termine",
                "anfragen", "einsaetze", "quotes", "rechnungen_v2"]:
        try:
            counts[col] = await db[col].count_documents({})
        except Exception:
            counts[col] = -1
    # Legacy-Hinweis: customers (alte Demo-Daten)
    try:
        counts["customers_legacy"] = await db.customers.count_documents({})
    except Exception:
        counts["customers_legacy"] = -1

    # Letztes erfolgreiches Backup
    last_backup = None
    backup_age_hours = None
    try:
        b = await db.auto_backup_log.find_one(
            {"status": "success"}, {"_id": 0}, sort=[("created_at", -1)]
        )
        if b:
            last_backup = b.get("created_at")
            try:
                ts = datetime.fromisoformat(last_backup.replace("Z", "+00:00"))
                age = datetime.now(timezone.utc) - ts
                backup_age_hours = round(age.total_seconds() / 3600, 1)
            except Exception:
                pass
    except Exception:
        pass

    now_utc = datetime.now(timezone.utc)
    now_hamburg = now_utc + timedelta(hours=2)  # CEST – einfache Approximation

    return {
        "ok": True,
        "version": _get_version(),
        "environment": _detect_environment(),
        "data_counts": counts,
        "data_total": sum(v for v in counts.values() if v > 0),
        "backup": {
            "last_success_at": last_backup,
            "age_hours": backup_age_hours,
            "status": "ok" if (backup_age_hours is not None and backup_age_hours < 30) else "warn",
        },
        "server_time_utc": now_utc.isoformat(),
        "server_time_hamburg": now_hamburg.strftime("%H:%M (Hamburg)"),
    }
