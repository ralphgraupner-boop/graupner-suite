from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from database import db
from utils.pdf_generator import generate_document_pdf, generate_dunning_pdf

router = APIRouter()


@router.get("/pdf/dunning/{invoice_id}")
async def get_dunning_pdf(invoice_id: str, download: bool = Query(False)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    level = invoice.get("dunning_level", 1)

    pdf_buffer = generate_dunning_pdf(invoice, settings, level)
    pdf_bytes = pdf_buffer.read()
    level_labels = {1: "Zahlungserinnerung", 2: "1_Mahnung", 3: "Letzte_Mahnung"}
    filename = f"{level_labels.get(level, 'Mahnung')}_{invoice['invoice_number']}.pdf"
    disposition = "attachment" if download else "inline"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )


@router.get("/pdf/quote/{quote_id}")
async def get_quote_pdf(quote_id: str, download: bool = Query(False)):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    pdf_buffer = generate_document_pdf("quote", quote, settings)
    pdf_bytes = pdf_buffer.read()
    filename = f"Angebot_{quote['quote_number']}.pdf"
    disposition = "attachment" if download else "inline"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )


@router.get("/pdf/order/{order_id}")
async def get_order_pdf(order_id: str, download: bool = Query(False)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    pdf_buffer = generate_document_pdf("order", order, settings)
    pdf_bytes = pdf_buffer.read()
    filename = f"Auftragsbestaetigung_{order['order_number']}.pdf"
    disposition = "attachment" if download else "inline"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )


@router.get("/pdf/invoice/{invoice_id}")
async def get_invoice_pdf(invoice_id: str, download: bool = Query(False)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    pdf_buffer = generate_document_pdf("invoice", invoice, settings)
    pdf_bytes = pdf_buffer.read()
    filename = f"Rechnung_{invoice['invoice_number']}.pdf"
    disposition = "attachment" if download else "inline"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )
