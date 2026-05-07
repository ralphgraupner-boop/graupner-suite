"""Modul: module_rechnungen — Rechnungsverwaltung.

Bündelt die alte v1-API (`routes_v1.py` → `/api/invoices/*`) und die
neuere v2-API (`routes_v2.py` → `/api/v2/*`).

Hinweis: v1 wird unter dem `api_router` (Prefix `/api`) eingehaengt, v2
hat einen eigenen Prefix (`/api/v2`) und wird direkt an `app` gehaengt.
Daher exportieren wir beide Router getrennt — sie werden in `server.py`
explizit unterschiedlich registriert.
"""

from .routes_v1 import router as router_v1
from .routes_v2 import router as router_v2

__all__ = ["router_v1", "router_v2"]
