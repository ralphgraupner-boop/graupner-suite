from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.responses import Response
from database import db, logger
from auth import get_current_user
from utils.storage import put_object, get_object
from utils import send_email
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import secrets
import io

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB
MAX_IMAGES_PER_PORTAL = 30
RATE_LIMIT_MAX_UPLOADS = 10
RATE_LIMIT_WINDOW_SEC = 60
IMAGE_MAX_DIMENSION = 1920
IMAGE_JPEG_QUALITY = 80


def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def compress_image(data: bytes, content_type: str) -> tuple:
    """Resize to max 1920x1920 and recompress as JPEG 80%. Returns (new_bytes, new_content_type, ext)."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        # EXIF rotation
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        # Convert RGBA/P -> RGB for JPEG
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        # Scale down if needed
        img.thumbnail((IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=IMAGE_JPEG_QUALITY, optimize=True)
        return buf.getvalue(), "image/jpeg", "jpg"
    except Exception as e:
        logger.warning(f"Image compression failed, using original: {e}")
        ext = "jpg"
        if content_type == "image/png":
            ext = "png"
        elif content_type == "image/webp":
            ext = "webp"
        return data, content_type, ext


async def _notify_admin(subject: str, body_html: str):
    """Send admin-notification email if configured."""
    try:
        settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
        admin_email = settings.get("email", "")
        if admin_email:
            send_email(to_email=admin_email, subject=subject, body_html=body_html)
    except Exception as e:
        logger.warning(f"Admin notify failed: {e}")


async def _check_rate_limit_or_lock(portal: dict) -> bool:
    """Return True if portal just got auto-locked due to rate limit."""
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(seconds=RATE_LIMIT_WINDOW_SEC)).isoformat()
    recent = await db.portal_files.count_documents({
        "portal_id": portal["id"],
        "is_deleted": False,
        "uploaded_by": "customer",
        "created_at": {"$gte": window_start}
    })
    if recent >= RATE_LIMIT_MAX_UPLOADS:
        # Auto-lock portal
        await db.portals.update_one(
            {"id": portal["id"]},
            {"$set": {"active": False, "locked_reason": "rate_limit", "locked_at": now.isoformat()}}
        )
        logger.warning(f"Portal {portal['id']} auto-locked due to rate limit")
        await _notify_admin(
            subject=f"⚠️ Kundenportal gesperrt (Rate-Limit): {portal.get('customer_name', 'Kunde')}",
            body_html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h3 style="color: #b91c1c;">Kundenportal automatisch gesperrt</h3>
              <p>Das Portal von <strong>{portal.get('customer_name', 'Kunde')}</strong> wurde automatisch inaktiv gesetzt, weil in den letzten {RATE_LIMIT_WINDOW_SEC}s mehr als {RATE_LIMIT_MAX_UPLOADS} Uploads erfolgten.</p>
              <p>Das kann ein Hinweis auf Missbrauch oder einen Hacker-Versuch sein.</p>
              <p>Bitte kontrollieren und im Admin-Bereich wieder aktivieren, falls legitim.</p>
            </div>
            """
        )
        return True
    return False


# ===================== ADMIN ENDPOINTS (auth required) =====================

@router.get("/portals")
async def list_portals(user=Depends(get_current_user)):
    portals = await db.portals.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return portals


@router.get("/portals/lookup")
async def lookup_portal(email: str = "", customer_id: str = "", anfrage_id: str = "", user=Depends(get_current_user)):
    """Find portal by email, customer_id or anfrage_id"""
    query = {"$or": []}
    if email:
        query["$or"].append({"customer_email": email})
    if customer_id:
        query["$or"].append({"customer_id": customer_id})
    if anfrage_id:
        query["$or"].append({"anfrage_id": anfrage_id})
    if not query["$or"]:
        return None
    portal = await db.portals.find_one(query, {"_id": 0, "password_hash": 0})
    return portal


@router.post("/portals/from-customer/{customer_id}")
async def create_portal_from_customer(customer_id: str, body: dict, user=Depends(get_current_user)):
    """Erstellt Portal direkt aus einem Kunden mit automatischem E-Mail-Versand"""
    customer = await db.module_kunden.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(404, "Kunde nicht gefunden")

    customer_email = customer.get("email", "")
    customer_name = customer.get("vorname", "") + " " + customer.get("nachname", "")
    customer_name = customer_name.strip() or customer.get("name", "Kunde")
    if not customer_email:
        raise HTTPException(400, "Kunde hat keine E-Mail-Adresse. Bitte erst ergänzen.")

    existing = await db.portals.find_one({"customer_id": customer_id})
    if existing:
        raise HTTPException(400, "Für diesen Kunden existiert bereits ein Kundenportal.")

    password = body.get("password", "") or secrets.token_urlsafe(8)
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)

    portal = {
        "id": str(uuid.uuid4()),
        "token": token,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "description": body.get("description", ""),
        "password_hash": hash_password(password),
        "password_plain": password,
        "active": True,
        "expires_at": (now + timedelta(weeks=8)).isoformat(),
        "created_at": now.isoformat(),
    }
    await db.portals.insert_one(portal)
    portal.pop("_id", None)

    portal_base_url = body.get("portal_base_url", "")
    portal_url = f"{portal_base_url.rstrip('/')}/portal/{token}" if portal_base_url else ""
    email_sent = False
    if portal_url and customer_email:
        try:
            settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
            company = settings.get("company_name", "Tischlerei Graupner")
            expires = datetime.fromisoformat(portal["expires_at"]).strftime("%d.%m.%Y")
            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a5632;">Ihr persönliches Kundenportal</h2>
              <p>Sehr geehrte/r {customer_name},</p>
              <p>wir haben für Sie ein persönliches Portal eingerichtet.</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Ihr Zugang:</strong></p>
                <p style="margin: 0 0 5px 0;">Link: <a href="{portal_url}" style="color: #1a5632;">{portal_url}</a></p>
                <p style="margin: 0;">Passwort: <strong>{password}</strong></p>
              </div>
              <p style="color: #666; font-size: 12px;">Gültig bis {expires}.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 12px; color: #64748B;">{company}</p>
            </div>
            """
            send_email(to_email=customer_email, subject=f"Ihr Kundenportal - {company}", body_html=html)
            email_sent = True
        except Exception as e:
            logger.error(f"Auto-send portal email failed: {e}")

    return {**portal, "email_sent": email_sent}


@router.post("/portals")
async def create_portal(body: dict, user=Depends(get_current_user)):
    customer_id = body.get("customer_id", "")
    customer_name = body.get("customer_name", "Kunde")
    customer_email = body.get("customer_email", "")
    description = body.get("description", "")
    weeks = body.get("weeks", 8)
    password = body.get("password", "")
    if not password:
        password = secrets.token_urlsafe(8)

    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)

    portal = {
        "id": str(uuid.uuid4()),
        "token": token,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "description": description,
        "password_hash": hash_password(password),
        "password_plain": password,
        "active": True,
        "expires_at": (now + timedelta(weeks=weeks)).isoformat(),
        "created_at": now.isoformat(),
    }
    await db.portals.insert_one(portal)
    portal.pop("_id", None)
    return portal


@router.post("/portals/from-anfrage/{anfrage_id}")
async def create_portal_from_anfrage(anfrage_id: str, body: dict, user=Depends(get_current_user)):
    """Erstellt Portal direkt aus einer Anfrage mit automatischem E-Mail-Versand"""
    anfrage = await db.module_kunden.find_one({"id": anfrage_id}, {"_id": 0})
    if not anfrage:
        raise HTTPException(404, "Anfrage nicht gefunden")

    customer_email = anfrage.get("email", "")
    customer_name = (anfrage.get("vorname", "") + " " + anfrage.get("nachname", "")).strip() or anfrage.get("name", "Kunde")
    if not customer_email:
        raise HTTPException(400, "Anfrage hat keine E-Mail-Adresse. Bitte erst ergänzen.")

    # Check if portal already exists for this anfrage
    existing = await db.portals.find_one({"anfrage_id": anfrage_id})
    if existing:
        raise HTTPException(400, "Für diese Anfrage existiert bereits ein Kundenportal.")

    # Find or create customer
    customer_id = ""
    customer = await db.module_kunden.find_one({"email": customer_email}, {"_id": 0})
    if customer:
        customer_id = customer.get("id", "")
    else:
        # Create customer from anfrage data
        customer_id = str(uuid.uuid4())
        new_customer = {
            "id": customer_id,
            "name": customer_name,
            "vorname": anfrage.get("vorname", ""),
            "nachname": anfrage.get("nachname", ""),
            "email": customer_email,
            "phone": anfrage.get("phone", ""),
            "address": anfrage.get("address", ""),
            "firma": anfrage.get("firma", ""),
            "customer_type": anfrage.get("customer_type", "Privat"),
            "anrede": anfrage.get("anrede", ""),
            "notes": anfrage.get("notes", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.module_kunden.insert_one(new_customer)
        new_customer.pop("_id", None)
        logger.info(f"Customer auto-created from Kontakt: {customer_name}")

    # Generate password
    password = body.get("password", "") or secrets.token_urlsafe(8)
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)

    beschreibung_parts = []
    if anfrage.get("nachricht"):
        beschreibung_parts.append(anfrage["nachricht"][:200])
    gruppen = anfrage.get("reparaturgruppen", [])
    if gruppen:
        beschreibung_parts.append(f"Reparaturgruppen: {', '.join(gruppen)}")
    cats = anfrage.get("categories", [])
    if cats:
        beschreibung_parts.append(f"Kategorien: {', '.join(cats)}")
    description = body.get("description", "") or " | ".join(beschreibung_parts)

    portal = {
        "id": str(uuid.uuid4()),
        "token": token,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "description": description,
        "anfrage_id": anfrage_id,
        "password_hash": hash_password(password),
        "password_plain": password,
        "active": True,
        "expires_at": (now + timedelta(weeks=8)).isoformat(),
        "created_at": now.isoformat(),
    }
    await db.portals.insert_one(portal)
    portal.pop("_id", None)

    # Auto-send invitation email
    portal_url = body.get("portal_base_url", "")
    if portal_url:
        portal_url = f"{portal_url.rstrip('/')}/portal/{token}"
    email_sent = False
    if portal_url and customer_email:
        try:
            settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
            company = settings.get("company_name", "Tischlerei Graupner")
            expires = datetime.fromisoformat(portal["expires_at"]).strftime("%d.%m.%Y")

            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a5632;">Ihr persönliches Kundenportal</h2>
              <p>Sehr geehrte/r {customer_name},</p>
              <p>wir haben Ihre Anfrage erhalten und für Sie ein persönliches Portal eingerichtet, über das Sie uns bequem Bilder und Informationen zukommen lassen können.</p>
              {f'<p><strong>Projekt:</strong> {description}</p>' if description else ''}
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Ihr Zugang:</strong></p>
                <p style="margin: 0 0 5px 0;">Link: <a href="{portal_url}" style="color: #1a5632;">{portal_url}</a></p>
                <p style="margin: 0;">Passwort: <strong>{password}</strong></p>
              </div>
              <p>Über dieses Portal können Sie:</p>
              <ul>
                <li>Fotos hochladen (z.B. von Schäden, Fenstern, Türen)</li>
                <li>Nachrichten an uns senden</li>
                <li>Unsere Dokumente und Angebote einsehen</li>
              </ul>
              <p style="color: #666; font-size: 12px;">Das Portal ist gültig bis {expires}.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 12px; color: #64748B;">
                {company}<br>
                {settings.get('phone', '')}
              </p>
            </div>
            """
            send_email(
                to_email=customer_email,
                subject=f"Ihr Kundenportal - {company}",
                body_html=html,
            )
            email_sent = True
            logger.info(f"Portal invitation auto-sent to {customer_email}")
        except Exception as e:
            logger.error(f"Auto-send portal email failed: {e}")

    return {
        **portal,
        "email_sent": email_sent,
        "customer_created": not bool(customer),
    }


@router.put("/portals/{portal_id}")
async def update_portal(portal_id: str, body: dict, user=Depends(get_current_user)):
    updates = {}
    if "active" in body:
        updates["active"] = body["active"]
    if "description" in body:
        updates["description"] = body["description"]
    if not updates:
        raise HTTPException(400, "Keine Änderungen")
    await db.portals.update_one({"id": portal_id}, {"$set": updates})
    return {"message": "Aktualisiert"}


@router.delete("/portals/{portal_id}")
async def delete_portal(portal_id: str, user=Depends(get_current_user)):
    await db.portals.delete_one({"id": portal_id})
    await db.portal_files.update_many({"portal_id": portal_id}, {"$set": {"is_deleted": True}})
    return {"message": "Gelöscht"}


@router.get("/portals/{portal_id}/files")
async def admin_list_files(portal_id: str, user=Depends(get_current_user)):
    files = await db.portal_files.find(
        {"portal_id": portal_id, "is_deleted": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return files


@router.post("/portals/{portal_id}/upload")
async def admin_upload_file(
    portal_id: str,
    file: UploadFile = File(...),
    description: str = Form(""),
    user=Depends(get_current_user)
):
    portal = await db.portals.find_one({"id": portal_id})
    if not portal:
        raise HTTPException(404, "Portal nicht gefunden")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, "Datei zu groß (max 15MB)")

    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    storage_path = f"graupner-suite/portals/{portal_id}/{uuid.uuid4()}.{ext}"
    result = put_object(storage_path, data, file.content_type or "application/octet-stream")

    file_doc = {
        "id": str(uuid.uuid4()),
        "portal_id": portal_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": result.get("size", len(data)),
        "description": description,
        "uploaded_by": "business",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.portal_files.insert_one(file_doc)
    file_doc.pop("_id", None)
    return file_doc


@router.delete("/portals/files/{file_id}")
async def admin_delete_file(file_id: str, user=Depends(get_current_user)):
    await db.portal_files.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    return {"message": "Datei gelöscht"}


@router.post("/portals/{portal_id}/send-email")
async def send_portal_email(portal_id: str, body: dict, user=Depends(get_current_user)):
    portal = await db.portals.find_one({"id": portal_id}, {"_id": 0})
    if not portal:
        raise HTTPException(404, "Portal nicht gefunden")

    customer_email = portal.get("customer_email", "")
    if not customer_email:
        raise HTTPException(400, "Keine E-Mail-Adresse vorhanden")

    portal_url = body.get("portal_url", "")
    if not portal_url:
        raise HTTPException(400, "Portal-URL fehlt")

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    company = settings.get("company_name", "Tischlerei Graupner")
    customer_name = portal.get("customer_name", "Kunde")
    description = portal.get("description", "")
    password = portal.get("password_plain", "")
    expires = datetime.fromisoformat(portal["expires_at"]).strftime("%d.%m.%Y")

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a5632;">Ihr persönliches Kundenportal</h2>
      <p>Sehr geehrte/r {customer_name},</p>
      <p>wir haben für Sie ein persönliches Portal eingerichtet, über das Sie uns bequem Bilder und Informationen zu Ihrem Projekt zukommen lassen können.</p>
      {f'<p><strong>Projekt:</strong> {description}</p>' if description else ''}
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Ihr Zugang:</strong></p>
        <p style="margin: 0 0 5px 0;">Link: <a href="{portal_url}" style="color: #1a5632;">{portal_url}</a></p>
        <p style="margin: 0;">Passwort: <strong>{password}</strong></p>
      </div>
      <p>Über dieses Portal können Sie:</p>
      <ul>
        <li>Fotos hochladen (z.B. von Schäden, Fenstern, Türen)</li>
        <li>Unsere Dokumente und Angebote einsehen</li>
      </ul>
      <p style="color: #666; font-size: 12px;">Das Portal ist gültig bis {expires}.</p>
      <p>Mit freundlichen Grüßen<br/>{company}</p>
    </div>
    """
    try:
        send_email(
            to_email=customer_email,
            subject=f"Ihr Kundenportal – {company}",
            body_html=html
        )
        return {"message": "E-Mail gesendet", "sent_to": customer_email}
    except Exception as e:
        logger.warning(f"Portal email failed: {e}")
        raise HTTPException(500, f"E-Mail konnte nicht gesendet werden: {str(e)}")


# ===================== PUBLIC ENDPOINTS (no auth) =====================

@router.post("/portal/verify/{token}")
async def verify_portal(token: str, body: dict):
    portal = await db.portals.find_one({"token": token}, {"_id": 0})
    if not portal:
        raise HTTPException(404, "Portal nicht gefunden")
    if not portal.get("active"):
        raise HTTPException(403, "Portal deaktiviert")
    expires = datetime.fromisoformat(portal["expires_at"])
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(403, "Portal abgelaufen")
    password = body.get("password", "")
    if hash_password(password) != portal.get("password_hash"):
        raise HTTPException(401, "Falsches Passwort")

    # Load customer data if linked
    customer_data = None
    if portal.get("customer_id"):
        cust = await db.module_kunden.find_one({"id": portal["customer_id"]}, {"_id": 0})
        if cust:
            cust_name = (cust.get("vorname", "") + " " + cust.get("nachname", "")).strip() or cust.get("name", "")
            customer_data = {
                "name": cust_name,
                "email": cust.get("email", ""),
                "phone": cust.get("phone", ""),
                "address": cust.get("address", ""),
                "notes": cust.get("notes", ""),
                "anrede": cust.get("anrede", ""),
                "firma": cust.get("firma", ""),
            }

    # Load linked Einsatz/Termin data
    einsatz_data = None
    if portal.get("customer_id"):
        einsatz = await db.einsaetze.find_one(
            {"customer_id": portal["customer_id"]},
            {"_id": 0}
        )
        if einsatz:
            einsatz_data = {
                "reparaturgruppen": einsatz.get("reparaturgruppen", []) or (
                    [einsatz["reparaturgruppe"]] if einsatz.get("reparaturgruppe") else []
                ),
                "beschreibung": einsatz.get("beschreibung", ""),
                "termin": einsatz.get("termin", ""),
                "termin_text": einsatz.get("termin_text", ""),
                "monteur_1": einsatz.get("monteur_1", ""),
                "status": einsatz.get("status", ""),
            }

    return {
        "valid": True,
        "portal_id": portal.get("id"),
        "customer_name": portal.get("customer_name", ""),
        "description": portal.get("description", ""),
        "expires_at": portal.get("expires_at"),
        "customer_data": customer_data,
        "customer_notes": portal.get("customer_notes", []),
        "admin_notes": portal.get("admin_notes", []),
        "einsatz_data": einsatz_data,
    }


@router.post("/portal/{token}/notes")
async def public_add_note(token: str, body: dict):
    portal = await _verify_portal_access(token, body.get("password", ""))
    note_type = body.get("type", "hinweis")  # hinweis, korrektur, termin, zusatz
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(400, "Text darf nicht leer sein")

    note = {
        "id": str(uuid.uuid4()),
        "type": note_type,
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.portals.update_one(
        {"id": portal["id"]},
        {
            "$push": {"customer_notes": note},
            "$set": {"customer_has_new_content": True, "last_customer_activity_at": datetime.now(timezone.utc).isoformat()},
        }
    )

    # Push-Benachrichtigung an Admin
    type_labels = {"korrektur": "Korrektur", "hinweis": "Hinweis", "termin": "Terminvorschlag", "zusatz": "Zusatzinfo"}
    try:
        from routes.push import send_push_to_all
        await send_push_to_all(
            title=f"Kundenportal: {type_labels.get(note_type, note_type)}",
            body=f"{portal.get('customer_name', 'Kunde')}: {text[:100]}{'...' if len(text) > 100 else ''}",
            url="/portals"
        )
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")

    # E-Mail-Benachrichtigung an Admin
    try:
        settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
        admin_email = settings.get("email", "")
        if admin_email:
            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h3 style="color: #1a5632;">Neue Kundenportal-Mitteilung</h3>
              <p><strong>Kunde:</strong> {portal.get('customer_name', 'Kunde')}</p>
              <p><strong>Projekt:</strong> {portal.get('description', '-')}</p>
              <p><strong>Typ:</strong> {type_labels.get(note_type, note_type)}</p>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 0;">{text}</p>
              </div>
            </div>
            """
            send_email(
                to_email=admin_email,
                subject=f"Portal-Mitteilung: {type_labels.get(note_type, note_type)} von {portal.get('customer_name', 'Kunde')}",
                body_html=html
            )
    except Exception as e:
        logger.warning(f"Admin email notification failed: {e}")

    return note


# ===================== ADMIN NACHRICHTEN (Textbausteine) =====================

@router.post("/portals/{portal_id}/admin-notes")
async def add_admin_note(portal_id: str, body: dict, user=Depends(get_current_user)):
    """Admin sendet Nachricht an Kunden über das Portal"""
    portal = await db.portals.find_one({"id": portal_id})
    if not portal:
        raise HTTPException(404, "Portal nicht gefunden")

    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(400, "Text darf nicht leer sein")

    note = {
        "id": str(uuid.uuid4()),
        "type": "admin",
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.portals.update_one(
        {"id": portal_id},
        {
            "$push": {"admin_notes": note},
            "$set": {"admin_has_new_content": True, "last_admin_send_at": datetime.now(timezone.utc).isoformat()},
        }
    )
    return note


@router.get("/portals/{portal_id}/admin-notes")
async def get_admin_notes(portal_id: str, user=Depends(get_current_user)):
    """Admin-Nachrichten abrufen"""
    portal = await db.portals.find_one({"id": portal_id}, {"_id": 0})
    if not portal:
        raise HTTPException(404, "Portal nicht gefunden")
    return portal.get("admin_notes", [])


@router.post("/portal/{token}/files")
async def public_list_files(token: str, body: dict):
    portal = await _verify_portal_access(token, body.get("password", ""))
    files = await db.portal_files.find(
        {"portal_id": portal["id"], "is_deleted": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return files


@router.post("/portal/{token}/upload")
async def public_upload_file(
    token: str,
    password: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...)
):
    portal = await _verify_portal_access(token, password)

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Nur Bilder erlaubt (JPG, PNG, WebP)")

    # Check total image count limit per portal
    total_count = await db.portal_files.count_documents({
        "portal_id": portal["id"],
        "is_deleted": False,
        "uploaded_by": "customer",
    })
    if total_count >= MAX_IMAGES_PER_PORTAL:
        raise HTTPException(400, f"Maximale Anzahl Bilder erreicht (max. {MAX_IMAGES_PER_PORTAL} pro Portal). Bitte kontaktieren Sie uns direkt.")

    # Rate-limit / auto-lock on suspected abuse
    locked = await _check_rate_limit_or_lock(portal)
    if locked:
        raise HTTPException(429, "Zu viele Uploads in kurzer Zeit. Portal wurde vorsorglich gesperrt.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, "Datei zu groß (max 15MB)")

    # Auto-compress and normalize image
    compressed, new_ct, ext = compress_image(data, file.content_type)
    storage_path = f"graupner-suite/portals/{portal['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(storage_path, compressed, new_ct)

    file_doc = {
        "id": str(uuid.uuid4()),
        "portal_id": portal["id"],
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": new_ct,
        "size": result.get("size", len(compressed)),
        "original_size": len(data),
        "description": description,
        "uploaded_by": "customer",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.portal_files.insert_one(file_doc)
    file_doc.pop("_id", None)
    # Mark new content for admin
    await db.portals.update_one(
        {"id": portal["id"]},
        {"$set": {"customer_has_new_content": True, "last_customer_activity_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Push-Benachrichtigung: Neues Bild
    try:
        from routes.push import send_push_to_all
        await send_push_to_all(
            title="Kundenportal: Neues Bild",
            body=f"{portal.get('customer_name', 'Kunde')} hat ein Bild hochgeladen ({file.filename})",
            url="/portals"
        )
    except Exception as e:
        logger.warning(f"Push for upload failed: {e}")

    # Remaining slots info
    file_doc["remaining_slots"] = MAX_IMAGES_PER_PORTAL - (total_count + 1)
    return file_doc


@router.get("/portal/file/{file_id}")
async def public_download_file(file_id: str, auth: str = ""):
    record = await db.portal_files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(404, "Datei nicht gefunden")
    data, ct = get_object(record["storage_path"])
    return Response(
        content=data,
        media_type=record.get("content_type", ct),
        headers={"Content-Disposition": f'inline; filename="{record.get("original_filename", "file")}"'}
    )


async def _verify_portal_access(token: str, password: str):
    portal = await db.portals.find_one({"token": token}, {"_id": 0})
    if not portal:
        raise HTTPException(404, "Portal nicht gefunden")
    if not portal.get("active"):
        raise HTTPException(403, "Portal deaktiviert")
    expires = datetime.fromisoformat(portal["expires_at"])
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(403, "Portal abgelaufen")
    if hash_password(password) != portal.get("password_hash"):
        raise HTTPException(401, "Falsches Passwort")
    return portal


# ===================== PORTAL SETTINGS (Begruessung/Hinweise/Logo) =====================

DEFAULT_PORTAL_SETTINGS = {
    "begruessung": "Wir Tischlerei Graupner begrüßen Sie herzlich in Ihrem Kundenportal.\nHier können Sie einfach und zuverlässig Kontakt mit uns aufnehmen.",
    "hinweise": ("Sie können bequem:\n"
                 "• Bilder hochladen (max. 5 pro Upload, 30 pro Portal insgesamt)\n"
                 "• Hinweise und Bemerkungen eintragen\n"
                 "• Ihr Angebot, Auftragsbestätigung und Ihre Rechnung einsehen und herunterladen"),
    "absende_text": "Ich habe alles eingetragen und sende es jetzt ab",
    "fertig_text": "Vielen Dank! Wir haben Ihre Nachricht erhalten und melden uns zeitnah bei Ihnen.",
    "logo_url": "",
    "zeige_praesenz_bilder": True,
    "praesenz_bilder": [],
}


@router.get("/portal-settings")
async def get_portal_settings_public():
    """Portal-Texte (ohne Auth, fuer Kunden-Ansicht)"""
    doc = await db.portal_settings.find_one({"id": "portal_settings"}, {"_id": 0})
    if not doc:
        return DEFAULT_PORTAL_SETTINGS
    return {**DEFAULT_PORTAL_SETTINGS, **{k: v for k, v in doc.items() if k != "id"}}


@router.put("/portal-settings")
async def update_portal_settings(data: dict, user=Depends(get_current_user)):
    allowed = list(DEFAULT_PORTAL_SETTINGS.keys())
    update = {k: v for k, v in data.items() if k in allowed}
    await db.portal_settings.update_one(
        {"id": "portal_settings"},
        {"$set": update},
        upsert=True
    )
    doc = await db.portal_settings.find_one({"id": "portal_settings"}, {"_id": 0})
    return {**DEFAULT_PORTAL_SETTINGS, **{k: v for k, v in doc.items() if k != "id"}}


# ===================== PORTAL LOOKUP BY CUSTOMER =====================

@router.get("/portals/for-customer/{customer_id}")
async def portal_for_customer(customer_id: str, user=Depends(get_current_user)):
    """Gibt das Portal eines Kunden zurueck (fuer Button 'Portal oeffnen' im Kundenmodul)"""
    portal = await db.portals.find_one({"customer_id": customer_id}, {"_id": 0, "password_hash": 0})
    if not portal:
        return {"exists": False}
    return {"exists": True, "portal": portal}


# ===================== KUNDE MARKIERT ALS FERTIG (Absenden-Bestaetigung) =====================

@router.post("/portal/{token}/absenden")
async def public_absenden(token: str, body: dict):
    """Kunde klickt 'Absenden' - Nachricht + Hinweis an Admin"""
    portal = await _verify_portal_access(token, body.get("password", ""))
    optional_text = body.get("text", "").strip()
    now = datetime.now(timezone.utc).isoformat()

    # Log submission as a note of type 'absenden'
    note = {
        "id": str(uuid.uuid4()),
        "type": "absenden",
        "text": optional_text or "Kunde hat seine Eingaben abgesendet.",
        "created_at": now,
    }
    await db.portals.update_one(
        {"id": portal["id"]},
        {
            "$push": {"customer_notes": note},
            "$set": {"last_customer_submit_at": now, "customer_has_new_content": True},
        }
    )

    # Notify admin via push + email
    try:
        from routes.push import send_push_to_all
        await send_push_to_all(
            title="Kundenportal: Kunde hat abgesendet",
            body=f"{portal.get('customer_name', 'Kunde')} hat alle Eingaben abgesendet.",
            url="/portals"
        )
    except Exception as e:
        logger.warning(f"Push for absenden failed: {e}")

    await _notify_admin(
        subject=f"Portal: {portal.get('customer_name', 'Kunde')} hat abgesendet",
        body_html=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h3 style="color: #1a5632;">Kunde hat seine Eingaben abgesendet</h3>
          <p><strong>Kunde:</strong> {portal.get('customer_name', 'Kunde')}</p>
          <p><strong>Projekt:</strong> {portal.get('description', '-')}</p>
          {f'<p><strong>Mitteilung:</strong><br/>{optional_text}</p>' if optional_text else ''}
          <p>Bitte im Portal prüfen und mit einer Rückmeldung reagieren.</p>
        </div>
        """
    )

    return {"message": "Abgesendet", "note": note}


# ===================== ADMIN MARKIERT NOTES ALS GELESEN =====================

@router.post("/portals/{portal_id}/mark-read")
async def mark_notes_read(portal_id: str, user=Depends(get_current_user)):
    await db.portals.update_one(
        {"id": portal_id},
        {"$set": {"customer_has_new_content": False, "last_admin_read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Als gelesen markiert"}

