# 📋 SCHLACHTPLAN — `module_personal` (Strangler-Migration)

> Erstellt: 01.06.2026, 17:12 Hamburger Zeit
> Status: **WARTET AUF RALPHS JA**
> Geschätzter Aufwand: 1 Arbeitstag (Vormittag Plan, Nachmittag Bau, Abend Test)

---

## 🎯 Ziel in einem Satz

**Eine** saubere Personalakte (Login + Stammdaten + Berechtigungen + Lohn + Urlaub)
statt zwei getrennter Schubladen (`db.users` ↔ `db.mitarbeiter`), die wir
heute mit einer Brücke (Username) verbinden müssen.

---

## 🧱 Ist-Zustand (Stand 01.06.2026)

### Zwei Schubladen, nicht verbunden

| Schublade | Wo? | Was drin? | Verwaltet von |
|---|---|---|---|
| `db.users` | `routes/auth.py` (alt) | username, password (bcrypt), email, role, berechtigungen, name | Login/Auth |
| `db.mitarbeiter` | `routes/mitarbeiter.py` (alt) | id, vorname, nachname, email, telefon, position, lohn, urlaub, dokumente | Personalverwaltung |

### Konkrete Doppelung (Stand heute, Preview)

| Person | `db.users.username` | `db.users.email` | `db.mitarbeiter.id` | `db.mitarbeiter` Tippfehler |
|---|---|---|---|---|
| Ralph | `admin` | Ralph.graupner@gmail.com | 023818d3 | „Ralph Graupner" ✅ |
| Ralph (Preview) | `admin-preview` | preview@... | (nicht in mitarbeiter) | — |
| Thorsten | `thorsten.graupner` | hhgraupner@gmail.com | 9074af48 | **„Thorsteb Graupner"** ❌ |
| Thorsten (2. Login) | `Tg-Admin` | hhgraupner@gmail.com | (gleicher Mitarbeiter?) | — |
| Heike | `h.bolanka` (buchhaltung) | h.bolanka@tischlerei-graupner | 5754c135 | „Heike Bolanka" ✅ |
| Heike (2. Login) | `Heike Bolanka` (mitarbeiter) | HeikeBolanca@gmail.com | (gleicher Mitarbeiter? andere Mail?) | — |
| ???  | (kein Login) | — | ef9045e9 | „neu erarbeiter1" (Test-Eintrag?) |

→ **Wir haben Doppel-Logins, Tippfehler und Inkonsistenzen.** Eine saubere Migration räumt das auf.

---

## 🏗️ Soll-Zustand: `module_personal`

### Collection: `db.module_personal`

```
{
  "id": "uuid",
  "username": "thorsten.graupner",      ← Login-Name (eindeutig)
  "password_hash": "bcrypt-hash",       ← aus db.users
  "vorname": "Thorsten",                ← Tippfehler korrigiert
  "nachname": "Graupner",
  "email": "hhgraupner@gmail.com",
  "anrede": "Herr",
  "role": "admin",
  "berechtigungen": { … },              ← aus db.users (Modul-Zugriffe)
  "personalnummer": "P-001",
  "telefon": "...",
  "strasse": "...", "plz": "...", "ort": "...",
  "position": "Geschäftsführer",
  "status": "aktiv",                    ← aktiv | inaktiv | ausgeschieden
  "eintrittsdatum": "...", "austrittsdatum": "",
  "lohn": { lohnart, stundenlohn, monatsgehalt, vwl_betrag, vwl_ag_anteil },
  "steuer": { steuer_id, sv_nummer, krankenkasse, steuerklasse, ... },
  "urlaub": { anspruch_tage: 30 },      ← restliche Urlaubsdaten bleiben in db.mitarbeiter_urlaub
  "fuehrerschein": "...",
  "notfallkontakt": { name, telefon, beziehung },
  "iban": "...", "bank": "...",
  "foto_url": "...",
  "bemerkungen": "...",
  "erhaelt_kalender_mails": true,       ← NEU: Flag für ICS-Versand
  "erhaelt_app_benachrichtigungen": true,← NEU: Flag für Push
  "created_at": "...", "updated_at": "..."
}
```

### Endpoints (Routes/Schicht-Struktur)

```
backend/module_personal/
├── __init__.py
├── routes.py          ← CRUD + Login-Routes
├── models.py          ← PersonalCreate, PersonalUpdate (Optional + exclude_unset)
└── migration.py       ← Trockenlauf + Apply (s.u.)

Endpoints (alle unter prefix /api/module-personal):
  POST   /auth/login              ← ersetzt /api/auth/login
  POST   /auth/register           ← Admin-only
  GET    /                        ← alle Mitarbeiter (mit Filter ?status=aktiv)
  GET    /{username}              ← einzelner Datensatz
  POST   /                        ← neu anlegen (Admin)
  PUT    /{username}              ← partielles Update (exclude_unset)
  DELETE /{username}              ← Soft-Delete (status=inaktiv)
  PUT    /{username}/password     ← Passwort ändern
  PUT    /{username}/berechtigungen ← Berechtigungen anpassen
  POST   /migrate/dry-run         ← Trockenlauf zeigt Vorschlag
  POST   /migrate/apply           ← Migration ausführen (nach Trockenlauf)
```

---

## 🔄 Migrations-Strategie (Strangler-Pattern)

### Phase 1 — Bau (~2h)
- `module_personal/` anlegen (Vorlage: `module_kunden`)
- Schema + Endpoints + Pydantic-Models
- **Keine** Daten anrühren — alte Collections bleiben
- Pytest: Create/Read/Update/Delete

### Phase 2 — Migration Trockenlauf (~30 Min)
**Endpoint `POST /api/module-personal/migrate/dry-run`** liefert JSON:

```json
{
  "vorschlaege": [
    {
      "ziel_username": "thorsten.graupner",
      "quellen": {
        "users": { "username": "thorsten.graupner", "email": "hhgraupner@gmail.com" },
        "mitarbeiter": { "id": "9074af48", "vorname": "Thorsteb", "nachname": "Graupner" }
      },
      "korrekturen_vorgeschlagen": [
        "vorname 'Thorsteb' → 'Thorsten' (Tippfehler)"
      ],
      "match_via": "email_case_insensitive"
    }
    // ... weitere
  ],
  "konflikte": [
    {
      "username": "Tg-Admin",
      "warnung": "Hat gleiche E-Mail wie 'thorsten.graupner' — vermutlich Zweit-Login. Aktion?"
    }
  ],
  "ohne_match": [
    { "mitarbeiter_id": "ef9045e9", "name": "neu erarbeiter1", "hinweis": "Kein Login zugeordnet" }
  ],
  "wird_geschrieben": 0,
  "wuerde_schreiben": 5
}
```

Du liest, sagst „Ja", korrigierst Konflikte → Phase 3.

### Phase 3 — Apply (~5 Min, nach deinem Ja)
**Endpoint `POST /api/module-personal/migrate/apply`** schreibt:
- Für jeden Vorschlag mit „Ja" → Datensatz in `db.module_personal`
- Tippfehler werden korrigiert
- Konflikte (Doppel-Logins) werden **nach deiner Wahl** zusammengeführt oder als getrennte Datensätze geführt
- Alte Collections (`db.users`, `db.mitarbeiter`) **bleiben unangetastet** als Backup

### Phase 4 — Frontend-Switch (~1h)
- `MitarbeiterModulPage` zeigt `db.module_personal`
- Login-Form ruft `/api/module-personal/auth/login`
- User-Verwaltungs-Dialog (falls vorhanden) zeigt + ändert Felder
- Alle anderen Module bleiben unverändert (sie lesen ja nur `monteur_username` als String)

### Phase 5 — Stille Zeit (~1 Woche)
- Beide Systeme laufen parallel — alle Schreibvorgänge gehen in `db.module_personal`, lesen kann beides
- Nach 1 Woche ohne Probleme: alte Routes `/api/users` + `/api/mitarbeiter` deprecated logging
- Nach 2 Wochen: alte Routes entfernen

### Phase 6 — Aufräumen (~30 Min)
- `db.users` + `db.mitarbeiter` löschen oder als `db.users_legacy` umbenennen
- `routes/auth.py` + `routes/mitarbeiter.py` als deprecated Stubs (verweisen auf neue Endpoints)
- README + Architektur-Doku aktualisieren

---

## 🛡️ Risikomanagement

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Migration verwirft Datensätze | Datenverlust | DB-Snapshot vor Phase 3 (Pflicht) |
| Login bricht | App nicht nutzbar | Alte Login-Route bleibt während Phase 4–5 aktiv |
| Konflikte (Doppel-Logins) | Falsche Zuordnung | Manuelle Entscheidung im Trockenlauf |
| Tippfehler nicht erkannt | Falsche Korrektur | Trockenlauf zeigt **alle** vorgeschlagenen Änderungen, du sagst Ja oder Nein einzeln |
| KI-Tools brechen | KI findet keine User mehr | Tools nutzen weiter `monteur_username` als String — funktionieren unverändert |

---

## ✅ Vorteile danach

- **Eine** Akte pro Person, kein Hin-und-her-Springen
- Tippfehler weg
- Doppel-Logins bewusst sortiert oder zusammengeführt
- Berechtigungen + Lohn + Urlaub + Login auf einer Bedien-Maske
- Saubere Modul-First-Architektur (Regel 4)
- Vorbereitung für Mitarbeiter-Selfservice (Urlaubsantrag, Lohnzettel ansehen) — geht nur, wenn Login + Akte verknüpft sind
- KI-Assistent kann auch Mitarbeiter-Daten aktualisieren („Ändere Thorstens Telefonnummer auf …")

---

## ❓ Was Ralph entscheiden muss, BEVOR ich baue

1. **Konflikt-Strategie für Doppel-Logins** (Heike hat 2, Thorsten hat 2):
   - 🅰️ Beide behalten, beide auf eine Personal-Akte zeigen
   - 🅱️ Zweit-Login löschen, einen behalten
   - 🅲️ Im Trockenlauf entscheiden, pro Fall einzeln

2. **Test-Eintrag „neu erarbeiter1"**:
   - 🅰️ Mitnehmen (mit leerem Login)
   - 🅱️ Löschen vor Migration

3. **Live-Migration heute oder erst nach 1 Woche Preview-Test?**
   - 🅰️ Heute nur Preview, Live wenn alles stabil
   - 🅱️ Direkt parallel auf Live (mit Snapshot)

4. **Felder, die ich vergessen habe?**
   - z. B. Anstellungsverhältnis-Sondervereinbarungen, Stundenzettel-Anbindung, Auto/Werkzeug-Zuteilung
   - Sag mir, was zur Personal-Akte gehören soll

---

## 📅 Vorgeschlagener Zeitplan für morgen

| Zeit | Aktion |
|---|---|
| 09:00 | Du liest diesen Plan, klärst die 4 Fragen oben |
| 09:30 | Backup von Preview, dann grünes Licht |
| 09:30–11:30 | Phase 1: `module_personal` bauen + Pytest |
| 11:30–12:00 | Phase 2: Trockenlauf → du schaust drauf |
| 12:00–13:00 | Mittag |
| 13:00–13:15 | Phase 3: Apply nach deinem Ja |
| 13:15–14:30 | Phase 4: Frontend-Switch |
| 14:30–15:00 | Browser-Smoketest (Login, Mitarbeiter-Liste, KI-Termin) |
| 15:00 | Pause, Phase 5 läuft im Hintergrund (1 Woche parallel) |

---

## 🔚 Schlusssatz

Dieser Plan ist **eine Krücke wert los**, eine **Schublade konsolidiert**, eine
**KI-Lehrling-Erweiterung freigeschaltet** (Mitarbeiter-Daten ändern), eine
**Architektur saniert**. Alles in einem Tag, mit Rückfahrkarte (Snapshot)
und schrittweisem Switch.

Wenn du morgen früh „Ja" sagst (a/b/c-Antworten auf die 4 Fragen reichen),
starte ich.

— Hamburger Zeit 17:12, 01.06.2026
