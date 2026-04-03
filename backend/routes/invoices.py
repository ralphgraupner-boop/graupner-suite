from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List
from datetime import datetime, timezone, timedelta
from models import Invoice, InvoiceCreate, InvoiceUpdate, Position
from database import db, logger
from auth import get_current_user

router = APIRouter()


async def get_next_invoice_number():
    counter = await db.counters.find_one_and_update(
        {"_id": "invoice_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"R-{datetime.now().year}-{str(counter['seq']).zfill(4)}"


@router.get("/invoices", response_model=List[Invoice])
async def get_invoices():
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    return invoices


@router.get("/invoices/overdue")
async def get_overdue_invoices(user=Depends(get_current_user)):
    """Überfällige Rechnungen ermitteln - MUST be before /invoices/{invoice_id}"""
    now = datetime.now(timezone.utc)
    invoices = await db.invoices.find({"status": {"$in": ["Offen", "Gesendet", "Überfällig"]}}, {"_id": 0}).to_list(1000)
    overdue = []
    for inv in invoices:
        if inv.get("due_date"):
            try:
                due = datetime.fromisoformat(inv["due_date"])
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if now > due:
                    days_overdue = (now - due).days
                    inv["days_overdue"] = days_overdue
                    overdue.append(inv)
            except (ValueError, TypeError):
                pass
    overdue.sort(key=lambda x: x.get("days_overdue", 0), reverse=True)
    return overdue


@router.get("/invoices/due-soon")
async def get_due_soon_invoices(user=Depends(get_current_user)):
    """Rechnungen die in den nächsten 3 Tagen fällig werden"""
    now = datetime.now(timezone.utc)
    in_3_days = now + timedelta(days=3)
    invoices = await db.invoices.find({"status": {"$in": ["Offen", "Gesendet"]}}, {"_id": 0}).to_list(1000)
    due_soon = []
    for inv in invoices:
        if inv.get("due_date"):
            try:
                due = datetime.fromisoformat(inv["due_date"])
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if now <= due <= in_3_days:
                    inv["days_until_due"] = (due - now).days
                    due_soon.append(inv)
            except (ValueError, TypeError):
                pass
    due_soon.sort(key=lambda x: x.get("days_until_due", 0))
    return due_soon


@router.post("/invoices/check-due")
async def check_due_invoices(user=Depends(get_current_user)):
    """Prüft fällige Rechnungen und sendet Push-Benachrichtigungen"""
    from routes.push import send_push_to_all
    now = datetime.now(timezone.utc)
    in_3_days = now + timedelta(days=3)
    invoices = await db.invoices.find({"status": {"$in": ["Offen", "Gesendet"]}}, {"_id": 0}).to_list(1000)

    due_soon = []
    overdue = []
    for inv in invoices:
        if inv.get("due_date"):
            try:
                due = datetime.fromisoformat(inv["due_date"])
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if now > due:
                    overdue.append(inv)
                elif due <= in_3_days:
                    due_soon.append(inv)
            except (ValueError, TypeError):
                pass

    notifications_sent = 0
    if due_soon:
        body = f"{len(due_soon)} Rechnung(en) in den nächsten 3 Tagen fällig"
        if len(due_soon) == 1:
            body = f"Rechnung {due_soon[0].get('invoice_number','')} an {due_soon[0].get('customer_name','')} bald fällig"
        await send_push_to_all(title="Fälligkeits-Warnung", body=body, url="/invoices")
        notifications_sent += 1

    if overdue:
        for inv in overdue:
            if inv.get("status") != "Überfällig":
                await db.invoices.update_one({"id": inv["id"]}, {"$set": {"status": "Überfällig"}})
        body = f"{len(overdue)} Rechnung(en) überfällig!"
        await send_push_to_all(title="Überfällige Rechnungen", body=body, url="/invoices")
        notifications_sent += 1

    return {
        "due_soon": len(due_soon),
        "overdue": len(overdue),
        "notifications_sent": notifications_sent
    }


@router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return invoice


@router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice: InvoiceCreate):
    customer = await db.customers.find_one({"id": invoice.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    invoice_number = await get_next_invoice_number()

    subtotal_net = sum(p.quantity * p.price_net for p in invoice.positions if p.type != "titel")
    discount_amt = subtotal_net * (invoice.discount / 100) if invoice.discount_type == "percent" else invoice.discount
    net_after_discount = subtotal_net - discount_amt
    vat_amount = net_after_discount * (invoice.vat_rate / 100) if invoice.vat_rate > 0 else 0
    total_gross = net_after_discount + vat_amount
    final_amount = total_gross - invoice.deposit_amount

    due_date = (datetime.now(timezone.utc) + timedelta(days=invoice.due_days)).isoformat()

    invoice_obj = Invoice(
        invoice_number=invoice_number,
        order_id=invoice.order_id,
        customer_id=invoice.customer_id,
        customer_name=customer["name"],
        customer_address=customer.get("address", ""),
        positions=[p.model_dump() for p in invoice.positions],
        notes=invoice.notes,
        vortext=invoice.vortext,
        schlusstext=invoice.schlusstext,
        betreff=invoice.betreff,
        discount=invoice.discount,
        discount_type=invoice.discount_type,
        vat_rate=invoice.vat_rate,
        subtotal_net=round(subtotal_net, 2),
        vat_amount=round(vat_amount, 2),
        total_gross=round(total_gross, 2),
        deposit_amount=round(invoice.deposit_amount, 2),
        final_amount=round(final_amount, 2),
        due_date=due_date
    )

    await db.invoices.insert_one(invoice_obj.model_dump())
    return invoice_obj


@router.post("/invoices/from-order/{order_id}", response_model=Invoice)
async def create_invoice_from_order(order_id: str, due_days: int = Body(14, embed=True)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    invoice_number = await get_next_invoice_number()
    due_date = (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat()

    invoice_obj = Invoice(
        invoice_number=invoice_number,
        order_id=order_id,
        customer_id=order["customer_id"],
        customer_name=order["customer_name"],
        customer_address=order["customer_address"],
        positions=order["positions"],
        notes=order.get("notes", ""),
        vortext=order.get("vortext", ""),
        schlusstext=order.get("schlusstext", ""),
        vat_rate=order["vat_rate"],
        subtotal_net=order["subtotal_net"],
        vat_amount=order["vat_amount"],
        total_gross=order["total_gross"],
        due_date=due_date
    )

    await db.invoices.insert_one(invoice_obj.model_dump())
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "Abgerechnet"}})

    return invoice_obj


@router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, status: str = Body(..., embed=True)):
    update_data = {"status": status}
    if status == "Bezahlt":
        update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "Offen":
        update_data["paid_at"] = None

    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return {"message": "Status aktualisiert"}


@router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, update: InvoiceUpdate):
    """Rechnung bearbeiten mit Anzahlung und optionaler Gesamtsummen-Anpassung"""
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    positions = update.positions

    if update.custom_total is not None and update.custom_total > 0:
        current_total = sum(p.quantity * p.price_net for p in positions)
        if current_total > 0:
            target_net = update.custom_total / (1 + update.vat_rate / 100)
            factor = target_net / current_total
            for p in positions:
                p.price_net = round(p.price_net * factor, 2)

    subtotal_net = sum(p.quantity * p.price_net for p in positions if p.type != "titel")
    discount_amt = subtotal_net * (update.discount / 100) if update.discount_type == "percent" else update.discount
    net_after_discount = subtotal_net - discount_amt
    vat_amount = net_after_discount * (update.vat_rate / 100) if update.vat_rate > 0 else 0
    total_gross = net_after_discount + vat_amount
    final_amount = total_gross - update.deposit_amount

    update_data = {
        "positions": [p.model_dump() for p in positions],
        "notes": update.notes,
        "vortext": update.vortext,
        "schlusstext": update.schlusstext,
        "betreff": update.betreff,
        "discount": update.discount,
        "discount_type": update.discount_type,
        "vat_rate": update.vat_rate,
        "subtotal_net": round(subtotal_net, 2),
        "vat_amount": round(vat_amount, 2),
        "total_gross": round(total_gross, 2),
        "deposit_amount": round(update.deposit_amount, 2),
        "final_amount": round(final_amount, 2)
    }

    if update.status:
        update_data["status"] = update.status
        if update.status == "Bezahlt":
            update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
        elif update.status == "Offen":
            update_data["paid_at"] = None

    await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return updated


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return {"message": "Rechnung gelöscht"}


# ==================== MAHNWESEN ====================

@router.post("/invoices/{invoice_id}/dunning")
async def advance_dunning(invoice_id: str, user=Depends(get_current_user)):
    """Mahnstufe erhöhen und Historie speichern"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    current_level = invoice.get("dunning_level", 0)
    if current_level >= 3:
        raise HTTPException(status_code=400, detail="Maximale Mahnstufe bereits erreicht")

    new_level = current_level + 1
    dunning_fees = {1: 0, 2: 5.00, 3: 10.00}
    fee = dunning_fees.get(new_level, 0)

    history_entry = {
        "level": new_level,
        "date": datetime.now(timezone.utc).isoformat(),
        "fee": fee,
        "label": {1: "Zahlungserinnerung", 2: "1. Mahnung", 3: "Letzte Mahnung"}.get(new_level, "Mahnung")
    }

    await db.invoices.update_one(
        {"id": invoice_id},
        {
            "$set": {
                "dunning_level": new_level,
                "dunning_date": datetime.now(timezone.utc).isoformat(),
                "dunning_fee": fee,
                "status": "Überfällig"
            },
            "$push": {
                "dunning_history": history_entry
            }
        }
    )

    return {"message": f"Mahnstufe auf {new_level} erhöht", "dunning_level": new_level, "fee": fee}
