from fastapi import APIRouter
from datetime import datetime, timezone
from database import db, logger
import json
import zipfile
import io
import asyncio
import os

router = APIRouter()


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
            # Kern
            "module_kunden", "module_artikel", "module_dokumente", "module_textvorlagen",
            "module_kontakt", "einsaetze", "mitarbeiter", "anfragen", "settings", "users",
            # Dokumente v2
            "dokumente_v2", "dokumente_v2_counters", "dokumente_v2_counter_log", "dokumente_v2_settings",
            # Portal v2/v3/v4
            "portal2_accounts", "portal2_messages", "portal2_uploads", "portal2_settings",
            "portal3_accounts", "portal3_messages", "portal3_uploads", "portal3_settings",
            "portal4_accounts", "portal4_messages", "portal4_uploads", "portal4_settings",
            # Portal-Backup-Modul (Snapshots)
            "module_portal_v2_backup_snapshots", "module_portal_v2_backup_settings",
            # NEU 26.04.2026 – Projekte/Aufgaben/Termine/Duplikate/Monteur-App
            "module_projekte", "module_projekte_settings",
            "module_aufgaben", "module_aufgaben_settings",
            "module_termine", "module_termine_settings",
            "module_duplikate", "module_duplikate_settings",
            "monteur_app_settings", "monteur_app_notizen", "monteur_app_fotos",
            "monteur_app_todos", "monteur_app_feedback",
            # NEU 27.04.2026 – User-Prefs (Sidebar-Reihenfolge)
            "module_user_prefs",
            # NEU 27.04.2026 – Kalender-Export (ICS-Mail, Audit, Feed-Tokens)
            "module_kalender_export_log",
            "module_kalender_feed_tokens",
            # NEU 29.04.2026 – Export/Import-Audit
            "module_export_log",
            # NEU 29.04.2026 – Konsistenz-Audit + Backup-Log
            "module_health_audit",
            "auto_backup_log",
            # NEU 29.04.2026 – Lösch-Audit
            "module_kunde_delete_log",
            # Portal-Klon (Sandbox, separat)
            "portal_klon_accounts", "portal_klon_messages", "portal_klon_uploads", "portal_klon_settings",
            # Legacy
            "customers", "quotes", "orders", "invoices", "articles", "rechnungen_v2",
            "email_vorlagen", "text_templates", "leistungsbloecke", "diverses", "email_inbox",
            "portal_files", "portals", "portal_messages",
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
        
        # E-Mail senden
        send_email(
            to_email="service24@tischlerei-graupner.de",
            subject=f"🛡️ Tägliches Backup - Graupner Suite ({datetime.now(timezone.utc).strftime('%d.%m.%Y')})",
            body_html=body_html,
            attachments=attachments
        )
        
        logger.info("✅ Backup-E-Mail gesendet an service24@tischlerei-graupner.de")
        return True
        
    except Exception as e:
        logger.error(f"❌ Fehler beim Versand der Backup-E-Mail: {e}")
        return False


async def daily_backup_task():
    """Täglicher Backup-Task (läuft um 2:00 Uhr)"""
    while True:
        try:
            # Warte bis 2:00 Uhr
            now = datetime.now(timezone.utc)
            next_backup = now.replace(hour=2, minute=0, second=0, microsecond=0)
            
            # Wenn 2 Uhr schon vorbei, dann morgen
            if now.hour >= 2:
                from datetime import timedelta
                next_backup += timedelta(days=1)
            
            wait_seconds = (next_backup - now).total_seconds()
            logger.info(f"⏰ Nächstes automatisches Backup: {next_backup.strftime('%d.%m.%Y %H:%M')} UTC (in {wait_seconds/3600:.1f} Stunden)")
            
            await asyncio.sleep(wait_seconds)
            
            # Backup erstellen
            logger.info("🛡️ Starte automatisches tägliches Backup...")
            await _run_backup_with_log(trigger="schedule")
            
        except Exception as e:
            logger.error(f"❌ Fehler im täglichen Backup-Task: {e}")
            try:
                await db.auto_backup_log.insert_one({
                    "id": str(__import__("uuid").uuid4()),
                    "status": "error",
                    "error": str(e),
                    "trigger": "schedule",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass
            # Warte 1 Stunde bei Fehler
            await asyncio.sleep(3600)


async def _run_backup_with_log(trigger: str = "manual"):
    """Erstellt Backup, sendet Mail und schreibt einen auto_backup_log-Eintrag (success/error)."""
    import uuid
    started = datetime.now(timezone.utc)
    log_entry = {
        "id": str(uuid.uuid4()),
        "trigger": trigger,
        "started_at": started.isoformat(),
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
        sent = await send_backup_email(backup_data, total_docs)
        log_entry.update({
            "status": "success" if sent else "warn",
            "total_docs": total_docs,
            "size_kb": round(len(backup_data) / 1024, 1),
            "mail_sent": bool(sent),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.auto_backup_log.insert_one(log_entry)
        # Aufräumen: nur die letzten 30 Logs behalten
        try:
            cursor = db.auto_backup_log.find({}, {"_id": 0, "id": 1, "created_at": 1}).sort("created_at", -1)
            ids_to_keep = [d["id"] async for d in cursor.limit(30)]
            await db.auto_backup_log.delete_many({"id": {"$nin": ids_to_keep}})
        except Exception:
            pass
        return True, total_docs, len(backup_data)
    except Exception as e:  # noqa: BLE001
        log_entry.update({
            "status": "error",
            "error": str(e),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.auto_backup_log.insert_one(log_entry)
        return False, 0, 0


@router.get("/backup/auto/status")
async def get_auto_backup_status():
    """Status des automatischen Backups"""
    try:
        # Prüfe letzte Backup-E-Mail in der Datenbank (optional)
        settings = await db.settings.find_one({"id": "auto_backup_settings"}, {"_id": 0})
        
        if not settings:
            settings = {
                "enabled": True,
                "time": "02:00",
                "email": "service24@tischlerei-graupner.de",
                "keep_days": 7
            }
        
        return {
            "enabled": settings.get("enabled", True),
            "next_backup": "Täglich um 02:00 Uhr UTC",
            "email": settings.get("email"),
            "keep_days": settings.get("keep_days", 7),
            "status": "active"
        }
    except Exception as e:
        logger.error(f"Fehler beim Abrufen des Auto-Backup-Status: {e}")
        return {"enabled": False, "status": "error"}


@router.post("/backup/auto/trigger")
async def trigger_manual_backup():
    """Löst sofort ein Backup aus und versendet es per E-Mail (Test)."""
    logger.info("🛡️ Manueller Backup-Test ausgelöst")
    ok, total_docs, size_bytes = await _run_backup_with_log(trigger="manual")
    return {
        "ok": ok,
        "total_docs": total_docs,
        "size_kb": round(size_bytes / 1024, 1) if size_bytes else 0,
        "message": "Backup erstellt und Mail gesendet" if ok else "Backup fehlgeschlagen — siehe /api/backup/auto/log",
    }


@router.get("/backup/auto/log")
async def get_backup_log(limit: int = 30):
    """Gibt die letzten Backup-Versuche aus auto_backup_log."""
    items = []
    async for d in db.auto_backup_log.find({}, {"_id": 0}).sort("created_at", -1).limit(limit):
        items.append(d)
    return items
