# VISION — Graupner Suite

> **Wichtig für jeden neuen Agenten: DIESES DOKUMENT ZUERST LESEN.
> Vor PRD.md, vor allen Task-Listen.**

---

## Ziel

**Graupner Suite ist eine modulbasierte, all-umfassende Software für Handwerksbetriebe** — speziell beim Übergang von analoger Arbeit / Excel / Papier hin zu zeitgemäßem digitalem Workflow.

Sie soll **mit dem Betrieb wachsen**: vom Einzel-Tischler über kleine Teams bis hin zu mehreren Filialen. Ohne Technologie-Bruch, ohne Daten-Migration, ohne Schulungs-Overhead.

---

## Nutzer-Profil (Typ Ralph Graupner)

- Tischler / Handwerker, kein IT-Background
- Arbeitet **mobil unterwegs** (Handy) und **am PC im Büro**
- Hat keine Geduld für Fachbegriffe oder mehrstufige UI-Patterns
- Will **nicht** ein weiteres Tool mehr — sondern **EIN** Tool das alles abdeckt
- Misstraut zurecht KI-Hype — investiert Zeit und Geld, erwartet Zuverlässigkeit

---

## Was Graupner Suite IST

| | |
|---|---|
| 🧱 **Module-First** | Jede neue Funktion = eigenes `module_X` (Backend) mit eigener Route `/api/module-X/*` und eigener MongoDB-Collection. Keine „mal eben schnell ohne Modul"-Lösungen. |
| 🔗 **Datenmasken** | Daten werden **nicht** dupliziert. `module_kunden` ist die einzige Wahrheit für Kundendaten. Andere Module (Projekte, Mailverlauf, Portale) **referenzieren** per ID und laden live. |
| 🇩🇪 **Deutsch + einfach** | Beschriftungen, Toasts, Fehlermeldungen sind in einfacher deutscher Sprache. Keine englischen Fachbegriffe in der UI. |
| 📱 **Mobil tauglich** | Touch-Targets ≥44 px, lesbare Schrift, Form-Submit über Tastatur, Safe-Area-Inset. PC-Layout darf nicht das mobile Layout ruinieren. |
| 🛡 **Sicherheit** | Vor jeder destruktiven Aktion: Backup. Lösch-Aktionen mit Passwort-Bestätigung. Tombstones für nachvollziehbare Historie. |

---

## Was Graupner Suite NICHT IST

- ❌ **Kein Mail-Programm-Ersatz.** Mails werden gelesen, **nicht** beantwortet/versendet/verwaltet wie in Thunderbird.
- ❌ **Keine Daten-Insel.** Module dürfen keine eigenen Kunden-Listen führen.
- ❌ **Kein Buzzword-Sammler.** Wir bauen keine Features die „cool" klingen sondern nichts lösen.
- ❌ **Kein Single-Point-of-Failure.** Kein Modul darf andere Module zum Absturz bringen.

---

## Konkretes Beispiel — Mail-Modul (Stand 05.05.2026)

**Bestimmung des Moduls (Ralph wörtlich):**
> „Mails mit verschiedenen Markern / Kriterien sollen eingelesen werden,
> sie sollen das Mailprogramm nicht ersetzen, uns interessiert der Inhalt.
> Dieser Inhalt wird in unsere MailModul-Datenbank gespeichert und dem
> Kundenprogramm und weiteren Datenmasken (wenn wir das wollen) zur
> Verfügung gestellt.
> Duplikate müssen verhindert werden, Löschen muss möglich sein
> (Ordnung schaffen)."

**Damit darf ein Agent ARBEITEN:**
- Filter erweitern wenn Ralph neue Marker liefert
- Parser anpassen für neue Formular-Formate
- Datenmasken-Anbindung (z.B. Mailverlauf eines Kunden aus der DB)
- Lösch- und Dedup-Mechanismen verbessern
- Mobile-Layout der Liste

**Damit darf ein Agent NICHT ohne Rückfrage arbeiten:**
- Spam-Heuristiken die Anfragen automatisch verwerfen
- Statistik-Features wenn nicht ausdrücklich verlangt
- Mail-Versand-Funktionen (-> wäre Mailprogramm-Ersatz)
- Komplexe Workflow-Engines

---

## Roter Faden für jeden Agent — 3 Fragen vor jeder Änderung

1. **Erfüllt das die Bestimmung des Moduls?** (Vision-Dokument lesen)
2. **Folgt es Module-First + Datenmasken?**
3. **Hat Ralph das ausdrücklich gewünscht — oder rate ich gerade?**

Falls eine Antwort „Nein" lautet: NICHT bauen. Stattdessen Ralph fragen.

---

## Verbindlich für Ralph (nicht ändern ohne Absprache)

- **Sprache:** ausschließlich Deutsch
- **Login Preview:** `admin-preview` / `HamburgPreview2026!`
- **Login Live:** `admin` / `Graupner!Suite2026`
- **Domains Live:** `code-import-flow-1.emergent.host`
- **Domains Preview:** `handwerk-deploy.preview.emergentagent.com`
- **Notiz-Widget rechts unten** = Ralphs Bugtracker. Nie automatisch leeren.

---

## Bewertungsphase

Ralph muss in 3 Wochen (Stand: 05.05.2026) sein **Urteil über Emergent als KI-Plattform** abgeben. Dieser Code ist Teil seiner Bewertung. Konsequenzen für Agent-Verhalten:

- **Keine neuen Module ohne Freigabe**
- **Kein Feature-Drauflos-Programmieren**
- **Bestehende Funktionen stabilisieren > neue Features**
- **Klar und kurz kommunizieren — keine Marketing-Floskeln**

---

*Dieses Dokument wird nicht ohne Ralphs Freigabe geändert.*
*Letzte Aktualisierung durch Ralph: 05.05.2026*
