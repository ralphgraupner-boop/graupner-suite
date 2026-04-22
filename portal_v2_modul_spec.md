# Modul-Spezifikation: Kundenportal v2 (Standalone)

**Projekt:** Graupner Suite – Kundenportal v2
**Version:** 1.0 (Spec)
**Erstellt:** 22.04.2026
**Prinzip:** Module-First. Strikt isoliert. Später als eigenes Produkt auslagerbar.

---

## 1. Ziel

Ein eigenständiges Kundenportal als **komplett isoliertes Modul** innerhalb der Graupner Suite. Das alte Portal (`portal.py` / `PortalsPage.jsx`) bleibt unberührt und läuft parallel weiter. Portal v2 ist per Feature-Flag an/aus.

**Konstruktiv. Einfach. Effizient. Später ausbaubar.**

---

## 2. Modul-Struktur (alle Dateien NEU, nichts Bestehendes wird angefasst)

### 2.1 Backend

```
/app/backend/portal_v2/
├── __init__.py              # FastAPI-Router, sammelt alle Sub-Router
├── models.py                # Pydantic-Models (PortalAccount, Message, Upload, …)
├── database.py              # Collection-Handles (portal2_*)
├── auth.py                  # Token-Generierung, Passwort-Hash, Login-Check
├── routes_public.py         # Öffentliche Routes (Kunden-Frontend, kein Login-Schutz bei /lookup)
├── routes_admin.py          # Admin-Routes (mit get_current_user Dependency)
├── routes_customer.py       # Kunden-Routes (Portal-Token-Auth)
├── mail_builder.py          # Email-HTML-Templates (isoliert, nicht in utils/__init__.py)
├── sync.py                  # Import-Logik aus module_kunden (nur lesend!)
└── rate_limit.py            # Upload-Rate-Limit (aus altem Portal übernommen)
```

### 2.2 Frontend

```
/app/frontend/src/pages/portal_v2/
├── PortalV2AdminPage.jsx    # Admin-Übersicht (alle Portale, Einladung versenden)
├── PortalV2DetailPage.jsx   # Admin-Detail eines Portals (Nachrichten, Uploads)
├── PortalV2LoginPage.jsx    # Kunden-Login
└── PortalV2CustomerPage.jsx # Kunden-Ansicht (nach Login)

/app/frontend/src/components/portal_v2/
├── PortalV2MessageList.jsx
├── PortalV2UploadArea.jsx
└── PortalV2ImportButton.jsx # Import-Button aus module_kunden
```

### 2.3 Navigation / Integration in die Suite

**EINZIGE Berührung mit Bestandscode:**
- Navigation.jsx: **1 neuer Menüpunkt** („Kundenportal v2") – nur hinzugefügt, nichts geändert
- App.js / Routes: **4 neue Routes** – nur hinzugefügt
- server.py: **1 neuer Router-Include** (`portal_v2.router`) – nur hinzugefügt

Keine Änderung an `portal.py`, `PortalsPage.jsx`, `utils/__init__.py`, `webhook.py`.

---

## 3. Datenbank-Collections (alle NEU)

| Collection | Zweck | Felder (Kern) |
|---|---|---|
| `portal2_accounts` | Portal-Accounts | `id, customer_id, name, email, password_hash, token, active, created_at` |
| `portal2_messages` | Nachrichten Admin↔Kunde | `id, portal_id, sender (admin/customer), text, attachments, read, created_at` |
| `portal2_uploads` | Kunden-Dateien | `id, portal_id, filename, storage_path, size, mime, uploaded_by, created_at` |
| `portal2_activity` | Audit-Log | `id, portal_id, action, ip, user_agent, created_at` |
| `portal2_settings` | Modul-Konfiguration | `feature_enabled, email_template, rate_limit, …` |
| `portal2_sync_log` | Import-Historie aus module_kunden | `id, imported_ids, count, timestamp` |

**Keine Überschneidung** mit `portals`, `portal_files`, `portal_messages` (alte Collections).

---

## 4. API-Endpoints (alle unter `/api/portal-v2/*`)

### 4.1 Admin (Login erforderlich)

| Method | Route | Zweck |
|---|---|---|
| GET | `/api/portal-v2/admin/accounts` | Liste aller Portal-Accounts |
| POST | `/api/portal-v2/admin/accounts` | Portal-Account manuell anlegen |
| POST | `/api/portal-v2/admin/accounts/import-from-kunden` | Import aus `module_kunden` (Multi-Select) |
| GET | `/api/portal-v2/admin/accounts/{id}` | Detail + Nachrichten + Uploads |
| PUT | `/api/portal-v2/admin/accounts/{id}` | Bearbeiten (Email, Status, Passwort-Reset) |
| DELETE | `/api/portal-v2/admin/accounts/{id}` | Löschen (inkl. Daten) |
| POST | `/api/portal-v2/admin/accounts/{id}/invite` | Einladung per Email senden |
| POST | `/api/portal-v2/admin/accounts/{id}/messages` | Nachricht an Kunde |
| GET | `/api/portal-v2/admin/settings` | Feature-Flag + Einstellungen |
| PUT | `/api/portal-v2/admin/settings` | Einstellungen ändern |

### 4.2 Kunde (Portal-Token-Auth)

| Method | Route | Zweck |
|---|---|---|
| POST | `/api/portal-v2/login` | Login (Email + Passwort) → Token |
| GET | `/api/portal-v2/me` | Eigene Account-Daten |
| GET | `/api/portal-v2/messages` | Eigene Nachrichten |
| POST | `/api/portal-v2/messages` | Nachricht an Admin |
| POST | `/api/portal-v2/uploads` | Datei hochladen |
| GET | `/api/portal-v2/uploads` | Eigene Uploads auflisten |

### 4.3 Public (kein Login)

| Method | Route | Zweck |
|---|---|---|
| GET | `/api/portal-v2/health` | Health-Check |

---

## 5. Feature-Flag-Logik

**Master-Flag:** `portal2_settings.feature_enabled` (default: `false`)

- Im Admin-Bereich (Einstellungen → Module) kannst du Portal v2 **ein- oder ausschalten**.
- Wenn **aus**: Menüpunkt im Frontend verschwindet, alle `/api/portal-v2/*`-Endpoints geben 404 zurück.
- Wenn **an**: alles aktiv, komplett parallel zum alten Portal.

**Unabhängig vom Flag:** Das alte Portal (`portal.py`) läuft immer weiter — Portal v2 greift nie darauf zu.

---

## 6. Datenquelle: Import aus `module_kunden`

**NUR lesend.** Portal v2 schreibt niemals in `module_kunden`.

**Flow:**
1. Admin öffnet Portal v2 → „Kunden importieren"
2. Liste aller `module_kunden`-Einträge wird angezeigt (mit Filter nach `kontakt_status`)
3. Admin wählt per Checkbox aus
4. Klick „Importieren" → für jeden ausgewählten Kunden wird ein `portal2_accounts`-Eintrag erstellt (mit zufällig generiertem Passwort + Token)
5. Einladungs-Email wird optional gleich mit verschickt
6. Import wird in `portal2_sync_log` protokolliert (Audit)

**Konflikt-Handling:** Wenn `customer_id` bereits in `portal2_accounts` existiert → Skip, keine Dublette.

---

## 7. Frontend-Screens (MVP)

### 7.1 Admin-Bereich

**`PortalV2AdminPage`**
- Tabelle aller Portal-Accounts (Name, Email, Status, letzte Aktivität)
- Buttons: „Neuer Account", „Aus Kunden importieren", „Einladung senden"
- Filter: aktiv/inaktiv, Suche

**`PortalV2DetailPage`**
- Account-Infos (editierbar)
- Nachrichten-Verlauf (Chat-Ansicht)
- Uploads-Galerie
- Activity-Log
- Aktionen: Passwort zurücksetzen, Account deaktivieren

### 7.2 Kunden-Bereich

**`PortalV2LoginPage`** (öffentlich, eigene Subroute z.B. `/portal-v2/login`)
- Email + Passwort
- „Passwort vergessen" (optional Phase 2)

**`PortalV2CustomerPage`** (nach Login)
- Begrüßung mit `{anrede_brief}`
- Tab 1: **Nachrichten** (Chat mit Admin)
- Tab 2: **Dokumente** (was der Admin zu meinem Vorgang hochgeladen hat) – Phase 2
- Tab 3: **Datei-Upload** (Fotos vom Schaden/Aufmaß hochladen)
- Logout

---

## 8. Aufbau in Phasen (jeder Block einzeln testbar)

### Phase 1 — Gerüst (MVP Minimum)
- [ ] Backend: `portal_v2/` Ordnerstruktur + leerer Router in server.py
- [ ] Collections: `portal2_accounts` + `portal2_settings` anlegen
- [ ] Feature-Flag lesbar/schreibbar via `/api/portal-v2/admin/settings`
- [ ] Admin-Routes CRUD für Accounts
- [ ] Frontend: Menüpunkt + leere AdminPage

**Test:** Login → Menüpunkt „Portal v2" → Liste leer → „Account anlegen" → erscheint in DB.

### Phase 2 — Import aus module_kunden
- [ ] Backend: `sync.py` + Import-Endpoint
- [ ] Frontend: Import-Modal mit Kundenliste + Checkboxen
- [ ] `portal2_sync_log` schreiben

**Test:** Import-Button klicken → 3 Kunden auswählen → in `portal2_accounts` erscheinen.

### Phase 3 — Einladung + Login
- [ ] Backend: Passwort-Hash, Token, Login-Endpoint
- [ ] Backend: `mail_builder.py` + Einladungs-Email
- [ ] Frontend: `PortalV2LoginPage` + `PortalV2CustomerPage` (nur Begrüßung)

**Test:** Account anlegen → Einladung senden → Email kommt an → Login funktioniert → Kunde sieht Begrüßung.

### Phase 4 — Nachrichten
- [ ] Backend: Messages-CRUD (Admin + Kunde)
- [ ] Frontend: Chat-UI beidseitig

**Test:** Admin schreibt → Kunde sieht → Kunde antwortet → Admin sieht.

### Phase 5 — Uploads
- [ ] Backend: Upload-Endpoint (mit HEIC-Konvertierung, Rate-Limit)
- [ ] Frontend: Upload-Area mit Progress

**Test:** Kunde lädt Foto hoch → erscheint im Admin-Detail.

### Phase 6 — Polish (später)
- Passwort vergessen
- Dokumente-Tab (Admin kann PDFs hochladen)
- Terminwunsch
- Design-Feinschliff (Design-Agent)

---

## 9. Abhängigkeiten zur bestehenden Suite

**Lesend (read-only):**
- `module_kunden` – nur für Import
- `settings` (Firmendaten) – nur für Email-Branding (Logo, Adresse, Signatur)
- `users` – nur für Admin-Auth (`get_current_user`)

**Nicht berührt:**
- `portal.py`, `PortalsPage.jsx`, `PortalPublicPage.jsx` (altes Portal)
- `utils/__init__.py` (SMTP-Kern)
- `webhook.py`, `anfragen_fetcher.py`
- `WysiwygDocumentEditor.jsx`, `DashboardPage.jsx`

**Keine Hintergrund-Jobs:** Kein Background-Poller, kein Cron, nichts Automatisches. Alle Aktionen sind Button-getriggert.

---

## 10. Aufwandsschätzung (grob)

| Phase | Aufwand | Credits (geschätzt) |
|---|---|---|
| Phase 1 (Gerüst + Admin-CRUD) | klein | niedrig |
| Phase 2 (Import) | klein-mittel | niedrig |
| Phase 3 (Login + Einladung) | mittel | mittel |
| Phase 4 (Nachrichten) | mittel | mittel |
| Phase 5 (Uploads) | mittel | mittel |
| Phase 6 (Polish) | je nach Wunsch | variabel |

**Summe MVP (Phase 1–5): ~3–5 Sessions**

---

## 11. Deliverables & Freigabe-Prozess

1. Spec von dir freigegeben → Phase 1 starten
2. **Nach jeder Phase**: Testen in Preview → deine Freigabe → Commit → nächste Phase
3. **Kein Phase-Sprung ohne deine OK**
4. **Keine Änderung an Bestandsdateien ohne explizite Rückfrage**

---

## 12. Offene Punkte vor Phase 1

1. ✅ **Modulname im Menü**: „Kundenportal v2" oder lieber „Portal Pro"?
2. ✅ **Subroute im Frontend**: `/portal-v2/*` oder anderer Name?
3. ✅ **Kunden-Login-URL**: Gleiche Domain + Pfad (z.B. `/portal-v2/login`) oder spätere eigene Subdomain?
4. ✅ **Passwort-Stärke**: Auto-generiert (empfohlen) oder Kunde wählt selbst beim Login?
5. ✅ **Soll das alte Portal nach Migration deaktiviert werden** – oder dauerhaft parallel laufen?

Bitte pro Punkt eine kurze Antwort – dann starte ich Phase 1.

---

**Ende der Spec**
