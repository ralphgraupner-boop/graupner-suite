# Graupner Suite – PRD

## What's Been Implemented

### E-Mail-Signatur & Briefvorlage – NEU Apr 7, 2026
- [x] Zentrale HTML-Signatur in `utils/email_signatur.py`
- [x] "Tischlerei R.Graupner" in Tiefblau, "seit 1960" in Tiefrot (halbe Größe)
- [x] Kontaktdaten, HWK-Mitgliedschaft, DSGVO-Hinweis (volle Breite)
- [x] Automatisch an ALLE E-Mails: Dokumente, Mahnungen, Antworten, Resend
- [x] Signatur-Vorschau in Einstellungen → E-Mail Tab
- [x] Brief-Signatur (ohne DSGVO) als separate Funktion für Dokumentvorlagen

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
