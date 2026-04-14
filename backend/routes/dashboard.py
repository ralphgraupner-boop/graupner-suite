from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from models import Customer, Anfrage, AnfrageUpdate
from database import db, CATEGORIES, CUSTOMER_STATUSES
from auth import get_current_user
import re

router = APIRouter()


@router.get("/stats/overview")
async def get_overview_stats(view: str = "anfragen", user=Depends(get_current_user)):
    """Gestaffelte Übersicht nach Anfragen, Kunden oder Leistungen"""
    if view == "anfragen":
        anfragen = await db.anfragen.find({}, {"_id": 0}).to_list(1000)
        by_category = {}
        for cat in CATEGORIES:
            items = [a for a in anfragen if cat in a.get("categories", [])]
            by_category[cat] = {"count": len(items), "items": sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)[:5]}
        return {"view": "anfragen", "total": len(anfragen), "groups": by_category}

    elif view == "kunden":
        customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
        by_status = {}
        for st in CUSTOMER_STATUSES:
            items = [c for c in customers if c.get("status", "Neu") == st]
            by_status[st] = {"count": len(items), "items": sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)[:5]}
        return {"view": "kunden", "total": len(customers), "groups": by_status}

    elif view == "leistungen":
        services = await db.services.find({}, {"_id": 0}).to_list(1000)
        articles = await db.articles.find({}, {"_id": 0}).to_list(1000)
        return {
            "view": "leistungen",
            "total": len(services) + len(articles),
            "groups": {
                "Leistungen": {"count": len(services), "items": services[:10]},
                "Artikel": {"count": len(articles), "items": articles[:10]}
            }
        }

    return {"view": view, "total": 0, "groups": {}}


@router.get("/anfragen")
async def list_anfragen(category: str = "", user=Depends(get_current_user)):
    """Alle Anfragen auflisten, optional nach Kategorie filtern"""
    query = {}
    if category:
        query["categories"] = category
    anfragen = await db.anfragen.find(query, {"_id": 0}).to_list(1000)
    anfragen.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return anfragen


@router.get("/storage/{path:path}")
async def serve_storage_file(path: str):
    """Serve a file from object storage - public access for image display"""
    try:
        from utils.storage import get_object
        content, content_type = get_object(path)
        return Response(content=content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Datei nicht gefunden: {str(e)}")



@router.delete("/anfragen/{anfrage_id}")
async def delete_anfrage(anfrage_id: str, user=Depends(get_current_user)):
    """Anfrage löschen/ablehnen"""
    result = await db.anfragen.delete_one({"id": anfrage_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    return {"message": "Anfrage gelöscht"}


@router.put("/anfragen/{anfrage_id}/status")
async def toggle_anfrage_status(anfrage_id: str, body: dict, user=Depends(get_current_user)):
    status = body.get("bearbeitungsstatus", "ungelesen")
    result = await db.anfragen.update_one({"id": anfrage_id}, {"$set": {"bearbeitungsstatus": status}})
    if result.matched_count == 0:
        raise HTTPException(404, "Anfrage nicht gefunden")
    return {"ok": True, "bearbeitungsstatus": status}



@router.post("/anfragen/{anfrage_id}/convert")
async def convert_anfrage(anfrage_id: str, user=Depends(get_current_user)):
    """Anfrage in Kunde umwandeln"""
    anfrage = await db.anfragen.find_one({"id": anfrage_id}, {"_id": 0})
    if not anfrage:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")

    customer = Customer(
        name=anfrage.get("name", "Unbekannt"),
        email=anfrage.get("email", ""),
        phone=anfrage.get("phone", ""),
        address=anfrage.get("address", ""),
        notes=anfrage.get("notes", ""),
        photos=anfrage.get("photos", []),
        customer_type=anfrage.get("customer_type", "Privat"),
        categories=anfrage.get("categories", []),
        firma=anfrage.get("firma", ""),
        anrede=anfrage.get("anrede", "")
    )
    await db.customers.insert_one(customer.model_dump())
    await db.anfragen.delete_one({"id": anfrage_id})

    return {"message": "Anfrage in Kunde umgewandelt", "customer_id": customer.id}


def parse_vcf(content: str) -> dict:
    """Parse a VCF/vCard file content into a dictionary"""
    data = {"name": "", "vorname": "", "nachname": "", "email": "", "phone": "", "address": "", "anrede": "",
            "firma": "", "nachricht": "", "categories": [], "customer_type": "Privat",
            "notes": "", "source": "vcf-import"}

    lines = content.replace("\r\n ", "").replace("\r\n\t", "").split("\r\n")
    if len(lines) <= 1:
        lines = content.replace("\n ", "").replace("\n\t", "").split("\n")

    for line in lines:
        line = line.strip()
        if not line or line in ("BEGIN:VCARD", "END:VCARD"):
            continue

        if line.startswith("N:") or line.startswith("N;"):
            parts = line.split(":", 1)[1].split(";")
            family = parts[0] if len(parts) > 0 else ""
            given = parts[1] if len(parts) > 1 else ""
            prefix = parts[3] if len(parts) > 3 else ""
            if prefix in ("Herr", "Frau"):
                data["anrede"] = prefix
            data["vorname"] = given.strip()
            data["nachname"] = family.strip()
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
            street = parts[2] if len(parts) > 2 else ""
            city = parts[3] if len(parts) > 3 else ""
            plz = parts[5] if len(parts) > 5 else ""
            country = parts[6] if len(parts) > 6 else ""
            addr_parts = [p for p in [street, f"{plz} {city}".strip(), country] if p]
            data["address"] = ", ".join(addr_parts)

        elif line.startswith("ORG:"):
            org = line.split(":", 1)[1].strip()
            if org and org not in ("Herr", "Frau", "Divers"):
                data["firma"] = org

        elif line.startswith("ROLE:"):
            data["notes"] = line.split(":", 1)[1].strip()

        elif line.startswith("NOTE:"):
            note_text = line.split(":", 1)[1].strip()
            betrifft = re.search(r"Betrifft:\s*([^,\n]+(?:,\s*[^,\n]+)*)", note_text)
            if betrifft:
                cats = [c.strip() for c in betrifft.group(1).split(",") if c.strip()]
                data["categories"] = [c for c in cats if c in CATEGORIES]
            nachricht = re.search(r"Nachricht:\s*(.+)", note_text, re.DOTALL)
            if nachricht:
                data["nachricht"] = nachricht.group(1).strip()
            elif not betrifft:
                data["nachricht"] = note_text

        elif line.startswith("CATEGORIES:"):
            cat_val = line.split(":", 1)[1].strip()
            if cat_val.lower() in ("privat", "private"):
                data["customer_type"] = "Privat"
            elif cat_val.lower() in ("firma", "business", "work"):
                data["customer_type"] = "Firma"

    return data


@router.post("/anfragen/import-vcf")
async def import_vcf(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import a VCF/vCard file as a new Anfrage"""
    if not file.filename.lower().endswith(".vcf"):
        raise HTTPException(status_code=400, detail="Nur .vcf Dateien erlaubt")

    content = (await file.read()).decode("utf-8", errors="ignore")
    data = parse_vcf(content)

    if not data["name"]:
        raise HTTPException(status_code=400, detail="Kein Name in der VCF-Datei gefunden")

    anfrage = Anfrage(
        name=data["name"],
        vorname=data["vorname"],
        nachname=data["nachname"],
        email=data["email"],
        phone=data["phone"],
        address=data["address"],
        anrede=data["anrede"],
        firma=data["firma"],
        nachricht=data["nachricht"],
        categories=data["categories"],
        customer_type=data["customer_type"],
        notes=data["notes"],
        source="vcf-import"
    )
    await db.anfragen.insert_one(anfrage.model_dump())
    result = anfrage.model_dump()
    result.pop("_id", None)
    return result


@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Dashboard-Statistiken"""
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(1000)
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    customers = await db.customers.count_documents({})

    open_quotes = len([q for q in quotes if q.get("status") == "Entwurf"])
    open_orders = len([o for o in orders if o.get("status") == "Offen"])
    unpaid_invoices = len([i for i in invoices if i.get("status") == "Offen"])

    total_quotes_value = sum(q.get("total_gross", 0) for q in quotes)
    total_invoices_value = sum(i.get("total_gross", 0) for i in invoices)
    paid_invoices_value = sum(i.get("total_gross", 0) for i in invoices if i.get("status") == "Bezahlt")

    anfragen = await db.anfragen.find({}, {"_id": 0}).to_list(1000)
    anfragen_by_category = {}
    for cat in CATEGORIES:
        anfragen_by_category[cat] = 0
    for a in anfragen:
        for cat in a.get("categories", []):
            if cat in anfragen_by_category:
                anfragen_by_category[cat] += 1

    recent_anfragen = sorted(anfragen, key=lambda x: x.get("created_at", ""), reverse=True)[:5]

    monthly_revenue = defaultdict(float)
    monthly_quotes = defaultdict(float)
    now = datetime.now(timezone.utc)
    for inv in invoices:
        try:
            created = datetime.fromisoformat(inv.get("created_at", ""))
            month_key = created.strftime("%Y-%m")
            monthly_revenue[month_key] += inv.get("total_gross", 0)
        except (ValueError, TypeError):
            pass
    for q in quotes:
        try:
            created = datetime.fromisoformat(q.get("created_at", ""))
            month_key = created.strftime("%Y-%m")
            monthly_quotes[month_key] += q.get("total_gross", 0)
        except (ValueError, TypeError):
            pass

    months_data = []
    for i in range(5, -1, -1):
        d = now - timedelta(days=i * 30)
        mk = d.strftime("%Y-%m")
        month_label = d.strftime("%b %Y")
        months_data.append({
            "month": month_label,
            "rechnungen": round(monthly_revenue.get(mk, 0), 2),
            "angebote": round(monthly_quotes.get(mk, 0), 2)
        })

    invoice_statuses = {"Offen": 0, "Gesendet": 0, "Bezahlt": 0, "Überfällig": 0}
    for inv in invoices:
        s = inv.get("status", "Offen")
        if s in invoice_statuses:
            invoice_statuses[s] += 1

    overdue_count = 0
    for inv in invoices:
        if inv.get("status") in ("Offen", "Gesendet", "Überfällig") and inv.get("due_date"):
            try:
                due = datetime.fromisoformat(inv["due_date"])
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if now > due:
                    overdue_count += 1
            except (ValueError, TypeError):
                pass

    return {
        "customers_count": customers,
        "quotes": {
            "total": len(quotes),
            "open": open_quotes,
            "total_value": round(total_quotes_value, 2)
        },
        "orders": {
            "total": len(orders),
            "open": open_orders
        },
        "invoices": {
            "total": len(invoices),
            "unpaid": unpaid_invoices,
            "total_value": round(total_invoices_value, 2),
            "paid_value": round(paid_invoices_value, 2)
        },
        "anfragen": {
            "total": len(anfragen),
            "by_category": anfragen_by_category,
            "recent": recent_anfragen
        },
        "monthly": months_data,
        "invoice_statuses": invoice_statuses,
        "overdue_count": overdue_count
    }
