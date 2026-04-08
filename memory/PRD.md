# Graupner Suite – PRD

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business (Tischlerei R.Graupner). Features: customer management, unified article/service database, Anfragen inbox, WYSIWYG 3-column document editor, E-Mail Posteingang/Versand, Buchhaltung, RBAC, and Mitarbeiter-Datenbank.

## What's Been Implemented

### Mitarbeiter-Datenbank (Employee Database) – NEU Apr 7, 2026
- [x] Vollständige CRUD-Verwaltung für Mitarbeiter
- [x] Stammdaten: Name, Adresse, Telefon, E-Mail, Geburtsdatum, Personalnr, Position, Steuer-ID, SV-Nr, Krankenkasse, Steuerklasse, Kinderfreibeträge, Notfallkontakt
- [x] Lohn & Gehalt: Stundenlohn/Monatsgehalt, VWL, Lohnhistorie mit Änderungsprotokoll
- [x] Urlaub: Anspruch, Einträge (Erholungsurlaub, Sonderurlaub, unbezahlt), Arbeitstageberechnung, Status (beantragt/genehmigt/genommen/abgelehnt)
- [x] Krankmeldungen: Zeitraum, AU-Bescheinigung, Arzt, Arbeitstage
- [x] Dokumente: Upload via Object Storage (Arbeitsvertrag, Zeugnis, Bescheinigung, etc.)
- [x] Drag & Drop Upload für alle 5 Dokument-Kategorien (Apr 8, 2026)
- [x] Fortbildungen: Bezeichnung, Anbieter, Kosten, Zertifikat
- [x] KPI-Dashboard: Resturlaub, Urlaub genommen, Kranktage, aktueller Lohn
- [x] Abwesenheitskalender-API für alle Mitarbeiter
- [x] Zugriff für Admin und Buchhaltung-Rolle

### Lexware Import – NEU Apr 8, 2026
- [x] ZIP-Upload mit Drag & Drop oder Dateiauswahl
- [x] PDF-Parser erkennt automatisch: Name, Adresse, Geburtsdatum, Steuer-ID, SV-Nr, Krankenkasse, Steuerklasse, Konfession, Personengruppe, IBAN, Bank, Gehalt/Stundenlohn, Urlaub-Rest, Kinderfreibeträge
- [x] Vorschau: Zeigt erkannte Daten + ob Mitarbeiter aktualisiert oder neu angelegt wird
- [x] Import: Aktualisiert bestehende Stammdaten, legt neue Mitarbeiter an, speichert PDFs als Dokumente (Kategorie: Verdienstbescheinigung), erstellt Lohnhistorie-Einträge
- [x] Zuordnung über Vorname + Nachname

### Berechtigungssystem (Permissions) – NEU Apr 8, 2026
- [x] Granulare Berechtigungen pro Benutzer für 7 Mitarbeiter-Bereiche
- [x] Bereiche: Stammdaten, Lohn & Gehalt, Urlaub, Krankmeldungen, Dokumente, Fortbildungen, Anlegen/Löschen
- [x] Admin hat immer Vollzugriff (hardcoded)
- [x] Buchhaltung-Rolle: Standard alle Bereiche außer Anlegen/Löschen
- [x] Einstellungen -> Benutzer -> "Rechte"-Button öffnet Berechtigungs-Modal
- [x] Frontend blendet Buttons aus wenn Berechtigung fehlt (Neuer Mitarbeiter, Löschen)
- [x] Backend prüft Berechtigungen bei jedem Schreibzugriff

### Passwort-Management – NEU Apr 7, 2026
- [x] Zufallspasswort generieren
- [x] Passwort sichtbar anzeigen (Toggle)
- [x] Passwort in Zwischenablage kopieren
- [x] Zugangsdaten per E-Mail an Mitarbeiter senden

### E-Mail-Signatur & Briefvorlage – Apr 7, 2026
- [x] Zentrale HTML-Signatur in `utils/email_signatur.py`
- [x] "Tischlerei R.Graupner" in Tiefblau, "seit 1960" in Tiefrot
- [x] Kontaktdaten, HWK-Mitgliedschaft, DSGVO-Hinweis (volle Breite)
- [x] Automatisch an ALLE E-Mails angehängt
- [x] Signatur-Vorschau in Einstellungen

### Rollensystem (RBAC)
- [x] Rolle "buchhaltung" für Heike Bolanka (eingeschränkter Zugang)

### Buchhaltung (Accounting) – Lexoffice-ähnlich
- [x] 6 Tabs, Belegnummern, Plausibilitätsprüfung, Kassenbuch, CSV-Export, Beleg-Upload, Hilfe-Overlay

### E-Mail, Anfragen, WYSIWYG Editor, Kunden, Rechnungen, Mahnwesen, Einsatzplanung
- [x] Voll funktionsfähig

---

## Prioritized Backlog
- (P1) N26 Bank CSV-Import, Landing Page IONOS FTP
- (P2) Windows Desktop App (Electron)
- (P3) Refactoring, DATEV-Export, Lexoffice-Anbindung

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), SMTP/IMAP, Emergent Object Storage

## Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── mitarbeiter.py        # Employee CRUD + Urlaub/Krank/Lohn/Docs/Fortbildungen
│   │   ├── buchhaltung.py        # Accounting
│   │   ├── email.py              # Email dispatch + signatures
│   │   ├── auth.py               # Auth + User management + send-credentials
│   ├── utils/
│   │   ├── email_signatur.py     # Corporate email signature
│   │   ├── storage.py            # Object storage
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── MitarbeiterPage.jsx  # Employee database UI
│   │   │   ├── BuchhaltungPage.jsx  # Accounting
│   │   │   ├── SettingsPage.jsx     # Settings + Password management
```
