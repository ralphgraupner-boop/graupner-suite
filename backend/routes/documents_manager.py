from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from datetime import datetime, timezone
from database import db, logger
from uuid import uuid4
import os

router = APIRouter()


@router.post("/settings/documents/upload")
async def upload_document(file: UploadFile = File(...), category: str = "allgemein"):
    """PDF-Dokument hochladen"""
    try:
        # Validierung
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Nur PDF-Dateien erlaubt")
        
        # Datei lesen
        content = await file.read()
        
        if len(content) > 10 * 1024 * 1024:  # 10 MB Limit
            raise HTTPException(status_code=400, detail="Datei zu groß (max. 10 MB)")
        
        # Im Object Storage speichern
        from utils.storage import put_object
        
        safe_filename = file.filename.replace(" ", "_")
        storage_path = f"documents/{category}/{uuid4().hex[:8]}_{safe_filename}"
        
        result = put_object(storage_path, content, "application/pdf")
        
        # In Datenbank speichern
        document = {
            "id": str(uuid4()),
            "filename": file.filename,
            "category": category,
            "storage_path": storage_path,
            "url": result.get("url") or result.get("path"),
            "size": len(content),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        
        await db.documents.insert_one(document)
        document.pop("_id", None)
        
        logger.info(f"✅ Dokument hochgeladen: {file.filename} ({category})")
        
        return {"message": "Dokument hochgeladen", "document": document}
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Hochladen des Dokuments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/documents")
async def get_documents(category: str = None):
    """Alle Dokumente abrufen"""
    try:
        query = {}
        if category:
            query["category"] = category
        
        documents = await db.documents.find(query, {"_id": 0}).to_list(1000)
        documents.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
        
        return documents
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Abrufen der Dokumente: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/settings/documents/{document_id}")
async def delete_document(document_id: str):
    """Dokument löschen"""
    try:
        # Dokument aus DB holen
        document = await db.documents.find_one({"id": document_id}, {"_id": 0})
        
        if not document:
            raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
        
        # Aus Object Storage löschen
        try:
            from utils.storage import delete_object
            delete_object(document["storage_path"])
        except Exception as e:
            logger.warning(f"Fehler beim Löschen aus Object Storage: {e}")
        
        # Aus DB löschen
        await db.documents.delete_one({"id": document_id})
        
        logger.info(f"✅ Dokument gelöscht: {document['filename']}")
        
        return {"message": "Dokument gelöscht"}
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Löschen des Dokuments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/documents/{document_id}/download")
async def download_document(document_id: str):
    """Dokument herunterladen"""
    try:
        from fastapi.responses import StreamingResponse
        from utils.storage import get_object
        
        document = await db.documents.find_one({"id": document_id}, {"_id": 0})
        
        if not document:
            raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
        
        # Aus Object Storage holen
        content = get_object(document["storage_path"])
        
        if not content:
            raise HTTPException(status_code=404, detail="Datei nicht gefunden")
        
        return StreamingResponse(
            iter([content]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={document['filename']}"
            }
        )
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Download: {e}")
        raise HTTPException(status_code=500, detail=str(e))
