"""
Routes für module_kunde_delete – Cascade-Lösch mit Vorab-Export.

POST /api/module-kunde-delete/execute/{kunde_id}
  Body: { "send_mail": true|false, "reason": "..." }
  → erzeugt Vorab-ZIP, löscht in einer Transaktion (best-effort) alle Refs,
    sendet ZIP optional per Mail, gibt ZIP als Stream zurück (gleichzeitig).

GET  /api/module-kunde-delete/log → Audit
"""
import io
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import db, logger
from routes.auth import get_current_user
from module_export.routes import _build_zip_for_kunde, user_state as export_user_state
from module_export.collector import (
    PORTAL_ACCOUNT_COLS,
    PORTAL_UPLOAD_COLS,
    PORTAL_ACTIVITY_COLS,
    MONTEUR_COLS,
)

router = APIRouter()


class DeleteRequest(BaseModel):
    send_mail: bool = True
    reason: str | None = None


async def _delete_cascade(kunde_id: str) -> dict:
    """Löscht Kunde + alle relationalen Daten. Liefert Statistik."""
    stats = {
        "module_kunden": 0,
        "customers_legacy": 0,
        "module_projekte": 0,
        "module_aufgaben": 0,
        "module_termine": 0,
        "einsaetze": 0,
        "quotes": 0,
        "rechnungen_v2": 0,
        "portale": 0,
        "portal_uploads": 0,
        "portal_activity": 0,
        "monteur_eintraege": 0,
    }

    # 1. Projekt-IDs für transitive Refs einsammeln
    projekt_ids = [p["id"] async for p in db.module_projekte.find({"kunde_id": kunde_id}, {"_id": 0, "id": 1})]
    einsatz_ids = [e["id"] async for e in db.einsaetze.find({"kunde_id": kunde_id}, {"_id": 0, "id": 1})]

    # Portal-Account-IDs einsammeln (für Uploads/Aktivität)
    portal_ids: list[str] = []
    for col, _label in PORTAL_ACCOUNT_COLS:
        async for a in db[col].find({"customer_id": kunde_id}, {"_id": 0, "id": 1}):
            if a.get("id"):
                portal_ids.append(a["id"])

    # 2. Aufgaben (kunde_id ODER projekt_id in liste)
    aufgabe_filter = {"$or": [{"kunde_id": kunde_id}]}
    if projekt_ids:
        aufgabe_filter["$or"].append({"projekt_id": {"$in": projekt_ids}})
    r = await db.module_aufgaben.delete_many(aufgabe_filter)
    stats["module_aufgaben"] = r.deleted_count

    # 3. Termine
    termin_filter = {"$or": [{"kunde_id": kunde_id}]}
    if projekt_ids:
        termin_filter["$or"].append({"projekt_id": {"$in": projekt_ids}})
    r = await db.module_termine.delete_many(termin_filter)
    stats["module_termine"] = r.deleted_count

    # 4. Monteur-App (todos/fotos/notizen)
    if einsatz_ids:
        for col, fk, _file_field in MONTEUR_COLS:
            r = await db[col].delete_many({fk: {"$in": einsatz_ids}})
            stats["monteur_eintraege"] += r.deleted_count

    # 5. Einsätze
    r = await db.einsaetze.delete_many({"kunde_id": kunde_id})
    stats["einsaetze"] = r.deleted_count

    # 6. Quotes & Rechnungen
    r = await db.quotes.delete_many({"customer_id": kunde_id})
    stats["quotes"] = r.deleted_count
    r = await db.rechnungen_v2.delete_many({"customer_id": kunde_id})
    stats["rechnungen_v2"] = r.deleted_count

    # 7. Portal-Uploads & Aktivität
    if portal_ids:
        for col, fk, _file_field in PORTAL_UPLOAD_COLS:
            r = await db[col].delete_many({fk: {"$in": portal_ids}})
            stats["portal_uploads"] += r.deleted_count
        for col, fk in PORTAL_ACTIVITY_COLS:
            r = await db[col].delete_many({fk: {"$in": portal_ids}})
            stats["portal_activity"] += r.deleted_count

    # 8. Portal-Accounts
    for col, _label in PORTAL_ACCOUNT_COLS:
        r = await db[col].delete_many({"customer_id": kunde_id})
        stats["portale"] += r.deleted_count

    # 9. Projekte
    r = await db.module_projekte.delete_many({"kunde_id": kunde_id})
    stats["module_projekte"] = r.deleted_count

    # 10. Kunde selbst (module_kunden + ggf. customers legacy)
    r = await db.module_kunden.delete_one({"id": kunde_id})
    stats["module_kunden"] = r.deleted_count
    r = await db.customers.delete_one({"id": kunde_id})
    stats["customers_legacy"] = r.deleted_count

    return stats


async def _send_delete_mail(zip_bytes: bytes, kunde_name: str, stats: dict, reason: str | None):
    """Sendet das Lösch-Backup per Mail."""
    try:
        from utils import send_email
        filename = f"Lösch-Quittung_{kunde_name or 'Kunde'}_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H%M')}.zip"
        body_html = f"""
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
<h2 style="color:#7f1d1d;">🗑️ Kunde gelöscht – Sicherungs-ZIP anbei</h2>
<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:16px;margin:20px 0;border-radius:8px;">
  <p style="margin:0;"><strong>Gelöscht:</strong> {kunde_name or '—'}</p>
  {f'<p style="margin:4px 0 0 0;"><strong>Begründung:</strong> {reason}</p>' if reason else ''}
  <p style="margin:8px 0 0 0;color:#555;">Datum: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC</p>
</div>
<h3>Mit gelöscht:</h3>
<ul>
{''.join(f'<li>{k}: {v}</li>' for k,v in stats.items() if v > 0) or '<li>—</li>'}
</ul>
<p style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px;border-radius:6px;color:#78350f;">
Diese ZIP enthält alle Daten und Dateien des gelöschten Kunden. Über die <strong>Import-Funktion</strong>
in der Kundenliste kann der Kunde jederzeit wiederhergestellt werden.
</p>
</body></html>
"""
        send_email(
            to_email="service24@tischlerei-graupner.de",
            subject=f"🗑️ Lösch-Quittung – {kunde_name or 'Kunde'}",
            body_html=body_html,
            attachments=[{"data": zip_bytes, "filename": filename}],
        )
        return True
    except Exception as e:  # noqa: BLE001
        logger.error(f"Lösch-Mail fehlgeschlagen: {e}")
        return False


@router.post("/execute/{kunde_id}")
async def cascade_delete(kunde_id: str, req: DeleteRequest, user=Depends(get_current_user)):
    """
    Führt Cascade-Lösch aus:
    1. Erzeugt Vorab-ZIP (zwingend)
    2. Löscht alle Refs + Kunde
    3. Sendet ZIP optional per Mail
    4. Gibt ZIP als Download zurück (Frontend speichert nochmal lokal)
    5. Schreibt Audit-Log
    """
    # Setze user-state für _build_zip_for_kunde audit
    export_user_state["user"] = user
    # 1. Backup-ZIP erstellen (BEVOR wir löschen!)
    try:
        zip_bytes, zip_name = await _build_zip_for_kunde(kunde_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Vorab-Backup fehlgeschlagen, Lösch abgebrochen: {e}") from e

    # Kunden-Name aus dem ZIP-Filename ziehen (zip_name = "export-NACHNAME-DATUM.zip")
    kunde_name = zip_name.replace("export-", "").rsplit("-", 1)[0]

    # 2. Cascade-Lösch
    try:
        stats = await _delete_cascade(kunde_id)
    except Exception as e:  # noqa: BLE001
        # Lösch fehlgeschlagen – ZIP existiert noch. Audit schreiben, Fehler an Frontend.
        await db.module_kunde_delete_log.insert_one({
            "id": str(uuid.uuid4()),
            "kunde_id": kunde_id,
            "kunde_name": kunde_name,
            "status": "error",
            "error": str(e),
            "user": getattr(user, "username", None),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(500, f"Lösch fehlgeschlagen: {e}") from e

    # 3. Mail senden
    mail_sent = False
    if req.send_mail:
        mail_sent = await _send_delete_mail(zip_bytes, kunde_name, stats, req.reason)

    # 4. Audit
    await db.module_kunde_delete_log.insert_one({
        "id": str(uuid.uuid4()),
        "kunde_id": kunde_id,
        "kunde_name": kunde_name,
        "status": "success",
        "stats": stats,
        "reason": req.reason,
        "mail_sent": mail_sent,
        "zip_filename": zip_name,
        "zip_size_bytes": len(zip_bytes),
        "user": getattr(user, "username", None),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # 5. ZIP zurück an Frontend (Stream)
    headers = {
        "Content-Disposition": f'attachment; filename="{zip_name}"',
        "X-Delete-Stats": str(sum(stats.values())),
        "X-Mail-Sent": "1" if mail_sent else "0",
    }
    return StreamingResponse(io.BytesIO(zip_bytes), media_type="application/zip", headers=headers)


@router.get("/log")
async def get_log(limit: int = 50, user=Depends(get_current_user)):
    items = []
    async for d in db.module_kunde_delete_log.find({}, {"_id": 0}).sort("created_at", -1).limit(limit):
        items.append(d)
    return items
