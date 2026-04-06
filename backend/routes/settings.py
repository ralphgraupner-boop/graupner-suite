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
DEFAULT_KATEGORIEN = ["Schiebetür", "Fenster", "Innentür", "Eingangstür", "Sonstige Reparaturen"]

@router.get("/anfragen-kategorien")
async def get_anfragen_kategorien():
    doc = await db.settings.find_one({"id": "anfragen_kategorien"}, {"_id": 0})
    if doc and "kategorien" in doc:
        return doc["kategorien"]
    # Fallback: load from einsatz_config reparaturgruppen
    config = await db.einsatz_config.find_one({"id": "main"}, {"_id": 0})
    if config and config.get("reparaturgruppen"):
        return config["reparaturgruppen"]
    return DEFAULT_KATEGORIEN

@router.put("/anfragen-kategorien")
async def update_anfragen_kategorien(body: dict):
    kategorien = body.get("kategorien", [])
    kategorien = [k for k in kategorien if k.strip()]
    # Save categories
    await db.settings.update_one(
        {"id": "anfragen_kategorien"},
        {"$set": {"id": "anfragen_kategorien", "kategorien": kategorien}},
        upsert=True,
    )
    # Sync to Reparaturgruppen in einsatz_config
    await db.einsatz_config.update_one(
        {"id": "main"},
        {"$set": {"reparaturgruppen": kategorien}},
        upsert=True,
    )
    return kategorien
