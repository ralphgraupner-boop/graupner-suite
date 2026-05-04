"""
module_papierkorb – Soft-Delete-Verwaltung für Kunden.

Idee:
  - Klick „Löschen" → Kunde landet im Papierkorb (`deleted_at` gesetzt).
  - Beim nächsten App-Start (Login) fragt das Frontend ob die Papierkorb-
    Einträge endgültig entsorgt werden sollen → erfordert Login-Passwort.
  - Restore: Kunde wird zurückgeholt (deleted_at = None).
  - Purge: ruft das bestehende cascade_delete vom module_kunde_delete auf.

Endpoints:
  POST /api/module-papierkorb/move/{kunde_id}    → Soft-delete
  GET  /api/module-papierkorb/list                → Übersicht
  GET  /api/module-papierkorb/count               → nur Anzahl (für Login-Hook)
  POST /api/module-papierkorb/restore/{kunde_id} → Wiederherstellen
  POST /api/module-papierkorb/purge/{kunde_id}   → Endgültig löschen (mit Passwort)
  POST /api/module-papierkorb/purge-all          → Alles im Papierkorb endgültig löschen
"""
import bcrypt
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db, logger
from routes.auth import get_current_user

router = APIRouter()


class PurgeRequest(BaseModel):
    password: str
    send_mail: bool = True
    reason: str | None = None


async def _verify_password(username: str, password: str) -> bool:
    """Prüft das Login-Passwort gegen den User-Datensatz."""
    if not username or not password:
        return False
    u = await db.users.find_one({"username": username}, {"_id": 0, "password": 1})
    if not u:
        return False
    try:
        return bcrypt.checkpw(password.encode(), u["password"].encode())
    except Exception:
        return False


def _username_of(user) -> str:
    """get_current_user liefert das JWT-Payload als dict (nicht als Objekt)."""
    if isinstance(user, dict):
        return user.get("username") or ""
    return getattr(user, "username", "") or ""


@router.post("/move/{kunde_id}")
async def move_to_trash(kunde_id: str, user=Depends(get_current_user)):
    """Markiert den Kunden als 'im Papierkorb' – keine echten Daten gelöscht."""
    kunde = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1})
    if not kunde:
        raise HTTPException(404, "Kunde nicht gefunden")
    now = datetime.now(timezone.utc).isoformat()
    await db.module_kunden.update_one(
        {"id": kunde_id},
        {"$set": {
            "deleted_at": now,
            "deleted_by": _username_of(user),
        }},
    )
    return {"ok": True, "kunde_id": kunde_id, "deleted_at": now}


@router.get("/count")
async def trash_count(user=Depends(get_current_user)):
    """Liefert die Anzahl im Papierkorb. Wird beim Login abgefragt."""
    n = await db.module_kunden.count_documents({"deleted_at": {"$nin": [None, ""]}})
    return {"count": n}


@router.get("/list")
async def trash_list(user=Depends(get_current_user)):
    """Listet alle Kunden im Papierkorb (mit Datum + Lösch-User)."""
    items = []
    async for d in db.module_kunden.find(
        {"deleted_at": {"$nin": [None, ""]}},
        {"_id": 0},
    ).sort("deleted_at", -1):
        items.append({
            "id": d.get("id"),
            "vorname": d.get("vorname"),
            "nachname": d.get("nachname"),
            "name": d.get("name"),
            "firma": d.get("firma"),
            "email": d.get("email"),
            "phone": d.get("phone"),
            "deleted_at": d.get("deleted_at"),
            "deleted_by": d.get("deleted_by"),
            "status": d.get("status") or d.get("kontakt_status"),
        })
    return items


@router.post("/restore/{kunde_id}")
async def restore(kunde_id: str, user=Depends(get_current_user)):
    """Holt den Kunden aus dem Papierkorb zurück."""
    r = await db.module_kunden.update_one(
        {"id": kunde_id, "deleted_at": {"$nin": [None, ""]}},
        {"$unset": {"deleted_at": "", "deleted_by": ""}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Kein Papierkorb-Eintrag mit dieser ID.")
    return {"ok": True, "kunde_id": kunde_id}


@router.post("/purge/{kunde_id}")
async def purge_one(kunde_id: str, body: PurgeRequest, user=Depends(get_current_user)):
    """Endgültiges Löschen eines einzelnen Kunden (Cascade + Backup-Mail).
    Erfordert Login-Passwort des aktuellen Users."""
    if not await _verify_password(_username_of(user), body.password):
        raise HTTPException(401, "Falsches Passwort.")
    # Reuse cascade-delete von module_kunde_delete
    from module_kunde_delete.routes import cascade_delete, DeleteRequest
    req = DeleteRequest(send_mail=body.send_mail, reason=body.reason or "Aus Papierkorb endgültig gelöscht")
    return await cascade_delete(kunde_id, req, user)


@router.post("/purge-all")
async def purge_all(body: PurgeRequest, user=Depends(get_current_user)):
    """Löscht alles im Papierkorb endgültig. Erfordert Login-Passwort."""
    if not await _verify_password(_username_of(user), body.password):
        raise HTTPException(401, "Falsches Passwort.")

    from module_kunde_delete.routes import _delete_cascade, _send_delete_mail
    from module_export.routes import _build_zip_for_kunde, user_state as export_user_state
    import uuid as _uuid

    export_user_state["user"] = user
    deleted = []
    failed = []

    async for d in db.module_kunden.find(
        {"deleted_at": {"$nin": [None, ""]}},
        {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1},
    ).sort("deleted_at", 1):
        kid = d.get("id")
        kname = d.get("name") or f"{d.get('vorname') or ''} {d.get('nachname') or ''}".strip() or "Unbekannt"
        try:
            zip_bytes, _zip_name = await _build_zip_for_kunde(kid)
            stats = await _delete_cascade(kid)
            mail_ok = False
            if body.send_mail:
                mail_ok = await _send_delete_mail(zip_bytes, kname, stats, body.reason or "Papierkorb geleert")
            await db.module_kunde_delete_log.insert_one({
                "id": str(_uuid.uuid4()),
                "kunde_id": kid,
                "kunde_name": kname,
                "status": "success",
                "stats": stats,
                "reason": body.reason or "Papierkorb geleert",
                "mail_sent": mail_ok,
                "zip_size_bytes": len(zip_bytes),
                "user": _username_of(user),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "via": "papierkorb_purge_all",
            })
            deleted.append({"id": kid, "name": kname, "deleted_records": sum(stats.values())})
        except Exception as e:  # noqa: BLE001
            logger.error(f"purge-all: Fehler bei {kid}: {e}")
            failed.append({"id": kid, "name": kname, "error": str(e)})

    return {
        "ok": True,
        "deleted_count": len(deleted),
        "failed_count": len(failed),
        "deleted": deleted,
        "failed": failed,
    }
