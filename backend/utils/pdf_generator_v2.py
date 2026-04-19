"""
PDF-Generator fuer Rechnungen v2 (GoBD-konform, mit Verweis auf AB/Angebot).
Komplett eigenstaendig, keine Abhaengigkeit zu pdf_generator.py.
"""
from io import BytesIO
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

from utils.pdf_generator import _wrap_text, _draw_footer  # nur diese Helpers wiederverwenden


KOENIGSBLAU = HexColor("#003399")
SCHWARZ = HexColor("#000000")
GRAU = HexColor("#6B7280")


def _fmt_eur(val):
    return f"{float(val or 0):,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date_de(iso_str):
    if not iso_str:
        return ""
    try:
        if "bis" in iso_str.lower():
            return iso_str  # Zeitraum bleibt wie ist
        d = datetime.fromisoformat(iso_str.split("T")[0])
        return d.strftime("%d.%m.%Y")
    except Exception:
        return iso_str


def _draw_header(c, width, height, settings):
    """Firma links, 'Rechnung' gross rechts."""
    company_name = settings.get("company_name", "Tischlerei Graupner")
    address_lines = (settings.get("address") or "").split("\n")
    phone = settings.get("phone", "")
    email = settings.get("email", "")
    tax_id = settings.get("tax_id", "")  # noqa: F841
    ust_id = settings.get("ust_id", "")  # noqa: F841

    # Firmenname oben links
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(KOENIGSBLAU)
    c.drawString(2 * cm, height - 2 * cm, company_name)

    c.setFont("Helvetica", 8)
    c.setFillColor(GRAU)
    y = height - 2.5 * cm
    for line in address_lines[:3]:
        c.drawString(2 * cm, y, line)
        y -= 0.35 * cm
    if phone:
        c.drawString(2 * cm, y, f"Tel.: {phone}")
        y -= 0.35 * cm
    if email:
        c.drawString(2 * cm, y, f"E-Mail: {email}")


def _draw_customer_address(c, width, height, customer_snap):
    """Empfaenger-Adressfeld."""
    y = height - 5.5 * cm
    anrede = customer_snap.get("anrede", "") or ""
    name = customer_snap.get("name", "") or ""
    addr = customer_snap.get("address", "") or ""
    plz = customer_snap.get("plz", "") or ""
    ort = customer_snap.get("ort", "") or ""

    c.setFont("Helvetica", 10)
    c.setFillColor(SCHWARZ)

    line1 = f"{anrede} {name}".strip()
    c.drawString(2 * cm, y, line1)
    y -= 0.45 * cm
    if addr:
        for line in addr.split("\n")[:2]:
            c.drawString(2 * cm, y, line)
            y -= 0.45 * cm
    if plz or ort:
        c.drawString(2 * cm, y, f"{plz} {ort}".strip())


def _draw_right_meta(c, width, height, inv):
    """Rechte Spalte: Rechnungsnummer, Datum, Leistungsdatum, Kd-Nr."""
    x = width - 6.5 * cm
    y = height - 5.5 * cm

    def row(label, value, bold=False):
        nonlocal y
        c.setFont("Helvetica", 9)
        c.setFillColor(GRAU)
        c.drawString(x, y, label)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 10)
        c.setFillColor(SCHWARZ)
        c.drawString(x + 3.2 * cm, y, value)
        y -= 0.5 * cm

    row("Rechnung-Nr.:", inv.get("invoice_number", ""), bold=True)
    row("Datum:", _fmt_date_de(inv.get("invoice_date", "")))
    leistungsdat = _fmt_date_de(inv.get("leistungsdatum", "")) or inv.get("leistungsdatum", "")
    row("Leistungsdatum:", leistungsdat, bold=True)
    if inv.get("auftrag_number"):
        row("zu Auftrag:", inv.get("auftrag_number", ""))
    row("Kunden-Nr.:", (inv.get("customer_id") or "")[:8].upper())


def _draw_title(c, width, height, inv):
    """Gross-Titel 'Rechnung'."""
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(KOENIGSBLAU)
    c.drawString(2 * cm, height - 8.2 * cm, "Rechnung")
    if inv.get("betreff"):
        c.setFont("Helvetica", 11)
        c.setFillColor(SCHWARZ)
        c.drawString(2 * cm, height - 8.8 * cm, inv["betreff"])


def _draw_positions_or_verweis(c, width, height, inv, y_start):
    """Bei mode=voll: Tabelle. Bei mode=kurz: Verweistext + eine Zeile."""
    y = y_start

    # Vortext
    if inv.get("vortext"):
        c.setFont("Helvetica", 10)
        c.setFillColor(SCHWARZ)
        for line in _wrap_text(c, inv["vortext"], "Helvetica", 10, width - 4 * cm):
            c.drawString(2 * cm, y, line)
            y -= 0.45 * cm
        y -= 0.3 * cm

    # Verweis-Kasten
    if inv.get("verweis_text"):
        box_h = 0.9 * cm
        c.setFillColor(HexColor("#F3F4F6"))
        c.rect(2 * cm, y - box_h, width - 4 * cm, box_h, fill=1, stroke=0)
        c.setFillColor(SCHWARZ)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(2.2 * cm, y - 0.55 * cm, inv["verweis_text"])
        y -= box_h + 0.4 * cm

    # Tabellen-Kopf
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(KOENIGSBLAU)
    c.drawString(2 * cm, y, "Pos.")
    c.drawString(3 * cm, y, "Beschreibung")
    c.drawString(12 * cm, y, "Menge")
    c.drawString(13.5 * cm, y, "Einheit")
    c.drawRightString(16.5 * cm, y, "Einzel €")
    c.drawRightString(width - 2 * cm, y, "Gesamt €")
    y -= 0.2 * cm
    c.setStrokeColor(KOENIGSBLAU)
    c.setLineWidth(0.8)
    c.line(2 * cm, y, width - 2 * cm, y)
    y -= 0.5 * cm

    c.setFillColor(SCHWARZ)
    for idx, pos in enumerate(inv.get("positions", []), 1):
        if y < 6 * cm:
            break
        desc = pos.get("description", "") or ""
        first_line, *rest = desc.split("\n")
        c.setFont("Helvetica-Bold", 9)
        c.drawString(2 * cm, y, str(idx))
        wrapped = _wrap_text(c, first_line, "Helvetica-Bold", 9, 8.5 * cm)
        row_y = y
        for i, wl in enumerate(wrapped):
            c.drawString(3 * cm, y, wl)
            if i < len(wrapped) - 1:
                y -= 0.4 * cm

        c.setFont("Helvetica", 8.5)
        for line in rest:
            wrapped = _wrap_text(c, line, "Helvetica", 8.5, 8.5 * cm)
            for wl in wrapped:
                y -= 0.4 * cm
                c.drawString(3 * cm, y, wl)

        c.setFont("Helvetica", 9)
        c.drawString(12 * cm, row_y, f"{pos.get('quantity', 0):g}")
        c.drawString(13.5 * cm, row_y, pos.get("unit", ""))
        c.drawRightString(16.5 * cm, row_y, _fmt_eur(pos.get("price_net", 0)))
        total = (pos.get("quantity") or 0) * (pos.get("price_net") or 0)
        c.drawRightString(width - 2 * cm, row_y, _fmt_eur(total))
        y -= 0.7 * cm

    return y


def _draw_totals(c, width, inv, y):
    """Summen-Block rechts."""
    c.setStrokeColor(KOENIGSBLAU)
    c.line(11 * cm, y, width - 2 * cm, y)
    y -= 0.5 * cm

    def row(label, val, bold=False, highlight=False):
        nonlocal y
        if highlight:
            c.setFillColor(HexColor("#FEF3C7"))
            c.rect(11 * cm, y - 0.1 * cm, width - 13 * cm, 0.55 * cm, fill=1, stroke=0)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 10 if bold else 9)
        c.setFillColor(SCHWARZ)
        c.drawString(11 * cm, y, label)
        c.drawRightString(width - 2 * cm, y, val)
        y -= 0.5 * cm

    row("Netto-Summe:", _fmt_eur(inv.get("subtotal", 0)))
    if inv.get("discount_amount", 0):
        row("Rabatt:", f"- {_fmt_eur(inv.get('discount_amount', 0))}")
        row("Netto nach Rabatt:", _fmt_eur(inv.get("net_after_discount", 0)))
    row(f"MwSt {inv.get('vat_rate', 19):g} %:", _fmt_eur(inv.get("vat", 0)))
    row("Brutto-Gesamt:", _fmt_eur(inv.get("brutto", 0)), bold=True)
    if inv.get("deposit_amount", 0):
        row("Anzahlung:", f"- {_fmt_eur(inv.get('deposit_amount', 0))}")
        row("Rest zu zahlen:", _fmt_eur(inv.get("final_amount", 0)), bold=True, highlight=True)
    return y


def _draw_lohnanteil(c, width, inv, y):
    """Lohnanteil § 35a EStG - falls aktiv."""
    if not inv.get("show_lohnanteil"):
        return y
    lohn = inv.get("lohnanteil_custom")
    if lohn is None:
        # 60% des Nettos als Default
        lohn = (inv.get("net_after_discount") or 0) * 0.6
    if not lohn or lohn <= 0:
        return y
    lohn_mwst = lohn * (inv.get("vat_rate", 19) / 100)
    lohn_brutto = lohn + lohn_mwst
    y -= 0.3 * cm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(KOENIGSBLAU)
    c.drawString(2 * cm, y, "Hinweis § 35a EStG (Steuerbonus Handwerkerleistung):")
    y -= 0.45 * cm
    c.setFont("Helvetica", 8.5)
    c.setFillColor(SCHWARZ)
    c.drawString(2 * cm, y, f"Enthaltene Arbeits-/Fahrtkosten netto: {_fmt_eur(lohn)} · MwSt: {_fmt_eur(lohn_mwst)} · brutto: {_fmt_eur(lohn_brutto)}")
    y -= 0.4 * cm
    c.drawString(2 * cm, y, "20 % der Arbeitskosten sind als Steuerermäßigung nach § 35a EStG abzugsfähig (max. 1.200 € pro Jahr).")
    y -= 0.5 * cm
    return y


def _draw_payment_block(c, width, inv, settings, y):
    """Zahlungsbedingungen + Bank."""
    y -= 0.5 * cm
    due_days = inv.get("due_days", 14)
    try:
        inv_date = datetime.fromisoformat(inv.get("invoice_date", "").split("T")[0] or datetime.now().isoformat())
        due_date = inv_date + timedelta(days=due_days)
        due_str = due_date.strftime("%d.%m.%Y")
    except Exception:
        due_str = ""

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(KOENIGSBLAU)
    c.drawString(2 * cm, y, "Zahlungsbedingungen")
    y -= 0.5 * cm
    c.setFont("Helvetica", 9)
    c.setFillColor(SCHWARZ)
    c.drawString(2 * cm, y, f"Bitte überweisen Sie den Betrag innerhalb von {due_days} Tagen (bis zum {due_str}) auf folgendes Konto:")
    y -= 0.5 * cm

    iban = settings.get("iban", "") or ""
    bic = settings.get("bic", "") or ""
    bank = settings.get("bank", "") or ""
    c.drawString(2 * cm, y, f"Bank: {bank}  ·  IBAN: {iban}  ·  BIC: {bic}")
    y -= 0.5 * cm
    c.drawString(2 * cm, y, f"Verwendungszweck: {inv.get('invoice_number', '')}")
    y -= 0.8 * cm

    # Aufbewahrungs-Hinweis fuer Privatkunden bei Bauleistungen
    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(GRAU)
    c.drawString(2 * cm, y, "Hinweis: Die Aufbewahrungspflicht für diese Rechnung beträgt 2 Jahre (bei Privatkunden für Bau- und Handwerkerleistungen).")
    return y


def generate_invoice_v2_pdf(inv: dict, settings: dict) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    _draw_header(c, width, height, settings)
    _draw_customer_address(c, width, height, inv.get("customer_snapshot", {}))
    _draw_right_meta(c, width, height, inv)
    _draw_title(c, width, height, inv)

    y = _draw_positions_or_verweis(c, width, height, inv, y_start=height - 9.8 * cm)
    y = _draw_totals(c, width, inv, y)

    # Schlusstext
    if inv.get("schlusstext"):
        y -= 0.3 * cm
        c.setFont("Helvetica", 9)
        c.setFillColor(SCHWARZ)
        for line in _wrap_text(c, inv["schlusstext"], "Helvetica", 9, width - 4 * cm):
            c.drawString(2 * cm, y, line)
            y -= 0.4 * cm

    y = _draw_lohnanteil(c, width, inv, y)
    _draw_payment_block(c, width, inv, settings, y)

    # Footer
    try:
        _draw_footer(c, width, settings, 1)
    except Exception:
        pass

    c.save()
    buffer.seek(0)
    return buffer.read()
