from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from database import db, logger
from auth import get_current_user
from datetime import datetime, timezone
import uuid

router = APIRouter()


# ===================== KONFIGURATION (Auswahlfelder verwalten) =====================

@router.get("/einsatz-config")
async def get_config(user=Depends(get_current_user)):
    config = await db.einsatz_config.find_one({"id": "main"}, {"_id": 0})
    if not config:
        config = {
            "id": "main",
            "monteure": [],
            "reparaturgruppen": [],
            "materialien": [],
            "termin_vorlagen": [],
        }
        await db.einsatz_config.insert_one(config)
        config.pop("_id", None)
    return config


@router.put("/einsatz-config")
async def update_config(body: dict, user=Depends(get_current_user)):
    updates = {}
    for field in ["monteure", "reparaturgruppen", "materialien", "anfrage_schritte", "termin_vorlagen"]:
        if field in body:
            updates[field] = body[field]
    if not updates:
        raise HTTPException(400, "Keine Änderungen")
    await db.einsatz_config.update_one(
        {"id": "main"},
        {"$set": updates},
        upsert=True
    )
    return {"message": "Konfiguration gespeichert"}


# ===================== EINSÄTZE CRUD =====================

@router.get("/einsaetze")
async def list_einsaetze(user=Depends(get_current_user)):
    items = await db.einsaetze.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@router.post("/einsaetze")
async def create_einsatz(body: dict, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    einsatz = {
        "id": str(uuid.uuid4()),
        "customer_id": body.get("customer_id", ""),
        "customer_name": body.get("customer_name", ""),
        "anfrage_id": body.get("anfrage_id", ""),
        "monteur_1": body.get("monteur_1", ""),
        "monteur_2": body.get("monteur_2", ""),
        "reparaturgruppen": body.get("reparaturgruppen", []),
        "material": body.get("material", []),
        "summe_schaetzung": body.get("summe_schaetzung", 0),
        "status": body.get("status", "aktiv"),
        "beschreibung": body.get("beschreibung", ""),
        "termin": body.get("termin", ""),
        "termin_text": body.get("termin_text", ""),
        "created_at": now,
        "updated_at": now,
    }
    await db.einsaetze.insert_one(einsatz)
    einsatz.pop("_id", None)
    return einsatz


@router.get("/einsaetze/{einsatz_id}")
async def get_einsatz(einsatz_id: str, user=Depends(get_current_user)):
    item = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Einsatz nicht gefunden")
    return item


@router.put("/einsaetze/{einsatz_id}")
async def update_einsatz(einsatz_id: str, body: dict, user=Depends(get_current_user)):
    existing = await db.einsaetze.find_one({"id": einsatz_id})
    if not existing:
        raise HTTPException(404, "Einsatz nicht gefunden")

    allowed = [
        "customer_id", "customer_name", "anfrage_id",
        "monteur_1", "monteur_2", "reparaturgruppen", "material",
        "summe_schaetzung", "status", "beschreibung",
        "termin", "termin_text"
    ]
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.einsaetze.update_one({"id": einsatz_id}, {"$set": updates})
    updated = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    return updated


@router.delete("/einsaetze/{einsatz_id}")
async def delete_einsatz(einsatz_id: str, user=Depends(get_current_user)):
    result = await db.einsaetze.delete_one({"id": einsatz_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Einsatz nicht gefunden")
    return {"message": "Einsatz gelöscht"}



# ===================== TERMIN E-MAIL VERSAND =====================

@router.post("/einsaetze/{einsatz_id}/email")
async def send_einsatz_email(einsatz_id: str, body: dict, user=Depends(get_current_user)):
    """Termin-E-Mail an Kunden senden"""
    from utils import send_email, get_smtp_config
    from routes.email import log_email

    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")

    to_email = body.get("to_email", "")
    subject = body.get("subject", "")
    message = body.get("message", "")

    if not to_email or not message:
        raise HTTPException(400, "E-Mail-Adresse und Nachricht erforderlich")

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    company = settings.get("company_name", "Tischlerei Graupner")

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <p>{message.replace(chr(10), '<br>')}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 20px;">
        <p style="font-size: 12px; color: #64748B;">
            {company}<br>
            {settings.get('address', '').replace(chr(10), '<br>') if settings.get('address') else ''}
            {('<br>Tel: ' + settings['phone']) if settings.get('phone') else ''}
        </p>
    </div>
    """

    # Build .ics attachment if termin exists
    attachments = []
    if einsatz.get("termin"):
        ics_data = _generate_ics(einsatz, settings)
        attachments.append({"filename": "termin.ics", "data": ics_data.encode("utf-8")})

    try:
        smtp_cfg = await get_smtp_config()
        send_email(
            to_email=to_email,
            subject=subject or f"Terminbestätigung - {company}",
            body_html=body_html,
            attachments=attachments if attachments else None,
            smtp_config=smtp_cfg
        )
        await log_email(to_email, subject, "einsatz", einsatz_id, "", einsatz.get("customer_name", ""), "gesendet")
        return {"message": f"E-Mail an {to_email} gesendet"}
    except Exception as e:
        logger.error(f"Einsatz-Email failed: {e}")
        raise HTTPException(500, f"E-Mail-Versand fehlgeschlagen: {str(e)}")


@router.get("/einsaetze/{einsatz_id}/ics")
async def get_einsatz_ics(einsatz_id: str, user=Depends(get_current_user)):
    """ICS-Kalenderdatei für Einsatz herunterladen"""
    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    ics = _generate_ics(einsatz, settings)
    return Response(
        content=ics,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="termin_{einsatz_id[:8]}.ics"'}
    )


def _generate_ics(einsatz: dict, settings: dict) -> str:
    """Generate ICS calendar file content"""
    termin = einsatz.get("termin", "")
    if not termin:
        return ""
    # Parse termin (ISO format or datetime-local)
    try:
        dt = datetime.fromisoformat(termin.replace("Z", "+00:00"))
    except ValueError:
        dt = datetime.now(timezone.utc)

    dtstart = dt.strftime("%Y%m%dT%H%M%S")
    # 2 hour default duration
    from datetime import timedelta
    dtend = (dt + timedelta(hours=2)).strftime("%Y%m%dT%H%M%S")
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    summary = f"Einsatz: {einsatz.get('customer_name', 'Kunde')}"
    gruppen = einsatz.get("reparaturgruppen", []) or []
    if not gruppen and einsatz.get("reparaturgruppe"):
        gruppen = [einsatz["reparaturgruppe"]]
    if gruppen:
        summary += f" - {', '.join(gruppen)}"

    description = einsatz.get("beschreibung", "")
    if einsatz.get("termin_text"):
        description = einsatz["termin_text"]
    description = description.replace("\n", "\\n")

    company = settings.get("company_name", "Tischlerei Graupner")

    return f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Graupner Suite//Einsatzplanung//DE
BEGIN:VEVENT
UID:{einsatz.get('id', '')}@graupner-suite
DTSTAMP:{now}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:{summary}
DESCRIPTION:{description}
ORGANIZER:MAILTO:{settings.get('email', '')}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""
