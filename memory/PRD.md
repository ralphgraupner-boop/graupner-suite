# Graupner Suite — PRD

## Vision
Modulares CRM/ERP für Tischlerei Graupner Hamburg. React + FastAPI + MongoDB, strikt nach **Module-First-Prinzip**: jedes Feature lebt in einem isolierten `module_X`-Ordner mit eigenen Routen und Collections. UI arbeitet mit „Datenmasken" (Composite Views ohne Datenduplikation).

## ⚠️ NEUER AGENT
**Bitte zuerst** `/app/memory/AGENT_BRIEFING.md` lesen und Ralph die Punkte bestätigen, bevor irgendwas am Code geändert wird.

## Nutzer
- **Ralph (Admin)** — vollständiger Zugriff, Preview & Live, **kein Programmierer**
- **Buchhaltung** — Rechnungen, Einsichten
- **Mitarbeiter/Monteur** — Monteur-App, Aufgaben
- **Kunden (Portal)** — eigenes Dokument-/Portal-System

## Umgebungen
- **Live**: Login `admin` / `Graupner!Suite2026` — rotes Theme
- **Preview**: Login `admin-preview` / `HamburgPreview2026!` — blaues Theme
- Beide haben **getrennte** MongoDBs (Live = anderer Server)

## Kern-Regeln
- `module_kunden` ist die einzige Kunden-Wahrheit. Die legacy `customers`-Collection ist **tot**.
- Alle neuen Features als `module_X` (Backend) + eigene UI.
- 🚨 **Auswahlfelder-Pflicht (06.05.2026, Ralph bestätigt, dauerhaft):** Alle Grundlagen-Auswahlfelder (Status, Kategorien, Anreden, Mahn-Stufen, Abschluss-Gründe, Auftragsarten, …) werden **ausschließlich** in `module_textvorlagen` mit eigenem `doc_type` gepflegt. Niemals hartcodiert. Niemals neues Modul. Niemals doppelt. Frontend lädt live über `/api/modules/textvorlagen/data?doc_type=...`.
- Keine Captchas; Spam wird server-seitig im Mail-Parser gefiltert.
- Preview-Theme = Blau. Live-Theme = Rot. Unterscheidet sofort visuell.
- Ralph wünscht **konsultativen Stil**: Plan vorschlagen → auf „Ja" warten → umsetzen.
- **Sprache: immer Deutsch, einfach erklärt** (Ralph ist kein Programmierer)

## Implementierte Module (Stand Mai 2026)

| Modul | Zweck |
|---|---|
| `module_kunden` | Kunden-Stammdaten, Source of Truth |
| `module_projekte` | Projekte/Akten pro Kunde |
| `module_aufgaben` | Interne Aufgaben mit VorlagenPicker |
| `module_termine` | Termine mit GO-Workflow + VorlagenPicker |
| `module_kalender_export` | ICS/Monteur-Feed |
| `module_duplikate` | Kunden-Dedup-Tool |
| `module_export` | ZIP-Export inkl. Bilder + Import (Single + Sammel) |
| `module_health` | Umgebungsbanner, Konsistenz-Check |
| `module_kunde_delete` | Cascade-Delete mit Zwangs-ZIP-Backup |
| `module_mail_inbox` | IMAP-Anfragen, Spam-Filter, Tombstones, Delete, **Multi-Postfach** |
| `module_kundenlink` | Tokenbasierte Public-Links für Mitarbeiter (kunden- oder projektbezogen, Verlängerungs-Workflow) |
| `module_user_prefs` | Sidebar-Reihenfolge pro User |
| `module_portal_v2_backup` | Tägliche Auto-Backups |
| `module_feedback` | **Notizen-Widget** (Floating, 30-Tage-Archiv) |
| `monteur_app` | Mobile PWA mit Bildkompression |
| `routes/portal.py` (legacy) | Kundenportale - heute Datenmasken-fähig gemacht |

- **Such-Schema Update (12.05.2026, Ralph 12.05.2026):**
  - **Listen werden jetzt auch ohne Such-Auswahl angezeigt**, sortiert nach Datum: Aufgaben/Projekte/Einsätze nach `created_at` desc, Termine nach `start` asc, Kunden nach `created_at` desc (primärer Sortierschlüssel, kein Status mehr).
  - **Empty-State zweistufig** entfernt — bei leerer Liste nur noch „Keine X vorhanden".
  - **Untertitel** zeigt jetzt „X von Y · sortiert nach Datum" bzw. „X für [Auswahl]".
  - **Status-Filter** bei Projekten + Einsätzen immer sichtbar (vorher nur nach Auswahl).

- **Titel-Eingabe mit Live-Vorschlägen (12.05.2026, Ralph 12.05.2026, Datenmaske):**
  Neue zentrale Komponente `/app/frontend/src/components/TitleInputWithVorlagen.jsx`:
  - Tippen → unterhalb erscheint Dropdown mit max. 8 passenden Vorschlägen aus `module_textvorlagen` (live gefiltert).
  - Bei leerem Feld: erste 8 vorhandene Vorschläge.
  - Klick auf Vorschlag → übernimmt ins Feld.
  - Zahnrad-Symbol im Label öffnet `TextvorlagenInlineManager` zur direkten Pflege.
  - Frei tippbar bleibt — Vorschlagsliste ist Hilfe, nicht Zwang.
  - **Eingebaut in**: Aufgaben-Titel (`aufgabe_titel`), Termin-Titel (`termin_titel`), Projekt-Titel (`projekt_titel` ersetzt das alte `datalist`), Einsatz-Betreff (`einsatz_betreff`).
  - **Backend**: `VALID_DOC_TYPES` + `SELECTION_DOC_TYPES` in `module_textvorlagen/routes.py` um 3 neue Doc-Types erweitert (`aufgabe_titel`, `termin_titel`, `einsatz_betreff`) — Sammlung startet leer, Pflege über UI.
  - E2E (Playwright): Listen sichtbar in allen 4 Modulen ✓, Untertitel zeigen Sortierung ✓, Titel-Input vorhanden in Aufgabe-Dialog ✓.

- **Portal-Kontroll-Kopie (BCC) für Kundenportal-Mails (12.05.2026, Ralph 12.05.2026):**
  Neue Funktion: zusätzliche Kopie aller Portal-Mail-Aktivität ins Admin-Postfach für Kontrolle/Fehleranalyse, ohne dass der Kunde es sieht.
  - **`utils.send_email`**: neuer Parameter `bcc` (optional). Wenn gesetzt: Mail-Envelope geht an Empfänger UND BCC, BCC-Header nicht in der Mail → für Empfänger unsichtbar. Doppelte Zustellung wird vermieden.
  - **`utils.get_portal_bcc()`**: neuer async Helper, liest `company_settings.portal_bcc_admin` aus DB. Leer = keine Kopie.
  - **Portal v4 Invite-Mail** (`portal_v4/routes_admin.py`): nutzt `bcc=await get_portal_bcc()` → Admin bekommt Kopie der Einladung.
  - **Portal v4 Chat-Nachrichten** (`portal_v4/messages.py`): da Chat-Nachrichten an Kunden NUR im Portal angezeigt werden (kein direkter E-Mail-Versand), wurde ein neuer `_notify_admin_inbox(account, sender, sender_name, text)`-Helper eingebaut. Er schickt bei JEDER Portal-Nachricht (Admin→Kunde UND Kunde→Admin) eine **Kontroll-Mail** ans Admin-BCC mit Richtung, Kundenname, Zeit, Portal-ID und vollem Nachrichtentext. Subject z.B. `[Portal-Kopie] Von Max Mustermann: Hallo, wann ...`. Fehler im Versand werden geloggt aber nicht weitergereicht → Chat funktioniert immer.
  - **`CompanySettings`-Model** (`models.py`): neues Feld `portal_bcc_admin: str = ""` ergänzt.
  - **UI** (Settings → E-Mail → SMTP-Block): neues Feld „Portal-Kontroll-Kopie (BCC)" direkt unter „Absender-Adresse". Beschreibung erklärt, dass der Kunde diese Adresse nicht sieht. Leer = aus.
  - **Datenschutz/Hinweis im Body**: Kontroll-Mails enthalten Footer „Antworten auf diese Mail kommen NICHT beim Kunden an" — damit klar ist, dass das nur ein Audit-Log ist.
  - Backend lint + Restart sauber, Setting-Endpoint liefert den neuen Wert.
  - **Phase 2 offen** (auf Wunsch): gleiche Kontroll-Kopie für Termin-Bestätigungen, Angebots-Mails, normale Outbound-Mails aus dem Inbox-Modul.

- **Titel-Vorschläge Bugfix (12.05.2026, Ralph 12.05.2026):**
  Ralphs vorhandene Termin-/Aufgaben-/Einsatz-Vorlagen lagen unter den **alten Doc-Types** (`termin`, `aufgabe`, `einsatz`), nicht unter den neuen (`termin_titel`, `aufgabe_titel`, `einsatz_betreff`) → Vorschläge zeigten nichts.
  - **`TitleInputWithVorlagen`** um Prop `fallbackDocTypes` erweitert: lädt mehrere Doc-Types parallel, mergt + dedupliziert nach Titel (case-insensitive trim), sortiert alphabetisch.
  - **Aufrufe angepasst**:
    - Aufgaben: `aufgabe_titel` + Fallback `aufgabe`
    - Termine: `termin_titel` + Fallback `termin`
    - Einsätze: `einsatz_betreff` + Fallback `einsatz`
    - Projekte: `projekt_titel` (kein Fallback nötig)
  - E2E-verifiziert: bei leerem Titel-Feld erscheinen alle 7 Termin-Vorlagen, beim Tippen „Besi" filtert auf 4 Treffer ✓.

## Zuletzt abgeschlossen (12.05.2026)

- **Such-zuerst-Schema einheitlich auf Projekte / Aufgaben / Termine / Einsätze (Ralph 12.05.2026):**
  Nach erfolgreicher Validierung im Aufgaben-Modul wurde das gleiche Pattern auf weitere drei Module ausgerollt. Kunden bleibt absichtlich unangetastet (User-Entscheidung). Notizen & Bugs ist nicht datenmasken-fähig (kein `kunde_id`), bleibt unverändert.
  - **Identisches Header-Layout** bei allen vier Modulen: Titel + Untertitel · Refresh-Button · konditionaler Neu-Button.
  - **Identisches Such-Verhalten**:
    - Suchzeile mit Lupen-Icon + Platzhalter „Kunde oder Projekt suchen, um <X> anzuzeigen oder anzulegen …".
    - Inline-Treffer-Dropdown (absolut positioniert, z-Index 20) mit zwei Sektionen „Kunden (n)" + „Projekte (n)", je max. 8 Treffer.
    - Auswahl-Chip nach Klick (blau für Kunde, grün für Projekt) mit ✖ zum Entfernen.
    - „+ Neu …"-Button NUR sichtbar wenn Auswahl getroffen.
    - Empty-States zweistufig: ohne Auswahl „Bitte zuerst Kunde oder Projekt suchen", mit Auswahl + leere Liste „Keine X für diesen Kunden/dieses Projekt".
  - **Datenmaske strikt eingehalten**: alle Module joinen `kundenMap`/`projekteMap` live, kein Daten-Duplikat. Backend hat `kunde_id`/`projekt_id` bei allen vier (geprüft).
  - **Dialoge erhalten `selectedTarget` als Vorbelegung**: bei Neuanlage werden `kunde_id`/`projekt_id` (und bei Einsatz auch Adresse/E-Mail/Telefon) automatisch aus der Such-Auswahl befüllt. Sub-Felder im Dialog (Kunde/Projekt-Auswahl) wurden bei Aufgaben entfernt (kommen aus dem Chip oben). Bei Termine/Einsätze bleiben die Felder im Dialog vorhanden, sind aber vorbelegt.
  - **Projekte-Modul-Spezialfall**: Klick auf Kunde-Treffer = Liste filtert auf seine Projekte, „+ Neues Projekt"-Button sichtbar. Klick auf Projekt-Treffer = navigiert direkt zur Werkbank (Projekt selbst ist ja schon „die Auswahl"). Konsistent mit Datenmodell.
  - **Einsätze-Modul-Spezialfall**: Da `EinsatzForm` ein großes Spezialformular mit eigener Kunden-Suchlogik + Adress-Pre-Fill ist, wurde nur `selectedTarget` als zusätzliche Vorbelegung hinzugefügt — vorhandene Logik bleibt unverändert.
  - **Bestätigung E2E (Playwright) für alle drei**: Suchzeile vorhanden ✓, Empty-Hinweis korrekt ✓, Button vor Auswahl versteckt ✓, je 4 Kunden-Treffer ✓, Button nach Auswahl sichtbar ✓.
  - **Screenshots zeigen einheitliches Layout** über alle Module — UX konsistent.

## Zuletzt abgeschlossen (11.05.2026)

- **Floating-Windows (Variante C — Vollausbau, Ralph 11.05.2026):**
  Echte Multi-Instance-Fenster für ALLE Modals aus `components/common/index.jsx`. Zentrale Komponenten:
  - **`/components/windows/WindowManager.jsx`**: React-Context-Provider mit `register/unregister/bringToFront/setMinimized/setTitle`, hält Liste offener Fenster mit Z-Index. Rendert `FloatingTaskBar` unten am Bildschirmrand (`fixed bottom-3 left-1/2 -translate-x-1/2 z-[200]`, `hidden md:flex`) — zeigt alle minimierten Fenster als Buttons mit Titel; Klick stellt Fenster wieder her und holt es nach vorn.
  - **`Modal` refactored** (`components/common/index.jsx`):
    - Stabile Instanz-ID pro Modal-Render (`wnd-<n>`). Registriert sich beim Manager bei `isOpen=true`, deregistriert bei `false`.
    - Desktop (`md:`): `position: fixed` mit individuellem `left/top/width/height/zIndex`. Initial zentriert, persistiert pro Titel-Slug in `localStorage` (`modal-pos:<slug>` → `{pos, box}`), beim Restore Viewport-Clamping.
    - **Drag**: Header `cursor: grab`, Maus-Drag verschiebt das Fenster. Doppelklick auf Header minimiert.
    - **Resize**: 8 unsichtbare Handles (4 Kanten + 4 Ecken) mit korrekten `cursor-{n,s,e,w,ne,nw,se,sw}-resize`. Min-Größe 320×200.
    - **Minimize/Close**: zwei Buttons (`Minus`/`X` Icons) im Header. Minimierte Fenster bleiben gemountet (`display:none`), behalten Formular-State.
    - **Z-Stack**: jeder `mousedown` auf dem Fenster ruft `bringToFront(id)` → höchste `zIndex`-Counter; Manager-State steuert Reihenfolge.
    - Mobile / `blocking=true`: unverändert klassischer Vollbild-Backdrop, kein Drag/Resize.
  - **Multi-Instance „Kunde bearbeiten"** (`KundenModulPage.jsx`): `editKunde`/`showModal` (Single-State) durch `openEdits` (Array) ersetzt. Helper `openEditFor(kunde)`/`closeEditFor(target)`. Dedupe per `kunde.id`, neue Kunden bekommen `__key`. Multiple `<KundenFormModal>` werden via `.map` parallel gerendert. Bedeutet: Ralph kann jetzt Kunde A und Kunde B gleichzeitig bearbeiten.
  - **`WindowManagerProvider`** in `App.js` zwischen `HelpProvider` und `BrowserRouter` eingehängt → globaler State.
  - **Bestehende eigene Modal-Implementierungen** (`TrashStartupCheck`, `KundenLinkExpiryCheck`, `MailDetailModal` usw.) sind NICHT vom Refactor betroffen — sie blieben unverändert (Bestätigungs-Dialoge bleiben blockierend, was korrekt ist).
  - **E2E-Smoke (Playwright):** 2 Fenster parallel ✓, Resize SE-Eck 960×700 → 1159×849 ✓, Minimize → Taskbar mit 1 Eintrag „Kunde bearbeiten" sichtbar ✓, Restore via Taskbar → `display:flex` zurück ✓, Z-Stack bei Klick ✓ (107 → 111), Position+Größe in `localStorage` persistent ✓.
  - **Bekannt:** Wenn ein Fenster sehr groß resized wird, kann es Sidebar/Hintergrund-Elemente überdecken — Lösung: Fenster verschieben oder minimieren. Mehr-Monitor-Setups: Fenster bleiben im Browser-Viewport (kein OS-Window-Detach).

- **Vorher (heute morgen, jetzt obsolet):** Erste, halbe Variante (Drag + transparenter Backdrop) wurde durch Vollausbau Variante C ersetzt.

  - **Snap-to-Edge (11.05.2026, Ralph 11.05.2026, Bonus):**
    - Während des Drag wird Maus-Position gegen Viewport-Kanten geprüft (`EDGE_THRESHOLD = 8`):
      - `clientY ≤ 8` → Mode `max` (Content-Bereich vollflächig)
      - `clientX ≤ sidebar + 8` → Mode `left` (linke Hälfte des Content-Bereichs)
      - `clientX ≥ innerWidth - 8` → Mode `right` (rechte Hälfte)
    - Sidebar wird respektiert: ab `lg` (1024 px) Offset 256 px, sonst 0.
    - Während Drag: halbtransparente Vorschau-Box (`bg-primary/20 ring-2 ring-primary/80`, z-index 9998) zeigt das Snap-Ziel.
    - Bei Drop mit Hint: aktuelle Pos+Size in `preSnapRef` gemerkt, Fenster auf Snap-Rect gesetzt.
    - Neuer Drag aus gesnapptem Zustand: Originalgröße wird wiederhergestellt, Fenster positioniert sich proportional unter dem Cursor (Header-Offset 80/20).
    - Helper `_snapRect(mode)`, `_detectSnap(x, y)`, `_sidebarOffset()` zentralisiert in `common/index.jsx`.
    - Playwright-Test: Snap-Vorschau sichtbar ✓, Snap-LEFT exakt {x:256, y:0, w:832, h:1080} ✓, Unsnap restored ✓, Snap-MAX {256/0/1664/1080} ✓, Snap-RIGHT {1088/0/832/1080} ✓.

  - **Pop-Out / Multi-Monitor (11.05.2026, Ralph 11.05.2026, Variante D Phase 1):**
    - Neue Datei `lib/windowSync.js`: `BroadcastChannel`-Wrapper mit `broadcast(event, payload)` + React-Hook `useBroadcast(event, handler)`. Kanal: `graupner-suite`.
    - **`Modal`** bekommt neuen Prop `popoutUrl`. Wenn gesetzt: zusätzlicher Button `ExternalLink`-Icon im Header (zwischen Resize-Handle und Minimize). Klick öffnet ein **echtes Browser-Popup** via `window.open(popoutUrl, _graupner_popup_<id>, "popup=yes,width=980,height=800,left=...,top=...")`. Das Modal im Hauptfenster wird sofort danach geschlossen.
    - Neue Seite **`pages/PopupShell.jsx`** + Route `/popup/:type/:id?`. Layout ohne Sidebar/Hauptlayout, dark gegen unauthenticated geschützt (`useAuth`). Generic-Container mit Lookup-Table für Typ → Form. Aktuell implementiert: `type=kunde` rendert `<KundenFormModal>` mit `popoutEnabled=false, onClose=window.close, onSave=broadcast+window.close(800ms)`.
    - **Multi-Screen Window Placement API** (Chromium): `window.getScreenDetails()` wird beim Mount probiert. Wenn mehrere Bildschirme erkannt: kleine Toolbar oben rechts im Popup mit Monitor-Buttons (`Monitor 1 / Monitor 2 / ...`). Klick auf einen anderen Monitor → `window.moveTo(x,y)+resizeTo(w,h)` auf das Ziel-Display zentriert. Listener auf `screenschange` und `currentscreenchange`. Permission-Denied wird stillschweigend toleriert.
    - **`KundenFormModal`** wurde aus `KundenModulPage` exportiert (`export { KundenModulPage, KundenFormModal }`). Neuer Prop `popoutEnabled` (default `true`); im Popup-Mode auf `false` damit der Pop-Out-Button im Popup selbst nicht erneut erscheint. Nach Save feuert `broadcast("kunden-changed", { kundeId })`.
    - **`KundenModulPage`** lauscht via `useBroadcast("kunden-changed", () => { loadKunden(); loadLinkCounts(); })` — Liste wird live aktualisiert, wenn in einem Popup gespeichert wird.
    - **E2E-Test** (Playwright): Pop-Out öffnet `/popup/kunde/<id>` ✓, Formular vorbefüllt ✓, Notiz im Popup ergänzt + Speichern ✓, `kunden-changed`-Event im Hauptfenster empfangen ✓, Popup auto-close nach 800 ms ✓, Marker `E2E_BC_TEST_1778494680` in DB-`notes` verifiziert ✓.
    - **Noch offen (Phase 2):** Pop-Out für „Neuer Termin", „Mailverlauf", „Neues Projekt", „Aufgabe bearbeiten". Pattern dokumentiert, neuer Form-Typ braucht nur:
      1) Form-Komponente exportieren mit `popoutEnabled` Prop
      2) Lookup-Eintrag in `PopupShell.jsx`
      3) `popoutUrl` in Caller-Komponente setzen
      4) `broadcast(<event>, …)` nach Save + entsprechende `useBroadcast`-Listener in Listen-Pages

  - **Pop-Out Fix (11.05.2026): Popup-Inhalt füllt jetzt das gesamte Fenster.** Zuvor renderte das Modal im Popup-Browserfenster weiterhin im Floating-Modus → „Fenster-im-Fenster"-Optik (Ralph per Video gemeldet). Lösung: `Modal` erkennt jetzt automatisch `window.location.pathname.startsWith("/popup/")` und rendert in dem Fall im **Full-Window-Modus**: `fixed inset-0`, kein Backdrop, kein Drag/Resize, kein Minimize-/Pop-Out-Button, nur Titel + Schließen. Playwright: `modal-root` füllt 980×800 Popup vollständig, Backdrop/Resize/Minimize alle weg ✓.

  - **Direct-Popout (11.05.2026, Ralph 11.05.2026, Phase 2a):**
    Klick auf „Bearbeiten" oder „Neues Projekt" öffnet jetzt **direkt** ein eigenes Browser-Fenster — kein In-App-Floating-Modal mehr dazwischen. User-Pref `ui_direct_popout` (localStorage, default `true`) steuert das. Bei deaktivierter Pref oder Popup-Blocker: automatischer Fallback auf In-App-Modal (Drag/Resize/Snap bleiben verfügbar).
    - Neuer Helper `openInPopup(url)` in `lib/windowSync.js` + Getter/Setter für die Pref.
    - **`KundenModulPage`**: `openEditFor()` und beide „Neues Projekt"-Buttons rufen jetzt `openInPopup()` mit Fallback.
    - **`ProjekteListe`**: „Neues Projekt"-Button rendert via `openInPopup('/popup/projekt/new')`; `useBroadcast("projekte-changed")` lädt Liste live wenn Popup speichert.
    - **`PopupShell`** um `type=projekt` erweitert: lädt Kunde (per `kunde_id`-Query) + `counts-by-kunde` für `isFirstProjekt`, rendert `NewProjektDialog`. Nach Create: `broadcast("projekte-changed")` + auto-close.
    - **Settings → Diverses → „Fenster-Verhalten (Desktop)"**: Checkbox-Toggle für Direct-Popout (default an).
    - E2E-verifiziert: Kunde-Edit → Popup direkt ✓, In-App-Modal vermieden ✓, Projekt-Anlage (Kundenliste + Projekt-Liste) → Popup ✓, Titel pre-fill ✓, Toggle aus → Fallback In-App ✓.
    - **Phase 2b offen:** Aufgaben + Termine — deren Dialoge sind keine `Modal`-Komponenten (eigene `fixed inset-0`-Wrapper), brauchen kleinen Refactor mit `isInPopupWindow`-Erkennung. Pattern in PRD dokumentiert.

## Zuletzt abgeschlossen (06.05.2026)

- **Kunden-Seite Crash gefixt** — `KundenModulPage.jsx` rief `KUNDEN_STATUSES` im Listen-Bereich auf, ohne dass die Variable im Hauptcomponent existierte (Refactor-Fehler von vorher). `useTextvorlagen("kunden_status", ...)` ergänzt → Status- und Kategorien-Chips werden jetzt überall live aus `module_textvorlagen` geladen.
- **`module_kundenlink` Phase 2 — Verlängerung & Projekt-Bezug:**
  - Neuer Endpunkt `GET /api/module-kundenlink/expiring?days=7` listet aktive Links die in 7 Tagen ablaufen oder schon abgelaufen sind, mit Kundenname (Datenmaske) + Projekt-Titel (live aus `module_projekte`).
  - Neuer Endpunkt `POST /api/module-kundenlink/{id}/extend` mit `{days}` (1–90) — verlängert Link, ohne Restlaufzeit zu verschwenden (`base = max(now, old_expires_at) + days`). Setzt `extended_at`, `extended_by`, `extend_count`.
  - Neuer Endpunkt `GET /api/module-kundenlink/counts` → `{kunde_id: count_aktiver_links}` für Badges in der Kunden-Liste.
  - **Startup-Check** `KundenLinkExpiryCheck.jsx` (analog zu `TrashStartupCheck`): zeigt beim Login einmal pro Session ein Modal mit allen ablaufenden Links + Buttons **+7 / +14 / +30 Tage** + **Widerrufen**. Zeigt zusätzlich „· Projekt XYZ" wenn Link projektbezogen.
  - Gelöschter Kunde → Link wird im `expiring`-Endpunkt automatisch widerrufen (statt anzuzeigen).
- **Mitarbeiter-Link pro Projekt:**
  - `POST /api/module-kundenlink/create/{kunde_id}` nimmt jetzt optional Body `{projekt_id}` an. `projekt_titel` wird im Link-Dokument als Cache gespeichert (Datenmaske: live aus `module_projekte`).
  - `GET /view/{token}` liefert `{kunde, projekt}` — Mitarbeiter sieht Projekt-Beschreibung, Notizen, Bilder gruppiert nach Kategorie (vorher/schaden/nachher/sonstiges).
  - `GET /list/{kunde_id}?projekt_id=...` filterbar nach Projekt.
  - **Werkbank** (`ProjektWerkbank.jsx`): pro Projekt-Karte eigener „Link für Mitarbeiter"-Button (violett) → öffnet `KundenLinkDialog` mit `projekt`-Prop → erzeugt projektbezogene Links.
  - **Public-Seite** `KundenLinkPage.jsx`: violette Projekt-Sektion mit Status, Kategorie, abweichende Adresse, Beschreibung, Notizen + Bilder-Grid pro Kategorie.
- **Aktive-Links-Badge in Kunden-Liste:**
  - `KundenModulPage.jsx` lädt `/module-kundenlink/counts` und zeigt 🔗 N als violettes Badge in der Kompakt-Zeile sowie in der Aktion-Leiste am „Link für Mitarbeiter"-Button.
- **Aktion-Button „Link für Mitarbeiter" im Kunden-Modul** (war im Edit-Modal versteckt) jetzt zusätzlich prominent in der aufgeklappten Detail-Aktionsleiste.

## Zuletzt abgeschlossen (05.05.2026)

- **Mail-Inbox „Mail öffnen + prüfen"**-Flow (großer Cut). Anti-Pattern entfernt:
  - ❌ `MailAcceptModal.jsx` gelöscht (war ein Doppel-Kundenformular im Mail-Modul → Verstoß gegen VISION.md „Datenmasken nicht duplizieren")
  - ✅ Neues `MailDetailModal.jsx` (`/app/frontend/src/components/`): Klick auf Mail-Karte oder „Öffnen / Prüfen" → Volltext + erkannte Daten + 3 Aktionen (Übernehmen / Ignorieren / Löschen). „Übernehmen" navigiert direkt ins **bestehende Kunden-Modul** (`/kunden?edit={id}`), wo die echte Datenmaske ist
  - ✅ `KundenModulPage.jsx` öffnet bei `?edit={id}` automatisch die Bearbeiten-Maske
- **Mail-Filter neu in 4 Stufen** (siehe Section unten — wichtig für jeden Agenten):
  - **Stufe 2 NEU**: Reply-Prefix Hard-Block. Mails mit Betreff-Anfang `Re:`/`AW:`/`Fw:`/`Fwd:`/`WG:`/`Read:`/`Undeliverable:`/`Automatic reply:`/`Automatische Antwort:`/`Out of office:` werden **immer** abgelehnt (`_is_reply_or_auto` in `module_mail_inbox/accounts.py`)
  - **Stufe 3 NEU**: Vollständigkeitscheck. Nur Mails mit ≥ 5 von 8 Pflichtfeldern (`vorname`, `nachname`, `email`, `telefon`, `strasse`, `plz`, `ort`, `nachricht`) kommen rein. `is_complete_form()` in `module_mail_inbox/parser.py` (`MIN_COMPLETENESS = 5`)
  - **Bonus-Bugfix Parser**: Leere Felder „klauten" sich gegenseitig die nächste Zeile (`\s*` matchte `\n`) → ersetzt durch `[ \t]*`. Strasse/PLZ/Ort werden jetzt sauber gelesen.
- **Mail-Vorschau Lösch-Funktionen** (`module-mail-inbox/preview-delete` + `preview-bulk-delete`):
  - Lösch-Button pro Zeile in „Übersprungene anzeigen"-Modal
  - **Massen-Aktion** „Alle Übersprungenen löschen" oben in der Tab-Leiste — legt Tombstones für alle aktuell angezeigten übersprungenen Mails auf einen Schlag an
  - Jede Lösch-Aktion = Tombstone in `module_mail_inbox_deleted` per `message_id` → kommt nie wieder
- **Cleanup-Run** der bestehenden DB: 8 Reply-/Fwd-/Read-Einträge automatisch auf `ignoriert` gesetzt + Tombstone

## ⚠️ Mail-Filter — der 4-stufige Reinigungs-Stack (Stand 05.05.2026)

**Eine Mail wird nur in `module_mail_inbox` als `vorschlag` gespeichert wenn ALLE 4 Bedingungen zutreffen.** Reihenfolge im Code, kurzschluss-evaluiert:

| # | Bedingung | Wo? | Was schließt es aus |
|---|---|---|---|
| 1 | Postfach-Filter (OR-Regeln) trifft | `accounts.filter_matches()` | Newsletter, Werbung, fremde Domains |
| 2 | Kein Reply-/Auto-Präfix im Betreff | `accounts._is_reply_or_auto()` | Konversations-Müll, Lesebestätigungen, Out-of-Office |
| 3 | ≥ 5 von 8 Pflichtfeldern ausgefüllt | `parser.is_complete_form()` | leere Formulare, Spam mit nur „Anrede: Herr" |
| 4 | Kein Duplikat (DB + Tombstone) | `routes.scan` | bereits importierte oder gelöschte Mails |

**ÄNDERUNGEN AN DIESEM STACK NUR MIT RALPHS FREIGABE.** Lockerung verursacht Müll-Importe; Verschärfung verliert echte Anfragen.

## Zuletzt abgeschlossen (04.05.2026)

- **Papierkorb (`module_papierkorb`)**: Soft-Delete für Kunden mit App-Start-Frage. Backend-Modul mit eigener Route `/api/module-papierkorb` (move/list/count/restore/purge/purge-all). Soft-Delete setzt `deleted_at`+`deleted_by`-Felder am Kunden, `module_kunden.list` filtert sie raus. Endgültiges Löschen erfordert **Login-Passwort** (bcrypt-Verify) + nutzt bestehendes `module_kunde_delete`-Cascade mit Backup-ZIP-Mail. Frontend: vereinfachter Lösch-Dialog (kein Name-eintippen mehr — Soft-Delete als Pflaster), neue Komponente `TrashStartupCheck.jsx` zeigt beim Login automatisch ein Modal mit allen Papierkorb-Einträgen + „Wiederherstellen" pro Eintrag + „Alle X endgültig löschen" mit Passwort-Feld + „Später entscheiden". Pro Browser-Session nur einmal abgefragt (sessionStorage).
- **Settings-Schnellzugriff**: 5 Karten oben in /settings (Artikel, Textvorlagen, Duplikate, Handy-Zugang, Wissen).
- **Mobile-Pass für Feedback-Widget + Kunden-Liste**: Touch-Targets ≥44px, font-size 16px, Form-Submit, Safe-Area-Inset.
- **Mail-Detail & Mailverlauf-Modal**: Neuer Endpunkt `POST /mail-detail` (Body + Header einer konkreten IMAP-Mail) und `POST /customer-mails` (Suche in allen aktiven Postfächern nach From/To/CC = Kunden-Mail). UI-Komponente `MailHistoryModal.jsx`. Neuer Button **„Mailverlauf"** auf jeder Kunden-Detailkarte.
- **Anfrage-Statistik pro Postfach**: `GET /stats?days=N` + UI-Karte mit Conversion-Rate.
- **Mail-Vorschau & Manueller Import**: Neuer Endpunkt `POST /scan-preview` (read-only IMAP-Browse, max 200 Mails der letzten X Wochen) + `POST /import-mail` (gezielter UID-Import, auch wenn Filter sie übersprungen hätte). UI: Button „Übersprungene anzeigen" auf der Mail-Anfragen-Seite öffnet Modal mit Statistik pro Postfach + Liste **gruppiert nach Postfach** (sticky Header), Tab „Nur Übersprungene" / „Alle anzeigen", einzelner „Importieren"-Button pro Mail. Tombstone wird beim manuellen Import automatisch entfernt.
- **Min-2-Filter-Validierung**: Backend lehnt `POST/PUT /accounts` mit weniger als 2 Filter-Regeln ab (HTTP 400). Frontend prüft Submit zusätzlich und zeigt Toast.
- **`module_mail_inbox` Suchfilter pro Postfach**: 4 Filter-Typen (Betreff enthält/beginnt mit, Absender enthält/ist exakt). OR-Logik (mind. 1 muss zutreffen). UI-Editor im Postfach-Modal mit „+ Regel hinzufügen". Bei leerer Liste werden Default-Rules (Jimdo, „Anfrage von", „Nachricht über") gesetzt – rückwärtskompatibel. IMAP-Server-Search wird dynamisch aus den Rules gebaut (ASCII-only, sonst Fallback auf SINCE).
- **`module_mail_inbox` Multi-Postfach**: Beliebig viele IMAP-Postfächer hinterlegbar (eigene Collection `module_mail_inbox_accounts`, Fernet-verschlüsselte Passwörter). ENV-Postfach wird beim ersten Aufruf automatisch als „Hauptpostfach" migriert. Scan iteriert über alle aktiven Postfächer, pro Mail wird `account_id`/`account_label` gespeichert. UI in *Einstellungen → E-Mail*: Anlegen, Bearbeiten, Pause, Test, Löschen. IMAP bleibt read-only — Live + Vorschau können parallel scannen. „Verbindung testen" beim Bearbeiten ohne neues Passwort nutzt nun den gespeicherten Account.
- **Portal-Passwort-Bug**: '5' war noch im Alphabet enthalten. Gefixt in `routes/portal.py` und allen Legacy-Generatoren `portal_v2/v3/v4/auth.py`. 1000-Iter-Test grün.

## Zuletzt abgeschlossen (02.05.2026)

- **Phase A: Portal-Datenmasken** – `customer_name`/`customer_email` werden bei jedem Lesezugriff live aus `module_kunden` synchronisiert (Helper `_enrich_portal_with_kunde` + Bulk-Variante). Cache wird zurückgeschrieben für Suche.
- **Mail-Encoding**: `utils/send_email` UTF-8-sicher (Header utf-8, MIMEText _charset, as_bytes). Templates wieder mit echten Umlauten.
- **Portal-Login-Passwort**: keine missverständlichen Zeichen mehr (0/O/1/l/I/5/S), Mail-Template zeigt Passwort in Mono-Font groß.
- **Notify-Checkbox**: bei Admin-Notiz und Dokument-Upload optional Mail an Kunden (default OFF). Token wird IMMER aus DB geholt (Sicherheits-Fix).
- **2-Spalten-Layout**: Kundenportal + Admin-Portal. Bilder rechts sticky, Schriftwechsel links.
- **Bildkompression**: Browser-seitig (1920px / JPEG 80%) in CustomerPortal, AdminPortal, MonteurApp. Spart 80-90% Mobilfunk-Volumen.
- **Bild-Vorschau vor Upload**: Kunde sieht Thumbnails, kann Doubletten/Falsches mit X entfernen, dann erst „Bilder hochladen".
- **Visuell klar getrennt**: „Ihre Bilder" (grauer Streifen) vs. „Von uns" (grüner Streifen).
- **Mail-Inbox**: „Nachricht über…"-Betreffe erkannt, Vor-/Nachname-Split, 🗑 Löschen mit Tombstone.
- **Sammel-ZIP-Import** (Bug behoben).
- **Notizen-Widget**: 30-Tage-Auto-Archivierung, Toggle „Archiv (N)".
- **Termine-Dialog**: VorlagenPicker eingebaut.
- **Kunden-Filter**: doppeldeutigen „Anfragen"-Button entfernt.
- **Sidebar-Crash** behoben (JSX-Reste + React.Fragment ohne Import).

## Pending / Backlog

### P1 (nächste)
- 🟠 **Phase B**: `module_projekte` Datenmasken (`kunde_name`/`adresse`)
- 🟠 **Phase C**: `einsaetze` Datenmasken-Audit
- 🟠 **Auto-Portal-Einladung** nach Mail-Inbox-Accept
- 🟠 **Regression-Test** via `testing_agent_v3_fork` über alle neuen Module

### P2
- 🟡 **Public Contact-API** (Spec liegt bereit unter `/app/memory/PUBLIC_API_SPEC.md`, **alle Klärungen entschieden v1.1**)
  - Multi-Domain-Support (3+ Quellen)
  - Cloudflare Turnstile, Rate-Limit, Honeypot
  - **Push: PWA + Telegram parallel** (Telegram-Bot mit Inline-Buttons: Übernehmen/Spam/Antworten)
  - **Auto-Kunde + Duplikat-Verhalten: pro Key konfigurierbar** (Defaults: Manuell + Stille Aktualisierung)
  - **WICHTIG:** Auch bei stiller Aktualisierung Notification auslösen
  - UTM-Parameter aus URL ins meta-Feld
  - Anhänge-Support in Phase 4 (Foto vom defekten Bauteil)
  - Login-geschützte Doku unter `/api-docs/public`
- 🟡 **Google Drive Backup** Integration (Cascade-Delete-ZIPs in Private Drive)
- 🟡 **Portal-Import-Filter Bug**: nur „Inaktiv" sichtbar beim Import
- 🟡 **Admin-Übersicht Monteur-App** (Desktop-Dashboard für Technikeraktivität)
- 🟡 **IMAP `\Seen`-Flag** setzen nach Accept/Reject
- 🟡 **„Versand-Historie"** im Portal-Detail anzeigen (`email_send_count`, `last_email_sent_at`)

### P3 (Backlog)
- 🟢 **`module_buchhaltung`**: N26-CSV-Import (Drag&Drop), Auto-Kategorisierung, Cashflow-Dashboard, Verknüpfung mit Kunden/Rechnungen
- 🟢 **FritzBox-Anrufliste Sync** (TR-064 API, Variante A): Anrufe als neues Sidebar-Modul, Match mit `module_kunden.phone`, „unbekannt"-Anrufe → direkt neuer Kunde anlegbar. Aufwand ~2h. Voraussetzung: FritzBox-Benutzer mit TR-064-Recht. **WICHTIG: Ralph nach Mobile-Pass aktiv vorschlagen!** (Idee von 04.05.2026)
- 🟢 **Mobile-Pass Phase 2** für weitere Seiten (Mail-Anfragen, Kundendetail expanded, Termine, Aufgaben, Projekte) — in Phase 1 (04.05.2026) erledigt: Feedback-Widget + Kunden-Liste-Karten
- 🟢 Stundenplan-Kontrolle (Monatliche Timesheet-Übersicht)
- 🟢 DATEV-Export
- 🟢 Echte Google Calendar API Sync

## Bekannte Design-Entscheidungen
- Sidebar-Accordion: „Einstellungen" enthält Duplikate, Artikel & Leistungen, Textvorlagen, Handy-Zugang, Wissen & Tipps
- Tombstone-Pattern: gelöschte Mails werden nicht wirklich vergessen, nur ihre `message_id` bleibt in separater Collection `module_mail_inbox_deleted`
- `module_feedback`: global via Floating-Button verfügbar, nicht in Sidebar
- Portale: 2-Spalten-Layout (links Schriftwechsel, rechts sticky Bilder/Dokumente)
- Bildkompression: Browser → 1920px / JPEG 80% (passt zu Server-Default)
- Passwort-Generator: nur eindeutige Zeichen (Helper `gen_portal_password()`)
- **Mail-Inbox Flow (05.05.2026):** Klick auf Karte oder „Öffnen / Prüfen" öffnet `MailDetailModal` → Volltext + erkannte Daten + 3 Aktionen (Übernehmen / Ignorieren / Löschen). Bei „Übernehmen" wird Kunde mit geparsten Daten angelegt und automatisch zum bestehenden **Kunden-Modul** (`?edit={id}`) navigiert — kein Doppel-Formular im Mail-Modul (folgt VISION.md „Datenmasken nicht duplizieren").
- **Mail-Parser-Fix (07.05.2026):** Aktuelles Jimdo-Format `Anrede:` wurde nicht erkannt; behoben in `module_mail_inbox/parser.py`. Regression-Tests: `backend/tests/test_mail_parser.py`.
- **Bug-Fix Kunden-Übernahme (07.05.2026):** Accept-Endpoint schrieb in Feld `anliegen` statt `nachricht` → Datenmaske blieb leer. Fix in `module_mail_inbox/routes.py:422`. Migration `POST /api/module-mail-inbox/migrate-anliegen-to-nachricht?dry_run=…` ausgeliefert; Live am 08.05.2026 mit 20 Migrationen + 6 Aufräumungen ausgeführt.
- **Duplikatsschutz Mail→Kunde (08.05.2026):**
  - **Accept** (`module_mail_inbox/routes.py`): Vor Anlage wird `module_kunden` per E-Mail (case-insensitive) und Telefon (normalisiert über `_normalize_phone`) auf Treffer geprüft. Bei Treffer HTTP 409 mit `{code: 'duplicate_kunde', duplicates:[…]}`. Frontend (`MailAcceptDuplicateDialog`) bietet entweder „Anfrage zuordnen" (`/accept-link/{id}` → kein Doppelkunde, neue Anfrage wird mit Datums-Header an `kunde.nachricht` angehängt, bestehendes wird nicht überschrieben) oder „Trotzdem neu anlegen" (`force_new:true`).
  - **Scan-Schutz Re-Send** (`/scan`): Zusätzlich zur `message_id`-Prüfung wird ein `content_hash` (SHA-256 aus normalisierter E-Mail + Nachricht-Anfang + Telefon) gegen bestehende Inbox-Einträge geprüft. So werden inhaltsgleiche Anfragen mit neuer Message-ID oder über mehrere Postfächer abgefangen. `reevaluate-spam` trägt den Hash auch auf Bestandsmails nach.
  - Tests: `backend/tests/test_mail_duplikat_schutz.py` (6 Cases inkl. Hash-Stabilität, 409-Pfad, force_new, accept-link).
- **Projekt-Anlage mit Auto-Vorschlag aus Anfrage-Text (08.05.2026):**
  - **Backend** `module_textvorlagen`:
    - Schema erweitert um `keywords: list[str]`. Doc-Types ergänzt: `projekt_status`, `projekt_kategorie`, `projekt_bild_kategorie`. Helpers `_normalize_keywords`, `_tokenize_text`, `_count_keyword_hits` (case-insensitive Substring-Match — passt zu deutschen Komposita).
    - Neuer Endpoint `POST /api/modules/textvorlagen/match` mit `{text, doc_type, top_n?}` — liefert beste Vorlage, Kandidaten und `tied`-Flag für Gleichstand. Generisch wiederverwendbar für Aufgaben/Einsätze/etc.
    - Idempotenter Seed `POST /api/modules/textvorlagen/seed-projekt` mit Standard-Kategorien (Schiebetür/Fenster/Haustür/Innentür/Terrassentür/Sonstiges) inkl. branchenüblicher Keywords. Ralph kann Keywords per UI nachpflegen.
  - **Backend** `module_projekte`:
    - Hardcoded `VALID_STATUS` / `VALID_KATEGORIEN` / `VALID_BILD_KATEGORIEN` entfernt — Validierung läuft jetzt dynamisch gegen `module_textvorlagen` (Datenmasken-Regel-Konform). Alte `from-kunde`-Logik bleibt für Rückwärtskompatibilität, neuer POST `/` akzeptiert nun zusätzlich `bilder_uebernehmen` und `notizen`.
  - **Frontend** Textvorlagen-Editor (`TextvorlagenModulPage.jsx`): Neues Tag-Input für Keywords (Chips, Enter/Komma trennt, Backspace im leeren Input entfernt letztes Tag — handy-tauglich). Auswahl-Doc-Types zeigen kein Pflicht-Inhaltsfeld mehr.
  - **Frontend** `ProjektWerkbank.jsx`:
    - Hardcoded `STATUSES` / `KATEGORIEN` / `BILD_KATEGORIEN` ersetzt durch `useTextvorlagen(docType)`-Hook (live aus DB).
    - Statt zwei Buttons („Aus Anfrage anlegen" + „Neues leeres Projekt") jetzt **ein** Button „+ Neues Projekt".
    - Neuer `NewProjektDialog`: ruft beim Öffnen `/match` auf, zeigt grünes Vorschlags-Banner („Vorschlag: Schiebetür · 2 Treffer · erkannte Begriffe …"), bei Gleichstand gelbes Banner mit klickbaren Alternativen. Pre-fill: Adresse vom Kunden, Beschreibung = `kunde.nachricht`, Kategorie aus Match, Titel = Default-Vorschlag aus Vorlage. Bilder-Übernahme als Checkbox (default an wenn Erstprojekt + Kunde hat Photos).
  - Tests: `backend/tests/test_textvorlagen_match.py` (6 Cases). HTTP-Roundtrip mit drei Anliegen-Texten verifiziert (Schiebetür/Fenster/Haustür-Match korrekt).
- **Auto-lernende Titel-Vorlagen + Schnell-Anlage aus Kundenliste (08.05.2026):**
  - Neuer Doc-Type `projekt_titel` in `module_textvorlagen`. Im Projekt-Dialog: Datalist-Autocomplete am Titel-Feld (alle gespeicherten Titel als Vorschlag), zusätzliches Match-Banner für Titel (parallel zur Kategorie). Beim Anlegen wird ein neu eingegebener Titel still als wiederverwendbare Vorlage gespeichert (case-insensitive Duplikat-Check, ≥3 Zeichen). Toast „Titel zur Vorlagenliste hinzugefügt" mit „Rückgängig"-Action (5 Sek).
  - Dialog `NewProjektDialog` wurde aus `ProjektWerkbank.jsx` in eigene Komponente `components/NewProjektDialog.jsx` extrahiert (inkl. `useTextvorlagen`-Hook, exportiert), damit Schnell-Anlage auch direkt aus der Kundenliste möglich ist.
  - **`KundenModulPage.jsx`**: 
    - In jeder Kundenzeile zusätzliches `+`-Icon „Neues Projekt" (öffnet Dialog ohne Werkbank-Umweg). Folder-Icon zeigt Projekt-Anzahl als Badge.
    - In der ausgeklappten Detail-Ansicht zwei Buttons getrennt: grünes „Neues Projekt" + outline „Werkbank (n)".
  - Neuer Backend-Endpoint `GET /api/module-projekte/counts-by-kunde` (Aggregation) für die Badges.
- **Inline-Verwaltung von Auswahllisten (08.05.2026):** Wiederverwendbare Komponente `components/TextvorlagenInlineManager.jsx`. Zeigt ein „⚙ verwalten"-Icon neben einem Auswahl-Feld; Klick öffnet kompaktes Modal mit CRUD-Liste (anlegen / umbenennen / löschen) direkt gegen `module_textvorlagen`. Nach jeder Mutation feuert ein globales `textvorlagen-changed`-Event, alle `useTextvorlagen`-Hooks reloaden automatisch.
  - In `KundenModulPage.jsx` an 4 Stellen eingebaut: Anrede, Kundentyp, Status, Kategorien. Hardcoded `<option>`-Listen für Anrede und Kundentyp entfernt — alle vier Felder beziehen ihre Werte jetzt aus `module_textvorlagen`.
  - Neuer Doc-Type `kunden_typ` + idempotenter Seed `POST /api/modules/textvorlagen/seed-kunden-auswahl` (Standard-Anreden + Standard-Kundentypen).
  - Wiederverwendbar für jeden weiteren `doc_type` (Aufgaben-Kategorie, Reparaturgruppe, Material, Projekt-Status, …) ohne neuen Code.
- **Bug-Fix Projekt-Bilder klickbar (08.05.2026):** Bild-`url` enthält den relativen Storage-Pfad (`module_projekte/<id>/...`); ohne `/api/`-Prefix fing React Router den Pfad ab und zeigte das Dashboard. Lösung:
  - Neuer Auth-pflichtiger Endpoint `GET /api/module-projekte/files/{path:path}` schiebt Bytes aus dem Object-Storage durch (mit Pfad-Whitelist auf `module_projekte/` und Path-Traversal-Schutz).
  - Neue Komponente `components/ProjektBild.jsx`: lädt das Bild als Blob via `axios responseType:"blob"` + `URL.createObjectURL`. Klick öffnet eine schlanke Lightbox (ESC schließt, Body-Scroll-Lock, mobil-tauglich) — kein neuer Tab mehr.
  - Curl-verifiziert: 200 mit Auth, 401 ohne, 400 bei Pfad ausserhalb `module_projekte/`.
- **Bild-Performance: Pipeline + Thumbnails (08.05.2026):**
  - **Upload-Pipeline** in `module_projekte/routes.py`: Pillow + pillow_heif. Original auf max. 2400 px Längskante & JPEG-Q85 (HEIC → JPEG), Thumbnail 400 px JPEG-Q80. Beide werden im Storage abgelegt (`<file>.ext` und `<file>.ext.thumb.jpg`), `bild.thumb_url` neu im Subdokument.
  - **Frontend** `ProjektBild.jsx`: Galerie-Tile lädt `thumb_url` (~18 KB statt 3 MB), Lightbox lädt das Original lazy beim Klick mit „Lade Original…"-Spinner. Fallback auf `url` wenn `thumb_url` fehlt (Altbestand).
  - **Migration** `POST /api/module-projekte/migrate-thumbnails?dry_run=…&limit=…`: erzeugt für Bestandsbilder Thumbnails nach. Originals werden nicht angefasst. Auf Preview erfolgreich getestet (2 Bilder, 3.4 MB → 18 KB Thumbnails). **Auf Live am 08.05.2026 ausgeführt: 30/30 Bilder migriert.**
  - Bekannter Bug im Migrate-Endpoint: bei kleinem `limit` (z. B. 10) findet er irrtümlich 0 Kandidaten — Workaround `limit=999`. Fix folgt.
  - Files-Endpoint Whitelist: erweitert um `module_kunden/`, da aus Anfragen übernommene Bilder dort liegen (kein Storage-Duplikat beim Übernehmen, nur Referenz). Auth-Pflicht bleibt.

## 🧹 Refactoring R1–R5 (15.05.2026) — Dead Code & Modul-Hygiene

Externer Code-Review (Claude AI auf ZIP-Snapshot) hat 5 strukturelle Schwachstellen identifiziert. Ralph hat exakte Diffs geliefert, Agent hat 1:1 umgesetzt (kein Re-Interpret):

- **R1 — Portal-Versionen archiviert:**
  - Backend-Imports + `include_router` für `portal_v2/v3/v4` aus `server.py` entfernt
  - Frontend: 12 Imports + 9 öffentliche Routes + 6 Admin-Routes + 3 Nav-Einträge entfernt
  - Ordner verschoben nach `backend/_archiv/portal_v[234]/` und `frontend/src/_archiv/portal_v[234]/`
  - Test-Datei `backend/tests/test_portal_v4.py` gelöscht (Test für toten Code)
  - `module_portal_v2_backup/` bleibt aktiv (täglicher Backup-Service)
- **R2 — SettingsPage.jsx aufgeteilt: 2841 → 153 Zeilen (-95 %)**
  - 8 produktive Tab-Dateien in `frontend/src/pages/settings/`: FirmendatenTab, KalkulationTab, EmailTab (inkl. 5 Helper), BenutzerTab, DokumentVorlagenTab, DiversesTab (inkl. 4 Helper), BackupTab, ModuleTab
  - **Bug-Fix**: `BackupTab` war als nested function innerhalb `SettingsPage` definiert (React-Anti-Pattern → Re-Render-Cost). Jetzt top-level extrahiert.
  - **Toter Code entdeckt**: `TextbausteineTab`, `EinsatzplanungTab`, `ModuleTab` waren definiert aber nie im TABS-Switch gerendert. `ModuleTab` aktiv als neuer Settings-Tab eingebunden (zeigt Backend-Modul-Registry). Die anderen 2 nach `frontend/src/_archiv/settings/` verschoben.
- **R3 — `module_mail_inbox/routes.py` aufgeteilt: 1354 → 5 Sub-Router**
  - `helpers.py` (150 Z.): _content_hash, _decode, _is_ascii, _build_imap_search_args, _normalize_phone, _find_kunde_duplicates, _tombstone + IMAP-Konstanten
  - `routes_scan.py` (542 Z.): /scan, /scan-preview, /import-mail
  - `routes_list.py` (267 Z.): /list, /stats, /mail-detail, /customer-mails
  - `routes_actions.py` (206 Z.): /accept, /accept-link, /reject, /reject-all-spam, /abschliessen
  - `routes_delete.py` (120 Z.): /preview-delete, /preview-bulk-delete, /delete-all-spam, DELETE /{id}
  - `routes_admin.py` (110 Z.): /reevaluate-spam, /migrate-anliegen-to-nachricht
  - `__init__.py` bindet alle 5 Sub-Router + accounts-Router ein.
- **R4 — Routing-Übersicht dokumentiert:** Kommentar-Block in `backend/server.py` erklärt, dass `module_*/` für eigenständige Module ist, `routes/` für Querschnitts-Dienste (auth, settings, backup, email, imap, pdf, push, …). Kein Code-Change, nur Doku.
- **R5 — `_legacy_backup/` archiviert:** 11 alte Page-Dateien (7797 Zeilen, null Imports von außen) verschoben nach `frontend/src/_archiv/legacy_pages/`. Einheitliches Prinzip: nichts wird hart gelöscht, alles ist rückholbar.

### Verifikation (alle grün)
- ✅ Backend startet ohne ImportError; Lint sauber
- ✅ Frontend lädt Login/Dashboard/Settings/Mail-Inbox; ESLint clean
- ✅ Mail-Inbox-Sub-Router-Smoke: /list 200, /stats 200, /scan-preview 200, /reevaluate-spam 200, /accounts 200
- ✅ Module-Tab im Settings lädt Backend-Registry (6 Module)
- ✅ Backup-Tab (top-level) lädt 20 Portal-v2-Sicherungen

### Backups
- `/tmp/SettingsPage.jsx.backup` (2841 Z.) und `/tmp/mail_inbox_routes.py.backup` (1354 Z.) für Diff-Vergleich gegen Ralph's ZIP.

## 🛡️ Backup-Hygiene & Datenmasken-Refactor B1+B2 (15.05.2026)

Externer Code-Review hat Lücken in Backup-Collections-Liste und Daten-Duplizierung in `module_projekte`/`module_einsaetze` aufgezeigt. Ralph hat exakte Diffs geliefert (`emergent_backup_und_datenmasken.md`), Agent hat 1:1 umgesetzt mit Spec-Lücken-Korrektur.

### B1 — Backup-Listen aktualisiert (`backend/routes/backup.py` + `backend/routes/auto_backup.py`)
- `collections`-Liste: 53 → **61 Einträge**, 13 Gruppen (kern, portal, einsaetze, projekte, aufgaben, termine, mail, dokumente, buchhaltung, system, monteur, portal_backup, legacy).
- `auto_backup.selected`: ~50 → **54 Collections**. Tote Portal-v2/v3/v4-Collections raus, neue Kern-Module rein (module_aufgaben_settings, module_termine_settings, module_feedback_history, einsatz_config, buchhaltung_config, module_kundenlink, etc.).
- Verifikation: `GET /api/backup/collections` → 61 Items; `POST /backup/auto/trigger` → **861 Dokumente, 23 MB ZIP**, Mail erfolgreich.

### B2.1 — `module_projekte` Datenmasken (4 Code-Stellen + DB-Migration)
- **Code (`backend/module_projekte/routes.py`)**:
  - `create_projekt` (POST /): `kunde_name` raus aus Insert, im Response per Helper angehängt
  - `list_projekte` (GET /): Bulk-`$in`-Join auf `module_kunden` (kein N+1) — einzelner DB-Call für alle Kundennamen
  - `get_projekt` (GET /{id}): `_kunde_display`-Helper per `find_one` ergänzt
  - `create_from_kunde` (POST /from-kunde): identisch zu `create_projekt`
- **Snapshot**: `/tmp/module_projekte_backup_20260516_073533.json` (4 Projekte)
- **DB-Migration**: `update_many({}, {"$unset": {"kunde_name": ""}})` → 4/4 Projekte bereinigt
- **Live-Update-Test bestanden**: Kundenname in DB temporär geändert → Projekt-API zeigt sofort neuen Namen → reset → API zeigt Original

### B2.2 — `module_einsaetze` Datenmasken (10 Code-Stellen + DB-Migration)
Spec sagte nur „PDF/ICS/Email brauchen keinen Eingriff" — Agent hat verifiziert, dass das **nicht stimmt** (PDF-Generator nutzt direkt `einsatz['kunde_name']`), Spec-Lücke an Ralph gemeldet, Option a) gewählt → vollständig durchgezogen.
- **Code (`backend/module_einsaetze/routes.py`)**:
  - Neuer Helper `_enrich_einsatz_mit_kunde(einsatz)` (vollständige Live-Anreicherung: kunde_name, kunde_email, kunde_telefon, kunde_adresse)
  - `POST /einsaetze` (Standard-Create): 4 Felder raus aus Insert
  - `POST /einsaetze/from-kontakt/{id}`: 4 Felder raus + **`kunde_id=kontakt_id` ergänzt** (war im Original-Code gar nicht gesetzt → Datenmaske hätte sonst nicht greifen können — sinnvolle Korrektur des Bestands-Bugs)
  - `POST /einsaetze/from-kunde/{id}`: 4 Felder raus, Response live anreichern
  - `GET /einsaetze` (list): Bulk-`$in`-Join (N+1-frei)
  - `GET /einsaetze/{id}` (detail): `_enrich` aufgerufen
  - `POST /einsaetze/{id}/email`: `_enrich` aufgerufen, `customer_name` → `kunde_name` korrigiert
  - `GET /einsaetze/{id}/ics`: `_enrich` aufgerufen, `_generate_ics` nutzt `kunde_name`
  - `GET /einsaetze/{id}/reparaturauftrag-pdf`: `_enrich` aufgerufen (nur wenn nicht blanko)
- **Snapshot**: `/tmp/einsaetze_backup_20260516_074455.json` (2 Einsätze)
- **DB-Migration**: 4 Felder aus 2 Einsätzen entfernt
- **Verifikation (alle drei Spec-Tests grün)**:
  - PDF-Filename: `Reparaturauftrag_Graupner_Thorsten/Digger.pdf` (vorher: `Reparaturauftrag_Kunde.pdf`)
  - PDF-Inhalt: Name „Graupner", Adresse „Schmiedekoppel/Hamburg", Telefon „01705650539" alle korrekt eingedruckt
  - Neuer Einsatz via `from-kunde` POST → DB-Check: nur `kunde_id`, keine kunde_*-Felder dupliziert


