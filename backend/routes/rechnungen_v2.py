"""
Rechnungen v2 - Experimentelles GoBD-konformes Rechnungs-Modul
Separate Collection, eigener Nummernkreis, komplett isoliert von bestehenden Rechnungen.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone
from uuid import uuid4

from database import db, logger
from auth import get_current_user

router = APIRouter(prefix="/api/v2", tags=["rechnungen-v2"])

# ============== MODELS ==============

class Position(BaseModel):
    pos_nr: int = 0
    type: Literal["position", "titel"] = "position"
    description: str = ""
    quantity: float = 1
    unit: str = "Stk."
    price_net: float = 0

class RechnungV2Create(BaseModel):
    customer_id: str
    auftrag_id: Optional[str] = None
    angebot_id: Optional[str] = None
    mode: Literal["kurz", "voll"] = "voll"  # Kurz-Rechnung (Verweis) oder Vollrechnung
    betreff: str = ""
    verweis_text: Optional[str] = None  # z.B. "Leistungen gemaess AB Nr. AB-2026-0015 vom 20.03.2026"
    kurz_leistungstext: Optional[str] = None  # z.B. "Einbau Schiebetuer"
    leistungsdatum: str  # "2026-04-15" oder "2026-04-01 bis 2026-04-15"
    positions: List[Position] = []  # bei mode=voll gefuellt, bei mode=kurz leer
    vortext: str = ""
    schlusstext: str = ""
    discount: float = 0
    discount_type: Literal["amount", "percent"] = "amount"
    vat_rate: float = 19.0
    deposit_amount: float = 0  # Anzahlung
    due_days: int = 14
    show_lohnanteil: bool = True
    lohnanteil_custom: Optional[float] = None
    kleinbetrag: bool = False  # < 250 EUR brutto = weniger Pflichtfelder

class RechnungV2Update(RechnungV2Create):
    pass

# ============== NUMMER ==============

async def _next_invoice_number():
    year = datetime.now(timezone.utc).year
    # Finde hoechste Nummer im aktuellen Jahr
    prefix = f"RV2-{year}-"
    latest = await db.rechnungen_v2.find_one(
        {"invoice_number": {"$regex": f"^{prefix}"}},
        sort=[("invoice_number", -1)],
        projection={"_id": 0, "invoice_number": 1}
    )
    if latest and latest.get("invoice_number"):
        try:
            n = int(latest["invoice_number"].split("-")[-1])
            return f"{prefix}{n+1:04d}"
        except Exception:
            pass
    return f"{prefix}0001"

# ============== CRUD ==============

@router.get("/rechnungen")
async def list_rechnungen_v2(user=Depends(get_current_user)):
    cursor = db.rechnungen_v2.find({}, {"_id": 0}).sort("created_at", -1)
    return [doc async for doc in cursor]

@router.get("/rechnungen/{rid}")
async def get_rechnung_v2(rid: str, user=Depends(get_current_user)):
    doc = await db.rechnungen_v2.find_one({"id": rid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Rechnung nicht gefunden")
    return doc

@router.post("/rechnungen")
async def create_rechnung_v2(payload: RechnungV2Create, user=Depends(get_current_user)):
    # Kunde laden
    customer = await db.module_kunden.find_one({"id": payload.customer_id}, {"_id": 0}) or \
               await db.customers.find_one({"id": payload.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(404, "Kunde nicht gefunden")

    inv_number = await _next_invoice_number()
    now = datetime.now(timezone.utc)

    # Summen berechnen
    if payload.mode == "voll" and payload.positions:
        subtotal = sum((p.quantity or 0) * (p.price_net or 0) for p in payload.positions if p.type == "position")
    else:
        subtotal = 0  # Bei Kurz-Rechnung muss Nutzer Brutto/Netto selbst eingeben oder wir nutzen discount-Feld als Betrag
        # Convention: bei mode="kurz" wird positions[0] mit einem "Summen-Eintrag" verwendet
        subtotal = sum((p.quantity or 0) * (p.price_net or 0) for p in payload.positions)

    if payload.discount_type == "percent":
        discount_amount = subtotal * (payload.discount / 100)
    else:
        discount_amount = payload.discount
    net_after_discount = max(0, subtotal - discount_amount)
    vat = net_after_discount * (payload.vat_rate / 100)
    brutto = net_after_discount + vat
    final_amount = max(0, brutto - (payload.deposit_amount or 0))

    doc = {
        "id": str(uuid4()),
        "invoice_number": inv_number,
        "customer_id": payload.customer_id,
        "customer_name": customer.get("name") or f"{customer.get('vorname','')} {customer.get('nachname','')}".strip(),
        "customer_snapshot": {
            "name": customer.get("name"),
            "anrede": customer.get("anrede"),
            "address": customer.get("address") or customer.get("anschrift"),
            "plz": customer.get("plz"),
            "ort": customer.get("ort"),
            "email": customer.get("email"),
        },
        "auftrag_id": payload.auftrag_id,
        "angebot_id": payload.angebot_id,
        "mode": payload.mode,
        "betreff": payload.betreff,
        "verweis_text": payload.verweis_text,
        "kurz_leistungstext": payload.kurz_leistungstext,
        "leistungsdatum": payload.leistungsdatum,
        "positions": [p.model_dump() for p in payload.positions],
        "vortext": payload.vortext,
        "schlusstext": payload.schlusstext,
        "discount": payload.discount,
        "discount_type": payload.discount_type,
        "vat_rate": payload.vat_rate,
        "deposit_amount": payload.deposit_amount,
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "net_after_discount": round(net_after_discount, 2),
        "vat": round(vat, 2),
        "brutto": round(brutto, 2),
        "final_amount": round(final_amount, 2),
        "due_days": payload.due_days,
        "show_lohnanteil": payload.show_lohnanteil,
        "lohnanteil_custom": payload.lohnanteil_custom,
        "kleinbetrag": payload.kleinbetrag,
        "status": "Offen",
        "is_printed": False,
        "printed_at": None,
        "paid_at": None,
        "invoice_date": now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": user.get("username") if isinstance(user, dict) else str(user),
    }

    await db.rechnungen_v2.insert_one(doc)
    doc.pop("_id", None)
    logger.info(f"Rechnung v2 erstellt: {inv_number} fuer {doc['customer_name']}")
    return doc

@router.put("/rechnungen/{rid}")
async def update_rechnung_v2(rid: str, payload: RechnungV2Update, user=Depends(get_current_user)):
    existing = await db.rechnungen_v2.find_one({"id": rid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Rechnung nicht gefunden")
    if existing.get("is_printed"):
        raise HTTPException(400, "Rechnung ist als 'Gedruckt' markiert und kann nicht mehr bearbeitet werden. Bitte zuerst Markierung aufheben.")

    update = payload.model_dump()
    # Summen neu berechnen
    subtotal = sum((p.get("quantity") or 0) * (p.get("price_net") or 0) for p in update["positions"])
    if update["discount_type"] == "percent":
        discount_amount = subtotal * (update["discount"] / 100)
    else:
        discount_amount = update["discount"]
    net_after_discount = max(0, subtotal - discount_amount)
    vat = net_after_discount * (update["vat_rate"] / 100)
    brutto = net_after_discount + vat
    final_amount = max(0, brutto - (update["deposit_amount"] or 0))

    update.update({
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "net_after_discount": round(net_after_discount, 2),
        "vat": round(vat, 2),
        "brutto": round(brutto, 2),
        "final_amount": round(final_amount, 2),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.rechnungen_v2.update_one({"id": rid}, {"$set": update})
    doc = await db.rechnungen_v2.find_one({"id": rid}, {"_id": 0})
    return doc

@router.delete("/rechnungen/{rid}")
async def delete_rechnung_v2(rid: str, user=Depends(get_current_user)):
    existing = await db.rechnungen_v2.find_one({"id": rid}, {"_id": 0, "is_printed": 1})
    if not existing:
        raise HTTPException(404, "Rechnung nicht gefunden")
    if existing.get("is_printed"):
        raise HTTPException(400, "Rechnung ist gedruckt und darf nicht geloescht werden. Bitte stornieren.")
    await db.rechnungen_v2.delete_one({"id": rid})
    return {"ok": True}

@router.put("/rechnungen/{rid}/print-status")
async def toggle_printed_v2(rid: str, payload: dict, user=Depends(get_current_user)):
    is_printed = bool(payload.get("is_printed", True))
    update = {"is_printed": is_printed}
    update["printed_at"] = datetime.now(timezone.utc).isoformat() if is_printed else None
    res = await db.rechnungen_v2.update_one({"id": rid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Rechnung nicht gefunden")
    return {"ok": True, "is_printed": is_printed}

@router.put("/rechnungen/{rid}/status")
async def set_status_v2(rid: str, payload: dict, user=Depends(get_current_user)):
    status = payload.get("status", "Offen")
    update = {"status": status}
    if status == "Bezahlt":
        update["paid_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "Offen":
        update["paid_at"] = None
    res = await db.rechnungen_v2.update_one({"id": rid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Rechnung nicht gefunden")
    return {"ok": True}

# ============== AUS AB ERZEUGEN ==============

@router.post("/rechnungen/from-order/{order_id}")
async def create_from_order(order_id: str, mode: str = "kurz", user=Depends(get_current_user)):
    """Erzeugt aus einer Auftragsbestaetigung eine Rechnung v2.
    mode = 'kurz' -> Kurz-Rechnung mit Verweis
    mode = 'voll' -> Vollrechnung mit allen Positionen"""
    ab = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not ab:
        raise HTTPException(404, "Auftragsbestaetigung nicht gefunden")

    customer_id = ab.get("customer_id")
    customer = await db.module_kunden.find_one({"id": customer_id}, {"_id": 0}) or \
               await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(404, "Kunde nicht gefunden")

    inv_number = await _next_invoice_number()
    now = datetime.now(timezone.utc)

    ab_number = ab.get("order_number", "")
    ab_datum = ab.get("created_at", now.isoformat())[:10]
    verweis = f"Leistungen gemaess Auftragsbestaetigung Nr. {ab_number} vom {ab_datum}"

    # Leistungsdatum: letzten Einsatz fuer diesen Kunden suchen, sonst heute
    letzter_einsatz = await db.einsaetze.find_one(
        {"customer_id": customer_id},
        sort=[("datum", -1)],
        projection={"_id": 0, "datum": 1}
    )
    leistungsdatum = (letzter_einsatz or {}).get("datum") or now.strftime("%Y-%m-%d")

    positions = ab.get("positions", []) if mode == "voll" else []
    subtotal = sum((p.get("quantity") or 0) * (p.get("price_net") or 0) for p in (ab.get("positions") or []))
    # Kurz-Rechnung: wir legen EINE Position mit Gesamtbetrag an, damit PDF-Logik funktioniert
    kurz_leistungstext = None
    if mode == "kurz":
        kurz_leistungstext = ab.get("betreff") or "Leistung laut Auftragsbestaetigung"
        positions = [{
            "pos_nr": 1,
            "type": "position",
            "description": f"{kurz_leistungstext}\n{verweis}\nLeistungsdatum: {leistungsdatum}",
            "quantity": 1,
            "unit": "Pauschal",
            "price_net": subtotal,
        }]

    discount = ab.get("discount", 0) or 0
    discount_type = ab.get("discount_type", "amount")
    vat_rate = ab.get("vat_rate", 19.0) or 19.0

    if discount_type == "percent":
        discount_amount = subtotal * (discount / 100)
    else:
        discount_amount = discount
    net_after_discount = max(0, subtotal - discount_amount)
    vat = net_after_discount * (vat_rate / 100)
    brutto = net_after_discount + vat
    anzahlung = ab.get("deposit_amount", 0) or 0
    final_amount = max(0, brutto - anzahlung)

    doc = {
        "id": str(uuid4()),
        "invoice_number": inv_number,
        "customer_id": customer_id,
        "customer_name": customer.get("name") or f"{customer.get('vorname','')} {customer.get('nachname','')}".strip(),
        "customer_snapshot": {
            "name": customer.get("name"),
            "anrede": customer.get("anrede"),
            "address": customer.get("address") or customer.get("anschrift"),
            "plz": customer.get("plz"),
            "ort": customer.get("ort"),
            "email": customer.get("email"),
        },
        "auftrag_id": order_id,
        "auftrag_number": ab_number,
        "angebot_id": ab.get("quote_id"),
        "mode": mode,
        "betreff": f"Rechnung zu {ab_number}",
        "verweis_text": verweis,
        "kurz_leistungstext": kurz_leistungstext,
        "leistungsdatum": leistungsdatum,
        "positions": positions,
        "vortext": ab.get("vortext", ""),
        "schlusstext": ab.get("schlusstext", ""),
        "discount": discount,
        "discount_type": discount_type,
        "vat_rate": vat_rate,
        "deposit_amount": anzahlung,
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "net_after_discount": round(net_after_discount, 2),
        "vat": round(vat, 2),
        "brutto": round(brutto, 2),
        "final_amount": round(final_amount, 2),
        "due_days": 14,
        "show_lohnanteil": ab.get("show_lohnanteil", True),
        "lohnanteil_custom": ab.get("lohnanteil_custom"),
        "kleinbetrag": brutto <= 250,
        "status": "Offen",
        "is_printed": False,
        "printed_at": None,
        "paid_at": None,
        "invoice_date": now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": user.get("username") if isinstance(user, dict) else str(user),
    }
    await db.rechnungen_v2.insert_one(doc)
    doc.pop("_id", None)

    # AB als abgerechnet markieren
    await db.orders.update_one({"id": order_id}, {"$set": {"abgerechnet_am": now.isoformat(), "abgerechnet_rechnung_id": doc["id"]}})

    logger.info(f"Rechnung v2 {inv_number} aus AB {ab_number} erzeugt ({mode})")
    return doc


# ============== PDF ==============

from fastapi.responses import Response


@router.get("/rechnungen/{rid}/pdf")
async def pdf_rechnung_v2(rid: str, user=Depends(get_current_user)):
    from utils.pdf_generator_v2 import generate_invoice_v2_pdf
    inv = await db.rechnungen_v2.find_one({"id": rid}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Rechnung nicht gefunden")
    settings_doc = await db.settings.find_one({"id": "firma"}, {"_id": 0}) or {}
    pdf_bytes = generate_invoice_v2_pdf(inv, settings_doc)
    filename = f"Rechnung_{inv['invoice_number']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
