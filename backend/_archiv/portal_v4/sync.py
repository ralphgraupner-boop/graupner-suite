"""
Portal v4 – Sync/Import aus module_kunden (nur lesend)

Strikt isoliert:
- Liest aus module_kunden
- Schreibt NUR in portal4_accounts und portal4_sync_log
- Kein Update/Delete an module_kunden
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4

from database import db, logger
from auth import get_current_user

router = APIRouter(prefix="/admin")


# ============== MODELS ==============

class ImportRequest(BaseModel):
    kunden_ids: List[str]
    skip_without_email: bool = True


# ============== ENDPOINTS ==============

@router.get("/kunden-quelle")
async def list_kunden_for_import(
    status: Optional[str] = None,
    search: str = "",
    user=Depends(get_current_user),
):
    """
    Liefert Kunden aus module_kunden für den Import-Dialog.
    Nur lesend.
    Markiert, welche bereits im Portal v4 existieren.
    """
    query = {}
    if status:
        query["kontakt_status"] = status

    kunden = await db.module_kunden.find(
        query,
        {
            "_id": 0,
            "id": 1,
            "vorname": 1,
            "nachname": 1,
            "name": 1,
            "email": 1,
            "phone": 1,
            "anrede": 1,
            "firma": 1,
            "customer_type": 1,
            "kontakt_status": 1,
            "created_at": 1,
        },
    ).sort("created_at", -1).to_list(2000)

    if search:
        term = search.lower().strip()
        kunden = [
            k for k in kunden
            if term in (k.get("vorname", "") or "").lower()
            or term in (k.get("nachname", "") or "").lower()
            or term in (k.get("name", "") or "").lower()
            or term in (k.get("email", "") or "").lower()
            or term in (k.get("firma", "") or "").lower()
        ]

    # Existenz-Check gegen portal4_accounts
    existing_emails = set()
    existing_customer_ids = set()
    async for acc in db.portal4_accounts.find({}, {"_id": 0, "email": 1, "customer_id": 1}):
        if acc.get("email"):
            existing_emails.add(acc["email"].lower())
        if acc.get("customer_id"):
            existing_customer_ids.add(acc["customer_id"])

    for k in kunden:
        email = (k.get("email") or "").lower()
        k["_already_imported"] = (
            k.get("id") in existing_customer_ids
            or (email != "" and email in existing_emails)
        )
        display = f"{k.get('vorname', '')} {k.get('nachname', '')}".strip()
        if not display:
            display = k.get("name") or k.get("firma") or k.get("email", "")
        k["_display"] = display

    return kunden


@router.post("/accounts/import-from-kunden")
async def import_from_kunden(payload: ImportRequest, user=Depends(get_current_user)):
    """
    Bulk-Import ausgewählter Kunden-IDs aus module_kunden in portal4_accounts.
    Schreibt Audit-Log nach portal4_sync_log.
    """
    if not payload.kunden_ids:
        raise HTTPException(400, "Keine Kunden ausgewählt")

    imported = []
    skipped = []

    for kid in payload.kunden_ids:
        kunde = await db.module_kunden.find_one({"id": kid}, {"_id": 0})
        if not kunde:
            skipped.append({"id": kid, "reason": "Kunde nicht gefunden"})
            continue

        email = (kunde.get("email") or "").strip().lower()
        if payload.skip_without_email and not email:
            skipped.append({"id": kid, "reason": "Keine E-Mail"})
            continue

        # Dubletten-Check
        dup_query = [{"customer_id": kid}]
        if email:
            dup_query.append({"email": email})
        existing = await db.portal4_accounts.find_one({"$or": dup_query}, {"_id": 0, "id": 1})
        if existing:
            skipped.append({"id": kid, "reason": "Account existiert bereits", "account_id": existing["id"]})
            continue

        name = f"{kunde.get('vorname', '')} {kunde.get('nachname', '')}".strip()
        if not name:
            name = kunde.get("name") or kunde.get("firma") or email or "Kunde"

        now = datetime.now(timezone.utc).isoformat()
        account = {
            "id": str(uuid4()),
            "customer_id": kid,
            "name": name,
            "email": email,
            "password_hash": None,
            "token": None,
            "active": True,
            "notes": f"Importiert aus Kundenkartei am {now[:10]}",
            "last_login": None,
            "created_at": now,
            "updated_at": now,
        }
        await db.portal4_accounts.insert_one(account)
        account.pop("_id", None)
        imported.append({"id": kid, "account_id": account["id"], "name": name, "email": email})

    # Audit-Log
    log_entry = {
        "id": str(uuid4()),
        "imported_kunden_ids": [i["id"] for i in imported],
        "imported_account_ids": [i["account_id"] for i in imported],
        "skipped": skipped,
        "count": len(imported),
        "by_user": (user or {}).get("username") or (user or {}).get("sub") or "unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.portal4_sync_log.insert_one(log_entry)
    log_entry.pop("_id", None)

    logger.info(f"Portal v4 Import: {len(imported)} importiert, {len(skipped)} übersprungen")
    return {
        "imported": imported,
        "skipped": skipped,
        "count_imported": len(imported),
        "count_skipped": len(skipped),
    }


@router.get("/sync-log")
async def list_sync_log(limit: int = 20, user=Depends(get_current_user)):
    """Letzte Sync-Vorgänge anzeigen."""
    logs = await db.portal4_sync_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs
