"""
Dokumente v2 – Nummern-Generator (GoBD-konform)
- Atomare Vergabe via findOneAndUpdate + $inc
- Audit-Log in portal2_counter_log (equivalent: dokumente_v2_counter_log)
- Prefix + Jahr + Monat (bei monthly) + lfd. Nr.
- Lücken-Check
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4

from database import db, logger
from auth import get_current_user
from .models import DocType, STRICT_TYPES

router = APIRouter()


def _prefix_from_type(settings: dict, doc_type: str) -> str:
    mapping = {
        "angebot": settings.get("prefix_angebot", "AN"),
        "auftrag": settings.get("prefix_auftrag", "AB"),
        "rechnung": settings.get("prefix_rechnung", "RE"),
        "gutschrift": settings.get("prefix_gutschrift", "GU"),
    }
    return mapping.get(doc_type, doc_type[:2].upper())


def _counter_key(settings: dict, doc_type: str, dt: datetime) -> tuple[str, str]:
    """Berechnet (counter_id, period_key)."""
    prefix = _prefix_from_type(settings, doc_type)
    year = dt.year
    if settings.get("counter_reset", "monthly") == "monthly":
        period = f"{year}-{dt.month:02d}"
    else:
        period = f"{year}"
    counter_id = f"{doc_type}:{period}"
    return counter_id, period


async def _get_settings() -> dict:
    doc = await db.dokumente_v2_settings.find_one({"id": "default"}, {"_id": 0}) or {}
    # defaults
    doc.setdefault("prefix_angebot", "AN")
    doc.setdefault("prefix_auftrag", "AB")
    doc.setdefault("prefix_rechnung", "RE")
    doc.setdefault("prefix_gutschrift", "GU")
    doc.setdefault("counter_reset", "monthly")
    doc.setdefault("number_padding", 4)
    return doc


async def issue_number(doc_type: DocType, user: dict | None, related_doc_id: str) -> str:
    """Vergibt atomar die nächste Nummer für den Typ und schreibt Audit-Log."""
    settings = await _get_settings()
    now = datetime.now(timezone.utc)
    counter_id, period = _counter_key(settings, doc_type, now)

    # Atomic $inc + upsert
    result = await db.dokumente_v2_counters.find_one_and_update(
        {"id": counter_id},
        {
            "$inc": {"value": 1},
            "$setOnInsert": {
                "id": counter_id,
                "type": doc_type,
                "period": period,
                "created_at": now.isoformat(),
            },
            "$set": {"last_at": now.isoformat()},
        },
        upsert=True,
        return_document=True,
    )
    if not result:
        raise HTTPException(500, "Nummernvergabe fehlgeschlagen")

    seq = int(result["value"])
    prefix = _prefix_from_type(settings, doc_type)
    padding = int(settings.get("number_padding", 4))
    if settings.get("counter_reset", "monthly") == "monthly":
        number = f"{prefix}-{now.year}-{now.month:02d}-{seq:0{padding}d}"
    else:
        number = f"{prefix}-{now.year}-{seq:0{padding}d}"

    # Audit-Log (GoBD: wer, wann, welches Dokument)
    await db.dokumente_v2_counter_log.insert_one({
        "id": str(uuid4()),
        "counter_id": counter_id,
        "type": doc_type,
        "number": number,
        "sequence": seq,
        "dokument_id": related_doc_id,
        "by_user": (user or {}).get("username") or "unknown",
        "timestamp": now.isoformat(),
        "is_strict": doc_type in STRICT_TYPES,
    })
    logger.info(f"Dokumente v2 Nummer vergeben: {number} fuer {related_doc_id}")
    return number


# ============== API ENDPOINTS ==============

@router.get("/admin/counters")
async def list_counters(user=Depends(get_current_user)):
    """Alle Zähler-Stände (zur Übersicht)."""
    counters = await db.dokumente_v2_counters.find({}, {"_id": 0}).sort("id", 1).to_list(1000)
    return counters


@router.get("/admin/counter-log")
async def list_counter_log(
    doc_type: str | None = None,
    year: int | None = None,
    limit: int = 500,
    user=Depends(get_current_user),
):
    q: dict = {}
    if doc_type:
        q["type"] = doc_type
    if year:
        q["number"] = {"$regex": f"^[A-Z]+-{year}-"}
    logs = await db.dokumente_v2_counter_log.find(q, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


@router.get("/admin/gaps")
async def find_gaps(
    doc_type: DocType,
    year: int,
    month: int | None = None,
    user=Depends(get_current_user),
):
    """Lücken-Check: Prüft ob alle Sequenzen 1..max vergeben sind."""
    settings = await _get_settings()
    is_monthly = settings.get("counter_reset", "monthly") == "monthly"
    if is_monthly and not month:
        raise HTTPException(400, "Monat ist bei monatlichem Reset erforderlich")

    period = f"{year}-{month:02d}" if is_monthly else f"{year}"
    counter_id = f"{doc_type}:{period}"
    counter = await db.dokumente_v2_counters.find_one({"id": counter_id}, {"_id": 0})
    if not counter:
        return {"type": doc_type, "period": period, "total": 0, "gaps": [], "message": "Keine Zähler vorhanden"}

    expected = set(range(1, int(counter["value"]) + 1))
    used_logs = await db.dokumente_v2_counter_log.find(
        {"counter_id": counter_id},
        {"_id": 0, "sequence": 1, "number": 1, "dokument_id": 1},
    ).to_list(10000)
    used_seqs = {int(x["sequence"]) for x in used_logs}
    missing = sorted(expected - used_seqs)

    return {
        "type": doc_type,
        "period": period,
        "total": int(counter["value"]),
        "gaps": missing,
        "gap_count": len(missing),
        "complete": len(missing) == 0,
    }
