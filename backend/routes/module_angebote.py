from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone
from database import db, logger
from auth import get_current_user
from uuid import uuid4

router = APIRouter()


# ==================== MODELS ====================
class AngebotPosition(BaseModel):
    pos_nr: int = 0
    type: str = "position"  # position, titel
    description: str = ""
    quantity: float = 1
    unit: str = "Stk."
    price_net: float = 0


class AngebotCreate(BaseModel):
    kontakt_id: str = ""
    kontakt_name: str = ""
    kontakt_address: str = ""
    kontakt_email: str = ""
    kontakt_firma: str = ""
    betreff: str = ""
    vortext: str = ""
    schlusstext: str = ""
    positions: List[dict] = []
    notes: str = ""
    vat_rate: float = 19
    discount: float = 0
    discount_type: str = "percent"
    valid_days: int = 30
    status: str = "Entwurf"


class AngebotUpdate(BaseModel):
    kontakt_id: Optional[str] = None
    kontakt_name: Optional[str] = None
    kontakt_address: Optional[str] = None
    kontakt_email: Optional[str] = None
    kontakt_firma: Optional[str] = None
    betreff: Optional[str] = None
    vortext: Optional[str] = None
    schlusstext: Optional[str] = None
    positions: Optional[List[dict]] = None
    notes: Optional[str] = None
    vat_rate: Optional[float] = None
    discount: Optional[float] = None
    discount_type: Optional[str] = None
    valid_days: Optional[int] = None
    status: Optional[str] = None


# ==================== HELPER ====================
async def generate_angebot_nr():
    """Generiert fortlaufende Angebotsnummer"""
    year = datetime.now().year
    last = await db.module_angebote.find(
        {"angebot_nr": {"$regex": f"^AG-{year}"}},
        {"_id": 0, "angebot_nr": 1}
    ).sort("angebot_nr", -1).limit(1).to_list(1)

    if last:
        try:
            last_num = int(last[0]["angebot_nr"].split("-")[-1])
            return f"AG-{year}-{last_num + 1:04d}"
        except (ValueError, IndexError):
            pass

    count = await db.module_angebote.count_documents({"angebot_nr": {"$regex": f"^AG-{year}"}})
    return f"AG-{year}-{count + 1:04d}"


def calc_totals(positions, vat_rate=19, discount=0, discount_type="percent"):
    """Berechnet Netto, MwSt, Brutto"""
    netto = sum(
        p.get("quantity", 1) * p.get("price_net", 0)
        for p in positions if p.get("type") != "titel"
    )
    if discount_type == "percent" and discount > 0:
        netto = netto * (1 - discount / 100)
    elif discount_type == "amount" and discount > 0:
        netto = netto - discount
    mwst = round(netto * vat_rate / 100, 2)
    brutto = round(netto + mwst, 2)
    return round(netto, 2), mwst, brutto


# ==================== SEED MODUL ====================
ANGEBOT_MODUL = {
    "name": "Angebots-Modul",
    "slug": "angebote",
    "version": "1.0.0",
    "description": "Eigenstaendiges Angebots-Modul. Erstellt und verwaltet Angebote. Bezieht Kundendaten ausschliesslich vom Kontakt-Modul.",
    "status": "aktiv",
    "category": "ausgabe",
    "data_collection": "module_angebote",
    "fields": [
        {"name": "angebot_nr", "type": "auto", "label": "Angebots-Nr.", "required": True},
        {"name": "kontakt_id", "type": "relation", "label": "Kontakt", "relation_module": "kontakt", "required": True},
        {"name": "betreff", "type": "text", "label": "Betreff", "required": False},
        {"name": "vortext", "type": "textarea", "label": "Vortext", "required": False},
        {"name": "positions", "type": "positions", "label": "Positionen", "required": True},
        {"name": "schlusstext", "type": "textarea", "label": "Schlusstext", "required": False},
        {"name": "vat_rate", "type": "number", "label": "MwSt-Satz (%)", "default": 19},
        {"name": "discount", "type": "number", "label": "Rabatt", "default": 0},
        {"name": "valid_days", "type": "number", "label": "Gueltigkeitsdauer (Tage)", "default": 30},
        {"name": "status", "type": "select", "label": "Status", "options": ["Entwurf", "Gesendet", "Angenommen", "Abgelehnt", "Abgelaufen"], "required": True},
        {"name": "notes", "type": "textarea", "label": "Interne Notizen", "required": False},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/modules/angebote/data", "description": "Alle Angebote abrufen"},
        {"method": "POST", "path": "/api/modules/angebote/data", "description": "Neues Angebot erstellen"},
        {"method": "PUT", "path": "/api/modules/angebote/data/{id}", "description": "Angebot bearbeiten"},
        {"method": "DELETE", "path": "/api/modules/angebote/data/{id}", "description": "Angebot loeschen"},
        {"method": "GET", "path": "/api/modules/angebote/export", "description": "Alle Daten als JSON exportieren"},
    ],
    "dependencies": ["kontakt"],
}


async def ensure_modul_registered():
    """Stellt sicher, dass das Modul in der modules-Collection registriert ist"""
    existing = await db.modules.find_one({"slug": "angebote"})
    if not existing:
        from routes.modules import ModuleSchema
        modul = ModuleSchema(**ANGEBOT_MODUL)
        await db.modules.insert_one(modul.model_dump())
        logger.info("Angebots-Modul registriert")


# ==================== API ENDPOINTS ====================

@router.get("/modules/angebote/data")
async def get_angebote(user=Depends(get_current_user)):
    await ensure_modul_registered()
    angebote = await db.module_angebote.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return angebote


@router.get("/modules/angebote/data/{angebot_id}")
async def get_angebot(angebot_id: str, user=Depends(get_current_user)):
    angebot = await db.module_angebote.find_one({"id": angebot_id}, {"_id": 0})
    if not angebot:
        raise HTTPException(404, "Angebot nicht gefunden")
    return angebot


@router.post("/modules/angebote/data")
async def create_angebot(data: AngebotCreate, user=Depends(get_current_user)):
    await ensure_modul_registered()
    angebot_nr = await generate_angebot_nr()
    netto, mwst, brutto = calc_totals(data.positions, data.vat_rate, data.discount, data.discount_type)

    angebot = {
        "id": str(uuid4()),
        "angebot_nr": angebot_nr,
        **data.model_dump(),
        "netto": netto,
        "mwst": mwst,
        "brutto": brutto,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_angebote.insert_one(angebot)
    angebot.pop("_id", None)
    logger.info(f"Angebot erstellt: {angebot_nr} fuer {data.kontakt_name}")
    return angebot


@router.put("/modules/angebote/data/{angebot_id}")
async def update_angebot(angebot_id: str, data: AngebotUpdate, user=Depends(get_current_user)):
    existing = await db.module_angebote.find_one({"id": angebot_id})
    if not existing:
        raise HTTPException(404, "Angebot nicht gefunden")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Recalculate totals if positions changed
    positions = update_data.get("positions", existing.get("positions", []))
    vat_rate = update_data.get("vat_rate", existing.get("vat_rate", 19))
    discount = update_data.get("discount", existing.get("discount", 0))
    discount_type = update_data.get("discount_type", existing.get("discount_type", "percent"))
    netto, mwst, brutto = calc_totals(positions, vat_rate, discount, discount_type)
    update_data["netto"] = netto
    update_data["mwst"] = mwst
    update_data["brutto"] = brutto

    await db.module_angebote.update_one({"id": angebot_id}, {"$set": update_data})
    updated = await db.module_angebote.find_one({"id": angebot_id}, {"_id": 0})
    return updated


@router.delete("/modules/angebote/data/{angebot_id}")
async def delete_angebot(angebot_id: str, user=Depends(get_current_user)):
    result = await db.module_angebote.delete_one({"id": angebot_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Angebot nicht gefunden")
    return {"message": "Angebot geloescht"}


@router.put("/modules/angebote/data/{angebot_id}/status")
async def update_angebot_status(angebot_id: str, body: dict, user=Depends(get_current_user)):
    status = body.get("status")
    if not status:
        raise HTTPException(400, "Status erforderlich")
    result = await db.module_angebote.update_one(
        {"id": angebot_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Angebot nicht gefunden")
    return {"message": f"Status auf '{status}' gesetzt"}


@router.get("/modules/angebote/export")
async def export_angebote(user=Depends(get_current_user)):
    angebote = await db.module_angebote.find({}, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "angebote"}, {"_id": 0})
    return {
        "module": modul,
        "data": angebote,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(angebote),
    }
