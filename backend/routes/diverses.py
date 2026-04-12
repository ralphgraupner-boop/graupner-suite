from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from database import db, logger
from auth import get_current_user
import uuid

router = APIRouter()


# ==================== DIVERSES / INFO ====================

@router.get("/diverses")
async def list_diverses(user=Depends(get_current_user)):
    """Alle Diverses-Einträge auflisten"""
    items = await db.diverses.find({}, {"_id": 0}).to_list(1000)
    items.sort(key=lambda x: x.get("sort_order", 999))
    return items


@router.post("/diverses")
async def create_diverses(data: dict, user=Depends(get_current_user)):
    """Neuen Diverses-Eintrag erstellen"""
    item = {
        "id": str(uuid.uuid4()),
        "titel": data.get("titel", "Neuer Eintrag"),
        "kategorie": data.get("kategorie", "Allgemein"),
        "inhalt": data.get("inhalt", ""),
        "typ": data.get("typ", "notiz"),  # notiz, anweisung, hinweis, beschreibung, link
        "wichtig": data.get("wichtig", False),
        "sort_order": data.get("sort_order", 99),
        "erstellt_von": user.get("username", "admin"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.diverses.insert_one(item)
    item.pop("_id", None)
    return item


@router.put("/diverses/{item_id}")
async def update_diverses(item_id: str, data: dict, user=Depends(get_current_user)):
    """Diverses-Eintrag bearbeiten"""
    existing = await db.diverses.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Eintrag nicht gefunden")
    
    update_data = {}
    for key in ["titel", "kategorie", "inhalt", "typ", "wichtig", "sort_order"]:
        if key in data:
            update_data[key] = data[key]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.diverses.update_one({"id": item_id}, {"$set": update_data})
    updated = await db.diverses.find_one({"id": item_id}, {"_id": 0})
    return updated


@router.delete("/diverses/{item_id}")
async def delete_diverses(item_id: str, user=Depends(get_current_user)):
    """Diverses-Eintrag löschen"""
    result = await db.diverses.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"message": "Eintrag gelöscht"}


@router.get("/diverses/kategorien")
async def list_diverses_kategorien(user=Depends(get_current_user)):
    """Alle verwendeten Kategorien auflisten"""
    items = await db.diverses.find({}, {"_id": 0, "kategorie": 1}).to_list(1000)
    kategorien = sorted(set(item.get("kategorie", "Allgemein") for item in items))
    if not kategorien:
        kategorien = ["Allgemein", "Anweisungen", "Hinweise", "Programmbeschreibung", "Links"]
    return kategorien
