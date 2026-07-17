"""
Routes für module_objektadressen – Objektadressen und Hausverwaltungen.

Module-First:
- Schreibt NUR in module_objektadressen (eigene Collection)
- Liest optional aus module_kunden (read-only), um den Kundennamen anzuzeigen
- KEIN Eingriff in Kunden / Projekte / Dokumente — reine Lese-/Verwaltungs-Routen
  für dieses Modul. Die Anbindung an Projekt-Anlage und Rechnungen erfolgt
  bewusst NICHT in dieser Datei, sondern erst in einem späteren, separat
  bestätigten Schritt.
"""
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, logger
from routes.auth import get_current_user

router = APIRouter()


# ==================== MODELS ====================

class VerwalterBlock(BaseModel):
    firma: str = ""
    ansprechpartner: str = ""
    strasse: str = ""
    hausnummer: str = ""
    plz: str = ""
    ort: str = ""
    email: str = ""
    telefon: str = ""


class ObjektadresseCreate(BaseModel):
    kunde_id: str
    bezeichnung: str  # z.B. "Wohnung Sylt", wichtig bei mehreren Objekten pro Kunde
    strasse: str = ""
    hausnummer: str = ""
    plz: str = ""
    ort: str = ""
    verwalter: Optional[VerwalterBlock] = None
    rechnung_an_verwalter: bool = False
    notiz: str = ""


class ObjektadresseUpdate(BaseModel):
    bezeichnung: Optional[str] = None
    strasse: Optional[str] = None
    hausnummer: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    verwalter: Optional[VerwalterBlock] = None
    rechnung_an_verwalter: Optional[bool] = None
    notiz: Optional[str] = None
    # kunde_id und referenz werden bewusst NICHT über Update geändert —
    # einmal vergeben, bleiben sie fest (siehe _generate_referenz unten)


# ==================== HELPERS ====================

async def _generate_referenz() -> str:
    """Feste, dauerhafte Referenznummer nach dem mit Ralph abgestimmten Muster:
    <Anlegedatum>-<laufende Nummer für diesen Tag>, z.B. "2026-07-17-01".
    Einmal vergeben, ändert sich diese Referenz nie wieder — jedes Projekt,
    das später zu diesem Objekt/Kunden angelegt wird, kann sich darauf beziehen.
    """
    heute = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    anzahl_heute = await db.module_objektadressen.count_documents(
        {"referenz": {"$regex": f"^{heute}-"}}
    )
    laufende_nummer = anzahl_heute + 1
    return f"{heute}-{laufende_nummer:02d}"


async def _get_or_404(objekt_id: str) -> dict:
    doc = await db.module_objektadressen.find_one({"id": objekt_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Objektadresse nicht gefunden")
    return doc


# ==================== ROUTES ====================

@router.post("/")
async def create_objektadresse(data: ObjektadresseCreate, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    referenz = await _generate_referenz()
    doc = data.model_dump()
    doc["id"] = str(uuid4())
    doc["referenz"] = referenz
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.module_objektadressen.insert_one(doc)
    logger.info(f"Objektadresse angelegt: {referenz} (kunde_id={data.kunde_id})")
    doc.pop("_id", None)
    return doc


@router.get("/")
async def list_objektadressen(kunde_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"kunde_id": kunde_id} if kunde_id else {}
    cursor = db.module_objektadressen.find(query, {"_id": 0}).sort("created_at", 1)
    return [doc async for doc in cursor]


@router.get("/{objekt_id}")
async def get_objektadresse(objekt_id: str, user=Depends(get_current_user)):
    return await _get_or_404(objekt_id)


@router.put("/{objekt_id}")
async def update_objektadresse(objekt_id: str, data: ObjektadresseUpdate, user=Depends(get_current_user)):
    await _get_or_404(objekt_id)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_objektadressen.update_one({"id": objekt_id}, {"$set": update_data})
    return await _get_or_404(objekt_id)


@router.delete("/{objekt_id}")
async def delete_objektadresse(objekt_id: str, user=Depends(get_current_user)):
    await _get_or_404(objekt_id)
    await db.module_objektadressen.delete_one({"id": objekt_id})
    return {"status": "geloescht"}
