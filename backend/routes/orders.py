from fastapi import APIRouter, HTTPException, Body
from typing import List
from datetime import datetime, timezone
from models import Order, OrderUpdate, Position
from database import db

router = APIRouter()


async def get_next_order_number():
    counter = await db.counters.find_one_and_update(
        {"_id": "order_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"AB-{datetime.now().year}-{str(counter['seq']).zfill(4)}"


@router.get("/orders", response_model=List[Order])
async def get_orders():
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    return orders


@router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return order


@router.post("/orders/from-quote/{quote_id}", response_model=Order)
async def create_order_from_quote(quote_id: str):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")

    order_number = await get_next_order_number()

    order_obj = Order(
        order_number=order_number,
        quote_id=quote_id,
        customer_id=quote["customer_id"],
        customer_name=quote["customer_name"],
        customer_address=quote["customer_address"],
        positions=quote["positions"],
        notes=quote.get("notes", ""),
        vat_rate=quote["vat_rate"],
        subtotal_net=quote["subtotal_net"],
        vat_amount=quote["vat_amount"],
        total_gross=quote["total_gross"]
    )

    await db.orders.insert_one(order_obj.model_dump())
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "Beauftragt"}})

    return order_obj


@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str = Body(..., embed=True)):
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return {"message": "Status aktualisiert"}


@router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, update: OrderUpdate):
    """Auftrag bearbeiten mit optionaler Gesamtsummen-Anpassung"""
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    positions = update.positions

    if update.custom_total is not None and update.custom_total > 0:
        current_total = sum(p.quantity * p.price_net for p in positions)
        if current_total > 0:
            target_net = update.custom_total / (1 + update.vat_rate / 100)
            factor = target_net / current_total
            for p in positions:
                p.price_net = round(p.price_net * factor, 2)

    subtotal_net = sum(p.quantity * p.price_net for p in positions)
    vat_amount = subtotal_net * (update.vat_rate / 100) if update.vat_rate > 0 else 0
    total_gross = subtotal_net + vat_amount

    update_data = {
        "positions": [p.model_dump() for p in positions],
        "notes": update.notes,
        "vat_rate": update.vat_rate,
        "subtotal_net": round(subtotal_net, 2),
        "vat_amount": round(vat_amount, 2),
        "total_gross": round(total_gross, 2)
    }

    if update.status:
        update_data["status"] = update.status

    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return {"message": "Auftrag gelöscht"}
