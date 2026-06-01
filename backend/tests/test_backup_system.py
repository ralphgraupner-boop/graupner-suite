"""Tests fuer das erweiterte Backup-System (Phase 1 + 2)."""
import os
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://modul-first-app.preview.emergentagent.com"
)
ADMIN_USER = "admin-preview"
ADMIN_PASS = "HamburgPreview2026!"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=10,
    )
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


class TestBackupSystem:
    def test_status_endpoint(self, headers):
        r = requests.get(f"{BASE_URL}/api/backup/auto/status", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "enabled" in d
        assert "empfaenger_emails" in d
        assert "lokal_aufbewahrung_tage" in d
        assert "lokal_dateien" in d

    def test_settings_update(self, headers):
        # Empfaenger setzen
        r = requests.put(
            f"{BASE_URL}/api/backup/auto/settings",
            json={"empfaenger_emails": ["test1@example.com", "test2@example.com"]},
            headers=headers,
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["empfaenger_emails"] == ["test1@example.com", "test2@example.com"]
        # Zurueck auf einzelne
        requests.put(
            f"{BASE_URL}/api/backup/auto/settings",
            json={"empfaenger_emails": ["service24@tischlerei-graupner.de"]},
            headers=headers, timeout=10,
        )

    def test_settings_validation(self, headers):
        # Leeres Payload -> 400
        r = requests.put(
            f"{BASE_URL}/api/backup/auto/settings",
            json={"unbekannt": "wert"},
            headers=headers,
            timeout=10,
        )
        assert r.status_code == 400

    def test_log_endpoint(self, headers):
        r = requests.get(f"{BASE_URL}/api/backup/auto/log?limit=5", headers=headers, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_letzter_lauf_hat_drei_speicherziele(self, headers):
        """Nach unserem Probelauf muss letzter Lauf alle 3 Speicherziele haben."""
        r = requests.get(f"{BASE_URL}/api/backup/auto/status", headers=headers, timeout=10)
        d = r.json()
        last = d.get("letzter_lauf")
        if last and last.get("storage"):
            storage = last["storage"]
            assert "email" in storage
            assert "lokal" in storage
            assert "object_storage" in storage

    def test_dry_run_existiert(self, headers):
        """Trockenlauf liefert Differenzen-Liste."""
        # Erst letztes Backup finden
        r = requests.get(f"{BASE_URL}/api/backup/auto/status", headers=headers, timeout=10)
        last = (r.json() or {}).get("letzter_lauf") or {}
        bid = last.get("id")
        if not bid:
            pytest.skip("Kein Backup vorhanden")
        # Trockenlauf
        r = requests.post(
            f"{BASE_URL}/api/backup/auto/restore/dry-run/{bid}",
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["wird_geschrieben"] == 0
        assert isinstance(d["differenzen"], list)
        assert len(d["differenzen"]) > 0

    def test_restore_ohne_bestaetigung_400(self, headers):
        """Restore ohne Bestaetigung-Token -> 400."""
        r = requests.get(f"{BASE_URL}/api/backup/auto/status", headers=headers, timeout=10)
        last = (r.json() or {}).get("letzter_lauf") or {}
        bid = last.get("id")
        if not bid:
            pytest.skip("Kein Backup vorhanden")
        r = requests.post(
            f"{BASE_URL}/api/backup/auto/restore/apply/{bid}",
            json={"bestaetigung": "FALSCH"},
            headers=headers,
            timeout=10,
        )
        assert r.status_code == 400

    def test_kein_hardcode_im_status(self, headers):
        """Hardcoded service24@... darf nicht hardcoded zurueckkommen wenn Settings was anderes haben."""
        # Setze auf Test-Empfaenger
        requests.put(
            f"{BASE_URL}/api/backup/auto/settings",
            json={"empfaenger_emails": ["custom@example.org"]},
            headers=headers, timeout=10,
        )
        r = requests.get(f"{BASE_URL}/api/backup/auto/status", headers=headers, timeout=10)
        d = r.json()
        assert d["empfaenger_emails"] == ["custom@example.org"]
        # Cleanup
        requests.put(
            f"{BASE_URL}/api/backup/auto/settings",
            json={"empfaenger_emails": ["service24@tischlerei-graupner.de"]},
            headers=headers, timeout=10,
        )
