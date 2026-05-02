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

# HEIC/HEIF support for iPhone uploads
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_SUPPORTED = True
except Exception as _e:
    HEIC_SUPPORTED = False
    logger.warning(f"pillow-heif not available - HEIC uploads will fail: {_e}")

router = APIRouter()


# ---------------------------------------------------------------------------
# Datenmasken-Helper: Portal nutzt module_kunden als Single Source of Truth.
# Cache-Felder customer_name/customer_email werden bei jedem Lesezugriff aus
# dem Kunden synchronisiert. Wenn der Kunde gelöscht wurde, bleibt der Cache
# erhalten, wird aber als "(Kunde gelöscht)" markiert.
# ---------------------------------------------------------------------------

async def _enrich_portal_with_kunde(portal: dict) -> dict:
    """Schreibt aktuelle Kundendaten in das Portal-Dict (in-place + Rückgabe).
    Hat keinen Effekt für Anfrage-Portale ohne customer_id."""
    if not portal:
        return portal
    cid = portal.get("customer_id")
    if not cid:
        return portal
    kunde = await db.module_kunden.find_one(
        {"id": cid},
        {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1, "email": 1},
    )
    if not kunde:
        # Verwaister Kunde – Cache markieren, damit es im UI sichtbar ist
        old_name = portal.get("customer_name") or "Unbekannter Kunde"
        if not old_name.endswith("(Kunde gelöscht)"):
            portal["customer_name"] = f"{old_name} (Kunde gelöscht)"
        portal["customer_deleted"] = True
        return portal
    fresh_name = ((kunde.get("vorname", "") + " " + kunde.get("nachname", "")).strip()
                  or kunde.get("name", "")).strip() or portal.get("customer_name", "")
    fresh_email = (kunde.get("email") or "").strip()
    portal["customer_name"] = fresh_name
    if fresh_email:
        portal["customer_email"] = fresh_email
    portal["customer_deleted"] = False
    return portal


async def _enrich_portals_bulk(portals: list[dict]) -> list[dict]:
    """Effiziente Variante für Listen: alle Kunden in einer Query holen."""
    if not portals:
        return portals
    cids = list({p.get("customer_id") for p in portals if p.get("customer_id")})
    if not cids:
        return portals
    kunden_map: dict = {}
    async for k in db.module_kunden.find(
        {"id": {"$in": cids}},
        {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1, "email": 1},
    ):
        kunden_map[k["id"]] = k
    for p in portals:
        cid = p.get("customer_id")
        if not cid:
            continue
        k = kunden_map.get(cid)
        if not k:
            old_name = p.get("customer_name") or "Unbekannter Kunde"
            if not old_name.endswith("(Kunde gelöscht)"):
                p["customer_name"] = f"{old_name} (Kunde gelöscht)"
            p["customer_deleted"] = True
            continue
        fresh_name = ((k.get("vorname", "") + " " + k.get("nachname", "")).strip()
                      or k.get("name", "")).strip() or p.get("customer_name", "")
        fresh_email = (k.get("email") or "").strip()
        p["customer_name"] = fresh_name
        if fresh_email:
            p["customer_email"] = fresh_email
        p["customer_deleted"] = False
    return portals


async def _sync_portal_cache_back(portal_id: str, customer_name: str, customer_email: str) -> None:
    """Schreibt den Live-Lookup-Wert zurück in die portals-Collection.
    Spart eine 2nd Query bei Such-Filtern, hält Liste schnell sortierbar.
    Best-effort – ein Fehler bricht die Anfrage nicht ab."""
    try:
        await db.portals.update_one(
            {"id": portal_id},
            {"$set": {
                "customer_name": customer_name,
                "customer_email": customer_email,
            }},
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Cache-Sync für Portal {portal_id} fehlgeschlagen: {e}")


ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
    # Some browsers/phones send empty or generic content types - accept them and validate via PIL
    "application/octet-stream", "",
}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


def _build_anrede_brief(customer_name: str) -> str:
    """Erzeugt passende Briefanrede aus dem Kundennamen."""
    name = (customer_name or "").strip()
    if not name:
        return "Sehr geehrte Damen und Herren"
    # Prefix aus dem Namen lesen
    clean = name
    prefix = ""
    for p in ("Herr", "Frau", "Divers"):
        if clean.startswith(p + " "):
            prefix = p
            clean = clean[len(p):].strip()
            break
    parts = clean.split()
    nachname = parts[-1] if parts else clean
    if prefix == "Herr":
        return f"Sehr geehrter Herr {nachname}"
    if prefix == "Frau":
        return f"Sehr geehrte Frau {nachname}"
    return f"Sehr geehrte/r {clean}"


async def _build_portal_email_html(
    customer_name: str,
    portal_url: str,
    password: str,
    expires_iso: str,
    description: str = "",
) -> tuple[str, str]:
    """Baut Betreff + HTML-Body der Kundenportal-Zugangsmail.
    Einheitlich fuer Auto-Versand und manuellen Re-Send.
    """
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    company = settings.get("company_name", "Tischlerei Graupner")
    company_phone = settings.get("company_phone", "")
    company_email = settings.get("company_email", "")

    anrede = _build_anrede_brief(customer_name)
    try:
        expires = datetime.fromisoformat(expires_iso).strftime("%d.%m.%Y")
    except Exception:
        expires = expires_iso or "-"

    # Kontakt-Zeile nur wenn vorhanden
    contact_parts = []
    if company_phone:
        contact_parts.append(f"Tel.: {company_phone}")
    if company_email:
        contact_parts.append(f'E-Mail: <a href="mailto:{company_email}" style="color:#1a5632;">{company_email}</a>')
    contact_line = " &middot; ".join(contact_parts)

    anliegen_block = ""
    if description:
        import html as _html
        safe = _html.escape(description)
        anliegen_block = f"""
        <div style="background:#fff7ed;border-left:4px solid #ea580c;padding:12px 16px;margin:20px 0;border-radius:4px;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#9a3412;font-weight:600;">Ihr Anliegen:</p>
          <p style="margin:0;font-size:14px;color:#333;">{safe}</p>
        </div>
        """

    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;line-height:1.55;">
      <h2 style="color:#1a5632;margin:0 0 16px 0;">Ihr Kundenportal bei {company}</h2>

      <p>{anrede},</p>
      <p>wir freuen uns, Sie als Kunde bei der {company} begrüßen zu dürfen. Für Ihre Anfrage haben wir ein persönliches, sicheres Kundenportal eingerichtet.</p>

      {anliegen_block}

      <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#1a5632;">&#128228; Ihr Zugang</p>
        <p style="margin:0 0 8px 0;font-size:14px;"><strong>Link zum Portal:</strong><br/>
          <a href="{portal_url}" style="color:#1a5632;word-break:break-all;">{portal_url}</a>
        </p>
        <p style="margin:0;font-size:14px;"><strong>Passwort:</strong>
          <code style="display:inline-block;background:#fff;padding:8px 14px;border-radius:4px;border:1px solid #cbd5e1;font-size:18px;font-family:'Courier New',Consolas,monospace;letter-spacing:1px;color:#0f172a;font-weight:700;">{password}</code>
        </p>
        <p style="margin:6px 0 0 0;font-size:11px;color:#64748b;">Tipp: Bitte das Passwort sorgfältig kopieren oder eintippen – auf Groß-/Kleinschreibung achten.</p>
      </div>

      <h3 style="color:#1a5632;font-size:16px;margin:24px 0 8px 0;">&#128203; So funktioniert das Portal &ndash; Schritt für Schritt:</h3>
      <ol style="padding-left:20px;margin:0 0 16px 0;">
        <li style="margin-bottom:6px;">Klicken Sie oben auf den <strong>Link</strong>. Sie werden zum Portal weitergeleitet.</li>
        <li style="margin-bottom:6px;">Geben Sie das <strong>Passwort</strong> ein und klicken auf &bdquo;Anmelden&ldquo;.</li>
        <li style="margin-bottom:6px;">Laden Sie gewünschte <strong>Fotos hoch</strong> (z.&nbsp;B. vom Fenster, Türen, dem betroffenen Raum) &ndash; einfach per Klick oder Drag &amp; Drop.</li>
        <li style="margin-bottom:6px;">Bei Rückfragen können Sie uns direkt <strong>eine Nachricht schreiben</strong>.</li>
        <li>Wenn alles hochgeladen ist, klicken Sie auf <strong>&bdquo;Absenden&ldquo;</strong> &ndash; wir erhalten automatisch Bescheid.</li>
      </ol>

      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:12px 16px;margin:20px 0;font-size:13px;color:#065f46;">
        &#128274; <strong>Datenschutz:</strong> Das Portal ist verschlüsselt (HTTPS) und nur mit Ihrem Passwort zugänglich.
      </div>

      <p style="font-size:13px;color:#64748b;">Das Portal ist gültig bis <strong>{expires}</strong>.</p>

      {f'<p style="font-size:13px;color:#475569;">Bei Fragen erreichen Sie uns unter {contact_line}.</p>' if contact_line else ''}

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px 0;"/>
      <p style="margin:0;font-size:13px;color:#475569;">Mit freundlichen Grüßen<br/>Ihr Team der <strong>{company}</strong></p>
    </div>
    """
    subject = f"Ihr Kundenportal bei {company}"
    return subject, html
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB
MAX_IMAGES_PER_PORTAL = 30
RATE_LIMIT_MAX_UPLOADS = 10
RATE_LIMIT_WINDOW_SEC = 60
IMAGE_MAX_DIMENSION = 1920
IMAGE_JPEG_QUALITY = 80


def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


# Zeichen-Pool ohne missverständliche Zeichen (0/O, 1/l/I, S/5)
_PW_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def gen_portal_password(length: int = 10) -> str:
    """Erzeugt ein leicht ablesbares Portal-Passwort.
    Verzichtet bewusst auf Zeichen, die in Mails leicht verwechselt werden:
    0/O, 1/l/I/i, S/5.
    """
    return "".join(secrets.choice(_PW_ALPHABET) for _ in range(length))


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
    # Datenmasken: Kundendaten live aus module_kunden überschreiben + Cache zurückschreiben
    portals = await _enrich_portals_bulk(portals)
    for p in portals:
        if p.get("customer_id") and not p.get("customer_deleted"):
            await _sync_portal_cache_back(p["id"], p.get("customer_name", ""), p.get("customer_email", ""))
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
    if portal:
        portal = await _enrich_portal_with_kunde(portal)
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

    password = body.get("password", "") or gen_portal_password()
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
            subject, html = await _build_portal_email_html(
                customer_name=customer_name,
                portal_url=portal_url,
                password=password,
                expires_iso=portal["expires_at"],
                description=portal.get("description", ""),
            )
            send_email(to_email=customer_email, subject=subject, body_html=html)
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
        password = gen_portal_password()

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
    password = body.get("password", "") or gen_portal_password()
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
            subject, html = await _build_portal_email_html(
                customer_name=customer_name,
                portal_url=portal_url,
                password=password,
                expires_iso=portal["expires_at"],
                description=description,
            )
            send_email(
                to_email=customer_email,
                subject=subject,
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
    if "customer_email" in body:
        new_email = (body["customer_email"] or "").strip()
        if new_email and "@" not in new_email:
            raise HTTPException(400, "Ungueltige E-Mail-Adresse")
        updates["customer_email"] = new_email
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
    notify_customer: bool = Form(False),
    portal_url: str = Form(""),
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

    # Optional: Kunde per Mail informieren
    notified = False
    if notify_customer:
        portal_enriched = await _enrich_portal_with_kunde(dict(portal))
        portal_enriched.pop("_id", None)
        cust_mail = (portal_enriched.get("customer_email") or "").strip()
        if cust_mail:
            cust_name = portal_enriched.get("customer_name", "Kunde")
            anrede = _build_anrede_brief(cust_name)
            settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
            company = settings.get("company_name", "Tischlerei Graupner")
            link = portal_url or f"/portal/{portal.get('token', '')}"
            html = f"""
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;line-height:1.55;">
              <h2 style="color:#1a5632;margin:0 0 12px 0;">Neues Dokument in Ihrem Kundenportal</h2>
              <p>{anrede},</p>
              <p>wir haben für Sie ein Dokument im Kundenportal hinterlegt: <strong>{file.filename}</strong></p>
              <p style="margin:20px 0;">
                <a href="{link}" style="background:#1a5632;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Portal öffnen</a>
              </p>
              <p style="font-size:13px;color:#475569;">Ihr Login-Passwort haben Sie bereits per E-Mail erhalten.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px 0;"/>
              <p style="margin:0;font-size:13px;color:#475569;">Mit freundlichen Grüßen<br/>Ihr Team der <strong>{company}</strong></p>
            </div>
            """
            try:
                send_email(
                    to_email=cust_mail,
                    subject=f"Neues Dokument in Ihrem Kundenportal · {company}",
                    body_html=html,
                )
                notified = True
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Notify-customer (upload) failed: {e}")

    file_doc["notified"] = notified
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

    # Datenmasken: vor dem Versand aktuelle E-Mail/Name aus module_kunden übernehmen
    portal = await _enrich_portal_with_kunde(portal)

    customer_email = portal.get("customer_email", "")
    if not customer_email:
        raise HTTPException(400, "Keine E-Mail-Adresse vorhanden")

    portal_url = body.get("portal_url", "")
    if not portal_url:
        raise HTTPException(400, "Portal-URL fehlt")

    customer_name = portal.get("customer_name", "Kunde")
    description = portal.get("description", "")
    password = portal.get("password_plain", "")

    subject, html = await _build_portal_email_html(
        customer_name=customer_name,
        portal_url=portal_url,
        password=password,
        expires_iso=portal["expires_at"],
        description=description,
    )

    try:
        send_email(
            to_email=customer_email,
            subject=subject,
            body_html=html,
        )
        # Cache zurückschreiben + Versand-Audit
        if portal.get("customer_id") and not portal.get("customer_deleted"):
            await _sync_portal_cache_back(portal_id, customer_name, customer_email)
        await db.portals.update_one(
            {"id": portal_id},
            {"$set": {"last_email_sent_at": datetime.now(timezone.utc).isoformat(), "last_email_sent_to": customer_email},
             "$inc": {"email_send_count": 1}},
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
            # Privatadresse zusammensetzen (Strasse Hausnummer, PLZ Ort)
            strasse = (cust.get("strasse") or "").strip()
            hausnr = (cust.get("hausnummer") or "").strip()
            plz = (cust.get("plz") or "").strip()
            ort = (cust.get("ort") or "").strip()
            line1 = f"{strasse} {hausnr}".strip()
            line2 = f"{plz} {ort}".strip()
            address = ", ".join(p for p in [line1, line2] if p) or (cust.get("address") or "").strip()
            # Objekt-/Baustellenadresse zusätzlich, wenn abweichend
            obj_strasse = (cust.get("objekt_strasse") or "").strip()
            obj_plz = (cust.get("objekt_plz") or "").strip()
            obj_ort = (cust.get("objekt_ort") or "").strip()
            obj_line = ", ".join(p for p in [obj_strasse, f"{obj_plz} {obj_ort}".strip()] if p)
            object_address = obj_line if obj_line and obj_line != address else ""
            customer_data = {
                "name": cust_name,
                "email": cust.get("email", ""),
                "phone": cust.get("phone") or cust.get("telefon", ""),
                "address": address,
                "object_address": object_address,
                "notes": cust.get("anliegen") or cust.get("nachricht") or cust.get("notes", ""),
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

    # Notizen sortieren: neueste zuerst (für UI-Anzeige im Portal)
    def _sort_notes(notes):
        try:
            return sorted(notes or [], key=lambda n: n.get("created_at", ""), reverse=True)
        except Exception:
            return notes or []

    return {
        "valid": True,
        "portal_id": portal.get("id"),
        "customer_name": portal.get("customer_name", ""),
        "description": portal.get("description", ""),
        "expires_at": portal.get("expires_at"),
        "customer_data": customer_data,
        "customer_notes": _sort_notes(portal.get("customer_notes", [])),
        "admin_notes": _sort_notes(portal.get("admin_notes", [])),
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
    """Admin sendet Nachricht an Kunden über das Portal.

    body.notify_customer (optional, default False):
      Wenn True, wird zusätzlich eine kurze E-Mail an den Kunden
      geschickt, dass im Portal eine neue Nachricht von uns liegt.
    """
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

    # Optional: Kunden per Mail informieren
    notify_customer = bool(body.get("notify_customer"))
    notified = False
    if notify_customer:
        # Live-Lookup für Mail-Adresse (Datenmasken)
        portal_enriched = await _enrich_portal_with_kunde(dict(portal))
        portal_enriched.pop("_id", None)
        cust_mail = (portal_enriched.get("customer_email") or "").strip()
        if cust_mail:
            portal_url = body.get("portal_url") or ""
            if not portal_url:
                # Fallback: aus Token + Konfiguration zusammenbauen, wenn Frontend keine URL mitschickt
                portal_url = f"/portal/{portal.get('token', '')}"
            cust_name = portal_enriched.get("customer_name", "Kunde")
            anrede = _build_anrede_brief(cust_name)
            settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
            company = settings.get("company_name", "Tischlerei Graupner")
            html = f"""
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;line-height:1.55;">
              <h2 style="color:#1a5632;margin:0 0 12px 0;">Neue Nachricht in Ihrem Kundenportal</h2>
              <p>{anrede},</p>
              <p>wir haben Ihnen eine neue Nachricht in Ihrem persönlichen Kundenportal hinterlegt.</p>
              <p style="margin:20px 0;">
                <a href="{portal_url}" style="background:#1a5632;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Portal öffnen</a>
              </p>
              <p style="font-size:13px;color:#475569;">Ihr Login-Passwort haben Sie bereits per E-Mail erhalten.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px 0;"/>
              <p style="margin:0;font-size:13px;color:#475569;">Mit freundlichen Grüßen<br/>Ihr Team der <strong>{company}</strong></p>
            </div>
            """
            try:
                send_email(
                    to_email=cust_mail,
                    subject=f"Neue Nachricht in Ihrem Kundenportal · {company}",
                    body_html=html,
                )
                notified = True
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Notify-customer (note) failed: {e}")

    return {**note, "notified": notified}


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

    # Accept based on content-type whitelist OR file extension (some phones send generic content-type)
    ct = (file.content_type or "").lower()
    fname = (file.filename or "").lower()
    valid_ext = fname.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"))
    if ct not in ALLOWED_IMAGE_TYPES and not valid_ext:
        raise HTTPException(400, "Nur Bilder erlaubt (JPG, PNG, WebP, HEIC).")

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

    # E-Mail-Benachrichtigung an Admin
    try:
        await _notify_admin(
            subject=f"Portal: {portal.get('customer_name', 'Kunde')} hat ein Bild hochgeladen",
            body_html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h3 style="color: #1a5632;">Neues Bild im Kundenportal</h3>
              <p><strong>Kunde:</strong> {portal.get('customer_name', 'Kunde')}</p>
              <p><strong>Projekt:</strong> {portal.get('description', '-')}</p>
              <p><strong>Dateiname:</strong> {file.filename}</p>
              {f'<p><strong>Bemerkung:</strong> {description}</p>' if description else ''}
              <p style="margin-top:20px;">Bitte im Admin-Bereich unter <em>Kundenportale</em> einsehen.</p>
            </div>
            """,
        )
    except Exception as e:
        logger.warning(f"Admin email for upload failed: {e}")

    # Remaining slots info
    file_doc["remaining_slots"] = MAX_IMAGES_PER_PORTAL - (total_count + 1)
    return file_doc


@router.get("/portal/file/{file_id}")
async def public_download_file(file_id: str, auth: str = ""):
    record = await db.portal_files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(404, "Datei nicht gefunden")
    try:
        data, ct = get_object(record["storage_path"])
    except Exception as e:
        logger.warning(f"portal/file: storage error for {file_id}: {e}")
        raise HTTPException(404, "Datei im Storage nicht mehr verfügbar")
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



# ===================== DASHBOARD BADGE: ANZAHL UNGELESENE PORTAL-AKTIVITÄTEN =====================

@router.get("/portals/unread-count")
async def portals_unread_count(user=Depends(get_current_user)):
    """Liefert Anzahl der Portale mit customer_has_new_content=True (fuer Dashboard-Badge)."""
    count = await db.portals.count_documents({
        "customer_has_new_content": True,
        "active": {"$ne": False},
    })
    # Liste der betroffenen Portale (max 5) fuer Tooltip/Preview
    cursor = db.portals.find(
        {"customer_has_new_content": True, "active": {"$ne": False}},
        {"_id": 0, "id": 1, "customer_name": 1, "description": 1, "last_customer_activity_at": 1, "last_customer_submit_at": 1}
    ).limit(5)
    items = [doc async for doc in cursor]
    return {"count": count, "items": items}
