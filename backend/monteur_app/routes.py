"""
Monteur-App Routes – Einsatz-Liste + Detail + Notizen + Fotos
=================================================================
Module-First: liest einsaetze + module_kunden nur lesend.
Schreibt NUR in monteur_app_notizen, monteur_app_fotos.
"""
import io
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import db, logger
from routes.auth import get_current_user
from utils.storage import put_object, get_object
from .settings import _get_or_create_settings

router = APIRouter()


# ==================== VERSION (fuer App-Aktualitaets-Check) ====================

# Wird beim Backend-Start gesetzt. Aendert sich bei jedem Deploy/Restart.
APP_VERSION = datetime.now(timezone.utc).isoformat()


@router.get("/version")
async def get_version():
    """Wird vom Frontend alle 60s gepollt. Aendert sich beim Deploy -> Reload-Hinweis."""
    return {"version": APP_VERSION}


# ==================== MODELS ====================

class NotizCreate(BaseModel):
    einsatz_id: str
    phase: str  # "besichtigung" oder "ausfuehrung"
    text: str


class NotizUpdate(BaseModel):
    text: str


class TodoCreate(BaseModel):
    einsatz_id: str
    text: str


class FeedbackUpdate(BaseModel):
    mood: str  # "zufrieden" | "neutral" | "veraergert"
    notiz: str = ""


# ==================== HELPERS ====================

async def _require_enabled():
    s = await _get_or_create_settings()
    if not s.get("feature_enabled"):
        raise HTTPException(403, "Monteur-App ist nicht aktiviert (Einstellungen → Monteur-App)")


def _einsatz_matches_user(einsatz: dict, user: dict) -> bool:
    """Prüft ob der eingeloggte User diesen Einsatz sehen darf."""
    if (user or {}).get("role") == "admin":
        return True
    username = (user or {}).get("username", "")
    if not username:
        return False
    return einsatz.get("monteur_1") == username or einsatz.get("monteur_2") == username


# ==================== EINSAETZE (lesend aus Kern-Collection) ====================

@router.get("/einsaetze")
async def list_einsaetze(status: str = "", user=Depends(get_current_user)):
    """Liste der Einsätze, gefiltert auf den eingeloggten Monteur (Admin sieht alle)."""
    await _require_enabled()
    query: dict = {}
    if status == "aktiv":
        query["status"] = {"$in": ["aktiv", "in_bearbeitung"]}
    elif status == "inaktiv":
        query["status"] = {"$in": ["inaktiv", "abgeschlossen"]}
    elif status:
        query["status"] = status

    # Monteur-Filter
    if (user or {}).get("role") != "admin":
        username = (user or {}).get("username", "")
        query["$or"] = [{"monteur_1": username}, {"monteur_2": username}]

    einsaetze = await db.einsaetze.find(query, {"_id": 0}).sort("termin", 1).to_list(500)
    return einsaetze


@router.get("/einsaetze/{einsatz_id}")
async def get_einsatz(einsatz_id: str, user=Depends(get_current_user)):
    """Einsatz-Detail inkl. Kundendaten (Telefon, Adresse) + Monteur-Notizen + Fotos."""
    await _require_enabled()
    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    if not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Dieser Einsatz ist nicht für dich zugewiesen")

    # Kundendaten nachladen (wenn customer_id gesetzt) – nur lesend aus module_kunden
    kunde = None
    if einsatz.get("customer_id"):
        kunde = await db.module_kunden.find_one(
            {"id": einsatz["customer_id"]},
            {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1, "firma": 1,
             "email": 1, "phone": 1, "strasse": 1, "hausnummer": 1, "plz": 1, "ort": 1,
             "address": 1, "anrede": 1},
        )

    # Notizen und Fotos aus isolierten Collections
    notizen = await db.monteur_app_notizen.find(
        {"einsatz_id": einsatz_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    fotos = await db.monteur_app_fotos.find(
        {"einsatz_id": einsatz_id}, {"_id": 0, "storage_path": 0}
    ).sort("uploaded_at", -1).to_list(200)
    todos = await db.monteur_app_todos.find(
        {"einsatz_id": einsatz_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    feedback = await db.monteur_app_feedback.find_one(
        {"einsatz_id": einsatz_id}, {"_id": 0}
    )

    return {
        **einsatz,
        "kunde_detail": kunde,
        "monteur_notizen": notizen,
        "monteur_fotos": fotos,
        "monteur_todos": todos,
        "monteur_feedback": feedback,
    }


# ==================== NOTIZEN ====================

@router.post("/notizen")
async def create_notiz(payload: NotizCreate, user=Depends(get_current_user)):
    await _require_enabled()
    einsatz = await db.einsaetze.find_one({"id": payload.einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    if not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    if payload.phase not in ("besichtigung", "ausfuehrung"):
        raise HTTPException(400, "phase muss 'besichtigung' oder 'ausfuehrung' sein")
    if not payload.text.strip():
        raise HTTPException(400, "Text darf nicht leer sein")

    now = datetime.now(timezone.utc).isoformat()
    notiz = {
        "id": str(uuid4()),
        "einsatz_id": payload.einsatz_id,
        "phase": payload.phase,
        "text": payload.text.strip(),
        "created_at": now,
        "updated_at": now,
        "created_by": (user or {}).get("username", "unknown"),
    }
    await db.monteur_app_notizen.insert_one(notiz)
    notiz.pop("_id", None)
    logger.info(f"Monteur-App Notiz von {notiz['created_by']} fuer Einsatz {payload.einsatz_id} ({payload.phase})")
    return notiz


@router.put("/notizen/{notiz_id}")
async def update_notiz(notiz_id: str, payload: NotizUpdate, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.monteur_app_notizen.find_one({"id": notiz_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Notiz nicht gefunden")
    if (user or {}).get("role") != "admin" and existing.get("created_by") != (user or {}).get("username"):
        raise HTTPException(403, "Nur eigene Notizen bearbeiten")
    await db.monteur_app_notizen.update_one(
        {"id": notiz_id},
        {"$set": {"text": payload.text.strip(), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.monteur_app_notizen.find_one({"id": notiz_id}, {"_id": 0})


@router.delete("/notizen/{notiz_id}")
async def delete_notiz(notiz_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.monteur_app_notizen.find_one({"id": notiz_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Notiz nicht gefunden")
    if (user or {}).get("role") != "admin" and existing.get("created_by") != (user or {}).get("username"):
        raise HTTPException(403, "Nur eigene Notizen löschen")
    await db.monteur_app_notizen.delete_one({"id": notiz_id})
    return {"deleted": True, "id": notiz_id}


# ==================== FOTOS ====================

@router.post("/fotos")
async def upload_foto(
    einsatz_id: str = Form(...),
    phase: str = Form(...),  # "besichtigung" oder "ausfuehrung"
    description: str = Form(""),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    await _require_enabled()
    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    if not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    if phase not in ("besichtigung", "ausfuehrung"):
        raise HTTPException(400, "phase muss 'besichtigung' oder 'ausfuehrung' sein")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Leere Datei")

    filename = (file.filename or "foto.jpg")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    content_type = file.content_type or "image/jpeg"

    storage_path = f"graupner-suite/monteur-app/{einsatz_id}/{uuid4()}.{ext}"
    result = put_object(storage_path, data, content_type)

    rec = {
        "id": str(uuid4()),
        "einsatz_id": einsatz_id,
        "phase": phase,
        "filename": filename,
        "content_type": content_type,
        "size": len(data),
        "description": description.strip(),
        "storage_path": result["path"],
        "uploaded_by": (user or {}).get("username", "unknown"),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.monteur_app_fotos.insert_one(rec)
    rec_public = {k: v for k, v in rec.items() if k != "storage_path"}
    rec_public.pop("_id", None)
    logger.info(f"Monteur-App Foto von {rec['uploaded_by']} fuer Einsatz {einsatz_id} ({phase})")
    return rec_public


@router.get("/fotos/{foto_id}/download")
async def download_foto(foto_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    rec = await db.monteur_app_fotos.find_one({"id": foto_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Foto nicht gefunden")
    einsatz = await db.einsaetze.find_one({"id": rec["einsatz_id"]}, {"_id": 0})
    if not einsatz or not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    data, ct = get_object(rec["storage_path"])
    return StreamingResponse(
        io.BytesIO(data),
        media_type=ct or rec.get("content_type") or "image/jpeg",
        headers={"Content-Disposition": f'inline; filename="{rec.get("filename", "foto.jpg")}"'},
    )


@router.delete("/fotos/{foto_id}")
async def delete_foto(foto_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    rec = await db.monteur_app_fotos.find_one({"id": foto_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Foto nicht gefunden")
    if (user or {}).get("role") != "admin" and rec.get("uploaded_by") != (user or {}).get("username"):
        raise HTTPException(403, "Nur eigene Fotos löschen")
    await db.monteur_app_fotos.delete_one({"id": foto_id})
    # Storage-Rest belassen (wird selten, Storage-Cleanup koennen wir spaeter machen)
    return {"deleted": True, "id": foto_id}


# ==================== TODOS (Phase 3: noch zu erledigen) ====================

@router.post("/todos")
async def create_todo(payload: TodoCreate, user=Depends(get_current_user)):
    await _require_enabled()
    einsatz = await db.einsaetze.find_one({"id": payload.einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    if not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    if not payload.text.strip():
        raise HTTPException(400, "Text darf nicht leer sein")
    now = datetime.now(timezone.utc).isoformat()
    todo = {
        "id": str(uuid4()),
        "einsatz_id": payload.einsatz_id,
        "text": payload.text.strip(),
        "erledigt": False,
        "erledigt_at": None,
        "erledigt_by": None,
        "created_at": now,
        "created_by": (user or {}).get("username", "unknown"),
    }
    await db.monteur_app_todos.insert_one(todo)
    todo.pop("_id", None)
    return todo


@router.patch("/todos/{todo_id}/toggle")
async def toggle_todo(todo_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.monteur_app_todos.find_one({"id": todo_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Todo nicht gefunden")
    einsatz = await db.einsaetze.find_one({"id": existing["einsatz_id"]}, {"_id": 0})
    if not einsatz or not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    now = datetime.now(timezone.utc).isoformat()
    new_state = not existing.get("erledigt", False)
    await db.monteur_app_todos.update_one(
        {"id": todo_id},
        {"$set": {
            "erledigt": new_state,
            "erledigt_at": now if new_state else None,
            "erledigt_by": (user or {}).get("username") if new_state else None,
        }},
    )
    return await db.monteur_app_todos.find_one({"id": todo_id}, {"_id": 0})


@router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    existing = await db.monteur_app_todos.find_one({"id": todo_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Todo nicht gefunden")
    einsatz = await db.einsaetze.find_one({"id": existing["einsatz_id"]}, {"_id": 0})
    if not einsatz or not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    await db.monteur_app_todos.delete_one({"id": todo_id})
    return {"deleted": True, "id": todo_id}


# ==================== FEEDBACK / KUNDENSTIMMUNG (Phase 4) ====================

_VALID_MOODS = {"zufrieden", "neutral", "veraergert"}


@router.put("/einsaetze/{einsatz_id}/feedback")
async def upsert_feedback(einsatz_id: str, payload: FeedbackUpdate, user=Depends(get_current_user)):
    await _require_enabled()
    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz:
        raise HTTPException(404, "Einsatz nicht gefunden")
    if not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    if payload.mood not in _VALID_MOODS:
        raise HTTPException(400, f"mood muss einer von {_VALID_MOODS} sein")
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.monteur_app_feedback.find_one({"einsatz_id": einsatz_id}, {"_id": 0})
    update = {
        "mood": payload.mood,
        "notiz": (payload.notiz or "").strip(),
        "updated_at": now,
        "updated_by": (user or {}).get("username", "unknown"),
    }
    if existing:
        await db.monteur_app_feedback.update_one({"einsatz_id": einsatz_id}, {"$set": update})
    else:
        new_doc = {
            "id": str(uuid4()),
            "einsatz_id": einsatz_id,
            "created_at": now,
            **update,
        }
        await db.monteur_app_feedback.insert_one(new_doc)
    return await db.monteur_app_feedback.find_one({"einsatz_id": einsatz_id}, {"_id": 0})


@router.delete("/einsaetze/{einsatz_id}/feedback")
async def clear_feedback(einsatz_id: str, user=Depends(get_current_user)):
    await _require_enabled()
    einsatz = await db.einsaetze.find_one({"id": einsatz_id}, {"_id": 0})
    if not einsatz or not _einsatz_matches_user(einsatz, user):
        raise HTTPException(403, "Nicht zugewiesen")
    await db.monteur_app_feedback.delete_one({"einsatz_id": einsatz_id})
    return {"deleted": True, "einsatz_id": einsatz_id}

