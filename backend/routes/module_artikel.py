from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from database import db, logger
from auth import get_current_user
from uuid import uuid4

router = APIRouter()


class ArtikelLeistungCreate(BaseModel):
    name: str
    artikel_nr: str = ""
    description: str = ""
    typ: str = "Artikel"  # Artikel, Leistung, Fremdleistung
    price_net: float = 0
    ek_preis: float = 0
    aufschlag_1: float = 0
    aufschlag_2: float = 0
    aufschlag_3: float = 0
    vk_preis_1: float = 0
    vk_preis_2: float = 0
    vk_preis_3: float = 0
    unit: str = "Stueck"
    subunternehmer: str = ""


class ArtikelLeistungUpdate(BaseModel):
    name: Optional[str] = None
    artikel_nr: Optional[str] = None
    description: Optional[str] = None
    typ: Optional[str] = None
    price_net: Optional[float] = None
    ek_preis: Optional[float] = None
    aufschlag_1: Optional[float] = None
    aufschlag_2: Optional[float] = None
    aufschlag_3: Optional[float] = None
    vk_preis_1: Optional[float] = None
    vk_preis_2: Optional[float] = None
    vk_preis_3: Optional[float] = None
    unit: Optional[str] = None
    subunternehmer: Optional[str] = None


ARTIKEL_MODUL = {
    "name": "Artikel & Leistungen",
    "slug": "artikel-leistungen",
    "version": "1.0.0",
    "description": "Eigenstaendiges Modul fuer Artikel, Leistungen und Fremdleistungen. Stellt Positionen fuer Angebote, Auftraege und Rechnungen bereit.",
    "status": "aktiv",
    "category": "daten",
    "data_collection": "module_artikel",
    "fields": [
        {"name": "artikel_nr", "type": "text", "label": "Artikel-Nr.", "required": False},
        {"name": "name", "type": "text", "label": "Bezeichnung", "required": True},
        {"name": "description", "type": "textarea", "label": "Beschreibung", "required": False},
        {"name": "typ", "type": "select", "label": "Typ", "options": ["Artikel", "Leistung", "Fremdleistung"], "required": True},
        {"name": "ek_preis", "type": "number", "label": "EK-Preis (Netto)", "required": False},
        {"name": "price_net", "type": "number", "label": "VK-Preis (Netto)", "required": True},
        {"name": "unit", "type": "select", "label": "Einheit", "options": ["Stueck", "Stunde", "m", "m2", "m3", "kg", "Psch.", "km"], "required": True},
        {"name": "subunternehmer", "type": "text", "label": "Subunternehmer", "required": False},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/modules/artikel/data", "description": "Alle Artikel & Leistungen abrufen"},
        {"method": "POST", "path": "/api/modules/artikel/data", "description": "Neuen Artikel/Leistung erstellen"},
        {"method": "PUT", "path": "/api/modules/artikel/data/{id}", "description": "Artikel/Leistung bearbeiten"},
        {"method": "DELETE", "path": "/api/modules/artikel/data/{id}", "description": "Artikel/Leistung loeschen"},
        {"method": "GET", "path": "/api/modules/artikel/export", "description": "Alle Daten exportieren"},
    ],
}


async def ensure_modul_registered():
    existing = await db.modules.find_one({"slug": "artikel-leistungen"})
    if not existing:
        from routes.modules import ModuleSchema
        modul = ModuleSchema(**ARTIKEL_MODUL)
        await db.modules.insert_one(modul.model_dump())
        logger.info("Artikel & Leistungen Modul registriert")


@router.get("/modules/artikel/data")
async def get_artikel(user=Depends(get_current_user)):
    await ensure_modul_registered()
    items = await db.module_artikel.find({}, {"_id": 0}).sort("name", 1).to_list(10000)
    return items


@router.get("/modules/artikel/data/{item_id}")
async def get_artikel_item(item_id: str, user=Depends(get_current_user)):
    item = await db.module_artikel.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Nicht gefunden")
    return item


@router.post("/modules/artikel/data")
async def create_artikel(data: ArtikelLeistungCreate, user=Depends(get_current_user)):
    await ensure_modul_registered()
    item = {
        "id": str(uuid4()),
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_artikel.insert_one(item)
    item.pop("_id", None)
    logger.info(f"Artikel erstellt: {data.name} ({data.typ})")
    return item


@router.put("/modules/artikel/data/{item_id}")
async def update_artikel(item_id: str, data: ArtikelLeistungUpdate, user=Depends(get_current_user)):
    existing = await db.module_artikel.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Nicht gefunden")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_artikel.update_one({"id": item_id}, {"$set": update_data})
    updated = await db.module_artikel.find_one({"id": item_id}, {"_id": 0})
    return updated


@router.delete("/modules/artikel/data/{item_id}")
async def delete_artikel(item_id: str, user=Depends(get_current_user)):
    result = await db.module_artikel.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"message": "Geloescht"}


@router.get("/modules/artikel/export")
async def export_artikel(user=Depends(get_current_user)):
    items = await db.module_artikel.find({}, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "artikel-leistungen"}, {"_id": 0})
    return {"module": modul, "data": items, "exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items)}
