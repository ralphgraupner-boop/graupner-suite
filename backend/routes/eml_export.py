"""EML-Export fuer Angebote, Auftragsbestaetigungen und Rechnungen.

Liefert eine fertige .eml-Datei (RFC822) mit Empfaenger, Betreff, Body (Vor-/
Schlusstext) und dem Dokument-PDF als Anhang. Gedacht fuer "Mailprogramm
oeffnen": Der Browser laedt die .eml, das lokale Mailprogramm (z.B. Betterbird)
oeffnet sie inkl. PDF-Anhang. mailto: kann das nicht, .eml schon.
"""
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, JSONResponse

from database import db
from utils.pdf_generator import generate_document_pdf

router = APIRouter()

_LABELS = {"quote": "Angebot", "order": "Auftragsbestätigung", "invoice": "Rechnung"}
_NUMBER_KEYS = {"quote": "quote_number", "order": "order_number", "invoice": "invoice_number"}
_COLLECTION = {"quote": "quotes", "order": "orders", "invoice": "invoices", "einsatz": "einsaetze", "begruessung": "module_mail_inbox"}


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


def _signature(settings: dict) -> str:
    """Professionelle Text-Signatur aus den Firmendaten (company_settings).
    Leere Felder werden weggelassen – kein Hardcoding."""
    company = settings.get("company_name") or "Tischlerei Graupner"
    address = (settings.get("address") or settings.get("company_address") or "").strip()
    phone = (settings.get("phone") or "").strip()
    email = (settings.get("email") or "").strip()
    website = (settings.get("website") or "").strip()
    lines = ["--", company]
    if address:
        lines.append(address)
    if phone:
        lines.append(f"Tel.: {phone}")
    if email:
        lines.append(f"E-Mail: {email}")
    if website:
        lines.append(f"Web: {website}")
    return "\n".join(lines)


def _has_signature(text: str) -> bool:
    """Erkennt, ob der Schlusstext bereits eine Grußformel/Signatur enthält."""
    if not text:
        return False
    low = text.lower()
    markers = ["freundlichen grüßen", "freundlichen gruessen", "freundliche grüße",
               "freundliche gruesse", "\n--", "viele grüße", "beste grüße"]
    return any(m in low for m in markers)


def _compose_body(doc: dict, settings: dict, with_text: bool) -> str:
    """Mail-Text: Vortext, Schlusstext, dann Grußformel + Firmen-Signatur –
    Letztere nur, wenn der Schlusstext noch KEINE Signatur enthält (keine Dopplung)."""
    if not with_text:
        return ""
    parts = []
    vortext = (doc.get("vortext") or "").strip()
    schlusstext = (doc.get("schlusstext") or "").strip()
    if vortext:
        parts.append(vortext)
    if schlusstext:
        parts.append(schlusstext)
    if not _has_signature(schlusstext):
        company = settings.get("company_name") or "Tischlerei Graupner"
        parts.append(f"Mit freundlichen Grüßen\n{company}")
    # Adress-/Kontakt-Signatur (-- + Firmendaten) immer anhängen
    parts.append(_signature(settings))
    return "\n\n".join(parts)


async def _einsatz_email(einsatz: dict) -> str:
    if einsatz.get("kunde_email"):
        return einsatz["kunde_email"]
    kid = einsatz.get("kunde_id")
    if kid:
        for coll in ("module_kunden", "module_kontakt"):
            c = await db[coll].find_one({"id": kid}, {"_id": 0, "email": 1})
            if c and c.get("email"):
                return c["email"]
    return ""


def _compose_einsatz_body(einsatz: dict, settings: dict, with_text: bool) -> str:
    """Mail-Text fuer Einsaetze: Beschreibung + Grußformel + Signatur."""
    if not with_text:
        return ""
    parts = []
    beschreibung = (einsatz.get("beschreibung") or "").strip()
    if beschreibung:
        parts.append(beschreibung)
    if not _has_signature(beschreibung):
        company = settings.get("company_name") or "Tischlerei Graupner"
        parts.append(f"Mit freundlichen Grüßen\n{company}")
    parts.append(_signature(settings))
    return "\n\n".join(parts)


async def _build_eml_response(doc_type: str, doc: dict, with_text: bool) -> Response:
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    label = _LABELS[doc_type]
    number = doc.get(_NUMBER_KEYS[doc_type], "") or ""
    company = settings.get("company_name") or "Tischlerei Graupner"

    pdf_bytes = generate_document_pdf(doc_type, doc, settings).read()

    subject = doc.get("betreff") or f"{label} {number}"
    body = _compose_body(doc, settings, with_text)

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


async def _begruessung_meta(entry: dict, settings: dict) -> dict:
    """Meta für Begrüßungsmail einer Mail-Anfrage: Empfänger + Betreff +
    Vorlage je Prioritätsstufe (Helfer aus routes.anfragen wiederverwendet)."""
    from routes.anfragen import _load_keyword_config, _stufe_of
    from module_mail_inbox.routes_list import _mail_suchtext
    from routes.settings import DEFAULT_BEGRUESSUNGSVORLAGEN

    parsed = entry.get("parsed") or {}
    to_email = parsed.get("email") or entry.get("from_email") or ""

    config = await _load_keyword_config()
    stufe = _stufe_of(_mail_suchtext(entry), config)

    doc = await db.settings.find_one({"id": "begruessungsvorlagen"}, {"_id": 0})
    if doc and doc.get("vorlagen"):
        text = doc["vorlagen"].get(stufe) or DEFAULT_BEGRUESSUNGSVORLAGEN.get(stufe, "")
    else:
        text = DEFAULT_BEGRUESSUNGSVORLAGEN.get(stufe, "")

    company = settings.get("company_name") or "Tischlerei Graupner"
    subject = f"Ihre Anfrage bei {company}"
    body = text.rstrip() + "\n\n" + _signature(settings)
    return {"to": to_email, "subject": subject, "body": body}


async def _build_meta_response(doc_type: str, doc: dict, with_text: bool) -> dict:
    """Liefert nur Empfaenger/Betreff/Body als JSON – fuer den lokalen
    Betterbird-Helfer (bbcompose), der das PDF separat ueber /api/pdf laedt."""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    if doc_type == "begruessung":
        return await _begruessung_meta(doc, settings)
    if doc_type == "einsatz":
        subject = doc.get("betreff") or "Einsatz"
        body = _compose_einsatz_body(doc, settings, with_text)
        to_email = await _einsatz_email(doc)
        return {"to": to_email, "subject": subject, "body": body}
    label = _LABELS[doc_type]
    number = doc.get(_NUMBER_KEYS[doc_type], "") or ""
    company = settings.get("company_name") or "Tischlerei Graupner"

    subject = doc.get("betreff") or f"{label} {number}"
    body = _compose_body(doc, settings, with_text)

    to_email = await _customer_email(doc)
    return {"to": to_email, "subject": subject, "body": body}


@router.get("/eml-meta/{doc_type}/{doc_id}")
async def get_eml_meta(doc_type: str, doc_id: str, text: int = Query(1)):
    if doc_type not in _COLLECTION:
        raise HTTPException(status_code=400, detail="Unbekannter Dokumenttyp")
    doc = await db[_COLLECTION[doc_type]].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    data = await _build_meta_response(doc_type, doc, with_text=bool(text))
    return JSONResponse(content=data, media_type="application/json; charset=utf-8")


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


@router.get("/eml/einsatz/{einsatz_id}")
async def get_einsatz_eml(einsatz_id: str, text: int = Query(1)):
    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(status_code=404, detail="Einsatz nicht gefunden")
    from module_einsaetze.routes import _generate_reparaturauftrag_pdf, _enrich_einsatz_mit_kunde
    einsatz = await _enrich_einsatz_mit_kunde(einsatz)
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    pdf_bytes = _generate_reparaturauftrag_pdf(einsatz, settings)
    subject = einsatz.get("betreff") or "Einsatz"
    body = _compose_einsatz_body(einsatz, settings, bool(text))
    msg = EmailMessage()
    to_email = await _einsatz_email(einsatz)
    if to_email:
        msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body if body else " ")
    name = (einsatz.get("kunde_name") or "Kunde").replace(" ", "_")
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf",
                       filename=f"Reparaturauftrag_{name}.pdf")
    eml_bytes = msg.as_bytes()
    return Response(
        content=eml_bytes,
        media_type="message/rfc822",
        headers={
            "Content-Disposition": f'attachment; filename="Reparaturauftrag_{name}.eml"',
            "Content-Length": str(len(eml_bytes)),
        },
    )
