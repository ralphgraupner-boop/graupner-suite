"""
Portal v4 – Mail-Builder (isoliert)
Kein Zugriff auf utils/__init__.py oder routes/portal.py.
Ausschließlich HTML-Generierung. SMTP-Versand läuft über utils.send_email (nur Aufruf).
"""
from database import db


def build_anrede_brief(name: str) -> str:
    """Briefanrede aus Kundenname (eigene Kopie, nicht aus portal.py importiert)."""
    clean = (name or "").strip()
    if not clean:
        return "Sehr geehrte Damen und Herren"
    prefix = ""
    for p in ("Herr", "Frau", "Divers"):
        if clean.startswith(p + " "):
            prefix = p
            clean = clean[len(p):].strip()
            break
    parts = clean.split()
    nachname = parts[-1] if parts else clean
    if prefix == "Herr":
        return f"Sehr geehrter Herr {nachname}"
    if prefix == "Frau":
        return f"Sehr geehrte Frau {nachname}"
    return f"Sehr geehrte/r {clean}"


async def _load_company() -> dict:
    return await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}


async def build_invite_email(
    customer_name: str,
    customer_email: str,
    login_url: str,
    password_plain: str,
    settings_doc: dict | None = None,
) -> tuple[str, str]:
    """
    Baut (subject, html) für Einladungs-Mail Portal v4.
    Kein SMTP hier – reine HTML-Erzeugung.
    """
    company = await _load_company()
    portal2 = settings_doc or {}
    subject = portal2.get("email_subject_invite") or "Ihr Kundenzugang – Graupner Suite"
    footer_extra = portal2.get("email_footer") or ""

    anrede = build_anrede_brief(customer_name)
    firma = company.get("company_name") or company.get("name") or "Tischlerei R.Graupner"
    website = company.get("website") or "www.tischlerei-graupner.de"
    support_mail = company.get("email") or "service24@tischlerei-graupner.de"
    phone = company.get("phone") or ""

    html = f"""
<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px">
        <tr>
          <td style="background:#14532D;color:#fff;padding:24px 28px">
            <h1 style="margin:0;font-size:22px;font-weight:600">Ihr persönlicher Kundenzugang</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:0.85">{firma}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px">
            <p style="margin:0 0 14px;font-size:15px;color:#222">{anrede},</p>
            <p style="margin:0 0 14px;font-size:14px;color:#444;line-height:1.55">
              wir haben für Sie einen Zugang zu unserem neuen Kundenportal eingerichtet.
              Dort können Sie uns Fotos und Dokumente zu Ihrem Auftrag übermitteln
              und direkt mit uns in Kontakt bleiben.
            </p>

            <div style="margin:22px 0;padding:18px;border:1px solid #e5e7eb;border-radius:10px;background:#fafaf8">
              <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Ihre Zugangsdaten</div>
              <div style="font-size:14px;color:#222;margin:4px 0"><strong>E-Mail:</strong> {customer_email}</div>
              <div style="font-size:14px;color:#222;margin:4px 0"><strong>Passwort:</strong>
                <code style="background:#f0f0eb;padding:2px 8px;border-radius:4px;font-size:14px">{password_plain}</code>
              </div>
            </div>

            <p style="text-align:center;margin:28px 0">
              <a href="{login_url}"
                 style="display:inline-block;padding:12px 28px;background:#14532D;color:#fff;
                        text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">
                Zum Kundenportal
              </a>
            </p>

            <p style="margin:18px 0 6px;font-size:12px;color:#666;line-height:1.6">
              Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
              <span style="word-break:break-all;color:#14532D">{login_url}</span>
            </p>

            <p style="margin:20px 0 0;font-size:13px;color:#444">
              Bei Fragen erreichen Sie uns unter
              <a href="mailto:{support_mail}" style="color:#14532D">{support_mail}</a>
              {f'oder telefonisch unter {phone}' if phone else ''}.
            </p>

            {f'<p style="margin:18px 0 0;font-size:12px;color:#777">{footer_extra}</p>' if footer_extra else ''}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">
            {firma} · <a href="https://{website}" style="color:#999;text-decoration:none">{website}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>
""".strip()

    return subject, html
