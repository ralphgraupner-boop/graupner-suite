"""Umgebungs-Erkennung — Preview vs. Live.

Spiegelt die Logik aus `frontend/src/lib/env.js` ins Backend:
- Preview: Hostname enthaelt 'preview' oder 'emergentagent.com'
- Live:    Hostname enthaelt 'emergent.host', 'graupner' oder ist 'localhost'

Quelle der Wahrheit ist REACT_APP_BACKEND_URL aus /app/frontend/.env, weil dort
genau die Public-URL steht, die Frontend und Ingress benutzen. Wer den Backend-
Code lokal startet (kein Frontend.env greifbar), gilt als 'unknown' → wird wie
'live' behandelt (Sicherheitsanker: lieber NICHT schreiben).

Modulweite Nutzung:
    from utils.environment import is_preview
    if is_preview():
        ...  # z.B. IMAP-Schreibvorgang ueberspringen
"""
from __future__ import annotations
import os
from urllib.parse import urlparse


_FRONTEND_ENV = "/app/frontend/.env"
_cache: dict | None = None


def _read_backend_url() -> str:
    # 1) Falls Backend ohne Frontend.env laeuft, erlauben wir override via Env
    direct = os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("PUBLIC_BACKEND_URL")
    if direct:
        return direct
    # 2) Aus frontend/.env lesen — das ist die offizielle Quelle
    try:
        with open(_FRONTEND_ENV, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return ""


def detect_env() -> dict:
    """Liefert {'kind': 'preview'|'live'|'unknown', 'host': '<hostname>'}.

    Wird gecached — Hostname aendert sich zur Laufzeit nicht.
    """
    global _cache
    if _cache is not None:
        return _cache

    url = _read_backend_url()
    host = ""
    if url:
        try:
            host = (urlparse(url).hostname or "").lower()
        except Exception:
            host = ""

    if not host:
        kind = "unknown"
    elif "preview" in host or "emergentagent.com" in host:
        kind = "preview"
    elif "emergent.host" in host or "graupner" in host or host == "localhost":
        kind = "live"
    else:
        kind = "unknown"

    _cache = {"kind": kind, "host": host}
    return _cache


def is_preview() -> bool:
    """True wenn wir auf Preview laufen. Bei 'unknown' bewusst False → wir schreiben lieber,
    als faelschlich auf Live wegen Erkennungsfehler nicht zu schreiben.

    ABER fuer destruktive Aktionen (Mail-Flags!) wird die Gegenfrage gestellt:
    'wuerde ich auf Preview faelschlich verhindern?' → ja, das ist akzeptabel.
    Deshalb fuer IMAP nutzen wir is_preview_or_unknown() unten.
    """
    return detect_env()["kind"] == "preview"


def is_live() -> bool:
    return detect_env()["kind"] == "live"


def is_preview_or_unknown() -> bool:
    """Sicherer Anker fuer destruktive Aktionen auf fremden Systemen (IMAP, externe APIs).

    Wenn die Umgebung nicht eindeutig 'live' ist, gilt sie als geschuetzt — keine
    Schreibvorgaenge an externen Systemen wie IMAP-Servern. Das verhindert Datenverlust
    bei Fehlkonfiguration oder fehlender .env-Datei.
    """
    return detect_env()["kind"] != "live"


def reset_cache() -> None:
    """Nur fuer Tests — Cache leeren."""
    global _cache
    _cache = None
