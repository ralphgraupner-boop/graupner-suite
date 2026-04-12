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
    """Liste aller verfügbaren Collections für Backup"""
    collections = [
        {"id": "anfragen", "name": "Anfragen", "icon": "📋"},
        {"id": "customers", "name": "Kunden", "icon": "👥"},
        {"id": "quotes", "name": "Angebote", "icon": "📄"},
        {"id": "orders", "name": "Aufträge", "icon": "📦"},
        {"id": "invoices", "name": "Rechnungen", "icon": "💰"},
        {"id": "articles", "name": "Artikel", "icon": "🛠️"},
        {"id": "settings", "name": "Einstellungen", "icon": "⚙️"},
        {"id": "email_vorlagen", "name": "E-Mail Vorlagen", "icon": "✉️"},
        {"id": "text_templates", "name": "Textvorlagen", "icon": "📝"},
        {"id": "leistungsbloecke", "name": "Leistungsblöcke", "icon": "📊"},
        {"id": "diverses", "name": "Diverses/Info", "icon": "ℹ️"},
        {"id": "users", "name": "Benutzer", "icon": "👤"},
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
            # Default: alle wichtigen Collections
            selected = ["anfragen", "customers", "quotes", "orders", "invoices", 
                       "articles", "settings", "email_vorlagen", "text_templates", 
                       "leistungsbloecke", "diverses"]
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
        
        important_collections = ["anfragen", "customers", "quotes", "orders", "invoices", "articles"]
        
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
