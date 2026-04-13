# Graupner Suite - Zugangsdaten & Links
## Tischlerei R. Graupner

**Stand:** Dezember 2025

---

## 🌐 Deployment-URL (24/7 Online)

### **Hauptzugang:**
```
https://code-import-flow-1.emergent.host
```

**Status:** ✅ Live & Deployed  
**Verfügbarkeit:** 24/7 online  
**Kosten:** 50 Credits/Monat (~$10)

---

## 🔐 Login-Daten

### **Admin-Zugang (Option 1):**
- **Benutzername:** `admin`
- **Passwort:** `Graupner!Suite2026`

### **Admin-Zugang (Option 2):**
- **E-Mail:** `service24@tischlerei-graupner.de`
- **Passwort:** `Service.24`

---

## 📍 Wichtige Bereiche - Direkt-Links

| Bereich | URL |
|---------|-----|
| **Login / Start** | https://code-import-flow-1.emergent.host |
| **Dashboard** | https://code-import-flow-1.emergent.host/dashboard |
| **Anfragen** | https://code-import-flow-1.emergent.host/anfragen |
| **Kunden** | https://code-import-flow-1.emergent.host/kunden |
| **Angebote** | https://code-import-flow-1.emergent.host/angebote |
| **Aufträge** | https://code-import-flow-1.emergent.host/auftraege |
| **Rechnungen** | https://code-import-flow-1.emergent.host/rechnungen |
| **Buchhaltung** | https://code-import-flow-1.emergent.host/buchhaltung |
| **Mitarbeiter** | https://code-import-flow-1.emergent.host/mitarbeiter |
| **E-Mail** | https://code-import-flow-1.emergent.host/email |
| **Einsatzplanung** | https://code-import-flow-1.emergent.host/einsatzplanung |
| **Einstellungen** | https://code-import-flow-1.emergent.host/einstellungen |

---

## 📧 Öffentliches Kontaktformular

### **IONOS-Subdomain (für Kunden):**
```
https://anfrage.schiebetür-reparatur-hamburg.de
```

**Funktionen:**
- ✅ 4-Schritt Wizard
- ✅ Drag & Drop Bild-Upload (bis zu 10 Bilder)
- ✅ Automatische Speicherung in Graupner Suite
- ✅ E-Mail-Benachrichtigung mit Bild-Anhängen

**Verbindung:**
- Formular → sendet Daten an → Graupner Suite Backend
- Daten erscheinen automatisch unter "Anfragen"

---

## 🔧 System-Architektur

### **Frontend:**
- React + TailwindCSS
- PWA (Progressive Web App)
- Responsive Design (Mobile & Desktop)

### **Backend:**
- FastAPI (Python)
- MongoDB Datenbank
- Object Storage für Bilder

### **Deployment:**
- Emergent Managed Infrastructure
- Automatische Backups
- SSL/HTTPS gesichert

---

## 📊 Funktionsübersicht

### **Kundenverwaltung:**
- Kunden anlegen, bearbeiten, löschen
- Kategorien: Privat, Vermieter, Hausverwaltung, Mieter
- VCF-Import für Kontakte
- Adressverwaltung

### **Anfragen:**
- Eingehende Anfragen vom Kontaktformular
- Kategorien: Schiebetür, Fenster, Innentür, Eingangstür, Sonstige
- Bild-Anhänge pro Anfrage
- Umwandlung in Kunden/Angebote

### **Angebote & Aufträge:**
- Angebotserstellung
- Artikel & Leistungsblöcke
- Kalkulation
- Status-Tracking

### **Rechnungen:**
- Rechnungserstellung
- PDF-Export
- Zahlungsstatus
- Mahnwesen

### **Buchhaltung:**
- Buchungserfassung
- Kassenbuch
- Offene Posten
- USt/MwSt-Übersicht
- Monatsabschluss

### **Mitarbeiter:**
- Mitarbeiterverwaltung
- Lexware-Import
- Zeiterfassung
- Einsatzplanung

### **E-Mail:**
- Posteingang (IMAP-Integration)
- Versandprotokoll
- E-Mail-Vorlagen

### **Backup & Restore:**
- Vollständiger Daten-Export (JSON)
- Import/Restore-Funktion
- Mobile Navigation mit Backup-Prompt

---

## 🔔 E-Mail-Benachrichtigungen

**Admin-E-Mail:** `service24@tischlerei-graupner.de`

**Benachrichtigungen bei:**
- ✅ Neue Anfrage vom Kontaktformular (mit Bild-Anhängen)
- ✅ Push-Benachrichtigungen in der App

---

## 💾 Backup

### **Manuelles Backup:**
1. Einstellungen → Backup
2. "Daten exportieren" klicken
3. JSON-Datei wird heruntergeladen

### **Restore:**
1. Einstellungen → Backup
2. "Daten importieren" klicken
3. JSON-Datei auswählen

---

## 📱 Mobile Navigation

**Besonderheit:**
- Beim Logout auf Mobile: Backup-Prompt erscheint
- Sicherstellung, dass Daten gesichert sind

---

## 🔒 Sicherheit

- ✅ JWT-basierte Authentifizierung
- ✅ Passwort-Hashing (bcrypt)
- ✅ HTTPS/SSL verschlüsselt
- ✅ CORS-Schutz konfiguriert
- ✅ Session-Management

---

## 📞 Support & Kontakt

**Bei technischen Fragen:**
- Emergent Support über Chat
- Oder direkt im Emergent Dashboard

**Tischlerei R. Graupner:**
- **Telefon:** 040 555 677 44
- **E-Mail:** service24@tischlerei-graupner.de
- **Website:** www.tischlerei-graupner.de

---

## 📝 Wichtige Hinweise

1. **Login-Daten sicher aufbewahren**
2. **Regelmäßige Backups erstellen** (empfohlen: wöchentlich)
3. **Deployment-URL nicht öffentlich teilen** (nur für interne Nutzung)
4. **Kontaktformular-URL für Kunden:** `anfrage.schiebetür-reparatur-hamburg.de`

---

**Erstellt am:** Dezember 2025  
**Für:** Tischlerei R. Graupner  
**Projekt:** Graupner Suite - Handwerker Management Software
