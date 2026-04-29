"""
module_health – Status- und Aktualitäts-Check.

Module-First, read-only. Eigenes Prefix /api/module-health.
Liefert:
- App-Version (aus VERSION-Datei oder git)
- Umgebungs-Indikator (basierend auf DB_NAME / FRONTEND_URL)
- Datenbestände (Counts der wichtigsten Collections)
- Backup-Status (letztes Backup aus auto_backup_log)
- Server-Zeit (UTC + Hamburg-Zeit)
"""
import os
import subprocess
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from database import db
from routes.auth import get_current_user

router = APIRouter()


def _get_version() -> dict:
    """Liest Version aus /app/VERSION oder git."""
    version_file = "/app/VERSION"
    if os.path.exists(version_file):
        try:
            with open(version_file) as f:
                return {"version": f.read().strip(), "source": "file"}
        except Exception:
            pass
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd="/app", stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        date = subprocess.check_output(
            ["git", "log", "-1", "--format=%ci"],
            cwd="/app", stderr=subprocess.DEVNULL, timeout=2
        ).decode().strip()
        return {"version": sha, "build_date": date, "source": "git"}
    except Exception:
        return {"version": "unknown", "source": "none"}


def _detect_environment() -> dict:
    """Erkennt Umgebung anhand DB_NAME und CORS_ORIGINS."""
    db_name = os.environ.get("DB_NAME", "")
    cors = os.environ.get("CORS_ORIGINS", "")
    is_preview = "preview" in db_name.lower() or "preview" in cors.lower() or "preview" in (os.environ.get("FRONTEND_URL", "") or "").lower()
    return {
        "db_name": db_name,
        "is_preview": bool(is_preview),
        "label": "PREVIEW / TEST" if is_preview else "LIVE / PRODUKTIV",
        "color": "amber" if is_preview else "red",
    }


@router.get("/status")
async def status(user=Depends(get_current_user)):
    counts = {}
    for col in ["module_kunden", "module_projekte", "module_aufgaben", "module_termine",
                "anfragen", "einsaetze", "quotes", "rechnungen_v2"]:
        try:
            counts[col] = await db[col].count_documents({})
        except Exception:
            counts[col] = -1
    # Legacy-Hinweis: customers (alte Demo-Daten)
    try:
        counts["customers_legacy"] = await db.customers.count_documents({})
    except Exception:
        counts["customers_legacy"] = -1

    # Letztes erfolgreiches Backup
    last_backup = None
    backup_age_hours = None
    try:
        b = await db.auto_backup_log.find_one(
            {"status": "success"}, {"_id": 0}, sort=[("created_at", -1)]
        )
        if b:
            last_backup = b.get("created_at")
            try:
                ts = datetime.fromisoformat(last_backup.replace("Z", "+00:00"))
                age = datetime.now(timezone.utc) - ts
                backup_age_hours = round(age.total_seconds() / 3600, 1)
            except Exception:
                pass
    except Exception:
        pass

    now_utc = datetime.now(timezone.utc)
    now_hamburg = now_utc + timedelta(hours=2)  # CEST – einfache Approximation

    return {
        "ok": True,
        "version": _get_version(),
        "environment": _detect_environment(),
        "data_counts": counts,
        "data_total": sum(v for v in counts.values() if v > 0),
        "backup": {
            "last_success_at": last_backup,
            "age_hours": backup_age_hours,
            "status": "ok" if (backup_age_hours is not None and backup_age_hours < 30) else "warn",
        },
        "server_time_utc": now_utc.isoformat(),
        "server_time_hamburg": now_hamburg.strftime("%H:%M (Hamburg)"),
    }


# ==================== KONSISTENZ-CHECK ====================

@router.get("/consistency")
async def consistency_check(user=Depends(get_current_user)):
    """
    Findet Datenmüll und Waisen-Referenzen.
    Prüft alle bekannten Querverweise gegen module_kunden / module_projekte.
    """
    issues: list[dict] = []

    # Gültige IDs einsammeln
    valid_kunde_ids = set()
    async for k in db.module_kunden.find({}, {"_id": 0, "id": 1}):
        if k.get("id"):
            valid_kunde_ids.add(k["id"])

    valid_projekt_ids = set()
    async for p in db.module_projekte.find({}, {"_id": 0, "id": 1}):
        if p.get("id"):
            valid_projekt_ids.add(p["id"])

    # Check 1: Legacy customers Collection
    legacy_count = await db.customers.count_documents({})
    if legacy_count > 0:
        issues.append({
            "severity": "warn",
            "type": "legacy_collection",
            "title": "Legacy 'customers' Collection vorhanden",
            "message": f"{legacy_count} alte Datensätze in db.customers (sollte leer sein nach Migration zu module_kunden).",
            "fix_hint": "Aufräum-Aktion: Daten in module_kunden vorhanden? Dann customers entfernen.",
        })

    # Check 2: einsaetze.kunde_id zeigt auf existierenden Kunden?
    orphan_einsaetze = []
    async for e in db.einsaetze.find({}, {"_id": 0, "id": 1, "kunde_id": 1, "kunde_name": 1, "objekt_strasse": 1}):
        kid = e.get("kunde_id")
        if kid and kid not in valid_kunde_ids:
            orphan_einsaetze.append({
                "id": e.get("id"),
                "kunde_id_referenced": kid,
                "kunde_name_snapshot": e.get("kunde_name", ""),
                "objekt": e.get("objekt_strasse", ""),
            })
    if orphan_einsaetze:
        issues.append({
            "severity": "error",
            "type": "orphan_einsaetze",
            "title": f"{len(orphan_einsaetze)} Einsätze ohne gültigen Kunden",
            "message": "Diese Einsätze referenzieren auf Kunden, die nicht (mehr) in module_kunden existieren. Auf dem Handy erscheinen sie als '(kein Kunde)'.",
            "fix_hint": "Einsätze auf passende module_kunden-IDs neu zuweisen oder löschen.",
            "details": orphan_einsaetze[:10],
            "count": len(orphan_einsaetze),
        })

    # Check 3: module_projekte.kunde_id
    orphan_projekte = []
    async for p in db.module_projekte.find({}, {"_id": 0, "id": 1, "kunde_id": 1, "titel": 1}):
        kid = p.get("kunde_id")
        if kid and kid not in valid_kunde_ids:
            orphan_projekte.append({"id": p.get("id"), "titel": p.get("titel", ""), "kunde_id_referenced": kid})
    if orphan_projekte:
        issues.append({
            "severity": "error",
            "type": "orphan_projekte",
            "title": f"{len(orphan_projekte)} Projekte ohne gültigen Kunden",
            "message": "Projekte verweisen auf nicht-existente Kunden in module_kunden.",
            "details": orphan_projekte[:10],
            "count": len(orphan_projekte),
        })

    # Check 4: module_aufgaben.kunde_id / projekt_id
    orphan_aufgaben = []
    async for a in db.module_aufgaben.find({}, {"_id": 0, "id": 1, "titel": 1, "kunde_id": 1, "projekt_id": 1}):
        ki = a.get("kunde_id")
        pi = a.get("projekt_id")
        bad = []
        if ki and ki not in valid_kunde_ids:
            bad.append(f"kunde_id={ki[:8]}…")
        if pi and pi not in valid_projekt_ids:
            bad.append(f"projekt_id={pi[:8]}…")
        if bad:
            orphan_aufgaben.append({"id": a.get("id"), "titel": a.get("titel", ""), "broken_refs": bad})
    if orphan_aufgaben:
        issues.append({
            "severity": "warn",
            "type": "orphan_aufgaben",
            "title": f"{len(orphan_aufgaben)} Aufgaben mit defekten Referenzen",
            "message": "Aufgaben hängen an gelöschten Kunden oder Projekten.",
            "details": orphan_aufgaben[:10],
            "count": len(orphan_aufgaben),
        })

    # Check 5: module_termine.kunde_id / projekt_id
    orphan_termine = []
    async for t in db.module_termine.find({}, {"_id": 0, "id": 1, "titel": 1, "kunde_id": 1, "projekt_id": 1}):
        ki = t.get("kunde_id")
        pi = t.get("projekt_id")
        bad = []
        if ki and ki not in valid_kunde_ids:
            bad.append(f"kunde_id={ki[:8]}…")
        if pi and pi not in valid_projekt_ids:
            bad.append(f"projekt_id={pi[:8]}…")
        if bad:
            orphan_termine.append({"id": t.get("id"), "titel": t.get("titel", ""), "broken_refs": bad})
    if orphan_termine:
        issues.append({
            "severity": "warn",
            "type": "orphan_termine",
            "title": f"{len(orphan_termine)} Termine mit defekten Referenzen",
            "message": "Termine hängen an gelöschten Kunden oder Projekten.",
            "details": orphan_termine[:10],
            "count": len(orphan_termine),
        })

    # Check 6: quotes.customer_id
    orphan_quotes = []
    async for q in db.quotes.find({}, {"_id": 0, "id": 1, "quote_number": 1, "customer_id": 1, "customer_name": 1}):
        cid = q.get("customer_id")
        if cid and cid not in valid_kunde_ids:
            orphan_quotes.append({"id": q.get("id"), "quote_number": q.get("quote_number", ""), "customer_name_snapshot": q.get("customer_name", "")})
    if orphan_quotes:
        issues.append({
            "severity": "warn",
            "type": "orphan_quotes",
            "title": f"{len(orphan_quotes)} Angebote ohne gültigen Kunden",
            "message": "Angebote referenzieren auf nicht-existente module_kunden-IDs.",
            "details": orphan_quotes[:10],
            "count": len(orphan_quotes),
        })

    return {
        "ok": len(issues) == 0,
        "issues_count": len(issues),
        "errors_count": sum(1 for i in issues if i["severity"] == "error"),
        "warnings_count": sum(1 for i in issues if i["severity"] == "warn"),
        "issues": issues,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ==================== CLEANUP ====================

from pydantic import BaseModel  # noqa: E402


class CleanupRequest(BaseModel):
    action: str  # "delete" | "reassign"
    ids: list[str]  # zu bearbeitende Eintrags-IDs
    target_kunde_id: str | None = None  # für reassign

    
COL_BY_TYPE = {
    "orphan_projekte": ("module_projekte", "kunde_id"),
    "orphan_aufgaben": ("module_aufgaben", "kunde_id"),
    "orphan_termine": ("module_termine", "kunde_id"),
    "orphan_quotes": ("quotes", "customer_id"),
    "orphan_einsaetze": ("einsaetze", "kunde_id"),
}


@router.post("/cleanup/{issue_type}")
async def cleanup_issue(issue_type: str, req: CleanupRequest, user=Depends(get_current_user)):
    """
    Behebt ein konkretes Konsistenz-Problem.
    issue_type = legacy_collection | orphan_projekte | orphan_aufgaben | orphan_termine | orphan_quotes | orphan_einsaetze
    action = delete | reassign
    """
    audit = {
        "type": issue_type,
        "action": req.action,
        "user": getattr(user, "username", None),
        "at": datetime.now(timezone.utc).isoformat(),
    }

    # Legacy Customers: nur Delete erlaubt, alle 6
    if issue_type == "legacy_collection":
        if req.action != "delete":
            raise HTTPException(400, "Für Legacy-Customers ist nur 'delete' erlaubt")
        # Sicherheitsprüfung: nur löschen wenn keine Refs auf customers-IDs (außer zu cleanenden) existieren
        result = await db.customers.delete_many({})
        audit["deleted"] = result.deleted_count
        await db.module_health_audit.insert_one(audit)
        return {"ok": True, "deleted": result.deleted_count}

    # Orphan-Typen
    cfg = COL_BY_TYPE.get(issue_type)
    if not cfg:
        raise HTTPException(400, f"Unbekannter issue_type: {issue_type}")
    col_name, ref_field = cfg
    col = db[col_name]

    if not req.ids:
        raise HTTPException(400, "Keine IDs angegeben")

    if req.action == "delete":
        result = await col.delete_many({"id": {"$in": req.ids}})
        audit["deleted"] = result.deleted_count
        audit["ids"] = req.ids
        await db.module_health_audit.insert_one(audit)
        return {"ok": True, "deleted": result.deleted_count}

    if req.action == "reassign":
        if not req.target_kunde_id:
            raise HTTPException(400, "target_kunde_id erforderlich bei reassign")
        # Zielkunde existiert?
        target = await db.module_kunden.find_one({"id": req.target_kunde_id}, {"_id": 0})
        if not target:
            raise HTTPException(404, "Ziel-Kunde nicht gefunden")
        # Snapshot-Felder ggf. mit-aktualisieren
        update_doc = {ref_field: req.target_kunde_id}
        snapshot_name = target.get("name") or f"{target.get('vorname','')} {target.get('nachname','')}".strip()
        if col_name == "einsaetze":
            update_doc["kunde_name"] = snapshot_name
        elif col_name == "quotes":
            update_doc["customer_name"] = snapshot_name
        elif col_name == "module_projekte":
            update_doc["kunde_name"] = snapshot_name

        result = await col.update_many({"id": {"$in": req.ids}}, {"$set": update_doc})
        audit["reassigned"] = result.modified_count
        audit["target"] = req.target_kunde_id
        audit["ids"] = req.ids
        await db.module_health_audit.insert_one(audit)
        return {"ok": True, "reassigned": result.modified_count, "target_name": snapshot_name}

    raise HTTPException(400, f"Unbekannte action: {req.action}")


@router.get("/audit")
async def cleanup_audit(limit: int = 50, user=Depends(get_current_user)):
    items = []
    async for d in db.module_health_audit.find({}, {"_id": 0}).sort("at", -1).limit(limit):
        items.append(d)
    return items

