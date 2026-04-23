"""
Dokumente v2 – PDF-Generator
Eigener, isolierter ReportLab-Generator (kein Zugriff auf utils/pdf.py).

Firmen-Briefkopf aus:
  - dokumente_v2_settings (Firma, Zahlungsziel, Footer…)
  - settings (company_settings – Logo, Adresse, Kontakt)

Layout bewusst einfach gehalten, damit du es leicht anpassen kannst:
- Briefkopf (Firma + Adresse + Kunde)
- Betreff + Nummer + Datum
- Positionen-Tabelle
- Summen
- Schlusstext + Footer
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT

from database import db


TYPE_HEADING = {
    "angebot": "Angebot",
    "auftrag": "Auftragsbestätigung",
    "rechnung": "Rechnung",
    "gutschrift": "Gutschrift",
}


async def _load_company_settings() -> dict:
    """Firmendaten aus settings.company_settings (lesend, nicht schreiben)."""
    doc = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    return doc


async def _load_module_settings() -> dict:
    doc = await db.dokumente_v2_settings.find_one({"id": "default"}, {"_id": 0}) or {}
    return doc


def _fmt_eur(v) -> str:
    return f"{float(v or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " €"


async def generate_pdf(dokument: dict) -> bytes:
    company = await _load_company_settings()
    mod_settings = await _load_module_settings()

    buf = io.BytesIO()
    doc_pdf = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=18 * mm,
        title=f"{TYPE_HEADING.get(dokument.get('type'), 'Dokument')} {dokument.get('nummer') or 'Entwurf'}",
    )

    styles = getSampleStyleSheet()
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, leading=10)
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontSize=10, leading=13)
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=16, leading=20)

    story = []

    # Briefkopf (Firmen-Kurz-Zeile + Kundenblock)
    firma_name = (
        company.get("company_name") or mod_settings.get("firma_name")
        or "Tischlerei R.Graupner"
    )
    firma_adresse_klein = (
        f"{firma_name} · "
        f"{company.get('address', '')} {company.get('city', '')}"
    )
    story.append(Paragraph(firma_adresse_klein.strip(" ·"), small))
    story.append(Spacer(1, 2 * mm))

    # Empfänger
    anschrift_lines = []
    if dokument.get("kunde_name"):
        anschrift_lines.append(dokument["kunde_name"])
    if dokument.get("kunde_adresse"):
        for line in str(dokument["kunde_adresse"]).split("\n"):
            if line.strip():
                anschrift_lines.append(line.strip())
    empf_text = "<br/>".join(anschrift_lines) or "—"
    story.append(Paragraph(empf_text, normal))
    story.append(Spacer(1, 10 * mm))

    # Titel + Nummer + Datum
    heading = TYPE_HEADING.get(dokument.get("type"), "Dokument")
    nummer = dokument.get("nummer") or "(Entwurf)"
    issued_at = dokument.get("issued_at") or dokument.get("created_at")
    try:
        issued_dt = datetime.fromisoformat(issued_at.replace("Z", "+00:00"))
        datum = issued_dt.strftime("%d.%m.%Y")
    except Exception:
        datum = ""

    header_table = Table(
        [[Paragraph(f"<b>{heading}</b>", h1), Paragraph(f"<para align='right'>Nr. <b>{nummer}</b><br/>Datum: {datum}</para>", normal)]],
        colWidths=[95 * mm, 75 * mm],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    if dokument.get("betreff"):
        story.append(Paragraph(f"<b>Betreff:</b> {dokument['betreff']}", normal))
        story.append(Spacer(1, 4 * mm))

    # Vortext
    if dokument.get("vortext"):
        for line in str(dokument["vortext"]).split("\n"):
            story.append(Paragraph(line, normal))
        story.append(Spacer(1, 4 * mm))

    # Positionen-Tabelle
    head_row = ["Pos.", "Beschreibung", "Menge", "Einh.", "Einzelpreis", "Gesamt"]
    rows = [head_row]

    netto = 0.0
    mwst = 0.0
    mwst_gruppen: dict[float, float] = {}
    for i, p in enumerate(dokument.get("positions") or [], start=1):
        menge = float(p.get("menge") or 0)
        preis = float(p.get("einzelpreis") or 0)
        rabatt = float(p.get("rabatt_prozent") or 0)
        mwst_satz = float(p.get("mwst_satz") or 0)
        zeile_netto = menge * preis * (1 - rabatt / 100.0)
        zeile_mwst = zeile_netto * mwst_satz / 100.0
        netto += zeile_netto
        mwst += zeile_mwst
        mwst_gruppen[mwst_satz] = mwst_gruppen.get(mwst_satz, 0) + zeile_mwst

        beschreibung_text = str(p.get("beschreibung") or "").replace("\n", "<br/>")
        rows.append([
            p.get("position_nr") or str(i),
            Paragraph(beschreibung_text, normal),
            f"{menge:g}".replace(".", ","),
            p.get("einheit") or "",
            _fmt_eur(preis),
            _fmt_eur(zeile_netto),
        ])

    if len(rows) == 1:
        rows.append(["", Paragraph("<i>keine Positionen</i>", normal), "", "", "", ""])

    pos_table = Table(rows, colWidths=[15 * mm, 80 * mm, 17 * mm, 15 * mm, 25 * mm, 25 * mm], repeatRows=1)
    pos_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#14532D")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (3, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(pos_table)
    story.append(Spacer(1, 4 * mm))

    # Summen-Tabelle
    sum_rows = [["Netto", _fmt_eur(netto)]]
    for satz, betrag in sorted(mwst_gruppen.items()):
        sum_rows.append([f"zzgl. {satz:g}% MwSt.", _fmt_eur(betrag)])
    brutto = netto + mwst
    sum_rows.append(["Gesamt brutto", _fmt_eur(brutto)])

    sum_table = Table(sum_rows, colWidths=[40 * mm, 30 * mm], hAlign="RIGHT")
    sum_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, colors.HexColor("#14532D")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 10),
        ("TOPPADDING", (0, -1), (-1, -1), 4),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 4 * mm))

    # §35a Hinweis (nur Rechnung, wenn Lohnanteil > 0)
    lohn_netto = float(dokument.get("lohn_netto") or 0)
    if dokument.get("type") == "rechnung" and lohn_netto > 0:
        lohn_brutto_hinweis = lohn_netto * (1 + (mwst / netto if netto else 0))
        hinweis = (
            "<b>Hinweis §35a EStG:</b> "
            f"Der Arbeitslohn-Anteil (inkl. MwSt.) beträgt {_fmt_eur(lohn_brutto_hinweis)}. "
            "Dieser Betrag ist steuerlich absetzbar (Handwerkerleistungen an selbst genutzter Wohnung)."
        )
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(hinweis, small))
        story.append(Spacer(1, 2 * mm))

    # Schlusstext
    if dokument.get("schlusstext"):
        story.append(Spacer(1, 4 * mm))
        for line in str(dokument["schlusstext"]).split("\n"):
            story.append(Paragraph(line, normal))

    # Footer
    footer_lines = []
    if firma_name:
        footer_lines.append(firma_name)
    if company.get("address"):
        footer_lines.append(f"{company['address']}, {company.get('zip', '')} {company.get('city', '')}".strip(", "))
    if company.get("phone"):
        footer_lines.append(f"Tel: {company['phone']}")
    if company.get("email"):
        footer_lines.append(company["email"])
    if company.get("tax_id"):
        footer_lines.append(f"USt-IdNr.: {company['tax_id']}")
    footer_text = " · ".join([x for x in footer_lines if x])
    if footer_text:
        story.append(Spacer(1, 8 * mm))
        story.append(Paragraph(f"<para align='center'>{footer_text}</para>", small))

    doc_pdf.build(story)
    return buf.getvalue()
