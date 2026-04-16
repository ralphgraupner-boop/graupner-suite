from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from typing import List, Optional
from database import db, logger
from auth import get_current_user
from datetime import datetime, timezone
from uuid import uuid4

router = APIRouter()

KUNDEN_MODUL = {
    "name": "Kunden-Modul",
    "slug": "kunden",
    "version": "1.0.0",
    "description": "Eigenstaendiges Kunden-Modul. Verwaltet Kundendaten, Dateien und Bilder. Bezieht und liefert Daten an Kontakt-Modul und Dokumente-Modul.",
    "status": "aktiv",
    "category": "daten",
    "data_collection": "module_kunden",
    "fields": [
        {"name": "anrede", "type": "select", "label": "Anrede", "options": ["Herr", "Frau", "Divers"]},
        {"name": "vorname", "type": "text", "label": "Vorname", "required": True},
        {"name": "nachname", "type": "text", "label": "Nachname", "required": True},
        {"name": "firma", "type": "text", "label": "Firma"},
        {"name": "email", "type": "text", "label": "E-Mail"},
        {"name": "phone", "type": "text", "label": "Telefon"},
        {"name": "strasse", "type": "text", "label": "Strasse"},
        {"name": "hausnummer", "type": "text", "label": "Hausnummer"},
        {"name": "plz", "type": "text", "label": "PLZ"},
        {"name": "ort", "type": "text", "label": "Ort"},
        {"name": "customer_type", "type": "select", "label": "Kundentyp", "options": ["Privat", "Firma", "Vermieter", "Mieter", "Gewerblich", "Hausverwaltung"]},
        {"name": "status", "type": "select", "label": "Status", "options": ["Neu", "Angebot erstellt", "Auftrag erteilt", "In Bearbeitung", "Abgeschlossen"]},
        {"name": "categories", "type": "multi-select", "label": "Kategorien"},
        {"name": "notes", "type": "textarea", "label": "Notizen"},
        {"name": "photos", "type": "file-upload", "label": "Dateien", "max": 10},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/modules/kunden/data", "description": "Alle Kunden abrufen"},
        {"method": "POST", "path": "/api/modules/kunden/data", "description": "Neuen Kunden erstellen"},
        {"method": "PUT", "path": "/api/modules/kunden/data/{id}", "description": "Kunden bearbeiten"},
        {"method": "DELETE", "path": "/api/modules/kunden/data/{id}", "description": "Kunden loeschen"},
        {"method": "POST", "path": "/api/modules/kunden/import-vcf", "description": "VCF importieren"},
        {"method": "POST", "path": "/api/modules/kunden/data/{id}/upload", "description": "Dateien hochladen"},
        {"method": "DELETE", "path": "/api/modules/kunden/data/{id}/files/{index}", "description": "Datei loeschen"},
        {"method": "GET", "path": "/api/modules/kunden/export", "description": "Alle Daten exportieren"},
    ],
    "dependencies": [],
}


def parse_vcf(content: str) -> dict:
    data = {"name": "", "vorname": "", "nachname": "", "email": "", "phone": "", "address": "",
            "anrede": "", "firma": "", "notes": "", "customer_type": "Privat",
            "strasse": "", "hausnummer": "", "plz": "", "ort": ""}
    lines = content.replace("\r\n ", "").replace("\r\n\t", "").split("\r\n")
    if len(lines) <= 1:
        lines = content.replace("\n ", "").replace("\n\t", "").split("\n")
    for line in lines:
        line = line.strip()
        if not line or line in ("BEGIN:VCARD", "END:VCARD"):
            continue
        if line.startswith("N:") or line.startswith("N;"):
            parts = line.split(":", 1)[1].split(";")
            family = parts[0].strip() if len(parts) > 0 else ""
            given = parts[1].strip() if len(parts) > 1 else ""
            prefix = parts[3].strip() if len(parts) > 3 else ""
            if prefix in ("Herr", "Frau"):
                data["anrede"] = prefix
            data["vorname"] = given
            data["nachname"] = family
            data["name"] = f"{given} {family}".strip()
        elif line.startswith("FN:") or line.startswith("FN;"):
            fn = line.split(":", 1)[1].strip()
            if not data["name"]:
                data["name"] = fn
        elif line.startswith("EMAIL"):
            data["email"] = line.split(":", 1)[1].strip()
        elif line.startswith("TEL"):
            tel = line.split(":", 1)[1].strip()
            if tel:
                if "mobile" in line.lower():
                    data["phone"] = tel
                elif not data["phone"]:
                    data["phone"] = tel
        elif line.startswith("ADR"):
            parts = line.split(":", 1)[1].split(";")
            street = parts[2].strip() if len(parts) > 2 else ""
            city = parts[3].strip() if len(parts) > 3 else ""
            plz = parts[5].strip() if len(parts) > 5 else ""
            data["strasse"] = street
            data["ort"] = city
            data["plz"] = plz
            addr_parts = [p for p in [street, f"{plz} {city}".strip()] if p]
            data["address"] = ", ".join(addr_parts)
        elif line.startswith("ORG:"):
            org = line.split(":", 1)[1].strip()
            if org and org not in ("Herr", "Frau", "Divers"):
                data["firma"] = org
    return data


async def ensure_modul_registered():
    existing = await db.modules.find_one({"slug": "kunden"})
    if not existing:
        from routes.modules import ModuleSchema
        modul = ModuleSchema(**KUNDEN_MODUL)
        await db.modules.insert_one(modul.model_dump())
        logger.info("Kunden-Modul registriert")


@router.get("/modules/kunden/data")
async def get_kunden(user=Depends(get_current_user)):
    await ensure_modul_registered()
    items = await db.module_kunden.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return items


@router.get("/modules/kunden/data/{kunde_id}")
async def get_kunde(kunde_id: str, user=Depends(get_current_user)):
    item = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Kunde nicht gefunden")
    return item


@router.post("/modules/kunden/data")
async def create_kunde(data: dict, user=Depends(get_current_user)):
    await ensure_modul_registered()
    name = f"{data.get('vorname', '')} {data.get('nachname', '')}".strip() or data.get('firma', 'Unbekannt')
    address = f"{data.get('strasse', '')} {data.get('hausnummer', '')}, {data.get('plz', '')} {data.get('ort', '')}".strip().strip(",").strip()
    item = {
        "id": str(uuid4()),
        "name": name,
        "vorname": data.get("vorname", ""),
        "nachname": data.get("nachname", ""),
        "anrede": data.get("anrede", ""),
        "firma": data.get("firma", ""),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "strasse": data.get("strasse", ""),
        "hausnummer": data.get("hausnummer", ""),
        "plz": data.get("plz", ""),
        "ort": data.get("ort", ""),
        "address": address,
        "customer_type": data.get("customer_type", "Privat"),
        "status": data.get("status", "Neu"),
        "categories": data.get("categories", []),
        "notes": data.get("notes", ""),
        "photos": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_kunden.insert_one(item)
    item.pop("_id", None)
    logger.info(f"Kunde erstellt: {name}")
    return item


@router.put("/modules/kunden/data/{kunde_id}")
async def update_kunde(kunde_id: str, data: dict, user=Depends(get_current_user)):
    existing = await db.module_kunden.find_one({"id": kunde_id})
    if not existing:
        raise HTTPException(404, "Kunde nicht gefunden")
    update = {k: v for k, v in data.items() if k != "id" and k != "_id" and v is not None}
    # Auto-generate name and address
    vorname = update.get("vorname", existing.get("vorname", ""))
    nachname = update.get("nachname", existing.get("nachname", ""))
    if vorname or nachname:
        update["name"] = f"{vorname} {nachname}".strip()
    strasse = update.get("strasse", existing.get("strasse", ""))
    hausnummer = update.get("hausnummer", existing.get("hausnummer", ""))
    plz = update.get("plz", existing.get("plz", ""))
    ort = update.get("ort", existing.get("ort", ""))
    if strasse or plz or ort:
        update["address"] = f"{strasse} {hausnummer}, {plz} {ort}".strip().strip(",").strip()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_kunden.update_one({"id": kunde_id}, {"$set": update})
    updated = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0})
    return updated


@router.delete("/modules/kunden/data/{kunde_id}")
async def delete_kunde(kunde_id: str, user=Depends(get_current_user)):
    result = await db.module_kunden.delete_one({"id": kunde_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"message": "Kunde geloescht"}


@router.post("/modules/kunden/import-vcf")
async def import_vcf_kunde(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.filename.lower().endswith(".vcf"):
        raise HTTPException(400, "Nur .vcf Dateien erlaubt")
    content = (await file.read()).decode("utf-8", errors="ignore")
    data = parse_vcf(content)
    if not data.get("vorname") and not data.get("nachname") and not data["name"]:
        raise HTTPException(400, "Kein Name in der VCF-Datei gefunden")
    # Create via module
    item = {
        "id": str(uuid4()),
        **data,
        "status": "Neu",
        "categories": [],
        "photos": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_kunden.insert_one(item)
    item.pop("_id", None)
    logger.info(f"VCF-Import Kunde: {data['vorname']} {data['nachname']}")
    return item


@router.post("/modules/kunden/data/{kunde_id}/upload")
async def upload_kunde_files(kunde_id: str, files: List[UploadFile] = File(...), user=Depends(get_current_user)):
    kunde = await db.module_kunden.find_one({"id": kunde_id})
    if not kunde:
        raise HTTPException(404, "Kunde nicht gefunden")
    MAX_FILES = 10
    MAX_SIZE = 10 * 1024 * 1024
    current_files = kunde.get("photos", [])
    if len(current_files) + len(files) > MAX_FILES:
        raise HTTPException(400, f"Max {MAX_FILES} Dateien erlaubt")
    uploaded = []
    try:
        from utils.storage import put_object
        from utils.image_compress import compress_image
        import uuid as _uuid
        for file in files:
            content = await file.read()
            if len(content) > MAX_SIZE:
                raise HTTPException(400, f"Datei {file.filename} zu gross (max 10 MB)")
            # Bilder komprimieren
            ct = file.content_type or "application/octet-stream"
            fname = file.filename or "datei"
            content, ct, fname = compress_image(content, ct, fname)
            safe_name = fname.replace(" ", "_")
            path = f"module_kunden/{kunde_id}/{_uuid.uuid4().hex[:8]}_{safe_name}"
            result = put_object(path, content, ct)
            url = result.get("url") or result.get("path") if result else None
            if url:
                uploaded.append({"url": url, "filename": fname, "content_type": ct, "size": len(content)})
    except Exception as e:
        logger.error(f"Upload-Fehler: {e}")
        raise HTTPException(500, f"Upload-Fehler: {str(e)}")
    all_files = current_files + uploaded
    await db.module_kunden.update_one({"id": kunde_id}, {"$set": {"photos": all_files}})
    return {"message": f"{len(uploaded)} Datei(en) hochgeladen", "uploaded": uploaded, "total_files": len(all_files)}


@router.delete("/modules/kunden/data/{kunde_id}/files/{file_index}")
async def delete_kunde_file(kunde_id: str, file_index: int, user=Depends(get_current_user)):
    kunde = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0})
    if not kunde:
        raise HTTPException(404, "Kunde nicht gefunden")
    files = kunde.get("photos", [])
    if file_index < 0 or file_index >= len(files):
        raise HTTPException(404, "Datei nicht gefunden")
    files.pop(file_index)
    await db.module_kunden.update_one({"id": kunde_id}, {"$set": {"photos": files}})
    return {"message": "Datei geloescht", "remaining_files": len(files)}


@router.get("/modules/kunden/export")
async def export_kunden(user=Depends(get_current_user)):
    items = await db.module_kunden.find({}, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "kunden"}, {"_id": 0})
    return {"module": modul, "data": items, "exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items)}



# ==================== MODUL-VERKNUEPFUNGEN ====================

@router.post("/modules/kunden/from-kontakt/{kontakt_id}")
async def import_from_kontakt(kontakt_id: str, user=Depends(get_current_user)):
    """Kontakt aus dem Kontakt-Modul als Kunde uebernehmen"""
    kontakt = await db.module_kontakt.find_one({"id": kontakt_id}, {"_id": 0})
    if not kontakt:
        raise HTTPException(404, "Kontakt nicht gefunden")
    # Pruefen ob bereits importiert (per E-Mail oder Vorname+Nachname)
    query_or = []
    if kontakt.get("email"):
        query_or.append({"email": kontakt["email"]})
    if kontakt.get("vorname") and kontakt.get("nachname"):
        query_or.append({"vorname": kontakt["vorname"], "nachname": kontakt["nachname"]})
    if query_or:
        existing = await db.module_kunden.find_one({"$or": query_or}, {"_id": 0})
        if existing:
            return {"message": "Kontakt bereits als Kunde vorhanden", "kunde": existing, "already_exists": True}
    # Neuen Kunden erstellen
    name = f"{kontakt.get('vorname', '')} {kontakt.get('nachname', '')}".strip() or kontakt.get('firma', 'Unbekannt')
    strasse = kontakt.get("strasse", "")
    hausnummer = kontakt.get("hausnummer", "")
    plz = kontakt.get("plz", "")
    ort = kontakt.get("ort", "")
    address = f"{strasse} {hausnummer}, {plz} {ort}".strip().strip(",").strip()
    kunde = {
        "id": str(uuid4()),
        "name": name,
        "vorname": kontakt.get("vorname", ""),
        "nachname": kontakt.get("nachname", ""),
        "anrede": kontakt.get("anrede", ""),
        "firma": kontakt.get("firma", ""),
        "email": kontakt.get("email", ""),
        "phone": kontakt.get("phone", ""),
        "strasse": strasse,
        "hausnummer": hausnummer,
        "plz": plz,
        "ort": ort,
        "address": address,
        "customer_type": kontakt.get("customer_type", "Privat"),
        "status": "Neu",
        "categories": kontakt.get("categories", []),
        "notes": kontakt.get("notes", ""),
        "photos": [],
        "source_kontakt_id": kontakt_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_kunden.insert_one(kunde)
    kunde.pop("_id", None)
    logger.info(f"Kontakt -> Kunde: {name}")
    return {"message": f"Kontakt '{name}' als Kunde uebernommen", "kunde": kunde, "already_exists": False}
