"""Lösch-Routen für module_mail_inbox."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from database import db, logger
from routes.auth import get_current_user
from .helpers import _tombstone

router = APIRouter()


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, user=Depends(get_current_user)):
    """Endgültig löschen: Eintrag raus aus Haupt-Collection, Message-ID
    bleibt als Tombstone erhalten (verhindert Re-Import beim nächsten Scan)."""
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    if entry.get("status") == "übernommen":
        raise HTTPException(400, "Übernommene Einträge können nicht gelöscht werden – stattdessen den Kunden löschen.")
    await _tombstone(entry, user)
    await db.module_mail_inbox.delete_one({"id": entry_id})
    return {"ok": True, "deleted": 1}


@router.post("/preview-delete")
async def preview_delete(body: dict, user=Depends(get_current_user)):
    """Lösch-Aktion aus der „Übersprungene anzeigen"-Vorschau.
    Erwartet: { message_id, subject?, from_email? }
    Wirkung:
      - Tombstone für die message_id wird angelegt → nie wieder importiert
      - Falls die Mail doch schon in der Haupt-Collection liegt
        (z.B. zuvor manuell importiert), wird sie zusätzlich entfernt.
    """
    mid = (body or {}).get("message_id") or ""
    if not mid:
        raise HTTPException(400, "message_id erforderlich")
    subject = (body or {}).get("subject", "")
    from_email = (body or {}).get("from_email", "")
    now = datetime.now(timezone.utc).isoformat()
    await db.module_mail_inbox_deleted.update_one(
        {"message_id": mid},
        {"$set": {
            "message_id": mid,
            "subject": subject,
            "from_email": from_email,
            "deleted_at": now,
            "deleted_by": getattr(user, "username", None),
            "source": "preview-delete",
        }},
        upsert=True,
    )
    removed = 0
    existing = await db.module_mail_inbox.find_one({"message_id": mid}, {"_id": 0, "id": 1, "status": 1})
    if existing and existing.get("status") != "übernommen":
        r = await db.module_mail_inbox.delete_one({"message_id": mid})
        removed = r.deleted_count
    return {"ok": True, "tombstoned": True, "removed_from_db": removed}


@router.post("/preview-bulk-delete")
async def preview_bulk_delete(body: dict, user=Depends(get_current_user)):
    """Massen-Lösch-Aktion: legt für eine Liste von message_ids Tombstones an.
    Erwartet: { items: [{message_id, subject?, from_email?}, ...] }
    Skipt Mails ohne message_id (kann nicht permanent ignoriert werden).
    Skipt bereits übernommene Einträge (würde Kunden-Verknüpfung trennen).
    """
    items = (body or {}).get("items") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(400, "items (Liste) erforderlich")
    now = datetime.now(timezone.utc).isoformat()
    user_name = getattr(user, "username", None)
    tombstoned, skipped_no_mid, removed = 0, 0, 0
    for it in items:
        if not isinstance(it, dict):
            continue
        mid = (it.get("message_id") or "").strip()
        if not mid:
            skipped_no_mid += 1
            continue
        await db.module_mail_inbox_deleted.update_one(
            {"message_id": mid},
            {"$set": {
                "message_id": mid,
                "subject": it.get("subject", ""),
                "from_email": it.get("from_email", ""),
                "deleted_at": now,
                "deleted_by": user_name,
                "source": "preview-bulk-delete",
            }},
            upsert=True,
        )
        tombstoned += 1
        existing = await db.module_mail_inbox.find_one({"message_id": mid}, {"_id": 0, "id": 1, "status": 1})
        if existing and existing.get("status") != "übernommen":
            r = await db.module_mail_inbox.delete_one({"message_id": mid})
            removed += r.deleted_count
    return {
        "ok": True,
        "tombstoned": tombstoned,
        "skipped_no_message_id": skipped_no_mid,
        "removed_from_db": removed,
    }




@router.post("/delete-all-spam")
async def delete_all_spam(user=Depends(get_current_user)):
    """Alle Einträge mit Status 'spam_verdacht' endgültig löschen.
    Tombstones werden pro Message-ID angelegt."""
    deleted = 0
    async for e in db.module_mail_inbox.find({"status": "spam_verdacht"}, {"_id": 0}):
        await _tombstone(e, user)
        await db.module_mail_inbox.delete_one({"id": e["id"]})
        deleted += 1
    return {"ok": True, "deleted": deleted}



