from fastapi import APIRouter, HTTPException, Body
from typing import List
from datetime import datetime, timezone
from models import Order, OrderUpdate, Position
from database import db
from module_angebote import find_customer_in_modules
from utils import ersetze_platzhalter

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
        vortext=quote.get("vortext", ""),
        schlusstext=quote.get("schlusstext", ""),
        vat_rate=quote["vat_rate"],
        subtotal_net=quote["subtotal_net"],
        vat_amount=quote["vat_amount"],
        total_gross=quote["total_gross"]
    )

    await db.orders.insert_one(order_obj.model_dump())
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "Beauftragt"}})

    return order_obj


@router.post("/orders/blank-for-customer/{customer_id}", response_model=Order)
async def create_blank_order(customer_id: str):
    """Erstellt einen leeren Auftrag direkt fuer einen Kunden (ohne Angebot)."""
    customer = await find_customer_in_modules(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    order_number = await get_next_order_number()
    name = f"{customer.get('vorname', '')} {customer.get('nachname', '')}".strip() or customer.get("name", "Kunde")
    addr_parts = [customer.get("strasse", ""), f"{customer.get('plz', '')} {customer.get('ort', '')}".strip()]
    addr = "\n".join([p for p in addr_parts if p])

    order_obj = Order(
        order_number=order_number,
        customer_id=customer_id,
        customer_name=name,
        customer_address=addr,
        positions=[],
        vat_rate=19.0,
        subtotal_net=0.0,
        vat_amount=0.0,
        total_gross=0.0,
    )
    await db.orders.insert_one(order_obj.model_dump())
    return order_obj


@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str = Body(..., embed=True)):
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return {"message": "Status aktualisiert"}


@router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, update: OrderUpdate):
    """Auftrag bearbeiten — partielle Updates schreiben nur explizit gesendete Felder."""
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    sent = update.model_dump(exclude_unset=True)
    update_data = {}

    if "positions" in sent and update.positions is not None:
        positions = update.positions
        vat_rate = sent.get("vat_rate", existing.get("vat_rate", 19)) or 0
        discount = sent.get("discount", existing.get("discount", 0)) or 0
        discount_type = sent.get("discount_type", existing.get("discount_type", "percent"))

        if update.custom_total is not None and update.custom_total > 0:
            current_total = sum(p.quantity * p.price_net for p in positions)
            if current_total > 0:
                target_net = update.custom_total / (1 + vat_rate / 100)
                factor = target_net / current_total
                for p in positions:
                    p.price_net = round(p.price_net * factor, 2)

        subtotal_net = sum(p.quantity * p.price_net for p in positions if p.type != "titel")
        discount_amt = subtotal_net * (discount / 100) if discount_type == "percent" else discount
        net_after_discount = subtotal_net - discount_amt
        vat_amount = net_after_discount * (vat_rate / 100) if vat_rate > 0 else 0
        total_gross = net_after_discount + vat_amount

        update_data["positions"] = [p.model_dump() for p in positions]
        update_data["subtotal_net"] = round(subtotal_net, 2)
        update_data["vat_amount"] = round(vat_amount, 2)
        update_data["total_gross"] = round(total_gross, 2)

    for field in ("notes", "vortext", "schlusstext", "betreff",
                  "discount", "discount_type", "vat_rate",
                  "status", "show_lohnanteil", "lohnanteil_custom"):
        if field in sent:
            update_data[field] = sent[field]

    # Platzhalter wie {anrede_brief} in Text-Feldern ersetzen, falls mitgesendet
    if any(f in update_data for f in ("notes", "vortext", "schlusstext")):
        kunde_dict_upd = await db.module_kunden.find_one(
            {"id": sent.get("customer_id", existing.get("customer_id", ""))}, {"_id": 0}
        )
        for f in ("notes", "vortext", "schlusstext"):
            if f in update_data:
                update_data[f] = ersetze_platzhalter(update_data[f], kunde_dict_upd)

    if "customer_id" in sent and update.customer_id:
        customer = await find_customer_in_modules(update.customer_id)
        if customer:
            update_data["customer_id"] = update.customer_id
            update_data["customer_name"] = customer["name"]
            update_data["customer_address"] = customer.get("address", "")

    if update_data:
        await db.orders.update_one({"id": order_id}, {"$set": update_data})
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return {"message": "Auftrag gelöscht"}
