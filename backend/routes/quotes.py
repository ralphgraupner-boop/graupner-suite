from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List
from datetime import datetime, timezone, timedelta
from models import Quote, QuoteCreate, QuoteUpdate, Position
from database import db
from auth import get_current_user

router = APIRouter()


async def find_customer_in_modules(customer_id: str):
    """Sucht Kunden in allen Modulen (Kunden-Modul, Kontakt-Modul, Legacy)"""
    # 1. Kunden-Modul
    customer = await db.module_kunden.find_one({"id": customer_id}, {"_id": 0})
    if customer:
        name = f"{customer.get('vorname', '')} {customer.get('nachname', '')}".strip() or customer.get('firma', 'Unbekannt')
        address = customer.get('address') or f"{customer.get('strasse', '')} {customer.get('hausnummer', '')}, {customer.get('plz', '')} {customer.get('ort', '')}".strip().strip(",").strip()
        return {"name": name, "address": address, "email": customer.get("email", ""), "firma": customer.get("firma", "")}
    # 2. Kontakt-Modul
    kontakt = await db.module_kontakt.find_one({"id": customer_id}, {"_id": 0})
    if kontakt:
        name = f"{kontakt.get('vorname', '')} {kontakt.get('nachname', '')}".strip() or kontakt.get('firma', 'Unbekannt')
        address = f"{kontakt.get('strasse', '')} {kontakt.get('hausnummer', '')}, {kontakt.get('plz', '')} {kontakt.get('ort', '')}".strip().strip(",").strip()
        return {"name": name, "address": address, "email": kontakt.get("email", ""), "firma": kontakt.get("firma", "")}
    # 3. Fallback: Legacy
    legacy = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if legacy:
        return {"name": legacy.get("name", ""), "address": legacy.get("address", ""), "email": legacy.get("email", ""), "firma": legacy.get("firma", "")}
    return None


async def get_next_quote_number():
    counter = await db.counters.find_one_and_update(
        {"_id": "quote_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"A-{datetime.now().year}-{str(counter['seq']).zfill(4)}"


@router.get("/quotes", response_model=List[Quote])
async def get_quotes():
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(1000)
    return quotes


@router.get("/quotes/followup")
async def get_followup_quotes(user=Depends(get_current_user)):
    """Angebote die zur Wiedervorlage fällig sind"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    followup_days = settings.get("followup_days", 7)
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(days=followup_days)
    quotes = await db.quotes.find(
        {"status": {"$in": ["Entwurf", "Gesendet"]}, "followup_sent": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)

    followup = []
    for q in quotes:
        try:
            created = datetime.fromisoformat(q.get("created_at", ""))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created < threshold:
                q["days_since_created"] = (now - created).days
                followup.append(q)
        except (ValueError, TypeError):
            pass
    followup.sort(key=lambda x: x.get("days_since_created", 0), reverse=True)
    return followup


@router.post("/quotes/check-followup")
async def check_followup_quotes(user=Depends(get_current_user)):
    """Prüft Angebote für automatische Wiedervorlage und sendet Push"""
    from routes.push import send_push_to_all
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    followup_days = settings.get("followup_days", 7)
    if settings.get("followup_push_enabled") in (False, "false"):
        return {"followup_count": 0, "quotes": [], "push_disabled": True}
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(days=followup_days)
    quotes = await db.quotes.find(
        {"status": {"$in": ["Entwurf", "Gesendet"]}, "followup_sent": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)

    followup = []
    for q in quotes:
        try:
            created = datetime.fromisoformat(q.get("created_at", ""))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created < threshold:
                followup.append(q)
        except (ValueError, TypeError):
            pass

    if followup:
        body = f"{len(followup)} Angebot(e) zur Wiedervorlage fällig"
        if len(followup) == 1:
            body = f"Angebot {followup[0].get('quote_number','')} an {followup[0].get('customer_name','')} nachfassen"
        await send_push_to_all(title="Angebots-Wiedervorlage", body=body, url="/quotes")

    return {"followup_count": len(followup), "quotes": followup}


@router.get("/quotes/{quote_id}", response_model=Quote)
async def get_quote(quote_id: str):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    return quote


@router.post("/quotes", response_model=Quote)
async def create_quote(quote: QuoteCreate):
    customer = await find_customer_in_modules(quote.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    quote_number = await get_next_quote_number()

    subtotal_net = sum(p.quantity * p.price_net for p in quote.positions if p.type != "titel")
    discount_amt = subtotal_net * (quote.discount / 100) if quote.discount_type == "percent" else quote.discount
    net_after_discount = subtotal_net - discount_amt
    vat_amount = net_after_discount * (quote.vat_rate / 100) if quote.vat_rate > 0 else 0
    total_gross = net_after_discount + vat_amount

    valid_until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    quote_obj = Quote(
        quote_number=quote_number,
        customer_id=quote.customer_id,
        customer_name=customer["name"],
        customer_address=customer.get("address", ""),
        positions=[p.model_dump() for p in quote.positions],
        notes=quote.notes,
        vortext=quote.vortext,
        schlusstext=quote.schlusstext,
        betreff=quote.betreff,
        discount=quote.discount,
        discount_type=quote.discount_type,
        vat_rate=quote.vat_rate,
        subtotal_net=round(subtotal_net, 2),
        vat_amount=round(vat_amount, 2),
        total_gross=round(total_gross, 2),
        valid_until=valid_until,
        show_lohnanteil=quote.show_lohnanteil,
        lohnanteil_custom=quote.lohnanteil_custom
    )

    await db.quotes.insert_one(quote_obj.model_dump())
    return quote_obj


@router.put("/quotes/{quote_id}", response_model=Quote)
async def update_quote(quote_id: str, update: QuoteUpdate):
    """Angebot bearbeiten mit optionaler Gesamtsummen-Anpassung"""
    existing = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")

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
        "show_lohnanteil": update.show_lohnanteil,
        "lohnanteil_custom": update.lohnanteil_custom
    }

    if update.status:
        update_data["status"] = update.status

    # Kundendaten aktualisieren wenn customer_id mitgeschickt wird
    if update.customer_id:
        customer = await find_customer_in_modules(update.customer_id)
        if customer:
            update_data["customer_id"] = update.customer_id
            update_data["customer_name"] = customer["name"]
            update_data["customer_address"] = customer.get("address", "")

    await db.quotes.update_one({"id": quote_id}, {"$set": update_data})
    updated = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    return updated


@router.put("/quotes/{quote_id}/status")
async def update_quote_status(quote_id: str, status: str = Body(..., embed=True)):
    result = await db.quotes.update_one({"id": quote_id}, {"$set": {"status": status}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    return {"message": "Status aktualisiert"}


@router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str):
    result = await db.quotes.delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    return {"message": "Angebot gelöscht"}
