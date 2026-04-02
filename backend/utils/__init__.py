import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
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


def send_email(to_email: str, subject: str, body_html: str, attachments: list = None, smtp_config: dict = None):
    """Send email via SMTP with optional attachments"""
    cfg = smtp_config or {
        "server": SMTP_SERVER, "port": SMTP_PORT,
        "user": SMTP_USER, "password": SMTP_PASSWORD, "from_addr": SMTP_FROM
    }
    msg = MIMEMultipart()
    msg["From"] = cfg["from_addr"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body_html, "html"))

    if attachments:
        for att in attachments:
            part = MIMEApplication(att["data"], Name=att["filename"])
            part["Content-Disposition"] = f'attachment; filename="{att["filename"]}"'
            msg.attach(part)

    with smtplib.SMTP_SSL(cfg["server"], cfg["port"]) as server:
        server.login(cfg["user"], cfg["password"])
        server.sendmail(cfg["from_addr"], to_email, msg.as_string())

    logger.info(f"Email sent to {to_email}: {subject}")
