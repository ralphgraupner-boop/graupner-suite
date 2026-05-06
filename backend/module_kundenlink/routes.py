"""module_kundenlink — Öffentliche Kunden-Links für Mitarbeiter (Probezeit-Version).

Ein Admin erzeugt für einen Kunden einen tokenbasierten Link, 30 Tage gültig.
Ein Mitarbeiter öffnet den Link auf dem Handy und sieht Basis-Daten:
Name, Adresse (Maps-Link), Kontakt (Anruf/Mail), Kategorien, Anliegen,
Bilder + PDFs. Keine Änderungen möglich.

Collection: module_kundenlink
{
  id: uuid,
  kunde_id: str,
  token: str (48 chars url-safe),
  created_at: iso-str,
  created_by: username,
  expires_at: iso-str (30 Tage),
  revoked: bool,
  revoked_at: iso-str | null,
  view_count: int,
  last_viewed_at: iso-str | null,
}

Später (wenn Programm fertig) wird das durch echte Monteur-App ersetzt.
"""
import secrets
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from database import db
from routes.auth import get_current_user
from utils.storage import put_object

router = APIRouter()

LINK_VALID_DAYS = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _sanitize_customer_for_public(kunde_id: str) -> dict | None:
    """Lädt Kunde und gibt nur die für Mitarbeiter relevanten Felder zurück."""
    k = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0})
    if not k:
        return None
    # Nur die sichtbaren Felder (keine internen Notizen, keine Abrechnungsdaten)
    # Notes (intern) werden bewusst NICHT mitgegeben.
    full_name = " ".join(filter(None, [k.get("vorname"), k.get("nachname")])).strip()
    if k.get("firma"):
        full_name = full_name or k["firma"]
    address_lines: list[str] = []
    street_line = " ".join(filter(None, [k.get("strasse"), k.get("hausnummer")])).strip()
    if street_line:
        address_lines.append(street_line)
    city_line = " ".join(filter(None, [k.get("plz"), k.get("ort")])).strip()
    if city_line:
        address_lines.append(city_line)
    # Objekt-Adresse (abweichend)
    objekt_address = None
    if k.get("objekt_strasse") or k.get("objekt_plz") or k.get("objekt_ort"):
        objekt_address = ", ".join(filter(None, [
            k.get("objekt_strasse"),
            " ".join(filter(None, [k.get("objekt_plz"), k.get("objekt_ort")])).strip(),
        ]))
    # Bilder + PDFs: URLs werden aus Object-Keys aufgebaut (öffentlicher
    # Storage-Endpoint /api/storage/{path}). Das Frontend ergänzt den
    # Backend-Origin (REACT_APP_BACKEND_URL).
    def _to_public_url(raw: str) -> str:
        if not raw:
            return ""
        # Schon vollständige URL? Lassen.
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
        # Schon mit /api/... → lassen
        if raw.startswith("/"):
            return raw
        return f"/api/storage/{raw.lstrip('/')}"

    files = []
    for f in (k.get("files") or []):
        files.append({
            "id": f.get("id"),
            "name": f.get("filename") or f.get("name"),
            "content_type": f.get("content_type", ""),
            "url": _to_public_url(f.get("url") or f.get("public_url") or f.get("path") or ""),
        })
    photos = []
    for p in (k.get("photos") or []):
        if isinstance(p, str):
            photos.append({"url": _to_public_url(p)})
        elif isinstance(p, dict):
            photos.append({
                "url": _to_public_url(p.get("url") or p.get("public_url") or p.get("path") or ""),
                "filename": p.get("filename") or "",
            })
    return {
        "name": full_name or "Unbekannt",
        "firma": k.get("firma") or "",
        "customer_type": k.get("customer_type") or "",
        "anrede": k.get("anrede") or "",
        "email": k.get("email") or "",
        "phone": k.get("phone") or "",
        "address_lines": address_lines,
        "address_plain": ", ".join(address_lines),
        "objekt_address": objekt_address,
        "categories": k.get("categories") or [],
        "nachricht": k.get("nachricht") or "",
        "status": k.get("status") or k.get("kontakt_status") or "",
        "photos": photos,
        "files": files,
    }


# ─────────── Admin-Endpoints (Login nötig) ───────────
@router.post("/create/{kunde_id}")
async def create_link(kunde_id: str, user=Depends(get_current_user)):
    """Erzeugt einen neuen Mitarbeiter-Link für den Kunden.
    Widerruft bestehende (noch gültige) Links derselben Person nicht,
    damit man mehrere Monteure gleichzeitig einladen kann."""
    k = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0, "id": 1})
    if not k:
        raise HTTPException(404, "Kunde nicht gefunden")
    now = _now()
    entry = {
        "id": str(uuid.uuid4()),
        "kunde_id": kunde_id,
        "token": secrets.token_urlsafe(36),
        "created_at": _iso(now),
        "created_by": getattr(user, "username", None),
        "expires_at": _iso(now + timedelta(days=LINK_VALID_DAYS)),
        "revoked": False,
        "revoked_at": None,
        "view_count": 0,
        "last_viewed_at": None,
    }
    await db.module_kundenlink.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.get("/list/{kunde_id}")
async def list_links(kunde_id: str, user=Depends(get_current_user)):
    """Alle Links eines Kunden (aktive und widerrufene/abgelaufene)."""
    out = []
    async for e in db.module_kundenlink.find({"kunde_id": kunde_id}, {"_id": 0}).sort("created_at", -1):
        out.append(e)
    return out


@router.post("/{link_id}/revoke")
async def revoke_link(link_id: str, user=Depends(get_current_user)):
    """Link sofort ungültig machen."""
    now = _now()
    r = await db.module_kundenlink.update_one(
        {"id": link_id},
        {"$set": {"revoked": True, "revoked_at": _iso(now)}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Link nicht gefunden")
    return {"ok": True}


@router.post("/{link_id}/extend")
async def extend_link(link_id: str, body: dict, user=Depends(get_current_user)):
    """Verlängert einen Mitarbeiter-Link.
    Body: { days: int }  – akzeptiert 1..90 Tage.
    Neue Ablaufzeit = max(jetzt, alter Ablauf) + days. So verschwendet
    eine vorzeitige Verlängerung keine Restlaufzeit.
    """
    days = int((body or {}).get("days") or 0)
    if days < 1 or days > 90:
        raise HTTPException(400, "days muss zwischen 1 und 90 liegen")
    link = await db.module_kundenlink.find_one({"id": link_id}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Link nicht gefunden")
    if link.get("revoked"):
        raise HTTPException(400, "Link wurde widerrufen")
    now = _now()
    try:
        old_exp = datetime.fromisoformat(link.get("expires_at", ""))
        if old_exp.tzinfo is None:
            old_exp = old_exp.replace(tzinfo=timezone.utc)
    except Exception:
        old_exp = now  # noqa: B904
    base = old_exp if old_exp > now else now
    new_exp = base + timedelta(days=days)
    await db.module_kundenlink.update_one(
        {"id": link_id},
        {"$set": {
            "expires_at": _iso(new_exp),
            "extended_at": _iso(now),
            "extended_by": getattr(user, "username", None),
        }, "$inc": {"extend_count": 1}},
    )
    return {"ok": True, "expires_at": _iso(new_exp)}


@router.get("/expiring")
async def expiring_links(days: int = 7, user=Depends(get_current_user)):
    """Liefert alle nicht-widerrufenen Links, die in den nächsten `days` Tagen
    ablaufen ODER bereits abgelaufen sind (für Startup-Check).
    Gibt Kundenname mit (Datenmaske: live aus module_kunden geladen).
    """
    if days < 0:
        days = 7
    now = _now()
    cutoff = now + timedelta(days=days)
    out = []
    async for link in db.module_kundenlink.find(
        {"revoked": {"$ne": True}},
        {"_id": 0},
    ).sort("expires_at", 1):
        try:
            exp = datetime.fromisoformat(link.get("expires_at", ""))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if exp > cutoff:
            continue
        # Kundenname dazuholen (Datenmaske)
        k = await db.module_kunden.find_one(
            {"id": link.get("kunde_id")},
            {"_id": 0, "vorname": 1, "nachname": 1, "firma": 1, "email": 1, "deleted_at": 1},
        )
        if not k or k.get("deleted_at"):
            # Kunde gelöscht → Link automatisch widerrufen, nicht anzeigen
            await db.module_kundenlink.update_one(
                {"id": link["id"]},
                {"$set": {"revoked": True, "revoked_at": _iso(now), "revoked_reason": "Kunde gelöscht"}},
            )
            continue
        kunde_name = " ".join(filter(None, [k.get("vorname"), k.get("nachname")])).strip() or k.get("firma") or k.get("email") or "Unbekannt"
        out.append({
            "id": link["id"],
            "kunde_id": link["kunde_id"],
            "kunde_name": kunde_name,
            "kunde_firma": k.get("firma") or "",
            "expires_at": link["expires_at"],
            "expired": exp < now,
            "days_remaining": int((exp - now).total_seconds() // 86400),
            "view_count": link.get("view_count", 0),
            "contribution_count": link.get("contribution_count", 0),
            "last_viewed_at": link.get("last_viewed_at"),
            "created_at": link.get("created_at"),
            "created_by": link.get("created_by"),
        })
    return out


# ─────────── Öffentlicher Endpoint (KEIN Login) ───────────
@router.get("/view/{token}")
async def view_by_token(token: str):
    """Wird vom Mitarbeiter per Link aufgerufen. Kein Login.
    Prüft Gültigkeit, erhöht Aufruf-Zähler, liefert sanitisierte Kundendaten."""
    link = await db.module_kundenlink.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Link ungültig")
    if link.get("revoked"):
        raise HTTPException(403, "Link wurde widerrufen")
    # Ablauf prüfen
    try:
        exp = datetime.fromisoformat(link.get("expires_at", ""))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(400, "Link-Datum ungültig")  # noqa: B904
    if _now() > exp:
        raise HTTPException(410, "Link ist abgelaufen")

    kunde = await _sanitize_customer_for_public(link["kunde_id"])
    if not kunde:
        raise HTTPException(404, "Zugehöriger Kunde nicht mehr vorhanden")

    # Zähler + Zeitstempel erhöhen
    await db.module_kundenlink.update_one(
        {"id": link["id"]},
        {"$inc": {"view_count": 1}, "$set": {"last_viewed_at": _iso(_now())}},
    )

    return {
        "expires_at": link["expires_at"],
        "created_at": link["created_at"],
        "kunde": kunde,
    }


# ─────────── Öffentliche Schreib-Endpoints (Mitarbeiter-Beitrag) ───────────
async def _validate_token_or_404(token: str) -> dict:
    """Holt Link, prüft Gültigkeit, wirft passende HTTPExceptions.
    Returns: das Link-Dokument (mit kunde_id) bei Erfolg.
    """
    link = await db.module_kundenlink.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Link ungültig")
    if link.get("revoked"):
        raise HTTPException(403, "Link wurde widerrufen")
    try:
        exp = datetime.fromisoformat(link.get("expires_at", ""))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(400, "Link-Datum ungültig")  # noqa: B904
    if _now() > exp:
        raise HTTPException(410, "Link ist abgelaufen")
    return link


@router.post("/view/{token}/note")
async def add_note(token: str, body: dict):
    """Mitarbeiter fügt eine Notiz dem Kunden hinzu (kein Login).
    Erwartet: { text: str, author?: str }
    Wirkung: An kunde.notes wird eine zeitgestempelte Mitarbeiter-Notiz
    angehängt mit Markierung '[Mitarbeiter ...]'.
    """
    link = await _validate_token_or_404(token)
    text = ((body or {}).get("text") or "").strip()
    if not text:
        raise HTTPException(400, "Text darf nicht leer sein")
    author = ((body or {}).get("author") or "").strip()
    if len(author) > 60:
        author = author[:60]
    now = _now()
    head = f"[{now.strftime('%d.%m.%Y %H:%M')} Mitarbeiter{(' ' + author) if author else ''}]"
    note_line = f"{head} {text}"

    kunde = await db.module_kunden.find_one({"id": link["kunde_id"]}, {"_id": 0, "notes": 1})
    if not kunde:
        raise HTTPException(404, "Kunde nicht mehr vorhanden")
    existing = (kunde.get("notes") or "").rstrip()
    new_notes = f"{existing}\n\n{note_line}" if existing else note_line
    await db.module_kunden.update_one(
        {"id": link["kunde_id"]},
        {"$set": {"notes": new_notes, "updated_at": _iso(now)}},
    )
    # Auch den Link selber als "wurde benutzt" markieren
    await db.module_kundenlink.update_one(
        {"id": link["id"]},
        {"$inc": {"contribution_count": 1}, "$set": {"last_contribution_at": _iso(now)}},
    )
    return {"ok": True, "note": note_line}


@router.post("/view/{token}/photo")
async def add_photo(
    token: str,
    file: UploadFile = File(...),
    author: str = Form(""),
):
    """Mitarbeiter lädt ein Foto in die Kunden-Galerie hoch (kein Login).
    Maximale Größe: 10 MB pro Foto.
    """
    link = await _validate_token_or_404(token)
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB
    content = await file.read()
    if not content:
        raise HTTPException(400, "Leere Datei")
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Datei zu groß (max. 10 MB)")
    ct = (file.content_type or "").lower()
    if not ct.startswith("image/"):
        raise HTTPException(400, "Nur Bilder erlaubt")

    safe_name = (file.filename or "foto.jpg").replace(" ", "_")
    storage_path = f"module_kunden/{link['kunde_id']}/m_{uuid.uuid4().hex[:8]}_{safe_name}"
    result = put_object(storage_path, content, ct)
    if not result:
        raise HTTPException(500, "Upload fehlgeschlagen")

    photo_entry = {
        "id": str(uuid.uuid4()),
        "url": storage_path,  # interner Object-Key, view_by_token wandelt um
        "filename": safe_name,
        "content_type": ct,
        "uploaded_at": _iso(_now()),
        "uploaded_by_link": link["id"],
        "uploaded_by_label": (author or "").strip()[:60] or "Mitarbeiter",
    }
    await db.module_kunden.update_one(
        {"id": link["kunde_id"]},
        {
            "$push": {"photos": photo_entry},
            "$set": {"updated_at": _iso(_now())},
        },
    )
    await db.module_kundenlink.update_one(
        {"id": link["id"]},
        {"$inc": {"contribution_count": 1}, "$set": {"last_contribution_at": _iso(_now())}},
    )
    return {"ok": True, "photo": {"url": f"/api/storage/{storage_path}", "filename": safe_name}}
