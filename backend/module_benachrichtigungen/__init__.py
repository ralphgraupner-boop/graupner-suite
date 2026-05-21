"""module_benachrichtigungen – Benachrichtigungs- und Popup-Einstellungen pro User.

Module-First:
- Eigene Collection: module_benachrichtigungen_prefs
- Eigenes API-Prefix: /api/module-benachrichtigungen
- Keine Aenderung an auth.py / BERECHTIGUNG_KEYS

Aktuell unterstuetzte Schluessel:
- popup_papierkorb            : Login-Hinweis Papierkorb
- popup_kundenlink_expiry     : Login-Hinweis ablaufende Kundenportal-Links

Erweiterbar fuer Phase 2/3 ohne API-Brueche.
"""
from .routes import router

__all__ = ["router"]
