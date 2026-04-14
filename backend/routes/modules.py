from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone
from database import db, logger
from auth import get_current_user
from uuid import uuid4

router = APIRouter()


class ModuleSchema(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    slug: str
    version: str = "1.0.0"
    description: str = ""
    status: str = "aktiv"  # aktiv, inaktiv, entwurf
    category: str = "daten"  # daten, ausgabe, integration
    fields: List[dict] = []  # Feld-Definitionen
    api_endpoints: List[dict] = []  # Verfügbare API-Endpunkte
    data_collection: str = ""  # MongoDB Collection
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Kontakt-Modul Definition (das erste Modul)
KONTAKT_MODUL = {
    "name": "Kontakt-Modul",
    "slug": "kontakt",
    "version": "1.0.0",
    "description": "Eigenstaendiges Datensammler-Modul. Nimmt Kontaktdaten auf, aendert sie und stellt sie anderen Modulen zur Verfuegung. Datenquelle fuer Kunden, Anfragen, Angebote etc.",
    "status": "aktiv",
    "category": "daten",
    "data_collection": "contacts",
    "fields": [
        {"name": "anrede", "type": "select", "label": "Anrede", "options": ["Herr", "Frau", "Divers"], "required": False},
        {"name": "customer_type", "type": "select", "label": "Kundentyp", "options": ["Privat", "Firma", "Vermieter", "Mieter", "Gewerblich", "Hausverwaltung", "Wohnungsbaugesellschaft"], "required": True},
        {"name": "firma", "type": "text", "label": "Firmenname", "required": False, "condition": "customer_type in ['Firma', 'Gewerblich']"},
        {"name": "vorname", "type": "text", "label": "Vorname", "required": True},
        {"name": "nachname", "type": "text", "label": "Nachname", "required": True},
        {"name": "email", "type": "email", "label": "E-Mail", "required": False},
        {"name": "phone", "type": "tel", "label": "Telefon", "required": False},
        {"name": "strasse", "type": "text", "label": "Strasse", "required": False},
        {"name": "hausnummer", "type": "text", "label": "Hausnummer", "required": False},
        {"name": "plz", "type": "text", "label": "PLZ", "required": False},
        {"name": "ort", "type": "text", "label": "Ort", "required": False},
        {"name": "categories", "type": "multi-select", "label": "Kategorien", "required": False},
        {"name": "notes", "type": "textarea", "label": "Notizen", "required": False},
        {"name": "photos", "type": "file-upload", "label": "Dateien", "max": 10, "max_size_mb": 10},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/modules/kontakt/data", "description": "Alle Kontakte abrufen"},
        {"method": "POST", "path": "/api/modules/kontakt/data", "description": "Neuen Kontakt erstellen"},
        {"method": "PUT", "path": "/api/modules/kontakt/data/{id}", "description": "Kontakt bearbeiten"},
        {"method": "DELETE", "path": "/api/modules/kontakt/data/{id}", "description": "Kontakt loeschen"},
        {"method": "GET", "path": "/api/modules/kontakt/export", "description": "Alle Daten als JSON exportieren"},
    ],
}


@router.get("/modules")
async def get_modules(user=Depends(get_current_user)):
    """Alle Module abrufen"""
    modules = await db.modules.find({}, {"_id": 0}).to_list(100)
    if not modules:
        # Seed mit Kontakt-Modul
        modul = ModuleSchema(**KONTAKT_MODUL)
        await db.modules.insert_one(modul.model_dump())
        modules = [modul.model_dump()]
        modules[0].pop("_id", None)
    return modules


@router.get("/modules/{module_slug}")
async def get_module(module_slug: str, user=Depends(get_current_user)):
    """Ein Modul abrufen"""
    modul = await db.modules.find_one({"slug": module_slug}, {"_id": 0})
    if not modul:
        raise HTTPException(404, "Modul nicht gefunden")
    return modul


@router.put("/modules/{module_slug}/status")
async def toggle_module_status(module_slug: str, body: dict, user=Depends(get_current_user)):
    """Modul-Status aendern (aktiv/inaktiv)"""
    status = body.get("status", "aktiv")
    result = await db.modules.update_one({"slug": module_slug}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(404, "Modul nicht gefunden")
    return {"message": f"Modul-Status auf '{status}' gesetzt"}


# ==================== MODUL-DATEN API ====================
# Diese Endpoints sind die universelle Schnittstelle des Moduls

@router.get("/modules/kontakt/data")
async def get_kontakt_data(user=Depends(get_current_user)):
    """Alle Kontaktdaten aus dem Modul abrufen"""
    contacts = await db.module_kontakt.find({}, {"_id": 0}).to_list(10000)
    return contacts


@router.post("/modules/kontakt/data")
async def create_kontakt_data(data: dict, user=Depends(get_current_user)):
    """Neuen Kontakt im Modul erstellen"""
    contact = {
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **{k: v for k, v in data.items() if k != "id"},
    }
    await db.module_kontakt.insert_one(contact)
    contact.pop("_id", None)
    logger.info(f"Modul-Kontakt erstellt: {contact.get('vorname', '')} {contact.get('nachname', '')}")
    return contact


@router.put("/modules/kontakt/data/{contact_id}")
async def update_kontakt_data(contact_id: str, data: dict, user=Depends(get_current_user)):
    """Kontakt im Modul bearbeiten"""
    update_data = {k: v for k, v in data.items() if v is not None and k != "id"}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.module_kontakt.update_one({"id": contact_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(404, "Kontakt nicht gefunden")
    updated = await db.module_kontakt.find_one({"id": contact_id}, {"_id": 0})
    return updated


@router.delete("/modules/kontakt/data/{contact_id}")
async def delete_kontakt_data(contact_id: str, user=Depends(get_current_user)):
    """Kontakt im Modul loeschen"""
    result = await db.module_kontakt.delete_one({"id": contact_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Kontakt nicht gefunden")
    return {"message": "Kontakt geloescht"}


@router.get("/modules/kontakt/export")
async def export_kontakt_data(user=Depends(get_current_user)):
    """Alle Modul-Daten als JSON exportieren"""
    contacts = await db.module_kontakt.find({}, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "kontakt"}, {"_id": 0})
    return {
        "module": modul,
        "data": contacts,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(contacts),
    }
