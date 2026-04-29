"""
Routes für module_export – Kunden-Komplett-Export & Re-Import als ZIP.

Endpunkte:
- GET  /api/module-export/preview/{kunde_id}     → Übersicht was im Export wäre
- GET  /api/module-export/kunde/{kunde_id}/zip   → Komplett-ZIP des Kunden
- GET  /api/module-export/alle/zip               → ALLE Kunden in einem ZIP (Backup-Use-Case)
- POST /api/module-export/import                 → ZIP hochladen, neue UUIDs vergeben, importieren
- GET  /api/module-export/log                    → Log letzter Aktionen
"""
import io
import json
import zipfile
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse

from database import db, logger
from routes.auth import get_current_user
from utils.storage import get_object, put_object
from .collector import collect_kunde, count_summary

router = APIRouter()

SCHEMA_VERSION = "1.0"


def _safe_filename(s: str) -> str:
    keep = "-_."
    return "".join(c if c.isalnum() or c in keep else "_" for c in (s or "export"))[:80]


# ==================== PREVIEW ====================

@router.get("/preview/{kunde_id}")
async def preview(kunde_id: str, user=Depends(get_current_user)):
    data, file_refs = await collect_kunde(kunde_id)
    if not data.get("kunde"):
        raise HTTPException(404, "Kunde nicht gefunden")
    summary = count_summary(data)
    summary["dateien"] = len(file_refs)
    summary["kunde_name"] = data["kunde"].get("name", "")
    return summary


# ==================== EXPORT EINZELNER KUNDE ====================

async def _build_zip_for_kunde(kunde_id: str) -> tuple[bytes, str]:
    """Erzeugt ZIP-Bytes + Dateiname für einen Kunden."""
    data, file_refs = await collect_kunde(kunde_id)
    if not data.get("kunde"):
        raise HTTPException(404, "Kunde nicht gefunden")

    kunde_name = data["kunde"].get("nachname") or data["kunde"].get("name") or kunde_id
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    zip_name = f"export-{_safe_filename(kunde_name)}-{today}.zip"

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "kunde_id": kunde_id,
        "kunde_name": data["kunde"].get("name", ""),
        "summary": count_summary(data),
        "file_count": len(file_refs),
        "source": "graupner-suite",
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        for key, value in data.items():
            zf.writestr(f"{key}.json", json.dumps(value, indent=2, ensure_ascii=False, default=str))

        # Files aus Storage holen (best-effort, nicht abbrechen bei einzelnem Fehler)
        seen = set()
        for storage_path, label in file_refs:
            if storage_path in seen:
                continue
            seen.add(storage_path)
            try:
                content, _ct = get_object(storage_path)
                zf.writestr(label, content)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"export: Datei {storage_path} konnte nicht geladen werden: {e}")
                zf.writestr(f"{label}.MISSING.txt", f"storage_path: {storage_path}\nfehler: {e}")

    buf.seek(0)
    zip_bytes = buf.read()

    # Audit-Log
    await db.module_export_log.insert_one({
        "id": str(uuid.uuid4()),
        "action": "export_kunde",
        "kunde_id": kunde_id,
        "kunde_name": data["kunde"].get("name", ""),
        "summary": manifest["summary"],
        "size_bytes": len(zip_bytes),
        "file_count": len(file_refs),
        "filename": zip_name,
        "user": getattr(user_state.get("user"), "username", None) if False else None,  # placeholder
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return zip_bytes, zip_name


# helper zum Zugriff auf user (Schliessen über Depends)
user_state: dict = {}


@router.get("/kunde/{kunde_id}/zip")
async def export_kunde_zip(kunde_id: str, user=Depends(get_current_user)):
    user_state["user"] = user
    zip_bytes, zip_name = await _build_zip_for_kunde(kunde_id)
    headers = {"Content-Disposition": f'attachment; filename="{zip_name}"'}
    return StreamingResponse(io.BytesIO(zip_bytes), media_type="application/zip", headers=headers)


# ==================== EXPORT ALLE KUNDEN ====================

@router.get("/alle/zip")
async def export_alle_kunden(user=Depends(get_current_user)):
    user_state["user"] = user
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    out_buf = io.BytesIO()
    total_files = 0
    kunden_count = 0
    with zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as outer:
        async for c in db.customers.find({}, {"_id": 0, "id": 1, "name": 1, "nachname": 1}):
            try:
                zip_bytes, zip_name = await _build_zip_for_kunde(c["id"])
                outer.writestr(zip_name, zip_bytes)
                total_files += 1
                kunden_count += 1
            except Exception as e:  # noqa: BLE001
                logger.warning(f"export-alle: Kunde {c.get('id')} fehlgeschlagen: {e}")
        # Master-Manifest
        outer.writestr("export-manifest.json", json.dumps({
            "schema_version": SCHEMA_VERSION,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "kunden_total": kunden_count,
            "files_total": total_files,
        }, indent=2, ensure_ascii=False))
    out_buf.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="graupner-suite-alle-kunden-{today}.zip"'}
    return StreamingResponse(io.BytesIO(out_buf.read()), media_type="application/zip", headers=headers)


# ==================== EXPORT MEHRERE KUNDEN (MULTI-SELECT) ====================

from pydantic import BaseModel  # noqa: E402


class MultiSelectRequest(BaseModel):
    kunde_ids: list[str]


@router.post("/multi/zip")
async def export_multi_kunden(req: MultiSelectRequest, user=Depends(get_current_user)):
    user_state["user"] = user
    if not req.kunde_ids:
        raise HTTPException(400, "kunde_ids leer")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    out_buf = io.BytesIO()
    success = 0
    failed: list[str] = []
    with zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as outer:
        for kid in req.kunde_ids:
            try:
                zip_bytes, zip_name = await _build_zip_for_kunde(kid)
                outer.writestr(zip_name, zip_bytes)
                success += 1
            except Exception as e:  # noqa: BLE001
                failed.append(f"{kid}: {e}")
                logger.warning(f"export-multi: Kunde {kid} fehlgeschlagen: {e}")
        outer.writestr("export-manifest.json", json.dumps({
            "schema_version": SCHEMA_VERSION,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "kunden_requested": len(req.kunde_ids),
            "kunden_success": success,
            "failed": failed,
        }, indent=2, ensure_ascii=False))
    out_buf.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="graupner-suite-{success}-kunden-{today}.zip"'}
    return StreamingResponse(io.BytesIO(out_buf.read()), media_type="application/zip", headers=headers)



# ==================== IMPORT ====================

class ImportResult(dict):
    pass


def _new_id() -> str:
    return str(uuid.uuid4())


def _remap_refs(doc: dict, id_map: dict) -> dict:
    """Tauscht alle bekannten Ref-Felder gegen neue IDs."""
    if not isinstance(doc, dict):
        return doc
    out = dict(doc)
    for k in ("kunde_id", "customer_id", "projekt_id", "einsatz_id", "portal_id", "account_id"):
        if k in out and out[k] in id_map:
            out[k] = id_map[out[k]]
    return out


@router.post("/import")
async def import_zip(
    file: UploadFile = File(...),
    mode: str = Query("new_ids", regex="^(new_ids|overwrite)$"),
    user=Depends(get_current_user),
):
    """
    mode=new_ids   → vergibt komplett neue UUIDs, alter Kunde bleibt unberührt (Default)
    mode=overwrite → behält IDs, überschreibt vorhandene Datensätze (gefährlich!)
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Nur .zip Dateien erlaubt")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Leere Datei")

    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise HTTPException(400, "Beschädigtes ZIP")

    names = set(zf.namelist())
    if "manifest.json" not in names:
        raise HTTPException(400, "ZIP enthält keine manifest.json (kein Graupner-Suite-Export)")

    manifest = json.loads(zf.read("manifest.json"))
    if manifest.get("source") != "graupner-suite":
        raise HTTPException(400, "ZIP stammt nicht aus Graupner Suite")

    def load(name: str):
        if name in names:
            return json.loads(zf.read(name))
        return None

    kunde = load("kunde.json") or {}
    if not kunde:
        raise HTTPException(400, "kunde.json fehlt")

    id_map: dict = {}

    # 1. Kunde
    old_kunde_id = kunde.get("id")
    if mode == "new_ids":
        new_kunde_id = _new_id()
        kunde["id"] = new_kunde_id
        id_map[old_kunde_id] = new_kunde_id
        # Anti-Duplikat-Check (best-effort, kein blocker)
        existing = await db.customers.find_one(
            {"name": kunde.get("name"), "email": kunde.get("email")},
            {"_id": 0, "id": 1},
        ) if kunde.get("email") else None
        if existing:
            kunde["name"] = (kunde.get("name", "") + " (Import)").strip()
        kunde["created_at"] = datetime.now(timezone.utc).isoformat()
        kunde["imported_at"] = datetime.now(timezone.utc).isoformat()
    await db.customers.insert_one(dict(kunde))

    # 2. Projekte
    projekte = load("projekte.json") or []
    pcount = 0
    for p in projekte:
        old = p.get("id")
        if mode == "new_ids":
            p["id"] = _new_id()
            id_map[old] = p["id"]
        p = _remap_refs(p, id_map)
        await db.module_projekte.insert_one(p)
        pcount += 1

    # 3. Einsätze (vor Aufgaben/Termine, weil monteur sie braucht)
    einsaetze = load("einsaetze.json") or []
    ecount = 0
    for e in einsaetze:
        old = e.get("id")
        if mode == "new_ids":
            e["id"] = _new_id()
            id_map[old] = e["id"]
        e = _remap_refs(e, id_map)
        await db.einsaetze.insert_one(e)
        ecount += 1

    # 4. Aufgaben
    aufgaben = load("aufgaben.json") or []
    acount = 0
    for a in aufgaben:
        old = a.get("id")
        if mode == "new_ids":
            a["id"] = _new_id()
        a = _remap_refs(a, id_map)
        await db.module_aufgaben.insert_one(a)
        acount += 1

    # 5. Termine
    termine = load("termine.json") or []
    tcount = 0
    for t in termine:
        old = t.get("id")
        if mode == "new_ids":
            t["id"] = _new_id()
        t = _remap_refs(t, id_map)
        await db.module_termine.insert_one(t)
        tcount += 1

    # 6. Quotes & Rechnungen
    qcount = 0
    for q in (load("quotes.json") or []):
        if mode == "new_ids":
            q["id"] = _new_id()
        q = _remap_refs(q, id_map)
        await db.quotes.insert_one(q)
        qcount += 1
    rcount = 0
    for r in (load("rechnungen.json") or []):
        if mode == "new_ids":
            r["id"] = _new_id()
        r = _remap_refs(r, id_map)
        await db.rechnungen_v2.insert_one(r)
        rcount += 1

    # 7. Portale (nur Stammdaten neu, Aktivität optional)
    portcount = 0
    portale = load("portale.json") or {}
    portal_label_to_col = {
        "portal": "portals",
        "portal_klon": "portals_klon",
        "portal_v2": "portal2_accounts",
        "portal_v3": "portal3_accounts",
        "portal_v4": "portal4_accounts",
    }
    for label, accs in portale.items():
        col = portal_label_to_col.get(label)
        if not col:
            continue
        for acc in accs:
            old = acc.get("id")
            if mode == "new_ids":
                acc["id"] = _new_id()
                id_map[old] = acc["id"]
            acc = _remap_refs(acc, id_map)
            await db[col].insert_one(acc)
            portcount += 1

    # 8. Files aus dem ZIP zurück in Object-Storage
    file_count = 0
    for n in names:
        if not n.startswith("files/"):
            continue
        try:
            content = zf.read(n)
            # Wir erzeugen einen neuen Storage-Path im "import-{datum}/"-Bereich
            new_path = f"imports/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}/{n}"
            put_object(new_path, content, "application/octet-stream")
            file_count += 1
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Import: Datei {n} konnte nicht geschrieben werden: {e}")

    # Log
    result = {
        "imported_kunde_id": kunde["id"],
        "kunde_name": kunde.get("name", ""),
        "projekte": pcount,
        "einsaetze": ecount,
        "aufgaben": acount,
        "termine": tcount,
        "quotes": qcount,
        "rechnungen": rcount,
        "portale": portcount,
        "files": file_count,
        "mode": mode,
    }
    await db.module_export_log.insert_one({
        "id": _new_id(),
        "action": "import",
        "result": result,
        "manifest_version": manifest.get("schema_version"),
        "user": getattr(user, "username", None),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return result


# ==================== LOG ====================

@router.get("/log")
async def get_log(limit: int = 50, user=Depends(get_current_user)):
    items = []
    async for d in db.module_export_log.find({}, {"_id": 0}).sort("created_at", -1).limit(limit):
        items.append(d)
    return items
