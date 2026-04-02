from fastapi import APIRouter
from models import CompanySettings
from database import db

router = APIRouter()


@router.get("/settings", response_model=CompanySettings)
async def get_settings():
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        return CompanySettings()
    return settings


@router.put("/settings", response_model=CompanySettings)
async def update_settings(settings: CompanySettings):
    settings_dict = settings.model_dump()
    await db.settings.update_one(
        {"id": "company_settings"},
        {"$set": settings_dict},
        upsert=True
    )
    return settings
