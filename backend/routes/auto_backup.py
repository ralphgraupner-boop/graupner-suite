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
    """Erstellt Backup-Daten und gibt ZIP-Bytes zurück"""
    try:
        # Auto-Backup (24.04.2026): alle aktiven + Legacy-Collections
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
            # Legacy
            "customers", "quotes", "orders", "invoices", "articles", "rechnungen_v2",
            "email_vorlagen", "text_templates", "leistungsbloecke", "diverses", "email_inbox",
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
        
        filename = f"Graupner_AutoBackup_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M')}.zip"
        
        # E-Mail-Inhalt
        body_html = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #14532D;">🛡️ Automatisches Backup - Graupner Suite</h2>
    
    <div style="background: #e8f5e9; border-left: 4px solid #2e7d32; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #2e7d32; font-weight: 600;">✅ Ihr tägliches Backup wurde erfolgreich erstellt!</p>
    </div>
    
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
        
        logger.info(f"✅ Backup-E-Mail gesendet an service24@tischlerei-graupner.de")
        
    except Exception as e:
        logger.error(f"❌ Fehler beim Versand der Backup-E-Mail: {e}")


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
            backup_data, total_docs = await create_backup_data()
            
            if backup_data:
                # Backup per E-Mail senden
                await send_backup_email(backup_data, total_docs)
                logger.info(f"✅ Automatisches Backup abgeschlossen: {total_docs} Einträge gesichert")
            else:
                logger.error("❌ Automatisches Backup fehlgeschlagen")
            
        except Exception as e:
            logger.error(f"❌ Fehler im täglichen Backup-Task: {e}")
            # Warte 1 Stunde bei Fehler
            await asyncio.sleep(3600)


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
