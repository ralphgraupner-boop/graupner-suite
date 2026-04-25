"""Projekte-Modul – CRUD + Bilder-Upload."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from database import db, logger
from routes.auth import get_current_user

router = APIRouter()

# ===================== Konstanten =====================

VALID_STATUS = {"Anfrage", "In Bearbeitung", "Abgeschlossen", "Archiv"}
VALID_KATEGORIEN = {"Innentür", "Fenster", "Haustür", "Schiebetür", "Sonstiges"}
VALID_BILD_KATEGORIEN = {"vorher", "nachher", "schaden", "sonstiges"}

# ===================== Models =====================


class ProjektCreate(BaseModel):
    kunde_id: str
    titel: str
    beschreibung: Optional[str] = ""
    kategorie: Optional[str] = "Sonstiges"
    adresse: Optional[str] = ""
    status: Optional[str] = "Anfrage"


class ProjektUpdate(BaseModel):
    titel: Optional[str] = None
    beschreibung: Optional[str] = None
    kategorie: Optional[str] = None
    adresse: Optional[str] = None
    status: Optional[str] = None
    notizen: Optional[str] = None
    erledigt_am: Optional[str] = None


# ===================== Helpers =====================


def _kunde_display(k: dict) -> str:
    return (
        k.get("name")
        or f"{k.get('vorname', '')} {k.get('nachname', '')}".strip()
        or k.get("firma")
        or "(ohne Name)"
    )


async def _kunde_or_404(kunde_id: str) -> dict:
    k = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Kunde nicht gefunden")
    return k


def _projekt_addr_from_kunde(k: dict) -> str:
    addr = (k.get("address") or "").strip()
    if addr:
        return addr
    parts = [
        f"{k.get('strasse', '')} {k.get('hausnummer', '')}".strip(),
        f"{k.get('plz', '')} {k.get('ort', '')}".strip(),
    ]
    return ", ".join(p for p in parts if p)


# ===================== CRUD =====================


@router.get("/")
async def list_projekte(kunde_id: Optional[str] = None, status: Optional[str] = None,
                         user=Depends(get_current_user)):
    """Alle Projekte abrufen, optional gefiltert nach Kunde oder Status."""
    query: dict = {}
    if kunde_id:
        query["kunde_id"] = kunde_id
    if status:
        query["status"] = status
    items = await db.module_projekte.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return items


@router.get("/{projekt_id}")
async def get_projekt(projekt_id: str, user=Depends(get_current_user)):
    p = await db.module_projekte.find_one({"id": projekt_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Projekt nicht gefunden")
    return p


@router.post("/")
async def create_projekt(payload: ProjektCreate, user=Depends(get_current_user)):
    k = await _kunde_or_404(payload.kunde_id)
    if payload.status and payload.status not in VALID_STATUS:
        raise HTTPException(400, f"Ungueltiger Status. Erlaubt: {sorted(VALID_STATUS)}")
    if payload.kategorie and payload.kategorie not in VALID_KATEGORIEN:
        raise HTTPException(400, f"Ungueltige Kategorie. Erlaubt: {sorted(VALID_KATEGORIEN)}")
    now = datetime.now(timezone.utc).isoformat()
    projekt = {
        "id": str(uuid.uuid4()),
        "kunde_id": payload.kunde_id,
        "kunde_name": _kunde_display(k),
        "titel": payload.titel.strip(),
        "beschreibung": (payload.beschreibung or "").strip(),
        "kategorie": payload.kategorie or "Sonstiges",
        "adresse": (payload.adresse or "").strip() or _projekt_addr_from_kunde(k),
        "status": payload.status or "Anfrage",
        "notizen": "",
        "bilder": [],
        "erledigt_am": None,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("username") or user.get("email") or "admin",
        # Phase-2-Vorbereitung – im Portal v4 sichtbar?
        "portal_freigegeben": False,
    }
    await db.module_projekte.insert_one(projekt)
    projekt.pop("_id", None)
    logger.info(f"Projekt erstellt: {projekt['titel']} fuer {projekt['kunde_name']}")
    return projekt


@router.put("/{projekt_id}")
async def update_projekt(projekt_id: str, payload: ProjektUpdate, user=Depends(get_current_user)):
    existing = await db.module_projekte.find_one({"id": projekt_id})
    if not existing:
        raise HTTPException(404, "Projekt nicht gefunden")
    update = payload.model_dump(exclude_none=True)
    if "status" in update and update["status"] not in VALID_STATUS:
        raise HTTPException(400, f"Ungueltiger Status. Erlaubt: {sorted(VALID_STATUS)}")
    if "kategorie" in update and update["kategorie"] not in VALID_KATEGORIEN:
        raise HTTPException(400, f"Ungueltige Kategorie. Erlaubt: {sorted(VALID_KATEGORIEN)}")
    # Wenn Status auf Abgeschlossen wechselt und kein erledigt_am gesetzt -> jetzt setzen
    if update.get("status") == "Abgeschlossen" and not existing.get("erledigt_am") and "erledigt_am" not in update:
        update["erledigt_am"] = datetime.now(timezone.utc).isoformat()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_projekte.update_one({"id": projekt_id}, {"$set": update})
    updated = await db.module_projekte.find_one({"id": projekt_id}, {"_id": 0})
    return updated


@router.delete("/{projekt_id}")
async def delete_projekt(projekt_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    res = await db.module_projekte.delete_one({"id": projekt_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Projekt nicht gefunden")
    return {"message": "Projekt geloescht"}


# ===================== Bilder =====================


@router.post("/{projekt_id}/bilder")
async def upload_bild(projekt_id: str, kategorie: str = "sonstiges", beschreibung: str = "",
                       file: UploadFile = File(...), user=Depends(get_current_user)):
    p = await db.module_projekte.find_one({"id": projekt_id})
    if not p:
        raise HTTPException(404, "Projekt nicht gefunden")
    if kategorie not in VALID_BILD_KATEGORIEN:
        raise HTTPException(400, f"Ungueltige Kategorie. Erlaubt: {sorted(VALID_BILD_KATEGORIEN)}")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "Datei zu gross (max 15 MB)")
    try:
        from utils.storage import put_object
        safe_name = (file.filename or "bild.jpg").replace(" ", "_")
        path = f"module_projekte/{projekt_id}/{uuid.uuid4().hex[:8]}_{safe_name}"
        result = put_object(path, content, file.content_type or "image/jpeg")
        url = result.get("url") or result.get("path", "")
    except Exception as e:
        logger.error(f"Projekt-Bild-Upload fehlgeschlagen: {e}")
        raise HTTPException(500, "Upload fehlgeschlagen")
    bild = {
        "id": str(uuid.uuid4()),
        "url": url,
        "filename": file.filename,
        "kategorie": kategorie,
        "beschreibung": beschreibung,
        "content_type": file.content_type,
        "size": len(content),
        "uploaded_by": user.get("username", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_projekte.update_one(
        {"id": projekt_id},
        {"$push": {"bilder": bild},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return bild


@router.put("/{projekt_id}/bilder/{bild_id}")
async def update_bild(projekt_id: str, bild_id: str, payload: dict, user=Depends(get_current_user)):
    """Bildunterschrift / Kategorie aendern."""
    update_fields: dict = {}
    if "beschreibung" in payload:
        update_fields["bilder.$.beschreibung"] = payload["beschreibung"]
    if "kategorie" in payload:
        if payload["kategorie"] not in VALID_BILD_KATEGORIEN:
            raise HTTPException(400, "Ungueltige Bild-Kategorie")
        update_fields["bilder.$.kategorie"] = payload["kategorie"]
    if not update_fields:
        raise HTTPException(400, "Nichts zu aendern")
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.module_projekte.update_one(
        {"id": projekt_id, "bilder.id": bild_id},
        {"$set": update_fields},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Projekt oder Bild nicht gefunden")
    p = await db.module_projekte.find_one({"id": projekt_id}, {"_id": 0})
    return p


@router.delete("/{projekt_id}/bilder/{bild_id}")
async def delete_bild(projekt_id: str, bild_id: str, user=Depends(get_current_user)):
    res = await db.module_projekte.update_one(
        {"id": projekt_id},
        {"$pull": {"bilder": {"id": bild_id}},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Bild nicht gefunden")
    return {"message": "Bild geloescht"}


# ===================== Aus Kunden-Anfrage Projekt erstellen =====================


class FromKundePayload(BaseModel):
    titel: Optional[str] = None  # Falls leer: aus Kategorie/Nachricht generieren
    bilder_uebernehmen: bool = True


@router.post("/from-kunde/{kunde_id}")
async def create_from_kunde(kunde_id: str, payload: FromKundePayload = FromKundePayload(),
                              user=Depends(get_current_user)):
    """Erstellt ein neues Projekt aus den Daten einer Kundenanfrage.

    Uebernimmt: Adresse, Kategorie (erste aus 'kategorien'), Beschreibung (aus 'nachricht'),
    optional Bilder aus 'photos' (vom Webhook hochgeladen).
    Bilder werden NUR uebernommen, wenn dies das ERSTE Projekt fuer diesen Kunden ist
    (sonst wuerden sie bei jedem 2./3. Projekt unnoetig erneut kopiert).
    """
    k = await _kunde_or_404(kunde_id)
    now = datetime.now(timezone.utc).isoformat()

    # Existieren schon Projekte fuer diesen Kunden?
    existing_count = await db.module_projekte.count_documents({"kunde_id": kunde_id})
    is_first_projekt = existing_count == 0

    # Kategorie ableiten: erste aus Liste, sonst Sonstiges
    kategorien_liste = k.get("kategorien") or []
    erste_kat = (kategorien_liste[0] if kategorien_liste else "").strip()
    # Mapping zu unseren VALID_KATEGORIEN
    kat_lower = erste_kat.lower()
    kat_map = {
        "innentür": "Innentür", "innentuer": "Innentür",
        "fenster": "Fenster",
        "haustür": "Haustür", "haustuer": "Haustür",
        "schiebetür": "Schiebetür", "schiebetuer": "Schiebetür",
    }
    kategorie = kat_map.get(kat_lower, "Sonstiges")

    titel = (payload.titel or "").strip()
    if not titel:
        titel = f"Anfrage {kategorie}" if kategorien_liste else "Neues Projekt"

    # Bilder uebernehmen (Kopie der photos-Eintraege als bilder)
    # Nur beim ERSTEN Projekt eines Kunden – weitere Projekte starten ohne Bilder.
    bilder = []
    if payload.bilder_uebernehmen and is_first_projekt:
        for p in (k.get("photos") or []):
            url = p.get("url") or p.get("path") or ""
            if not url:
                continue
            bilder.append({
                "id": str(uuid.uuid4()),
                "url": url,
                "filename": p.get("filename") or p.get("name") or "anfrage.jpg",
                "kategorie": "schaden",
                "beschreibung": "Aus Kundenanfrage uebernommen",
                "content_type": p.get("content_type") or "image/jpeg",
                "size": p.get("size") or 0,
                "uploaded_by": user.get("username", ""),
                "created_at": now,
                "kopiert_aus_kunde": True,
            })

    projekt = {
        "id": str(uuid.uuid4()),
        "kunde_id": kunde_id,
        "kunde_name": _kunde_display(k),
        "titel": titel,
        "beschreibung": (k.get("nachricht") or "").strip(),
        "kategorie": kategorie,
        "adresse": _projekt_addr_from_kunde(k),
        "status": "Anfrage",
        "notizen": "",
        "bilder": bilder,
        "erledigt_am": None,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("username") or user.get("email") or "admin",
        "portal_freigegeben": False,
        "aus_anfrage": True,  # Marker fuer "aus Kundenanfrage erstellt"
    }
    await db.module_projekte.insert_one(projekt)
    projekt.pop("_id", None)
    logger.info(f"Projekt aus Kunde erstellt: {titel} fuer {projekt['kunde_name']}, "
                f"{len(bilder)} Bild(er) uebernommen")
    return projekt


@router.get("/from-kunde/{kunde_id}/preview")
async def preview_from_kunde(kunde_id: str, user=Depends(get_current_user)):
    """Vorschau: was wuerde uebernommen werden?"""
    k = await _kunde_or_404(kunde_id)
    kategorien_liste = k.get("kategorien") or []
    photos = k.get("photos") or []
    return {
        "kunde_name": _kunde_display(k),
        "adresse": _projekt_addr_from_kunde(k),
        "kategorien": kategorien_liste,
        "nachricht": (k.get("nachricht") or "").strip(),
        "photos_count": len(photos),
        "photos": [{"filename": p.get("filename") or p.get("name") or "?",
                     "url": p.get("url") or p.get("path") or ""} for p in photos[:6]],
    }


# ===================== Werkbank =====================


@router.get("/werkbank/{kunde_id}")
async def werkbank(kunde_id: str, user=Depends(get_current_user)):
    """Liefert Kunde + alle seine Projekte in einem Aufruf fuer die Werkbank-Ansicht."""
    k = await _kunde_or_404(kunde_id)
    projekte = await db.module_projekte.find(
        {"kunde_id": kunde_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    # Photos / Nachricht / Kategorien des Kunden – fuer "aus Anfrage anlegen"-Button
    has_anfrage_daten = bool(
        (k.get("nachricht") or "").strip()
        or (k.get("kategorien") or [])
        or (k.get("photos") or [])
    )
    return {
        "kunde": k,
        "projekte": projekte,
        "stats": {
            "projekte_total": len(projekte),
            "projekte_aktiv": sum(1 for p in projekte if p.get("status") != "Archiv"),
        },
        "has_anfrage_daten": has_anfrage_daten,
    }


