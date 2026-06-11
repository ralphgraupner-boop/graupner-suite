from fastapi import APIRouter, HTTPException
from models import CompanySettings
from database import db

router = APIRouter()


@router.get("/settings", response_model=CompanySettings)
async def get_settings():
    import os
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        settings = {}
    # SMTP Fallback aus .env
    if not settings.get("smtp_server"):
        settings["smtp_server"] = os.environ.get("SMTP_SERVER", "")
    if not settings.get("smtp_port"):
        settings["smtp_port"] = int(os.environ.get("SMTP_PORT", "465"))
    if not settings.get("smtp_user"):
        settings["smtp_user"] = os.environ.get("SMTP_USER", "")
    if not settings.get("smtp_password"):
        settings["smtp_password"] = os.environ.get("SMTP_PASSWORD", "")
    if not settings.get("smtp_from"):
        settings["smtp_from"] = os.environ.get("SMTP_FROM", "")
    return CompanySettings(**settings)


@router.put("/settings", response_model=CompanySettings)
async def update_settings(settings: CompanySettings):
    settings_dict = settings.model_dump()
    await db.settings.update_one(
        {"id": "company_settings"},
        {"$set": settings_dict},
        upsert=True
    )
    return settings


@router.post("/settings/smtp-test")
async def test_smtp(data: dict):
    """Test SMTP connection with given or stored settings"""
    from utils import send_email
    server = data.get("smtp_server", "")
    port = data.get("smtp_port", 465)
    user = data.get("smtp_user", "")
    password = data.get("smtp_password", "")
    from_addr = data.get("smtp_from", user)
    to_email = data.get("test_email", from_addr)

    if not server or not user or not password:
        raise HTTPException(status_code=400, detail="SMTP-Daten unvollständig")

    try:
        import smtplib
        with smtplib.SMTP_SSL(server, port, timeout=10) as srv:
            srv.login(user, password)
        return {"success": True, "message": f"SMTP-Verbindung erfolgreich zu {server}:{port}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMTP-Fehler: {str(e)}")



# ── Anfragen-Kategorien ──
# WICHTIG (06.05.2026): Identisch mit "reparaturgruppe" in module_textvorlagen.
# Datenmaske live — keine eigene Collection mehr (Vision-Regel).

@router.get("/anfragen-kategorien")
async def get_anfragen_kategorien():
    out = []
    async for v in db.module_textvorlagen.find(
        {"doc_type": "reparaturgruppe"}, {"_id": 0, "title": 1}
    ).sort("title", 1):
        t = (v.get("title") or "").strip()
        if t:
            out.append(t)
    return out


@router.put("/anfragen-kategorien")
async def update_anfragen_kategorien(body: dict):
    """Schreibt Anfragen-Kategorien als reparaturgruppe nach module_textvorlagen.
    Synchronisation mit einsatz_config ist nicht mehr nötig — Quelle ist eine.
    """
    from datetime import datetime as _dt, timezone as _tz
    from uuid import uuid4 as _uuid
    new_values = [str(k).strip() for k in body.get("kategorien", []) if str(k).strip()]
    existing = {}
    async for v in db.module_textvorlagen.find(
        {"doc_type": "reparaturgruppe"}, {"_id": 0, "id": 1, "title": 1}
    ):
        existing[v["title"]] = v["id"]
    now = _dt.now(_tz.utc).isoformat()
    for title in new_values:
        if title not in existing:
            await db.module_textvorlagen.insert_one({
                "id": str(_uuid()),
                "title": title,
                "content": "",
                "doc_type": "reparaturgruppe",
                "text_type": "titel",
                "created_at": now,
                "updated_at": now,
            })
    for title, _id in existing.items():
        if title not in new_values:
            await db.module_textvorlagen.delete_one({"id": _id})
    return new_values


DEFAULT_CUSTOMER_STATUSES = ["Neu", "Aktiv", "Inaktiv", "Interessent", "Stammkunde", "Abgeschlossen"]


@router.get("/kunden-status")
async def get_kunden_status():
    """Kunden-Status-Werte abrufen"""
    doc = await db.settings.find_one({"id": "kunden_status"}, {"_id": 0})
    if doc and "status" in doc:
        return doc["status"]
    return DEFAULT_CUSTOMER_STATUSES


@router.put("/kunden-status")
async def update_kunden_status(body: dict):
    """Kunden-Status-Werte aktualisieren"""
    status_values = body.get("status", [])
    status_values = [s for s in status_values if s.strip()]
    
    if not status_values:
        status_values = DEFAULT_CUSTOMER_STATUSES
    
    await db.settings.update_one(
        {"id": "kunden_status"},
        {"$set": {"id": "kunden_status", "status": status_values}},
        upsert=True,
    )
    return status_values


# ── Keyword-Prioritäten (Anfragen-Priorisierung, Teil 2a) ──
# Speicherung in db.settings (id='keyword_prioritaeten'). 4 Stufen, kein Hardcode in der Logik.
DEFAULT_KEYWORD_PRIORITAETEN = {
    "sofort": ["Notfall", "dringend", "kaputt", "sofort"],
    "stufe1": ["Schiebetür", "Hebeschiebetür", "PSK", "Kippschiebetür"],
    "stufe2": ["Fenster", "Fensterwartung", "Türwartung", "Wartung"],
    "stufe3": ["Standard"],
}
_KW_STUFEN = ["sofort", "stufe1", "stufe2", "stufe3"]


@router.get("/keyword-prioritaeten")
async def get_keyword_prioritaeten():
    """Keyword-Prioritäten je Stufe abrufen (Fallback: Defaults)."""
    doc = await db.settings.find_one({"id": "keyword_prioritaeten"}, {"_id": 0})
    if doc and doc.get("stufen"):
        saved = doc["stufen"]
        return {k: saved.get(k, DEFAULT_KEYWORD_PRIORITAETEN[k]) for k in _KW_STUFEN}
    return DEFAULT_KEYWORD_PRIORITAETEN


@router.put("/keyword-prioritaeten")
async def update_keyword_prioritaeten(body: dict):
    """Keyword-Prioritäten je Stufe speichern (Ralph kann Keywords ergänzen/entfernen)."""
    stufen = body.get("stufen") or {}
    clean = {}
    for key in _KW_STUFEN:
        vals = stufen.get(key, DEFAULT_KEYWORD_PRIORITAETEN[key])
        clean[key] = [str(s).strip() for s in vals if str(s).strip()]
    await db.settings.update_one(
        {"id": "keyword_prioritaeten"},
        {"$set": {"id": "keyword_prioritaeten", "stufen": clean}},
        upsert=True,
    )
    return clean


# ── Begrüßungsvorlagen (Mail-Anfragen, je Prioritätsstufe) ──
DEFAULT_BEGRUESSUNGSVORLAGEN = {
    "sofort": "Guten Tag,\n\nvielen Dank für Ihre Anfrage. Da es sich um einen dringenden Fall handelt, melden wir uns schnellstmöglich bei Ihnen.\n\n",
    "stufe1": "Guten Tag,\n\nvielen Dank für Ihre Anfrage rund um Türen und Fenster. Wir prüfen Ihr Anliegen und melden uns zeitnah mit einem Terminvorschlag.\n\n",
    "stufe2": "Guten Tag,\n\nvielen Dank für Ihre Anfrage zur Wartung. Wir melden uns in Kürze bei Ihnen, um die Details abzustimmen.\n\n",
    "stufe3": "Guten Tag,\n\nvielen Dank für Ihre Anfrage. Wir haben Ihre Nachricht erhalten und melden uns zeitnah bei Ihnen.\n\n",
}


@router.get("/begruessungsvorlagen")
async def get_begruessungsvorlagen():
    """Begrüßungsvorlagen je Prioritätsstufe abrufen (Fallback: Defaults)."""
    doc = await db.settings.find_one({"id": "begruessungsvorlagen"}, {"_id": 0})
    if doc and doc.get("vorlagen"):
        saved = doc["vorlagen"]
        return {k: saved.get(k, DEFAULT_BEGRUESSUNGSVORLAGEN[k]) for k in _KW_STUFEN}
    return DEFAULT_BEGRUESSUNGSVORLAGEN


@router.put("/begruessungsvorlagen")
async def update_begruessungsvorlagen(body: dict):
    """Begrüßungsvorlagen je Prioritätsstufe speichern."""
    vorlagen = body.get("vorlagen") or {}
    clean = {}
    for key in _KW_STUFEN:
        clean[key] = str(vorlagen.get(key, DEFAULT_BEGRUESSUNGSVORLAGEN[key]) or "").strip()
    await db.settings.update_one(
        {"id": "begruessungsvorlagen"},
        {"$set": {"id": "begruessungsvorlagen", "vorlagen": clean}},
        upsert=True,
    )
    return clean
