"""Portal-v2-Backup – Snapshots erstellen, listen, restoren, löschen."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import asyncio

from database import db, logger
from routes.auth import get_current_user

router = APIRouter()

# Welche Collections gehoeren zu portal_v2?
V2_COLLECTIONS = [
    "portal2_accounts",
    "portal2_messages",
    "portal2_uploads",
    "portal2_settings",
]
RETENTION_DAYS = 30


# ===================== Helpers =====================


async def _create_snapshot(quelle: str = "manuell", user: Optional[dict] = None) -> dict:
    """Erstellt einen Snapshot aller v2-Collections."""
    now = datetime.now(timezone.utc)
    snapshot_id = str(uuid.uuid4())
    payload: dict = {}
    counts: dict = {}
    for coll_name in V2_COLLECTIONS:
        items = await db[coll_name].find({}, {"_id": 0}).to_list(50000)
        payload[coll_name] = items
        counts[coll_name] = len(items)

    snapshot = {
        "id": snapshot_id,
        "timestamp": now.isoformat(),
        "datum_label": now.strftime("%d.%m.%Y %H:%M"),
        "datum_id": now.strftime("v2_%Y-%m-%d_%H-%M-%S"),
        "quelle": quelle,  # "manuell" | "automatisch" | "vor_restore"
        "counts": counts,
        "total_documents": sum(counts.values()),
        "size_bytes": sum(len(str(v)) for v in payload.values()),
        "data": payload,
        "created_by": (user or {}).get("username") if user else "system",
    }
    await db.portal_v2_backups.insert_one(snapshot)
    snapshot.pop("_id", None)
    logger.info(
        f"Portal-v2-Backup erstellt ({quelle}): "
        f"{counts.get('portal2_accounts', 0)} accounts, "
        f"{counts.get('portal2_messages', 0)} messages, "
        f"{counts.get('portal2_uploads', 0)} uploads"
    )
    # Retention: aeltere als 30 Tage loeschen
    await _cleanup_old_backups()
    return snapshot


async def _cleanup_old_backups() -> int:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)).isoformat()
    res = await db.portal_v2_backups.delete_many({"timestamp": {"$lt": cutoff}})
    if res.deleted_count:
        logger.info(f"Portal-v2-Backup: {res.deleted_count} alte Snapshots geloescht (>{RETENTION_DAYS} Tage)")
    return res.deleted_count


# ===================== API-Endpoints =====================


@router.get("/list")
async def list_backups(user=Depends(get_current_user)):
    """Liste aller Snapshots, neueste zuerst – ohne 'data'-Feld (zu groß)."""
    items = await db.portal_v2_backups.find(
        {}, {"_id": 0, "data": 0}
    ).sort("timestamp", -1).to_list(200)
    return {
        "retention_days": RETENTION_DAYS,
        "total": len(items),
        "snapshots": items,
    }


@router.post("/create")
async def manual_create(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    snap = await _create_snapshot(quelle="manuell", user=user)
    snap.pop("data", None)
    return snap


@router.get("/{backup_id}")
async def get_one(backup_id: str, user=Depends(get_current_user)):
    """Snapshot inkl. Daten (für Download)."""
    s = await db.portal_v2_backups.find_one({"id": backup_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Snapshot nicht gefunden")
    return s


@router.post("/{backup_id}/restore")
async def restore(backup_id: str, user=Depends(get_current_user)):
    """Stellt einen Snapshot wieder her. Erstellt VORHER ein Sicherheits-Backup
    (quelle='vor_restore'), damit man die letzte Aktion rueckgaengig machen kann.
    """
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    s = await db.portal_v2_backups.find_one({"id": backup_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Snapshot nicht gefunden")

    # 1) Sicherheits-Backup vom AKTUELLEN Zustand
    safety = await _create_snapshot(quelle="vor_restore", user=user)

    # 2) Eigentlicher Restore: alle v2-Collections leeren und mit Daten aus Snapshot fuellen
    data = s.get("data") or {}
    restored_counts: dict = {}
    for coll_name in V2_COLLECTIONS:
        items = data.get(coll_name) or []
        await db[coll_name].delete_many({})
        if items:
            # Pydantic id-Felder bleiben bestehen; _id ist nicht mit drin (wurde beim Snapshot ausgeschlossen)
            await db[coll_name].insert_many(items)
        restored_counts[coll_name] = len(items)

    logger.warning(
        f"Portal-v2-Backup RESTORE durchgefuehrt: snapshot={backup_id} ({s.get('datum_label')}), "
        f"safety_backup={safety['id']}, restored={restored_counts}"
    )
    return {
        "success": True,
        "restored_from": {"id": s["id"], "datum_label": s["datum_label"], "timestamp": s["timestamp"]},
        "safety_backup_id": safety["id"],
        "restored_counts": restored_counts,
    }


@router.delete("/{backup_id}")
async def delete_one(backup_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    res = await db.portal_v2_backups.delete_one({"id": backup_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Snapshot nicht gefunden")
    return {"success": True}


# ===================== Auto-Backup (taeglich 03:00) =====================


async def _auto_backup_loop():
    """Background-Task: prueft jede Minute, ob heute ein automatisches Backup faellig ist."""
    last_run_date: Optional[str] = None
    while True:
        try:
            now = datetime.now(timezone.utc)
            today_str = now.strftime("%Y-%m-%d")
            # Trigger: Stunde >= 3 und heute noch nicht gelaufen
            if now.hour >= 3 and last_run_date != today_str:
                # Prüfe: gibt es heute schon ein automatisches Backup? (idempotent)
                start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).isoformat()
                existing = await db.portal_v2_backups.count_documents({
                    "quelle": "automatisch",
                    "timestamp": {"$gte": start},
                })
                if existing == 0:
                    await _create_snapshot(quelle="automatisch")
                last_run_date = today_str
        except Exception as e:
            logger.error(f"Portal-v2-Backup Auto-Loop Fehler: {e}")
        await asyncio.sleep(60)  # check jede Minute


def start_auto_backup_task():
    """Wird vom Server-Startup aufgerufen."""
    asyncio.create_task(_auto_backup_loop())
    logger.info("Portal-v2-Backup Auto-Backup-Task gestartet (taeglich 03:00 UTC)")
