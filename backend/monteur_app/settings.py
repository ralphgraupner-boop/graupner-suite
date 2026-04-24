"""Monteur-App – Settings-Management (isolierte Collection)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime, timezone

from database import db
from routes.auth import get_current_user

router = APIRouter()

SETTINGS_ID = "monteur_app_main"


class MonteurAppSettings(BaseModel):
    feature_enabled: bool = False
    # Optional: weitere Einstellungen spaeter (z.B. Default-Navigations-App)


class MonteurAppSettingsUpdate(BaseModel):
    feature_enabled: bool | None = None


async def _get_or_create_settings() -> dict:
    doc = await db.monteur_app_settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if not doc:
        doc = {
            "id": SETTINGS_ID,
            "feature_enabled": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.monteur_app_settings.insert_one(doc)
        doc.pop("_id", None)
    return doc


@router.get("/admin/settings")
async def get_settings(user=Depends(get_current_user)):
    return await _get_or_create_settings()


@router.put("/admin/settings")
async def update_settings(payload: MonteurAppSettingsUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(403, "Nur Admins")
    current = await _get_or_create_settings()
    data = payload.model_dump(exclude_none=True)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.monteur_app_settings.update_one({"id": SETTINGS_ID}, {"$set": data})
    return {**current, **data}
