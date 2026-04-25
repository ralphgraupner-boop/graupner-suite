from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from database import db, logger
from auth import get_current_user
import json
import zipfile
import io
from typing import List, Optional

router = APIRouter()


@router.get("/backup/collections")
async def get_available_collections(user=Depends(get_current_user)):
    """Liste aller verfügbaren Collections für Backup (inkl. v2/v4-Module, 24.04.2026)"""
    collections = [
        # === Aktuell in Nutzung ===
        {"id": "module_kunden", "name": "Kunden (Haupt)", "icon": "👥", "group": "kern"},
        {"id": "module_artikel", "name": "Artikel & Leistungen", "icon": "🛠️", "group": "kern"},
        {"id": "module_dokumente", "name": "Dokumente (Legacy)", "icon": "📄", "group": "kern"},
        {"id": "module_textvorlagen", "name": "Textvorlagen", "icon": "📝", "group": "kern"},
        {"id": "module_kontakt", "name": "Kontakte (Legacy)", "icon": "📇", "group": "kern"},
        {"id": "einsaetze", "name": "Einsätze", "icon": "🔧", "group": "kern"},
        {"id": "mitarbeiter", "name": "Mitarbeiter", "icon": "👷", "group": "kern"},
        {"id": "anfragen", "name": "Anfragen (Legacy)", "icon": "📋", "group": "kern"},
        {"id": "settings", "name": "Einstellungen", "icon": "⚙️", "group": "kern"},
        {"id": "users", "name": "Benutzer", "icon": "🔑", "group": "kern"},
        # === Dokumente v2 Modul ===
        {"id": "dokumente_v2", "name": "Dokumente v2", "icon": "📑", "group": "dokumente_v2"},
        {"id": "dokumente_v2_counters", "name": "Dokumente v2 Nummernzähler", "icon": "🔢", "group": "dokumente_v2"},
        {"id": "dokumente_v2_counter_log", "name": "Dokumente v2 GoBD-Audit", "icon": "📊", "group": "dokumente_v2"},
        {"id": "dokumente_v2_settings", "name": "Dokumente v2 Einstellungen", "icon": "⚙️", "group": "dokumente_v2"},
        # === Kundenportal v2 (LIVE) ===
        {"id": "portal2_accounts", "name": "Kundenportal v2 Accounts", "icon": "🔐", "group": "portal_v2"},
        {"id": "portal2_messages", "name": "Kundenportal v2 Nachrichten", "icon": "💬", "group": "portal_v2"},
        {"id": "portal2_uploads", "name": "Kundenportal v2 Uploads", "icon": "📎", "group": "portal_v2"},
        {"id": "portal2_settings", "name": "Kundenportal v2 Einstellungen", "icon": "⚙️", "group": "portal_v2"},
        # === Kundenportal v3 (Sandbox) ===
        {"id": "portal3_accounts", "name": "Kundenportal v3 Accounts", "icon": "🔐", "group": "portal_v3"},
        {"id": "portal3_messages", "name": "Kundenportal v3 Nachrichten", "icon": "💬", "group": "portal_v3"},
        {"id": "portal3_uploads", "name": "Kundenportal v3 Uploads", "icon": "📎", "group": "portal_v3"},
        {"id": "portal3_settings", "name": "Kundenportal v3 Einstellungen", "icon": "⚙️", "group": "portal_v3"},
        # === Kundenportal v4 (Sandbox mit Dokumente-Anbindung) ===
        {"id": "portal4_accounts", "name": "Kundenportal v4 Accounts", "icon": "🔐", "group": "portal_v4"},
        {"id": "portal4_messages", "name": "Kundenportal v4 Nachrichten", "icon": "💬", "group": "portal_v4"},
        {"id": "portal4_uploads", "name": "Kundenportal v4 Uploads", "icon": "📎", "group": "portal_v4"},
        {"id": "portal4_settings", "name": "Kundenportal v4 Einstellungen", "icon": "⚙️", "group": "portal_v4"},
        # === Monteur-App Modul ===
        {"id": "monteur_app_settings", "name": "Monteur-App Einstellungen", "icon": "⚙️", "group": "monteur_app"},
        {"id": "monteur_app_notizen", "name": "Monteur-App Notizen", "icon": "📝", "group": "monteur_app"},
        {"id": "monteur_app_fotos", "name": "Monteur-App Fotos", "icon": "📷", "group": "monteur_app"},
        # === Duplikate-Modul ===
        {"id": "module_duplikate_settings", "name": "Duplikate-Modul Einstellungen", "icon": "⚙️", "group": "module_duplikate"},
        {"id": "duplikate_ignored", "name": "Duplikate Ignoriert", "icon": "🙈", "group": "module_duplikate"},
        {"id": "duplikate_merge_log", "name": "Duplikate Merge-Log", "icon": "📑", "group": "module_duplikate"},
        # === Projekte-Modul ===
        {"id": "module_projekte", "name": "Projekte", "icon": "🗂️", "group": "module_projekte"},
        {"id": "module_projekte_settings", "name": "Projekte-Modul Einstellungen", "icon": "⚙️", "group": "module_projekte"},
        # === Portal-v2-Backup-Modul ===
        {"id": "portal_v2_backups", "name": "Portal v2 Sicherungen", "icon": "🛡️", "group": "module_portal_v2_backup"},
        # === Legacy ===
        {"id": "customers", "name": "Kunden (Alt)", "icon": "👥", "group": "legacy"},
        {"id": "quotes", "name": "Angebote (Alt)", "icon": "📄", "group": "legacy"},
        {"id": "orders", "name": "Aufträge (Alt)", "icon": "📦", "group": "legacy"},
        {"id": "invoices", "name": "Rechnungen (Alt)", "icon": "💰", "group": "legacy"},
        {"id": "articles", "name": "Artikel (Alt)", "icon": "🛠️", "group": "legacy"},
        {"id": "rechnungen_v2", "name": "Rechnungen v2 (Test)", "icon": "🧾", "group": "legacy"},
        {"id": "email_vorlagen", "name": "E-Mail Vorlagen", "icon": "✉️", "group": "legacy"},
        {"id": "text_templates", "name": "Textvorlagen (Alt)", "icon": "📝", "group": "legacy"},
        {"id": "leistungsbloecke", "name": "Leistungsblöcke", "icon": "📊", "group": "legacy"},
        {"id": "diverses", "name": "Diverses/Info", "icon": "ℹ️", "group": "legacy"},
    ]
    
    # Zähle Einträge pro Collection
    for coll in collections:
        try:
            count = await db[coll["id"]].count_documents({})
            coll["count"] = count
        except Exception:
            coll["count"] = 0
    
    return collections


@router.get("/backup/export")
async def export_backup(
    collections: Optional[str] = None,
    user=Depends(get_current_user)
):
    """
    Exportiert ausgewählte Collections als ZIP-Archiv
    
    Query-Parameter:
    - collections: Komma-getrennte Liste (z.B. "anfragen,customers,invoices")
    """
    try:
        # Parse collections parameter
        if not collections:
            # Default: ALLE aktiven + Legacy-Collections (24.04.2026)
            selected = [
                # Kern
                "module_kunden", "module_artikel", "module_dokumente", "module_textvorlagen",
                "module_kontakt", "einsaetze", "mitarbeiter", "anfragen", "settings", "users",
                # Dokumente v2
                "dokumente_v2", "dokumente_v2_counters", "dokumente_v2_counter_log", "dokumente_v2_settings",
                # Portal v2 (LIVE)
                "portal2_accounts", "portal2_messages", "portal2_uploads", "portal2_settings",
                # Portal v3 (Sandbox)
                "portal3_accounts", "portal3_messages", "portal3_uploads", "portal3_settings",
                # Portal v4 (Sandbox)
                "portal4_accounts", "portal4_messages", "portal4_uploads", "portal4_settings",
                # Monteur-App
                "monteur_app_settings", "monteur_app_notizen", "monteur_app_fotos",
                # Duplikate-Modul
                "module_duplikate_settings", "duplikate_ignored", "duplikate_merge_log",
                # Projekte-Modul
                "module_projekte", "module_projekte_settings",
                # Portal-v2-Backup
                "portal_v2_backups",
                # Legacy
                "customers", "quotes", "orders", "invoices", "articles", "rechnungen_v2",
                "email_vorlagen", "text_templates", "leistungsbloecke", "diverses",
            ]
        else:
            selected = [c.strip() for c in collections.split(",")]
        
        # Erstelle ZIP in Memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Metadata
            metadata = {
                "backup_date": datetime.now(timezone.utc).isoformat(),
                "app_version": "1.0.0",
                "collections": selected,
                "created_by": user.get("username", "unknown")
            }
            zip_file.writestr("_metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False))
            
            # Export jede Collection
            total_docs = 0
            for coll_name in selected:
                try:
                    # Alle Dokumente ohne _id holen
                    docs = await db[coll_name].find({}, {"_id": 0}).to_list(None)
                    
                    if docs:
                        # Als JSON speichern
                        json_data = json.dumps(docs, indent=2, ensure_ascii=False, default=str)
                        zip_file.writestr(f"{coll_name}.json", json_data)
                        total_docs += len(docs)
                        logger.info(f"Backup: {coll_name} ({len(docs)} Einträge)")
                except Exception as e:
                    logger.error(f"Fehler beim Backup von {coll_name}: {e}")
                    # Weiter mit nächster Collection
            
            # README hinzufügen
            readme = f"""Graupner Suite Backup
=====================

Erstellt am: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M:%S')} UTC
Benutzer: {user.get('username', 'unknown')}
Collections: {len(selected)}
Gesamt Einträge: {total_docs}

Collections in diesem Backup:
{chr(10).join(f'- {c}.json' for c in selected)}

Wiederherstellung:
------------------
Laden Sie dieses ZIP-Archiv in den Einstellungen unter 
"Backup & Wiederherstellung" hoch.

WICHTIG: Bei der Wiederherstellung werden bestehende Daten ÜBERSCHRIEBEN!
"""
            zip_file.writestr("README.txt", readme)
        
        # ZIP-Buffer zurücksetzen
        zip_buffer.seek(0)
        
        # Dateiname mit Timestamp
        filename = f"Graupner_Backup_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M')}.zip"
        
        logger.info(f"Backup erstellt: {filename} ({total_docs} Einträge)")
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Backup-Export fehlgeschlagen: {e}")
        raise HTTPException(500, f"Backup fehlgeschlagen: {str(e)}")


@router.post("/backup/import")
async def import_backup(
    file: UploadFile = File(...),
    mode: str = "merge",  # "merge" oder "replace"
    user=Depends(get_current_user)
):
    """
    Importiert ein Backup-ZIP
    
    Parameter:
    - file: ZIP-Archiv vom Export
    - mode: "merge" (ergänzen) oder "replace" (ersetzen)
    """
    try:
        if not file.filename.endswith('.zip'):
            raise HTTPException(400, "Nur ZIP-Dateien erlaubt")
        
        # ZIP in Memory lesen
        content = await file.read()
        zip_buffer = io.BytesIO(content)
        
        imported_collections = []
        total_imported = 0
        
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            # Metadata lesen
            metadata = None
            if "_metadata.json" in zip_file.namelist():
                metadata = json.loads(zip_file.read("_metadata.json"))
                logger.info(f"Importiere Backup vom {metadata.get('backup_date')}")
            
            # Jede JSON-Datei importieren
            for filename in zip_file.namelist():
                if filename.endswith('.json') and not filename.startswith('_'):
                    collection_name = filename.replace('.json', '')
                    
                    try:
                        # JSON parsen
                        json_data = zip_file.read(filename)
                        docs = json.loads(json_data)
                        
                        if not docs:
                            continue
                        
                        # Import-Modus
                        if mode == "replace":
                            # Alle löschen, dann neu einfügen
                            await db[collection_name].delete_many({})
                            logger.info(f"Collection {collection_name} geleert (replace mode)")
                        
                        # Dokumente einfügen
                        if isinstance(docs, list) and len(docs) > 0:
                            # Upsert für jeden Eintrag (verhindert Duplikate)
                            for doc in docs:
                                if "id" in doc:
                                    await db[collection_name].update_one(
                                        {"id": doc["id"]},
                                        {"$set": doc},
                                        upsert=True
                                    )
                                else:
                                    await db[collection_name].insert_one(doc)
                            
                            imported_collections.append(collection_name)
                            total_imported += len(docs)
                            logger.info(f"Importiert: {collection_name} ({len(docs)} Einträge)")
                        
                    except Exception as e:
                        logger.error(f"Fehler beim Import von {collection_name}: {e}")
                        # Weiter mit nächster Collection
        
        return {
            "message": "Backup erfolgreich importiert",
            "collections": imported_collections,
            "total_documents": total_imported,
            "mode": mode,
            "metadata": metadata
        }
        
    except zipfile.BadZipFile:
        raise HTTPException(400, "Ungültige ZIP-Datei")
    except Exception as e:
        logger.error(f"Backup-Import fehlgeschlagen: {e}")
        raise HTTPException(500, f"Import fehlgeschlagen: {str(e)}")


@router.get("/backup/stats")
async def get_backup_stats(user=Depends(get_current_user)):
    """Statistiken für Dashboard"""
    try:
        total_docs = 0
        collections_info = []
        
        important_collections = [
            "module_kunden", "module_artikel", "module_dokumente",
            "einsaetze", "dokumente_v2",
            "portal2_accounts", "portal4_accounts",
        ]
        
        for coll_name in important_collections:
            count = await db[coll_name].count_documents({})
            total_docs += count
            collections_info.append({"name": coll_name, "count": count})
        
        # Schätze Backup-Größe (grob)
        estimated_size_mb = total_docs * 0.001  # ~1KB pro Dokument
        
        return {
            "total_documents": total_docs,
            "collections": collections_info,
            "estimated_size_mb": round(estimated_size_mb, 2)
        }
    except Exception as e:
        logger.error(f"Backup-Stats fehlgeschlagen: {e}")
        return {"total_documents": 0, "collections": [], "estimated_size_mb": 0}
