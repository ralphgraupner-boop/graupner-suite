"""
Settings-Helper für module_aufgaben (Feature-Flag).
"""
from database import db


_DEFAULTS = {
    "id": "module_aufgaben_settings",
    "feature_enabled": True,  # standardmäßig an, Modul ist Kern-Workflow
}


async def _get_or_create_settings() -> dict:
    s = await db.module_aufgaben_settings.find_one({"id": _DEFAULTS["id"]}, {"_id": 0})
    if not s:
        await db.module_aufgaben_settings.insert_one(dict(_DEFAULTS))
        return dict(_DEFAULTS)
    return s
