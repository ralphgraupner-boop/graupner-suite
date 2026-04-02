from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from models import EmailRequest
from database import db, logger
from auth import get_current_user
from utils import send_email
from utils.pdf_generator import generate_document_pdf, generate_dunning_pdf

router = APIRouter()


async def log_email(to_email: str, subject: str, doc_type: str, doc_id: str, doc_number: str, customer_name: str, status: str = "gesendet"):
    """E-Mail-Versand protokollieren"""
    await db.email_logs.insert_one({
        "to_email": to_email,
        "subject": subject,
        "doc_type": doc_type,
        "doc_id": doc_id,
        "doc_number": doc_number,
        "customer_name": customer_name,
        "status": status,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })


@router.get("/email/log")
async def get_email_log(user=Depends(get_current_user)):
    logs = await db.email_logs.find({}, {"_id": 0}).sort("sent_at", -1).to_list(200)
    return logs


@router.get("/email/log/{doc_type}/{doc_id}")
async def get_email_log_for_doc(doc_type: str, doc_id: str, user=Depends(get_current_user)):
    logs = await db.email_logs.find({"doc_type": doc_type, "doc_id": doc_id}, {"_id": 0}).sort("sent_at", -1).to_list(50)
    return logs


@router.post("/email/document/{doc_type}/{doc_id}")
async def email_document(doc_type: str, doc_id: str, req: EmailRequest, user=Depends(get_current_user)):
    """Dokument per E-Mail versenden"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    collection = "quotes" if doc_type == "quote" else "orders" if doc_type == "order" else "invoices"
    doc = await db[collection].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    company_name = settings.get("company_name", "Tischlerei Graupner")
    doc_labels = {"quote": "Angebot", "order": "Auftragsbestätigung", "invoice": "Rechnung"}
    doc_label = doc_labels.get(doc_type, "Dokument")
    doc_number = doc.get("quote_number", doc.get("order_number", doc.get("invoice_number", "")))

    pdf_buffer = generate_document_pdf(doc_type, doc, settings)
    pdf_data = pdf_buffer.read()

    custom_msg = f"<p>{req.message}</p>" if req.message else ""

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #14532D;">{doc_label} {doc_number}</h2>
        <p>Sehr geehrte Damen und Herren,</p>
        {custom_msg if custom_msg else f"<p>anbei erhalten Sie {doc_label} Nr. {doc_number}.</p>"}
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <br>
        <p>Mit freundlichen Grüßen<br><strong>{company_name}</strong></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 20px;">
        <p style="font-size: 12px; color: #64748B;">
            {company_name}<br>
            {settings.get('address', '').replace(chr(10), '<br>') if settings.get('address') else ''}
            {('<br>Tel: ' + settings['phone']) if settings.get('phone') else ''}
        </p>
    </div>
    """

    try:
        send_email(
            to_email=req.to_email,
            subject=req.subject or f"{doc_label} {doc_number} - {company_name}",
            body_html=body_html,
            attachments=[{"filename": f"{doc_label}_{doc_number}.pdf", "data": pdf_data}]
        )
        await log_email(req.to_email, req.subject or f"{doc_label} {doc_number}", doc_type, doc_id, doc_number, doc.get("customer_name", ""), "gesendet")
        return {"message": f"{doc_label} erfolgreich an {req.to_email} gesendet"}
    except Exception as e:
        logger.error(f"E-Mail-Versand fehlgeschlagen: {e}")
        await log_email(req.to_email, f"{doc_label} {doc_number}", doc_type, doc_id, doc_number, doc.get("customer_name", ""), "fehlgeschlagen")
        raise HTTPException(status_code=500, detail=f"E-Mail-Versand fehlgeschlagen: {str(e)}")


@router.post("/email/dunning/{invoice_id}")
async def email_dunning(invoice_id: str, req: EmailRequest, user=Depends(get_current_user)):
    """Mahnung per E-Mail versenden"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    company_name = settings.get("company_name", "Tischlerei Graupner")
    level = invoice.get("dunning_level", 1)
    invoice_number = invoice.get("invoice_number", "")

    pdf_buffer = generate_dunning_pdf(invoice, settings, level)
    pdf_data = pdf_buffer.read()

    level_labels = {1: "Zahlungserinnerung", 2: "1. Mahnung", 3: "Letzte Mahnung"}
    level_label = level_labels.get(level, "Mahnung")

    custom_msg = f"<p>{req.message}</p>" if req.message else ""

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: {'#DC2626' if level >= 2 else '#14532D'};">{level_label} zu Rechnung {invoice_number}</h2>
        <p>Sehr geehrte Damen und Herren,</p>
        {custom_msg if custom_msg else f"<p>anbei erhalten Sie eine {level_label} zu Rechnung Nr. {invoice_number}.</p>"}
        <br>
        <p>Mit freundlichen Grüßen<br><strong>{company_name}</strong></p>
    </div>
    """

    try:
        send_email(
            to_email=req.to_email,
            subject=req.subject or f"{level_label} - Rechnung {invoice_number} - {company_name}",
            body_html=body_html,
            attachments=[{"filename": f"{level_label}_{invoice_number}.pdf", "data": pdf_data}]
        )
        await log_email(req.to_email, f"{level_label}: {invoice_number}", "invoice", invoice_id, invoice_number, invoice.get("customer_name", ""), "gesendet")
        return {"message": f"{level_label} erfolgreich an {req.to_email} gesendet"}
    except Exception as e:
        logger.error(f"Mahnungs-E-Mail fehlgeschlagen: {e}")
        await log_email(req.to_email, f"{level_label}: {invoice_number}", "invoice", invoice_id, invoice_number, invoice.get("customer_name", ""), "fehlgeschlagen")
        raise HTTPException(status_code=500, detail=f"E-Mail-Versand fehlgeschlagen: {str(e)}")


@router.post("/email/followup/{quote_id}")
async def send_followup_email(quote_id: str, req: EmailRequest, user=Depends(get_current_user)):
    """Follow-up E-Mail für ein Angebot senden"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")

    company_name = settings.get("company_name", "Tischlerei Graupner")
    quote_number = quote.get("quote_number", "")

    pdf_buffer = generate_document_pdf("quote", quote, settings)
    pdf_data = pdf_buffer.read()

    custom_msg = f"<p>{req.message}</p>" if req.message else ""

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #14532D;">Ihr Angebot {quote_number}</h2>
        <p>Sehr geehrte Damen und Herren,</p>
        {custom_msg if custom_msg else "<p>vor einiger Zeit haben wir Ihnen unser Angebot Nr. " + quote_number + " zugesandt. Gerne möchten wir nachfragen, ob Sie noch Interesse haben oder ob wir Ihnen weiterhelfen können.</p>"}
        <p>Zur Erinnerung finden Sie das Angebot nochmals anbei.</p>
        <p>Wir freuen uns auf Ihre Rückmeldung!</p>
        <br>
        <p>Mit freundlichen Grüßen<br><strong>{company_name}</strong></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 20px;">
        <p style="font-size: 12px; color: #64748B;">
            {company_name}<br>
            {settings.get('address', '').replace(chr(10), '<br>') if settings.get('address') else ''}
            {('<br>Tel: ' + settings['phone']) if settings.get('phone') else ''}
        </p>
    </div>
    """

    try:
        send_email(
            to_email=req.to_email,
            subject=req.subject or f"Nachfrage zu Angebot {quote_number} - {company_name}",
            body_html=body_html,
            attachments=[{"filename": f"Angebot_{quote_number}.pdf", "data": pdf_data}]
        )
        await log_email(req.to_email, req.subject or f"Follow-up: Angebot {quote_number}", "quote", quote_id, quote_number, quote.get("customer_name", ""), "gesendet")
        return {"message": f"Follow-up E-Mail erfolgreich an {req.to_email} gesendet"}
    except Exception as e:
        logger.error(f"Follow-up E-Mail fehlgeschlagen: {e}")
        await log_email(req.to_email, f"Follow-up: Angebot {quote_number}", "quote", quote_id, quote_number, quote.get("customer_name", ""), "fehlgeschlagen")
        raise HTTPException(status_code=500, detail=f"E-Mail-Versand fehlgeschlagen: {str(e)}")
