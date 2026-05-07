from fastapi import APIRouter, Depends
from database import db, logger
from auth import get_current_user
from datetime import datetime, timezone

router = APIRouter()

DOKUMENTE_MODUL = {
    "name": "Dokumente (Angebote, Auftraege, Rechnungen)",
    "slug": "dokumente",
    "version": "1.0.0",
    "description": "Eigenstaendiges Dokumenten-Modul. Erstellt und verwaltet Angebote, Auftraege und Rechnungen. Bezieht Kundendaten vom Kontakt-Modul und Positionen vom Artikel & Leistungen Modul.",
    "status": "aktiv",
    "category": "ausgabe",
    "data_collection": "quotes, orders, invoices",
    "fields": [
        {"name": "doc_type", "type": "select", "label": "Dokumenttyp", "options": ["Angebot", "Auftrag", "Rechnung"], "required": True},
        {"name": "doc_number", "type": "auto", "label": "Dokumentnummer", "required": True},
        {"name": "kontakt_id", "type": "relation", "label": "Kontakt", "relation_module": "kontakt", "required": True},
        {"name": "betreff", "type": "text", "label": "Betreff", "required": False},
        {"name": "positions", "type": "positions", "label": "Positionen", "relation_module": "artikel-leistungen"},
        {"name": "vortext", "type": "textarea", "label": "Vortext"},
        {"name": "schlusstext", "type": "textarea", "label": "Schlusstext"},
        {"name": "vat_rate", "type": "number", "label": "MwSt-Satz (%)", "default": 19},
        {"name": "discount", "type": "number", "label": "Rabatt"},
        {"name": "status", "type": "select", "label": "Status", "options": ["Entwurf", "Gesendet", "Angenommen", "Abgelehnt", "Bezahlt", "Ueberfaellig"]},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/quotes", "description": "Alle Angebote"},
        {"method": "GET", "path": "/api/orders", "description": "Alle Auftraege"},
        {"method": "GET", "path": "/api/invoices", "description": "Alle Rechnungen"},
        {"method": "POST", "path": "/api/quotes", "description": "Neues Angebot"},
        {"method": "POST", "path": "/api/orders", "description": "Neuer Auftrag"},
        {"method": "POST", "path": "/api/invoices", "description": "Neue Rechnung"},
    ],
    "dependencies": ["kontakt", "artikel-leistungen"],
}


async def ensure_modul_registered():
    existing = await db.modules.find_one({"slug": "dokumente"})
    if not existing:
        from routes.modules import ModuleSchema
        modul = ModuleSchema(**DOKUMENTE_MODUL)
        await db.modules.insert_one(modul.model_dump())
        logger.info("Dokumente-Modul registriert")


@router.get("/modules/dokumente/stats")
async def get_dokumente_stats(user=Depends(get_current_user)):
    """Statistiken ueber alle Dokumente"""
    await ensure_modul_registered()
    quotes_count = await db.quotes.count_documents({})
    orders_count = await db.orders.count_documents({})
    invoices_count = await db.invoices.count_documents({})

    # Umsatz berechnen
    invoices = await db.invoices.find({}, {"_id": 0, "total_gross": 1, "status": 1}).to_list(10000)
    total_invoiced = sum(i.get("total_gross", 0) for i in invoices)
    total_paid = sum(i.get("total_gross", 0) for i in invoices if i.get("status") == "Bezahlt")

    return {
        "quotes": quotes_count,
        "orders": orders_count,
        "invoices": invoices_count,
        "total_invoiced": round(total_invoiced, 2),
        "total_paid": round(total_paid, 2),
    }


@router.get("/modules/dokumente/export")
async def export_dokumente(user=Depends(get_current_user)):
    """Alle Dokumente exportieren"""
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(10000)
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "dokumente"}, {"_id": 0})
    return {
        "module": modul,
        "data": {"quotes": quotes, "orders": orders, "invoices": invoices},
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(quotes) + len(orders) + len(invoices),
    }
