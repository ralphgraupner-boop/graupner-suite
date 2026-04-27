"""ICS (RFC 5545) Generator – minimaler reiner Text-Output, keine externe Lib."""
from datetime import datetime, timezone
from typing import Optional


def _fmt_dt(s: str) -> str:
    """Konvertiert ISO-String zu ICS-Format YYYYMMDDTHHMMSS (lokal, ohne Z, mit TZID)."""
    if not s:
        return ""
    s = s.replace("Z", "+00:00")
    try:
        # datetime-local kommt z.B. als '2026-04-30T14:00' oder '2026-04-30T14:00:00'
        dt = datetime.fromisoformat(s)
    except Exception:
        return ""
    return dt.strftime("%Y%m%dT%H%M%S")


def _esc(text: str) -> str:
    if text is None:
        return ""
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _wrap(line: str) -> str:
    """RFC 5545 Zeilen-Faltung bei 75 Zeichen."""
    if len(line.encode("utf-8")) <= 75:
        return line
    out = []
    while len(line.encode("utf-8")) > 75:
        out.append(line[:74])
        line = " " + line[74:]
    out.append(line)
    return "\r\n".join(out)


def _build_event_block(termin: dict, kunde: Optional[dict] = None,
                       organizer_email: str = "", organizer_name: str = "") -> str:
    """Erzeugt ein einzelnes VEVENT-Block."""
    uid = f"{termin.get('id','')}@graupner-suite"
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtstart = _fmt_dt(termin.get("start", ""))
    dtend = _fmt_dt(termin.get("ende", "")) or dtstart  # Fallback: gleicher Zeitpunkt

    summary = _esc(termin.get("titel", "Termin"))
    location = _esc(termin.get("ort", "") or "")
    if not location and kunde:
        loc_parts = [
            f"{kunde.get('strasse','')} {kunde.get('hausnummer','')}".strip(),
            f"{kunde.get('plz','')} {kunde.get('ort','')}".strip(),
        ]
        location = _esc(" ".join([p for p in loc_parts if p]))

    desc_parts = []
    if termin.get("beschreibung"):
        desc_parts.append(termin["beschreibung"])
    if kunde:
        kunde_name = (
            f"{kunde.get('vorname','')} {kunde.get('nachname','')}".strip()
            or kunde.get("name", "")
            or kunde.get("firma", "")
        )
        if kunde_name:
            desc_parts.append(f"Kunde: {kunde_name}")
        if kunde.get("phone"):
            desc_parts.append(f"Telefon: {kunde['phone']}")
        if kunde.get("email"):
            desc_parts.append(f"E-Mail: {kunde['email']}")
    if termin.get("typ"):
        desc_parts.append(f"Typ: {termin['typ']}")
    description = _esc("\n".join(desc_parts))

    lines = [
        "BEGIN:VEVENT",
        _wrap(f"UID:{uid}"),
        _wrap(f"DTSTAMP:{dtstamp}"),
        _wrap(f"DTSTART:{dtstart}") if dtstart else "",
        _wrap(f"DTEND:{dtend}") if dtend else "",
        _wrap(f"SUMMARY:{summary}"),
    ]
    if location:
        lines.append(_wrap(f"LOCATION:{location}"))
    if description:
        lines.append(_wrap(f"DESCRIPTION:{description}"))
    if organizer_email:
        cn = _esc(organizer_name) if organizer_name else organizer_email
        lines.append(_wrap(f"ORGANIZER;CN={cn}:mailto:{organizer_email}"))
    lines.append("STATUS:CONFIRMED")
    lines.append("END:VEVENT")
    return "\r\n".join([l for l in lines if l])


def _build_calendar_wrapper(events_text: str, name: str = "Graupner Suite") -> str:
    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Tischlerei Graupner//Graupner Suite//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        _wrap(f"X-WR-CALNAME:{_esc(name)}"),
        events_text,
        "END:VCALENDAR",
        "",
    ])


def build_ics_event(termin: dict, kunde: Optional[dict] = None,
                    organizer_email: str = "", organizer_name: str = "") -> str:
    """ICS für einen einzelnen Termin (zum Mail-Anhang)."""
    block = _build_event_block(termin, kunde, organizer_email, organizer_name)
    return _build_calendar_wrapper(block, name=termin.get("titel", "Termin"))


def build_ics_calendar(events: list, calendar_name: str = "Graupner Suite") -> str:
    """ICS für viele Termine (Monteur-Feed-Abo).
    events: Liste von (termin_dict, kunde_dict_or_none)
    """
    blocks = [_build_event_block(t, k) for (t, k) in events]
    return _build_calendar_wrapper("\r\n".join(blocks), name=calendar_name)
