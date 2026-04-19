"""PDF-Archiv (GoBD-konforme Archivierung von Angeboten, Auftragsbestaetigungen, Rechnungen).

Speichert automatisch jede PDF-Version wenn der User das Dokument versendet oder druckt.
Die Archiv-Eintraege haben Verweis auf das Original-Dokument, damit Positionen spaeter
in neue Dokumente uebernommen werden koennen.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import Response
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db, logger
from auth import get_current_user
from utils.storage import put_object, get_object
from utils.pdf_generator import generate_document_pdf

router = APIRouter()

COLL = "pdf_archive"


async def archive_document_pdf(doc_type: str, doc_id: str, trigger: str = "manual"):
    """Erstellt PDF-Snapshot und speichert Metadaten im Archiv.
    trigger: 'sent' | 'printed' | 'downloaded' | 'manual'
    """
    coll_map = {"quote": "quotes", "order": "orders", "invoice": "invoices"}
    if doc_type not in coll_map:
        raise HTTPException(400, "Ungueltiger Dokumenttyp")

    doc = await db[coll_map[doc_type]].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, f"{doc_type} nicht gefunden")

    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    pdf_buffer = generate_document_pdf(doc_type, doc, settings)
    pdf_bytes = pdf_buffer.read()

    number = doc.get("quote_number") or doc.get("order_number") or doc.get("invoice_number") or doc_id[:8]
    customer_name = doc.get("customer_name", "Unbekannt")
    type_labels = {"quote": "Angebot", "order": "Auftragsbestaetigung", "invoice": "Rechnung"}
    filename = f"{type_labels[doc_type]}_{number}.pdf"

    storage_path = f"graupner-suite/pdf-archive/{doc_type}/{doc_id}/{uuid.uuid4()}.pdf"
    result = put_object(storage_path, pdf_bytes, "application/pdf")

    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "doc_type": doc_type,
        "doc_id": doc_id,
        "doc_number": number,
        "customer_id": doc.get("customer_id", ""),
        "customer_name": customer_name,
        "betreff": doc.get("betreff", ""),
        "total_gross": doc.get("total_gross", 0),
        "positions_count": len(doc.get("positions", [])),
        "storage_path": result["path"],
        "filename": filename,
        "size": len(pdf_bytes),
        "trigger": trigger,
        "notes": "",
        "favorite": False,
        "created_at": now,
    }
    await db[COLL].insert_one(entry)
    entry.pop("_id", None)
    logger.info(f"PDF archiviert: {doc_type} {number} ({trigger})")
    return entry


@router.get("/pdf-archive")
async def list_archive(
    doc_type: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    favorite: Optional[bool] = None,
    user=Depends(get_current_user),
):
    q = {}
    if doc_type:
        q["doc_type"] = doc_type
    if customer_id:
        q["customer_id"] = customer_id
    if favorite is not None:
        q["favorite"] = favorite
    if search:
        s = {"$regex": search, "$options": "i"}
        q["$or"] = [{"customer_name": s}, {"doc_number": s}, {"betreff": s}, {"filename": s}]
    items = await db[COLL].find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@router.get("/pdf-archive/stats")
async def archive_stats(user=Depends(get_current_user)):
    total = await db[COLL].count_documents({})
    quote = await db[COLL].count_documents({"doc_type": "quote"})
    order = await db[COLL].count_documents({"doc_type": "order"})
    invoice = await db[COLL].count_documents({"doc_type": "invoice"})
    favorite = await db[COLL].count_documents({"favorite": True})
    return {"total": total, "quote": quote, "order": order, "invoice": invoice, "favorite": favorite}


@router.get("/pdf-archive/{entry_id}/view")
async def view_pdf(entry_id: str, download: bool = Query(False)):
    entry = await db[COLL].find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Archiv-Eintrag nicht gefunden")
    pdf_bytes = get_object(entry["storage_path"])
    if not pdf_bytes:
        raise HTTPException(404, "PDF-Datei fehlt im Storage")
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{entry["filename"]}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.put("/pdf-archive/{entry_id}")
async def update_entry(entry_id: str, body: dict = Body(...), user=Depends(get_current_user)):
    """Aktualisiert favorite und notes. Andere Felder sind nicht aenderbar (GoBD)."""
    allowed = {"favorite", "notes"}
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        raise HTTPException(400, "Keine aktualisierbaren Felder")
    r = await db[COLL].update_one({"id": entry_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    entry = await db[COLL].find_one({"id": entry_id}, {"_id": 0})
    return entry


@router.delete("/pdf-archive/{entry_id}")
async def delete_entry(entry_id: str, user=Depends(get_current_user)):
    """Loeschen mit Warnung - kann bei GoBD-pflichtigen Dokumenten problematisch sein."""
    entry = await db[COLL].find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Nicht gefunden")
    # Hinweis: wir loeschen nur den Metadaten-Eintrag, das PDF bleibt in Storage
    # (Soft-Delete). Fuer echte Loeschung waere put_object delete notwendig.
    await db[COLL].update_one({"id": entry_id}, {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Archiv-Eintrag als geloescht markiert (PDF bleibt erhalten)"}


@router.post("/pdf-archive/apply-to-editor")
async def apply_archive_to_editor(body: dict = Body(...), user=Depends(get_current_user)):
    """Liefert die Positionen + Texte aus den referenzierten Original-Dokumenten zurueck,
    damit der Editor sie uebernehmen kann. Optional werden Positionen aus mehreren
    Archiv-Eintraegen gesammelt.

    body: { entry_ids: [ids], mode: 'replace'|'append' }
    """
    entry_ids = body.get("entry_ids") or []
    if not entry_ids:
        raise HTTPException(400, "Keine Auswahl")

    coll_map = {"quote": "quotes", "order": "orders", "invoice": "invoices"}
    all_positions = []
    betreff_parts = []
    vortext_parts = []
    schlusstext_parts = []
    sources = []

    for eid in entry_ids:
        entry = await db[COLL].find_one({"id": eid}, {"_id": 0})
        if not entry:
            continue
        src = await db[coll_map[entry["doc_type"]]].find_one({"id": entry["doc_id"]}, {"_id": 0})
        if not src:
            # Fallback: wenn Original geloescht wurde, lass den Eintrag aus
            continue
        if src.get("positions"):
            all_positions.extend(src["positions"])
        if src.get("betreff") and not betreff_parts:
            betreff_parts.append(src["betreff"])
        if src.get("vortext"):
            vortext_parts.append(src["vortext"])
        if src.get("schlusstext") and not schlusstext_parts:
            schlusstext_parts.append(src["schlusstext"])
        sources.append({"id": entry["id"], "doc_number": entry["doc_number"], "doc_type": entry["doc_type"]})

    return {
        "positions": all_positions,
        "betreff": " / ".join(betreff_parts),
        "vortext": "\n\n".join(vortext_parts),
        "schlusstext": schlusstext_parts[0] if schlusstext_parts else "",
        "sources": sources,
        "count": len(sources),
    }


# ==================== Manual Trigger (used by auto-archive hook) ====================

@router.post("/pdf-archive/trigger/{doc_type}/{doc_id}")
async def manual_trigger_archive(
    doc_type: str, doc_id: str, trigger: str = Query("manual"),
    user=Depends(get_current_user),
):
    """Manueller Trigger: legt eine PDF-Version im Archiv an. Verhindert Duplikate innerhalb von 5 Minuten."""
    from datetime import timedelta
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    recent = await db[COLL].find_one({
        "doc_type": doc_type,
        "doc_id": doc_id,
        "trigger": trigger,
        "created_at": {"$gte": recent_cutoff},
    }, {"_id": 0})
    if recent:
        return recent
    return await archive_document_pdf(doc_type, doc_id, trigger)
