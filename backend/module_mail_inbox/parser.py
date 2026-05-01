"""
Regex-Parser für Jimdo-Kontaktformular-Mails.

Beispiel-Format (deterministisch, kommt immer von no-reply@jimdo.com):

    Hallo, du hast eine Nachricht über deine Jimdo-Seite
    https://www.tischlerei-graupner.de/.../ erhalten:

    Frau Herr: Lawless          <-- Nachname
    Name: Jacqueline            <-- Vorname
    Telefonnummer: 017634670479

    Nachricht: Hallo, ...
    [mehrzeilig]

    E-Mail (optional): jlawless42@gmail.com
    Nutzer hat die Datenschutzerklärung akzeptiert.

Hinweis: Jimdo dreht Vorname/Nachname (Feld "Frau Herr:" enthält Nachname,
Feld "Name:" enthält Vorname). Wir mappen das hier korrekt.
"""
import re


URL_PATTERN = re.compile(r"https?://[^\s]*tischlerei-graupner\.de/[^\s]*", re.IGNORECASE)


def parse_jimdo_anfrage(body: str) -> dict:
    """Liefert {anrede, vorname, nachname, telefon, email, nachricht, source_url}.
    Felder die nicht erkannt werden bleiben leer.
    """
    body = (body or "").replace("\r\n", "\n").replace("\r", "\n")

    out = {
        "anrede": "",
        "vorname": "",
        "nachname": "",
        "telefon": "",
        "email": "",
        "nachricht": "",
        "source_url": "",
    }

    # Quell-URL
    m = URL_PATTERN.search(body)
    if m:
        out["source_url"] = m.group(0).rstrip(".,;:")

    # Nachname (steht bei Jimdo paradoxerweise in "Frau Herr:")
    m = re.search(r"^\s*Frau\s*Herr\s*:\s*([^\n]+?)\s*$", body, re.IGNORECASE | re.MULTILINE)
    if m:
        raw = m.group(1).strip()
        # Manche Nutzer geben "Herr Mustermann" oder "Frau Mustermann" ein
        anrede_match = re.match(r"^(Herr|Frau)\s+(.+)$", raw, re.IGNORECASE)
        if anrede_match:
            out["anrede"] = anrede_match.group(1).capitalize()
            out["nachname"] = anrede_match.group(2).strip()
        else:
            out["nachname"] = raw

    # Vorname (steht bei Jimdo in "Name:")
    m = re.search(r"^\s*Name\s*:\s*([^\n]+?)\s*$", body, re.IGNORECASE | re.MULTILINE)
    if m:
        out["vorname"] = m.group(1).strip()

    # Telefon
    m = re.search(r"^\s*Telefonnummer\s*:\s*([^\n]+?)\s*$", body, re.IGNORECASE | re.MULTILINE)
    if m:
        out["telefon"] = m.group(1).strip()

    # E-Mail (optional)
    m = re.search(r"E-?Mail[^:]*:\s*([^\s\n]+@[^\s\n]+)", body, re.IGNORECASE)
    if m:
        out["email"] = m.group(1).strip().rstrip(".,;:)")

    # Nachricht – greife alles zwischen "Nachricht:" und "E-Mail" oder
    # "Nutzer hat die Datenschutzerklärung" oder Body-Ende.
    m = re.search(
        r"Nachricht\s*:\s*(.+?)(?=\n\s*E-?Mail[^:]*:|\n\s*Nutzer\s+hat\s+die\s+Datenschutz|\Z)",
        body,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        out["nachricht"] = m.group(1).strip()

    return out
