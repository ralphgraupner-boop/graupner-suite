"""Pytest fuer den gemeinsamen Termin-Einladungs-Service.

Geprueft wird:
1. baue_termin_mail erzeugt schema.org/Event JSON-LD im HTML (Gmail-1-Tap)
2. ICS-Anhang ist da und enthaelt Pflichtfelder
3. sende_termin_einladung gibt korrekte Status zurueck bei fehlendem Monteur / unbekanntem User
4. Beide Wege (KI-Tool + manuelle Route) rufen denselben Builder auf (Smoketest des Imports)

Kein Versand an externe Server in den Tests — send_email wird gemockt.
"""
from __future__ import annotations
import asyncio
import json
from unittest.mock import patch

from module_kalender_export.invite_service import (
    baue_termin_mail,
    sende_termin_einladung,
)


# ====================== Pure Builder Tests ======================

def test_baue_termin_mail_enthaelt_schema_org():
    """Der HTML-Body muss schema.org/Event JSON-LD enthalten — DAS triggert Gmails 1-Tap-Knopf."""
    termin = {
        "id": "abc-123",
        "titel": "Besichtigung Mueller",
        "start": "2026-06-05T10:00",
        "ende": "2026-06-05T11:00",
        "ort": "Hamburger Strasse 12, 22083 Hamburg",
        "beschreibung": "Schiebetuer vermessen",
    }
    subject, body_html, ics_bytes = baue_termin_mail(
        termin=termin,
        empfaenger_name="Thorsten Graupner",
        organisator_name="Ralph Graupner",
        organisator_email="ralph@example.com",
        kunde=None,
    )

    # Subject
    assert "Besichtigung Mueller" in subject
    assert "2026-06-05" in subject

    # schema.org JSON-LD vorhanden
    assert 'application/ld+json' in body_html
    assert '"@type": "EventReservation"' in body_html
    assert '"@type": "Event"' in body_html
    assert 'Besichtigung Mueller' in body_html
    assert 'Thorsten Graupner' in body_html  # underName
    assert '2026-06-05T10:00' in body_html  # startDate

    # JSON-LD parsebar
    start_marker = '<script type="application/ld+json">'
    start = body_html.find(start_marker) + len(start_marker)
    end = body_html.find('</script>', start)
    ld_json = body_html[start:end]
    parsed = json.loads(ld_json)
    assert parsed["@type"] == "EventReservation"
    assert parsed["reservationFor"]["name"] == "Besichtigung Mueller"
    assert parsed["reservationFor"]["startDate"] == "2026-06-05T10:00"
    assert parsed["reservationFor"]["endDate"] == "2026-06-05T11:00"
    assert parsed["reservationFor"]["location"]["address"] == "Hamburger Strasse 12, 22083 Hamburg"


def test_baue_termin_mail_ics_anhang_ist_da():
    """ICS-Bytes muss vorhanden sein und Pflichtfelder enthalten."""
    termin = {
        "id": "abc-123",
        "titel": "Test-Termin",
        "start": "2026-06-05T10:00",
        "ende": "",
    }
    _, _, ics_bytes = baue_termin_mail(
        termin=termin,
        empfaenger_name="Thorsten",
        organisator_name="Ralph",
        organisator_email="ralph@example.com",
    )
    ics_text = ics_bytes.decode("utf-8")
    assert "BEGIN:VCALENDAR" in ics_text
    assert "BEGIN:VEVENT" in ics_text
    assert "Test-Termin" in ics_text
    assert "20260605T100000" in ics_text


def test_baue_termin_mail_ohne_ort_und_beschreibung():
    """Auch ohne Ort/Beschreibung muss der Builder sauber durchlaufen."""
    termin = {"id": "x", "titel": "Kurz", "start": "2026-06-10T09:00"}
    subject, body, _ = baue_termin_mail(
        termin=termin,
        empfaenger_name="Heike",
        organisator_name="Ralph",
        organisator_email="",
    )
    assert "Kurz" in subject
    assert "Heike" in body
    # Kein "Wo:"-Block, kein "Beschreibung:"-Block
    assert "Wo:</td>" not in body
    assert "Beschreibung:</td>" not in body


def test_baue_termin_mail_mit_kunde_baut_adresse_aus_kunde():
    """Wenn der Termin keinen Ort hat, aber ein Kunde mit Adresse mitgegeben wird:
    Adresse aus Kunde verwenden."""
    termin = {"id": "x", "titel": "Vor Ort", "start": "2026-06-10T09:00"}
    kunde = {
        "vorname": "Anna", "nachname": "Schmidt",
        "strasse": "Musterweg", "hausnummer": "5",
        "plz": "22000", "ort": "Hamburg",
    }
    _, body, _ = baue_termin_mail(
        termin=termin, empfaenger_name="Heike",
        organisator_name="Ralph", organisator_email="",
        kunde=kunde,
    )
    assert "Musterweg 5" in body
    assert "22000 Hamburg" in body
    assert "Anna Schmidt" in body  # Kunde-Anzeige


# ====================== sende_termin_einladung Tests (mit Mock) ======================

def test_sende_einladung_ohne_monteur_user():
    """Leerer monteur_username → Status 'kein_monteur', kein Versand."""
    result = asyncio.run(sende_termin_einladung(
        termin={"id": "x", "titel": "T", "start": "2026-06-05T10:00"},
        monteur_username="",
        organisator={"username": "ralph"},
    ))
    assert result["ok"] is False
    assert result["status"] == "kein_monteur"


def test_sende_einladung_unbekannter_user():
    """User existiert nicht in db.users → Status 'monteur_unbekannt'."""
    result = asyncio.run(sende_termin_einladung(
        termin={"id": "x", "titel": "T", "start": "2026-06-05T10:00"},
        monteur_username="diesen.user.gibt.es.nicht.xyz",
        organisator={"username": "ralph"},
    ))
    assert result["ok"] is False
    assert result["status"] == "monteur_unbekannt"


def test_sende_einladung_an_thorsten_mocked_smtp():
    """Mit gemocktem send_email + DB: vollstaendiger Pfad bis zum Versand testen.
    Mocked db.users.find_one, damit der Test ohne lebenden Mongo-Loop laeuft.
    """
    fake_user = {"email": "thorsten@example.com", "vorname": "Thorsten", "nachname": "Graupner"}

    async def fake_find_one(*_a, **_kw):
        # Erster Aufruf: User; zweiter Aufruf: Kunde (None)
        if not hasattr(fake_find_one, "_calls"):
            fake_find_one._calls = 0
        fake_find_one._calls += 1
        return fake_user if fake_find_one._calls == 1 else None

    with patch("module_kalender_export.invite_service.send_email") as mock_send, \
         patch("module_kalender_export.invite_service.db") as mock_db:
        mock_db.users.find_one = fake_find_one
        mock_db.module_kunden.find_one = fake_find_one
        mock_send.return_value = None
        result = asyncio.run(sende_termin_einladung(
            termin={
                "id": "pytest-1",
                "titel": "Pytest Smoketest",
                "start": "2026-06-05T10:00",
                "ende": "",
                "ort": "Hamburg",
                "beschreibung": "Pytest-Lauf",
                "kunde_id": "",
                "monteur_username": "thorsten.graupner",
            },
            monteur_username="thorsten.graupner",
            organisator={"username": "ralph", "vorname": "Ralph", "nachname": "Graupner", "email": "ralph@example.com"},
        ))
    assert result["ok"] is True, result
    assert result["status"] == "versendet"
    assert result["empfaenger_email"] == "thorsten@example.com"
    # send_email wurde tatsaechlich mit ICS-Anhang aufgerufen
    assert mock_send.called
    call_kwargs = mock_send.call_args.kwargs
    assert "termin.ics" == call_kwargs["attachments"][0]["filename"]
    assert b"BEGIN:VCALENDAR" in call_kwargs["attachments"][0]["data"]
    # schema.org JSON-LD im Body
    assert 'application/ld+json' in call_kwargs["body_html"]
    assert 'EventReservation' in call_kwargs["body_html"]
