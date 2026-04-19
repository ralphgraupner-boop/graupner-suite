from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from database import db, logger
from auth import get_current_user
from uuid import uuid4

router = APIRouter()


class ArtikelLeistungCreate(BaseModel):
    name: str
    artikel_nr: str = ""
    description: str = ""
    typ: str = "Artikel"  # Artikel, Leistung, Fremdleistung
    price_net: float = 0
    ek_preis: float = 0
    aufschlag_1: float = 0
    aufschlag_2: float = 0
    aufschlag_3: float = 0
    vk_preis_1: float = 0
    vk_preis_2: float = 0
    vk_preis_3: float = 0
    unit: str = "Stk."
    subunternehmer: str = ""
    labor_cost: float = 0


class ArtikelLeistungUpdate(BaseModel):
    name: Optional[str] = None
    artikel_nr: Optional[str] = None
    description: Optional[str] = None
    typ: Optional[str] = None
    price_net: Optional[float] = None
    ek_preis: Optional[float] = None
    aufschlag_1: Optional[float] = None
    aufschlag_2: Optional[float] = None
    aufschlag_3: Optional[float] = None
    vk_preis_1: Optional[float] = None
    vk_preis_2: Optional[float] = None
    vk_preis_3: Optional[float] = None
    unit: Optional[str] = None
    subunternehmer: Optional[str] = None
    labor_cost: Optional[float] = None


ARTIKEL_MODUL = {
    "name": "Artikel & Leistungen",
    "slug": "artikel-leistungen",
    "version": "1.0.0",
    "description": "Eigenstaendiges Modul fuer Artikel, Leistungen und Fremdleistungen. Stellt Positionen fuer Angebote, Auftraege und Rechnungen bereit.",
    "status": "aktiv",
    "category": "daten",
    "data_collection": "module_artikel",
    "fields": [
        {"name": "artikel_nr", "type": "text", "label": "Artikel-Nr.", "required": False},
        {"name": "name", "type": "text", "label": "Bezeichnung", "required": True},
        {"name": "description", "type": "textarea", "label": "Beschreibung", "required": False},
        {"name": "typ", "type": "select", "label": "Typ", "options": ["Artikel", "Leistung", "Fremdleistung"], "required": True},
        {"name": "ek_preis", "type": "number", "label": "EK-Preis (Netto)", "required": False},
        {"name": "price_net", "type": "number", "label": "VK-Preis (Netto)", "required": True},
        {"name": "unit", "type": "select", "label": "Einheit", "options": ["Stk.", "Stunde", "m", "m2", "m3", "kg", "Psch.", "km"], "required": True},
        {"name": "subunternehmer", "type": "text", "label": "Subunternehmer", "required": False},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/modules/artikel/data", "description": "Alle Artikel & Leistungen abrufen"},
        {"method": "POST", "path": "/api/modules/artikel/data", "description": "Neuen Artikel/Leistung erstellen"},
        {"method": "PUT", "path": "/api/modules/artikel/data/{id}", "description": "Artikel/Leistung bearbeiten"},
        {"method": "DELETE", "path": "/api/modules/artikel/data/{id}", "description": "Artikel/Leistung loeschen"},
        {"method": "GET", "path": "/api/modules/artikel/export", "description": "Alle Daten exportieren"},
    ],
}


async def ensure_modul_registered():
    existing = await db.modules.find_one({"slug": "artikel-leistungen"})
    if not existing:
        from routes.modules import ModuleSchema
        modul = ModuleSchema(**ARTIKEL_MODUL)
        await db.modules.insert_one(modul.model_dump())
        logger.info("Artikel & Leistungen Modul registriert")


# ==================== KONFIGURATION ====================

DEFAULT_CONFIG = {
    "artikel_prefix": "ArtNr",
    "artikel_start": 2640,
    "leistung_prefix": "Leist",
    "leistung_start": 2660,
    "fremdleistung_prefix": "Fremd",
    "fremdleistung_start": 26000,
}


async def get_config():
    config = await db.module_artikel_config.find_one({"id": "config"}, {"_id": 0})
    if not config:
        config = {"id": "config", **DEFAULT_CONFIG}
        await db.module_artikel_config.insert_one(config)
        config.pop("_id", None)
    return config


async def generate_nummer(typ: str):
    """Generiert die naechste Nummer basierend auf Konfiguration"""
    config = await get_config()

    if typ == "Artikel":
        prefix = config.get("artikel_prefix", "ArtNr")
        start = config.get("artikel_start", 26000)
    elif typ == "Leistung":
        prefix = config.get("leistung_prefix", "Leist")
        start = config.get("leistung_start", 26000)
    else:  # Fremdleistung
        prefix = config.get("fremdleistung_prefix", "Fremd")
        start = config.get("fremdleistung_start", 26000)

    # Finde die hoechste bestehende Nummer fuer diesen Typ
    items = await db.module_artikel.find(
        {"typ": typ, "artikel_nr": {"$regex": f"^{prefix}"}},
        {"_id": 0, "artikel_nr": 1}
    ).to_list(10000)

    max_num = start - 1
    for item in items:
        try:
            num = int(item["artikel_nr"].replace(prefix, ""))
            if num > max_num:
                max_num = num
        except (ValueError, AttributeError):
            pass

    return f"{prefix}{max_num + 1}"


@router.get("/modules/artikel/config")
async def get_artikel_config(user=Depends(get_current_user)):
    return await get_config()


@router.put("/modules/artikel/config")
async def update_artikel_config(data: dict, user=Depends(get_current_user)):
    allowed = ["artikel_prefix", "artikel_start", "leistung_prefix", "leistung_start", "fremdleistung_prefix", "fremdleistung_start"]
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        raise HTTPException(400, "Keine gueltige Konfiguration")
    await db.module_artikel_config.update_one({"id": "config"}, {"$set": update}, upsert=True)
    return await get_config()


@router.get("/modules/artikel/next-number/{typ}")
async def get_next_number(typ: str, user=Depends(get_current_user)):
    """Gibt die naechste verfuegbare Nummer zurueck"""
    if typ not in ["Artikel", "Leistung", "Fremdleistung"]:
        raise HTTPException(400, "Ungueltiger Typ")
    nummer = await generate_nummer(typ)
    return {"nummer": nummer}


@router.get("/modules/artikel/data")
async def get_artikel(user=Depends(get_current_user)):
    await ensure_modul_registered()
    items = await db.module_artikel.find({}, {"_id": 0}).sort("name", 1).to_list(10000)
    return items


@router.get("/modules/artikel/data/{item_id}")
async def get_artikel_item(item_id: str, user=Depends(get_current_user)):
    item = await db.module_artikel.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Nicht gefunden")
    return item


@router.post("/modules/artikel/data")
async def create_artikel(data: ArtikelLeistungCreate, user=Depends(get_current_user)):
    await ensure_modul_registered()
    # Auto-Nummer wenn leer
    artikel_nr = data.artikel_nr
    if not artikel_nr:
        artikel_nr = await generate_nummer(data.typ)
    item = {
        "id": str(uuid4()),
        **data.model_dump(),
        "artikel_nr": artikel_nr,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_artikel.insert_one(item)
    item.pop("_id", None)
    logger.info(f"Artikel erstellt: {artikel_nr} - {data.name} ({data.typ})")
    return item


@router.put("/modules/artikel/data/{item_id}")
async def update_artikel(item_id: str, data: ArtikelLeistungUpdate, user=Depends(get_current_user)):
    existing = await db.module_artikel.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Nicht gefunden")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_artikel.update_one({"id": item_id}, {"$set": update_data})
    updated = await db.module_artikel.find_one({"id": item_id}, {"_id": 0})
    return updated


@router.delete("/modules/artikel/data/{item_id}")
async def delete_artikel(item_id: str, user=Depends(get_current_user)):
    result = await db.module_artikel.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"message": "Geloescht"}


@router.get("/modules/artikel/export")
async def export_artikel(user=Depends(get_current_user)):
    items = await db.module_artikel.find({}, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "artikel-leistungen"}, {"_id": 0})
    return {"module": modul, "data": items, "exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items)}



# ==================== CSV IMPORT ====================

@router.get("/modules/artikel/import-vorlage")
async def download_vorlage():
    """CSV-Vorlage herunterladen"""
    import os
    from fastapi.responses import FileResponse
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "vorlage_artikel_import.csv")

@router.get("/modules/artikel/download-alle")
async def download_alle_artikel():
    """Alle Artikel als CSV herunterladen (ohne Auth)"""
    import os
    from fastapi.responses import FileResponse
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "alle_artikel_zum_import.csv")
    if not os.path.exists(path):
        raise HTTPException(404, "Datei nicht gefunden")
    return FileResponse(path, filename="Alle_Artikel_Graupner.csv", media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=Alle_Artikel_Graupner.csv"})


@router.get("/modules/artikel/export-material-csv")
async def export_material_csv():
    """Export Material CSV aus alter Datenbank"""
    import os
    from fastapi.responses import FileResponse
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "export_material.csv")
    if not os.path.exists(path):
        raise HTTPException(404, "Datei nicht gefunden")
    return FileResponse(path, filename="Material_aus_Altdatenbank.csv", media_type="text/csv")


@router.get("/modules/artikel/export-leistungen-csv")
async def export_leistungen_csv():
    """Export Leistungen CSV aus alter Datenbank"""
    import os
    from fastapi.responses import FileResponse
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "export_leistungen.csv")
    if not os.path.exists(path):
        raise HTTPException(404, "Datei nicht gefunden")
    return FileResponse(path, filename="Leistungen_aus_Altdatenbank.csv", media_type="text/csv")

    return FileResponse(path, filename="vorlage_artikel_import.csv", media_type="text/csv")


@router.post("/modules/artikel/import-csv")
async def import_csv(file: bytes = None, user=Depends(get_current_user)):
    """CSV-Datei importieren"""
    from fastapi import UploadFile, File
    raise HTTPException(400, "Bitte /modules/artikel/import-upload verwenden")


from fastapi import UploadFile, File as FileParam

@router.post("/modules/artikel/import-upload")
async def import_upload(file: UploadFile = FileParam(...), user=Depends(get_current_user)):
    """CSV-Datei mit Artikeln/Leistungen importieren"""
    import csv, io
    content = await file.read()
    # Try different encodings
    for enc in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            text = content.decode(enc)
            break
        except:
            continue
    else:
        raise HTTPException(400, "Datei konnte nicht gelesen werden")

    # Detect delimiter
    delimiter = ";" if ";" in text.split("\n")[0] else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    imported = 0
    skipped = 0
    errors = []
    now = datetime.now(timezone.utc).isoformat()

    for i, row in enumerate(reader):
        try:
            name = (row.get("Name") or row.get("name") or "").strip()
            if not name:
                skipped += 1
                continue

            typ = (row.get("Typ") or row.get("typ") or "Artikel").strip()
            if typ.lower() in ("leistung", "service", "dienstleistung"):
                typ = "Leistung"
            else:
                typ = "Artikel"

            def to_float(val):
                if not val:
                    return 0.0
                return float(str(val).replace(",", ".").strip())

            item = {
                "id": str(uuid4()),
                "name": name,
                "artikel_nr": (row.get("Artikel_Nr") or row.get("artikel_nr") or "").strip(),
                "description": (row.get("Beschreibung") or row.get("description") or "").strip(),
                "typ": typ,
                "unit": (row.get("Einheit") or row.get("unit") or "Stueck").strip(),
                "ek_preis": to_float(row.get("EK_Preis") or row.get("ek_preis")),
                "aufschlag_1": to_float(row.get("Aufschlag_1") or row.get("aufschlag_1")),
                "aufschlag_2": to_float(row.get("Aufschlag_2") or row.get("aufschlag_2")),
                "aufschlag_3": to_float(row.get("Aufschlag_3") or row.get("aufschlag_3")),
                "vk_preis_1": to_float(row.get("VK_Preis_1") or row.get("vk_preis_1")),
                "vk_preis_2": to_float(row.get("VK_Preis_2") or row.get("vk_preis_2")),
                "vk_preis_3": to_float(row.get("VK_Preis_3") or row.get("vk_preis_3")),
                "price_net": to_float(row.get("VK_Preis_1") or row.get("vk_preis_1") or row.get("EK_Preis") or row.get("ek_preis")),
                "subunternehmer": (row.get("Subunternehmer") or "").strip().lower() in ("ja", "yes", "true", "1"),
                "created_at": now,
                "updated_at": now,
            }
            await db.module_artikel.insert_one(item)
            imported += 1
        except Exception as e:
            errors.append(f"Zeile {i+2}: {str(e)}")

    return {
        "message": f"{imported} Artikel/Leistungen importiert",
        "imported": imported,
        "skipped": skipped,
        "errors": errors
    }
