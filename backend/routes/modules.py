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
        {"name": "kontakt_status", "type": "select", "label": "Status", "options": ["Anfrage", "Kunde", "Interessent", "Archiv"], "required": True, "default": "Anfrage"},
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
    contacts = await db.module_kontakt.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
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
    """Kontakt im Modul bearbeiten - bei Status 'Kunde' automatisch ins Kunden-Modul uebernehmen"""
    # Alten Status holen
    old = await db.module_kontakt.find_one({"id": contact_id}, {"_id": 0})
    if not old:
        raise HTTPException(404, "Kontakt nicht gefunden")
    old_status = old.get("kontakt_status", "")

    update_data = {k: v for k, v in data.items() if v is not None and k != "id"}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_kontakt.update_one({"id": contact_id}, {"$set": update_data})
    updated = await db.module_kontakt.find_one({"id": contact_id}, {"_id": 0})

    # Auto-Transfer: Wenn Status auf "Kunde" geaendert wird
    new_status = update_data.get("kontakt_status", old_status)
    if new_status == "Kunde" and old_status != "Kunde":
        # Pruefen ob Kunde schon existiert (per E-Mail)
        email = updated.get("email", "")
        existing = None
        if email:
            existing = await db.module_kunden.find_one({"email": email}, {"_id": 0})
        if not existing:
            import uuid as _uuid
            name = f"{updated.get('vorname', '')} {updated.get('nachname', '')}".strip() or updated.get("name", "")
            kunde = {
                "id": str(_uuid.uuid4()),
                "name": name,
                "vorname": updated.get("vorname", ""),
                "nachname": updated.get("nachname", ""),
                "anrede": updated.get("anrede", ""),
                "firma": updated.get("firma", ""),
                "email": updated.get("email", ""),
                "phone": updated.get("phone", ""),
                "address": updated.get("address", ""),
                "strasse": updated.get("strasse", ""),
                "hausnummer": updated.get("hausnummer", ""),
                "plz": updated.get("plz", ""),
                "ort": updated.get("ort", ""),
                "customer_type": updated.get("customer_type", "Privat"),
                "notes": updated.get("notes", ""),
                "photos": updated.get("photos", []),
                "categories": updated.get("categories", []),
                "kontakt_id": contact_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.module_kunden.insert_one(kunde)
            kunde.pop("_id", None)
            logger.info(f"Kontakt automatisch als Kunde uebernommen: {name}")
            updated["_kunde_created"] = True
            updated["_kunde_id"] = kunde["id"]
        else:
            updated["_kunde_exists"] = True
            updated["_kunde_id"] = existing.get("id", "")

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



# ==================== MODUL-VERKNUEPFUNGEN ====================

@router.post("/modules/kontakt/from-kunden/{kunden_id}")
async def import_from_kunden(kunden_id: str, user=Depends(get_current_user)):
    """Kunde aus dem Kunden-Modul als Kontakt uebernehmen"""
    kunde = await db.module_kunden.find_one({"id": kunden_id}, {"_id": 0})
    if not kunde:
        raise HTTPException(404, "Kunde nicht gefunden")
    # Pruefen ob bereits als Kontakt vorhanden
    query_or = []
    if kunde.get("email"):
        query_or.append({"email": kunde["email"]})
    if kunde.get("vorname") and kunde.get("nachname"):
        query_or.append({"vorname": kunde["vorname"], "nachname": kunde["nachname"]})
    if query_or:
        existing = await db.module_kontakt.find_one({"$or": query_or}, {"_id": 0})
        if existing:
            return {"message": "Kunde bereits als Kontakt vorhanden", "kontakt": existing, "already_exists": True}
    kontakt = {
        "id": str(uuid4()),
        "vorname": kunde.get("vorname", ""),
        "nachname": kunde.get("nachname", ""),
        "anrede": kunde.get("anrede", ""),
        "firma": kunde.get("firma", ""),
        "email": kunde.get("email", ""),
        "phone": kunde.get("phone", ""),
        "strasse": kunde.get("strasse", ""),
        "hausnummer": kunde.get("hausnummer", ""),
        "plz": kunde.get("plz", ""),
        "ort": kunde.get("ort", ""),
        "customer_type": kunde.get("customer_type", "Privat"),
        "kontakt_status": "Kunde",
        "categories": kunde.get("categories", []),
        "notes": kunde.get("notes", ""),
        "source_kunden_id": kunden_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_kontakt.insert_one(kontakt)
    kontakt.pop("_id", None)
    name = f"{kunde.get('vorname', '')} {kunde.get('nachname', '')}".strip()
    logger.info(f"Kunde -> Kontakt: {name}")
    return {"message": f"Kunde '{name}' als Kontakt uebernommen", "kontakt": kontakt, "already_exists": False}
