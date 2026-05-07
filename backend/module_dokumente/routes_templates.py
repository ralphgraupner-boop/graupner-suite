"""Dokument-Vorlagen (Angebote/Auftragsbestaetigungen/Rechnungen als wiederverwendbare Templates)."""
from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.responses import Response
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, logger
from auth import get_current_user
from utils.pdf_generator import generate_document_pdf

router = APIRouter()

# Standard-Mustermann-Daten (einheitlich, fuer anonymisierte Vorlagen)
MUSTERMANN = {
    "customer_name": "Max Mustermann",
    "customer_address": "Musterstraße 1\n12345 Musterstadt",
    "customer_email": "max@mustermann.de",
    "customer_phone": "040-000000",
}


def _source_collection(doc_type: str) -> str:
    return {"quote": "quotes", "order": "orders", "invoice": "invoices"}.get(doc_type)


@router.get("/document-templates")
async def list_templates(doc_type: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if doc_type:
        q["doc_type"] = doc_type
    items = await db.document_templates.find(q, {"_id": 0}).sort("updated_at", -1).to_list(2000)
    return items


@router.get("/document-templates/{tpl_id}")
async def get_template(tpl_id: str, user=Depends(get_current_user)):
    tpl = await db.document_templates.find_one({"id": tpl_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(404, "Vorlage nicht gefunden")
    return tpl


@router.post("/document-templates/from-document")
async def save_as_template(body: dict = Body(...), user=Depends(get_current_user)):
    """Erzeugt eine Vorlage aus einem existierenden Dokument (quote/order/invoice).

    body: {
      doc_type: "quote"|"order"|"invoice",
      source_id: "...",
      name: "Bezeichnung",
      anonymize: true|false
    }
    """
    doc_type = body.get("doc_type")
    source_id = body.get("source_id")
    name = (body.get("name") or "").strip()
    anonymize = bool(body.get("anonymize", True))

    if doc_type not in ("quote", "order", "invoice"):
        raise HTTPException(400, "Ungueltiger Dokumenttyp")
    if not source_id or not name:
        raise HTTPException(400, "source_id und name erforderlich")

    collection = _source_collection(doc_type)
    src = await db[collection].find_one({"id": source_id}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Quelldokument nicht gefunden")

    # Snapshot kopieren und bereinigen
    snap = dict(src)
    snap.pop("id", None)
    snap.pop("created_at", None)
    snap.pop("updated_at", None)
    snap.pop("status", None)
    snap.pop("quote_number", None)
    snap.pop("order_number", None)
    snap.pop("invoice_number", None)
    snap.pop("quote_id", None)
    snap.pop("order_id", None)

    if anonymize:
        snap["customer_id"] = ""
        snap.update(MUSTERMANN)

    now = datetime.now(timezone.utc).isoformat()
    tpl = {
        "id": str(uuid.uuid4()),
        "name": name,
        "doc_type": doc_type,
        "anonymized": anonymize,
        "snapshot": snap,
        "favorite": False,
        "usage_count": 0,
        "last_used_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.document_templates.insert_one(tpl)
    tpl.pop("_id", None)
    return tpl


@router.put("/document-templates/{tpl_id}")
async def update_template(tpl_id: str, body: dict = Body(...), user=Depends(get_current_user)):
    """Erlaubt name, snapshot, favorite zu aendern."""
    allowed = {"name", "snapshot", "favorite", "anonymized"}
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        raise HTTPException(400, "Keine aktualisierbaren Felder")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await db.document_templates.update_one({"id": tpl_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Vorlage nicht gefunden")
    tpl = await db.document_templates.find_one({"id": tpl_id}, {"_id": 0})
    return tpl


@router.delete("/document-templates/{tpl_id}")
async def delete_template(tpl_id: str, user=Depends(get_current_user)):
    r = await db.document_templates.delete_one({"id": tpl_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Vorlage nicht gefunden")
    return {"message": "Geloescht"}


@router.post("/document-templates/{tpl_id}/create-document")
async def create_document_from_template(
    tpl_id: str,
    body: dict = Body(default={}),
    user=Depends(get_current_user),
):
    """Erzeugt aus einer Vorlage ein neues Dokument (quote/order/invoice).

    body: { customer_id: optional }
    Wenn customer_id gegeben ist, werden die Kundendaten aus module_kunden genommen.
    Ansonsten bleibt die Mustermann-Anschrift stehen (oder was gespeichert ist).
    Response: { id, doc_type, edit_url }
    """
    tpl = await db.document_templates.find_one({"id": tpl_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(404, "Vorlage nicht gefunden")

    doc_type = tpl["doc_type"]
    collection = _source_collection(doc_type)
    snap = dict(tpl.get("snapshot") or {})

    # Kundendaten eintragen falls gewuenscht
    customer_id = body.get("customer_id")
    if customer_id:
        customer = await db.module_kunden.find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(404, "Kunde nicht gefunden")
        name = f"{customer.get('vorname', '')} {customer.get('nachname', '')}".strip() or customer.get("name", "Kunde")
        addr_parts = [customer.get("strasse", ""), f"{customer.get('plz', '')} {customer.get('ort', '')}".strip()]
        snap["customer_id"] = customer_id
        snap["customer_name"] = name
        snap["customer_address"] = "\n".join([p for p in addr_parts if p])
        if customer.get("email"):
            snap["customer_email"] = customer["email"]
        if customer.get("phone") or customer.get("telefon"):
            snap["customer_phone"] = customer.get("phone") or customer.get("telefon", "")

    # Neue Nummer via Counter
    if doc_type == "quote":
        counter = await db.counters.find_one_and_update(
            {"_id": "quote_number"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
        )
        snap["quote_number"] = f"ANG-{datetime.now().year}-{str(counter['seq']).zfill(4)}"
    elif doc_type == "order":
        counter = await db.counters.find_one_and_update(
            {"_id": "order_number"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
        )
        snap["order_number"] = f"AB-{datetime.now().year}-{str(counter['seq']).zfill(4)}"
    else:
        counter = await db.counters.find_one_and_update(
            {"_id": "invoice_number"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
        )
        snap["invoice_number"] = f"RE-{datetime.now().year}-{str(counter['seq']).zfill(4)}"

    snap["id"] = str(uuid.uuid4())
    snap["status"] = "Entwurf" if doc_type != "invoice" else "offen"
    now = datetime.now(timezone.utc).isoformat()
    snap["created_at"] = now
    snap["updated_at"] = now

    await db[collection].insert_one(snap)

    # Usage stats
    await db.document_templates.update_one(
        {"id": tpl_id},
        {"$inc": {"usage_count": 1}, "$set": {"last_used_at": now}}
    )

    edit_map = {"quote": f"/quotes/edit/{snap['id']}", "order": f"/orders/edit/{snap['id']}", "invoice": f"/invoices/edit/{snap['id']}"}
    return {"id": snap["id"], "doc_type": doc_type, "edit_url": edit_map[doc_type]}
