"""
Dokumente v2 – Admin-Routes (CRUD, Settings, Issue, Cancel)
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import io

from database import db, logger
from auth import get_current_user
from .models import (
    Dokument,
    DokumentCreate,
    DokumentUpdate,
    DokumentConvert,
    DokumenteV2Settings,
    DokumenteV2SettingsUpdate,
    STRICT_TYPES,
)
from .numbers import issue_number
from .pdf import generate_pdf

router = APIRouter(prefix="/admin")

SETTINGS_ID = "default"


# ============== SETTINGS ==============

async def _get_settings_doc() -> dict:
    doc = await db.dokumente_v2_settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if not doc:
        defaults = DokumenteV2Settings().model_dump()
        defaults["id"] = SETTINGS_ID
        await db.dokumente_v2_settings.insert_one(defaults)
        defaults.pop("_id", None)
        return defaults
    return doc


@router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    doc = await _get_settings_doc()
    doc.pop("id", None)
    return doc


@router.put("/settings")
async def update_settings(update: DokumenteV2SettingsUpdate, user=Depends(get_current_user)):
    await _get_settings_doc()
    changes = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
    if not changes:
        return await get_settings(user)
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.dokumente_v2_settings.update_one({"id": SETTINGS_ID}, {"$set": changes})
    logger.info(f"Dokumente v2 Settings aktualisiert: {list(changes.keys())}")
    return await get_settings(user)


# ============== BERECHNUNG ==============

def _calc_totals(positions: list[dict]) -> dict:
    netto = 0.0
    mwst = 0.0
    lohn_netto = 0.0
    for p in positions or []:
        menge = float(p.get("menge") or 0)
        preis = float(p.get("einzelpreis") or 0)
        rabatt = float(p.get("rabatt_prozent") or 0)
        mwst_satz = float(p.get("mwst_satz") or 0)
        zeile_netto = menge * preis * (1 - rabatt / 100.0)
        zeile_mwst = zeile_netto * mwst_satz / 100.0
        netto += zeile_netto
        mwst += zeile_mwst
        lohn_anteil_prozent = float(p.get("lohn_anteil") or 0)
        lohn_netto += zeile_netto * lohn_anteil_prozent / 100.0
    return {
        "netto": round(netto, 2),
        "mwst": round(mwst, 2),
        "brutto": round(netto + mwst, 2),
        "lohn_netto": round(lohn_netto, 2),
    }


# ============== LIST / GET ==============

@router.get("/dokumente")
async def list_dokumente(
    type: str | None = None,
    status: str | None = None,
    search: str = "",
    limit: int = 500,
    user=Depends(get_current_user),
):
    q: dict = {}
    if type:
        q["type"] = type
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"nummer": {"$regex": search, "$options": "i"}},
            {"kunde_name": {"$regex": search, "$options": "i"}},
            {"betreff": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.dokumente_v2.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@router.get("/dokumente/{doc_id}")
async def get_dokument(doc_id: str, user=Depends(get_current_user)):
    doc = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nicht gefunden")
    return doc


# ============== CREATE (als Entwurf) ==============

@router.post("/dokumente")
async def create_dokument(payload: DokumentCreate, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    positions = [p.model_dump() for p in (payload.positions or [])]
    totals = _calc_totals(positions)
    doc = {
        **Dokument(
            type=payload.type,
            status="entwurf",
            kunde_id=payload.kunde_id,
            kunde_name=payload.kunde_name or "",
            kunde_adresse=payload.kunde_adresse or "",
            kunde_email=payload.kunde_email or "",
            betreff=payload.betreff or "",
            vortext=payload.vortext or "",
            schlusstext=payload.schlusstext or "",
            positions=payload.positions or [],
            parent_id=payload.parent_id,
        ).model_dump(),
        **totals,
        "created_at": now,
        "updated_at": now,
    }
    await db.dokumente_v2.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"Dokumente v2: Entwurf angelegt type={payload.type} id={doc['id']}")
    return doc


# ============== UPDATE (nur Entwuerfe aenderbar, strenge Typen nach Issue NICHT mehr) ==============

@router.put("/dokumente/{doc_id}")
async def update_dokument(doc_id: str, update: DokumentUpdate, user=Depends(get_current_user)):
    existing = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Nicht gefunden")

    # GoBD: strenge Typen (Rechnung/Gutschrift) nach Issue nicht mehr aenderbar
    if existing["type"] in STRICT_TYPES and existing.get("status") in ("erstellt", "storniert"):
        raise HTTPException(409, "Rechnungen/Gutschriften können nach Erstellung nicht mehr geändert werden (GoBD)")

    changes = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
    if "positions" in changes:
        positions_data = [p if isinstance(p, dict) else p.model_dump() for p in changes["positions"]]
        changes["positions"] = positions_data
        changes.update(_calc_totals(positions_data))
    if not changes:
        return existing
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.dokumente_v2.update_one({"id": doc_id}, {"$set": changes})
    return await get_dokument(doc_id, user)


# ============== ISSUE (Nummer vergeben, Status -> erstellt) ==============

@router.post("/dokumente/{doc_id}/issue")
async def issue_dokument(doc_id: str, user=Depends(get_current_user)):
    doc = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nicht gefunden")
    if doc.get("status") == "erstellt":
        raise HTTPException(409, f"Dokument bereits erstellt mit Nummer {doc.get('nummer')}")
    if doc.get("status") == "storniert":
        raise HTTPException(409, "Storniertes Dokument kann nicht erneut ausgestellt werden")

    # Nummer atomar vergeben
    number = await issue_number(doc["type"], user, doc["id"])
    now = datetime.now(timezone.utc).isoformat()
    await db.dokumente_v2.update_one(
        {"id": doc_id},
        {"$set": {
            "nummer": number,
            "status": "erstellt",
            "issued_at": now,
            "issued_by": (user or {}).get("username") or "unknown",
            "updated_at": now,
        }},
    )
    return await get_dokument(doc_id, user)


# ============== DELETE (nur Entwuerfe oder nicht-strenge Typen) ==============

@router.delete("/dokumente/{doc_id}")
async def delete_dokument(doc_id: str, user=Depends(get_current_user)):
    doc = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nicht gefunden")
    # GoBD: Rechnungen/Gutschriften mit Nummer koennen nicht geloescht werden
    if doc["type"] in STRICT_TYPES and doc.get("status") == "erstellt":
        raise HTTPException(409, "Rechnungen/Gutschriften müssen storniert statt gelöscht werden (GoBD)")
    await db.dokumente_v2.delete_one({"id": doc_id})
    logger.info(f"Dokumente v2 geloescht: {doc_id} (status={doc.get('status')})")
    return {"deleted": True, "id": doc_id}


# ============== CANCEL (Storno fuer strenge Typen) ==============

@router.post("/dokumente/{doc_id}/cancel")
async def cancel_dokument(doc_id: str, reason: str = "", user=Depends(get_current_user)):
    doc = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nicht gefunden")
    if doc.get("status") == "storniert":
        raise HTTPException(409, "Bereits storniert")
    now = datetime.now(timezone.utc).isoformat()
    await db.dokumente_v2.update_one(
        {"id": doc_id},
        {"$set": {
            "status": "storniert",
            "canceled_at": now,
            "canceled_by": (user or {}).get("username") or "unknown",
            "cancel_reason": reason or "",
            "updated_at": now,
        }},
    )
    logger.info(f"Dokumente v2 storniert: {doc_id} reason={reason!r}")
    return await get_dokument(doc_id, user)


# ============== PDF ==============

@router.get("/dokumente/{doc_id}/pdf")
async def pdf_dokument(doc_id: str, user=Depends(get_current_user)):
    doc = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nicht gefunden")
    pdf_bytes = await generate_pdf(doc)
    filename = f"{doc.get('type', 'dokument')}_{doc.get('nummer') or 'entwurf'}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ============== PORTAL V4 FREIGABE (Sandbox-Anbindung) ==============

@router.patch("/dokumente/{doc_id}/portal-v4-freigabe")
async def toggle_portal_v4_freigabe(doc_id: str, freigegeben: bool, user=Depends(get_current_user)):
    """Schaltet die Sichtbarkeit des Dokuments im Kundenportal v4 (Sandbox) um."""
    doc = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nicht gefunden")
    now = datetime.now(timezone.utc).isoformat()
    await db.dokumente_v2.update_one(
        {"id": doc_id},
        {"$set": {
            "portal_v4_freigegeben": bool(freigegeben),
            "portal_v4_freigegeben_at": now if freigegeben else None,
            "portal_v4_freigegeben_by": (user or {}).get("username") or "unknown" if freigegeben else None,
            "updated_at": now,
        }},
    )
    logger.info(f"Dokumente v2 Portal-v4-Freigabe={freigegeben} fuer {doc_id}")
    return await get_dokument(doc_id, user)


# ============== CONVERT (State-Machine: Angebot -> AB -> Rechnung, Rechnung -> Gutschrift) ==============

# Erlaubte Uebergaenge: source -> {allowed target_types}
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "angebot": {"auftrag", "rechnung"},          # Angebot kann zu AB oder direkt zu Rechnung
    "auftrag": {"rechnung"},                     # AB kann zur Rechnung werden
    "rechnung": {"gutschrift"},                  # Rechnung kann zu Gutschrift werden (Storno)
    "gutschrift": set(),                         # Gutschriften sind Endstation
}


@router.post("/dokumente/{doc_id}/convert")
async def convert_dokument(doc_id: str, payload: DokumentConvert, user=Depends(get_current_user)):
    """Erstellt ein neues Dokument aus einem bestehenden (Kopie mit parent_id)."""
    source = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not source:
        raise HTTPException(404, "Quell-Dokument nicht gefunden")
    if source.get("status") == "storniert":
        raise HTTPException(409, "Stornierte Dokumente koennen nicht umgewandelt werden")

    src_type = source["type"]
    tgt_type = payload.target_type
    allowed = ALLOWED_TRANSITIONS.get(src_type, set())
    if tgt_type not in allowed:
        raise HTTPException(
            409,
            f"Umwandlung {src_type} -> {tgt_type} nicht erlaubt. Erlaubt: {sorted(allowed) or 'keine'}",
        )

    now = datetime.now(timezone.utc).isoformat()
    # Positionen-Kopie: neue IDs vergeben, Inhalt 1:1 uebernehmen
    from uuid import uuid4
    new_positions = []
    for p in source.get("positions") or []:
        new_pos = dict(p)
        new_pos["id"] = str(uuid4())
        new_positions.append(new_pos)

    new_doc = Dokument(
        type=tgt_type,
        status="entwurf",
        kunde_id=source.get("kunde_id"),
        kunde_name=source.get("kunde_name", ""),
        kunde_adresse=source.get("kunde_adresse", ""),
        kunde_email=source.get("kunde_email", ""),
        betreff=source.get("betreff", ""),
        vortext=source.get("vortext", ""),
        schlusstext=source.get("schlusstext", ""),
        positions=[],  # wird unten gesetzt (als dicts, nicht Position-Objekte)
        parent_id=source["id"],
    ).model_dump()
    new_doc["positions"] = new_positions
    new_doc.update(_calc_totals(new_positions))
    new_doc["created_at"] = now
    new_doc["updated_at"] = now

    await db.dokumente_v2.insert_one(new_doc)
    new_doc.pop("_id", None)
    logger.info(f"Dokumente v2 Convert: {src_type}({doc_id}) -> {tgt_type}({new_doc['id']})")
    return new_doc


@router.get("/dokumente/{doc_id}/chain")
async def get_chain(doc_id: str, user=Depends(get_current_user)):
    """Liefert Vorgaenger (parent) + Nachfolger (children) des Dokuments."""
    doc = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nicht gefunden")
    parent = None
    if doc.get("parent_id"):
        parent = await db.dokumente_v2.find_one(
            {"id": doc["parent_id"]},
            {"_id": 0, "id": 1, "type": 1, "nummer": 1, "status": 1, "betreff": 1, "created_at": 1},
        )
    children = await db.dokumente_v2.find(
        {"parent_id": doc_id},
        {"_id": 0, "id": 1, "type": 1, "nummer": 1, "status": 1, "betreff": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(100)
    return {"parent": parent, "children": children}


# ============== KUNDEN LOOKUP (nur lesend aus module_kunden) ==============

@router.get("/kunden-suche")
async def kunden_suche(q: str = "", limit: int = 20, user=Depends(get_current_user)):
    """Sucht in module_kunden, liefert nur ein paar Felder (lesend, niemals schreiben)."""
    query = {}
    if q:
        query = {
            "$or": [
                {"vorname": {"$regex": q, "$options": "i"}},
                {"nachname": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}},
                {"firma": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}},
            ]
        }
    kunden = await db.module_kunden.find(query, {
        "_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1, "firma": 1,
        "email": 1, "strasse": 1, "hausnummer": 1, "plz": 1, "ort": 1, "anrede": 1,
    }).limit(limit).to_list(limit)
    return kunden
