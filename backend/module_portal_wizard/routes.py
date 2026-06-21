"""module_portal_wizard — Backend-Routen für das neue Kundenportal.

Vier Endpunkte unter dem Prefix /api/kundenportal:
  POST /link-erstellen      (Auth)        — Token erzeugen, Eintrag anlegen
  GET  /portal/{token}      (öffentlich)  — Kundendaten + Auftrag, Status->geoeffnet
  POST /eingang/{token}     (öffentlich)  — Nachricht/Fotos speichern, Status->genutzt
  GET  /status/{kunde_id}   (Auth)        — aktueller Portal-Status für Listen
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from uuid import uuid4

from database import db, logger
from auth import get_current_user
from utils import send_email, get_portal_bcc

router = APIRouter(prefix="/kundenportal", tags=["kundenportal"])

COLLECTION = "module_portal_wizard"

VALID_STATUS = {"link_erstellt", "geoeffnet", "genutzt"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/link-erstellen")
async def link_erstellen(data: dict, request: Request, user=Depends(get_current_user)):
    """Erzeugt einen eindeutigen Portal-Link für einen Kunden (+ optional Projekt)
    und schickt dem Kunden automatisch eine freundliche Mail mit dem Link
    (Kopie an die konfigurierte Portal-BCC-Adresse)."""
    kunde_id = (data.get("kunde_id") or "").strip()
    if not kunde_id:
        raise HTTPException(400, "kunde_id ist erforderlich")
    auftrag_text = (data.get("auftrag_text") or "").strip()
    projekt_id = (data.get("projekt_id") or "").strip() or None

    token = uuid4().hex
    doc = {
        "id": str(uuid4()),
        "kunde_id": kunde_id,
        "projekt_id": projekt_id,
        "portal_token": token,
        "auftrag_text": auftrag_text,
        "status": "link_erstellt",
        "erstellt_am": _now(),
        "geoeffnet_am": None,
        "genutzt_am": None,
        "eingegangen": {"nachricht": None, "fotos": []},
    }
    await db[COLLECTION].insert_one(doc)

    # Basis-URL aus Request-Header ableiten (Frontend ist tabu) -> vollen Link bauen
    base = (request.headers.get("origin") or "").strip()
    if not base:
        ref = (request.headers.get("referer") or "").strip()
        if ref:
            from urllib.parse import urlparse
            p = urlparse(ref)
            if p.scheme and p.netloc:
                base = f"{p.scheme}://{p.netloc}"
    portal_path = f"/kundenportal/{token}"
    full_link = f"{base.rstrip('/')}{portal_path}" if base else portal_path

    # Kundendaten für Anrede + Empfänger-Mail
    kunde = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0})
    customer_email = ((kunde or {}).get("email") or "").strip()
    kunde_name = ""
    if kunde:
        kunde_name = kunde.get("firma") or " ".join(
            x for x in [kunde.get("vorname"), kunde.get("nachname")] if x
        ) or ""

    mail_sent = False
    if customer_email and "@" in customer_email and base:
        anrede = f"Guten Tag{', ' + kunde_name if kunde_name else ''},"
        auftrag_block = (
            f'<p style="background:#f0f7f2;border-left:4px solid #1a6e3c;padding:10px 14px;margin:14px 0;">{auftrag_text}</p>'
            if auftrag_text else ""
        )
        body_html = (
            f"<p>{anrede}</p>"
            f"<p>vielen Dank für Ihre Anfrage. Über unser Kundenportal können Sie uns ganz "
            f"einfach eine Nachricht und Fotos schicken — Schritt für Schritt.</p>"
            f"{auftrag_block}"
            f'<p><a href="{full_link}" style="display:inline-block;background:#1a6e3c;color:#fff;'
            f'padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Zum Kundenportal</a></p>'
            f'<p>Oder kopieren Sie diesen Link in Ihren Browser:<br>'
            f'<a href="{full_link}">{full_link}</a></p>'
            f"<p>Freundliche Grüße<br>Ihre Tischlerei Graupner</p>"
        )
        try:
            send_email(
                to_email=customer_email,
                subject="Ihr persönliches Kundenportal – Tischlerei Graupner",
                body_html=body_html,
                bcc=await get_portal_bcc(),
            )
            mail_sent = True
        except Exception as e:
            logger.error(f"Portal-Wizard Mailversand fehlgeschlagen: {e}")

    return {
        "ok": True,
        "portal_token": token,
        "portal_link": portal_path,
        "status": "link_erstellt",
        "mail_sent": mail_sent,
        "customer_email": customer_email or None,
    }


@router.get("/portal/{token}")
async def portal_oeffnen(token: str):
    """Öffentlich: liefert Kundendaten + Auftrag und markiert das Portal als geöffnet."""
    doc = await db[COLLECTION].find_one({"portal_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Portal-Link ungültig oder abgelaufen")

    # Status nur hochsetzen, wenn noch nicht genutzt (genutzt bleibt der höchste Stand)
    if doc.get("status") == "link_erstellt":
        await db[COLLECTION].update_one(
            {"portal_token": token},
            {"$set": {"status": "geoeffnet", "geoeffnet_am": _now()}},
        )
        doc["status"] = "geoeffnet"
        doc["geoeffnet_am"] = doc.get("geoeffnet_am") or _now()

    kunde = await db.module_kunden.find_one({"id": doc.get("kunde_id")}, {"_id": 0})
    kunde_info = None
    if kunde:
        name = kunde.get("firma") or " ".join(
            x for x in [kunde.get("vorname"), kunde.get("nachname")] if x
        ) or "Kunde"
        kunde_info = {
            "id": kunde.get("id"),
            "name": name,
            "anrede": kunde.get("anrede"),
        }

    return {
        "portal_token": token,
        "status": doc.get("status"),
        "auftrag_text": doc.get("auftrag_text") or "",
        "kunde": kunde_info,
        "eingegangen": doc.get("eingegangen") or {"nachricht": None, "fotos": []},
    }


@router.post("/eingang/{token}")
async def eingang_speichern(token: str, data: dict):
    """Öffentlich: speichert Nachricht/Fotos des Kunden und setzt Status auf genutzt."""
    doc = await db[COLLECTION].find_one({"portal_token": token})
    if not doc:
        raise HTTPException(404, "Portal-Link ungültig oder abgelaufen")

    nachricht = data.get("nachricht")
    fotos = data.get("fotos") or []
    if not isinstance(fotos, list):
        raise HTTPException(400, "fotos muss eine Liste sein")

    await db[COLLECTION].update_one(
        {"portal_token": token},
        {"$set": {
            "eingegangen": {
                "nachricht": (nachricht or "").strip() or None,
                "fotos": [str(f) for f in fotos],
            },
            "status": "genutzt",
            "genutzt_am": _now(),
        }},
    )
    return {"ok": True, "status": "genutzt"}


@router.get("/admin/liste")
async def admin_liste(user=Depends(get_current_user)):
    """Zentrale Übersicht für das Kundenportal-Modul: alle Portal-Einträge,
    verknüpft mit Kundenname/-mail. Eine Anfrage, kein Call pro Kunde."""
    docs = await db[COLLECTION].find({}, {"_id": 0}).sort("erstellt_am", -1).to_list(100000)
    kunden = await db.module_kunden.find({}, {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "firma": 1, "email": 1}).to_list(100000)
    kmap = {}
    for k in kunden:
        name = k.get("firma") or " ".join(x for x in [k.get("vorname"), k.get("nachname")] if x) or ""
        kmap[k.get("id")] = {"name": name, "email": k.get("email")}
    out = []
    for d in docs:
        info = kmap.get(d.get("kunde_id")) or {}
        eingegangen = d.get("eingegangen") or {"nachricht": None, "fotos": []}
        out.append({
            "id": d.get("id"),
            "kunde_id": d.get("kunde_id"),
            "kunde_name": info.get("name") or "(unbekannt)",
            "kunde_email": info.get("email"),
            "portal_token": d.get("portal_token"),
            "auftrag_text": d.get("auftrag_text") or "",
            "status": d.get("status"),
            "erstellt_am": d.get("erstellt_am"),
            "geoeffnet_am": d.get("geoeffnet_am"),
            "genutzt_am": d.get("genutzt_am"),
            "nachricht": eingegangen.get("nachricht"),
            "fotos": eingegangen.get("fotos") or [],
        })
    return {"eintraege": out, "count": len(out)}


@router.get("/status-alle")
async def portal_status_alle(user=Depends(get_current_user)):
    """Status aller Kunden in EINER Anfrage (für Listen/Badges) — kein Call pro Kunde.
    Liefert {kunde_id: status} mit jeweils jüngstem Eintrag."""
    docs = await db[COLLECTION].find(
        {}, {"_id": 0, "kunde_id": 1, "status": 1, "erstellt_am": 1}
    ).to_list(100000)
    latest: dict[str, str] = {}
    for d in sorted(docs, key=lambda x: x.get("erstellt_am") or ""):
        if d.get("kunde_id"):
            latest[d["kunde_id"]] = d.get("status")
    return {"statuses": latest}


@router.get("/status/{kunde_id}")
async def portal_status(kunde_id: str, user=Depends(get_current_user)):
    """Aktueller Portal-Status eines Kunden (jüngster Eintrag) für Listen/Badges.
    Gibt status=None zurück, wenn noch kein Portal-Link existiert."""
    doc = await db[COLLECTION].find_one(
        {"kunde_id": kunde_id}, {"_id": 0}, sort=[("erstellt_am", -1)]
    )
    if not doc:
        return {"kunde_id": kunde_id, "status": None, "has_portal": False}
    return {
        "kunde_id": kunde_id,
        "status": doc.get("status"),
        "has_portal": True,
        "portal_token": doc.get("portal_token"),
        "erstellt_am": doc.get("erstellt_am"),
        "geoeffnet_am": doc.get("geoeffnet_am"),
        "genutzt_am": doc.get("genutzt_am"),
    }
