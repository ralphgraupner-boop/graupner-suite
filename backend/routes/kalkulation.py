from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from database import db
from datetime import datetime, timezone
import uuid

router = APIRouter()


class SonstigeKosten(BaseModel):
    name: str = ""
    betrag: float = 0


class KalkulationEntry(BaseModel):
    article_id: str
    article_name: str = ""
    ek: float = 0
    zeit_meister: float = 0
    zeit_geselle: float = 0
    zeit_azubi: float = 0
    zeit_helfer: float = 0
    rate_meister: float = 0
    rate_geselle: float = 0
    rate_azubi: float = 0
    rate_helfer: float = 0
    sonstige_kosten: List[SonstigeKosten] = []
    materialzuschlag: float = 0
    gewinnaufschlag: float = 0
    lohnkosten: float = 0
    sonstige_summe: float = 0
    zwischensumme: float = 0
    material_betrag: float = 0
    gewinn_betrag: float = 0
    vk_preis: float = 0


@router.post("/kalkulation")
async def save_kalkulation(entry: KalkulationEntry):
    doc = entry.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.kalkulation_historie.insert_one(doc)
    return {"id": doc["id"], "created_at": doc["created_at"]}


@router.get("/kalkulation/{article_id}")
async def get_kalkulation_historie(article_id: str):
    cursor = db.kalkulation_historie.find(
        {"article_id": article_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20)
    return await cursor.to_list(length=20)


@router.get("/kalkulation/{article_id}/latest")
async def get_latest_kalkulation(article_id: str):
    doc = await db.kalkulation_historie.find_one(
        {"article_id": article_id}, {"_id": 0}, sort=[("created_at", -1)]
    )
    return doc or {}
