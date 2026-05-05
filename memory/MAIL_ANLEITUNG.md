# 📧 Bedienungsanleitung: IMAP-Postfächer & Filter-Regeln

**Stand:** 04.05.2026
**Für:** Graupner Suite — Mail-Anfragen-Modul

---

## 1. Wie funktioniert der Mail-Abruf?

Die Suite holt sich **regelmäßig alle E-Mails** aus deinen hinterlegten IMAP-Postfächern.
Damit nicht jede Werbung als Anfrage erscheint, werden die Mails durch **Filter-Regeln** geprüft.

**Wichtig:** IMAP wird nur **gelesen** (read-only) — weder Live noch Vorschau markieren Mails als „gelesen" oder verschieben etwas. Beide Umgebungen können das gleiche Postfach gleichzeitig nutzen.

---

## 2. Postfach hinzufügen

1. **Einstellungen → E-Mail → IMAP-Postfächer**
2. Klick **„+ Neues Postfach"**
3. Felder ausfüllen:

| Feld | Beispiel | Hinweis |
|---|---|---|
| Beschriftung | `Hauptpostfach` | Frei wählbar — nur für dich |
| IMAP-Server | `secure.emailsrvr.com` | Bei Rackspace; bei Jimdo `imap.jimdo.com` |
| Port | `993` | Standard für IMAP über SSL |
| Benutzer | `kontakt@tischlerei-graupner.de` | Vollständige E-Mail-Adresse |
| Passwort | `••••••••` | Postfach-Passwort (verschlüsselt gespeichert) |
| Aktiv | ☑ | Wird beim Mailabruf mitgescannt |

4. **Mind. 2 Filter-Regeln** definieren (siehe unten)
5. **„Verbindung testen"** klicken → muss „Verbunden — X Ordner sichtbar" zeigen
6. **Speichern**

> 💡 Beim Bearbeiten kannst du das Passwort leer lassen — dann bleibt es unverändert.

---

## 3. Filter-Regeln verstehen

Pro Postfach **mind. 2 Regeln**. Die Logik ist **ODER** (mindestens eine muss zutreffen, sonst wird die Mail übersprungen).

### Verfügbare Filter-Typen

| Typ | Wirkt auf | Beispiel-Wert |
|---|---|---|
| Betreff enthält | Subject | `Anfrage von` |
| Betreff beginnt mit | Subject | `[Anfrage]` |
| Absender enthält | From-Header | `no-reply@jimdo.com` |
| Absender ist exakt | From-Header | `formular@meine-domain.de` |

### Wie eine Mail eingelesen wird

```
Mail kommt rein
    ↓
Trifft mind. 1 Filter-Regel?
    ├ JA  → Wird als Anfrage importiert (Tab „Offen")
    └ NEIN → Übersprungen (siehst du nur via „Übersprungene anzeigen")
```

---

## 4. Eigene Erkennungsmuster im Kontaktformular einbauen 🎯

**Genau hier wird's stark.** Wenn du in deinem Kontaktformular ein **eindeutiges Schlüsselwort** in den Betreff der ausgehenden E-Mail einbaust, kannst du:
- Anfragen **eindeutig erkennen** (keine Verwechslung mit anderer Korrespondenz)
- **Pro Domain unterscheiden** (welche Test-Seite bringt mehr Anfragen?)

### Empfohlenes Schema für den Mail-Betreff

```
[GRP-FORMULAR] <Domain> – <Anliegen>
```

**Beispiele:**

| Domain | Empfohlener Betreff der Formular-Mail |
|---|---|
| schiebetuer-reparatur-hamburg.de | `[GRP-FORMULAR] schiebetuer-hh – Anfrage von Max Mustermann` |
| holztueren-hamburg.de | `[GRP-FORMULAR] holztueren-hh – Anfrage von Max Mustermann` |
| tischlerei-graupner.de | `[GRP-FORMULAR] tischlerei-gp – Anfrage von Max Mustermann` |

### Passende Filter-Regeln dazu

Im jeweiligen Postfach:

| Typ | Wert |
|---|---|
| Betreff enthält | `[GRP-FORMULAR]` |
| Absender enthält | `no-reply@jimdo.com` (Sicherheits-Backup für Jimdo-Mails) |

> ✅ **Vorteil:** `[GRP-FORMULAR]` taucht in **keiner** normalen Mail auf — keine Fehl-Treffer mehr.
> ✅ **Bonus:** In der Statistik siehst du an `schiebetuer-hh` / `holztueren-hh` direkt welche Domain wie viele Anfragen liefert.

### Alternative: kürzeres Tag

Wenn `[GRP-FORMULAR]` zu lang ist:
```
GRP|01 – <Anliegen>      ← für Domain 1
GRP|02 – <Anliegen>      ← für Domain 2
GRP|03 – <Anliegen>      ← für Domain 3
```
Filter: `Betreff enthält GRP|`

---

## 5. Mail-Body strukturiert halten (für besseren Parser)

Der Parser liest aus dem Mail-Body Felder anhand von **Doppelpunkten**. Bitte das Schema beibehalten:

```
Anrede:    Herr/Frau
Vorname:   Max
Nachname:  Mustermann
E-Mail:    max@beispiel.de
Telefon:   +49 40 1234567
Strasse:   Beispielweg 12
PLZ:       22111
Ort:       Hamburg

Nachricht:
Mein Schiebetür klemmt seit gestern …
```

**Wichtig:**
- **Reply-To-Header** auf die Kunden-Mail-Adresse setzen — die Suite erkennt dann automatisch den Absender, auch wenn das Formular von `no-reply@…` versendet
- Schreibweise der Feldnamen wie oben (Großschreibung egal, Doppelpunkt zwingend)

---

## 6. Test-Workflow

1. Lege im Postfach Filter-Regeln an
2. Schick dir selbst eine Test-Mail über das Formular
3. In der Suite: **Mail-Anfragen → „Postfach prüfen"**
4. Sollte als „1 neue Anfrage" auftauchen
5. Falls nicht: **„Übersprungene anzeigen"** klicken → Mail finden → **„Anzeigen"** → prüfen warum sie übersprungen wurde
6. Filter-Regel anpassen, nochmal scannen

---

## 7. Statistik nutzen 📊

Auf der Mail-Anfragen-Seite oben: **„Statistik anzeigen"**.

- Letzte 7 / 30 / 90 / 365 Tage
- Pro Postfach: Anfragen gesamt · davon zu Kunden geworden · **Conversion-Rate (%)**
- **So entscheidest du datenbasiert** welche Test-Domain weiter laufen darf und welche du abschalten kannst

---

## 8. Häufige Probleme

| Problem | Lösung |
|---|---|
| „Login fehlgeschlagen" | Passwort prüfen. Bei manchen Providern brauchst du ein App-Passwort statt dem Login-Passwort |
| Mail kommt nicht an, obwohl Regel vorhanden | Liegt am IMAP-Such-Limit (Datums-Fenster). Standard sind 6 Wochen. „Übersprungene anzeigen" → prüfen ob sie überhaupt im Zeitraum ist |
| Viele Spam-Treffer | Spam-Filter ist eingebaut → Tab „Spam-Verdacht" prüfen, „Endgültig löschen" leert ihn |
| Umlaut-Filter funktioniert nicht | Bekannter IMAP-Standard-Limit. In der Suite gefixt — alle Mails werden geholt + clientseitig gefiltert |

---

## 9. Faustregeln für gute Filter

- ✅ **2-4 Regeln** pro Postfach reichen meistens
- ✅ **Eindeutige Wörter/Tags** im Betreff (`[GRP-FORMULAR]`, nicht nur „Anfrage")
- ✅ **Pro Domain ein eigenes Tag** wenn du Conversion messen willst
- ❌ **Vermeide Umlaute** in Filter-Werten wenn möglich (zur Sicherheit, falls eine alte Code-Version aktiv ist)
- ❌ **Vermeide zu generische Wörter** wie nur „Anfrage" — kommen in 100 normalen Mails vor

---

*Bei Fragen oder Verbesserungsvorschlägen: ins Notiz-Widget rechts unten eintragen.*
