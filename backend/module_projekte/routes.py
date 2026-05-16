"""Projekte-Modul – CRUD + Bilder-Upload."""
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
import uuid

from database import db, logger
from routes.auth import get_current_user

# HEIC/HEIF + Pillow für Resize/Konvertierung
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


# ───────────── Image-Pipeline ─────────────
# Original wird auf 2400 px Längskante begrenzt + JPEG-Q85 → ca. 80 % kleiner
# als typische Smartphone-Aufnahmen. Zusätzlich wird ein Thumbnail (400 px)
# erzeugt, das die Galerie-Tiles ohne Verzögerung lädt. Beide Pfade landen im
# selben module_projekte/<id>/-Ordner und werden in der DB als
# `bild.url` (Original) und `bild.thumb_url` (Thumbnail) gespeichert.
ORIGINAL_MAX_SIDE = 1920
THUMB_MAX_SIDE = 400
JPEG_QUALITY = 85


def _process_image(data: bytes, content_type: str, filename: str) -> tuple[bytes, bytes, str, str]:
    """Liefert (original_bytes, thumb_bytes, mime, ext).

    - HEIC/HEIF → JPEG.
    - Längskante > ORIGINAL_MAX_SIDE → herunterskalieren.
    - Thumbnail mit max. THUMB_MAX_SIDE.
    - Bei Fehler: Rohdaten zurück, ohne Thumbnail (Frontend fällt dann auf
      Original zurück).
    """
    ct = (content_type or "").lower()
    name = (filename or "").lower()
    is_heic = "heic" in ct or "heif" in ct or name.endswith((".heic", ".heif"))
    if not _PIL_OK:
        return data, b"", ct or "image/jpeg", "jpg"
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        # Originals
        orig = img.copy()
        if max(orig.size) > ORIGINAL_MAX_SIDE:
            orig.thumbnail((ORIGINAL_MAX_SIDE, ORIGINAL_MAX_SIDE))
        out_orig = io.BytesIO()
        if is_heic or orig.mode in ("RGBA", "P", "LA"):
            orig = orig.convert("RGB")
            orig.save(out_orig, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            mime, ext = "image/jpeg", "jpg"
        elif orig.format == "PNG":
            orig.save(out_orig, format="PNG", optimize=True)
            mime, ext = "image/png", "png"
        else:
            orig.save(out_orig, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            mime, ext = "image/jpeg", "jpg"
        # Thumbnail (immer JPEG)
        thumb = img.copy()
        thumb = thumb.convert("RGB")
        thumb.thumbnail((THUMB_MAX_SIDE, THUMB_MAX_SIDE))
        out_thumb = io.BytesIO()
        thumb.save(out_thumb, format="JPEG", quality=80, optimize=True)
        return out_orig.getvalue(), out_thumb.getvalue(), mime, ext
    except Exception as e:
        logger.warning(f"Projekt-Bild Pipeline fail ({filename}): {e}")
        return data, b"", ct or "image/jpeg", "jpg"

router = APIRouter()

# ===================== Konstanten =====================
#
# Erlaubte Werte für Status/Kategorie/Bild-Kategorie kommen ausschliesslich aus
# `module_textvorlagen` (doc_type=projekt_status / projekt_kategorie /
# projekt_bild_kategorie). Werte werden zur Laufzeit aus der DB gezogen und
# gegen die Auswahl validiert. Kein Hardcoding mehr (siehe VISION.md, Regel 1).

PROJEKT_STATUS_DOCTYPE = "projekt_status"
PROJEKT_KATEGORIE_DOCTYPE = "projekt_kategorie"
PROJEKT_BILD_KATEGORIE_DOCTYPE = "projekt_bild_kategorie"


async def _allowed_titles(doc_type: str) -> set[str]:
    """Alle gepflegten Auswahl-Titel zu einem doc_type aus module_textvorlagen.
    Liefert leere Menge, wenn nichts gepflegt ist (dann skipped die Validierung
    fail-safe — neue Werte sind erlaubt)."""
    out: set[str] = set()
    async for v in db.module_textvorlagen.find(
        {"doc_type": doc_type},
        {"_id": 0, "title": 1},
    ):
        t = (v.get("title") or "").strip()
        if t:
            out.add(t)
    return out


async def _validate_against_textvorlagen(value: str, doc_type: str, label: str):
    if not value:
        return
    allowed = await _allowed_titles(doc_type)
    if allowed and value not in allowed:
        raise HTTPException(
            400,
            f"Ungültige {label}: {value!r}. Erlaubt sind die in Textvorlagen "
            f"({doc_type}) gepflegten Werte: {sorted(allowed)}",
        )


# ===================== Models =====================


class ProjektCreate(BaseModel):
    kunde_id: str
    titel: str
    beschreibung: Optional[str] = ""
    kategorie: Optional[str] = "Sonstiges"
    adresse: Optional[str] = ""
    status: Optional[str] = "Anfrage"
    notizen: Optional[str] = ""
    # Wenn True und der Kunde hat noch kein Projekt: Photos vom Kunden werden
    # als initiale Projekt-Bilder übernommen (Kategorie 'schaden').
    bilder_uebernehmen: Optional[bool] = False


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
    """Alle Projekte abrufen – kunde_name wird live aus module_kunden geholt (Datenmasken-Prinzip)."""
    query: dict = {}
    if kunde_id:
        query["kunde_id"] = kunde_id
    if status:
        query["status"] = status
    items = await db.module_projekte.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    # Kundennamen live nachladen (Datenmasken-Prinzip)
    kunden_ids = list({p["kunde_id"] for p in items if p.get("kunde_id")})
    kunden_map: dict = {}
    if kunden_ids:
        async for k in db.module_kunden.find(
            {"id": {"$in": kunden_ids}},
            {"_id": 0, "id": 1, "name": 1, "vorname": 1, "nachname": 1, "firma": 1},
        ):
            kunden_map[k["id"]] = _kunde_display(k)

    for item in items:
        item["kunde_name"] = kunden_map.get(item.get("kunde_id", ""), "(Kunde nicht gefunden)")

    return items


@router.get("/counts-by-kunde")
async def counts_by_kunde(user=Depends(get_current_user)):
    """Liefert {kunde_id: anzahl_projekte} für die Kundenliste-Badges.

    Bewusst genauer Pfad statt Path-Param – damit FastAPI das nicht mit
    GET /{projekt_id} verwechselt.
    """
    pipeline = [{"$group": {"_id": "$kunde_id", "n": {"$sum": 1}}}]
    out: dict = {}
    async for row in db.module_projekte.aggregate(pipeline):
        kid = row.get("_id")
        if kid:
            out[kid] = row["n"]
    return out


@router.get("/files/{path:path}")
async def serve_projekt_file(path: str, user=Depends(get_current_user)):
    """Liefert ein im Object-Storage abgelegtes Projekt-Bild aus.

    Frontend speichert in `bild.url` den relativen Storage-Pfad
    (`module_projekte/<id>/<file>`); React Router würde diesen Pfad sonst als
    Frontend-Route interpretieren und das Dashboard zeigen. Dieser Endpoint
    schiebt die Bytes durch — auth-pflichtig, daher kein direkter Browser-Aufruf
    ohne Token. Frontend lädt die Bilder via Axios als Blob und rendert sie
    über `URL.createObjectURL`.
    """
    if ".." in path or path.startswith("/"):
        raise HTTPException(400, "Ungültiger Pfad")
    # Whitelist: Projekt-Uploads + aus Kundenanfragen übernommene Bilder
    if not (path.startswith("module_projekte/") or path.startswith("module_kunden/")):
        raise HTTPException(400, "Pfad ausserhalb erlaubter Bereiche")
    try:
        from utils.storage import get_object
        data, ct = get_object(path)
    except Exception as e:
        logger.error(f"Projekt-Bild laden fehlgeschlagen ({path}): {e}")
        raise HTTPException(404, "Bild nicht gefunden")
    return StreamingResponse(io.BytesIO(data), media_type=ct or "image/jpeg")


@router.post("/migrate-thumbnails")
async def migrate_thumbnails(dry_run: bool = True, limit: int = 200, user=Depends(get_current_user)):
    """Erzeugt für Bestandsbilder Thumbnails (`thumb_url`) nach.

    Lädt das Original aus dem Storage, rechnet Thumbnail (400 px JPEG), legt es
    daneben (Pfad `<orig>.thumb.jpg`) ab und ergänzt das Bild-Subdokument in der
    Projekt-Collection. Originals werden nicht angefasst.

    Standard ist `dry_run=true` – nichts wird verändert. Mit `dry_run=false`
    wird real migriert. `limit` begrenzt die Anzahl pro Aufruf.
    """
    from utils.storage import get_object, put_object

    affected = []
    skipped = 0
    candidates = []
    async for p in db.module_projekte.find(
        {"bilder": {"$exists": True, "$ne": []}},
        {"_id": 0, "id": 1, "titel": 1, "bilder": 1},
    ):
        for b in p.get("bilder") or []:
            url = (b.get("url") or "").strip()
            if not url or not (url.startswith("module_projekte/") or url.startswith("module_kunden/")):
                continue
            if (b.get("thumb_url") or "").strip():
                skipped += 1
                continue
            candidates.append((p["id"], p.get("titel", ""), b))
            if len(candidates) >= max(1, int(limit)):
                break
        if len(candidates) >= max(1, int(limit)):
            break

    for projekt_id, titel, b in candidates:
        info = {"projekt_id": projekt_id, "titel": titel, "bild_id": b.get("id"),
                "filename": b.get("filename"), "url": b.get("url")}
        if dry_run:
            info["status"] = "would_migrate"
            affected.append(info)
            continue
        try:
            data, _ct = get_object(b["url"])
            _orig, thumb_bytes, _mime, _ext = _process_image(
                data, b.get("content_type") or "image/jpeg", b.get("filename") or "bild.jpg",
            )
            if not thumb_bytes:
                info["status"] = "no_thumb_generated"
                affected.append(info)
                continue
            thumb_path = f"{b['url']}.thumb.jpg"
            tres = put_object(thumb_path, thumb_bytes, "image/jpeg")
            thumb_url = tres.get("url") or tres.get("path", thumb_path)
            await db.module_projekte.update_one(
                {"id": projekt_id, "bilder.id": b["id"]},
                {"$set": {"bilder.$.thumb_url": thumb_url}},
            )
            info["status"] = "migrated"
            info["thumb_size"] = len(thumb_bytes)
        except Exception as e:
            logger.error(f"migrate-thumbnails fail für {b.get('url')}: {e}")
            info["status"] = f"error: {e}"
        affected.append(info)

    return {
        "ok": True,
        "dry_run": dry_run,
        "limit": limit,
        "candidates_found": len(candidates),
        "already_have_thumb": skipped,
        "details": affected,
    }


@router.get("/{projekt_id}")
async def get_projekt(projekt_id: str, user=Depends(get_current_user)):
    p = await db.module_projekte.find_one({"id": projekt_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Projekt nicht gefunden")
    # kunde_name live aus module_kunden (Datenmasken-Prinzip)
    if p.get("kunde_id"):
        k = await db.module_kunden.find_one(
            {"id": p["kunde_id"]},
            {"_id": 0, "name": 1, "vorname": 1, "nachname": 1, "firma": 1},
        )
        p["kunde_name"] = _kunde_display(k) if k else "(Kunde nicht gefunden)"
    else:
        p["kunde_name"] = "(kein Kunde)"
    return p


@router.post("/")
async def create_projekt(payload: ProjektCreate, user=Depends(get_current_user)):
    k = await _kunde_or_404(payload.kunde_id)
    await _validate_against_textvorlagen(payload.status, PROJEKT_STATUS_DOCTYPE, "Status")
    await _validate_against_textvorlagen(payload.kategorie, PROJEKT_KATEGORIE_DOCTYPE, "Kategorie")
    now = datetime.now(timezone.utc).isoformat()

    # Bilder-Übernahme aus Kundenanfrage (nur beim ERSTEN Projekt eines Kunden)
    bilder = []
    aus_anfrage = False
    if payload.bilder_uebernehmen:
        existing_count = await db.module_projekte.count_documents({"kunde_id": payload.kunde_id})
        if existing_count == 0:
            for ph in (k.get("photos") or []):
                url = ph.get("url") or ph.get("path") or ""
                if not url:
                    continue
                bilder.append({
                    "id": str(uuid.uuid4()),
                    "url": url,
                    "filename": ph.get("filename") or ph.get("name") or "anfrage.jpg",
                    "kategorie": "schaden",
                    "beschreibung": "Aus Kundenanfrage übernommen",
                    "content_type": ph.get("content_type") or "image/jpeg",
                    "size": ph.get("size") or 0,
                    "uploaded_by": user.get("username", ""),
                    "created_at": now,
                    "kopiert_aus_kunde": True,
                })
            aus_anfrage = bool(bilder)

    projekt = {
        "id": str(uuid.uuid4()),
        "kunde_id": payload.kunde_id,
        "titel": payload.titel.strip(),
        "beschreibung": (payload.beschreibung or "").strip(),
        "kategorie": payload.kategorie or "Sonstiges",
        "adresse": (payload.adresse or "").strip() or _projekt_addr_from_kunde(k),
        "status": payload.status or "Anfrage",
        "notizen": (payload.notizen or "").strip(),
        "bilder": bilder,
        "erledigt_am": None,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("username") or user.get("email") or "admin",
        "portal_freigegeben": False,
        "aus_anfrage": aus_anfrage,
    }
    await db.module_projekte.insert_one(projekt)
    projekt.pop("_id", None)
    projekt["kunde_name"] = _kunde_display(k)
    logger.info(f"Projekt erstellt: {projekt['titel']} fuer {projekt['kunde_name']} ({len(bilder)} Bild(er))")
    return projekt


@router.put("/{projekt_id}")
async def update_projekt(projekt_id: str, payload: ProjektUpdate, user=Depends(get_current_user)):
    existing = await db.module_projekte.find_one({"id": projekt_id})
    if not existing:
        raise HTTPException(404, "Projekt nicht gefunden")
    update = payload.model_dump(exclude_none=True)
    if "status" in update:
        await _validate_against_textvorlagen(update["status"], PROJEKT_STATUS_DOCTYPE, "Status")
    if "kategorie" in update:
        await _validate_against_textvorlagen(update["kategorie"], PROJEKT_KATEGORIE_DOCTYPE, "Kategorie")
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
    await _validate_against_textvorlagen(kategorie, PROJEKT_BILD_KATEGORIE_DOCTYPE, "Bild-Kategorie")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "Datei zu gross (max 15 MB)")

    # Image-Pipeline: Original (max 2400px, Q85) + Thumbnail (400px JPEG)
    orig_bytes, thumb_bytes, mime, ext = _process_image(content, file.content_type or "", file.filename or "")

    try:
        from utils.storage import put_object
        safe_name = (file.filename or "bild").replace(" ", "_")
        if "." in safe_name:
            safe_name = safe_name.rsplit(".", 1)[0]
        prefix = f"module_projekte/{projekt_id}/{uuid.uuid4().hex[:8]}_{safe_name}"
        orig_path = f"{prefix}.{ext}"
        thumb_path = f"{prefix}.thumb.jpg" if thumb_bytes else ""
        result = put_object(orig_path, orig_bytes, mime)
        url = result.get("url") or result.get("path", orig_path)
        thumb_url = ""
        if thumb_bytes:
            tres = put_object(thumb_path, thumb_bytes, "image/jpeg")
            thumb_url = tres.get("url") or tres.get("path", thumb_path)
    except Exception as e:
        logger.error(f"Projekt-Bild-Upload fehlgeschlagen: {e}")
        raise HTTPException(500, "Upload fehlgeschlagen")
    bild = {
        "id": str(uuid.uuid4()),
        "url": url,
        "thumb_url": thumb_url,
        "filename": file.filename,
        "kategorie": kategorie,
        "beschreibung": beschreibung,
        "content_type": mime,
        "size": len(orig_bytes),
        "size_original": len(content),
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
        await _validate_against_textvorlagen(payload["kategorie"], PROJEKT_BILD_KATEGORIE_DOCTYPE, "Bild-Kategorie")
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
    projekt["kunde_name"] = _kunde_display(k)
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


