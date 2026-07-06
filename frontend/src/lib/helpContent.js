/**
 * Default-Hilfetexte für die F1-Hilfe pro Modul.
 *
 * Diese Texte werden angezeigt, wenn in module_textvorlagen noch keine
 * passenden Einträge mit doc_type=hilfe_<context> und text_type=hilfe vorhanden sind.
 *
 * Über den Button "Als Vorlage speichern" im HelpSlideOver kann jeder Eintrag
 * einmalig in module_textvorlagen geschrieben und dort editiert werden.
 *
 * Schema pro Eintrag:
 *   { title: string, content: string (mit Zeilenumbrüchen) }
 *
 * Reihenfolge wird durch das Array bestimmt (entspricht sort_order beim Anlegen).
 */

export const HELP_DEFAULTS = {
  hilfe_kundenportal: [
    {
      title: "Kundenportal",
      content:
        "• Hier verwalten Sie alle Kundenportal-Links.\n" +
        "• Mit 'Link erstellen' schicken Sie einem Kunden einen persönlichen Zugang — er erhält eine Mail mit dem Link direkt in sein Portal.\n" +
        "• Der Kunde wird Schritt für Schritt geführt — er kann eine Nachricht schreiben und/oder Fotos schicken.\n" +
        "• Der Status zeigt: ⚪ Kein Portal · 🔵 Link verschickt · 🟡 Portal geöffnet · 🟢 Kunde hat geantwortet.\n" +
        "• Eingegangene Nachrichten und Fotos sehen Sie direkt hier aufgeklappt pro Kunde.\n" +
        "• Der alte 'Kundenportale'-Bereich ist das frühere System — bitte nur das neue Kundenportal verwenden.",
    },
  ],
  hilfe_kunden: [
    {
      title: "Neuen Kunden anlegen",
      content:
        "1. Oben rechts auf 'Neuer Kunde' klicken.\n" +
        "2. Anrede, Vor- und Nachname (oder Firma) eintragen.\n" +
        "3. E-Mail und Telefon sind optional, helfen aber bei der Kommunikation.\n" +
        "4. Status (z.B. 'Anfrage', 'Kunde', 'Auftrag') zuweisen.\n" +
        "5. Speichern. Der Kunde erscheint sofort oben in der Liste.",
    },
    {
      title: "Kunden filtern und finden",
      content:
        "1. Volltext-Suche oben durchsucht Name, Firma, E-Mail und Nachricht.\n" +
        "2. Kategorien-Leiste filtert nach Geschäftsfeld.\n" +
        "3. Status-Leiste zeigt 'Aktiv' (alle Live-Stati) oder einzelne Stati.\n" +
        "4. URL-Parameter ?filter=anfragen|aktiv|archiv funktionieren für Schnellzugriff.",
    },
    {
      title: "Aktionen aus der Kundenansicht",
      content:
        "1. Zeile aufklappen mit Klick auf die Karte.\n" +
        "2. 'Neues Projekt' öffnet die Projekt-Werkbank für diesen Kunden.\n" +
        "3. 'Angebot erstellen' öffnet den WYSIWYG-Editor mit vorbelegtem Kunden.\n" +
        "4. 'Kundenportal öffnen / anlegen' verlinkt zur Portalseite.\n" +
        "5. 'Mailverlauf' zeigt alle IMAP-Mails von/an diesen Kunden.",
    },
  ],
  hilfe_projekte: [
    {
      title: "Projekt anlegen",
      content:
        "1. Aus der Kundenansicht: '+ Neues Projekt' öffnet ein Popup oder ein Modal.\n" +
        "2. Titel und Kategorie sind Pflichtfelder.\n" +
        "3. Status (z.B. 'In Planung') über das Status-Dropdown setzen.\n" +
        "4. Speichern legt das Projekt direkt unter dem Kunden ab.",
    },
    {
      title: "Aufgaben einem Projekt zuordnen",
      content:
        "1. Projekt-Werkbank des Kunden öffnen (Folder-Icon).\n" +
        "2. Auf der Werkbank gibt es ein Aufgaben-Panel pro Projekt.\n" +
        "3. Mit '+ Neu' eine Aufgabe anlegen. Sie wird automatisch mit projekt_id verknüpft.\n" +
        "4. Die Aufgabe erscheint sowohl beim Projekt als auch beim Kunden.",
    },
    {
      title: "Projekt mit Aufgaben/Terminen verknüpfen",
      content:
        "1. Aufgaben tragen projekt_id UND kunde_id - sie sind in beiden Listen sichtbar.\n" +
        "2. Termine können entweder direkt auf einem Kunden oder auf einem Projekt hängen.\n" +
        "3. Im Termin-Modul kann beim Anlegen das Projekt gewählt werden - kunde_id wird automatisch gesetzt.\n" +
        "4. Wenn du nichts findest: prüfe ob Status-Filter aktiv ist (z.B. nur 'Offen').",
    },
  ],
  hilfe_aufgaben: [
    {
      title: "Aufgabe anlegen",
      content:
        "1. Im Aufgaben-Modul: oben rechts auf '+ Neu' klicken.\n" +
        "2. Im AufgabenPanel (in Kunde oder Projekt) ebenfalls '+ Neu'.\n" +
        "3. Titel ist Pflichtfeld. Beschreibung optional.\n" +
        "4. Priorität (niedrig/normal/hoch), Fälligkeitsdatum und Zuweisung setzen.\n" +
        "5. Kategorie wird aus den Textvorlagen geladen.",
    },
    {
      title: "Aufgabe bearbeiten",
      content:
        "1. KLICK AUF DIE ZEILE öffnet direkt den Bearbeiten-Dialog.\n" +
        "2. Stift-Icon rechts macht dasselbe.\n" +
        "3. Status-Dropdown in der Zeile ändert den Status sofort ohne Dialog.\n" +
        "4. Mülleimer-Icon löscht (mit Sicherheitsabfrage).",
    },
    {
      title: "Wie Aufgaben und Projekte verbunden sind",
      content:
        "1. Jede Aufgabe kann an einen Kunden ODER ein Projekt ODER beides gebunden sein.\n" +
        "2. Eine Aufgabe mit projekt_id erbt automatisch die kunde_id des Projekts.\n" +
        "3. Im AufgabenPanel siehst du nur die Aufgaben des aktuellen Kontextes.\n" +
        "4. Im Modul Aufgaben siehst du alle - mit Filter-Optionen.",
    },
  ],
  hilfe_termine: [
    {
      title: "Termin anlegen",
      content:
        "1. Im Termin-Modul: '+ Neu' oder Klick auf einen Tag im Kalender.\n" +
        "2. Kunde ODER Projekt als Bezug wählen - selten beides leer.\n" +
        "3. Datum + Uhrzeit + Dauer eintragen.\n" +
        "4. Ort und Notizen optional.\n" +
        "5. Speichern erzeugt automatisch eine Erinnerung (24h vorher).",
    },
    {
      title: "Termin filtern und finden",
      content:
        "1. Links auswählen: 'Kunde' oder 'Projekt' als Filter-Ziel.\n" +
        "2. Suche oben filtert nach Titel oder Ort.\n" +
        "3. Status-Pillen (Offen / Erledigt / Abgesagt) zur Schnellauswahl.\n" +
        "4. Anschluss-Termine sind verknüpft mit dem Vorgänger - sichtbar im Detail.",
    },
  ],
  hilfe_einsaetze: [
    {
      title: "Einsatz anlegen",
      content:
        "1. Direkt im Einsätze-Modul oder über 'Einsatz erstellen' in der Kundenansicht.\n" +
        "2. Mitarbeiter zuweisen (mehrere möglich).\n" +
        "3. Datum + Uhrzeit + ungefähre Dauer.\n" +
        "4. Material/Werkzeug-Hinweise in den Notizen.",
    },
    {
      title: "Einsatz in der Monteur-App",
      content:
        "1. Monteure sehen ihre Einsätze unter /monteur.\n" +
        "2. Einsatz öffnen - Adresse + Foto-Upload + Notiz.\n" +
        "3. Status auf 'Begonnen' / 'Abgeschlossen' setzen.\n" +
        "4. Fotos werden direkt im Einsatz gespeichert und sind später im Büro sichtbar.",
    },
  ],
  hilfe_assistent: [
    {
      title: "Was kann der Assistent?",
      content:
        "1. Hinweise anzeigen: ueberfaellige Angebote, anstehende Termine, fehlende Daten.\n" +
        "2. Sprache: Mic-Button druecken und reinsprechen - Whisper transkribiert.\n" +
        "3. Push-Snooze: bei Push-Erinnerungen direkt 'Erledigt' oder '1h/4h/24h spaeter'.\n" +
        "4. Direktlink: jede Hinweis-Karte hat einen Button, der direkt zum Projekt/Kunden fuehrt.",
    },
    {
      title: "Hinweise verstehen",
      content:
        "1. Kritisch (rot): muss heute angegangen werden.\n" +
        "2. Hoch (orange): innerhalb 24-48h.\n" +
        "3. Hinweis (gelb): zur Info, nicht zeitkritisch.\n" +
        "4. Info (blau): rein informativ, z.B. neue Stati.",
    },
    {
      title: "Sprachbefehle (in Vorbereitung)",
      content:
        "1. Phase 1: 'Termin morgen 14 Uhr bei Mueller anlegen' -> Vorschlag mit Bestaetigung.\n" +
        "2. Phase 2: KI schlaegt Antworten auf Mails vor.\n" +
        "3. Phase 3: KI lernt aus deinen Entscheidungen.\n" +
        "4. Phase 4: KI arbeitet im Hintergrund und bereitet alles fuer dich vor.",
    },
  ],
  hilfe_dashboard: [
    {
      title: "Was zeigt das Dashboard?",
      content:
        "1. Oben die wichtigsten Zahlen: offene Angebote, Aufträge, unbezahlte Rechnungen.\n" +
        "2. Mitte: neue Mail-Anfragen und Portal-Aktivitäten.\n" +
        "3. Unten: anstehende Termine und fällige Wiedervorlagen.\n" +
        "4. Die Kacheln sind anklickbar und führen direkt zum jeweiligen Modul.",
    },
    {
      title: "Anfragen abrufen",
      content:
        "1. Button 'Anfragen abrufen' holt neue Mail-Anfragen aus dem Postfach.\n" +
        "2. Neue Anfragen erscheinen anschließend unter Mail-Anfragen.\n" +
        "3. Die rote Zahl an 'Mail-Anfragen' zeigt offene Vorschläge.",
    },
  ],
  hilfe_mail_anfragen: [
    {
      title: "Mail-Anfragen verstehen",
      content:
        "1. Hier landen eingehende Anfragen aus dem Postfach (Collection module_mail_inbox).\n" +
        "2. Der farbige Punkt zeigt die Priorität (Rot = Sofort, Grün/Gelb/Blau = Stufe 1–3).\n" +
        "3. Rote Anfragen stehen automatisch oben.\n" +
        "4. Die Priorität richtet sich nach den Keyword-Prioritäten (Einstellungen).",
    },
    {
      title: "Neue Anfragen abholen",
      content:
        "1. 'Postfach prüfen' (grüner Button) holt neue Mails aus dem Postfach – bis zu 30 auf einmal, 6 Wochen zurück.\n" +
        "2. 'Übersprungene anzeigen' zeigt ALLE Mails der letzten 6 Wochen, auch die vom Filter aussortierten – falls eine echte Anfrage fälschlich rausgefallen ist.\n" +
        "3. Beide Buttons stehen immer sichtbar oben rechts.",
    },
    {
      title: "Anfrage bearbeiten",
      content:
        "1. Klick auf die Zeile öffnet die Detail-Ansicht der Anfrage.\n" +
        "2. 'Begrüßungsmail senden' öffnet Betterbird mit dem passenden Vorlagentext.\n" +
        "3. 'Übernehmen' legt aus der Anfrage einen Kunden/Vorgang an. Existiert der Kunde schon (gleiche E-Mail/Telefon), bietet die Suite 'Zuordnen' an und ergänzt automatisch nur die leeren Felder.\n" +
        "4. Ignorieren/Spam markiert die Anfrage, ohne sie zu löschen.\n" +
        "5. 'Alle übernehmen' verarbeitet alle offenen Anfragen auf einmal: neue Kunden werden angelegt, eindeutige Duplikate automatisch verknüpft.",
    },
    {
      title: "Werkzeuge-Menü (selten gebraucht)",
      content:
        "Im Dropdown 'Werkzeuge' oben rechts:\n" +
        "1. 'Neu prüfen' holt KEINE neuen Mails, sondern berechnet nur die Priorität der bereits gelisteten Anfragen neu (z.B. nach Änderung der Keyword-Regeln).\n" +
        "2. 'Statistik anzeigen' zeigt eine kleine Übersicht pro Postfach.\n" +
        "3. 'Export' lädt die Anfragen als JSON (Re-Import) oder CSV (Excel/Steuerberater) herunter.\n" +
        "4. 'Import' liest eine JSON-Datei ein – Duplikate werden automatisch übersprungen.",
    },
  ],
  hilfe_dokumente: [
    {
      title: "Dokumente-Modul",
      content:
        "1. Tabs oben: Angebote, Aufträge, Rechnungen und Vorlagen.\n" +
        "2. Jeder Tab zeigt die jeweilige Liste mit Such- und Filterfunktion.\n" +
        "3. Über 'Vorlagen' werden Standard-Texte für die Dokumente gepflegt.",
    },
    {
      title: "Vom Angebot zur Rechnung",
      content:
        "1. Angebot öffnen → Status auf 'Beauftragt' setzen → Speichern.\n" +
        "2. Seite aktualisieren (F5).\n" +
        "3. Tab 'Aufträge' → beim Auftrag auf das €-Icon klicken → Rechnung wird erstellt.\n" +
        "4. Belegnummern werden automatisch fortlaufend vergeben.",
    },
  ],
  hilfe_einstellungen: [
    {
      title: "Einstellungen – Überblick",
      content:
        "1. Firmendaten, Kalkulation und E-Mail sind die Basis-Tabs.\n" +
        "2. Benutzer und Mitarbeiter verwalten Zugänge und Rollen.\n" +
        "3. Dokument-Vorlagen steuern Aussehen von Angeboten/Rechnungen.\n" +
        "4. Backup sichert alle Daten als ZIP-Datei.",
    },
    {
      title: "Keyword-Prioritäten & Begrüßung",
      content:
        "1. Tab 'Keyword-Prioritäten': Begriffe festlegen, die Anfragen einstufen (Rot/Stufe 1–3).\n" +
        "2. Tab 'Begrüßungsvorlagen': automatische Antworttexte je Prioritätsstufe.\n" +
        "3. Diese Texte werden beim Senden der Begrüßungsmail genutzt.",
    },
    {
      title: "Schnellzugriffe",
      content:
        "1. Über den Kacheln oben gelangt man zu Artikel, Textvorlagen, Duplikaten.\n" +
        "2. 'Handy-Zugang' vergibt die PIN für die Monteur-App.\n" +
        "3. 'Wissen & Tipps' enthält Anleitungen und Hilfe-Artikel.",
    },
  ],
  hilfe_workflows: [
    {
      title: "Rechnung aus Angebot erstellen",
      content:
        "1. Dokumente → Angebote → beim Angebot auf das Stift-Icon klicken (öffnen).\n" +
        "2. Status auf 'Beauftragt' setzen → Speichern.\n" +
        "3. F5 drücken (Seite aktualisieren).\n" +
        "4. Dokumente → Aufträge → beim Auftrag auf das €-Icon (Rechnung) klicken → die Rechnung wird erstellt.",
    },
  ],
  hilfe_projekt_zuordnen: [
    {
      title: "Projekt zuordnen - was passiert hier?",
      content:
        "1. Diese Mail-Anfrage wird einem bestehenden Projekt des Kunden zugeordnet.\n" +
        "2. Das Programm schlaegt automatisch das passendste Projekt vor (gruenes Badge 'bester Vorschlag').\n" +
        "3. Der Vorschlag basiert auf Stichwoertern aus der Mail UND darauf, welches Projekt zuletzt bearbeitet wurde.\n" +
        "4. Du kannst jederzeit ein anderes Projekt anklicken und ueber 'Zuordnen' bestaetigen.\n" +
        "5. Gibt es noch kein passendes Projekt, einfach '+ Neues Projekt anlegen' waehlen.",
    },
  ],
};

export const HELP_LABELS = {
  hilfe_projekt_zuordnen: "Hilfe: Projekt zuordnen",
  hilfe_kundenportal: "Hilfe: Kundenportal",
  hilfe_kunden: "Hilfe: Kunden",
  hilfe_projekte: "Hilfe: Projekte",
  hilfe_aufgaben: "Hilfe: Aufgaben",
  hilfe_termine: "Hilfe: Termine",
  hilfe_einsaetze: "Hilfe: Einsätze",
  hilfe_assistent: "Hilfe: Mein Assistent",
  hilfe_dashboard: "Hilfe: Dashboard",
  hilfe_mail_anfragen: "Hilfe: Mail-Anfragen",
  hilfe_dokumente: "Hilfe: Dokumente",
  hilfe_einstellungen: "Hilfe: Einstellungen",
  hilfe_workflows: "Workflows – Übersicht",
};
