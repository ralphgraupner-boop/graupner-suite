from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from database import db, logger
from auth import get_current_user
import uuid

router = APIRouter()


# ===================== BUCHUNGEN (Transactions) =====================

@router.get("/buchhaltung/buchungen")
async def get_buchungen(
    zeitraum: str = Query("alle", description="monat|quartal|jahr|alle"),
    typ: str = Query("alle", description="einnahme|ausgabe|alle"),
    kategorie: str = Query("", description="Filter by category"),
    user=Depends(get_current_user)
):
    """Alle Buchungen abrufen mit Zeitraum- und Typ-Filter"""
    query = {}
    now = datetime.now(timezone.utc)

    if typ != "alle":
        query["typ"] = typ

    if kategorie:
        query["kategorie"] = kategorie

    if zeitraum == "monat":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        query["datum"] = {"$gte": start.isoformat()}
    elif zeitraum == "quartal":
        quarter_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        query["datum"] = {"$gte": start.isoformat()}
    elif zeitraum == "jahr":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        query["datum"] = {"$gte": start.isoformat()}

    buchungen = await db.buchungen.find(query, {"_id": 0}).sort("datum", -1).to_list(1000)
    return buchungen


@router.post("/buchhaltung/buchungen")
async def create_buchung(body: dict, user=Depends(get_current_user)):
    """Neue Buchung erstellen (Einnahme oder Ausgabe)"""
    buchung = {
        "id": str(uuid.uuid4()),
        "typ": body.get("typ", "ausgabe"),  # einnahme | ausgabe
        "kategorie": body.get("kategorie", ""),
        "beschreibung": body.get("beschreibung", ""),
        "betrag_netto": float(body.get("betrag_netto", 0)),
        "mwst_satz": float(body.get("mwst_satz", 19)),
        "betrag_brutto": float(body.get("betrag_brutto", 0)),
        "datum": body.get("datum", datetime.now(timezone.utc).isoformat()),
        "notizen": body.get("notizen", ""),
        "rechnung_id": body.get("rechnung_id", None),
        "rechnung_nr": body.get("rechnung_nr", ""),
        "kunde": body.get("kunde", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Auto-calculate brutto if only netto given
    if buchung["betrag_netto"] and not buchung["betrag_brutto"]:
        buchung["betrag_brutto"] = round(buchung["betrag_netto"] * (1 + buchung["mwst_satz"] / 100), 2)
    elif buchung["betrag_brutto"] and not buchung["betrag_netto"]:
        buchung["betrag_netto"] = round(buchung["betrag_brutto"] / (1 + buchung["mwst_satz"] / 100), 2)

    await db.buchungen.insert_one(buchung)
    buchung.pop("_id", None)
    return buchung


@router.put("/buchhaltung/buchungen/{buchung_id}")
async def update_buchung(buchung_id: str, body: dict, user=Depends(get_current_user)):
    """Buchung bearbeiten"""
    existing = await db.buchungen.find_one({"id": buchung_id})
    if not existing:
        raise HTTPException(404, "Buchung nicht gefunden")

    allowed = ["typ", "kategorie", "beschreibung", "betrag_netto", "mwst_satz", "betrag_brutto",
               "datum", "notizen", "rechnung_id", "rechnung_nr", "kunde"]
    updates = {k: v for k, v in body.items() if k in allowed}

    # Recalculate if needed
    if "betrag_netto" in updates and "betrag_brutto" not in updates:
        mwst = float(updates.get("mwst_satz", existing.get("mwst_satz", 19)))
        updates["betrag_brutto"] = round(float(updates["betrag_netto"]) * (1 + mwst / 100), 2)
    elif "betrag_brutto" in updates and "betrag_netto" not in updates:
        mwst = float(updates.get("mwst_satz", existing.get("mwst_satz", 19)))
        updates["betrag_netto"] = round(float(updates["betrag_brutto"]) / (1 + mwst / 100), 2)

    if updates:
        await db.buchungen.update_one({"id": buchung_id}, {"$set": updates})

    updated = await db.buchungen.find_one({"id": buchung_id}, {"_id": 0})
    return updated


@router.delete("/buchhaltung/buchungen/{buchung_id}")
async def delete_buchung(buchung_id: str, user=Depends(get_current_user)):
    """Buchung rückstandslos löschen"""
    result = await db.buchungen.delete_one({"id": buchung_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Buchung nicht gefunden")
    return {"message": "Buchung rückstandslos gelöscht"}


# ===================== KATEGORIEN =====================

@router.get("/buchhaltung/kategorien")
async def get_kategorien(user=Depends(get_current_user)):
    """Alle Buchungs-Kategorien abrufen"""
    config = await db.buchhaltung_config.find_one({"id": "kategorien"}, {"_id": 0})
    if not config:
        defaults = {
            "id": "kategorien",
            "einnahme": ["Rechnung", "Bareinnahme", "Sonstige Einnahme"],
            "ausgabe": ["Material", "Werkzeug", "Fahrzeug", "Versicherung", "Miete", "Personal", "Büro", "Telefon/Internet", "Werbung", "Sonstige Ausgabe"]
        }
        await db.buchhaltung_config.insert_one(defaults)
        defaults.pop("_id", None)
        return defaults
    return config


@router.put("/buchhaltung/kategorien")
async def update_kategorien(body: dict, user=Depends(get_current_user)):
    """Kategorien aktualisieren"""
    updates = {}
    if "einnahme" in body:
        updates["einnahme"] = [k for k in body["einnahme"] if k.strip()]
    if "ausgabe" in body:
        updates["ausgabe"] = [k for k in body["ausgabe"] if k.strip()]

    await db.buchhaltung_config.update_one(
        {"id": "kategorien"},
        {"$set": updates},
        upsert=True
    )
    result = await db.buchhaltung_config.find_one({"id": "kategorien"}, {"_id": 0})
    return result


# ===================== STATISTIKEN / ÜBERSICHT =====================

@router.get("/buchhaltung/statistiken")
async def get_statistiken(
    zeitraum: str = Query("jahr", description="monat|quartal|jahr|alle"),
    user=Depends(get_current_user)
):
    """Einnahmen/Ausgaben/Gewinn Übersicht + USt"""
    query = {}
    now = datetime.now(timezone.utc)

    if zeitraum == "monat":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        query["datum"] = {"$gte": start.isoformat()}
    elif zeitraum == "quartal":
        quarter_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        query["datum"] = {"$gte": start.isoformat()}
    elif zeitraum == "jahr":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        query["datum"] = {"$gte": start.isoformat()}

    buchungen = await db.buchungen.find(query, {"_id": 0}).to_list(5000)

    einnahmen_netto = 0
    einnahmen_brutto = 0
    ausgaben_netto = 0
    ausgaben_brutto = 0
    ust_einnahmen = 0  # Umsatzsteuer (collected)
    vst_ausgaben = 0   # Vorsteuer (paid)
    kategorien_ausgaben = {}
    kategorien_einnahmen = {}
    monatlich = {}

    for b in buchungen:
        netto = float(b.get("betrag_netto", 0))
        brutto = float(b.get("betrag_brutto", 0))
        mwst = brutto - netto
        kat = b.get("kategorie", "Sonstige")
        datum = b.get("datum", "")
        monat_key = datum[:7] if len(datum) >= 7 else "unbekannt"

        if monat_key not in monatlich:
            monatlich[monat_key] = {"einnahmen": 0, "ausgaben": 0}

        if b.get("typ") == "einnahme":
            einnahmen_netto += netto
            einnahmen_brutto += brutto
            ust_einnahmen += mwst
            kategorien_einnahmen[kat] = kategorien_einnahmen.get(kat, 0) + brutto
            monatlich[monat_key]["einnahmen"] += brutto
        else:
            ausgaben_netto += netto
            ausgaben_brutto += brutto
            vst_ausgaben += mwst
            kategorien_ausgaben[kat] = kategorien_ausgaben.get(kat, 0) + brutto
            monatlich[monat_key]["ausgaben"] += brutto

    gewinn_netto = einnahmen_netto - ausgaben_netto
    gewinn_brutto = einnahmen_brutto - ausgaben_brutto
    ust_zahllast = ust_einnahmen - vst_ausgaben

    # Sort monthly data
    monatlich_sorted = [
        {"monat": k, "einnahmen": round(v["einnahmen"], 2), "ausgaben": round(v["ausgaben"], 2)}
        for k, v in sorted(monatlich.items())
    ]

    return {
        "einnahmen_netto": round(einnahmen_netto, 2),
        "einnahmen_brutto": round(einnahmen_brutto, 2),
        "ausgaben_netto": round(ausgaben_netto, 2),
        "ausgaben_brutto": round(ausgaben_brutto, 2),
        "gewinn_netto": round(gewinn_netto, 2),
        "gewinn_brutto": round(gewinn_brutto, 2),
        "ust_einnahmen": round(ust_einnahmen, 2),
        "vst_ausgaben": round(vst_ausgaben, 2),
        "ust_zahllast": round(ust_zahllast, 2),
        "kategorien_ausgaben": {k: round(v, 2) for k, v in sorted(kategorien_ausgaben.items(), key=lambda x: -x[1])},
        "kategorien_einnahmen": {k: round(v, 2) for k, v in sorted(kategorien_einnahmen.items(), key=lambda x: -x[1])},
        "monatlich": monatlich_sorted,
        "anzahl_buchungen": len(buchungen),
    }


# ===================== OFFENE POSTEN (from Invoices) =====================

@router.get("/buchhaltung/offene-posten")
async def get_offene_posten(user=Depends(get_current_user)):
    """Offene Rechnungen als offene Posten anzeigen"""
    invoices = await db.invoices.find(
        {"status": {"$in": ["Offen", "Gesendet", "Überfällig"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    posten = []
    for inv in invoices:
        posten.append({
            "id": inv.get("id"),
            "rechnung_nr": inv.get("invoice_number", ""),
            "kunde": inv.get("customer_name", ""),
            "betrag": inv.get("final_amount", inv.get("total_gross", 0)),
            "status": inv.get("status", "Offen"),
            "datum": inv.get("created_at", ""),
            "faellig_am": inv.get("due_date", ""),
        })
    return posten


@router.post("/buchhaltung/zahlungseingang/{invoice_id}")
async def mark_invoice_paid(invoice_id: str, body: dict = {}, user=Depends(get_current_user)):
    """Rechnung als bezahlt markieren und optional als Buchung erfassen"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "Rechnung nicht gefunden")

    # Update invoice status
    await db.invoices.update_one({"id": invoice_id}, {"$set": {
        "status": "Bezahlt",
        "paid_at": datetime.now(timezone.utc).isoformat()
    }})

    # Create a buchung entry if requested
    if body.get("buchung_erstellen", True):
        betrag = float(invoice.get("final_amount", invoice.get("total_gross", 0)))
        vat_rate = float(invoice.get("vat_rate", 19))
        netto = round(betrag / (1 + vat_rate / 100), 2) if vat_rate > 0 else betrag

        buchung = {
            "id": str(uuid.uuid4()),
            "typ": "einnahme",
            "kategorie": "Rechnung",
            "beschreibung": f"Zahlung Rechnung {invoice.get('invoice_number', '')} - {invoice.get('customer_name', '')}",
            "betrag_netto": netto,
            "mwst_satz": vat_rate,
            "betrag_brutto": betrag,
            "datum": datetime.now(timezone.utc).isoformat(),
            "notizen": "",
            "rechnung_id": invoice_id,
            "rechnung_nr": invoice.get("invoice_number", ""),
            "kunde": invoice.get("customer_name", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.buchungen.insert_one(buchung)
        buchung.pop("_id", None)

    return {"message": f"Rechnung {invoice.get('invoice_number', '')} als bezahlt markiert"}


@router.post("/buchhaltung/zahlung-rueckgaengig/{invoice_id}")
async def undo_invoice_payment(invoice_id: str, user=Depends(get_current_user)):
    """Zahlung rückgängig machen – Rechnung zurück auf Offen, Buchung löschen"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "Rechnung nicht gefunden")

    await db.invoices.update_one({"id": invoice_id}, {"$set": {
        "status": "Offen",
        "paid_at": None
    }})

    # Delete associated buchung
    await db.buchungen.delete_many({"rechnung_id": invoice_id})

    return {"message": f"Zahlung für Rechnung {invoice.get('invoice_number', '')} rückgängig gemacht"}
