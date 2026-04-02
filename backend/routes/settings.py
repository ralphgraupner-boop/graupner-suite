from fastapi import APIRouter, HTTPException
from models import CompanySettings
from database import db

router = APIRouter()


@router.get("/settings", response_model=CompanySettings)
async def get_settings():
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        return CompanySettings()
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
