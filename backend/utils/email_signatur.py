"""
Zentrale E-Mail-Signatur und Briefvorlage für Tischlerei Graupner
Wird in allen E-Mails und als Vorlage für Briefe verwendet.
"""

# Corporate Design Farben
TIEFBLAU = "#003366"
TIEFROT = "#8B0000"


def get_email_signature_html():
    """Komplette E-Mail-Signatur als HTML – für alle ausgehenden E-Mails"""
    return f"""
    <div style="margin-top: 30px; border-top: 2px solid {TIEFBLAU}; padding-top: 20px; font-family: Arial, Helvetica, sans-serif;">

        <!-- Firmenname -->
        <p style="margin: 0 0 2px 0;">
            <span style="font-size: 18px; font-weight: bold; color: {TIEFBLAU};">Tischlerei R.Graupner</span>
            <span style="font-size: 10px; font-weight: bold; color: {TIEFROT}; margin-left: 4px;">seit 1960</span>
        </p>

        <!-- Kontaktdaten -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px; font-size: 13px; color: #333333; line-height: 1.6;">
            <tr>
                <td style="padding-right: 8px; color: #666;">Handy:</td>
                <td><a href="tel:+4915157437305" style="color: {TIEFBLAU}; text-decoration: none;">01515 7437 305</a></td>
            </tr>
            <tr>
                <td style="padding-right: 8px; color: #666;">Mail:</td>
                <td><a href="mailto:service24@tischlerei-graupner.de" style="color: {TIEFBLAU}; text-decoration: none;">service24@tischlerei-graupner.de</a></td>
            </tr>
            <tr>
                <td style="padding-right: 8px; color: #666;">Webseite:</td>
                <td><a href="https://www.tischlerei-graupner.de" style="color: {TIEFBLAU}; text-decoration: none;">www.tischlerei-graupner.de</a></td>
            </tr>
        </table>

        <p style="margin: 8px 0 0 0; font-size: 12px; color: #555;">
            <strong style="color: {TIEFBLAU};">Tischlerei R.Graupner</strong> &ndash; Mitglied der Handwerkskammer Hamburg
        </p>

        <!-- DSGVO Hinweis -->
        <div style="margin-top: 20px; padding: 12px 16px; background-color: #f8f9fa; border-left: 3px solid {TIEFBLAU}; font-size: 10px; color: #666666; line-height: 1.5;">
            <p style="margin: 0 0 8px 0;"><strong style="color: {TIEFBLAU};">Hinweis: DSGVO &ndash; Einverst&auml;ndniserkl&auml;rung Datenverarbeitung</strong></p>
            <p style="margin: 0 0 8px 0;">Die Datenschutz-Grundverordnung (DSGVO) ist seit ihrer Einf&uuml;hrung im Mai 2018 ein zentrales Thema f&uuml;r Unternehmen in der EU. Ihre Grunds&auml;tze sind darauf ausgelegt, den Schutz personenbezogener Daten zu gew&auml;hrleisten und das Vertrauen zwischen Unternehmen und ihren Kunden zu st&auml;rken.</p>
            <p style="margin: 0 0 8px 0;"><strong>Datennutzungserkl&auml;rung:</strong> Diese E-Mail enth&auml;lt vertrauliche und/oder rechtlich gesch&uuml;tzte Informationen. Wenn Sie nicht der richtige Adressat sind oder diese E-Mail irrt&uuml;mlich erhalten haben, informieren Sie bitte sofort den Absender und vernichten Sie diese Mail. Das unerlaubte Kopieren sowie die unbefugte Weitergabe dieser Mail ist nicht gestattet.</p>
            <p style="margin: 0 0 8px 0; font-style: italic;">This e-mail may contain confidential and/or privileged information. If you are not the intended recipient (or have received this e-mail in error) please notify the sender immediately and destroy this e-mail. Any unauthorized copying, disclosure or distribution of the material in this e-mail is strictly forbidden.</p>
            <p style="margin: 0; font-weight: bold; color: {TIEFBLAU};">Das eigentliche Dokument finden Sie in einer PDF-Datei im Anhang dieser E-Mail!</p>
        </div>
    </div>
    """


def get_brief_signatur_html():
    """Signatur für Briefvorlagen / Dokumente (ohne DSGVO)"""
    return f"""
    <div style="margin-top: 30px; border-top: 2px solid {TIEFBLAU}; padding-top: 15px; font-family: Arial, Helvetica, sans-serif;">
        <p style="margin: 0 0 2px 0;">
            <span style="font-size: 18px; font-weight: bold; color: {TIEFBLAU};">Tischlerei R.Graupner</span>
            <span style="font-size: 10px; font-weight: bold; color: {TIEFROT}; margin-left: 4px;">seit 1960</span>
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px; font-size: 12px; color: #333333; line-height: 1.5;">
            <tr><td style="padding-right: 8px; color: #666;">Handy:</td><td>01515 7437 305</td></tr>
            <tr><td style="padding-right: 8px; color: #666;">Mail:</td><td>service24@tischlerei-graupner.de</td></tr>
            <tr><td style="padding-right: 8px; color: #666;">Webseite:</td><td>www.tischlerei-graupner.de</td></tr>
        </table>
        <p style="margin: 6px 0 0 0; font-size: 11px; color: #555;">
            <strong style="color: {TIEFBLAU};">Tischlerei R.Graupner</strong> &ndash; Mitglied der Handwerkskammer Hamburg
        </p>
    </div>
    """


def wrap_email_body(content_html):
    """Wickelt den E-Mail-Inhalt mit der Standard-Signatur ein"""
    signature = get_email_signature_html()
    return f"""
    <div style="font-family: Arial, Helvetica, sans-serif; color: #333;">
        {content_html}
        {signature}
    </div>
    """
