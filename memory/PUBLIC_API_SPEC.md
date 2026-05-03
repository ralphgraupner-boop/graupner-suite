# 📡 Graupner Suite — Public Contact-API Spezifikation v1

> **Status:** Entwurf · 02.05.2026
> **Zweck:** Direkte Anbindung von Kontaktformularen aus mehreren Quellen
> (Domains, Landing-Pages, Werbeanzeigen) an Graupner Suite ohne IMAP-Umweg.
>
> **Diese Spezifikation kann an Webdesigner verschickt werden, damit sie
> die Formulare bereits passend zum Schema vorbereiten können.**

---

## 🎯 Endpoint

```
POST https://app.tischlerei-graupner.de/api/public/contact
Content-Type: application/json
```

Auch akzeptiert:
- `application/x-www-form-urlencoded` (klassische HTML-Formulare)
- `multipart/form-data` (Formulare mit Anhängen — geplant Phase 2)

---

## 🔐 Authentifizierung

**Header:**
```
X-API-Key: gs_pub_a1b2c3d4e5f6...
```

- Pro Quelle 1 eigener Key
- Verwaltung in der Admin-UI: erzeugen, umbenennen, deaktivieren, Statistik
- Kompromittierter Key → 1 Klick deaktivieren, andere Quellen laufen weiter

---

## 📦 Request-Body

```json
{
  "source": "schiebetuer-reparatur-hamburg-de",
  "source_url": "https://schiebetuer-reparatur-hamburg.de/kontakt",

  "anrede": "Herr",
  "firma": "",

  "vorname": "Max",
  "nachname": "Mustermann",

  "email": "max@beispiel.de",
  "telefon": "+49 40 1234567",

  "strasse": "Beispielweg 12",
  "plz": "22111",
  "ort": "Hamburg",

  "nachricht": "Schiebetür klemmt seit gestern...",

  "anliegen_typ": "schiebetuer-reparatur",

  "honeypot": "",

  "turnstile_token": "0.aBcD...",

  "consent_datenschutz": true,
  "consent_zeitstempel": "2026-05-02T20:14:00+02:00",

  "meta": {
    "user_agent": "Mozilla/5.0 ...",
    "referrer": "https://google.de/search?q=schiebetuer+reparatur",
    "client_ip_hint": ""
  }
}
```

### Feld-Spezifikation

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `source` | string (max 80, kebab-case) | **Ja** | Eindeutige ID der Quelle: `jimdo-haupt`, `schiebetuer-reparatur-hamburg-de`, `google-ads-psk-tueren`. Nur `a-z 0-9 -`. |
| `source_url` | string (URL) | nein | Konkrete Seite, von der das Formular kam |
| `anrede` | enum | nein | `"Herr"` / `"Frau"` / `"Divers"` / `""` |
| `firma` | string (max 200) | nein | Bei B2B |
| `vorname` | string (max 100) | nein¹ | |
| `nachname` | string (max 100) | **Ja** | |
| `email` | string (RFC-valide) | **Ja²** | mind. eines von Email/Telefon Pflicht |
| `telefon` | string (max 50) | **Ja²** | mind. eines von Email/Telefon Pflicht |
| `strasse` | string (max 200) | nein | |
| `plz` | string (4-10) | nein | |
| `ort` | string (max 100) | nein | |
| `nachricht` | string (max 4000) | **Ja** | Freitext, HTML wird gestrippt |
| `anliegen_typ` | string (max 80, kebab-case) | nein | Vor-Kategorisierung: `kostenvoranschlag`, `tuer-reparatur`, `notdienst`, … |
| `honeypot` | string | nein | **Muss leer sein!** Versteckt im Formular. Wenn ausgefüllt → Spam |
| `turnstile_token` | string | **Ja³** | Cloudflare Turnstile Token, server-seitig verifiziert |
| `consent_datenschutz` | bool | **Ja** | Muss `true` sein (DSGVO-Pflicht) |
| `consent_zeitstempel` | ISO-8601 | nein | Wir setzen ihn sonst selbst |
| `meta.user_agent` | string | nein | Browser-Info für Spam-Erkennung |
| `meta.referrer` | string | nein | Woher der Nutzer kam |

¹ Wenn nur `nachname` gesetzt, ist's OK
² Mindestens eines (Email **oder** Telefon)
³ Wenn Quelle Turnstile-Pflicht hat (pro API-Key konfigurierbar)

---

## ✅ Response: Erfolg (HTTP 201)

```json
{
  "ok": true,
  "anfrage_id": "f7c8a9b2-3d4e-...",
  "status": "vorschlag",
  "nachricht": "Vielen Dank, wir melden uns innerhalb von 24h."
}
```

**Wichtig:** Kein Hinweis auf Spam-Filter im Response. Spam wird **angenommen** (HTTP 201) aber intern gefiltert. So lernt der Bot nichts.

---

## ❌ Response: Fehler

| HTTP | Code | Wann |
|---|---|---|
| 400 | `validation_error` | Pflichtfeld fehlt / ungültiges Format |
| 401 | `invalid_api_key` | Key fehlt, ungültig oder deaktiviert |
| 403 | `consent_missing` | `consent_datenschutz != true` |
| 403 | `turnstile_failed` | Turnstile-Token ungültig (echter Bot) |
| 429 | `rate_limit` | >5 Anfragen / Minute / IP, oder >50 / Stunde / Key |
| 500 | `server_error` | Unser Fehler |

```json
{
  "ok": false,
  "error_code": "validation_error",
  "error_message": "Feld 'email' ist nicht gültig",
  "field": "email"
}
```

---

## 📨 Webhook (für Push-Notification)

Pro API-Key konfigurierbar. Wenn eine Anfrage akzeptiert wird, schickt unser Server einen POST an deine Webhook-URL:

```
POST https://deine-webhook.de/anfrage-eingang
X-Webhook-Secret: dein-secret-zur-verifizierung
Content-Type: application/json
```

```json
{
  "event": "contact.received",
  "anfrage_id": "f7c8a9b2-...",
  "received_at": "2026-05-02T20:14:23+02:00",
  "source": "schiebetuer-reparatur-hamburg-de",
  "preview": {
    "name": "Max Mustermann",
    "email": "max@beispiel.de",
    "telefon": "+49 40 1234567",
    "nachricht_kurz": "Schiebetür klemmt seit gestern..."
  },
  "spam_score": 0.05,
  "admin_url": "https://app.tischlerei-graupner.de/module/mail-inbox?id=f7c8a9b2-..."
}
```

**Webhook-Verhalten:**
- **Retries:** 3 Versuche (sofort, +30s, +5min)
- **Timeout:** 10 Sekunden pro Versuch
- **Signatur-Check:** `X-Webhook-Secret` matchen, sonst Anfrage ablehnen
- **Logs:** alle Versuche in `module_public_api_webhooks` einsehbar

**Push-Notification-Optionen** (zu klären):
- **a)** PWA Web-Push (haben wir schon, aber muss aktiv im Browser eingeloggt sein)
- **b)** Telegram-Bot (super zuverlässig, externes Konto nötig)
- **c)** Beides parallel

---

## 🛡️ Spam-Schutz (vom System automatisch)

1. **Honeypot:** Versteckt `<input name="honeypot">` — wenn ausgefüllt → Spam
2. **Cloudflare Turnstile:** Token-Validierung server-seitig
3. **Rate-Limit:** 5/Minute/IP, 50/Stunde/Key
4. **Inhalts-Filter** (bestehender Spam-Filter aus `module_mail_inbox`): Punycode, Russisch, Verkaufs-Keywords, …
5. **Email-Validierung:** MX-Record-Check, Disposable-Mail-Block
6. **Spam-Score:** 0.0–1.0, > 0.8 → automatisch in `spam_verdacht`-Tab

---

## 🌐 Beispiel-Implementierungen

### Vanilla HTML + JS (z.B. für Jimdo)

```html
<form id="kontaktform">
  <input name="nachname" required>
  <input name="email" type="email" required>
  <textarea name="nachricht" required></textarea>

  <!-- Honeypot: für Bots, Mensch sieht ihn nicht -->
  <input name="honeypot" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off">

  <!-- Cloudflare Turnstile -->
  <div class="cf-turnstile" data-sitekey="DEIN-TURNSTILE-SITE-KEY" data-callback="onTurnstile"></div>

  <label>
    <input type="checkbox" name="consent" required>
    Ich habe die <a href="/datenschutz">Datenschutzerklärung</a> gelesen.
  </label>

  <button type="submit">Absenden</button>
</form>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
let turnstileToken = "";
function onTurnstile(token) { turnstileToken = token; }

document.getElementById("kontaktform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);

  try {
    const res = await fetch("https://app.tischlerei-graupner.de/api/public/contact", {
      method: "POST",
      headers: {
        "X-API-Key": "gs_pub_DEIN-KEY",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "jimdo-haupt",
        source_url: location.href,
        nachname: fd.get("nachname"),
        email: fd.get("email"),
        nachricht: fd.get("nachricht"),
        honeypot: fd.get("honeypot"),
        turnstile_token: turnstileToken,
        consent_datenschutz: fd.get("consent") === "on",
        meta: {
          user_agent: navigator.userAgent,
          referrer: document.referrer,
        },
      }),
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.nachricht || "Vielen Dank, wir melden uns!");
      e.target.reset();
    } else {
      alert("Fehler: " + (data.error_message || "Bitte erneut versuchen."));
    }
  } catch (err) {
    alert("Verbindungsfehler. Bitte später erneut versuchen.");
  }
});
</script>
```

### PHP (z.B. für WordPress)

```php
<?php
// Server-seitig (POST-Handler)
$api_key = getenv("GRAUPNER_API_KEY"); // aus .env

$response = wp_remote_post("https://app.tischlerei-graupner.de/api/public/contact", [
    "headers" => [
        "X-API-Key"    => $api_key,
        "Content-Type" => "application/json",
    ],
    "body" => json_encode([
        "source"              => "wordpress-haupt",
        "source_url"          => $_SERVER["HTTP_REFERER"] ?? "",
        "nachname"            => sanitize_text_field($_POST["nachname"]),
        "email"               => sanitize_email($_POST["email"]),
        "telefon"             => sanitize_text_field($_POST["telefon"] ?? ""),
        "nachricht"           => sanitize_textarea_field($_POST["nachricht"]),
        "honeypot"            => $_POST["honeypot"] ?? "",
        "turnstile_token"     => $_POST["cf-turnstile-response"] ?? "",
        "consent_datenschutz" => isset($_POST["consent"]),
    ]),
    "timeout" => 15,
]);

if (is_wp_error($response)) {
    wp_send_json_error(["message" => "Verbindungsfehler"], 500);
} else {
    $body = json_decode(wp_remote_retrieve_body($response), true);
    wp_send_json($body, wp_remote_retrieve_response_code($response));
}
```

### curl (zum Testen)

```bash
curl -X POST https://app.tischlerei-graupner.de/api/public/contact \
  -H "X-API-Key: gs_pub_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "test",
    "nachname": "Test",
    "email": "test@example.de",
    "nachricht": "Test-Anfrage",
    "consent_datenschutz": true,
    "turnstile_token": "TEST-DUMMY-TOKEN"
  }'
```

---

## 🏗️ Architektur (Module-First-Prinzip)

```
/app/backend/module_public_api/
  ├── __init__.py
  ├── routes.py             ← /api/public/contact + Admin-CRUD
  ├── api_keys.py           ← Key-Verwaltung
  ├── turnstile.py          ← Cloudflare-Verification
  ├── webhook.py            ← Outbound-Webhooks (mit Retry-Queue)
  └── rate_limit.py         ← Token-Bucket pro IP/Key

Mongo-Collections:
  - module_public_api_keys      (Keys + Webhook-Konfig + Stats)
  - module_public_api_log       (Audit: jede Anfrage, auch Spam)
  - module_public_api_webhooks  (Outbound-Webhook-Versuche + Retries)

Admin-UI:
  Einstellungen → API-Schlüssel
    ├── Liste (Name, Quelle, letzte Anfrage, Spam-Quote)
    ├── + Neuer Key
    └── Detail: Webhook konfigurieren, Stats, Code-Beispiele anzeigen
```

**Datenfluss bei eingehender Anfrage:**
```
External Form → POST /api/public/contact
    ↓
[1] API-Key validieren
    ↓
[2] Rate-Limit prüfen (IP + Key)
    ↓
[3] Pflichtfelder + Format prüfen
    ↓
[4] Consent prüfen (DSGVO)
    ↓
[5] Honeypot prüfen
    ↓
[6] Turnstile-Token verifizieren
    ↓
[7] Spam-Score berechnen (Inhaltsfilter)
    ↓
[8] In module_mail_inbox speichern
    (Status: spam_verdacht ODER vorschlag)
    ↓
[9] Webhook auslösen (async, mit Retry)
    ↓
[10] Push-Notification (PWA / Telegram)
    ↓
HTTP 201 zurück an Form
```

---

## 📚 Kompatibilität mit `module_mail_inbox`

Die Public-API speichert in **derselbe Collection** wie der IMAP-Scanner:

```javascript
{
  id: "uuid",
  status: "vorschlag" | "spam_verdacht" | "übernommen" | "ignoriert",
  source_type: "imap" | "public_api",  // NEU: woher kam's
  source: "jimdo-haupt",                // NEU: API-Source-Field
  source_url: "...",
  parsed: {
    anrede, vorname, nachname,
    email, telefon, nachricht,
    strasse, plz, ort,
    anliegen_typ,
    consent_datenschutz: true,
    consent_zeitstempel: "..."
  },
  spam_score: 0.05,
  meta: { user_agent, referrer, client_ip },
  api_key_id: "...",                    // welcher Key wurde benutzt
  webhook_status: "delivered" | "failed" | "pending",
  created_at: "...",
  // Wenn übernommen:
  customer_id: "..."
}
```

**Vorteil:** Du siehst alle Anfragen in einer Liste, mit Filter:
- „Aus IMAP" / „Aus API" / „Alle"
- „Nach Quelle: jimdo-haupt / schiebetuer-reparatur / …"

---

## 🔧 Admin-UI Mockup

**Pfad:** Einstellungen → API-Schlüssel

```
┌──────────────────────────────────────────────────────────┐
│ 🔑 API-Schlüssel für Kontaktformulare         + Neu      │
├──────────────────────────────────────────────────────────┤
│ Jimdo-Haupt                                              │
│   gs_pub_xx••••••••     letzte: vor 2 Std    23/Monat    │
│   Spam: 12%   ✅ aktiv                                    │
├──────────────────────────────────────────────────────────┤
│ Schiebetür-Reparatur Hamburg                             │
│   gs_pub_xx••••••••     letzte: vor 3 Tagen   8/Monat    │
│   Spam: 0%   ✅ aktiv                                     │
├──────────────────────────────────────────────────────────┤
│ Google Ads - PSK Türen                                   │
│   gs_pub_xx••••••••     letzte: gestern      45/Monat    │
│   Spam: 35%   ⚠️ aktiv                                    │
└──────────────────────────────────────────────────────────┘
```

**Detail-Ansicht eines Keys:**
```
🔑 Jimdo-Haupt
─────────────────────────────────────────
Name:               Jimdo-Haupt
API-Key:            gs_pub_xxxxxxxxxxxxxxxx [Kopieren]
                    [Schlüssel rotieren]
Status:             ● Aktiv  [deaktivieren]

Quelle (source):    jimdo-haupt
Erlaubte Domains:   https://www.tischlerei-graupner.de
                    [+ weitere]

Cloudflare Turnstile: ✅ erforderlich
Site-Key:           0x4AAAAAAA... [bearbeiten]

Webhook:            https://api.telegram.org/bot.../sendMessage
                    Secret: ********** [bearbeiten]
                    Letzte Zustellung: ✅ vor 5 Min
                    [Test-Webhook senden]

Auto-Kunde:         ⬜ Bei vollständigen Daten automatisch anlegen

Statistik (30 Tage):
  Anfragen:         23
  Spam erkannt:     3 (13%)
  Übernommen:       18
  Webhook-Fehler:   0

Code-Beispiele:    [HTML/JS] [PHP] [curl]   [Doku-Link]
```

---

## ✅ Klärungspunkte (entschieden — 02.05.2026, Ralph Graupner)

| # | Frage | Entscheidung |
|---|---|---|
| **1** | Push-Notification-Variante | **c) Beides parallel** — PWA für Schreibtisch + Telegram für unterwegs (Redundanz) |
| **2** | Auto-Kunden-Anlage bei Anfrage | **c) Pro API-Key konfigurierbar** — Default: Manuell (sicher) |
| **3** | Bei Email-Duplikat | **c) Pro Key konfigurierbar** — Default: **a) Stille Aktualisierung** + **TROTZDEM Notification!** |

### 📝 Wichtige Detail-Vorgaben von Ralph

**Zu Frage 1 (Push):**
- PWA Web-Push für aktive Schreibtisch-Sessions (Sound + Browser-Notification)
- Telegram-Bot als Always-on-Kanal (auch ohne Browser)
- **Bonus-Feature:** Telegram-Bot bekommt **Inline-Buttons** im Chat:
  ```
  [✅ Übernehmen]  [🚫 Spam]  [✍️ Antworten]
  ```
  Klick auf „Übernehmen" → Anfrage wird Kunde (gem. Auto-Anlage-Regel)
  Klick auf „Spam" → Anfrage wird ignoriert + Tombstone
  Klick auf „Antworten" → Telegram fragt nach Antworttext, schickt direkt als Mail an Anfrager

**Zu Frage 2 (Auto-Kunde):**
- Default beim Anlegen eines neuen Keys: **Manuell**
- Pro Quelle umschaltbar in der Admin-UI
- Empfohlener Use-Case:
  - Eigene Domains → Auto-Anlage (Quelle vertraut)
  - Externe Portale (Houzz, Bauinfo24) → Manuell (mehr Spam-Risiko)
  - Google Ads → Auto-Anlage (höhere Conversion)

**Zu Frage 3 (Duplikat):**
- Default: **a) Stille Aktualisierung** — Stammkunden bleiben EINE Karteikarte
- Vorteil: Bei einem Kunden, der nach 2 Jahren wieder anfragt, sieht Ralph sofort die komplette Historie
- **🚨 KRITISCH:** Auch bei stiller Aktualisierung muss eine **Notification** ausgelöst werden, sonst werden Anfragen übersehen!

---

## 📌 Zusatzwünsche von Ralph (Roadmap-Erweiterung)

### Phase 3+
- 📊 **Statistik-Dashboard pro Source**: Anfragen/Tag, Spam-Quote, **Conversion-Rate** (Anfrage → Auftrag)
- 🎯 **A/B-Test Tracking-Parameter**: `utm_campaign`, `utm_source`, `utm_medium` aus URL automatisch ins `meta`-Feld speichern (für Marketing-Auswertung)

### Phase 4
- 📎 **Anhänge-Support**: Kunde kann Foto der defekten Tür direkt im Formular mitschicken (multipart/form-data, max. 5 Bilder, 5 MB pro Bild, automatische Kompression wie im Portal)

---

## 🚦 Roadmap

### Phase 1 (MVP)
- [ ] `module_public_api` Backend (POST-Endpoint)
- [ ] API-Key-Verwaltung (Admin-UI) mit Default „Auto-Kunde: AUS" + „Duplikat: Stille Aktualisierung"
- [ ] Cloudflare Turnstile Integration
- [ ] Rate-Limiting + Honeypot
- [ ] Speichert in `module_mail_inbox` mit `source_type: "public_api"`
- [ ] **Notification auch bei stiller Aktualisierung** auslösen (kritisch!)

### Phase 2 (Webhook + Push — beides parallel)
- [ ] Outbound-Webhook mit Retry-Queue
- [ ] **PWA Web-Push** für Admin-Browser (Schreibtisch)
- [ ] **Telegram-Bot-Integration** mit Inline-Buttons:
  - [✅ Übernehmen] → Auto-Kunde anlegen / oder Vorschlag erzeugen
  - [🚫 Spam] → Status "ignoriert" + Tombstone
  - [✍️ Antworten] → Bot fragt nach Antworttext, sendet als Mail
- [ ] Webhook-Test-Funktion in UI

### Phase 3 (Komfort + Marketing)
- [ ] Code-Beispiele direkt in der UI (Copy-Paste)
- [ ] **Statistik-Dashboard pro Source** mit Conversion-Rate (Anfrage → Auftrag)
- [ ] **UTM-Parameter** aus URL automatisch ins `meta`-Feld speichern
- [ ] Auto-Kunde-Anlage (konfigurierbar) — UI-Toggle pro Key
- [ ] Deutsche Doku-Seite unter `/api-docs/public` (Login-geschützt)
- [ ] OpenAPI/Swagger-Export

### Phase 4 (Erweiterung)
- [ ] **Datei-Anhänge** (multipart/form-data, max. 5 Bilder × 5 MB, Kompression wie Portal)
- [ ] Zusätzliche Events (contact.spam, contact.duplicate, contact.converted)
- [ ] IP-Whitelist pro Key
- [ ] Custom-Felder pro Source

---

## 📝 Versions-Verlauf

- **v1.0** — 02.05.2026 — Initialer Entwurf
- **v1.1** — 02.05.2026 — Ralph-Entscheidungen festgehalten (PWA+Telegram, Pro-Key-Config, Stille Aktualisierung Default), Telegram-Inline-Buttons, UTM-Tracking, Anhänge-Phase ergänzt

---

## 📞 Kontakt für Webdesigner

Bei Fragen zur Integration:
- **Ralph Graupner** (Tischlerei Graupner)
- Doku: `/api-docs/public` (nach Login)
- Test-Sandbox: `https://handwerk-deploy.preview.emergentagent.com/api/public/contact`
