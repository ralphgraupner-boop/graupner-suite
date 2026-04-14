from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from database import db, logger
from uuid import uuid4

router = APIRouter()


class AnfrageCreate(BaseModel):
    name: str
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
        new_anfrage = {
            "id": str(uuid4()),
            "name": anfrage.name,
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
        
        logger.info(f"✅ Neue Anfrage manuell angelegt: {anfrage.name} ({anfrage.email})")
        
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
