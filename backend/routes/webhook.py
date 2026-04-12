from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, HTMLResponse
from io import BytesIO
import os
import base64
from models import WebhookContact, Anfrage
from database import db, logger
from routes.push import send_push_to_all

router = APIRouter()

ORIGINAL_FORM_URL = "https://www.kontakt-graupner.de/kontakt/response.php"


@router.post("/webhook/contact")
async def webhook_contact(contact: WebhookContact):
    """Webhook für Website-Kontaktformular (Graupner)"""
    name_parts = []
    if contact.anrede:
        name_parts.append(contact.anrede)
    if contact.vorname:
        name_parts.append(contact.vorname)
    if contact.nachname:
        name_parts.append(contact.nachname)
    name = " ".join(name_parts) if name_parts else (contact.name or "Unbekannt")
    if contact.firma:
        name = f"{name} ({contact.firma})"

    address_parts = []
    if contact.strasse:
        address_parts.append(contact.strasse)
    if contact.plz or contact.stadt:
        address_parts.append(f"{contact.plz or ''} {contact.stadt or ''}".strip())
    address = "\n".join(address_parts) if address_parts else contact.address

    notes_parts = []
    if contact.rolle:
        notes_parts.append(f"Rolle: {contact.rolle}")
    if contact.topics:
        notes_parts.append(f"Themen: {', '.join(contact.topics)}")
    msg = contact.nachricht or contact.message
    if msg:
        notes_parts.append(f"Nachricht: {msg}")
    if contact.objstrasse:
        obj_addr = f"Objektadresse: {contact.objstrasse}"
        if contact.objplz or contact.objstadt:
            obj_addr += f", {contact.objplz or ''} {contact.objstadt or ''}".strip()
        if contact.objvorname or contact.objnachname:
            obj_addr += f" (Kontakt: {contact.objvorname or ''} {contact.objnachname or ''})".strip()
        if contact.objprojektnr:
            obj_addr += f" [Projekt-Nr: {contact.objprojektnr}]"
        notes_parts.append(obj_addr)
    if contact.website:
        notes_parts.append(f"Website: {contact.website}")

    rolle_map = {
        "Eigentümer/Vermieter": "Vermieter",
        "Hausverwaltung": "Hausverwaltung",
        "Mieter": "Mieter",
        "Interessent Tischlerarbeiten": "Privat"
    }
    customer_type = rolle_map.get(contact.rolle, "Privat")

    obj_addr_str = ""
    if contact.objstrasse:
        obj_addr_str = contact.objstrasse
        if contact.objplz or contact.objstadt:
            obj_addr_str += f", {contact.objplz or ''} {contact.objstadt or ''}".strip()
        if contact.objvorname or contact.objnachname:
            obj_addr_str += f" (Kontakt: {contact.objvorname or ''} {contact.objnachname or ''})".strip()

    anfrage = Anfrage(
        name=name,
        email=contact.email or "",
        phone=contact.telefon or contact.phone or "",
        address=address,
        notes="\n".join(notes_parts),
        photos=contact.photos,
        categories=contact.topics or [],
        customer_type=customer_type,
        firma=contact.firma or "",
        source="webhook",
        obj_address=obj_addr_str,
        nachricht=contact.nachricht or contact.message or ""
    )
    await db.anfragen.insert_one(anfrage.model_dump())
    logger.info(f"Neue Anfrage über Webhook: {name} ({customer_type})")

    push_body = f"{name}"
    if contact.topics:
        push_body += f" - {', '.join(contact.topics[:3])}"
    elif msg:
        push_body += f": {msg[:80]}"

    await send_push_to_all(title="Neue Anfrage", body=push_body, url="/anfragen")
    return {"message": "Anfrage erfolgreich empfangen", "anfrage_id": anfrage.id}


@router.get("/webhook/contact-beacon")
async def webhook_contact_beacon(name: str = "", nachricht: str = "", email: str = "", phone: str = ""):
    """GET-Webhook als Bild-Beacon (umgeht CORS-Blockierung bei IONOS u.a.)"""
    if not name:
        pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
        return StreamingResponse(BytesIO(pixel), media_type="image/gif")

    contact = WebhookContact(name=name, nachricht=nachricht, email=email, phone=phone)
    msg = contact.nachricht or contact.message
    notes_parts = []
    if msg:
        notes_parts.append(f"Nachricht: {msg}")

    anfrage = Anfrage(
        name=name,
        email=email,
        phone=phone,
        notes="\n".join(notes_parts),
        source="beacon",
        nachricht=msg or ""
    )
    await db.anfragen.insert_one(anfrage.model_dump())
    logger.info(f"Neue Anfrage über Beacon-Webhook: {name}")

    push_body = f"{name}"
    if msg:
        push_body += f": {msg[:80]}"
    await send_push_to_all(title="Neue Anfrage", body=push_body, url="/anfragen")

    pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return StreamingResponse(BytesIO(pixel), media_type="image/gif")


@router.get("/landing-page", response_class=HTMLResponse)
async def landing_page_preview():
    """Preview of the standalone Landing Page for schiebetuer-reparatur-hamburg.de"""
    landing_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "landing_page", "index.html")
    try:
        with open(landing_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Landing page not found")



@router.get("/kontakt", response_class=HTMLResponse)
async def kontakt_form_page():
    """Public contact form page - no auth required"""
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Anfrage stellen - Tischlerei R.Graupner | Fenster &amp; T&uuml;ren seit 1960</title>
<meta name="description" content="Kontaktieren Sie die Tischlerei Graupner in Hamburg. Kostenlose Anfrage f&uuml;r Schiebet&uuml;r-, Fenster- und T&uuml;ren-Reparatur. Antwort innerhalb 24 Stunden.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;line-height:1.6;min-height:100vh;background:#f5f3f0;}}
.header{{background:linear-gradient(135deg,#1a1a2e 0%,#2a2a4e 100%);color:#fff;padding:28px 16px;text-align:center;position:relative;overflow:hidden}}
.header::after{{content:'';position:absolute;bottom:-1px;left:0;right:0;height:40px;background:linear-gradient(to top,#f5f3f0,transparent)}}
.header-inner{{max-width:640px;margin:0 auto;position:relative;z-index:1}}
.header-badge{{display:inline-flex;align-items:center;gap:6px;background:rgba(200,149,108,0.2);border:1px solid rgba(200,149,108,0.35);color:#c8956c;font-size:11px;font-weight:600;padding:5px 14px;border-radius:50px;margin-bottom:12px;letter-spacing:0.8px;text-transform:uppercase}}
.header h1{{font-size:24px;font-weight:700;letter-spacing:-0.3px}}
.header h1 span{{color:#c8956c}}
.header p{{font-size:14px;opacity:0.7;margin-top:4px}}
.header-contact{{display:flex;justify-content:center;gap:20px;margin-top:14px;flex-wrap:wrap}}
.header-contact a{{color:rgba(255,255,255,0.8);text-decoration:none;font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px;transition:color 0.2s}}
.header-contact a:hover{{color:#c8956c}}
.header-contact svg{{width:14px;height:14px;opacity:0.7}}
.container{{max-width:640px;margin:24px auto;padding:0 16px 40px}}
.steps{{display:flex;gap:8px;margin-bottom:20px;padding:0 4px}}
.step{{flex:1;text-align:center;font-size:11px;font-weight:600;color:#999;position:relative;padding-bottom:10px}}
.step::after{{content:'';position:absolute;bottom:0;left:10%;right:10%;height:3px;background:#e0ddd8;border-radius:3px;transition:background 0.3s}}
.step.active{{color:#1a1a2e}}
.step.active::after{{background:#14532D}}
.step.done{{color:#14532D}}
.step.done::after{{background:#14532D}}
.card{{background:#fff;border-radius:14px;box-shadow:0 1px 8px rgba(0,0,0,0.06);padding:28px;margin-bottom:16px;border:1px solid #eae8e4}}
.card h2{{font-size:16px;font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #f0ede8;color:#1a1a2e;display:flex;align-items:center;gap:8px}}
.card h2 svg{{width:18px;height:18px;color:#c8956c}}
.row{{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}}
.field{{flex:1;min-width:160px}}
label{{display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#444}}
input[type=text],input[type=email],input[type=tel],textarea{{width:100%;padding:10px 13px;border:1.5px solid #e0ddd8;border-radius:9px;font-size:14px;font-family:inherit;transition:all 0.2s;background:#faf9f7;color:#1a1a2e}}
input[type=text]::placeholder,input[type=email]::placeholder,input[type=tel]::placeholder,textarea::placeholder{{color:#b0aaa0}}
input:focus,textarea:focus{{outline:none;border-color:#1a1a2e;box-shadow:0 0 0 3px rgba(26,26,46,0.08);background:#fff}}
.submitted input:invalid,.submitted textarea:invalid{{border-color:#e74c3c;background:#fef8f7}}
textarea{{resize:vertical;min-height:80px;font-family:inherit}}
.radio-group{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}}
.radio-group label{{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1.5px solid #e0ddd8;border-radius:9px;cursor:pointer;font-size:14px;font-weight:500;transition:all 0.2s;background:#faf9f7;color:#555}}
.radio-group label:hover{{border-color:#bbb;background:#f5f3f0}}
.radio-group label:has(input:checked){{border-color:#1a1a2e;background:#f0f0ff;color:#1a1a2e}}
.radio-group input[type=radio]{{accent-color:#1a1a2e}}
.topic-grid{{display:flex;flex-direction:column;gap:8px}}
.topic-item{{border:1.5px solid #e0ddd8;border-radius:11px;overflow:hidden;transition:all 0.3s;background:#faf9f7}}
.topic-item.active{{border-color:#14532D;background:#f0faf2}}
.topic-header{{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s;user-select:none;color:#444}}
.topic-header:hover{{background:rgba(0,0,0,0.02)}}
.topic-item.active .topic-header{{color:#14532D}}
.topic-check{{width:20px;height:20px;border-radius:50%;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}}
.topic-item.active .topic-check{{background:#14532D;border-color:#14532D}}
.topic-item.active .topic-check::after{{content:'';width:6px;height:6px;background:#fff;border-radius:50%}}
.topic-icon{{font-size:16px;opacity:0.5}}
.topic-item.active .topic-icon{{opacity:1}}
.topic-desc{{max-height:0;overflow:hidden;transition:max-height 0.3s ease,padding 0.3s ease;padding:0 16px}}
.topic-item.active .topic-desc{{max-height:200px;padding:0 16px 14px}}
.topic-desc textarea{{width:100%;padding:9px 12px;border:1.5px solid #d4e8d6;border-radius:9px;font-size:13px;min-height:60px;resize:vertical;background:#fff}}
.topic-desc textarea:focus{{outline:none;border-color:#14532D;box-shadow:0 0 0 3px rgba(20,83,45,0.08)}}
.copy-check{{display:flex;align-items:center;gap:10px;padding:11px 16px;background:#f5f3f0;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;margin-bottom:14px;border:1.5px solid transparent;transition:all 0.2s}}
.copy-check:hover{{background:#edeae6}}
.copy-check:has(input:checked){{border-color:#1a1a2e;background:#eef0ff}}
.copy-check input{{width:17px;height:17px;accent-color:#1a1a2e;cursor:pointer}}
.obj-fields{{transition:opacity 0.3s;}}
.btn{{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;background:linear-gradient(135deg,#14532D 0%,#1a6b3a 100%);color:#fff;border:none;border-radius:11px;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.25s;font-family:inherit;letter-spacing:0.2px}}
.btn:hover{{transform:translateY(-1px);box-shadow:0 6px 20px rgba(20,83,45,0.3)}}
.btn:active{{transform:translateY(0)}}
.btn:disabled{{opacity:0.6;cursor:not-allowed;transform:none;box-shadow:none}}
.btn svg{{width:18px;height:18px}}
.required::after{{content:" *";color:#e74c3c}}
.privacy{{display:flex;align-items:start;gap:10px;padding:14px 16px;background:#fff;border-radius:11px;border:1.5px solid #e0ddd8;cursor:pointer;font-size:13px;margin-bottom:16px;line-height:1.5;color:#555}}
.privacy:hover{{border-color:#ccc}}
.privacy input{{width:18px;height:18px;margin-top:1px;flex-shrink:0;cursor:pointer;accent-color:#14532D}}
.privacy a{{color:#1a1a2e;font-weight:600;text-decoration:underline}}
.file-area{{margin-top:12px;border:2px dashed #e0ddd8;border-radius:10px;padding:16px;text-align:center;transition:all 0.2s;cursor:pointer;position:relative}}
.file-area:hover{{border-color:#c8956c;background:#fdf9f5}}
.file-area input[type=file]{{position:absolute;inset:0;opacity:0;cursor:pointer}}
.file-area p{{font-size:13px;color:#888;margin-top:4px}}
.file-area .file-icon{{font-size:24px;margin-bottom:4px;color:#c8956c}}
.file-label{{font-size:14px;font-weight:600;color:#555}}
.type-toggle{{display:flex;gap:0;margin-bottom:14px;border:1.5px solid #e0ddd8;border-radius:9px;overflow:hidden}}
.type-toggle label{{flex:1;text-align:center;padding:10px 14px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s;border-right:1px solid #e0ddd8;color:#777}}
.type-toggle label:last-child{{border-right:none}}
.type-toggle label:hover{{background:#f5f3f0}}
.type-toggle label.privat-label:has(input:checked){{background:#14532D;color:#fff}}
.type-toggle label.firma-label:has(input:checked){{background:#1e40af;color:#fff}}
.type-toggle input{{display:none}}
.firma-field{{max-height:0;overflow:hidden;transition:max-height 0.3s ease;margin-bottom:0}}
.firma-field.show{{max-height:70px;margin-bottom:12px}}
.success-box{{display:none;text-align:center;padding:48px 24px;max-width:500px;margin:60px auto}}
.success-box.show{{display:block}}
.success-check{{width:80px;height:80px;background:#e8f5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}}
.success-check svg{{width:40px;height:40px;color:#2e7d32}}
.success-box h2{{font-size:24px;font-weight:700;color:#1a1a2e;margin-bottom:8px}}
.success-box p{{font-size:15px;color:#666;line-height:1.7;margin-bottom:8px}}
.success-info{{background:#fff;border-radius:12px;padding:20px;margin:24px 0;text-align:left;font-size:14px;color:#444;line-height:1.7;border:1px solid #e0ddd8}}
.success-info b{{color:#1a1a2e}}
.footer-mini{{text-align:center;padding:24px 16px;font-size:12px;color:#999}}
.footer-mini a{{color:#777;text-decoration:none}}
.footer-mini a:hover{{color:#1a1a2e}}
@media(max-width:600px){{
  .row{{flex-direction:column;gap:10px}}
  .field{{min-width:100%}}
  .header h1{{font-size:20px}}
  .card{{padding:20px}}
  .header-contact{{gap:12px}}
}}
@keyframes fadeIn{{from{{opacity:0;transform:translateY(12px)}}to{{opacity:1;transform:translateY(0)}}}}
.card{{animation:fadeIn 0.4s ease}}
.card:nth-child(2){{animation-delay:0.05s}}
.card:nth-child(3){{animation-delay:0.1s}}
.card:nth-child(4){{animation-delay:0.15s}}
</style>
</head>
<body>
<div class="header">
<div class="header-inner">
<div class="header-badge">&#9733; Meisterbetrieb seit 1960</div>
<h1>Tischlerei R.<span>Graupner</span></h1>
<p>Fenster &amp; T&uuml;ren Reparatur &middot; Hamburg</p>
<div class="header-contact">
<a href="tel:04055567744"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> 040 555 677 44</a>
<a href="mailto:service24@tischlerei-graupner.de"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg> E-Mail schreiben</a>
</div>
</div>
</div>

<div class="container" id="formContainer">
<div class="steps">
<div class="step active" id="step1">1. Kontakt</div>
<div class="step" id="step2">2. Objekt</div>
<div class="step" id="step3">3. Anliegen</div>
<div class="step" id="step4">4. Absenden</div>
</div>

<form id="kontaktForm" action="{backend_url}/api/kontakt/submit" method="POST" enctype="multipart/form-data" novalidate onsubmit="return handleSubmit(event)">
<input type="hidden" name="rolle" value="Eigent&uuml;mer/Vermieter">

<div class="card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Kontaktdaten</h2>
<div class="type-toggle">
<label class="privat-label"><input type="radio" name="kundentyp" value="Privat" checked onchange="toggleFirma()"><span>Privat</span></label>
<label class="firma-label"><input type="radio" name="kundentyp" value="Firma" onchange="toggleFirma()"><span>Firma</span></label>
</div>
<div class="firma-field" id="firmaField">
<div class="field"><label class="required">Firmenname</label><input type="text" name="firma" id="firmaInput" placeholder="z.B. Musterfirma GmbH"></div>
</div>
<div class="radio-group">
<label><input type="radio" name="anrede" value="Herr"><span>Herr</span></label>
<label><input type="radio" name="anrede" value="Frau"><span>Frau</span></label>
<label><input type="radio" name="anrede" value="Divers"><span>Divers</span></label>
</div>
<div class="row">
<div class="field"><label>Vorname</label><input type="text" name="vorname" id="k_vorname" placeholder="Max"></div>
<div class="field"><label class="required">Nachname</label><input type="text" name="nachname" id="k_nachname" required placeholder="Mustermann"></div>
</div>
<div class="row">
<div class="field"><label class="required">Telefon</label><input type="tel" name="telefon" id="k_telefon" required placeholder="040 123 456 78"></div>
</div>
<div class="row">
<div class="field"><label class="required">E-Mail</label><input type="email" name="email" required placeholder="max@beispiel.de"></div>
</div>
<div class="row">
<div class="field"><label class="required">Stra&szlig;e, Nr.</label><input type="text" name="strasse" id="k_strasse" required minlength="5" placeholder="Musterstra&szlig;e 12" pattern=".*\\d+.*" title="Bitte Stra&szlig;e mit Hausnummer eingeben"></div>
<div class="field" style="max-width:100px"><label class="required">PLZ</label><input type="text" name="plz" id="k_plz" required placeholder="22453"></div>
<div class="field"><label class="required">Stadt</label><input type="text" name="stadt" id="k_stadt" required placeholder="Hamburg"></div>
</div>
</div>

<div class="card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> Objektadresse</h2>
<label class="copy-check">
<input type="checkbox" id="copyAddr" onchange="toggleCopy()">
Kontaktadresse als Objektadresse &uuml;bernehmen
</label>
<div class="obj-fields" id="objFields">
<div class="row">
<div class="field"><label>Vorname</label><input type="text" name="objvorname" id="o_vorname" placeholder="Vorname Ansprechpartner"></div>
<div class="field"><label>Nachname</label><input type="text" name="objnachname" id="o_nachname" placeholder="Nachname Ansprechpartner"></div>
<div class="field"><label>Telefon</label><input type="tel" name="objtelefon" id="o_telefon" placeholder="Telefon vor Ort"></div>
</div>
<div class="row">
<div class="field"><label>Stra&szlig;e, Nr.</label><input type="text" name="objstrasse" id="o_strasse" placeholder="Stra&szlig;e und Hausnummer"></div>
<div class="field" style="max-width:100px"><label>PLZ</label><input type="text" name="objplz" id="o_plz" placeholder="PLZ"></div>
<div class="field"><label>Stadt</label><input type="text" name="objstadt" id="o_stadt" placeholder="Stadt"></div>
</div>
</div>
</div>

<div class="card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> Was wird ben&ouml;tigt?</h2>
<p style="font-size:13px;color:#888;margin:-8px 0 14px">W&auml;hlen Sie ein oder mehrere Themen</p>
<div class="topic-grid" id="topicGrid">
<div class="topic-item" data-topic="Schiebet&uuml;r">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span class="topic-icon">&#128682;</span><span>Schiebet&uuml;r</span></div>
<div class="topic-desc"><textarea name="desc_schiebetuer" placeholder="Was ist das Problem? z.B. Schiebet&uuml;r klemmt, l&auml;sst sich schwer &ouml;ffnen..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Fenster">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span class="topic-icon">&#128999;</span><span>Fenster</span></div>
<div class="topic-desc"><textarea name="desc_fenster" placeholder="Was ist das Problem? z.B. Fenster undicht, Beschlag defekt..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Innent&uuml;r">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span class="topic-icon">&#128682;</span><span>Innent&uuml;r</span></div>
<div class="topic-desc"><textarea name="desc_innentuer" placeholder="Was ist das Problem? z.B. T&uuml;r schlie&szlig;t nicht richtig, Scharnier locker..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Eingangst&uuml;r">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span class="topic-icon">&#127968;</span><span>Eingangst&uuml;r</span></div>
<div class="topic-desc"><textarea name="desc_eingangstuer" placeholder="Was ist das Problem? z.B. Haust&uuml;r verzogen, Schloss defekt..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Sonstige Reparaturen">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span class="topic-icon">&#128295;</span><span>Sonstige Reparaturen</span></div>
<div class="topic-desc"><textarea name="desc_sonstige" placeholder="Beschreiben Sie was repariert werden soll..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
</div>
</div>

<div class="card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Nachricht &amp; Bilder</h2>
<textarea name="nachricht" placeholder="Beschreiben Sie Ihr Anliegen, z.B. wie dringend ist es, wann sind Sie erreichbar..." rows="4"></textarea>
<div class="file-area">
<input type="file" name="upload_file1" accept="image/*" multiple onchange="updateFileLabel(this)">
<div class="file-icon">&#128247;</div>
<div class="file-label" id="fileLabel">Bilder hochladen</div>
<p>Fotos vom Schaden/Objekt hochladen (optional, max. 50 MB)</p>
</div>
</div>

<label class="privacy">
<input type="checkbox" name="dataprivacy" id="privacyCheck" required>
<span>Ich habe die <a href="https://www.tischlerei-graupner.de/j/privacy" target="_blank">Datenschutzerkl&auml;rung</a> gelesen und stimme der Verarbeitung meiner Daten zu.</span>
</label>

<button type="submit" class="btn" id="submitBtn">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
Anfrage absenden
</button>
</form>

<div class="footer-mini">
&copy; 2026 Tischlerei R.Graupner &middot; <a href="https://www.tischlerei-graupner.de">www.tischlerei-graupner.de</a>
</div>
</div>

<div class="success-box" id="successBox">
<div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></div>
<h2>Vielen Dank!</h2>
<p>Ihre Anfrage wurde erfolgreich gesendet.</p>
<div class="success-info">
<b>So geht es weiter:</b><br>
Wir melden uns schnellstm&ouml;glich bei Ihnen &ndash; in der Regel innerhalb von <b>24 Stunden</b>.<br><br>
Bei dringenden Anliegen erreichen Sie uns unter:<br>
<b><a href="tel:04055567744" style="color:#14532D;text-decoration:none">&#9742; 040 555 677 44</a></b>
</div>
<a href="https://www.tischlerei-graupner.de" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Zur&uuml;ck zur Website</a>
</div>

<script>
var formSubmitted=false;
function handleSubmit(e){{
  e.preventDefault();
  var form=document.getElementById('kontaktForm');
  form.classList.add('submitted');
  var strasse=document.getElementById('k_strasse').value.trim();
  if(!strasse||strasse.length<5){{
    showError('Bitte geben Sie eine Stra\u00dfe mit Hausnummer ein.');
    document.getElementById('k_strasse').focus();
    return false;
  }}
  if(!/\d/.test(strasse)){{
    showError('Bitte geben Sie auch die Hausnummer ein (z.B. Musterstra\u00dfe 12).');
    document.getElementById('k_strasse').focus();
    return false;
  }}
  if(!form.checkValidity()){{
    var first=form.querySelector(':invalid');
    if(first){{first.focus();first.scrollIntoView({{behavior:'smooth',block:'center'}});}}
    return false;
  }}
  var btn=document.getElementById('submitBtn');
  btn.disabled=true;
  btn.innerHTML='<svg style="animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Wird gesendet...';
  var formData=new FormData(form);
  fetch(form.action,{{method:'POST',body:formData}}).then(function(){{
    document.getElementById('formContainer').style.display='none';
    var sb=document.getElementById('successBox');
    sb.classList.add('show');
    sb.scrollIntoView({{behavior:'smooth',block:'start'}});
  }}).catch(function(){{
    document.getElementById('formContainer').style.display='none';
    var sb=document.getElementById('successBox');
    sb.classList.add('show');
    sb.scrollIntoView({{behavior:'smooth',block:'start'}});
  }});
  return false;
}}
function showError(msg){{
  alert(msg);
}}
function toggleFirma(){{
  var isFirma=document.querySelector('input[name="kundentyp"][value="Firma"]').checked;
  var field=document.getElementById('firmaField');
  var input=document.getElementById('firmaInput');
  if(isFirma){{field.classList.add('show');input.required=true;setTimeout(function(){{input.focus();}},300);}}
  else{{field.classList.remove('show');input.required=false;input.value='';}}
}}
function toggleTopic(header){{
  var item=header.parentElement;
  var isActive=item.classList.contains('active');
  var hiddenInput=item.querySelector('.topic-val');
  var topic=item.getAttribute('data-topic');
  if(isActive){{item.classList.remove('active');hiddenInput.value='';}}
  else{{item.classList.add('active');hiddenInput.value=topic;var ta=item.querySelector('textarea');if(ta)setTimeout(function(){{ta.focus();}},300);}}
  updateSteps();
}}
function toggleCopy(){{
  var c=document.getElementById('copyAddr').checked;
  var pairs=[['k_vorname','o_vorname'],['k_nachname','o_nachname'],['k_telefon','o_telefon'],['k_strasse','o_strasse'],['k_plz','o_plz'],['k_stadt','o_stadt']];
  var fields=document.getElementById('objFields');
  if(c){{
    pairs.forEach(function(p){{document.getElementById(p[1]).value=document.getElementById(p[0]).value;}});
    fields.style.opacity='0.4';
    fields.querySelectorAll('input').forEach(function(i){{i.readOnly=true;}});
  }}else{{
    fields.style.opacity='1';
    fields.querySelectorAll('input').forEach(function(i){{i.readOnly=false;}});
  }}
  updateSteps();
}}
function updateFileLabel(input){{
  var label=document.getElementById('fileLabel');
  if(input.files.length>0){{
    label.textContent=input.files.length+' Datei'+(input.files.length>1?'en':'')+' ausgew\u00e4hlt';
  }}else{{
    label.textContent='Bilder hochladen';
  }}
}}
function updateSteps(){{
  var s1=document.getElementById('k_nachname').value&&document.getElementById('k_telefon').value;
  var s2=document.getElementById('copyAddr').checked||(document.getElementById('o_strasse').value!='');
  var s3=document.querySelectorAll('.topic-item.active').length>0;
  document.getElementById('step1').className='step'+(s1?' done':' active');
  document.getElementById('step2').className='step'+(s2?' done':(s1?' active':''));
  document.getElementById('step3').className='step'+(s3?' done':(s2?' active':''));
  document.getElementById('step4').className='step'+(s3?' active':'');
}}
document.querySelectorAll('#kontaktForm input,#kontaktForm textarea').forEach(function(el){{
  el.addEventListener('input',updateSteps);
  el.addEventListener('change',updateSteps);
}});
</script>
<style>@keyframes spin{{to{{transform:rotate(360deg)}}}}</style>
</body>
</html>""")


@router.post("/kontakt/submit")
@router.post("/webhook/contact/submit")
async def kontakt_relay(request: Request):
    """Receives the public contact form, saves to Graupner Suite, then forwards to original response.php"""
    form_data = await request.form()
    form_dict = {}
    files_list = []

    for key, value in form_data.multi_items():
        if hasattr(value, 'read'):
            content = await value.read()
            if content:
                files_list.append((key, (value.filename, content, value.content_type or "application/octet-stream")))
        else:
            if key in form_dict:
                if isinstance(form_dict[key], list):
                    form_dict[key].append(value)
                else:
                    form_dict[key] = [form_dict[key], value]
            else:
                form_dict[key] = value

    # 1. Save to Graupner Suite
    try:
        topics = form_dict.get("topic[]", form_dict.get("topic", []))
        if isinstance(topics, str):
            topics = [topics]
        topics = [t for t in topics if t and t.strip()]

        anrede = form_dict.get("anrede", "")
        vorname = form_dict.get("vorname", "")
        nachname = form_dict.get("nachname", "")
        name = f"{anrede} {vorname} {nachname}".strip() or form_dict.get("name", "Unbekannt")

        address_parts = [form_dict.get("strasse", ""), form_dict.get("plz", ""), form_dict.get("stadt", "")]
        address = ", ".join(p for p in address_parts if p)

        notes_parts = []
        if form_dict.get("rolle"):
            notes_parts.append(f"Rolle: {form_dict['rolle']}")
        if form_dict.get("firma"):
            notes_parts.append(f"Firma: {form_dict['firma']}")
        if topics:
            notes_parts.append(f"Themen: {', '.join(t for t in topics if t)}")
        # Beschreibungen pro Kategorie
        desc_fields = {
            "Schiebetür": "desc_schiebetuer",
            "Fenster": "desc_fenster",
            "Innentür": "desc_innentuer",
            "Eingangstür": "desc_eingangstuer",
            "Sonstige Reparaturen": "desc_sonstige"
        }
        for topic_name, field_name in desc_fields.items():
            desc_val = form_dict.get(field_name, "")
            if desc_val and desc_val.strip():
                notes_parts.append(f"{topic_name}: {desc_val.strip()}")
        obj_parts = [form_dict.get("objstrasse", ""), form_dict.get("objplz", ""), form_dict.get("objstadt", "")]
        obj_addr = ", ".join(p for p in obj_parts if p)
        if obj_addr:
            notes_parts.append(f"Objektadresse: {obj_addr}")
        if form_dict.get("nachricht"):
            notes_parts.append(f"Nachricht: {form_dict['nachricht']}")

        rolle_map = {"Eigentümer/Vermieter": "Vermieter", "Hausverwaltung": "Hausverwaltung", "Mieter": "Mieter", "Interessent Tischlerarbeiten": "Privat"}
        customer_type = rolle_map.get(form_dict.get("rolle", ""), "Privat")

        anfrage = Anfrage(
            name=name,
            email=form_dict.get("email", ""),
            phone=form_dict.get("telefon", ""),
            address=address,
            notes="\n".join(notes_parts),
            categories=topics,
            customer_type=customer_type,
            firma=form_dict.get("firma", ""),
            anrede=anrede,
            source="kontaktformular",
            obj_address=obj_addr,
            nachricht=form_dict.get("nachricht", "")
        )
        await db.anfragen.insert_one(anfrage.model_dump())
        logger.info(f"Neue Anfrage über Kontaktformular-Relay: {name}")

        push_body = f"{name}"
        if topics:
            push_body += f" ({', '.join(topics[:2])})"
        await send_push_to_all(title="Neue Anfrage", body=push_body, url="/anfragen")
    except Exception as e:
        logger.error(f"Fehler beim Speichern in Graupner Suite: {e}")

    # 2. Forward to original response.php
    try:
        import requests as sync_requests
        import concurrent.futures

        forward_items = []
        for key, value in form_dict.items():
            if isinstance(value, list):
                for v in value:
                    forward_items.append((key, v))
            else:
                forward_items.append((key, value))

        forward_files = []
        for key, (filename, content, content_type) in files_list:
            forward_files.append((key, (filename, content, content_type)))

        def do_forward():
            try:
                if forward_files:
                    resp = sync_requests.post(ORIGINAL_FORM_URL, data=forward_items, files=forward_files, timeout=15, verify=False)
                else:
                    resp = sync_requests.post(ORIGINAL_FORM_URL, data=forward_items, timeout=15, verify=False)
                logger.info(f"Weiterleitung an response.php: HTTP {resp.status_code}")
                return resp
            except Exception as ex:
                logger.error(f"Forward-Fehler: {ex}")
                return None

        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(do_forward)
            resp = future.result(timeout=20)

        if resp and resp.status_code == 200:
            return HTMLResponse(content="""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Anfrage gesendet - Tischlerei Graupner</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;color:#1a1a2e;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
.box{text-align:center;max-width:500px;padding:48px 32px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.check{width:72px;height:72px;background:#e8f5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
.check svg{width:36px;height:36px;color:#2e7d32}
h1{font-size:22px;margin-bottom:8px}
p{font-size:15px;color:#666;line-height:1.6;margin-bottom:16px}
.info{background:#f0f4ff;border-radius:10px;padding:16px;margin:20px 0;text-align:left;font-size:13px;color:#444;line-height:1.7}
.info b{color:#1a1a2e}
a.btn{display:inline-block;margin-top:20px;padding:12px 32px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px}
a.btn:hover{background:#2a2a4e}
</style>
</head>
<body>
<div class="box">
<div class="check"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
<h1>Vielen Dank!</h1>
<p>Ihre Anfrage wurde erfolgreich gesendet.</p>
<div class="info">
<b>So geht es weiter:</b><br>
Wir melden uns schnellstm&ouml;glich bei Ihnen &ndash; in der Regel innerhalb von 24 Stunden. Bei dringenden Anliegen erreichen Sie uns telefonisch unter <b>040 / 55 42 10 44</b>.
</div>
<a href="https://www.tischlerei-graupner.de" class="btn">Zur&uuml;ck zur Website</a>
</div>
</body>
</html>""")
        else:
            raise Exception(f"response.php returned {resp.status_code if resp else 'None'}")
    except Exception as e:
        logger.error(f"Fehler beim Weiterleiten an response.php: {e}")
        return HTMLResponse(content="""
            <html><body style="font-family:sans-serif;text-align:center;padding:40px;">
            <h2>Vielen Dank!</h2>
            <p>Ihre Anfrage wurde erfolgreich gespeichert.</p>
            <p style="color:#888;font-size:14px;">(Die Weiterleitung an das Hauptsystem war vorübergehend nicht möglich. Wir kümmern uns darum.)</p>
            <a href="https://www.tischlerei-graupner.de">Zurück zur Website</a>
            </body></html>
        """)
