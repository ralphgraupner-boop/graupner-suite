from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from models import Invoice, InvoiceCreate, InvoiceUpdate, Position
from database import db, logger
from auth import get_current_user
from module_angebote import find_customer_in_modules

router = APIRouter()


async def _get_default_due_days() -> int:
    """Liest default_due_days aus settings; Fallback 14 wenn settings fehlt."""
    s = await db.settings.find_one({}, {"_id": 0, "default_due_days": 1})
    try:
        v = int((s or {}).get("default_due_days", 14))
        return v if v >= 0 else 14
    except (TypeError, ValueError):
        return 14


async def get_next_invoice_number():
    """Liest Format und nächste Nummer aus settings; inkrementiert atomar.
    Platzhalter: {MM}, {YY}, {YYYY}, {NNNN}, {NNNNN}, {NNNNNN}
    """
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        await db.settings.insert_one({
            "id": "company_settings",
            "invoice_number_format": "R-{MM}/{YY}-{NNNNN}",
            "invoice_number_next": 1,
        })
        settings = {"invoice_number_format": "R-{MM}/{YY}-{NNNNN}", "invoice_number_next": 1}

    try:
        seq = int(settings.get("invoice_number_next") or 1)
    except (TypeError, ValueError):
        seq = 1
    if seq < 1:
        seq = 1
    fmt = settings.get("invoice_number_format") or "R-{MM}/{YY}-{NNNNN}"

    await db.settings.update_one(
        {"id": "company_settings"},
        {"$set": {"invoice_number_next": seq + 1}},
        upsert=True,
    )

    now = datetime.now()
    out = fmt
    out = out.replace("{MM}", f"{now.month:02d}")
    out = out.replace("{YYYY}", str(now.year))
    out = out.replace("{YY}", f"{now.year % 100:02d}")
    out = out.replace("{NNNNNN}", f"{seq:06d}")
    out = out.replace("{NNNNN}", f"{seq:05d}")
    out = out.replace("{NNNN}", f"{seq:04d}")
    return out


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
    """Prüft fällige Rechnungen und sendet Push-Benachrichtigungen.
    Push pro Rechnung max. 1× alle 24 h (Throttle).
    """
    from routes.push import send_push_to_all
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    in_3_days = now + timedelta(days=3)
    throttle_iso = (now - timedelta(hours=24)).isoformat()

    # 1) Snooze-Reset: NUR snooze_until entfernen
    await db.invoices.update_many(
        {"snooze_until": {"$lte": now_iso}},
        {"$unset": {"snooze_until": ""}}
    )

    # 2) Throttle-Wake-up: followup_seen zurück, wenn letzter Push älter als 24h
    await db.invoices.update_many(
        {
            "followup_seen": True,
            "followup_pushed_at": {"$lt": throttle_iso},
            "snooze_until": {"$exists": False},
        },
        {"$unset": {"followup_seen": ""}}
    )

    invoices = await db.invoices.find({"status": {"$in": ["Offen", "Gesendet"]}, "followup_seen": {"$ne": True}}, {"_id": 0}).to_list(1000)

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
    pushed_ids = []

    if due_soon:
        body = f"{len(due_soon)} Rechnung(en) in den nächsten 3 Tagen fällig"
        if len(due_soon) == 1:
            inv1 = due_soon[0]
            body = f"Rechnung {inv1.get('invoice_number','')} an {inv1.get('customer_name','')} bald fällig"
            await send_push_to_all(
                title="Fälligkeits-Warnung",
                body=body,
                url=f"/invoices/edit/{inv1.get('id','')}",
                entity_type="invoice",
                entity_id=inv1.get("id"),
            )
        else:
            await send_push_to_all(title="Fälligkeits-Warnung", body=body, url="/invoices")
        pushed_ids.extend([i.get("id") for i in due_soon if i.get("id")])
        notifications_sent += 1

    if overdue:
        for inv in overdue:
            if inv.get("status") != "Überfällig":
                await db.invoices.update_one({"id": inv["id"]}, {"$set": {"status": "Überfällig"}})
        body = f"{len(overdue)} Rechnung(en) überfällig!"
        await send_push_to_all(title="Überfällige Rechnungen", body=body, url="/invoices")
        pushed_ids.extend([i.get("id") for i in overdue if i.get("id")])
        notifications_sent += 1

    # 3) NACH dem Push: followup_seen + followup_pushed_at für versendete Rechnungen
    if pushed_ids:
        await db.invoices.update_many(
            {"id": {"$in": pushed_ids}},
            {"$set": {"followup_seen": True, "followup_pushed_at": now_iso}}
        )

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
    customer = await find_customer_in_modules(invoice.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    invoice_number = await get_next_invoice_number()

    subtotal_net = sum(p.quantity * p.price_net for p in invoice.positions if p.type != "titel")
    discount_amt = subtotal_net * (invoice.discount / 100) if invoice.discount_type == "percent" else invoice.discount
    net_after_discount = subtotal_net - discount_amt
    vat_amount = net_after_discount * (invoice.vat_rate / 100) if invoice.vat_rate > 0 else 0
    total_gross = net_after_discount + vat_amount
    final_amount = total_gross - invoice.deposit_amount

    due_days_effective = invoice.due_days if invoice.due_days is not None else await _get_default_due_days()
    due_date = (datetime.now(timezone.utc) + timedelta(days=due_days_effective)).isoformat()

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
        due_date=due_date,
        due_days=due_days_effective,
        show_lohnanteil=invoice.show_lohnanteil,
        lohnanteil_custom=invoice.lohnanteil_custom
    )

    await db.invoices.insert_one(invoice_obj.model_dump())
    return invoice_obj


@router.post("/invoices/from-order/{order_id}", response_model=Invoice)
async def create_invoice_from_order(order_id: str, due_days: Optional[int] = Body(None, embed=True)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    invoice_number = await get_next_invoice_number()
    due_days_effective = due_days if due_days is not None else await _get_default_due_days()
    due_date = (datetime.now(timezone.utc) + timedelta(days=due_days_effective)).isoformat()

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
        due_date=due_date,
        due_days=due_days_effective
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


@router.put("/invoices/{invoice_id}/print-status")
async def toggle_invoice_print_status(invoice_id: str, payload: dict = Body(...)):
    """Markiert die Rechnung manuell als 'Gedruckt' oder setzt es zurueck.
    WICHTIG: Solange eine Rechnung nicht als gedruckt markiert ist, darf sie
    frei bearbeitet werden. Ab dem Zeitpunkt des Markierens gilt sie aus
    Nutzer-Sicht als rechtsverbindlich ausgegeben."""
    is_printed = bool(payload.get("is_printed", True))
    update = {"is_printed": is_printed}
    if is_printed:
        update["printed_at"] = datetime.now(timezone.utc).isoformat()
    else:
        update["printed_at"] = None
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return {"ok": True, "is_printed": is_printed, "printed_at": update["printed_at"]}



@router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, update: InvoiceUpdate):
    """Rechnung bearbeiten — partielle Updates schreiben nur explizit gesendete Felder."""
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    sent = update.model_dump(exclude_unset=True)
    update_data = {}

    if "positions" in sent and update.positions is not None:
        positions = update.positions
        vat_rate = sent.get("vat_rate", existing.get("vat_rate", 19)) or 0
        discount = sent.get("discount", existing.get("discount", 0)) or 0
        discount_type = sent.get("discount_type", existing.get("discount_type", "percent"))
        deposit = sent.get("deposit_amount", existing.get("deposit_amount", 0)) or 0

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
        final_amount = total_gross - deposit

        update_data["positions"] = [p.model_dump() for p in positions]
        update_data["subtotal_net"] = round(subtotal_net, 2)
        update_data["vat_amount"] = round(vat_amount, 2)
        update_data["total_gross"] = round(total_gross, 2)
        update_data["deposit_amount"] = round(deposit, 2)
        update_data["final_amount"] = round(final_amount, 2)

    for field in ("notes", "vortext", "schlusstext", "betreff",
                  "discount", "discount_type", "vat_rate", "deposit_amount",
                  "status", "show_lohnanteil", "lohnanteil_custom"):
        if field in sent:
            update_data[field] = sent[field]

    if "status" in sent and update.status:
        if update.status == "Bezahlt":
            update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
        elif update.status == "Offen":
            update_data["paid_at"] = None

    # Zahlungsziel pro Rechnung überschreibbar — wenn due_days gesetzt, due_date neu berechnen.
    if "due_days" in sent and update.due_days is not None:
        try:
            dd = int(update.due_days)
            if dd < 0:
                dd = 0
            base_iso = existing.get("created_at") or datetime.now(timezone.utc).isoformat()
            try:
                base_dt = datetime.fromisoformat(base_iso.replace("Z", "+00:00"))
            except Exception:
                base_dt = datetime.now(timezone.utc)
            update_data["due_days"] = dd
            update_data["due_date"] = (base_dt + timedelta(days=dd)).isoformat()
        except (TypeError, ValueError):
            pass

    # Kundendaten aktualisieren wenn customer_id mitgeschickt wird
    if "customer_id" in sent and update.customer_id:
        customer = await find_customer_in_modules(update.customer_id)
        if customer:
            update_data["customer_id"] = update.customer_id
            update_data["customer_name"] = customer["name"]
            update_data["customer_address"] = customer.get("address", "")

    if update_data:
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
async def advance_dunning(invoice_id: str, body: dict = {}, user=Depends(get_current_user)):
    """Mahnstufe setzen (mit optionalem Custom-Text und Level) und Historie speichern"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    # Level kann direkt gewählt werden oder automatisch +1
    target_level = body.get("level")
    custom_text = body.get("custom_text", "")
    
    if target_level:
        new_level = min(max(int(target_level), 1), 3)
    else:
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
        "label": {1: "Zahlungserinnerung", 2: "1. Mahnung", 3: "Letzte Mahnung"}.get(new_level, "Mahnung"),
        "custom_text": custom_text if custom_text else None
    }

    await db.invoices.update_one(
        {"id": invoice_id},
        {
            "$set": {
                "dunning_level": new_level,
                "dunning_date": datetime.now(timezone.utc).isoformat(),
                "dunning_fee": fee,
                "dunning_custom_text": custom_text,
                "status": "Überfällig"
            },
            "$push": {
                "dunning_history": history_entry
            }
        }
    )

    return {"message": f"Mahnstufe auf {new_level} gesetzt", "dunning_level": new_level, "fee": fee}
