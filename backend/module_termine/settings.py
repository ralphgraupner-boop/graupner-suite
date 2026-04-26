"""Settings-Helper für module_termine."""
from database import db


_DEFAULTS = {
    "id": "module_termine_settings",
    "feature_enabled": True,
    "google_calendar_enabled": False,  # erst aktivieren, wenn Modul GoogleKalender konfiguriert ist
}


async def _get_or_create_settings() -> dict:
    s = await db.module_termine_settings.find_one({"id": _DEFAULTS["id"]}, {"_id": 0})
    if not s:
        await db.module_termine_settings.insert_one(dict(_DEFAULTS))
        return dict(_DEFAULTS)
    return s
