import smtplib
import imaplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.header import Header
from email.utils import formataddr
from database import SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, logger, db


async def get_smtp_config():
    """Get SMTP config from DB settings, fall back to .env"""
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if settings and settings.get("smtp_server"):
        return {
            "server": settings["smtp_server"],
            "port": settings.get("smtp_port", 465),
            "user": settings["smtp_user"],
            "password": settings["smtp_password"],
            "from_addr": settings.get("smtp_from", settings["smtp_user"])
        }
    return {
        "server": SMTP_SERVER,
        "port": SMTP_PORT,
        "user": SMTP_USER,
        "password": SMTP_PASSWORD,
        "from_addr": SMTP_FROM
    }


def _append_to_sent_folder(msg_obj, imap_settings: dict):
    """Laedt eine Kopie der gesendeten Mail per IMAP APPEND in den Gesendet-Ordner hoch.
    So erscheint die Mail auch in Betterbird/Outlook im 'Gesendet'-Ordner.
    Fehler werden nur geloggt, kein Abbruch des Versands.
    """
    if not imap_settings:
        return
    server = imap_settings.get("imap_server")
    port = int(imap_settings.get("imap_port", 993))
    username = imap_settings.get("imap_user") or imap_settings.get("imap_username")
    password = imap_settings.get("imap_password")
    if not (server and username and password):
        logger.info("IMAP-Sent-Kopie: keine IMAP-Settings - skip")
        return

    # Moegliche Sent-Ordner-Namen probieren (verschiedene Provider)
    candidates = [
        imap_settings.get("imap_sent_folder"),  # falls in Settings konfiguriert
        "Sent",
        "Gesendet",
        "Sent Items",
        "Gesendete Elemente",
        "INBOX.Sent",
        "INBOX.Gesendet",
    ]
    candidates = [c for c in candidates if c]

    raw_bytes = msg_obj.as_bytes()
    try:
        imap = imaplib.IMAP4_SSL(server, port)
        imap.login(username, password)
        try:
            # Liste der Mailboxen holen
            status, boxes = imap.list()
            available = []
            if status == "OK" and boxes:
                for raw in boxes:
                    try:
                        line = raw.decode() if isinstance(raw, bytes) else raw
                    except Exception:
                        continue
                    # Quoted name
                    parts = line.rsplit(" ", 1)
                    if parts:
                        name = parts[-1].strip('"').strip()
                        if name:
                            available.append(name)
            appended = False
            for folder in candidates:
                if folder in available or not available:
                    try:
                        imap.append(
                            f'"{folder}"',
                            "\\Seen",
                            imaplib.Time2Internaldate(time.time()),
                            raw_bytes,
                        )
                        logger.info(f"IMAP-Sent-Kopie: Erfolgreich in '{folder}' abgelegt")
                        appended = True
                        break
                    except Exception as e:
                        logger.debug(f"APPEND zu '{folder}' fehlgeschlagen: {e}")
                        continue
            if not appended:
                logger.warning(f"IMAP-Sent-Kopie: Kein passender Sent-Ordner gefunden. Verfuegbar: {available[:10]}")
        finally:
            try:
                imap.logout()
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"IMAP-Sent-Kopie fehlgeschlagen: {e}")


async def _get_imap_settings_for_sent():
    """Holt IMAP-Settings fuer Sent-Kopie. Returns None wenn deaktiviert."""
    settings = await db.imap_settings.find_one({}) or {}
    # Feature-Flag: sent_copy_enabled (Default: True)
    if settings.get("imap_sent_copy_enabled", True) is False:
        return None
    return settings


def send_email(to_email: str, subject: str, body_html: str, attachments: list = None, smtp_config: dict = None, imap_settings: dict = None):
    """Send email via SMTP with optional attachments.
    Wenn imap_settings mitgegeben werden, wird eine Kopie der Mail in den Gesendet-Ordner hochgeladen.

    Wichtig: Subject und Body werden UTF-8 codiert, damit Umlaute korrekt
    übertragen werden (sonst werden ä/ö/ü/ß durch '?' ersetzt).
    """
    cfg = smtp_config or {
        "server": SMTP_SERVER, "port": SMTP_PORT,
        "user": SMTP_USER, "password": SMTP_PASSWORD, "from_addr": SMTP_FROM
    }
    msg = MIMEMultipart()
    # From-Header: falls "Name <addr>" Format, formataddr nutzt UTF-8 wenn nötig
    msg["From"] = formataddr(("Tischlerei Graupner", cfg["from_addr"])) if cfg.get("from_addr") and "@" in cfg["from_addr"] and "<" not in cfg["from_addr"] else cfg["from_addr"]
    msg["To"] = to_email
    # Subject UTF-8-codieren, damit Umlaute durchkommen (RFC 2047)
    msg["Subject"] = Header(subject, "utf-8")
    # Body explizit als UTF-8 deklarieren
    msg.attach(MIMEText(body_html, "html", _charset="utf-8"))

    if attachments:
        for att in attachments:
            part = MIMEApplication(att["data"], Name=att["filename"])
            part["Content-Disposition"] = f'attachment; filename="{att["filename"]}"'
            msg.attach(part)

    with smtplib.SMTP_SSL(cfg["server"], cfg["port"]) as server:
        server.login(cfg["user"], cfg["password"])
        # Bytes mit explizitem UTF-8 senden, damit auch der HTML-Body sauber bleibt
        server.sendmail(cfg["from_addr"], to_email, msg.as_bytes())

    logger.info(f"Email sent to {to_email}: {subject}")

    # Kopie in Sent-Ordner hochladen (nur wenn imap_settings mitgegeben)
    if imap_settings:
        try:
            _append_to_sent_folder(msg, imap_settings)
        except Exception as e:
            logger.warning(f"Sent-Ordner-Kopie fehlgeschlagen (Mail wurde trotzdem versendet): {e}")

