# Graupner Suite – PRD

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for Tischlerei Graupner.

---

## What's Been Implemented

### Rollensystem (RBAC) – NEU Apr 7, 2026
- [x] **Rolle "buchhaltung"**: Eingeschränkter Zugang für Buchhalterin
- [x] Navigation nach Rolle gefiltert
- [x] Rechnungen, Aufträge, Kunden: nur lesen + PDF (kein Bearbeiten/Löschen)
- [x] Buchhaltung: Vollzugriff
- [x] Mahnwesen: sichtbar
- [x] Rollen-Badge in Sidebar
- [x] User: Heike Bolanka (h.bolanka)

### Buchhaltung (Accounting) – Lexoffice-ähnlich
- [x] 6 Tabs: Übersicht, Buchungen, Kassenbuch, Offene Posten, Monatsabschluss, USt/MwSt
- [x] Belegnummern (B-YYYY-NNNN), Plausibilitätsprüfung, CSV-Export
- [x] **Beleg-Upload**: Mehrere Dateien pro Buchung (alle gängigen Formate)
- [x] Hilfe-Overlay (Bedienungsanleitung, 11 Abschnitte)
- [x] Offene Posten, Zahlungseingang, Kassenbuch mit laufendem Saldo

### E-Mail, Anfragen, WYSIWYG Editor, Kunden, Rechnungen, Mahnwesen, Einsatzplanung
- [x] Voll funktionsfähig (siehe CHANGELOG)

---

## Prioritized Backlog
- (P1) N26 Bank CSV-Import
- (P1) Landing Page IONOS FTP Upload
- (P2) Windows Desktop App (Electron)
- (P3) Refactoring, DATEV-Export, Lexoffice-Anbindung

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- SMTP/IMAP Email (User Credentials)
- Emergent Object Storage (Beleg-Upload)
