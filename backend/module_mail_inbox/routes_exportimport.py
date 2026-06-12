"""Export/Import für module_mail_inbox (additiv, Module-First).

- GET  /api/module-mail-inbox/export : JSON (für Re-Import) oder CSV (Excel/Steuerberater),
       Filter: Status (offen/alle) + Datumsbereich (von/bis).
- POST /api/module-mail-inbox/import : JSON-Datei-Upload, Duplikat-Prüfung per
       message_id ODER content_hash. Läuft auf Preview UND Live (normales App-Feature).
"""
import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response

from database import db
from routes.auth import get_current_user

router = APIRouter()

CSV_COLUMNS = ["Datum", "Name", "E-Mail", "Telefon", "Status", "Prioritaet", "Betreff", "Nachricht"]


def _build_query(status: str, von: Optional[str], bis: Optional[str]) -> dict:
    q = {}
    if status == "offen":
        q["status"] = "vorschlag"
    # 'alle' -> kein Status-Filter
    date_cond = {}
    if von:
        date_cond["$gte"] = von
    if bis:
        date_cond["$lte"] = bis + "T23:59:59+00:00"
    if date_cond:
        q["$or"] = [{"received_at": date_cond}, {"created_at": date_cond}]
    return q


@router.get("/export")
async def export_anfragen(
    format: str = Query("json"),
    status: str = Query("alle"),
    von: Optional[str] = Query(None),
    bis: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    q = _build_query(status, von, bis)
    docs = await db.module_mail_inbox.find(q, {"_id": 0}).sort("received_at", -1).to_list(5000)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerow(CSV_COLUMNS)
        for d in docs:
            p = d.get("parsed") or {}
            name = (f"{p.get('vorname', '')} {p.get('nachname', '')}".strip()) or d.get("from_name") or ""
            datum = (d.get("received_at") or d.get("created_at") or "")[:16].replace("T", " ")
            w.writerow([
                datum, name,
                p.get("email") or d.get("from_email") or "",
                p.get("telefon") or "",
                d.get("status") or "",
                d.get("prioritaet_stufe") or "",
                d.get("subject") or "",
                (p.get("nachricht") or d.get("body_excerpt") or "").replace("\n", " "),
            ])
        return Response(
            content="\ufeff" + buf.getvalue(),  # BOM -> Excel zeigt Umlaute korrekt
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="mail_anfragen_{stamp}.csv"'},
        )

    return Response(
        content=json.dumps(docs, ensure_ascii=False, indent=2, default=str),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="mail_anfragen_{stamp}.json"'},
    )


async def _exists(doc: dict) -> bool:
    """Duplikat-Prüfung über message_id ODER content_hash."""
    mid = doc.get("message_id")
    if mid and await db.module_mail_inbox.find_one({"message_id": mid}, {"_id": 1}):
        return True
    chash = doc.get("content_hash")
    if chash and await db.module_mail_inbox.find_one({"content_hash": chash}, {"_id": 1}):
        return True
    return False


@router.post("/import")
async def import_anfragen(file: UploadFile = File(...), user=Depends(get_current_user)):
    try:
        raw = await file.read()
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Ungültige JSON-Datei")
    if not isinstance(data, list):
        raise HTTPException(400, "JSON muss eine Liste von Einträgen sein")

    neu, uebersprungen = 0, 0
    for d in data:
        if not isinstance(d, dict):
            uebersprungen += 1
            continue
        d.pop("_id", None)
        if await _exists(d):
            uebersprungen += 1
            continue
        if not d.get("status"):
            d["status"] = "vorschlag"
        await db.module_mail_inbox.insert_one(d)
        neu += 1

    return {"gesamt": len(data), "neu": neu, "uebersprungen": uebersprungen}
