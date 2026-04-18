from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
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
            "reparaturgruppen": [
                "Hebeschiebekipptuer (HSK)", "Schiebetuer", "Fenster",
                "Eingangstuer", "Innentuer", "Rolllaeden",
                "Sonstige Reparaturen", "Neubau/Einbau"
            ],
            "materialien": ["Holz", "Kunststoff", "Aluminium", "Holz/Alu", "Sonstiges"],
            "prioritaeten": ["niedrig", "normal", "hoch", "dringend"],
            "bild_kategorien": [
                "kundenanfrage", "besichtigung", "waehrend_arbeit",
                "abnahme", "hinweise", "sonstiges"
            ],
            "termin_vorlagen": [],
        }
        await db.einsatz_config.insert_one(config)
        config.pop("_id", None)
    return config


@router.put("/einsatz-config")
async def update_config(body: dict, user=Depends(get_current_user)):
    allowed = ["reparaturgruppen", "materialien", "anfrage_schritte", "termin_vorlagen", "prioritaeten", "bild_kategorien"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "Keine Aenderungen")
    await db.einsatz_config.update_one({"id": "main"}, {"$set": updates}, upsert=True)
    return {"message": "Konfiguration gespeichert"}


# ===================== EINSAETZE CRUD =====================

@router.get("/einsaetze")
async def list_einsaetze(status: str = "", user=Depends(get_current_user)):
    query = {}
    if status == "aktiv":
        query["status"] = {"$in": ["aktiv", "in_bearbeitung"]}
    elif status == "inaktiv":
        query["status"] = {"$in": ["inaktiv", "abgeschlossen"]}
    items = await db.einsaetze.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.post("/einsaetze")
async def create_einsatz(body: dict, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    einsatz = {
        "id": str(uuid.uuid4()),
        "kunde_id": body.get("kunde_id", body.get("customer_id", "")),
        "kunde_name": body.get("kunde_name", body.get("customer_name", "")),
        "kunde_email": body.get("kunde_email", ""),
        "kunde_telefon": body.get("kunde_telefon", ""),
        "kunde_adresse": body.get("kunde_adresse", ""),
        "kontakt_id": body.get("kontakt_id", body.get("anfrage_id", "")),
        "objekt_strasse": body.get("objekt_strasse", ""),
        "objekt_plz": body.get("objekt_plz", ""),
        "objekt_ort": body.get("objekt_ort", ""),
        "betreff": body.get("betreff", ""),
        "beschreibung": body.get("beschreibung", ""),
        "bemerkungen": body.get("bemerkungen", ""),
        "nachricht_kunde": body.get("nachricht_kunde", ""),
        "reparaturgruppe": body.get("reparaturgruppe", ""),
        "material": body.get("material", ""),
        "kategorien": body.get("kategorien", body.get("reparaturgruppen", [])),
        "monteur_id": body.get("monteur_id", body.get("monteur_1", "")),
        "monteur_name": body.get("monteur_name", ""),
        "monteur2_id": body.get("monteur2_id", body.get("monteur_2", "")),
        "monteur2_name": body.get("monteur2_name", ""),
        "verantwortlich": body.get("verantwortlich", ""),
        "summe_netto": body.get("summe_netto", body.get("summe_schaetzung", 0)),
        "mwst_satz": body.get("mwst_satz", 19),
        "summe_brutto": body.get("summe_brutto", 0),
        "status": body.get("status", "aktiv"),
        "prioritaet": body.get("prioritaet", "normal"),
        "startdatum": body.get("startdatum", ""),
        "enddatum": body.get("enddatum", ""),
        "termin": body.get("termin", ""),
        "termin_datum": body.get("termin_datum", ""),
        "termin_uhrzeit": body.get("termin_uhrzeit", ""),
        "termin_text": body.get("termin_text", ""),
        "bilder": body.get("bilder", []),
        "dateien": body.get("dateien", []),
        "erstellt_von": user.get("username", ""),
        "created_at": now,
        "updated_at": now,
    }
    await db.einsaetze.insert_one(einsatz)
    einsatz.pop("_id", None)
    logger.info(f"Neuer Einsatz: {einsatz['betreff']} ({einsatz['kunde_name']})")
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
    body.pop("id", None)
    body.pop("_id", None)
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.einsaetze.update_one({"id": einsatz_id}, {"$set": body})
    updated = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    return updated


@router.delete("/einsaetze/{einsatz_id}")
async def delete_einsatz(einsatz_id: str, user=Depends(get_current_user)):
    result = await db.einsaetze.delete_one({"id": einsatz_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Einsatz nicht gefunden")
    return {"message": "Einsatz geloescht"}


# ===================== BILDER (kategorisiert) =====================

@router.post("/einsaetze/{einsatz_id}/bilder")
async def upload_bild(einsatz_id: str, kategorie: str = "sonstiges", file: UploadFile = File(...), user=Depends(get_current_user)):
    einsatz = await db.einsaetze.find_one({"id": einsatz_id})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "Datei zu gross (max 15 MB)")
    try:
        from utils.storage import put_object
        safe_name = (file.filename or "bild.jpg").replace(" ", "_")
        path = f"einsaetze/{einsatz_id}/{uuid.uuid4().hex[:8]}_{safe_name}"
        result = put_object(path, content, file.content_type or "image/jpeg")
        url = result.get("url") or result.get("path", "")
    except Exception as e:
        logger.error(f"Bild-Upload fehlgeschlagen: {e}")
        raise HTTPException(500, "Upload fehlgeschlagen")
    bild = {
        "id": str(uuid.uuid4()),
        "url": url, "filename": file.filename,
        "kategorie": kategorie,
        "content_type": file.content_type,
        "uploaded_by": user.get("username", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.einsaetze.update_one({"id": einsatz_id}, {
        "$push": {"bilder": bild},
        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
    })
    return bild


@router.delete("/einsaetze/{einsatz_id}/bilder/{bild_id}")
async def delete_bild(einsatz_id: str, bild_id: str, user=Depends(get_current_user)):
    result = await db.einsaetze.update_one(
        {"id": einsatz_id},
        {"$pull": {"bilder": {"id": bild_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Bild nicht gefunden")
    return {"message": "Bild geloescht"}


# ===================== AUS KONTAKT/KUNDE ERSTELLEN =====================

@router.post("/einsaetze/from-kontakt/{kontakt_id}")
async def create_from_kontakt(kontakt_id: str, user=Depends(get_current_user)):
    kontakt = await db.module_kunden.find_one({"id": kontakt_id}, {"_id": 0})
    if not kontakt:
        raise HTTPException(404, "Kontakt nicht gefunden")
    name = f"{kontakt.get('vorname', '')} {kontakt.get('nachname', '')}".strip() or kontakt.get("name", "")
    adresse = kontakt.get("address", "")
    if not adresse:
        parts = [kontakt.get("strasse", ""), kontakt.get("plz", ""), kontakt.get("ort", "")]
        adresse = ", ".join(p for p in parts if p)
    now = datetime.now(timezone.utc).isoformat()
    bilder = []
    for photo_url in kontakt.get("photos", []):
        bilder.append({"id": str(uuid.uuid4()), "url": photo_url, "filename": "Kundenbild", "kategorie": "kundenanfrage", "created_at": now})
    einsatz = {
        "id": str(uuid.uuid4()), "kontakt_id": kontakt_id,
        "kunde_name": name, "kunde_email": kontakt.get("email", ""),
        "kunde_telefon": kontakt.get("phone", ""), "kunde_adresse": adresse,
        "objekt_strasse": kontakt.get("strasse", ""), "objekt_plz": kontakt.get("plz", ""), "objekt_ort": kontakt.get("ort", ""),
        "betreff": f"Anfrage von {name}",
        "beschreibung": kontakt.get("notes", "") or kontakt.get("nachricht", ""),
        "nachricht_kunde": kontakt.get("nachricht", ""),
        "kategorien": kontakt.get("categories", []),
        "reparaturgruppe": "", "material": "",
        "monteur_id": "", "monteur_name": "", "monteur2_id": "", "monteur2_name": "",
        "verantwortlich": "", "bemerkungen": "",
        "summe_netto": 0, "mwst_satz": 19, "summe_brutto": 0,
        "status": "aktiv", "prioritaet": "normal",
        "startdatum": "", "enddatum": "", "termin": "", "termin_datum": "", "termin_uhrzeit": "", "termin_text": "",
        "bilder": bilder, "dateien": [],
        "erstellt_von": user.get("username", ""), "created_at": now, "updated_at": now,
    }
    await db.einsaetze.insert_one(einsatz)
    einsatz.pop("_id", None)
    logger.info(f"Einsatz aus Kontakt: {name}")
    return einsatz


@router.post("/einsaetze/from-kunde/{kunde_id}")
async def create_from_kunde(kunde_id: str, data: dict = {}, user=Depends(get_current_user)):
    kunde = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0})
    if not kunde:
        raise HTTPException(404, "Kunde nicht gefunden")
    name = f"{kunde.get('vorname', '')} {kunde.get('nachname', '')}".strip() or kunde.get("name", "")
    adresse = kunde.get("address", "")
    if not adresse:
        parts = [kunde.get("strasse", ""), kunde.get("hausnummer", ""), kunde.get("plz", ""), kunde.get("ort", "")]
        adresse = ", ".join(p for p in parts if p)
    now = datetime.now(timezone.utc).isoformat()
    einsatz = {
        "id": str(uuid.uuid4()), "kunde_id": kunde_id, "kunde_name": name,
        "kunde_email": kunde.get("email", ""), "kunde_telefon": kunde.get("phone", ""), "kunde_adresse": adresse,
        "objekt_strasse": kunde.get("strasse", ""), "objekt_plz": kunde.get("plz", ""), "objekt_ort": kunde.get("ort", ""),
        "betreff": data.get("betreff", f"Einsatz fuer {name}"),
        "beschreibung": data.get("beschreibung", ""), "reparaturgruppe": data.get("reparaturgruppe", ""),
        "material": data.get("material", ""),
        "monteur_id": "", "monteur_name": "", "monteur2_id": "", "monteur2_name": "",
        "verantwortlich": "", "nachricht_kunde": "", "kategorien": [], "bemerkungen": "",
        "summe_netto": 0, "mwst_satz": 19, "summe_brutto": 0,
        "status": "aktiv", "prioritaet": "normal",
        "startdatum": "", "enddatum": "", "termin": "", "termin_datum": "", "termin_uhrzeit": "", "termin_text": "",
        "bilder": [], "dateien": [],
        "erstellt_von": user.get("username", ""), "created_at": now, "updated_at": now,
    }
    await db.einsaetze.insert_one(einsatz)
    einsatz.pop("_id", None)
    logger.info(f"Einsatz aus Kunde: {name}")
    return einsatz



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



# ===================== REPARATURAUFTRAG PDF =====================

@router.get("/einsaetze/{einsatz_id}/reparaturauftrag-pdf")
async def reparaturauftrag_pdf(einsatz_id: str, blanko: bool = False, token: str = ""):
    """PDF Reparaturauftrag - ausgefuellt oder blanko"""
    if not token:
        raise HTTPException(401, "Token erforderlich")
    import jwt
    from database import JWT_SECRET
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(401, "Ungueltiger Token")
    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    pdf_bytes = _generate_reparaturauftrag_pdf(einsatz if not blanko else {}, settings)
    filename = "Reparaturauftrag_Blanko.pdf" if blanko else f"Reparaturauftrag_{einsatz.get('kunde_name', 'Kunde').replace(' ', '_')}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/reparaturauftrag-blanko-pdf")
async def reparaturauftrag_blanko(user=Depends(get_current_user)):
    """Blanko Reparaturauftrag PDF"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    pdf_bytes = _generate_reparaturauftrag_pdf({}, settings)
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="Reparaturauftrag_Blanko.pdf"'})


def _generate_reparaturauftrag_pdf(einsatz: dict, settings: dict) -> bytes:
    """Generiert Reparaturauftrag als PDF"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas
    import io

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    # Margins
    lm, rm, tm = 20*mm, 20*mm, 15*mm
    usable_w = w - lm - rm

    # ---- HEADER ----
    company = settings.get("company_name", "Tischlerei Graupner")
    owner = settings.get("owner", "")
    address = settings.get("address", "")
    phone = settings.get("phone", "")
    email = settings.get("email", "")

    y = h - tm
    c.setFont("Helvetica-Bold", 16)
    c.drawString(lm, y, "Reparaturauftrag")
    c.setFont("Helvetica", 8)
    c.drawRightString(w - rm, y, company)
    y -= 4*mm
    if address:
        c.drawRightString(w - rm, y, address.replace("\n", ", "))
        y -= 3.5*mm
    if phone or email:
        c.drawRightString(w - rm, y, f"Tel: {phone}  |  {email}")
    y -= 4*mm

    # Horizontal line
    y -= 3*mm
    c.setStrokeColor(colors.Color(0.08, 0.33, 0.11))
    c.setLineWidth(1.5)
    c.line(lm, y, w - rm, y)
    y -= 6*mm

    # ---- AUFTRAGSDATEN ----
    def label_value(label, value, x, yy, label_w=40*mm, val_w=50*mm):
        c.setFont("Helvetica", 7)
        c.setFillColor(colors.Color(0.4, 0.4, 0.4))
        c.drawString(x, yy, label)
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.black)
        val = str(value) if value else ""
        c.drawString(x + label_w, yy, val)
        # Underline for value field
        c.setStrokeColor(colors.Color(0.85, 0.85, 0.85))
        c.setLineWidth(0.3)
        c.line(x + label_w, yy - 1*mm, x + label_w + val_w, yy - 1*mm)
        return yy - 6*mm

    def section_title(title, yy):
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.Color(0.08, 0.33, 0.11))
        c.drawString(lm, yy, title)
        c.setStrokeColor(colors.Color(0.08, 0.33, 0.11))
        c.setLineWidth(0.5)
        c.line(lm, yy - 2*mm, w - rm, yy - 2*mm)
        c.setFillColor(colors.black)
        return yy - 8*mm

    # Auftragsnr & Datum
    nr = einsatz.get("id", "")[:8].upper() if einsatz.get("id") else ""
    datum = ""
    if einsatz.get("created_at"):
        try:
            datum = datetime.fromisoformat(einsatz["created_at"].replace("Z", "+00:00")).strftime("%d.%m.%Y")
        except: pass
    col2_x = lm + usable_w / 2

    y = label_value("Auftragsnr.:", nr, lm, y)
    y += 6*mm
    label_value("Datum:", datum, col2_x, y)
    y -= 6*mm
    y = label_value("Status:", einsatz.get("status", ""), lm, y)
    y += 6*mm
    label_value("Prioritaet:", einsatz.get("prioritaet", ""), col2_x, y)
    y -= 2*mm

    # ---- AUFTRAGGEBER / KUNDE ----
    y = section_title("Auftraggeber / Kunde", y)
    y = label_value("Name:", einsatz.get("kunde_name", ""), lm, y, 30*mm, 60*mm)
    y = label_value("Adresse:", einsatz.get("kunde_adresse", ""), lm, y, 30*mm, 60*mm)
    row_y = y
    y = label_value("Telefon:", einsatz.get("kunde_telefon", ""), lm, y, 30*mm, 50*mm)
    label_value("E-Mail:", einsatz.get("kunde_email", ""), col2_x, row_y, 25*mm, 50*mm)
    y -= 2*mm

    # ---- REPARATURORT ----
    y = section_title("Reparaturort / Objekt", y)
    obj_addr = ", ".join(filter(None, [einsatz.get("objekt_strasse", ""), einsatz.get("objekt_plz", ""), einsatz.get("objekt_ort", "")]))
    y = label_value("Adresse:", obj_addr, lm, y, 30*mm, 60*mm)
    row_y = y
    y = label_value("Reparaturgruppe:", einsatz.get("reparaturgruppe", ""), lm, y, 40*mm, 50*mm)
    label_value("Material:", einsatz.get("material", ""), col2_x, row_y, 25*mm, 50*mm)
    y -= 2*mm

    # ---- SCHADENSBESCHREIBUNG ----
    y = section_title("Schadensbeschreibung / Auftrag", y)
    c.setFont("Helvetica", 9)
    beschreibung = einsatz.get("beschreibung", "")
    if beschreibung:
        lines = beschreibung.split("\n")
        for line in lines[:8]:
            if y < 60*mm:
                break
            c.drawString(lm + 2*mm, y, line[:90])
            y -= 4.5*mm
    else:
        for _ in range(5):
            c.setStrokeColor(colors.Color(0.85, 0.85, 0.85))
            c.line(lm, y, w - rm, y)
            y -= 6*mm
    y -= 2*mm

    # ---- BEMERKUNGEN ----
    if einsatz.get("bemerkungen") or not einsatz.get("id"):
        y = section_title("Bemerkungen / Anmerkungen", y)
        c.setFont("Helvetica", 9)
        if einsatz.get("bemerkungen"):
            for line in einsatz["bemerkungen"].split("\n")[:4]:
                if y < 55*mm:
                    break
                c.drawString(lm + 2*mm, y, line[:90])
                y -= 4.5*mm
        else:
            for _ in range(3):
                c.setStrokeColor(colors.Color(0.85, 0.85, 0.85))
                c.line(lm, y, w - rm, y)
                y -= 6*mm
        y -= 2*mm

    # ---- MONTEURE ----
    y = section_title("Monteure / Zuweisung", y)
    row_y = y
    y = label_value("1. Monteur:", einsatz.get("monteur_name", ""), lm, y, 30*mm, 50*mm)
    label_value("2. Monteur:", einsatz.get("monteur2_name", ""), col2_x, row_y, 30*mm, 50*mm)
    y = label_value("Verantwortlich:", einsatz.get("verantwortlich", ""), lm, y, 40*mm, 50*mm)
    y -= 2*mm

    # ---- KOSTENUEBERSICHT ----
    y = section_title("Kostenuebersicht", y)
    netto = einsatz.get("summe_netto", 0) or 0
    mwst_satz = einsatz.get("mwst_satz", 19) or 19
    mwst_betrag = round(netto * mwst_satz / 100, 2)
    brutto = round(netto + mwst_betrag, 2)

    fmt = lambda v: f"{v:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".") if v else ""
    y = label_value("Summe Netto:", fmt(netto), lm, y, 35*mm, 40*mm)
    y = label_value(f"MwSt. ({mwst_satz}%):", fmt(mwst_betrag), lm, y, 35*mm, 40*mm)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(lm, y, "Gesamtbetrag:")
    c.drawString(lm + 35*mm, y, fmt(brutto))
    y -= 10*mm

    # ---- TERMINE ----
    if einsatz.get("startdatum") or einsatz.get("termin") or not einsatz.get("id"):
        row_y = y
        y = label_value("Startdatum:", einsatz.get("startdatum", ""), lm, y, 30*mm, 35*mm)
        label_value("Enddatum:", einsatz.get("enddatum", ""), col2_x, row_y, 25*mm, 35*mm)
        y -= 4*mm

    # ---- UNTERSCHRIFTEN ----
    if y > 40*mm:
        sig_y = max(y - 10*mm, 30*mm)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.5)
        sig_w = 65*mm
        c.line(lm, sig_y, lm + sig_w, sig_y)
        c.line(w - rm - sig_w, sig_y, w - rm, sig_y)
        c.setFont("Helvetica", 7)
        c.setFillColor(colors.Color(0.4, 0.4, 0.4))
        c.drawString(lm, sig_y - 4*mm, "Unterschrift Auftraggeber / Datum")
        c.drawString(w - rm - sig_w, sig_y - 4*mm, "Unterschrift Auftragnehmer / Datum")

    # ---- FOOTER ----
    c.setFont("Helvetica", 6)
    c.setFillColor(colors.Color(0.5, 0.5, 0.5))
    footer_text = f"{company}"
    if owner:
        footer_text += f" | Inh. {owner}"
    if phone:
        footer_text += f" | Tel: {phone}"
    if email:
        footer_text += f" | {email}"
    c.drawCentredString(w / 2, 12*mm, footer_text)

    bank = settings.get("bank_name", "")
    iban = settings.get("iban", "")
    if bank or iban:
        bank_text = f"{bank}" + (f" | IBAN: {iban}" if iban else "")
        c.drawCentredString(w / 2, 8*mm, bank_text)

    c.save()
    return buf.getvalue()
