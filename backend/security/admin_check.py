"""Admin-Check Helper.

Kleine, isolierte Sicherheitsfunktion. Wird in mehreren Routern als
FastAPI-Dependency verwendet, um sensible Endpoints (z. B. Backup,
IMAP-Konfiguration, Stammdaten-Verwaltung) ausschliesslich Admin-Usern
zuganglich zu machen.

Gebrauch:

    from security.admin_check import require_admin

    @router.post("/...", dependencies=[Depends(require_admin)])
    async def my_endpoint(...):
        ...

Oder direkt im Endpoint:

    @router.post("/...")
    async def my_endpoint(user=Depends(get_current_user)):
        require_admin(user)
        ...
"""
from fastapi import Depends, HTTPException

from routes.auth import get_current_user


def _role_of(user) -> str:
    if isinstance(user, dict):
        return (user.get("role") or "").lower()
    return (getattr(user, "role", "") or "").lower()


def require_admin(user=Depends(get_current_user)):
    """Wirft HTTP 403, wenn der eingeloggte User nicht Admin ist."""
    if _role_of(user) != "admin":
        raise HTTPException(403, "Nur Admin darf diese Aktion ausfuehren.")
    return user


def require_finanz(user=Depends(get_current_user)):
    """Wirft HTTP 403, wenn der User weder Admin noch Buchhaltung ist.

    Schuetzt Finanz-/Dokument-Endpunkte (Angebote, Auftraege, Rechnungen, PDFs,
    Dashboard-Statistik) vor Zugriff durch Monteure/Mitarbeiter sowie nicht
    eingeloggte Fremde (get_current_user erzwingt zuerst ein gueltiges Token).
    """
    if _role_of(user) not in ("admin", "buchhaltung"):
        raise HTTPException(403, "Nur Admin oder Buchhaltung darf Finanzdaten einsehen.")
    return user
