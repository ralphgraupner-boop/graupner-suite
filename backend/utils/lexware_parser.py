"""
Parser für Lexware Lohnabrechnung PDFs.
Extrahiert Stammdaten, Lohn- und Bankdaten aus PDF-Text (zeilenbasiert).
"""
import re


def parse_lohnabrechnung_text(text: str) -> dict:
    """Parst den extrahierten Text einer Lexware-Lohnabrechnung PDF."""
    lines = text.split("\n")
    data = {}

    def find_line(keyword):
        for i, l in enumerate(lines):
            if keyword in l:
                return i
        return -1

    # Abrechnungsmonat
    m = re.search(r"Abrechnung für (\w+ \d{4})", text)
    if m:
        data["abrechnungsmonat"] = m.group(1)

    # Anrede + Name + Adresse (feste Positionen: Zeile 3=Anrede, 4=Name, 5=Straße, 6=PLZ Ort)
    idx = find_line("Seite 1 von")
    if idx >= 0 and idx + 4 < len(lines):
        anrede = lines[idx + 1].strip()
        if anrede in ("Herr", "Frau", "Divers"):
            data["anrede"] = anrede
            full_name = lines[idx + 2].strip()
            parts = full_name.split(" ", 1)
            data["vorname"] = parts[0]
            data["nachname"] = parts[1] if len(parts) > 1 else ""
            data["strasse"] = lines[idx + 3].strip()
            plz_ort = lines[idx + 4].strip()
            m2 = re.match(r"(\d{5})\s+(.+)", plz_ort)
            if m2:
                data["plz"] = m2.group(1)
                data["ort"] = m2.group(2)

    # Personal-Nr, Geburtsdatum, Steuerklasse, Konfession
    # Headers on lines: "Personal-Nr.", "Geburtsdatum", "Steuerklasse Konfession"
    # Values on next lines after headers
    idx_pnr = find_line("Personal-Nr.")
    if idx_pnr >= 0:
        # Values start 3 lines after (after the 3 header lines)
        val_start = idx_pnr + 3
        if val_start < len(lines):
            data["personalnummer"] = lines[val_start].strip()
        if val_start + 1 < len(lines):
            geb = lines[val_start + 1].strip()
            m2 = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", geb)
            if m2:
                data["geburtsdatum"] = f"{m2.group(3)}-{m2.group(2)}-{m2.group(1)}"
        if val_start + 2 < len(lines):
            stkl = lines[val_start + 2].strip()
            data["steuerklasse"] = stkl if stkl != "-" else ""
        if val_start + 3 < len(lines):
            konf = lines[val_start + 3].strip().lower()
            konf_map = {"ohne": "keine", "ev": "ev", "rk": "rk"}
            data["konfession"] = konf_map.get(konf, konf if konf != "-" else "keine")

    # SV-Nummer + Krankenkasse
    # Lines: "Vers.-Nr.", "Krankenkasse", "Anteil PV", " ", then values
    idx_sv = find_line("Vers.-Nr.")
    if idx_sv >= 0:
        # Skip to value lines (after headers + blank)
        val_line_idx = idx_sv + 4  # "Vers.-Nr.", "Krankenkasse", "Anteil PV", " "
        if val_line_idx < len(lines):
            sv_line = lines[val_line_idx].strip()
            # Could be "59040190G009 DAK-Gesundheit" or just "64170579J510"
            sv_parts = sv_line.split(" ", 1)
            data["sv_nummer"] = sv_parts[0]
            if len(sv_parts) > 1:
                data["krankenkasse"] = sv_parts[1].strip().rstrip(" -")
            elif val_line_idx + 1 < len(lines):
                # Krankenkasse on next line
                kk = lines[val_line_idx + 1].strip().rstrip(" -")
                if kk and not kk.startswith("Pers"):
                    data["krankenkasse"] = kk

    # Personengruppe + Eintritt
    idx_pg = find_line("Pers.-Grp.")
    if idx_pg >= 0:
        val_start = idx_pg + 3  # "Pers.-Grp.", "Beitragsgruppe Eintritt", "Austritt"
        if val_start < len(lines):
            pg = lines[val_start].strip()
            pg_map = {
                "101": "101 - SV-pflichtig ohne bes. Merkmale",
                "102": "102 - Auszubildende",
                "109": "109 - Geringfügig entlohnt",
                "110": "110 - Kurzfristig Beschäftigte",
                "119": "119 - Versicherungsfreie Altersvollrentner",
                "120": "120 - Werkstudenten",
                "190": "190 - Geschäftsführer ohne SV-Pflicht",
            }
            data["personengruppe"] = pg_map.get(pg, pg)
            if pg == "109":
                data["beschaeftigungsart"] = "Minijob"
        if val_start + 2 < len(lines):
            eintritt = lines[val_start + 2].strip()
            m2 = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", eintritt)
            if m2:
                data["eintrittsdatum"] = f"{m2.group(3)}-{m2.group(2)}-{m2.group(1)}"

    # Steuer-IdNr
    idx_stid = find_line("Steuer-IdNr.")
    if idx_stid >= 0:
        # Values after header block
        for offset in range(2, 6):
            if idx_stid + offset < len(lines):
                candidate = lines[idx_stid + offset].strip()
                if re.match(r"^\d{11}$", candidate):
                    data["steuer_id"] = candidate
                    break

    # Urlaub Rest
    m = re.search(r"([\d,]+)\s+Tage übrig", text)
    if m:
        try:
            data["urlaub_rest"] = float(m.group(1).replace(",", "."))
        except ValueError:
            pass

    # Bank + IBAN
    m = re.search(r"Bank:\s*(.+)", text)
    if m:
        data["bank"] = m.group(1).strip()

    m = re.search(r"IBAN:\s*(DE[\d\s]+)", text)
    if m:
        data["iban"] = m.group(1).strip()

    # Gehalt / Lohn
    m = re.search(r"Gehalt\s+LSG\s+[\d,]+\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€", text)
    if m:
        betrag_str = m.group(2).replace(".", "").replace(",", ".")
        try:
            data["monatsgehalt"] = float(betrag_str)
            data["lohnart"] = "monatsgehalt"
        except ValueError:
            pass

    # Stundenlohn
    m = re.search(r"Stundenlohn.*?([\d.,]+)\s*€", text)
    if m:
        betrag_str = m.group(1).replace(".", "").replace(",", ".")
        try:
            data["stundenlohn"] = float(betrag_str)
            data["lohnart"] = "stundenlohn"
        except ValueError:
            pass

    # Gesamtbrutto
    m = re.search(r"Gesamtbrutto\s*\n?([\d.,]+)\s*€", text)
    if m:
        try:
            data["brutto"] = float(m.group(1).replace(".", "").replace(",", "."))
        except ValueError:
            pass

    # Netto / Auszahlungsbetrag
    m = re.search(r"Auszahlungsbetrag\s*\n?([\d.,]+)\s*€", text)
    if m:
        try:
            data["netto"] = float(m.group(1).replace(".", "").replace(",", "."))
        except ValueError:
            pass

    # Kinder
    m = re.search(r"(\d+)\s+Kinder", text)
    if m:
        data["kinderfreibetraege"] = int(m.group(1))

    return data


def parse_lexware_zip(zip_path: str) -> list:
    """Parst alle PDFs in einem Lexware ZIP-Export."""
    import zipfile
    import fitz
    import os
    import tempfile

    results = []

    with zipfile.ZipFile(zip_path, "r") as zf:
        pdf_names = [n for n in zf.namelist() if n.endswith(".pdf")]

        # Determine which are individual files vs combined
        individual = []
        combined = []
        for name in pdf_names:
            basename = os.path.basename(name)
            if basename.startswith("Lohnabrechnungen_"):
                combined.append(name)
            else:
                individual.append(name)

        # Prefer individual files
        to_parse = individual if individual else combined

        for name in to_parse:
            basename = os.path.basename(name)
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(zf.read(name))
                tmp_path = tmp.name

            try:
                doc = fitz.open(tmp_path)
                full_text = ""
                for page in doc:
                    full_text += page.get_text()
                doc.close()

                parsed = parse_lohnabrechnung_text(full_text)
                parsed["_source_file"] = basename
                parsed["_pdf_path"] = tmp_path
                results.append(parsed)
            except Exception:
                os.unlink(tmp_path)

    return results
