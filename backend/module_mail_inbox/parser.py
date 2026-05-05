"""
Multi-Format-Parser für Kontaktformular-Mails.

Format A: NEUES Jimdo-Formular (über no-reply@jimdo.com)
    Frau Herr: Lawless
    Name: Jacqueline
    Telefonnummer: 0176...
    Nachricht: ...
    E-Mail (optional): ...@...

Format B: ALTES Webformular (kommt direkt vom Kunden, alles in einer Zeile)
    Es gibt eine neue Anfrage.HerrKlaus-Konrad Meyer Adresse:...HamburgEmail:...Telefon:...Anfrage: Betrifft:... Nachricht:...
    Vor- und Nachname werden zusätzlich aus Subject "Anfrage von X Y." gewonnen.

Parser-Output ist bei beiden gleich:
{anrede, vorname, nachname, telefon, email, nachricht, source_url, format}
"""
import re

URL_PATTERN = re.compile(r"https?://[^\s]*tischlerei-graupner\.de/[^\s]*", re.IGNORECASE)


def _empty():
    return {
        "anrede": "",
        "vorname": "",
        "nachname": "",
        "telefon": "",
        "email": "",
        "strasse": "",
        "plz": "",
        "ort": "",
        "nachricht": "",
        "source_url": "",
        "format": "",
    }


# Felder, die ein vollständiges Kontaktformular haben sollte.
# Anrede und source_url zählen NICHT mit (Anrede manchmal optional).
COMPLETENESS_FIELDS = ["vorname", "nachname", "telefon", "email", "strasse", "plz", "ort", "nachricht"]
# Mindestens so viele dieser Felder müssen ausgefüllt sein, damit eine Mail
# als echtes Kontaktformular gilt. Ralph-Vorgabe: ≥5 Zeilen.
MIN_COMPLETENESS = 5


def is_complete_form(parsed: dict) -> tuple[bool, int]:
    """Prüft, ob ein geparstes Anfrage-Dict ein echtes Kontaktformular ist.
    Returns: (ok, anzahl_gefuellte_felder)
    """
    if not parsed:
        return False, 0
    filled = sum(1 for f in COMPLETENESS_FIELDS if (parsed.get(f) or "").strip())
    return filled >= MIN_COMPLETENESS, filled



def _parse_jimdo(body: str) -> dict:
    """Format A – Jimdo-Formular mit Zeilenumbrüchen.
    Unterstützt zwei Varianten:
      - Alt:  'Frau Herr:' + 'Name:' (1 Feld für Vor+Nachname)
      - Neu:  'Auswahlliste:' + 'Vorname:' + 'Nachname:' (separate Felder)
    """
    out = _empty()
    out["format"] = "jimdo"

    m = URL_PATTERN.search(body)
    if m:
        out["source_url"] = m.group(0).rstrip(".,;:")

    # ── NEUES Jimdo-Format: separate Vor-/Nachname-Felder ──
    m = re.search(r"^[ \t]*Auswahlliste[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
    if m:
        raw = m.group(1).strip()
        if re.match(r"^(Herr|Frau|Divers)\s*$", raw, re.I):
            out["anrede"] = raw.capitalize()

    m = re.search(r"^[ \t]*Vorname[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
    if m:
        out["vorname"] = m.group(1).strip()

    m = re.search(r"^[ \t]*Nachname[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
    if m:
        out["nachname"] = m.group(1).strip()

    # ── ALTES Jimdo-Format (nur wenn neues nichts geliefert hat) ──
    if not out["anrede"] and not out["nachname"]:
        m = re.search(r"^[ \t]*Frau[ \t]*Herr[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
        if m:
            raw = m.group(1).strip()
            only_salutation = re.match(r"^(Herr|Frau)\s*$", raw, re.I)
            with_name = re.match(r"^(Herr|Frau)\s+(.+)$", raw, re.I)
            if only_salutation:
                out["anrede"] = only_salutation.group(1).capitalize()
            elif with_name:
                out["anrede"] = with_name.group(1).capitalize()
                out["nachname"] = with_name.group(2).strip()
            else:
                out["nachname"] = raw

    if not out["vorname"] and not out["nachname"]:
        m = re.search(r"^[ \t]*Name[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
        if m:
            raw_name = m.group(1).strip()
            parts = raw_name.split()
            if len(parts) >= 2:
                out["vorname"] = parts[0]
                out["nachname"] = " ".join(parts[1:])
            else:
                out["vorname"] = raw_name

    # Telefon
    m = re.search(r"^[ \t]*Telefonnummer[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
    if m:
        out["telefon"] = m.group(1).strip()
    if not out["telefon"]:
        m = re.search(r"^[ \t]*Telefon[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
        if m:
            out["telefon"] = m.group(1).strip()

    # E-Mail (optional / Pflicht)
    m = re.search(r"E-?Mail[^:]*:\s*([\w.+-]+@[\w.-]+\.\w{2,})", body, re.I)
    if m:
        out["email"] = m.group(1).strip().rstrip(".,;:)")

    # Nachricht
    m = re.search(
        r"Nachricht\s*:\s*(.+?)(?=\n\s*E-?Mail[^:]*:|\n\s*Nutzer\s+hat\s+die\s+Datenschutz|\Z)",
        body, re.I | re.S,
    )
    if m:
        out["nachricht"] = m.group(1).strip()

    # Adresse: Strasse / PLZ / Ort (neue Jimdo-Forms)
    m = re.search(r"^[ \t]*(?:Stra(?:ß|ss)e|Strasse|Anschrift)[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
    if m:
        out["strasse"] = m.group(1).strip()
    m = re.search(r"^[ \t]*PLZ[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
    if m:
        out["plz"] = m.group(1).strip()
    m = re.search(r"^[ \t]*Ort[ \t]*:[ \t]*([^\n]+?)[ \t]*$", body, re.I | re.M)
    if m:
        out["ort"] = m.group(1).strip()

    return out


def _parse_alt(body: str, subject: str = "", from_email: str = "") -> dict:
    """Format B – altes Webformular, alles in einer Zeile."""
    out = _empty()
    out["format"] = "alt"

    # Vor- und Nachname aus Subject "Anfrage von Vor Nachname."
    m = re.search(r"Anfrage\s+von\s+(.+?)\.?\s*$", subject or "", re.I)
    if m:
        full_name = m.group(1).strip().rstrip(".")
        # Doppel-Vornamen wie "Klaus-Konrad Meyer" abdecken
        parts = full_name.rsplit(" ", 1)
        if len(parts) == 2:
            out["vorname"] = parts[0].strip()
            out["nachname"] = parts[1].strip()
        else:
            out["nachname"] = full_name

    # Anrede aus Body ("HerrXxx" oder "FrauXxx" direkt nach "Anfrage.")
    m = re.search(r"Es\s+gibt\s+eine\s+neue\s+Anfrage\.?\s*(Herr|Frau)", body, re.I)
    if m:
        out["anrede"] = m.group(1).capitalize()

    # E-Mail: aus Body extrahieren — TLD MUSS klein sein, sonst wird "deTelefon" mitgegriffen
    m = re.search(r"Email\s*:\s*([\w.+-]+@[\w.-]+?\.[a-z]{2,4})(?=[A-Z]|\s|$)", body)
    if m:
        out["email"] = m.group(1).strip()
    elif from_email and "@" in from_email:
        out["email"] = from_email.strip()

    # Telefon (bis "Anfrage:" oder Zeilenende)
    m = re.search(r"Telefon\s*:\s*([\d\s+/().-]+?)(?=\s*Anfrage:|\s*$)", body, re.I)
    if m:
        out["telefon"] = m.group(1).strip()

    # Nachricht (ab "Nachricht:")
    m = re.search(r"Nachricht\s*:\s*(.+)$", body, re.I | re.S)
    if m:
        out["nachricht"] = m.group(1).strip().rstrip(".")

    # Optional auch "Betrifft:" mit übernehmen, vor die Nachricht
    m = re.search(r"Anfrage:\s*Betrifft:\s*([^.]+?)\s+Nachricht:", body, re.I)
    if m and out["nachricht"]:
        out["nachricht"] = f"Betrifft: {m.group(1).strip()}\n\n{out['nachricht']}"

    return out


def parse_anfrage(body: str, subject: str = "", from_email: str = "") -> dict:
    """Auto-Erkennung welches Format vorliegt."""
    body = (body or "").replace("\r\n", "\n").replace("\r", "\n")
    is_jimdo_new = bool(re.search(r"^[ \t]*Vorname[ \t]*:", body, re.I | re.M)) and bool(re.search(r"^[ \t]*Nachname[ \t]*:", body, re.I | re.M))
    is_jimdo_old = "Frau Herr:" in body and "Telefonnummer:" in body
    if is_jimdo_new or is_jimdo_old:
        result = _parse_jimdo(body)
    elif "Es gibt eine neue Anfrage" in body or re.search(r"Anfrage\s+von\s+", subject or "", re.I):
        result = _parse_alt(body, subject, from_email)
    else:
        # Default: probiere Jimdo (kein Treffer = leere Felder)
        result = _parse_jimdo(body)

    # Fallback: source_url auch aus dem Subject extrahieren
    if not result.get("source_url") and subject:
        m = URL_PATTERN.search(subject)
        if m:
            result["source_url"] = m.group(0).rstrip(".,;:")
    return result


# Rückwärtskompatibilität (Alias)
parse_jimdo_anfrage = parse_anfrage
