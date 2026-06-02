"""Termin-Einladungs-Service — gemeinsamer Mail-Versand fuer KI und Manuell.

Beide Wege (KI-Tool `termin_anlegen` und manueller Endpoint `POST /termin/{id}/send`)
nutzen diese Funktionen. Damit:
- ein einheitlicher Mail-Body (Gmail-1-Tap dank schema.org/Event JSON-LD)
- ein einheitlicher Test
- spaetere KI-Aktionen ("Mahnung versenden", "Rechnung schicken") folgen demselben Muster:
  Service-Funktion in module_X, KI-Tool ruft sie auf, manueller Route ruft sie auf.

KEINE Aenderung an db.module_termine, KEIN neues Modul.
"""
from __future__ import annotations
import json
from typing import Optional, Dict, Any, Tuple

from database import db, logger
from utils import send_email
from .ics_generator import build_ics_event


def _ort_aus_kunde(kunde: Optional[dict]) -> str:
    if not kunde:
        return ""
    return " ".join([
        f"{kunde.get('strasse','')} {kunde.get('hausnummer','')}".strip(),
        f"{kunde.get('plz','')} {kunde.get('ort','')}".strip(),
    ]).strip()


def _kunde_anzeige(kunde: Optional[dict]) -> str:
    if not kunde:
        return ""
    return (
        f"{kunde.get('vorname','')} {kunde.get('nachname','')}".strip()
        or kunde.get("name", "")
        or kunde.get("firma", "")
        or ""
    )


def baue_termin_mail(
    termin: dict,
    empfaenger_name: str,
    organisator_name: str,
    organisator_email: str,
    kunde: Optional[dict] = None,
) -> Tuple[str, str, bytes]:
    """Reiner Builder: liefert (subject, body_html, ics_bytes).

    body_html enthaelt:
    - schema.org/Event JSON-LD (Gmail erkennt das und zeigt "Termin hinzufuegen"-Knopf
      direkt im Mail-Header → Ein-Tipp-Add auf dem Handy)
    - Sichtbare Termin-Daten
    - Hinweis auf den ICS-Anhang (Fallback fuer Nicht-Gmail-Clients)

    Wird von beiden Aufrufern verwendet (KI und manuell).
    """
    titel = termin.get("titel", "Termin")
    start = termin.get("start", "")
    ende = termin.get("ende") or start
    ort = (termin.get("ort") or "").strip() or _ort_aus_kunde(kunde)
    beschreibung = (termin.get("beschreibung") or "").strip()
    kunde_name = _kunde_anzeige(kunde)

    # schema.org/Event JSON-LD — DAS ist der Trigger fuer Gmail's 1-Tap-Knopf.
    # Doku: https://developers.google.com/gmail/markup/reference/event-reservation
    schema_event: Dict[str, Any] = {
        "@context": "http://schema.org",
        "@type": "EventReservation",
        "reservationNumber": termin.get("id", ""),
        "reservationStatus": "http://schema.org/ReservationConfirmed",
        "underName": {
            "@type": "Person",
            "name": empfaenger_name,
        },
        "reservationFor": {
            "@type": "Event",
            "name": titel,
            "startDate": start,
            "endDate": ende,
        },
    }
    if ort:
        schema_event["reservationFor"]["location"] = {
            "@type": "Place",
            "name": kunde_name or ort,
            "address": ort,
        }
    if beschreibung:
        schema_event["reservationFor"]["description"] = beschreibung

    schema_org_block = (
        '<script type="application/ld+json">'
        + json.dumps(schema_event, ensure_ascii=False)
        + '</script>'
    )

    # ICS-Anhang (RFC 5545, von build_ics_event)
    ics_text = build_ics_event(
        termin,
        kunde,
        organizer_email=organisator_email or "",
        organizer_name=organisator_name or "",
    )

    # Body — sauberes HTML, Gmail-tauglich, schema.org im Head
    maps_url = (
        f"https://www.google.com/maps/dir/?api=1&destination={ort.replace(' ', '+')}"
        if ort else ""
    )

    zeile_wann = f"{start}{f' – {ende}' if ende and ende != start else ''}"
    zeile_wo = (
        f"<tr><td style='padding:6px 12px;font-weight:bold'>Wo:</td>"
        f"<td style='padding:6px 12px'>{ort}"
        f"{(f' (<a href={maps_url!r}>Route</a>)' if maps_url else '')}</td></tr>"
    ) if ort else ""
    zeile_kunde = (
        f"<tr><td style='padding:6px 12px;font-weight:bold'>Kunde:</td>"
        f"<td style='padding:6px 12px'>{kunde_name}</td></tr>"
    ) if kunde_name else ""
    zeile_beschr = (
        f"<tr><td style='padding:6px 12px;font-weight:bold;vertical-align:top'>Beschreibung:</td>"
        f"<td style='padding:6px 12px;white-space:pre-wrap'>{beschreibung}</td></tr>"
    ) if beschreibung else ""

    body_html = (
        "<!DOCTYPE html><html><head>"
        + schema_org_block
        + "</head><body style=\"font-family:Arial,sans-serif;max-width:600px;color:#111\">"
        + f"<h2 style=\"color:#16a34a;margin:0 0 8px 0\">📅 Termin: {titel}</h2>"
        + f"<p>Hallo {empfaenger_name},</p>"
        + f"<p>{organisator_name} hat dir einen Termin angelegt. "
          "Bei Gmail erscheint oben in der Mail automatisch der Knopf "
          "<strong>Zum Kalender hinzufuegen</strong> — einmal tippen, fertig. "
          "Falls kein Knopf da ist: einfach den Anhang <em>termin.ics</em> oeffnen.</p>"
        + "<table style=\"border-collapse:collapse;margin:16px 0\">"
        + f"<tr><td style='padding:6px 12px;font-weight:bold'>Wann:</td><td style='padding:6px 12px'>{zeile_wann}</td></tr>"
        + zeile_wo
        + zeile_kunde
        + zeile_beschr
        + "</table>"
        + "<p style=\"margin-top:24px;color:#666;font-size:12px\">"
        + "Gesendet von Tischlerei R. Graupner – Graupner Suite<br>"
        + f"Organisator: {organisator_name}"
        + (f" ({organisator_email})" if organisator_email else "")
        + "</p></body></html>"
    )

    subject = f"📅 Termin: {titel}" + (f" am {start[:10]}" if start else "")
    return subject, body_html, ics_text.encode("utf-8")


async def _lade_kunde(kunde_id: str) -> Optional[dict]:
    if not kunde_id:
        return None
    return await db.module_kunden.find_one(
        {"id": kunde_id},
        {"_id": 0, "vorname": 1, "nachname": 1, "name": 1, "firma": 1,
         "email": 1, "phone": 1, "strasse": 1, "hausnummer": 1, "plz": 1, "ort": 1},
    )


async def sende_termin_einladung(
    termin: dict,
    monteur_username: str,
    organisator: Optional[dict] = None,
    cc_email: Optional[str] = None,
) -> Dict[str, Any]:
    """Komfort-Wrapper: loest Monteur-Email auf, baut Mail, versendet.

    - `monteur_username`: Login aus db.users
    - `organisator`: Dict mit username/vorname/nachname/email (z.B. der eingeloggte User)
    - `cc_email`: Optionaler BCC (z.B. Smoketest: Mail-Kopie an Ralph)

    Wirft keine Exception nach aussen — gibt Status-Dict zurueck, damit der Aufrufer
    sauber dokumentieren kann, was passiert ist.
    """
    monteur_username = (monteur_username or "").strip()
    if not monteur_username:
        return {"ok": False, "status": "kein_monteur", "empfaenger_email": ""}

    user = await db.users.find_one(
        {"username": monteur_username},
        {"_id": 0, "email": 1, "vorname": 1, "nachname": 1},
    )
    if not user:
        return {"ok": False, "status": "monteur_unbekannt", "empfaenger_email": "",
                "fehler": f"User '{monteur_username}' nicht in db.users"}

    empf_email = (user.get("email") or "").strip()
    if not empf_email or "@" not in empf_email:
        return {"ok": False, "status": "monteur_ohne_email", "empfaenger_email": "",
                "fehler": f"User '{monteur_username}' hat keine gueltige Email"}

    empf_name = (
        f"{user.get('vorname','')} {user.get('nachname','')}".strip()
        or monteur_username
    )

    org = organisator or {}
    organisator_name = (
        f"{org.get('vorname','')} {org.get('nachname','')}".strip()
        or org.get("username", "")
        or "Ralph Graupner"
    )
    organisator_email = (org.get("email") or "").strip()

    kunde = await _lade_kunde((termin.get("kunde_id") or "").strip())

    subject, body_html, ics_bytes = baue_termin_mail(
        termin=termin,
        empfaenger_name=empf_name,
        organisator_name=organisator_name,
        organisator_email=organisator_email,
        kunde=kunde,
    )

    bcc = cc_email if (cc_email and "@" in cc_email and cc_email.lower() != empf_email.lower()) else None

    try:
        send_email(
            to_email=empf_email,
            subject=subject,
            body_html=body_html,
            attachments=[{"filename": "termin.ics", "data": ics_bytes}],
            bcc=bcc,
        )
        logger.info(f"sende_termin_einladung: an {empf_email}{f' (BCC {bcc})' if bcc else ''} fuer Termin '{termin.get('titel','')}'")
        return {
            "ok": True,
            "status": "versendet",
            "empfaenger_email": empf_email,
            "empfaenger_name": empf_name,
            "via": "schema_org_1tap",
            "cc": bcc or "",
        }
    except Exception as exc:
        logger.warning(f"sende_termin_einladung: Versand an {empf_email} fehlgeschlagen: {exc}")
        return {
            "ok": False,
            "status": "versand_fehler",
            "empfaenger_email": empf_email,
            "fehler": str(exc),
        }
