from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models import TextTemplate
from database import db
from auth import get_current_user

router = APIRouter()

VALID_DOC_TYPES = ["angebot", "auftrag", "rechnung", "allgemein"]
VALID_TEXT_TYPES = ["vortext", "schlusstext", "betreff", "bemerkung", "titel"]

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


@router.get("/text-templates")
async def list_templates(doc_type: str = "", text_type: str = "", user=Depends(get_current_user)):
    query = {}
    if doc_type:
        query["doc_type"] = doc_type
    if text_type:
        query["text_type"] = text_type
    templates = await db.text_templates.find(query, {"_id": 0}).to_list(500)
    return templates


@router.get("/text-templates/placeholders")
async def get_placeholders(user=Depends(get_current_user)):
    return PLACEHOLDERS


@router.post("/text-templates", response_model=TextTemplate)
async def create_template(template: TextTemplate, user=Depends(get_current_user)):
    if template.doc_type not in VALID_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"doc_type muss einer von {VALID_DOC_TYPES} sein")
    if template.text_type not in VALID_TEXT_TYPES:
        raise HTTPException(status_code=400, detail=f"text_type muss einer von {VALID_TEXT_TYPES} sein")
    await db.text_templates.insert_one(template.model_dump())
    return template


@router.put("/text-templates/{template_id}", response_model=TextTemplate)
async def update_template(template_id: str, template: TextTemplate, user=Depends(get_current_user)):
    existing = await db.text_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    update_data = {
        "title": template.title,
        "content": template.content,
        "doc_type": template.doc_type,
        "text_type": template.text_type,
    }
    await db.text_templates.update_one({"id": template_id}, {"$set": update_data})
    updated = await db.text_templates.find_one({"id": template_id}, {"_id": 0})
    return updated


@router.delete("/text-templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    result = await db.text_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    return {"message": "Textbaustein gelöscht"}
