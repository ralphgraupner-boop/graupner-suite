"""
Regression-Tests für module_mail_inbox/parser.py

Hintergrund-Bug (Ralph, 07.05.2026):
- Aktuelles Jimdo-Formular liefert das Feld als 'Anrede: Herr',
  Parser kannte aber nur 'Auswahlliste:' (alt) oder 'Frau Herr:' (uralt).
  → anrede blieb leer.
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from module_mail_inbox.parser import parse_anfrage, is_complete_form


JIMDO_AKTUELL = """Hallo, du hast eine Nachricht über deine Jimdo-Seite https://www.tischlerei-graupner.de/schiebetuer-reparatur/ erhalten:

-------------------------------------

 Anrede: Herr

Vorname: Wilfried

Nachname: Kollmann

E-Mail: w.kollmann@hamburg.de

Telefon: 01798117885

Straße: Paeplowstieg 2b

PLZ: 22453

Ort: Hamburg

Nachricht: Moin,
wir hatten eben telefoniert und Du hast mich gebeten, den Kontaktbogen auszufüllen.
Beste Grüße
Wilfried

Nutzer hat die Datenschutzerklärung akzeptiert. Datum/Uhrzeit: 2026-05-07 14:49:00 CEST"""


JIMDO_AUSWAHLLISTE = """Hallo, neue Nachricht über https://www.tischlerei-graupner.de/kontakt

Auswahlliste: Frau
Vorname: Anna
Nachname: Test
E-Mail: anna@test.de
Telefon: 040 123456
Nachricht: Bitte um Termin.
Nutzer hat die Datenschutzerklärung akzeptiert."""


JIMDO_FRAU_HERR_ALT = """Frau Herr: Herr
Name: Klaus Schmidt
Telefonnummer: 0151 999
E-Mail (optional): klaus@web.de
Nachricht: Brauche neue Tür."""


def test_jimdo_aktuell_anrede_wird_erkannt():
    r = parse_anfrage(JIMDO_AKTUELL, subject="Anfrage von Wilfried Kollmann")
    assert r["anrede"] == "Herr"
    assert r["vorname"] == "Wilfried"
    assert r["nachname"] == "Kollmann"
    assert r["email"] == "w.kollmann@hamburg.de"
    assert r["telefon"] == "01798117885"
    assert r["strasse"] == "Paeplowstieg 2b"
    assert r["plz"] == "22453"
    assert r["ort"] == "Hamburg"
    assert "Moin" in r["nachricht"]
    assert "Wilfried" in r["nachricht"]
    assert r["source_url"].startswith("https://www.tischlerei-graupner.de/")
    ok, filled = is_complete_form(r)
    assert ok and filled >= 8


def test_jimdo_auswahlliste_legacy_funktioniert_weiter():
    r = parse_anfrage(JIMDO_AUSWAHLLISTE)
    assert r["anrede"] == "Frau"
    assert r["vorname"] == "Anna"
    assert r["nachname"] == "Test"
    assert r["email"] == "anna@test.de"
    assert "Termin" in r["nachricht"]


def test_jimdo_frau_herr_alt_format_funktioniert_weiter():
    r = parse_anfrage(JIMDO_FRAU_HERR_ALT)
    assert r["anrede"] == "Herr"
    assert r["nachname"] == "Schmidt" or r["vorname"] == "Klaus"
    assert "Tür" in r["nachricht"]


def test_alt_webformular_einzeiler():
    body = (
        "Es gibt eine neue Anfrage.HerrKlaus-Konrad Meyer "
        "Adresse:Musterweg 1HamburgEmail:meyer@web.de"
        "Telefon:040 1234 Anfrage: Betrifft: Tür Nachricht: Bitte Angebot."
    )
    r = parse_anfrage(body, subject="Anfrage von Klaus-Konrad Meyer.")
    assert r["anrede"] == "Herr"
    assert r["vorname"] == "Klaus-Konrad"
    assert r["nachname"] == "Meyer"
    assert r["email"] == "meyer@web.de"
    assert "Bitte Angebot" in r["nachricht"]
