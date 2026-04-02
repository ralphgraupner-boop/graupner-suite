from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from models import Customer, Anfrage, AnfrageUpdate
from database import db, CATEGORIES, CUSTOMER_STATUSES
from auth import get_current_user

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


@router.delete("/anfragen/{anfrage_id}")
async def delete_anfrage(anfrage_id: str, user=Depends(get_current_user)):
    """Anfrage löschen/ablehnen"""
    result = await db.anfragen.delete_one({"id": anfrage_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    return {"message": "Anfrage gelöscht"}


@router.put("/anfragen/{anfrage_id}")
async def update_anfrage(anfrage_id: str, data: AnfrageUpdate, user=Depends(get_current_user)):
    """Anfrage-Daten bearbeiten/korrigieren"""
    existing = await db.anfragen.find_one({"id": anfrage_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Daten zum Aktualisieren")
    
    await db.anfragen.update_one({"id": anfrage_id}, {"$set": update_data})
    updated = await db.anfragen.find_one({"id": anfrage_id}, {"_id": 0})
    return updated


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
