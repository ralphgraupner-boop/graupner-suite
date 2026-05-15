"""
Portal v2 – Uploads
Kunden laden Fotos/Dokumente hoch, Admin sieht Galerie.
HEIC-Support (iPhone). Storage via utils.storage (nur Aufruf).
"""
import io
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from database import db, logger
from auth import get_current_user
from utils.storage import put_object, get_object
from .auth import get_current_customer

router = APIRouter()

ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    "image/heic", "image/heif",
}
ALLOWED_DOC_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

# HEIC/HEIF support (best-effort, wird zentral in portal.py schon registriert)
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:
    pass

try:
    from PIL import Image, ImageOps
    _PIL_OK = True
except Exception:
    _PIL_OK = False


def _convert_image(data: bytes, content_type: str, filename: str) -> tuple[bytes, str, str]:
    """HEIC → JPEG, große Bilder runterskalieren. Für andere Bilder: pass-through."""
    ct = (content_type or "").lower()
    name = (filename or "").lower()
    # HEIC → JPEG
    is_heic = "heic" in ct or "heif" in ct or name.endswith((".heic", ".heif"))
    try:
        if _PIL_OK and (is_heic or ct.startswith("image/")):
            img = Image.open(io.BytesIO(data))
            img = ImageOps.exif_transpose(img)
            max_side = 2400
            if max(img.size) > max_side:
                img.thumbnail((max_side, max_side))
            buf = io.BytesIO()
            if is_heic or img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
                img.save(buf, format="JPEG", quality=82, optimize=True)
                return buf.getvalue(), "image/jpeg", "jpg"
            if img.format == "PNG":
                img.save(buf, format="PNG", optimize=True)
                return buf.getvalue(), "image/png", "png"
            img.save(buf, format="JPEG", quality=85, optimize=True)
            return buf.getvalue(), "image/jpeg", "jpg"
    except Exception as e:
        logger.warning(f"Portal v2 image convert failed, using raw: {e}")
    ext = "pdf" if ct == "application/pdf" else (name.rsplit(".", 1)[-1] if "." in name else "bin")
    return data, ct or "application/octet-stream", ext


async def _check_rate_limit(account_id: str) -> bool:
    """True = blockiert (Limit überschritten)."""
    settings = await db.portal2_settings.find_one({"id": "portal2_settings_default"}, {"_id": 0})
    if not settings:
        return False
    window = int(settings.get("rate_limit_window_sec") or 3600)
    limit = int(settings.get("rate_limit_uploads") or 20)
    since = (datetime.now(timezone.utc) - timedelta(seconds=window)).isoformat()
    count = await db.portal2_uploads.count_documents({
        "portal_id": account_id,
        "uploaded_by": "customer",
        "created_at": {"$gte": since},
    })
    return count >= limit


async def _save_upload(account_id: str, file: UploadFile, description: str, uploaded_by: str) -> dict:
    ct = (file.content_type or "").lower()
    fname = (file.filename or "").lower()
    valid = (
        ct in ALLOWED_IMAGE_TYPES
        or ct in ALLOWED_DOC_TYPES
        or fname.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".pdf"))
    )
    if not valid:
        raise HTTPException(400, "Nur Bilder (JPG/PNG/WebP/HEIC) oder PDF erlaubt")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, "Datei zu groß (max. 15 MB)")

    payload, new_ct, ext = _convert_image(data, file.content_type, file.filename or "")
    storage_path = f"graupner-suite/portal2/{account_id}/{_uuid.uuid4()}.{ext}"
    result = put_object(storage_path, payload, new_ct)

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(_uuid.uuid4()),
        "portal_id": account_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": new_ct,
        "size": result.get("size", len(payload)),
        "original_size": len(data),
        "description": description or "",
        "uploaded_by": uploaded_by,
        "is_deleted": False,
        "created_at": now,
    }
    await db.portal2_uploads.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ============== CUSTOMER ==============

@router.post("/uploads")
async def customer_upload(
    description: str = Form(""),
    file: UploadFile = File(...),
    account=Depends(get_current_customer),
):
    if await _check_rate_limit(account["id"]):
        raise HTTPException(429, "Zu viele Uploads in kurzer Zeit. Bitte später erneut versuchen.")
    doc = await _save_upload(account["id"], file, description, uploaded_by="customer")
    await db.portal2_activity.insert_one({
        "portal_id": account["id"],
        "action": "upload",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"Portal v2 Upload von Kunde {account.get('email')}: {file.filename}")
    return doc


@router.get("/uploads")
async def customer_list_uploads(account=Depends(get_current_customer)):
    ups = await db.portal2_uploads.find(
        {"portal_id": account["id"], "is_deleted": False},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return ups


@router.get("/uploads/{upload_id}")
async def customer_get_upload(upload_id: str, account=Depends(get_current_customer)):
    rec = await db.portal2_uploads.find_one(
        {"id": upload_id, "portal_id": account["id"], "is_deleted": False},
        {"_id": 0},
    )
    if not rec:
        raise HTTPException(404, "Nicht gefunden")
    data, ct = get_object(rec["storage_path"])
    return StreamingResponse(io.BytesIO(data), media_type=ct or rec.get("content_type", "application/octet-stream"))


# ============== ADMIN ==============

@router.get("/admin/accounts/{account_id}/uploads")
async def admin_list_uploads(account_id: str, user=Depends(get_current_user)):
    account = await db.portal2_accounts.find_one({"id": account_id}, {"_id": 0, "id": 1})
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    ups = await db.portal2_uploads.find(
        {"portal_id": account_id, "is_deleted": False},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return ups


@router.post("/admin/accounts/{account_id}/uploads")
async def admin_upload_for_account(
    account_id: str,
    description: str = Form(""),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    account = await db.portal2_accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(404, "Account nicht gefunden")
    doc = await _save_upload(account_id, file, description, uploaded_by="admin")
    logger.info(f"Portal v2 Admin-Upload für {account.get('email')}: {file.filename}")
    return doc


@router.get("/admin/accounts/{account_id}/uploads/{upload_id}/file")
async def admin_get_upload(account_id: str, upload_id: str, user=Depends(get_current_user)):
    rec = await db.portal2_uploads.find_one(
        {"id": upload_id, "portal_id": account_id, "is_deleted": False},
        {"_id": 0},
    )
    if not rec:
        raise HTTPException(404, "Nicht gefunden")
    data, ct = get_object(rec["storage_path"])
    return StreamingResponse(io.BytesIO(data), media_type=ct or rec.get("content_type", "application/octet-stream"))


@router.delete("/admin/accounts/{account_id}/uploads/{upload_id}")
async def admin_delete_upload(account_id: str, upload_id: str, user=Depends(get_current_user)):
    res = await db.portal2_uploads.update_one(
        {"id": upload_id, "portal_id": account_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"deleted": True, "id": upload_id}
