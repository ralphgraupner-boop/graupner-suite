"""module_portal_wizard — Backend-Routen für das neue Kundenportal.

Vier Endpunkte unter dem Prefix /api/kundenportal:
  POST /link-erstellen      (Auth)        — Token erzeugen, Eintrag anlegen
  GET  /portal/{token}      (öffentlich)  — Kundendaten + Auftrag, Status->geoeffnet
  POST /eingang/{token}     (öffentlich)  — Nachricht/Fotos speichern, Status->genutzt
  GET  /status/{kunde_id}   (Auth)        — aktueller Portal-Status für Listen
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4

from database import db
from auth import get_current_user

router = APIRouter(prefix="/kundenportal", tags=["kundenportal"])

COLLECTION = "module_portal_wizard"

VALID_STATUS = {"link_erstellt", "geoeffnet", "genutzt"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/link-erstellen")
async def link_erstellen(data: dict, user=Depends(get_current_user)):
    """Erzeugt einen eindeutigen Portal-Link für einen Kunden (+ optional Projekt)."""
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
    return {
        "ok": True,
        "portal_token": token,
        "portal_link": f"/portal/{token}",
        "status": "link_erstellt",
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
