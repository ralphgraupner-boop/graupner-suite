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
        for line in invoice["customer_address"].split("\n"):
            c.drawString(2*cm, y_addr, line)
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


def generate_document_pdf(doc_type: str, data: dict, settings: dict) -> BytesIO:
    """Generiert PDF für Angebot, Auftragsbestätigung oder Rechnung"""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Colors
    primary_color = HexColor("#14532D")
    text_color = HexColor("#0F172A")
    muted_color = HexColor("#64748B")

    # Header
    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 20)

    titles = {
        "quote": "ANGEBOT",
        "order": "AUFTRAGSBESTÄTIGUNG",
        "invoice": "RECHNUNG"
    }
    c.drawString(2*cm, height - 2*cm, titles.get(doc_type, "DOKUMENT"))

    # Document number
    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    number_labels = {
        "quote": f"Angebots-Nr.: {data.get('quote_number', '')}",
        "order": f"Auftrags-Nr.: {data.get('order_number', '')}",
        "invoice": f"Rechnungs-Nr.: {data.get('invoice_number', '')}"
    }
    c.drawString(2*cm, height - 2.8*cm, number_labels.get(doc_type, ""))
    c.drawString(2*cm, height - 3.3*cm, f"Datum: {datetime.fromisoformat(data['created_at']).strftime('%d.%m.%Y')}")

    # Company info (right side)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - 2*cm, height - 2*cm, settings.get("company_name", "Tischlerei Graupner"))
    c.setFont("Helvetica", 9)
    y_pos = height - 2.5*cm
    if settings.get("address"):
        for line in settings["address"].split("\n"):
            c.drawRightString(width - 2*cm, y_pos, line)
            y_pos -= 0.4*cm
    if settings.get("phone"):
        c.drawRightString(width - 2*cm, y_pos, f"Tel: {settings['phone']}")
        y_pos -= 0.4*cm
    if settings.get("email"):
        c.drawRightString(width - 2*cm, y_pos, settings["email"])

    # Customer address
    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, height - 5*cm, data.get("customer_name", ""))
    y_addr = height - 5.5*cm
    if data.get("customer_address"):
        for line in data["customer_address"].split("\n"):
            c.drawString(2*cm, y_addr, line)
            y_addr -= 0.4*cm

    # Positions table
    y_table = height - 8*cm
    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(2*cm, y_table, "Pos")
    c.drawString(3*cm, y_table, "Beschreibung")
    c.drawString(12*cm, y_table, "Menge")
    c.drawString(14*cm, y_table, "Einheit")
    c.drawString(16*cm, y_table, "Einzelpreis")
    c.drawRightString(width - 2*cm, y_table, "Gesamt")

    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(2*cm, y_table - 0.2*cm, width - 2*cm, y_table - 0.2*cm)

    c.setFillColor(text_color)
    c.setFont("Helvetica", 9)
    y_pos = y_table - 0.7*cm

    for pos in data.get("positions", []):
        if y_pos < 5*cm:
            c.showPage()
            y_pos = height - 3*cm

        # Titel-Zeile: fett und über gesamte Breite
        if pos.get("type") == "titel":
            c.setFont("Helvetica-Bold", 10)
            c.drawString(2*cm, y_pos, str(pos.get("pos_nr", "")))
            c.drawString(3*cm, y_pos, pos.get("description", ""))
            c.setFont("Helvetica", 9)
            y_pos -= 0.6*cm
            continue

        c.drawString(2*cm, y_pos, str(pos.get("pos_nr", "")))

        desc = pos.get("description", "")
        desc_lines = desc.split("\n") if desc else [""]
        first_line = desc_lines[0] if desc_lines else ""
        rest_lines = desc_lines[1:] if len(desc_lines) > 1 else []

        # Erste Zeile fett
        c.setFont("Helvetica-Bold", 9)
        if len(first_line) > 50:
            c.drawString(3*cm, y_pos, first_line[:50])
            y_pos -= 0.4*cm
            c.drawString(3*cm, y_pos, first_line[50:100])
        else:
            c.drawString(3*cm, y_pos, first_line)

        # Restliche Zeilen normal
        c.setFont("Helvetica", 9)
        for line in rest_lines:
            y_pos -= 0.35*cm
            if y_pos < 5*cm:
                c.showPage()
                y_pos = height - 3*cm
            if len(line) > 55:
                c.drawString(3*cm, y_pos, line[:55])
                y_pos -= 0.35*cm
                c.drawString(3*cm, y_pos, line[55:110])
            else:
                c.drawString(3*cm, y_pos, line)

        c.drawString(12*cm, y_pos, str(pos.get("quantity", 1)))
        c.drawString(14*cm, y_pos, pos.get("unit", "Stück"))
        c.drawRightString(16.5*cm, y_pos, f"{pos.get('price_net', 0):.2f} €")
        total = pos.get("quantity", 1) * pos.get("price_net", 0)
        c.drawRightString(width - 2*cm, y_pos, f"{total:.2f} €")
        y_pos -= 0.6*cm

    # Totals
    y_pos -= 0.5*cm
    c.line(12*cm, y_pos, width - 2*cm, y_pos)
    y_pos -= 0.5*cm

    c.setFont("Helvetica", 10)
    c.drawString(14*cm, y_pos, "Netto:")
    c.drawRightString(width - 2*cm, y_pos, f"{data.get('subtotal_net', 0):.2f} €")
    y_pos -= 0.5*cm

    vat_rate = data.get("vat_rate", 19)
    if vat_rate > 0:
        c.drawString(14*cm, y_pos, f"MwSt ({vat_rate:.0f}%):")
        c.drawRightString(width - 2*cm, y_pos, f"{data.get('vat_amount', 0):.2f} €")
        y_pos -= 0.5*cm
    else:
        c.setFillColor(muted_color)
        c.setFont("Helvetica", 8)
        c.drawString(14*cm, y_pos, "Gemäß §19 UStG wird keine USt berechnet")
        c.setFillColor(text_color)
        c.setFont("Helvetica", 10)
        y_pos -= 0.5*cm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(14*cm, y_pos, "Gesamt:")
    c.drawRightString(width - 2*cm, y_pos, f"{data.get('total_gross', 0):.2f} €")

    # Notes
    if data.get("notes"):
        y_pos -= 1.5*cm
        c.setFont("Helvetica", 9)
        c.setFillColor(muted_color)
        c.drawString(2*cm, y_pos, "Anmerkungen:")
        c.setFillColor(text_color)
        y_pos -= 0.4*cm
        for line in data["notes"].split("\n")[:5]:
            c.drawString(2*cm, y_pos, line[:80])
            y_pos -= 0.4*cm

    # Footer - company details
    footer_y = 3.5*cm
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(2*cm, footer_y + 0.3*cm, width - 2*cm, footer_y + 0.3*cm)

    c.setFillColor(muted_color)
    c.setFont("Helvetica", 7)

    col1_x = 2*cm
    c.setFont("Helvetica-Bold", 7)
    c.drawString(col1_x, footer_y, settings.get("company_name", "Tischlerei Graupner"))
    c.setFont("Helvetica", 7)
    fy = footer_y - 0.35*cm
    if settings.get("owner_name"):
        c.drawString(col1_x, fy, f"Inh. {settings['owner_name']}")
        fy -= 0.35*cm
    if settings.get("address"):
        for line in settings["address"].split("\n")[:2]:
            c.drawString(col1_x, fy, line.strip())
            fy -= 0.35*cm

    col2_x = 7.5*cm
    fy2 = footer_y
    if settings.get("phone"):
        c.drawString(col2_x, fy2, f"Tel: {settings['phone']}")
        fy2 -= 0.35*cm
    if settings.get("email"):
        c.drawString(col2_x, fy2, settings["email"])
        fy2 -= 0.35*cm
    if settings.get("tax_id"):
        c.drawString(col2_x, fy2, f"St.-Nr.: {settings['tax_id']}")
        fy2 -= 0.35*cm

    col3_x = 13*cm
    fy3 = footer_y
    if settings.get("iban"):
        if settings.get("bank_name"):
            c.drawString(col3_x, fy3, settings["bank_name"])
            fy3 -= 0.35*cm
        c.drawString(col3_x, fy3, f"IBAN: {settings['iban']}")
        fy3 -= 0.35*cm
        if settings.get("bic"):
            c.drawString(col3_x, fy3, f"BIC: {settings['bic']}")
            fy3 -= 0.35*cm

    # Due date for invoices
    if doc_type == "invoice" and data.get("due_date"):
        try:
            due = datetime.fromisoformat(data["due_date"]).strftime('%d.%m.%Y')
            c.setFillColor(text_color)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(2*cm, footer_y + 0.8*cm, f"Zahlbar bis: {due}")
        except (ValueError, TypeError):
            pass

    # Valid until for quotes
    if doc_type == "quote" and data.get("valid_until"):
        try:
            valid = datetime.fromisoformat(data["valid_until"]).strftime('%d.%m.%Y')
            c.setFillColor(text_color)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(2*cm, footer_y + 0.8*cm, f"Gültig bis: {valid}")
        except (ValueError, TypeError):
            pass

    c.save()
    buffer.seek(0)
    return buffer
