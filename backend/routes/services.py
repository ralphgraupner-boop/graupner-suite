from fastapi import APIRouter, HTTPException
from typing import List
from models import Service, ServiceCreate
from database import db

router = APIRouter()


@router.get("/services", response_model=List[Service])
async def get_services():
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    return services


@router.post("/services", response_model=Service)
async def create_service(service: ServiceCreate):
    service_obj = Service(**service.model_dump())
    await db.services.insert_one(service_obj.model_dump())
    return service_obj


@router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, service: ServiceCreate):
    existing = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")
    updated = {**existing, **service.model_dump()}
    await db.services.update_one({"id": service_id}, {"$set": updated})
    return updated


@router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    result = await db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")
    return {"message": "Leistung gelöscht"}
