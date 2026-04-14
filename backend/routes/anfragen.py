from fastapi import APIRouter, HTTPException, File, UploadFile, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from database import db, logger
from uuid import uuid4
from auth import get_current_user

router = APIRouter()


class AnfrageCreate(BaseModel):
    name: str = ""  # Legacy - kombiniert aus Vorname + Nachname
    vorname: str = ""
    nachname: str = ""
    anrede: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    strasse: str = ""
    hausnummer: str = ""
    plz: str = ""
    ort: str = ""
    objektadresse: str = ""
    objekt_strasse: str = ""
    objekt_hausnummer: str = ""
    objekt_plz: str = ""
    objekt_ort: str = ""
    categories: List[str] = []
    nachricht: str = ""
    notes: str = ""
    customer_type: str = "Privat"
    source: str = "manual"
    firma: str = ""


class AnfrageUpdate(BaseModel):
    name: Optional[str] = None
    vorname: Optional[str] = None
    nachname: Optional[str] = None
    anrede: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    strasse: Optional[str] = None
    hausnummer: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    objektadresse: Optional[str] = None
    objekt_strasse: Optional[str] = None
    objekt_hausnummer: Optional[str] = None
    objekt_plz: Optional[str] = None
    objekt_ort: Optional[str] = None
    categories: Optional[List[str]] = None
    nachricht: Optional[str] = None
    notes: Optional[str] = None
    customer_type: Optional[str] = None
    firma: Optional[str] = None
    status: Optional[str] = None


@router.post("/anfragen")
async def create_anfrage(anfrage: AnfrageCreate):
    """Neue Anfrage manuell anlegen"""
    try:
        # Generate combined name from vorname + nachname if not provided
        name = anfrage.name
        if not name and (anfrage.vorname or anfrage.nachname):
            name = f"{anfrage.vorname} {anfrage.nachname}".strip()
        elif not name:
            name = anfrage.firma or "Unbekannt"
        
        new_anfrage = {
            "id": str(uuid4()),
            "name": name,
            "vorname": anfrage.vorname,
            "nachname": anfrage.nachname,
            "anrede": anfrage.anrede,
            "email": anfrage.email,
            "phone": anfrage.phone,
            "address": anfrage.address,
            "objektadresse": anfrage.objektadresse or anfrage.address,
            "categories": anfrage.categories,
            "nachricht": anfrage.nachricht,
            "notes": anfrage.notes,
            "customer_type": anfrage.customer_type,
            "source": anfrage.source,
            "firma": anfrage.firma,
            "status": "neu",
            "photos": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        await db.anfragen.insert_one(new_anfrage)
        new_anfrage.pop("_id", None)
        
        logger.info(f"✅ Neue Anfrage manuell angelegt: {name} ({anfrage.email})")
        
        return {"message": "Anfrage erfolgreich angelegt", "anfrage": new_anfrage}
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Anlegen der Anfrage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/anfragen/{anfrage_id}")
async def update_anfrage(anfrage_id: str, update: AnfrageUpdate):
    """Anfrage bearbeiten"""
    try:
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Auto-generate combined name from vorname + nachname
        vorname = update_data.get("vorname", "")
        nachname = update_data.get("nachname", "")
        if vorname or nachname:
            update_data["name"] = f"{vorname} {nachname}".strip()
        
        result = await db.anfragen.update_one(
            {"id": anfrage_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
        
        updated = await db.anfragen.find_one({"id": anfrage_id}, {"_id": 0})
        
        logger.info(f"✅ Anfrage aktualisiert: {anfrage_id}")
        
        return {"message": "Anfrage aktualisiert", "anfrage": updated}
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Aktualisieren der Anfrage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/anfragen/{anfrage_id}")
async def delete_anfrage(anfrage_id: str):
    """Anfrage löschen"""
    try:
        result = await db.anfragen.delete_one({"id": anfrage_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
        
        logger.info(f"✅ Anfrage gelöscht: {anfrage_id}")
        
        return {"message": "Anfrage gelöscht"}
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Löschen der Anfrage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anfragen")
async def get_anfragen(category: str = None, status: str = None):
    """Alle Anfragen abrufen"""
    try:
        query = {}
        if category:
            query["categories"] = category
        if status:
            query["status"] = status
        
        anfragen = await db.anfragen.find(query, {"_id": 0}).to_list(1000)
        anfragen.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return anfragen
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Abrufen der Anfragen: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anfragen/{anfrage_id}")
async def get_anfrage(anfrage_id: str):
    """Einzelne Anfrage abrufen"""
    try:
        anfrage = await db.anfragen.find_one({"id": anfrage_id}, {"_id": 0})
        
        if not anfrage:
            raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
        
        return anfrage
    
    except Exception as e:
        logger.error(f"❌ Fehler beim Abrufen der Anfrage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anfragen/{anfrage_id}/upload")
async def upload_anfrage_files(
    anfrage_id: str,
    files: List[UploadFile] = File(...),
    user=Depends(get_current_user)
):
    """Upload files for an anfrage (max 10 files, 10MB each)"""
    anfrage = await db.anfragen.find_one({"id": anfrage_id}, {"_id": 0})
    if not anfrage:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    MAX_FILES = 10
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB
    
    current_files = anfrage.get("photos", [])
    if len(current_files) + len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximale Anzahl Dateien überschritten (max {MAX_FILES})"
        )
    
    uploaded_urls = []
    
    try:
        from utils.storage import put_object
        import uuid as _uuid
        
        for file in files:
            # Read file content
            content = await file.read()
            
            # Check file size
            if len(content) > MAX_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Datei {file.filename} ist zu groß (max 10 MB)"
                )
            
            # Generate safe filename
            safe_name = file.filename.replace(" ", "_") if file.filename else "datei"
            storage_path = f"anfragen/{anfrage_id}/{_uuid.uuid4().hex[:8]}_{safe_name}"
            
            # Upload to object storage
            result = put_object(storage_path, content, file.content_type or "application/octet-stream")
            
            if result and result.get("url"):
                uploaded_urls.append({
                    "url": result["url"],
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "size": len(content)
                })
                logger.info(f"Datei für Anfrage {anfrage_id} gespeichert: {storage_path}")
            elif result and result.get("path"):
                uploaded_urls.append({
                    "url": result["path"],
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "size": len(content)
                })
                logger.info(f"Datei für Anfrage {anfrage_id} gespeichert: {storage_path}")
    
    except Exception as e:
        logger.error(f"Fehler beim Upload für Anfrage {anfrage_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload-Fehler: {str(e)}")
    
    # Update anfrage with new files
    all_files = current_files + uploaded_urls
    await db.anfragen.update_one(
        {"id": anfrage_id},
        {"$set": {"photos": all_files}}
    )
    
    return {
        "message": f"{len(uploaded_urls)} Datei(en) hochgeladen",
        "uploaded": uploaded_urls,
        "total_files": len(all_files)
    }


@router.delete("/anfragen/{anfrage_id}/files/{file_index}")
async def delete_anfrage_file(
    anfrage_id: str,
    file_index: int,
    user=Depends(get_current_user)
):
    """Delete a file from anfrage"""
    anfrage = await db.anfragen.find_one({"id": anfrage_id}, {"_id": 0})
    if not anfrage:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    files = anfrage.get("photos", [])
    if file_index < 0 or file_index >= len(files):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    
    # Remove file from list
    files.pop(file_index)
    
    await db.anfragen.update_one(
        {"id": anfrage_id},
        {"$set": {"photos": files}}
    )
    
    return {"message": "Datei gelöscht", "remaining_files": len(files)}
