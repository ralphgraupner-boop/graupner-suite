from io import BytesIO
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor


def generate_dunning_pdf(invoice: dict, settings: dict, level: int) -> BytesIO:
    """Generiert Mahnungs-PDF"""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    primary_color = HexColor("#14532D")
    text_color = HexColor("#0F172A")
    muted_color = HexColor("#64748B")
    red_color = HexColor("#DC2626")

    titles = {1: "ZAHLUNGSERINNERUNG", 2: "1. MAHNUNG", 3: "LETZTE MAHNUNG"}
    title = titles.get(level, "MAHNUNG")

    c.setFillColor(red_color if level >= 2 else primary_color)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(2*cm, height - 2*cm, title)

    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, height - 2.8*cm, f"Zu Rechnung: {invoice.get('invoice_number', '')}")
    c.drawString(2*cm, height - 3.3*cm, f"Datum: {datetime.now(timezone.utc).strftime('%d.%m.%Y')}")

    # Company info
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - 2*cm, height - 2*cm, settings.get("company_name", "Tischlerei Graupner"))
    c.setFont("Helvetica", 9)
    y_pos = height - 2.5*cm
    if settings.get("address"):
        for line in settings["address"].split("\n"):
            c.drawRightString(width - 2*cm, y_pos, line)
            y_pos -= 0.4*cm

    # Customer
    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, height - 5*cm, invoice.get("customer_name", ""))
    y_addr = height - 5.5*cm
    if invoice.get("customer_address"):
        addr = invoice["customer_address"]
        addr_lines = addr.split("\n") if "\n" in addr else [p.strip() for p in addr.split(",")]
        for line in addr_lines:
            if line.strip():
                c.drawString(2*cm, y_addr, line.strip())
                y_addr -= 0.4*cm

    # Body text
    y_pos = height - 7.5*cm
    c.setFont("Helvetica", 10)

    messages = {
        1: [
            "Sehr geehrte Damen und Herren,",
            "",
            "bei Durchsicht unserer Unterlagen haben wir festgestellt, dass die Rechnung",
            f"Nr. {invoice.get('invoice_number', '')} vom {datetime.fromisoformat(invoice.get('created_at', datetime.now(timezone.utc).isoformat())).strftime('%d.%m.%Y')}",
            f"über {invoice.get('total_gross', 0):.2f} EUR noch nicht beglichen wurde.",
            "",
            "Sicherlich handelt es sich um ein Versehen. Wir bitten Sie, den offenen",
            "Betrag innerhalb der nächsten 7 Tage zu überweisen.",
        ],
        2: [
            "Sehr geehrte Damen und Herren,",
            "",
            f"trotz unserer Zahlungserinnerung ist die Rechnung Nr. {invoice.get('invoice_number', '')}",
            f"über {invoice.get('total_gross', 0):.2f} EUR weiterhin unbeglichen.",
            "",
            "Wir fordern Sie hiermit auf, den Betrag innerhalb von 7 Tagen",
            "auf unser Konto zu überweisen.",
        ],
        3: [
            "Sehr geehrte Damen und Herren,",
            "",
            f"trotz mehrfacher Aufforderung ist die Rechnung Nr. {invoice.get('invoice_number', '')}",
            f"über {invoice.get('total_gross', 0):.2f} EUR immer noch nicht beglichen.",
            "",
            "Dies ist unsere letzte Mahnung. Sollte der Betrag nicht innerhalb",
            "von 5 Tagen bei uns eingehen, werden wir weitere rechtliche Schritte",
            "einleiten.",
        ]
    }

    for line in messages.get(level, messages[1]):
        c.drawString(2*cm, y_pos, line)
        y_pos -= 0.45*cm

    # Amount box
    y_pos -= 0.5*cm
    c.setStrokeColor(red_color if level >= 2 else primary_color)
    c.setLineWidth(1.5)
    c.rect(2*cm, y_pos - 1.2*cm, 8*cm, 1.5*cm)
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(red_color if level >= 2 else text_color)
    c.drawString(2.5*cm, y_pos - 0.3*cm, f"Offener Betrag: {invoice.get('total_gross', 0):.2f} EUR")
    if invoice.get("due_date"):
        try:
            c.setFont("Helvetica", 9)
            due = datetime.fromisoformat(invoice["due_date"]).strftime('%d.%m.%Y')
            c.drawString(2.5*cm, y_pos - 0.8*cm, f"Ursprünglich fällig: {due}")
        except (ValueError, TypeError):
            pass

    # Closing
    y_pos -= 2.5*cm
    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, y_pos, "Mit freundlichen Grüßen")
    y_pos -= 0.6*cm
    c.drawString(2*cm, y_pos, settings.get("company_name", "Tischlerei Graupner"))

    # Bank details footer
    c.setFillColor(muted_color)
    c.setFont("Helvetica", 7)
    fy = 2.5*cm
    c.line(2*cm, fy + 0.3*cm, width - 2*cm, fy + 0.3*cm)
    if settings.get("iban"):
        bank_text = f"{settings.get('bank_name', '')} | IBAN: {settings['iban']}"
        if settings.get("bic"):
            bank_text += f" | BIC: {settings['bic']}"
        c.drawString(2*cm, fy, bank_text)
    if settings.get("tax_id"):
        c.drawString(2*cm, fy - 0.35*cm, f"St.-Nr.: {settings['tax_id']}")

    c.save()
    buffer.seek(0)
    return buffer


def _draw_continuation_header(c, width, height, settings, doc_type, doc_number, page_num):
    """Header für Folgeseiten: Firmenname, Dokument-Info, Seitenzähler"""
    koenigsblau = HexColor("#003399")
    muted_color = HexColor("#64748B")
    doc_titles = {"quote": "Angebot", "order": "Auftragsbestätigung", "invoice": "Rechnung"}

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(koenigsblau)
    c.drawString(2 * cm, height - 1.5 * cm, settings.get("company_name", "Tischlerei Graupner"))

    c.setFont("Helvetica", 9)
    c.drawString(2 * cm, height - 2 * cm, f"{doc_titles.get(doc_type, 'Dokument')} {doc_number}")

    c.setFillColor(muted_color)
    c.setFont("Helvetica", 8)
    c.drawRightString(width - 2 * cm, height - 1.5 * cm, f"Seite {page_num}")

    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(2 * cm, height - 2.3 * cm, width - 2 * cm, height - 2.3 * cm)


def generate_document_pdf(doc_type: str, data: dict, settings: dict) -> BytesIO:
    """Generiert PDF für Angebot, Auftragsbestätigung oder Rechnung — passend zum WYSIWYG-Editor"""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    page_num = 1

    # Colors
    primary_color = HexColor("#14532D")
    koenigsblau = HexColor("#003399")
    text_color = HexColor("#0F172A")
    muted_color = HexColor("#64748B")
    red_accent = HexColor("#CC0000")

    doc_titles = {
        "quote": "ANGEBOT",
        "order": "AUFTRAGSBESTÄTIGUNG",
        "invoice": "RECHNUNG"
    }
    number_keys = {
        "quote": "quote_number",
        "order": "order_number",
        "invoice": "invoice_number"
    }
    number_labels = {
        "quote": "Angebots-Nr.",
        "order": "Auftrags-Nr.",
        "invoice": "Rechnungs-Nr."
    }

    company_name = settings.get("company_name", "Tischlerei Graupner")
    address_lines = (settings.get("address") or "Erlengrund 129\n22453 Hamburg").split("\n")
    phone = settings.get("phone", "040 55567744")
    email = settings.get("email", "Service24@tischlerei-graupner.de")
    website = settings.get("website", "") or "www.tischlerei-graupner.de"
    tax_id = settings.get("tax_id", "")
    doc_number = data.get(number_keys.get(doc_type, "quote_number"), "")

    # === BRIEFKOPF (Letterhead) ===
    # Left: "Tischlerei Graupner seit 1960"
    y = height - 2 * cm
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(text_color)
    c.drawString(2 * cm, y, "Tischlerei")
    tischlerei_width = c.stringWidth("Tischlerei", "Helvetica-Bold", 22)
    c.setFillColor(koenigsblau)
    c.drawString(2 * cm + tischlerei_width + 2, y, "Graupner")
    graupner_width = c.stringWidth("Graupner", "Helvetica-Bold", 22)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(red_accent)
    c.drawString(2 * cm + tischlerei_width + graupner_width + 8, y + 2, "seit 1960")

    y -= 0.5 * cm
    c.setFont("Helvetica", 9)
    c.setFillColor(koenigsblau)
    c.drawString(2 * cm, y, "Mitglied der Handwerkskammer Hamburg")

    # Right: Company info in blue
    ry = height - 2 * cm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(koenigsblau)
    c.drawRightString(width - 2 * cm, ry, company_name)
    ry -= 0.35 * cm
    c.setFont("Helvetica", 8)
    for line in address_lines:
        c.drawRightString(width - 2 * cm, ry, line.strip())
        ry -= 0.35 * cm
    c.drawRightString(width - 2 * cm, ry, f"Tel.: {phone}")
    ry -= 0.35 * cm
    c.drawRightString(width - 2 * cm, ry, email)
    ry -= 0.35 * cm
    if website:
        c.drawRightString(width - 2 * cm, ry, website)
        ry -= 0.35 * cm
    if tax_id:
        c.drawRightString(width - 2 * cm, ry, f"Steuernummer: {tax_id}")
        ry -= 0.35 * cm

    # Right: Kd.-Nr., Datum, Dokument-Nr.
    ry -= 0.2 * cm
    c.setStrokeColor(HexColor("#B3C6E0"))
    c.line(width - 6 * cm, ry + 0.15 * cm, width - 2 * cm, ry + 0.15 * cm)
    c.setFont("Helvetica", 8)
    c.setFillColor(koenigsblau)
    customer_id = data.get("customer_id", "")
    c.drawRightString(width - 2 * cm, ry, f"Kd.-Nr.: {customer_id[:8].upper() if customer_id else '-'}")
    ry -= 0.35 * cm
    try:
        datum = datetime.fromisoformat(data["created_at"]).strftime("%d.%m.%Y")
    except (KeyError, ValueError):
        datum = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    c.drawRightString(width - 2 * cm, ry, f"Datum: {datum}")
    ry -= 0.35 * cm
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(width - 2 * cm, ry, f"{number_labels.get(doc_type, 'Nr.')}: {doc_number}")

    # === DIN 5008 Brieffenster (Absenderzeile + Kundenadresse) ===
    y_addr_start = height - 5 * cm
    c.setFont("Helvetica", 6.5)
    c.setFillColor(muted_color)
    sender_line = f"{company_name} · {' · '.join(l.strip() for l in address_lines)}"
    c.drawString(2 * cm, y_addr_start + 0.3 * cm, sender_line)
    c.setStrokeColor(HexColor("#D0D0D0"))
    c.line(2 * cm, y_addr_start + 0.15 * cm, 9 * cm, y_addr_start + 0.15 * cm)

    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    y_cust = y_addr_start - 0.3 * cm
    c.drawString(2 * cm, y_cust, data.get("customer_name", ""))
    y_cust -= 0.4 * cm
    if data.get("customer_address"):
        addr = data["customer_address"]
        # Adresse aufteilen: Zeilenumbrüche oder Kommas
        if "\n" in addr:
            addr_lines = addr.split("\n")
        else:
            addr_lines = [part.strip() for part in addr.split(",")]
        for line in addr_lines:
            if line.strip():
                c.drawString(2 * cm, y_cust, line.strip())
                y_cust -= 0.4 * cm

    # === Angebots-Nr. groß in Blau ===
    y_doc_nr = height - 10.5 * cm
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(koenigsblau)
    c.drawString(2 * cm, y_doc_nr, f"{number_labels.get(doc_type, 'Nr.')}: {doc_number}")

    # === Betreff (fett, blau) ===
    y_betreff = y_doc_nr - 0.7 * cm
    betreff = data.get("betreff", "")
    if betreff:
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(koenigsblau)
        c.drawString(2 * cm, y_betreff, betreff[:80])
        y_betreff -= 0.5 * cm

    # === Vortext ===
    y_vt = y_betreff - 0.3 * cm
    vortext = data.get("vortext", "")
    if vortext:
        c.setFont("Helvetica", 9)
        c.setFillColor(text_color)
        for line in vortext.split("\n")[:6]:
            c.drawString(2 * cm, y_vt, line[:90])
            y_vt -= 0.35 * cm
        y_vt -= 0.2 * cm

    # === Positions Table ===
    y_table = y_vt - 0.3 * cm
    if y_table > height - 11 * cm:
        y_table = height - 11 * cm

    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(2 * cm, y_table, "Pos")
    c.drawString(3 * cm, y_table, "Beschreibung")
    c.drawString(12 * cm, y_table, "Menge")
    c.drawString(13.5 * cm, y_table, "Einheit")
    c.drawString(15.5 * cm, y_table, "Einzelpreis")
    c.drawRightString(width - 2 * cm, y_table, "Gesamt")

    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(2 * cm, y_table - 0.2 * cm, width - 2 * cm, y_table - 0.2 * cm)

    c.setFillColor(text_color)
    c.setFont("Helvetica", 9)
    y_pos = y_table - 0.7 * cm

    footer_y_limit = 5.5 * cm

    for pos in data.get("positions", []):
        if y_pos < footer_y_limit:
            _draw_footer(c, width, settings, page_num)
            c.showPage()
            page_num += 1
            _draw_continuation_header(c, width, height, settings, doc_type, doc_number, page_num)
            y_pos = height - 3.5 * cm
            c.setFillColor(text_color)
            c.setFont("Helvetica", 9)

        # Titel-Zeile: fett und über gesamte Breite
        if pos.get("type") == "titel":
            c.setFont("Helvetica-Bold", 10)
            c.drawString(2 * cm, y_pos, str(pos.get("pos_nr", "")))
            c.drawString(3 * cm, y_pos, pos.get("description", ""))
            c.setFont("Helvetica", 9)
            y_pos -= 0.6 * cm
            continue

        c.drawString(2 * cm, y_pos, str(pos.get("pos_nr", "")))

        desc = pos.get("description", "")
        desc_lines = desc.split("\n") if desc else [""]
        first_line = desc_lines[0] if desc_lines else ""
        rest_lines = desc_lines[1:] if len(desc_lines) > 1 else []

        # Erste Zeile fett
        c.setFont("Helvetica-Bold", 9)
        if len(first_line) > 55:
            c.drawString(3 * cm, y_pos, first_line[:55])
            y_pos -= 0.35 * cm
            c.setFont("Helvetica", 8)
            c.drawString(3 * cm, y_pos, first_line[55:115])
        else:
            c.drawString(3 * cm, y_pos, first_line)

        # Restliche Zeilen normal
        c.setFont("Helvetica", 8)
        for line in rest_lines:
            y_pos -= 0.35 * cm
            if y_pos < footer_y_limit:
                _draw_footer(c, width, settings, page_num)
                c.showPage()
                page_num += 1
                _draw_continuation_header(c, width, height, settings, doc_type, doc_number, page_num)
                y_pos = height - 3.5 * cm
                c.setFillColor(text_color)
                c.setFont("Helvetica", 8)
            if len(line) > 60:
                c.drawString(3 * cm, y_pos, line[:60])
                y_pos -= 0.35 * cm
                c.drawString(3 * cm, y_pos, line[60:120])
            else:
                c.drawString(3 * cm, y_pos, line)

        c.setFont("Helvetica", 9)
        c.drawString(12 * cm, y_pos, str(pos.get("quantity", 1)))
        c.drawString(13.5 * cm, y_pos, pos.get("unit", "Stück"))
        c.drawRightString(16.5 * cm, y_pos, f"{pos.get('price_net', 0):.2f} €")
        total = pos.get("quantity", 1) * pos.get("price_net", 0)
        c.drawRightString(width - 2 * cm, y_pos, f"{total:.2f} €")
        y_pos -= 0.6 * cm

    # === Totals ===
    y_pos -= 0.5 * cm
    if y_pos < footer_y_limit + 3 * cm:
        _draw_footer(c, width, settings, page_num)
        c.showPage()
        page_num += 1
        _draw_continuation_header(c, width, height, settings, doc_type, doc_number, page_num)
        y_pos = height - 3.5 * cm

    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(12 * cm, y_pos, width - 2 * cm, y_pos)
    y_pos -= 0.5 * cm

    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    c.drawString(14 * cm, y_pos, "Netto:")
    c.drawRightString(width - 2 * cm, y_pos, f"{data.get('subtotal_net', 0):.2f} €")
    y_pos -= 0.5 * cm

    # Discount
    discount = data.get("discount", 0)
    if discount > 0:
        discount_type = data.get("discount_type", "percent")
        if discount_type == "percent":
            c.drawString(14 * cm, y_pos, f"Rabatt ({discount:.0f}%):")
            discount_amt = data.get("subtotal_net", 0) * (discount / 100)
        else:
            c.drawString(14 * cm, y_pos, "Rabatt:")
            discount_amt = discount
        c.drawRightString(width - 2 * cm, y_pos, f"-{discount_amt:.2f} €")
        y_pos -= 0.5 * cm

    vat_rate = data.get("vat_rate", 19)
    if vat_rate > 0:
        c.drawString(14 * cm, y_pos, f"MwSt ({vat_rate:.0f}%):")
        c.drawRightString(width - 2 * cm, y_pos, f"{data.get('vat_amount', 0):.2f} €")
        y_pos -= 0.5 * cm
    else:
        c.setFillColor(muted_color)
        c.setFont("Helvetica", 8)
        c.drawString(14 * cm, y_pos, "Gemäß §19 UStG wird keine USt berechnet")
        c.setFillColor(text_color)
        c.setFont("Helvetica", 10)
        y_pos -= 0.5 * cm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(14 * cm, y_pos, "Gesamt:")
    c.drawRightString(width - 2 * cm, y_pos, f"{data.get('total_gross', 0):.2f} €")
    y_pos -= 0.8 * cm

    # === Schlusstext ===
    schlusstext = data.get("schlusstext", "")
    if schlusstext:
        c.setFont("Helvetica", 9)
        c.setFillColor(text_color)
        for line in schlusstext.split("\n")[:8]:
            if y_pos < footer_y_limit:
                _draw_footer(c, width, settings, page_num)
                c.showPage()
                page_num += 1
                _draw_continuation_header(c, width, height, settings, doc_type, doc_number, page_num)
                y_pos = height - 3.5 * cm
            c.drawString(2 * cm, y_pos, line[:90])
            y_pos -= 0.35 * cm

    # Valid until / Due date
    if doc_type == "quote" and data.get("valid_until"):
        try:
            valid = datetime.fromisoformat(data["valid_until"]).strftime("%d.%m.%Y")
            y_pos -= 0.3 * cm
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(text_color)
            c.drawString(2 * cm, y_pos, f"Gültig bis: {valid}")
        except (ValueError, TypeError):
            pass

    if doc_type == "invoice" and data.get("due_date"):
        try:
            due = datetime.fromisoformat(data["due_date"]).strftime("%d.%m.%Y")
            y_pos -= 0.3 * cm
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(text_color)
            c.drawString(2 * cm, y_pos, f"Zahlbar bis: {due}")
        except (ValueError, TypeError):
            pass

    # === Footer ===
    _draw_footer(c, width, settings, page_num)

    c.save()
    buffer.seek(0)
    return buffer


def _draw_footer(c, width, settings, page_num=1):
    """Zeichnet die Fußzeile mit Firmendaten, Bankverbindung und Seitenzähler"""
    muted_color = HexColor("#64748B")
    footer_y = 3.5 * cm

    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(2 * cm, footer_y + 0.3 * cm, width - 2 * cm, footer_y + 0.3 * cm)

    c.setFillColor(muted_color)

    # Seitenzähler
    c.setFont("Helvetica", 7)
    c.drawRightString(width - 2 * cm, footer_y + 0.5 * cm, f"Seite {page_num}")

    # Column 1: Company
    col1_x = 2 * cm
    c.setFont("Helvetica-Bold", 7)
    c.drawString(col1_x, footer_y, settings.get("company_name", "Tischlerei Graupner"))
    c.setFont("Helvetica", 7)
    fy = footer_y - 0.35 * cm
    if settings.get("owner_name"):
        c.drawString(col1_x, fy, f"Inh. {settings['owner_name']}")
        fy -= 0.35 * cm
    if settings.get("address"):
        for line in settings["address"].split("\n")[:2]:
            c.drawString(col1_x, fy, line.strip())
            fy -= 0.35 * cm

    # Column 2: Contact + Tax
    col2_x = 7.5 * cm
    fy2 = footer_y
    if settings.get("phone"):
        c.drawString(col2_x, fy2, f"Tel: {settings['phone']}")
        fy2 -= 0.35 * cm
    if settings.get("email"):
        c.drawString(col2_x, fy2, settings["email"])
        fy2 -= 0.35 * cm
    if settings.get("website"):
        c.drawString(col2_x, fy2, settings["website"])
        fy2 -= 0.35 * cm
    if settings.get("tax_id"):
        c.drawString(col2_x, fy2, f"St.-Nr.: {settings['tax_id']}")
        fy2 -= 0.35 * cm

    # Column 3: Bank
    col3_x = 13 * cm
    fy3 = footer_y
    if settings.get("iban"):
        if settings.get("bank_name"):
            c.drawString(col3_x, fy3, settings["bank_name"])
            fy3 -= 0.35 * cm
        c.drawString(col3_x, fy3, f"IBAN: {settings['iban']}")
        fy3 -= 0.35 * cm
        if settings.get("bic"):
            c.drawString(col3_x, fy3, f"BIC: {settings['bic']}")
            fy3 -= 0.35 * cm
