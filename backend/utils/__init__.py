import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from database import SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, logger


def send_email(to_email: str, subject: str, body_html: str, attachments: list = None):
    """Send email via SMTP with optional attachments"""
    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body_html, "html"))

    if attachments:
        for att in attachments:
            part = MIMEApplication(att["data"], Name=att["filename"])
            part["Content-Disposition"] = f'attachment; filename="{att["filename"]}"'
            msg.attach(part)

    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())

    logger.info(f"Email sent to {to_email}: {subject}")
