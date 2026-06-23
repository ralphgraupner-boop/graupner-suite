"""module_dokumente/routes_copy.py — Dokument-Kopier-Buttons.

Erstellt 1:1-Kopien eines geöffneten Dokuments als neuen Vorgang:
  * Angebot  -> Auftragsbestätigung
  * Angebot  -> Rechnung
  * Auftragsbestätigung -> Rechnung

Regeln: neue Dokumentnummer, gleicher Kunde (Vorgang/Historie),
KEINE Statusänderung am Quelldokument. Gesperrte Dateien werden nicht verändert;
Nummerngeneratoren werden nur importiert (wiederverwendet).
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta

from models import Order, Invoice
from database import db
from module_auftraege.routes import get_next_order_number
from module_rechnungen.routes_v1 import get_next_invoice_number, _get_default_due_days

router = APIRouter()


def _copy_fields(src: dict) -> dict:
    """Übernimmt alle inhaltlichen Felder (Positionen, Preise, Kundendaten, Texte)."""
    return dict(
        customer_id=src["customer_id"],
        customer_name=src.get("customer_name", ""),
        customer_address=src.get("customer_address", ""),
        positions=src.get("positions", []),
        notes=src.get("notes", ""),
        vortext=src.get("vortext", ""),
        schlusstext=src.get("schlusstext", ""),
        betreff=src.get("betreff", ""),
        discount=src.get("discount", 0),
        discount_type=src.get("discount_type", "percent"),
        vat_rate=src.get("vat_rate", 19),
        subtotal_net=src.get("subtotal_net", 0),
        vat_amount=src.get("vat_amount", 0),
        total_gross=src.get("total_gross", 0),
        show_lohnanteil=src.get("show_lohnanteil", False),
        lohnanteil_custom=src.get("lohnanteil_custom"),
    )


async def _new_invoice_dates() -> dict:
    due_days = await _get_default_due_days()
    due_date = (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat()
    return {"due_days": due_days, "due_date": due_date}


@router.post("/documents/copy/quote-to-order/{quote_id}", response_model=Order)
async def copy_quote_to_order(quote_id: str):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    order = Order(order_number=await get_next_order_number(), quote_id=quote_id,
                  quote_prev_status=quote.get("status", ""), **_copy_fields(quote))
    await db.orders.insert_one(order.model_dump())
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "Beauftragt"}})
    return order


@router.post("/documents/copy/quote-to-invoice/{quote_id}", response_model=Invoice)
async def copy_quote_to_invoice(quote_id: str):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    inv = Invoice(invoice_number=await get_next_invoice_number(), **await _new_invoice_dates(), **_copy_fields(quote))
    await db.invoices.insert_one(inv.model_dump())
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "Beauftragt"}})
    return inv


@router.post("/documents/copy/order-to-invoice/{order_id}", response_model=Invoice)
async def copy_order_to_invoice(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    inv = Invoice(invoice_number=await get_next_invoice_number(), order_id=order_id, **await _new_invoice_dates(), **_copy_fields(order))
    await db.invoices.insert_one(inv.model_dump())
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "Abgerechnet"}})
    return inv
