from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models import Customer, CustomerCreate, Anfrage
from database import db
from auth import get_current_user

router = APIRouter()


@router.get("/customers", response_model=List[Customer])
async def get_customers():
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    return customers


@router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return customer


@router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    customer_obj = Customer(**customer.model_dump())
    await db.customers.insert_one(customer_obj.model_dump())
    return customer_obj


@router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer: CustomerCreate):
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    updated = {**existing, **customer.model_dump()}
    await db.customers.update_one({"id": customer_id}, {"$set": updated})
    return updated


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return {"message": "Kunde gelöscht"}


@router.post("/customers/{customer_id}/to-anfrage")
async def customer_to_anfrage(customer_id: str, user=Depends(get_current_user)):
    """Kunde zurück in Anfrage umwandeln"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    anfrage = Anfrage(
        name=customer.get("name", ""),
        email=customer.get("email", ""),
        phone=customer.get("phone", ""),
        address=customer.get("address", ""),
        notes=customer.get("notes", ""),
        photos=customer.get("photos", []),
        categories=customer.get("categories", []),
        customer_type=customer.get("customer_type", "Privat"),
        source="rueckstufung"
    )
    await db.anfragen.insert_one(anfrage.model_dump())
    await db.customers.delete_one({"id": customer_id})

    return {"message": "Kunde zurück in Anfrage umgewandelt", "anfrage_id": anfrage.id}
