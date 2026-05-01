"""
module_mail_inbox – Jimdo-Kontaktformular-Anfragen aus dem service24-Postfach
einlesen und als Kunden-Vorschläge anbieten.

Module-First, eigenes Prefix /api/module-mail-inbox.
"""
from .routes import router

__all__ = ["router"]
