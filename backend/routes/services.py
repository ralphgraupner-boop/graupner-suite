from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models import Service, ServiceCreate, ServiceUpdate
from database import db
from security.admin_check import require_admin

router = APIRouter()


@router.get("/services", response_model=List[Service])
async def get_services():
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    return services


@router.post("/services", response_model=Service, dependencies=[Depends(require_admin)])
async def create_service(service: ServiceCreate):
    service_obj = Service(**service.model_dump())
    await db.services.insert_one(service_obj.model_dump())
    return service_obj


@router.put("/services/{service_id}", response_model=Service, dependencies=[Depends(require_admin)])
async def update_service(service_id: str, service: ServiceUpdate):
    existing = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")
    # Nur tatsaechlich gesendete Felder uebernehmen (exclude_unset)
    update_data = service.model_dump(exclude_unset=True)
    if update_data:
        await db.services.update_one({"id": service_id}, {"$set": update_data})
    updated = {**existing, **update_data}
    return updated


@router.delete("/services/{service_id}", dependencies=[Depends(require_admin)])
async def delete_service(service_id: str):
    result = await db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")
    return {"message": "Leistung gelöscht"}
