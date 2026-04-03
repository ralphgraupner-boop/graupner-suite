from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from database import db, logger
from auth import get_current_user
from utils.storage import put_object, get_object
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
    return {
        "valid": True,
        "customer_name": portal.get("customer_name", ""),
        "description": portal.get("description", ""),
        "expires_at": portal.get("expires_at"),
    }


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
