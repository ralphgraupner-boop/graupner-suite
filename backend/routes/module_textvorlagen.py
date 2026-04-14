from fastapi import APIRouter, HTTPException, Depends
from database import db, logger
from auth import get_current_user
from datetime import datetime, timezone
from uuid import uuid4

router = APIRouter()

VALID_DOC_TYPES = ["angebot", "auftrag", "rechnung", "allgemein"]
VALID_TEXT_TYPES = ["vortext", "schlusstext", "betreff", "bemerkung", "titel", "email", "mahnung"]

PLACEHOLDERS = [
    {"alias": "{anrede_brief}", "beschreibung": "Sehr geehrter Herr/Sehr geehrte Frau + Name"},
    {"alias": "{kunde_name}", "beschreibung": "Name des Kunden"},
    {"alias": "{kunde_adresse}", "beschreibung": "Adresse des Kunden"},
    {"alias": "{kunde_email}", "beschreibung": "E-Mail des Kunden"},
    {"alias": "{kunde_telefon}", "beschreibung": "Telefon des Kunden"},
    {"alias": "{firma}", "beschreibung": "Ihr Firmenname"},
    {"alias": "{datum}", "beschreibung": "Heutiges Datum"},
    {"alias": "{dokument_nr}", "beschreibung": "Dokument-Nummer"},
]

TEXTVORLAGEN_MODUL = {
    "name": "Textvorlagen",
    "slug": "textvorlagen",
    "version": "1.0.0",
    "description": "Eigenstaendiges Modul fuer Textbausteine. Verwaltet Vortext, Schlusstext, Betreff und weitere Vorlagen fuer Dokumente.",
    "status": "aktiv",
    "category": "daten",
    "data_collection": "module_textvorlagen",
    "fields": [
        {"name": "title", "type": "text", "label": "Titel/Name", "required": True},
        {"name": "content", "type": "textarea", "label": "Inhalt", "required": True},
        {"name": "doc_type", "type": "select", "label": "Dokumenttyp", "options": VALID_DOC_TYPES, "required": True},
        {"name": "text_type", "type": "select", "label": "Textart", "options": VALID_TEXT_TYPES, "required": True},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/modules/textvorlagen/data", "description": "Alle Textvorlagen"},
        {"method": "POST", "path": "/api/modules/textvorlagen/data", "description": "Neue Vorlage erstellen"},
        {"method": "PUT", "path": "/api/modules/textvorlagen/data/{id}", "description": "Vorlage bearbeiten"},
        {"method": "DELETE", "path": "/api/modules/textvorlagen/data/{id}", "description": "Vorlage loeschen"},
        {"method": "GET", "path": "/api/modules/textvorlagen/placeholders", "description": "Verfuegbare Platzhalter"},
        {"method": "GET", "path": "/api/modules/textvorlagen/export", "description": "Alle Daten exportieren"},
    ],
}


async def ensure_modul_registered():
    existing = await db.modules.find_one({"slug": "textvorlagen"})
    if not existing:
        from routes.modules import ModuleSchema
        modul = ModuleSchema(**TEXTVORLAGEN_MODUL)
        await db.modules.insert_one(modul.model_dump())
        logger.info("Textvorlagen-Modul registriert")


@router.get("/modules/textvorlagen/data")
async def get_textvorlagen(doc_type: str = "", text_type: str = "", user=Depends(get_current_user)):
    await ensure_modul_registered()
    query = {}
    if text_type:
        query["text_type"] = text_type
    shared_types = {"vortext", "schlusstext", "betreff"}
    if doc_type and text_type not in shared_types:
        query["doc_type"] = doc_type
    items = await db.module_textvorlagen.find(query, {"_id": 0}).sort("title", 1).to_list(500)
    return items


@router.get("/modules/textvorlagen/placeholders")
async def get_placeholders(user=Depends(get_current_user)):
    return PLACEHOLDERS


@router.post("/modules/textvorlagen/data")
async def create_textvorlage(data: dict, user=Depends(get_current_user)):
    if not data.get("title") or not data.get("content"):
        raise HTTPException(400, "Titel und Inhalt erforderlich")
    if data.get("doc_type") not in VALID_DOC_TYPES:
        raise HTTPException(400, f"doc_type muss einer von {VALID_DOC_TYPES} sein")
    if data.get("text_type") not in VALID_TEXT_TYPES:
        raise HTTPException(400, f"text_type muss einer von {VALID_TEXT_TYPES} sein")
    item = {
        "id": str(uuid4()),
        "title": data["title"],
        "content": data["content"],
        "doc_type": data["doc_type"],
        "text_type": data["text_type"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_textvorlagen.insert_one(item)
    item.pop("_id", None)
    return item


@router.put("/modules/textvorlagen/data/{item_id}")
async def update_textvorlage(item_id: str, data: dict, user=Depends(get_current_user)):
    existing = await db.module_textvorlagen.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Nicht gefunden")
    update = {k: v for k, v in data.items() if k in ("title", "content", "doc_type", "text_type") and v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_textvorlagen.update_one({"id": item_id}, {"$set": update})
    updated = await db.module_textvorlagen.find_one({"id": item_id}, {"_id": 0})
    return updated


@router.delete("/modules/textvorlagen/data/{item_id}")
async def delete_textvorlage(item_id: str, user=Depends(get_current_user)):
    result = await db.module_textvorlagen.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"message": "Geloescht"}


@router.get("/modules/textvorlagen/export")
async def export_textvorlagen(user=Depends(get_current_user)):
    items = await db.module_textvorlagen.find({}, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "textvorlagen"}, {"_id": 0})
    return {"module": modul, "data": items, "exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items)}
