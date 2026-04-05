from fastapi import APIRouter, HTTPException
from typing import List
from models import Article, ArticleCreate
from database import db

router = APIRouter()

VALID_TYPES = ["Artikel", "Leistung", "Fremdleistung"]
PREFIX_MAP = {"Artikel": "A", "Leistung": "L", "Fremdleistung": "F"}


def calc_vk(ek: float, aufschlag: float) -> float:
    if ek <= 0 or aufschlag <= 0:
        return 0
    return round(ek * (1 + aufschlag / 100), 2)


async def generate_artikel_nr(typ: str) -> str:
    prefix = PREFIX_MAP.get(typ, "A")
    last = await db.articles.find(
        {"artikel_nr": {"$regex": f"^{prefix}-"}},
        {"_id": 0, "artikel_nr": 1}
    ).sort("artikel_nr", -1).limit(1).to_list(1)
    if last and last[0].get("artikel_nr"):
        try:
            num = int(last[0]["artikel_nr"].split("-")[1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"{prefix}-{num:04d}"


@router.get("/articles", response_model=List[Article])
async def get_articles(typ: str = ""):
    query = {}
    if typ and typ in VALID_TYPES:
        query["typ"] = typ
    articles = await db.articles.find(query, {"_id": 0}).to_list(1000)
    return articles


@router.get("/articles/{article_id}", response_model=Article)
async def get_article(article_id: str):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return article


@router.post("/articles", response_model=Article)
async def create_article(article: ArticleCreate):
    data = article.model_dump()
    data["vk_preis_1"] = calc_vk(data["ek_preis"], data["aufschlag_1"])
    data["vk_preis_2"] = calc_vk(data["ek_preis"], data["aufschlag_2"])
    data["vk_preis_3"] = calc_vk(data["ek_preis"], data["aufschlag_3"])
    if data["typ"] not in VALID_TYPES:
        data["typ"] = "Artikel"
    if not data.get("artikel_nr"):
        data["artikel_nr"] = await generate_artikel_nr(data["typ"])
    article_obj = Article(**data)
    await db.articles.insert_one(article_obj.model_dump())
    return article_obj


@router.put("/articles/{article_id}", response_model=Article)
async def update_article(article_id: str, article: ArticleCreate):
    existing = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    data = article.model_dump()
    data["vk_preis_1"] = calc_vk(data["ek_preis"], data["aufschlag_1"])
    data["vk_preis_2"] = calc_vk(data["ek_preis"], data["aufschlag_2"])
    data["vk_preis_3"] = calc_vk(data["ek_preis"], data["aufschlag_3"])
    if data["typ"] not in VALID_TYPES:
        data["typ"] = "Artikel"
    updated = {**existing, **data}
    await db.articles.update_one({"id": article_id}, {"$set": updated})
    return updated


@router.delete("/articles/{article_id}")
async def delete_article(article_id: str):
    result = await db.articles.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return {"message": "Artikel gelöscht"}


@router.post("/articles/migrate")
async def migrate_articles():
    """Migrate old services into articles collection as typ=Leistung"""
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    migrated = 0
    for svc in services:
        existing = await db.articles.find_one({"name": svc["name"], "typ": "Leistung"})
        if existing:
            continue
        article = Article(
            name=svc["name"],
            description=svc.get("description", ""),
            typ="Leistung",
            price_net=svc.get("price_net", 0),
            ek_preis=svc.get("ek_price", svc.get("purchase_price", 0)),
            unit=svc.get("unit", "Stunde"),
        )
        await db.articles.insert_one(article.model_dump())
        migrated += 1

    # Set typ=Artikel for old articles without typ
    await db.articles.update_many(
        {"typ": {"$exists": False}},
        {"$set": {"typ": "Artikel", "ek_preis": 0, "aufschlag_1": 0, "aufschlag_2": 0, "aufschlag_3": 0, "vk_preis_1": 0, "vk_preis_2": 0, "vk_preis_3": 0, "subunternehmer": ""}}
    )
    await db.articles.update_many(
        {"typ": ""},
        {"$set": {"typ": "Artikel"}}
    )

    return {"message": f"{migrated} Leistungen migriert", "migrated": migrated}
