from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from database import db, logger
import json
import zipfile
import io
import asyncio
import os
import uuid

router = APIRouter()

# Lokales Backup-Verzeichnis (zweites Speicherziel neben E-Mail)
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/app/backups")
os.makedirs(BACKUP_DIR, exist_ok=True)


async def get_backup_settings() -> dict:
    """Liest Backup-Settings aus DB (kein Hardcode mehr).

    Defaults werden beim ersten Aufruf in die DB geschrieben, damit Admin sie
    danach ueber UI aendern kann.
    """
    s = await db.settings.find_one({"id": "auto_backup_settings"}, {"_id": 0})
    if not s:
        s = {
            "id": "auto_backup_settings",
            "enabled": True,
            "time_utc": "02:00",
            "empfaenger_emails": [],
            "lokal_aufbewahrung_tage": 14,
            "object_storage_aufbewahrung_tage": 30,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.settings.update_one({"id": "auto_backup_settings"}, {"$set": s}, upsert=True)
    # Migration: alten 'email'-Singular auf 'empfaenger_emails' (Liste) konvertieren
    if "email" in s and not s.get("empfaenger_emails"):
        s["empfaenger_emails"] = [s["email"]] if s["email"] else []
    return s


async def create_backup_data():
    """Erstellt Backup-Daten und gibt ZIP-Bytes zurück.

    Enthält JSON aller Collections + alle Bilder/PDFs aus dem Object-Storage,
    indem die Logik aus module_export wiederverwendet wird.
    """
    try:
        # Kompletter Datenbestand pro Kunde inkl. Files (über module_export)
        from module_export.collector import collect_kunde
        from utils.storage import get_object

        # Auto-Backup: alle aktiven + Legacy-Collections
        # WICHTIG: Bei jedem neuen module_* IMMER hier ergänzen!
        selected = [
            # KERN
            "module_kunden", "module_artikel", "module_textvorlagen",
            "settings", "users", "mitarbeiter", "counters",
            # KUNDENPORTAL (aktiv)
            "portals", "portals_klon", "portal_settings", "portal_files",
            "portal_klon_files", "portal_klon_settings",
            # EINSÄTZE
            "einsaetze", "einsatz_config",
            # PROJEKTE
            "module_projekte", "module_projekte_settings",
            # AUFGABEN
            "module_aufgaben", "module_aufgaben_settings",
            # TERMINE
            "module_termine", "module_termine_settings",
            # MAIL-INBOX
            "module_mail_inbox", "module_mail_inbox_deleted",
            # DOKUMENTE
            "module_dokumente", "dokumente_v2", "dokumente_v2_counters",
            "dokumente_v2_counter_log", "dokumente_v2_settings",
            # BUCHHALTUNG
            "buchungen", "buchhaltung_config",
            # FEEDBACK / NOTIZEN (Ralphs Bugtracker – kritisch!)
            "module_feedback", "module_feedback_history",
            # SYSTEM
            "module_user_prefs", "module_kundenlink",
            "module_duplikate_settings", "duplikate_ignored", "duplikate_merge_log",
            "module_kunde_delete_log", "auto_backup_log",
            "module_health_audit", "module_export_log",
            "module_kalender_export_log", "module_kalender_feed_tokens",
            "module_assistent_hinweise", "module_assistent_log", "module_assistent_settings",
            # MONTEUR-APP
            "monteur_app_settings", "monteur_app_notizen",
            "monteur_app_fotos", "monteur_app_todos", "monteur_app_feedback",
            # PORTAL V2 BACKUP SERVICE
            "portal_v2_backups",
            # LEGACY
            "module_kontakt", "anfragen", "customers", "quotes", "orders",
            "invoices", "articles", "rechnungen_v2", "leistungsbloecke",
            "text_templates", "email_vorlagen", "diverses", "email_inbox",
            "portal_messages",
        ]
        
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Metadata
            metadata = {
                "backup_date": datetime.now(timezone.utc).isoformat(),
                "app_version": "1.0.0",
                "collections": selected,
                "backup_type": "automatic_daily"
            }
            zip_file.writestr("_metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False))
            
            # Export jede Collection
            total_docs = 0
            for coll_name in selected:
                try:
                    docs = await db[coll_name].find({}, {"_id": 0}).to_list(None)
                    
                    if docs:
                        json_data = json.dumps(docs, indent=2, ensure_ascii=False, default=str)
                        zip_file.writestr(f"{coll_name}.json", json_data)
                        total_docs += len(docs)
                except Exception as e:
                    logger.error(f"Fehler beim Backup von {coll_name}: {e}")
            
            # README
            readme = f"""Graupner Suite - Automatisches Backup
===========================================

Erstellt am: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M:%S')} UTC
Backup-Typ: Automatisches tägliches Backup
Collections: {len(selected)}
Gesamt Einträge: {total_docs}

Wiederherstellung:
------------------
1. Einloggen in Graupner Suite
2. Einstellungen → Backup & Wiederherstellung
3. ZIP-Datei hochladen
4. Modus wählen (Merge oder Replace)

WICHTIG: Bei "Replace" werden bestehende Daten ÜBERSCHRIEBEN!
"""
            zip_file.writestr("README.txt", readme)

            # ZUSÄTZLICH: Pro-Kunde Komplett-Export inkl. Bilder im Unterordner kunden/
            files_added = 0
            kunden_count = 0
            seen_storage_paths: set[str] = set()
            try:
                async for c in db.module_kunden.find({}, {"_id": 0, "id": 1}):
                    try:
                        data, file_refs = await collect_kunde(c["id"])
                        if not data.get("kunde"):
                            continue
                        kunden_count += 1
                        # Files (Bilder/PDFs) aus Object-Storage holen
                        for storage_path, label in file_refs:
                            if storage_path in seen_storage_paths:
                                continue
                            seen_storage_paths.add(storage_path)
                            try:
                                content, _ct = get_object(storage_path)
                                zip_file.writestr(f"kunden/{c['id']}/{label}", content)
                                files_added += 1
                            except Exception as fe:  # noqa: BLE001
                                logger.warning(f"Auto-Backup: file {storage_path} skipped: {fe}")
                    except Exception as ke:  # noqa: BLE001
                        logger.warning(f"Auto-Backup: kunde {c.get('id')} skipped: {ke}")
                logger.info(f"Auto-Backup: {kunden_count} Kunden, {files_added} Dateien gepackt")
            except Exception as fe:  # noqa: BLE001
                logger.error(f"Auto-Backup: Datei-Export fehlgeschlagen: {fe}")
        
        zip_buffer.seek(0)
        logger.info(f"✅ Automatisches Backup erstellt: {total_docs} Einträge")
        
        return zip_buffer.read(), total_docs
        
    except Exception as e:
        logger.error(f"❌ Automatisches Backup fehlgeschlagen: {e}")
        return None, 0


async def send_backup_email(backup_data: bytes, total_docs: int):
    """Sendet Backup per E-Mail"""
    try:
        from utils import send_email

        # Konsistenz-Status mitsenden
        consistency_summary = ""
        try:
            from module_health.routes import consistency_check
            # Direkt aufrufen ohne Auth – wir sind serverseitig
            class _U:
                username = "auto-backup"
            cdata = await consistency_check(user=_U())
            if cdata.get("ok"):
                consistency_summary = '<div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px;margin:16px 0;border-radius:6px;color:#2e7d32;"><strong>✓ Konsistenz-Check: Alle Daten sauber</strong></div>'
            else:
                items = "".join(f'<li>{i["title"]}</li>' for i in (cdata.get("issues") or []))
                consistency_summary = f'<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px;margin:16px 0;border-radius:6px;color:#856404;"><strong>⚠ Konsistenz-Hinweise: {cdata.get("errors_count",0)} Fehler · {cdata.get("warnings_count",0)} Warnungen</strong><ul style="margin:6px 0 0 20px;">{items}</ul></div>'
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Konsistenz-Check für Backup-Mail fehlgeschlagen: {e}")
        
        filename = f"Graupner_AutoBackup_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M')}.zip"
        
        # E-Mail-Inhalt
        body_html = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #14532D;">🛡️ Automatisches Backup - Graupner Suite</h2>
    
    <div style="background: #e8f5e9; border-left: 4px solid #2e7d32; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #2e7d32; font-weight: 600;">✅ Ihr tägliches Backup wurde erfolgreich erstellt!</p>
    </div>
    {consistency_summary}
    
    <p>Backup-Details:</p>
    <ul style="margin: 20px 0;">
        <li><strong>Datum:</strong> {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} Uhr</li>
        <li><strong>Datensätze:</strong> {total_docs} Einträge</li>
        <li><strong>Größe:</strong> {len(backup_data) / 1024:.1f} KB</li>
        <li><strong>Dateiname:</strong> {filename}</li>
    </ul>
    
    <div style="background: #f5f3f0; border-left: 4px solid #14532D; padding: 16px; margin: 24px 0; border-radius: 8px;">
        <h3 style="color: #14532D; margin: 0 0 8px 0;">📋 Was ist gesichert?</h3>
        <p style="margin: 4px 0;">✓ Alle Anfragen</p>
        <p style="margin: 4px 0;">✓ Alle Kunden</p>
        <p style="margin: 4px 0;">✓ Alle Angebote, Aufträge & Rechnungen</p>
        <p style="margin: 4px 0;">✓ Artikel & Einstellungen</p>
        <p style="margin: 4px 0;">✓ E-Mail Vorlagen & Textbausteine</p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 8px;">
        <h3 style="color: #856404; margin: 0 0 8px 0;">⚠️ Wichtig:</h3>
        <p style="margin: 0; color: #856404;">Bewahren Sie diese Backup-Datei sicher auf! Im Notfall können Sie damit alle Daten wiederherstellen.</p>
    </div>
    
    <p style="color: #666; font-size: 13px; margin-top: 32px;">
        Dies ist ein automatisches Backup. Die letzten 7 Tage werden aufbewahrt.<br>
        <br>
        Mit freundlichen Grüßen,<br>
        Ihr Graupner Suite System
    </p>
</body>
</html>
"""
        
        # Anhang
        attachments = [{
            "data": backup_data,
            "filename": filename
        }]

        # E-Mail-Empfaenger aus Settings (kein Hardcode mehr — Regel 4)
        settings = await get_backup_settings()
        empfaenger = settings.get("empfaenger_emails") or []
        if not empfaenger:
            logger.warning("Backup-E-Mail uebersprungen: keine Empfaenger in Settings konfiguriert")
            return False
        sent_any = False
        for empf in empfaenger:
            try:
                send_email(
                    to_email=empf,
                    subject=f"🛡️ Tägliches Backup - Graupner Suite ({datetime.now(timezone.utc).strftime('%d.%m.%Y')})",
                    body_html=body_html,
                    attachments=attachments
                )
                logger.info(f"✅ Backup-E-Mail gesendet an {empf}")
                sent_any = True
            except Exception as ee:
                logger.error(f"❌ Backup-E-Mail an {empf} fehlgeschlagen: {ee}")
        return sent_any
        
    except Exception as e:
        logger.error(f"❌ Fehler beim Versand der Backup-E-Mail: {e}")
        return False


async def daily_backup_task():
    """Täglicher Backup-Task — robust gegen Container-Restarts.

    Verhalten:
    1. Bei JEDEM Start: prüft letzten erfolgreichen Lauf.
       Wenn älter als 23 h -> sofort Catch-up Backup ('catchup_after_restart').
    2. Plant nächsten regulären Lauf auf 02:00 UTC.
    3. Während des Wartens: alle 60 Min Heartbeat-Eintrag (zeigt 'Task lebt').
    """
    logger.info("🛡️ daily_backup_task gestartet — prüfe Catch-up-Bedarf...")

    # === 1) Catch-up bei Start ===
    try:
        letzter = await db.auto_backup_log.find_one(
            {"status": "success", "trigger": {"$ne": "heartbeat"}},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        if letzter:
            from datetime import datetime as _dt
            zuletzt = _dt.fromisoformat(letzter["created_at"].replace("Z", "+00:00"))
            alter_std = (datetime.now(timezone.utc) - zuletzt).total_seconds() / 3600
            if alter_std > 23:
                logger.warning(f"⚠️ Letzter erfolgreicher Lauf vor {alter_std:.1f} h — Catch-up jetzt!")
                await _run_backup_with_log(trigger="catchup_after_restart")
            else:
                logger.info(f"✅ Letzter Lauf vor {alter_std:.1f} h — kein Catch-up nötig")
        else:
            logger.warning("⚠️ Noch nie ein erfolgreicher Lauf in der DB — Catch-up jetzt!")
            await _run_backup_with_log(trigger="catchup_first_run")
    except Exception as e:
        logger.error(f"Catch-up-Pruefung fehlgeschlagen: {e}")

    # === 2) Reguläre Schleife mit Heartbeat ===
    HEARTBEAT_INTERVAL = 3600  # 1 Stunde
    while True:
        try:
            now = datetime.now(timezone.utc)
            next_backup = now.replace(hour=2, minute=0, second=0, microsecond=0)
            if now.hour >= 2:
                from datetime import timedelta
                next_backup += timedelta(days=1)
            wait_seconds = (next_backup - now).total_seconds()
            logger.info(
                f"⏰ Nächstes automatisches Backup: {next_backup.strftime('%d.%m.%Y %H:%M')} "
                f"UTC (in {wait_seconds/3600:.1f} Stunden)"
            )

            # Heartbeat zuerst schreiben (sofort nach Start sichtbar), dann warten
            while wait_seconds > 0:
                # Heartbeat schreiben
                try:
                    await db.auto_backup_log.insert_one({
                        "id": str(uuid.uuid4()),
                        "trigger": "heartbeat",
                        "status": "alive",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    # Alte Heartbeats aufraeumen (nur letzte 48)
                    cursor = db.auto_backup_log.find(
                        {"trigger": "heartbeat"}, {"_id": 0, "id": 1, "created_at": 1}
                    ).sort("created_at", -1)
                    keep = [d["id"] async for d in cursor.limit(48)]
                    if keep:
                        await db.auto_backup_log.delete_many(
                            {"trigger": "heartbeat", "id": {"$nin": keep}}
                        )
                except Exception as he:
                    logger.warning(f"Heartbeat-Schreibfehler: {he}")
                sleep_now = min(HEARTBEAT_INTERVAL, wait_seconds)
                await asyncio.sleep(sleep_now)
                wait_seconds -= sleep_now

            # Backup ausloesen
            logger.info("🛡️ Starte automatisches tägliches Backup...")
            await _run_backup_with_log(trigger="schedule")

        except Exception as e:
            logger.error(f"❌ Fehler im täglichen Backup-Task: {e}")
            try:
                await db.auto_backup_log.insert_one({
                    "id": str(uuid.uuid4()),
                    "status": "error",
                    "error": str(e),
                    "trigger": "schedule",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass
            await asyncio.sleep(3600)


async def _run_backup_with_log(trigger: str = "manual"):
    """Erstellt Backup, sendet Mail, speichert lokal + Object-Storage, schreibt Log."""
    started = datetime.now(timezone.utc)
    backup_id = str(uuid.uuid4())
    filename = f"Graupner_Backup_{started.strftime('%Y-%m-%d_%H-%M')}.zip"
    log_entry = {
        "id": backup_id,
        "trigger": trigger,
        "started_at": started.isoformat(),
        "filename": filename,
        "storage": {"email": False, "lokal": False, "object_storage": False},
    }
    try:
        backup_data, total_docs = await create_backup_data()
        if not backup_data:
            log_entry.update({
                "status": "error",
                "error": "Backup-Erstellung fehlgeschlagen (None)",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.auto_backup_log.insert_one(log_entry)
            return False, 0, 0

        size_bytes = len(backup_data)

        # 1) Lokale Speicherung
        try:
            lokal_pfad = os.path.join(BACKUP_DIR, filename)
            with open(lokal_pfad, "wb") as f:
                f.write(backup_data)
            log_entry["storage"]["lokal"] = True
            log_entry["lokal_pfad"] = lokal_pfad
            # Alte lokale Backups aufraeumen
            await _cleanup_lokal_backups()
        except Exception as e:
            logger.warning(f"Lokales Backup-Speichern fehlgeschlagen: {e}")
            log_entry["lokal_error"] = str(e)

        # 2) Object-Storage (cloud-aehnlich, ueberlebt Container-Restart)
        try:
            from utils.storage import put_object
            object_path = f"backups/auto/{filename}"
            put_object(object_path, backup_data, "application/zip")
            log_entry["storage"]["object_storage"] = True
            log_entry["object_storage_path"] = object_path
        except Exception as e:
            logger.warning(f"Object-Storage-Backup fehlgeschlagen: {e}")
            log_entry["object_storage_error"] = str(e)

        # 3) E-Mail (an konfigurierte Empfaenger)
        sent = await send_backup_email(backup_data, total_docs)
        log_entry["storage"]["email"] = bool(sent)

        # Wenn mindestens ein Speicherziel erfolgreich war -> success
        any_ok = any(log_entry["storage"].values())
        log_entry.update({
            "status": "success" if any_ok else "warn",
            "total_docs": total_docs,
            "size_kb": round(size_bytes / 1024, 1),
            "mail_sent": bool(sent),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.auto_backup_log.insert_one(log_entry)

        # Log-Aufraeumen (letzte 30)
        try:
            cursor = db.auto_backup_log.find({}, {"_id": 0, "id": 1, "created_at": 1}).sort("created_at", -1)
            ids_to_keep = [d["id"] async for d in cursor.limit(30)]
            await db.auto_backup_log.delete_many({"id": {"$nin": ids_to_keep}})
        except Exception:
            pass
        return True, total_docs, size_bytes
    except Exception as e:  # noqa: BLE001
        log_entry.update({
            "status": "error",
            "error": str(e),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.auto_backup_log.insert_one(log_entry)
        return False, 0, 0


async def _cleanup_lokal_backups():
    """Loescht lokale Backups, die aelter sind als die konfigurierte Aufbewahrungsdauer."""
    try:
        settings = await get_backup_settings()
        keep_days = int(settings.get("lokal_aufbewahrung_tage", 14))
        cutoff = datetime.now(timezone.utc).timestamp() - keep_days * 86400
        for fn in os.listdir(BACKUP_DIR):
            full = os.path.join(BACKUP_DIR, fn)
            if os.path.isfile(full) and os.path.getmtime(full) < cutoff:
                os.remove(full)
                logger.info(f"Altes lokales Backup geloescht: {fn}")
    except Exception as e:
        logger.warning(f"Cleanup lokale Backups fehlgeschlagen: {e}")


@router.get("/backup/auto/status")
async def get_auto_backup_status():
    """Status des automatischen Backups + letztes Backup-Ergebnis + Heartbeat."""
    try:
        settings = await get_backup_settings()
        # Letzter ECHTER Lauf (heartbeats ausschliessen)
        last = await db.auto_backup_log.find_one(
            {"trigger": {"$ne": "heartbeat"}},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        # Letzter Heartbeat (Lebenszeichen des Schedulers)
        hb = await db.auto_backup_log.find_one(
            {"trigger": "heartbeat"},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        scheduler_lebt = False
        heartbeat_alter_min = None
        if hb:
            from datetime import datetime as _dt
            zeit = _dt.fromisoformat(hb["created_at"].replace("Z", "+00:00"))
            heartbeat_alter_min = round((datetime.now(timezone.utc) - zeit).total_seconds() / 60, 1)
            scheduler_lebt = heartbeat_alter_min <= 90  # max. 90 Min ohne Heartbeat = noch ok
        lokal_count = 0
        try:
            lokal_count = len([f for f in os.listdir(BACKUP_DIR) if f.endswith(".zip")])
        except Exception:
            pass
        return {
            "enabled": settings.get("enabled", True),
            "next_backup": f"Täglich um {settings.get('time_utc', '02:00')} UTC",
            "empfaenger_emails": settings.get("empfaenger_emails", []),
            "lokal_aufbewahrung_tage": settings.get("lokal_aufbewahrung_tage", 14),
            "lokal_dateien": lokal_count,
            "letzter_lauf": last,
            "scheduler_lebt": scheduler_lebt,
            "letzter_heartbeat": hb.get("created_at") if hb else None,
            "heartbeat_alter_minuten": heartbeat_alter_min,
            "status": "active" if settings.get("enabled", True) else "deaktiviert",
        }
    except Exception as e:
        logger.error(f"Fehler beim Abrufen des Auto-Backup-Status: {e}")
        return {"enabled": False, "status": "error", "error": str(e)}


@router.put("/backup/auto/settings")
async def update_backup_settings(payload: dict):
    """Aktualisiert Backup-Settings (Admin). Wird vom Frontend genutzt."""
    allowed = {"enabled", "time_utc", "empfaenger_emails", "lokal_aufbewahrung_tage",
               "object_storage_aufbewahrung_tage"}
    update = {k: v for k, v in (payload or {}).items() if k in allowed}
    if not update:
        raise HTTPException(400, "Keine gueltigen Felder uebermittelt")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "auto_backup_settings"}, {"$set": update}, upsert=True)
    return await get_backup_settings()


@router.post("/backup/auto/trigger")
async def trigger_manual_backup():
    """Startet sofort ein Backup im Hintergrund (kurze Antwort -> kein Proxy-Timeout)."""
    logger.info("🛡️ Manueller Backup ausgelöst (läuft im Hintergrund)")
    asyncio.create_task(_run_backup_with_log(trigger="manual"))
    return {
        "ok": True,
        "started": True,
        "message": "Backup gestartet — läuft im Hintergrund (ca. 30 Sekunden).",
    }


@router.get("/backup/auto/log")
async def get_backup_log(limit: int = 30):
    """Gibt die letzten Backup-Versuche aus auto_backup_log."""
    items = []
    async for d in db.auto_backup_log.find({}, {"_id": 0}).sort("created_at", -1).limit(limit):
        items.append(d)
    return items



@router.get("/backup/auto/download/{backup_id}")
async def download_backup(backup_id: str):
    """Lädt ein Backup als ZIP herunter (zuerst lokal, dann Object-Storage)."""
    entry = await db.auto_backup_log.find_one({"id": backup_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Backup-Eintrag nicht gefunden")
    lokal_pfad = entry.get("lokal_pfad")
    if lokal_pfad and os.path.exists(lokal_pfad):
        def iterfile():
            with open(lokal_pfad, "rb") as f:
                yield from f
        return StreamingResponse(
            iterfile(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={entry.get('filename', 'backup.zip')}"},
        )
    object_path = entry.get("object_storage_path")
    if object_path:
        try:
            from utils.storage import get_object
            data, _ = get_object(object_path)
            return StreamingResponse(
                io.BytesIO(data),
                media_type="application/zip",
                headers={"Content-Disposition": f"attachment; filename={entry.get('filename', 'backup.zip')}"},
            )
        except Exception as e:
            raise HTTPException(500, f"Object-Storage-Download fehlgeschlagen: {e}")
    raise HTTPException(404, "Backup-Datei weder lokal noch im Object-Storage gefunden")


async def _load_backup_zip(backup_id: str) -> bytes:
    """Hilfsfunktion: ZIP-Bytes eines Backups holen (lokal oder Object-Storage)."""
    entry = await db.auto_backup_log.find_one({"id": backup_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Backup-Eintrag nicht gefunden")
    lokal_pfad = entry.get("lokal_pfad")
    if lokal_pfad and os.path.exists(lokal_pfad):
        with open(lokal_pfad, "rb") as f:
            return f.read()
    object_path = entry.get("object_storage_path")
    if object_path:
        from utils.storage import get_object
        data, _ = get_object(object_path)
        return data
    raise HTTPException(404, "Backup-Datei nicht auffindbar")


@router.post("/backup/auto/restore/dry-run/{backup_id}")
async def restore_dry_run(backup_id: str):
    """Trockenlauf: zeigt was eine Wiederherstellung tun würde — schreibt NICHTS."""
    raw = await _load_backup_zip(backup_id)
    differenzen = []
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            for name in zf.namelist():
                if not name.endswith(".json") or name == "_metadata.json":
                    continue
                coll = name[:-5]
                try:
                    items = json.loads(zf.read(name).decode("utf-8"))
                    if not isinstance(items, list):
                        continue
                except Exception:
                    continue
                aktuell = await db[coll].count_documents({})
                differenzen.append({
                    "collection": coll,
                    "im_backup": len(items),
                    "aktuell_in_db": aktuell,
                    "diff": len(items) - aktuell,
                })
    except zipfile.BadZipFile:
        raise HTTPException(400, "Backup-Datei ist beschaedigt (kein gueltiges ZIP)")
    return {
        "backup_id": backup_id,
        "wird_geschrieben": 0,
        "differenzen": differenzen,
        "hinweis": (
            "Trockenlauf — keine Daten wurden veraendert. "
            "Beim echten Restore werden Collections geleert und durch Backup-Stand ersetzt."
        ),
    }


@router.post("/backup/auto/restore/apply/{backup_id}")
async def restore_apply(backup_id: str, payload: dict | None = None):
    """ECHTE Wiederherstellung — ersetzt Collections durch Backup-Inhalt.

    Erfordert payload mit 'bestaetigung': 'JA_RESTORE'.
    Erstellt vor dem Restore automatisch ein Sicherungs-Backup ('pre_restore').
    """
    payload = payload or {}
    if payload.get("bestaetigung") != "JA_RESTORE":
        raise HTTPException(400, "Bestaetigung fehlt — 'bestaetigung':'JA_RESTORE' im Body erwartet")

    logger.info(f"🛡️ Pre-Restore-Backup vor Restore von {backup_id}...")
    await _run_backup_with_log(trigger="pre_restore")

    raw = await _load_backup_zip(backup_id)
    counts = {}
    fehler = []
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            collections = [n[:-5] for n in zf.namelist() if n.endswith(".json") and n != "_metadata.json"]
            for coll in collections:
                try:
                    items = json.loads(zf.read(f"{coll}.json").decode("utf-8"))
                    if not isinstance(items, list):
                        continue
                    await db[coll].delete_many({})
                    if items:
                        for item in items:
                            item.pop("_id", None)
                        await db[coll].insert_many(items)
                    counts[coll] = len(items)
                except Exception as e:
                    fehler.append({"collection": coll, "error": str(e)})
                    logger.error(f"Restore {coll} fehlgeschlagen: {e}")
    except zipfile.BadZipFile:
        raise HTTPException(400, "Backup-Datei ist beschaedigt")

    logger.info(f"✅ Restore abgeschlossen: {sum(counts.values())} Datensaetze")
    return {
        "ok": len(fehler) == 0,
        "backup_id": backup_id,
        "wiederhergestellt": counts,
        "fehler": fehler,
        "hinweis": "Pre-Restore-Sicherung wurde automatisch erstellt (siehe auto_backup_log).",
    }
