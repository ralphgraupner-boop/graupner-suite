"""EML-Export fuer Angebote, Auftragsbestaetigungen und Rechnungen.

Liefert eine fertige .eml-Datei (RFC822) mit Empfaenger, Betreff, Body (Vor-/
Schlusstext) und dem Dokument-PDF als Anhang. Gedacht fuer "Mailprogramm
oeffnen": Der Browser laedt die .eml, das lokale Mailprogramm (z.B. Betterbird)
oeffnet sie inkl. PDF-Anhang. mailto: kann das nicht, .eml schon.
"""
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from database import db
from utils.pdf_generator import generate_document_pdf

router = APIRouter()

_LABELS = {"quote": "Angebot", "order": "Auftragsbestätigung", "invoice": "Rechnung"}
_NUMBER_KEYS = {"quote": "quote_number", "order": "order_number", "invoice": "invoice_number"}
_COLLECTION = {"quote": "quotes", "order": "orders", "invoice": "invoices"}


def _ascii_label(label: str) -> str:
    return (label.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
            .replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue").replace("ß", "ss"))


async def _customer_email(doc: dict) -> str:
    if doc.get("customer_email"):
        return doc["customer_email"]
    cid = doc.get("customer_id")
    if cid:
        for coll in ("module_kunden", "module_kontakt"):
            c = await db[coll].find_one({"id": cid}, {"_id": 0, "email": 1})
            if c and c.get("email"):
                return c["email"]
    return ""


async def _build_eml_response(doc_type: str, doc: dict, with_text: bool) -> Response:
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    label = _LABELS[doc_type]
    number = doc.get(_NUMBER_KEYS[doc_type], "") or ""
    company = settings.get("company_name") or "Tischlerei Graupner"

    pdf_bytes = generate_document_pdf(doc_type, doc, settings).read()

    subject = doc.get("betreff") or f"{label} {number}"
    if with_text:
        parts = []
        if (doc.get("vortext") or "").strip():
            parts.append(doc["vortext"].strip())
        if (doc.get("schlusstext") or "").strip():
            parts.append(doc["schlusstext"].strip())
        parts.append(f"Mit freundlichen Grüßen\n{company}")
        body = "\n\n".join(parts)
    else:
        body = ""

    msg = EmailMessage()
    to_email = await _customer_email(doc)
    if to_email:
        msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body if body else " ")

    safe = _ascii_label(label)
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf",
                       filename=f"{safe}_{number}.pdf")

    eml_bytes = msg.as_bytes()
    fname = f"{safe}_{number}.eml"
    return Response(
        content=eml_bytes,
        media_type="message/rfc822",
        headers={
            "Content-Disposition": f'attachment; filename="{fname}"',
            "Content-Length": str(len(eml_bytes)),
        },
    )


async def _build_meta_response(doc_type: str, doc: dict, with_text: bool) -> dict:
    """Liefert nur Empfaenger/Betreff/Body als JSON – fuer den lokalen
    Betterbird-Helfer (bbcompose), der das PDF separat ueber /api/pdf laedt."""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    label = _LABELS[doc_type]
    number = doc.get(_NUMBER_KEYS[doc_type], "") or ""
    company = settings.get("company_name") or "Tischlerei Graupner"

    subject = doc.get("betreff") or f"{label} {number}"
    if with_text:
        parts = []
        if (doc.get("vortext") or "").strip():
            parts.append(doc["vortext"].strip())
        if (doc.get("schlusstext") or "").strip():
            parts.append(doc["schlusstext"].strip())
        parts.append(f"Mit freundlichen Grüßen\n{company}")
        body = "\n\n".join(parts)
    else:
        body = ""

    to_email = await _customer_email(doc)
    return {"to": to_email, "subject": subject, "body": body}


@router.get("/eml-meta/{doc_type}/{doc_id}")
async def get_eml_meta(doc_type: str, doc_id: str, text: int = Query(1)):
    if doc_type not in _COLLECTION:
        raise HTTPException(status_code=400, detail="Unbekannter Dokumenttyp")
    doc = await db[_COLLECTION[doc_type]].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    return await _build_meta_response(doc_type, doc, with_text=bool(text))


@router.get("/eml/quote/{quote_id}")
async def get_quote_eml(quote_id: str, text: int = Query(1)):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    return await _build_eml_response("quote", quote, with_text=bool(text))


@router.get("/eml/order/{order_id}")
async def get_order_eml(order_id: str, text: int = Query(1)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return await _build_eml_response("order", order, with_text=bool(text))


@router.get("/eml/invoice/{invoice_id}")
async def get_invoice_eml(invoice_id: str, text: int = Query(1)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return await _build_eml_response("invoice", invoice, with_text=bool(text))
