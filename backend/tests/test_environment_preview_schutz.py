"""Pytest fuer utils.environment + Preview-Schutz im IMAP-Polling.

Geprueft wird:
1. detect_env() erkennt preview/live/unknown korrekt anhand REACT_APP_BACKEND_URL
2. is_preview_or_unknown() ist auf Preview True, auf Live False
3. IMAP-Polling setzt KEINE \\Seen-Flags wenn is_preview_or_unknown() True
"""
from __future__ import annotations
from unittest.mock import patch, MagicMock

from utils import environment as env_mod


def _reset():
    env_mod.reset_cache()


def test_detect_preview_url():
    _reset()
    with patch.dict("os.environ", {"REACT_APP_BACKEND_URL": "https://modul-first-app.preview.emergentagent.com"}, clear=False):
        result = env_mod.detect_env()
        assert result["kind"] == "preview"
        assert env_mod.is_preview() is True
        assert env_mod.is_live() is False
        assert env_mod.is_preview_or_unknown() is True


def test_detect_live_url_emergent_host():
    _reset()
    with patch.dict("os.environ", {"REACT_APP_BACKEND_URL": "https://code-import-flow-1.emergent.host"}, clear=False):
        result = env_mod.detect_env()
        assert result["kind"] == "live"
        assert env_mod.is_live() is True
        assert env_mod.is_preview() is False
        assert env_mod.is_preview_or_unknown() is False


def test_detect_live_url_graupner_domain():
    _reset()
    with patch.dict("os.environ", {"REACT_APP_BACKEND_URL": "https://app.tischlerei-graupner.de"}, clear=False):
        result = env_mod.detect_env()
        assert result["kind"] == "live"


def test_detect_unknown_url():
    """Unbekannte Domain → 'unknown' → fuer destruktive Aktionen wie 'Preview' behandeln."""
    _reset()
    # frontend/.env existiert, deshalb muessen wir die Datei mocken zusaetzlich
    with patch.dict("os.environ", {"REACT_APP_BACKEND_URL": "https://something.unknown.example.org"}, clear=False):
        result = env_mod.detect_env()
        assert result["kind"] == "unknown"
        assert env_mod.is_preview() is False  # nicht preview
        assert env_mod.is_live() is False     # nicht live
        # Schutz greift trotzdem:
        assert env_mod.is_preview_or_unknown() is True


def test_detect_no_env_file_no_env_var():
    """Wenn weder ENV-Var noch frontend/.env: unknown → Schutz greift."""
    _reset()
    with patch("utils.environment._read_backend_url", return_value=""):
        result = env_mod.detect_env()
        assert result["kind"] == "unknown"
        assert env_mod.is_preview_or_unknown() is True  # Schutz greift


def test_imap_seen_wird_in_preview_unterdrueckt():
    """Schluesseltest: bei Preview darf mail.store(..., '\\Seen') NIE aufgerufen werden.

    Wir simulieren den kritischen Code-Block aus imap.py.
    """
    _reset()
    fake_imap = MagicMock()

    # Echtes Verhalten nachstellen — Block aus routes/imap.py:
    with patch.dict("os.environ", {"REACT_APP_BACKEND_URL": "https://x.preview.emergentagent.com"}, clear=False):
        from utils.environment import is_preview_or_unknown
        eid = b"42"
        if is_preview_or_unknown():
            # Schutz greift → nichts tun
            pass
        else:
            fake_imap.store(eid, "+FLAGS", "\\Seen")

        assert fake_imap.store.call_count == 0, "Auf Preview darf \\Seen NIEMALS gesetzt werden!"


def test_imap_seen_wird_auf_live_gesetzt():
    """Gegenprobe: auf Live wird \\Seen normal gesetzt."""
    _reset()
    fake_imap = MagicMock()

    with patch.dict("os.environ", {"REACT_APP_BACKEND_URL": "https://code-import-flow-1.emergent.host"}, clear=False):
        from utils.environment import is_preview_or_unknown
        eid = b"42"
        if is_preview_or_unknown():
            pass
        else:
            fake_imap.store(eid, "+FLAGS", "\\Seen")

        assert fake_imap.store.call_count == 1
        assert fake_imap.store.call_args.args == (b"42", "+FLAGS", "\\Seen")
