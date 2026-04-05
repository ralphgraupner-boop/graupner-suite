from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from database import db, logger
from auth import get_current_user
from utils.storage import put_object, get_object
from utils import send_email
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import secrets

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB


def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


# ===================== ADMIN ENDPOINTS (auth required) =====================

@router.get("/portals")
async def list_portals(user=Depends(get_current_user)):
    portals = await db.portals.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return portals


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
        cust = await db.customers.find_one({"id": portal["customer_id"]}, {"_id": 0})
        if cust:
            customer_data = {
                "name": cust.get("name", ""),
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
        {"$push": {"customer_notes": note}}
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
        {"$push": {"admin_notes": note}}
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

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, "Datei zu groß (max 15MB)")

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    storage_path = f"graupner-suite/portals/{portal['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(storage_path, data, file.content_type)

    file_doc = {
        "id": str(uuid.uuid4()),
        "portal_id": portal["id"],
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "description": description,
        "uploaded_by": "customer",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.portal_files.insert_one(file_doc)
    file_doc.pop("_id", None)

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
