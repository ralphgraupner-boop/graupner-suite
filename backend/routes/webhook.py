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


@router.get("/kontakt", response_class=HTMLResponse)
async def kontakt_form_page():
    """Public contact form page - no auth required"""
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kontaktformular - Tischlerei Graupner</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;line-height:1.6;min-height:100vh;background:url('https://images.unsplash.com/photo-1755237449468-e70840025313?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwyfHxjYXJwZW50ZXIlMjB3b3JraW5nJTIwd29vZCUyMHdvcmtzaG9wJTIwZGV0YWlsZWR8ZW58MHx8fHwxNzczNzQwODAyfDA&ixlib=rb-4.1.0&q=85') center/cover fixed no-repeat;}}
body::before{{content:'';position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:0}}
body>*{{position:relative;z-index:1}}
.header{{background:rgba(26,26,46,0.85);backdrop-filter:blur(8px);color:#fff;padding:20px 0;text-align:center}}
.header h1{{font-size:20px;font-weight:600}}
.header p{{font-size:13px;opacity:0.7;margin-top:2px}}
.container{{max-width:640px;margin:24px auto;padding:0 16px}}
.card{{background:rgba(255,255,255,0.95);backdrop-filter:blur(6px);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.12);padding:24px;margin-bottom:16px}}
.card h2{{font-size:15px;font-weight:600;margin-bottom:14px;padding-bottom:6px;border-bottom:2px solid #eee;color:#1a1a2e}}
.row{{display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap}}
.field{{flex:1;min-width:160px}}
label{{display:block;font-size:12px;font-weight:500;margin-bottom:3px;color:#555}}
input[type=text],input[type=email],input[type=tel],textarea{{width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;transition:border-color 0.2s}}
input:focus,textarea:focus{{outline:none;border-color:#1a1a2e;box-shadow:0 0 0 3px rgba(26,26,46,0.08)}}
textarea{{resize:vertical;min-height:80px}}
.radio-group{{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}}
.radio-group label{{display:flex;align-items:center;gap:5px;padding:7px 12px;border:1.5px solid #ddd;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.2s}}
.radio-group label:has(input:checked){{border-color:#1a1a2e;background:#f0f0ff}}
.topic-grid{{display:flex;flex-direction:column;gap:8px}}
.topic-item{{border:1.5px solid #ddd;border-radius:10px;overflow:hidden;transition:all 0.3s}}
.topic-item.active{{border-color:#1a1a2e;background:#fafbff}}
.topic-header{{display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;font-size:14px;font-weight:500;transition:all 0.2s;user-select:none}}
.topic-header:hover{{background:#f8f9fa}}
.topic-check{{width:18px;height:18px;border-radius:50%;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}}
.topic-item.active .topic-check{{background:#1a1a2e;border-color:#1a1a2e}}
.topic-item.active .topic-check::after{{content:'';width:6px;height:6px;background:#fff;border-radius:50%}}
.topic-desc{{max-height:0;overflow:hidden;transition:max-height 0.3s ease,padding 0.3s ease;padding:0 14px}}
.topic-item.active .topic-desc{{max-height:200px;padding:0 14px 14px}}
.topic-desc textarea{{width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;min-height:60px;resize:vertical;transition:border-color 0.2s}}
.topic-desc textarea:focus{{outline:none;border-color:#1a1a2e;box-shadow:0 0 0 3px rgba(26,26,46,0.08)}}
.copy-check{{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f0f4ff;border-radius:8px;cursor:pointer;font-size:13px;margin-bottom:12px;border:1.5px solid transparent;transition:all 0.2s}}
.copy-check:has(input:checked){{border-color:#1a1a2e;background:#e8ecff}}
.copy-check input{{width:16px;height:16px}}
.obj-fields{{transition:opacity 0.3s;}}
.btn{{display:block;width:100%;padding:14px;background:#1a1a2e;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.2s}}
.btn:hover{{background:#2a2a4e}}
.required::after{{content:" *";color:#e74c3c}}
.privacy{{display:flex;align-items:start;gap:10px;padding:14px 16px;background:rgba(255,255,255,0.95);backdrop-filter:blur(6px);border-radius:10px;border:1.5px solid #ddd;cursor:pointer;font-size:14px;margin-bottom:16px}}
.privacy input{{width:20px;height:20px;margin-top:1px;flex-shrink:0;cursor:pointer}}
.file-info{{font-size:11px;color:#888;margin-top:3px}}
input[type=file]{{padding:7px;font-size:13px}}
.type-toggle{{display:flex;gap:0;margin-bottom:12px;border:1.5px solid #ddd;border-radius:8px;overflow:hidden}}
.type-toggle label{{flex:1;text-align:center;padding:9px 12px;cursor:pointer;font-size:14px;font-weight:500;transition:all 0.2s;border-right:1px solid #ddd}}
.type-toggle label:last-child{{border-right:none}}
.type-toggle label.privat-label:has(input:checked){{background:#14532D;color:#fff}}
.type-toggle label.firma-label:has(input:checked){{background:#1e40af;color:#fff}}
.type-toggle input{{display:none}}
.firma-field{{max-height:0;overflow:hidden;transition:max-height 0.3s ease;margin-bottom:0}}
.firma-field.show{{max-height:60px;margin-bottom:10px}}
</style>
</head>
<body>
<div class="header">
<h1>Tischlerei Graupner</h1>
<p>Fenster und T&uuml;ren reparieren seit 1960</p>
</div>
<div class="container">
<form action="{backend_url}/api/kontakt/submit" method="POST" enctype="multipart/form-data">
<input type="hidden" name="rolle" value="Eigent&uuml;mer/Vermieter">
<div class="card">
<h2>Kontaktdaten</h2>
<div class="type-toggle">
<label class="privat-label"><input type="radio" name="kundentyp" value="Privat" checked onchange="toggleFirma()"><span>Privat</span></label>
<label class="firma-label"><input type="radio" name="kundentyp" value="Firma" onchange="toggleFirma()"><span>Firma</span></label>
</div>
<div class="firma-field" id="firmaField">
<div class="field"><label class="required">Firmenname</label><input type="text" name="firma" id="firmaInput" placeholder="Name der Firma"></div>
</div>
<div class="radio-group">
<label><input type="radio" name="anrede" value="Herr"><span>Herr</span></label>
<label><input type="radio" name="anrede" value="Frau"><span>Frau</span></label>
<label><input type="radio" name="anrede" value="Divers"><span>Divers</span></label>
</div>
<div class="row">
<div class="field"><label>Vorname</label><input type="text" name="vorname" id="k_vorname"></div>
<div class="field"><label class="required">Nachname</label><input type="text" name="nachname" id="k_nachname" required></div>
</div>
<div class="row">
<div class="field"><label class="required">Telefon</label><input type="tel" name="telefon" id="k_telefon" required></div>
</div>
<div class="row">
<div class="field"><label class="required">E-Mail</label><input type="email" name="email" required></div>
</div>
<div class="row">
<div class="field"><label class="required">Stra&szlig;e, Nr.</label><input type="text" name="strasse" id="k_strasse" required></div>
<div class="field" style="max-width:100px"><label class="required">PLZ</label><input type="text" name="plz" id="k_plz" required></div>
<div class="field"><label class="required">Stadt</label><input type="text" name="stadt" id="k_stadt" required></div>
</div>
</div>
<div class="card">
<h2>Objektadresse</h2>
<label class="copy-check">
<input type="checkbox" id="copyAddr" onchange="toggleCopy()">
Kontaktdaten als Objektadresse &uuml;bernehmen
</label>
<div class="obj-fields" id="objFields">
<div class="row">
<div class="field"><label>Vorname</label><input type="text" name="objvorname" id="o_vorname"></div>
<div class="field"><label>Nachname</label><input type="text" name="objnachname" id="o_nachname"></div>
<div class="field"><label>Telefon</label><input type="tel" name="objtelefon" id="o_telefon"></div>
</div>
<div class="row">
<div class="field"><label>Stra&szlig;e</label><input type="text" name="objstrasse" id="o_strasse"></div>
<div class="field" style="max-width:100px"><label>PLZ</label><input type="text" name="objplz" id="o_plz"></div>
<div class="field"><label>Stadt</label><input type="text" name="objstadt" id="o_stadt"></div>
</div>
</div>
</div>
<div class="card">
<h2>Was wird ben&ouml;tigt?</h2>
<div class="topic-grid" id="topicGrid">
<div class="topic-item" data-topic="Schiebet&uuml;r">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span>Schiebet&uuml;r</span></div>
<div class="topic-desc"><textarea name="desc_schiebetuer" placeholder="Beschreiben Sie das Problem oder den Wunsch zur Schiebet&uuml;r..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Fenster">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span>Fenster</span></div>
<div class="topic-desc"><textarea name="desc_fenster" placeholder="Beschreiben Sie das Problem oder den Wunsch zum Fenster..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Innent&uuml;r">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span>Innent&uuml;r</span></div>
<div class="topic-desc"><textarea name="desc_innentuer" placeholder="Beschreiben Sie das Problem oder den Wunsch zur Innent&uuml;r..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Eingangst&uuml;r">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span>Eingangst&uuml;r</span></div>
<div class="topic-desc"><textarea name="desc_eingangstuer" placeholder="Beschreiben Sie das Problem oder den Wunsch zur Eingangst&uuml;r..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
<div class="topic-item" data-topic="Sonstige Reparaturen">
<div class="topic-header" onclick="toggleTopic(this)"><div class="topic-check"></div><span>Sonstige Reparaturen</span></div>
<div class="topic-desc"><textarea name="desc_sonstige" placeholder="Beschreiben Sie was repariert werden soll..."></textarea></div>
<input type="hidden" name="topic[]" value="" class="topic-val">
</div>
</div>
</div>
<div class="card">
<h2>Nachricht &amp; Bilder</h2>
<textarea name="nachricht" placeholder="Beschreiben Sie Ihr Anliegen..." rows="4"></textarea>
<div style="margin-top:10px">
<label>Bilder hochladen</label>
<input type="file" name="upload_file1" accept="image/*" multiple>
<p class="file-info">Optional: Fotos vom Objekt (max. 50 MB)</p>
</div>
</div>
<label class="privacy">
<input type="checkbox" name="dataprivacy" required>
<span>Ich habe die <a href="https://www.tischlerei-graupner.de/j/privacy" target="_blank" style="color:#1a1a2e;font-weight:600;text-decoration:underline;">Datenschutzerkl&auml;rung</a> gelesen und stimme zu.</span>
</label>
<button type="submit" class="btn">Anfrage absenden</button>
</form>
</div>
<script>
function toggleFirma(){{
  var isFirma=document.querySelector('input[name="kundentyp"][value="Firma"]').checked;
  var field=document.getElementById('firmaField');
  var input=document.getElementById('firmaInput');
  if(isFirma){{
    field.classList.add('show');
    input.required=true;
    setTimeout(function(){{input.focus();}},300);
  }}else{{
    field.classList.remove('show');
    input.required=false;
    input.value='';
  }}
}}
function toggleTopic(header){{
  var item=header.parentElement;
  var isActive=item.classList.contains('active');
  var hiddenInput=item.querySelector('.topic-val');
  var topic=item.getAttribute('data-topic');
  if(isActive){{
    item.classList.remove('active');
    hiddenInput.value='';
  }}else{{
    item.classList.add('active');
    hiddenInput.value=topic;
    var ta=item.querySelector('textarea');
    if(ta)setTimeout(function(){{ta.focus();}},300);
  }}
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
}}
</script>
</body>
</html>""")


@router.post("/kontakt/submit")
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
