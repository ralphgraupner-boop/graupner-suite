# Graupner Suite – PRD (Product Requirements Document)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business (Tischlerei Graupner).

## User Personas
- **Primary**: Ralph Graupner (Business owner, carpenter, 50+ years experience) — absolute Datenkontrolle, einfache Bedienung.

---

## What's Been Implemented

### Buchhaltung (Accounting Module) – Lexoffice-ähnlich
- [x] 6 Tabs: Übersicht, Buchungen, Kassenbuch, Offene Posten, Monatsabschluss, USt/MwSt
- [x] Buchungen CRUD: Einnahmen & Ausgaben, rückstandslos löschbar
- [x] Fortlaufende Belegnummern (B-YYYY-NNNN)
- [x] Plausibilitätsprüfung (Duplikate, Betragsvalidierung, fehlende Kategorien, Zukunftsdaten)
- [x] Kassenbuch (chronologisch mit laufendem Saldo)
- [x] Monatsabschluss (Jahresnavigation, monatliche Zusammenfassung)
- [x] CSV-Export (Semikolon, deutsches Zahlenformat, Belege-Spalte)
- [x] Hilfe-Overlay (Bedienungsanleitung, 11 Akkordeon-Abschnitte)
- [x] **Beleg-Upload**: Mehrere Dateien pro Buchung (JPG, PNG, PDF, Word, Excel, etc.) *(Apr 7, 2026)*
- [x] Belege herunterladen & rückstandslos löschen
- [x] Offene Posten, Zahlungseingang, USt/MwSt-Übersicht

### E-Mail Module
- [x] IMAP Posteingang, Versandprotokoll (Löschen, Bearbeiten, Adresse prüfen)

### Anfragen
- [x] 4-Stufen Status: Ungelesen → Gelesen → Zu bearbeiten → Erledigt

### Document Editor, Kunden, Rechnungen, Mahnwesen, Einsatzplanung
- [x] Voll funktionsfähig (siehe vorherige PRD-Versionen)

---

## Prioritized Backlog
- (P1) N26 Bank CSV-Import → automatischer Abgleich
- (P1) Landing Page IONOS FTP Upload
- (P2) Windows Desktop App (Electron)
- (P3) Refactoring (SettingsPage, WysiwygDocumentEditor)
- (P3) DATEV-Export, Lexoffice-Anbindung

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- SMTP/IMAP Email (User Credentials)
- Emergent Object Storage (Beleg-Upload)
