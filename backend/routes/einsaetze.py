from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user
from datetime import datetime, timezone
import uuid

router = APIRouter()


# ===================== KONFIGURATION (Auswahlfelder verwalten) =====================

@router.get("/einsatz-config")
async def get_config(user=Depends(get_current_user)):
    config = await db.einsatz_config.find_one({"id": "main"}, {"_id": 0})
    if not config:
        config = {
            "id": "main",
            "monteure": [],
            "reparaturgruppen": [],
            "materialien": [],
        }
        await db.einsatz_config.insert_one(config)
        config.pop("_id", None)
    return config


@router.put("/einsatz-config")
async def update_config(body: dict, user=Depends(get_current_user)):
    updates = {}
    for field in ["monteure", "reparaturgruppen", "materialien", "anfrage_schritte"]:
        if field in body:
            updates[field] = body[field]
    if not updates:
        raise HTTPException(400, "Keine Änderungen")
    await db.einsatz_config.update_one(
        {"id": "main"},
        {"$set": updates},
        upsert=True
    )
    return {"message": "Konfiguration gespeichert"}


# ===================== EINSÄTZE CRUD =====================

@router.get("/einsaetze")
async def list_einsaetze(user=Depends(get_current_user)):
    items = await db.einsaetze.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@router.post("/einsaetze")
async def create_einsatz(body: dict, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    einsatz = {
        "id": str(uuid.uuid4()),
        "customer_id": body.get("customer_id", ""),
        "customer_name": body.get("customer_name", ""),
        "anfrage_id": body.get("anfrage_id", ""),
        "monteur_1": body.get("monteur_1", ""),
        "monteur_2": body.get("monteur_2", ""),
        "reparaturgruppe": body.get("reparaturgruppe", ""),
        "material": body.get("material", []),
        "summe_schaetzung": body.get("summe_schaetzung", 0),
        "status": body.get("status", "aktiv"),
        "beschreibung": body.get("beschreibung", ""),
        "termin": body.get("termin", ""),
        "termin_text": body.get("termin_text", ""),
        "created_at": now,
        "updated_at": now,
    }
    await db.einsaetze.insert_one(einsatz)
    einsatz.pop("_id", None)
    return einsatz


@router.get("/einsaetze/{einsatz_id}")
async def get_einsatz(einsatz_id: str, user=Depends(get_current_user)):
    item = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Einsatz nicht gefunden")
    return item


@router.put("/einsaetze/{einsatz_id}")
async def update_einsatz(einsatz_id: str, body: dict, user=Depends(get_current_user)):
    existing = await db.einsaetze.find_one({"id": einsatz_id})
    if not existing:
        raise HTTPException(404, "Einsatz nicht gefunden")

    allowed = [
        "customer_id", "customer_name", "anfrage_id",
        "monteur_1", "monteur_2", "reparaturgruppe", "material",
        "summe_schaetzung", "status", "beschreibung",
        "termin", "termin_text"
    ]
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.einsaetze.update_one({"id": einsatz_id}, {"$set": updates})
    updated = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    return updated


@router.delete("/einsaetze/{einsatz_id}")
async def delete_einsatz(einsatz_id: str, user=Depends(get_current_user)):
    result = await db.einsaetze.delete_one({"id": einsatz_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Einsatz nicht gefunden")
    return {"message": "Einsatz gelöscht"}
