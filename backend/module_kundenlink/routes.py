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

from fastapi import APIRouter, Depends, HTTPException

from database import db
from routes.auth import get_current_user

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
    # Bilder + PDFs: nur die photo_urls / files (IDs), das Frontend lädt sie über die
    # bestehenden öffentlichen Endpoints (falls vorhanden). Für die Probezeit
    # reichen die URLs als Anzeige-Pfad.
    files = []
    for f in (k.get("files") or []):
        files.append({
            "id": f.get("id"),
            "name": f.get("filename") or f.get("name"),
            "content_type": f.get("content_type", ""),
            "url": f.get("url") or f.get("public_url") or "",
        })
    photos = []
    for p in (k.get("photos") or []):
        if isinstance(p, str):
            photos.append({"url": p})
        elif isinstance(p, dict):
            photos.append({"url": p.get("url") or p.get("public_url") or ""})
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
