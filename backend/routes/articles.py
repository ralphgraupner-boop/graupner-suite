from fastapi import APIRouter, HTTPException
from typing import List
from models import Article, ArticleCreate
from database import db

router = APIRouter()


@router.get("/articles", response_model=List[Article])
async def get_articles():
    articles = await db.articles.find({}, {"_id": 0}).to_list(1000)
    return articles


@router.post("/articles", response_model=Article)
async def create_article(article: ArticleCreate):
    article_obj = Article(**article.model_dump())
    await db.articles.insert_one(article_obj.model_dump())
    return article_obj


@router.put("/articles/{article_id}", response_model=Article)
async def update_article(article_id: str, article: ArticleCreate):
    existing = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    updated = {**existing, **article.model_dump()}
    await db.articles.update_one({"id": article_id}, {"$set": updated})
    return updated


@router.delete("/articles/{article_id}")
async def delete_article(article_id: str):
    result = await db.articles.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return {"message": "Artikel gelöscht"}
