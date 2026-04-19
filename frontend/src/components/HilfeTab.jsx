import { useState } from "react";
import { Card } from "@/components/common";
import { Lightbulb, Navigation, FileText, Mail, Users, Share2, Settings, Keyboard, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";

/**
 * Hilfe-Handbuch fuer die Graupner Suite.
 *
 * Dieses Dokument ist fuer den Benutzer und neue Mitarbeiter gedacht.
 * Struktur: Zusammenklappbare Abschnitte mit nummerierten Zeilen.
 *
 * Ergaenzen: Einen neuen Abschnitt in HELP_SECTIONS hinzufuegen.
 */

const HELP_SECTIONS = [
  {
    id: "hilfe-modus",
    icon: Lightbulb,
    title: "Hilfe-Modus (Glühbirne rechts unten)",
    intro: "Der Hilfe-Modus zeigt Ihnen beim Hovern mit der Maus kurze Erklärungen zu Buttons und Feldern. Ideal für neue Mitarbeiter oder wenn man mal eine Funktion vergessen hat.",
    lines: [
      "1. Klicken Sie auf die gelbe Glühbirne unten rechts in jeder Ansicht.",
      "2. Die Glühbirne leuchtet gelb und pulsiert = Hilfe aktiv.",
      "3. Fahren Sie mit der Maus über Navigations-Einträge, Buttons oder Felder.",
      "4. Ein dunkler Tooltip mit Erklärungstext erscheint.",
      "5. Nochmal auf die Glühbirne klicken zum Abschalten.",
      "6. Der Zustand bleibt beim Abmelden gespeichert – also einmal ein, immer ein.",
      "7. Erweitern der Hilfetexte: einfach sagen, welcher Button welche Erklärung bekommen soll.",
    ],
  },
  {
    id: "navigation",
    icon: Navigation,
    title: "Navigation (linke Seitenleiste)",
    intro: "Alle Haupt-Bereiche der Suite. Ein blau-roter Punkt + Zahl zeigt neue Inhalte.",
    lines: [
      "1. Dashboard: Übersicht mit Anfragen, Kunden, Angeboten, Rechnungen + roter Badge bei neuen Mails.",
      "2. Kunden: Alle Kunden anlegen, bearbeiten, durchsuchen. Import/Export möglich.",
      "3. Einsätze: Termin- und Einsatzplanung der Mitarbeiter.",
      "4. Artikel & Leistungen: Ihr Katalog für alle Positionen in Dokumenten.",
      "5. Dokumente: Zentrale Liste aller Angebote, Aufträge, Rechnungen.",
      "6. Textvorlagen: Wiederverwendbare Textbausteine (Vortext, Schlusstext, Beschreibungen).",
      "7. Kundenportale: Online-Bereiche für Ihre Kunden (Bilder hochladen, Nachrichten).",
      "8. Buchhaltung: Einnahmen, Zahlungseingänge, DATEV-Export.",
      "9. Rechnungen: Alle Rechnungen mit Mahnwesen und Zahlungsstatus.",
      "10. E-Mail: Posteingang + Versandprotokoll. Rot blinkend = neue Mails.",
      "11. Einstellungen: Firma, Logo, SMTP/IMAP, Benutzer, Vorlagen usw.",
    ],
  },
  {
    id: "angebot",
    icon: FileText,
    title: "Neues Angebot erstellen",
    intro: "Der typische Ablauf für ein neues Angebot – von Null bis PDF.",
    lines: [
      "1. Linke Seitenleiste: Dokumente → Button 'Neu' → Typ 'Angebot' wählen.",
      "2. Oben im Editor: Kunde auswählen (Suchfeld).",
      "3. Betreff (automatisch vorbefüllt) ggf. anpassen.",
      "4. Vortext: Anrede mit Platzhalter {anrede_brief} nutzen – wird beim Kunden passend ersetzt.",
      "5. Positionen hinzufügen: entweder manuell tippen oder aus Seitenleiste per Klick.",
      "6. Preise, Mengen, Einheiten einstellen.",
      "7. Schlusstext (Zahlungsbedingungen, Gewährleistung etc.).",
      "8. Klick 'Speichern' → Dokument wird angelegt (Dialog fragt, ob als Vorlage speichern).",
      "9. Klick 'PDF' → Speichert automatisch und öffnet die fertige PDF in neuem Tab.",
      "10. Klick 'Mailprogramm' → Dialog: mit Vortext/Schlusstext oder nur Betreff senden.",
      "11. Klick 'Drucken' → Speichert und öffnet Druck-Dialog mit dem aktuellen PDF.",
    ],
  },
  {
    id: "textvorlagen",
    icon: FileText,
    title: "Textvorlagen nutzen und bearbeiten",
    intro: "Wiederverwendbare Texte für Vortext, Schlusstext oder Positionsbeschreibungen.",
    lines: [
      "1. Im Dokumenten-Editor auf das Icon rechts neben Vortext/Schlusstext klicken.",
      "2. Liste der gespeicherten Texte erscheint – einen auswählen per Klick.",
      "3. Zum Bearbeiten: Stift-Symbol neben dem Titel klicken.",
      "4. Titel und Inhalt ändern, dann 'Änderungen speichern'.",
      "5. Zum Löschen: Papierkorb-Symbol.",
      "6. Platzhalter verwenden: {kunde}, {anrede_brief}, {firma}, {datum} etc.",
      "7. '---' in einer Zeile = Seitenumbruch im PDF.",
      "8. Neuen Textbaustein anlegen: in 'Textvorlagen' (Menü) → Neu.",
    ],
  },
  {
    id: "kundenportal",
    icon: Share2,
    title: "Kundenportal",
    intro: "Online-Bereich für den Kunden – Bilder hochladen, Nachrichten austauschen.",
    lines: [
      "1. Kunde öffnen → im Kunden-Detail 'Portal öffnen' klicken.",
      "2. Wenn noch keines existiert: neues Portal anlegen (automatischer Link).",
      "3. Link per E-Mail an den Kunden senden (auch manuell möglich).",
      "4. Der Kunde sieht: Begrüßungstext, Upload für Bilder, Nachrichtenbereich.",
      "5. Kunde lädt max. 5 Bilder pro Upload hoch (Schutz vor Missbrauch).",
      "6. Kunde klickt 'Absenden' → Sie bekommen automatisch eine E-Mail.",
      "7. Dashboard zeigt oben eine blaue Portal-Meldung bei neuen Einträgen.",
      "8. Seitenleiste 'Kundenportale' blinkt rot mit Anzahl neuer Portale.",
      "9. Portale-Liste öffnen → Portal mit 'NEU'-Badge anklicken → alle Bilder/Nachrichten sehen.",
      "10. Bei Verdacht auf Missbrauch: Portal deaktivieren (reversibel).",
    ],
  },
  {
    id: "email",
    icon: Mail,
    title: "E-Mail-Modul",
    intro: "Eingehende Mails sehen, zuordnen, antworten, ignorieren.",
    lines: [
      "1. E-Mails werden automatisch alle 30 Minuten via IMAP abgerufen.",
      "2. Manuell: Button 'E-Mails abrufen' oben rechts.",
      "3. WICHTIG: Mails werden NICHT als gelesen markiert – bleiben in Betterbird ungelesen.",
      "4. Filter: Alle, Ungelesen, Bekannt (von Kunde), Anfrage (automatisch erkannt), Zugeordnet.",
      "5. Suche: oben per Stichwort in Absender/Betreff/Body.",
      "6. Mail anklicken = aufklappen und lesen.",
      "7. 'Antworten' → Direkt aus der Suite antworten (SMTP).",
      "8. 'Als Anfrage anlegen' → Mail wird zu einem neuen Kundenkontakt.",
      "9. 'Kunde zuordnen' → Mail einem bestehenden Kunden zuordnen.",
      "10. Bulk-Aktionen: Checkbox nutzen, dann 'Als gelesen markieren' oder 'Löschen' (nur in Suite, bleibt in Betterbird).",
      "11. Ignore-Liste (PayPal, Newsletter, DHL): Einstellungen → E-Mail → E-Mail-Filter.",
    ],
  },
  {
    id: "kunden",
    icon: Users,
    title: "Kunden-Modul",
    intro: "Anlegen, bearbeiten und Übersicht aller Kontakte.",
    lines: [
      "1. Listenansicht zeigt alle Kunden/Interessenten.",
      "2. Filter nach Status: Alle, Interessent, Kunde, Anfrage etc.",
      "3. Suche: über Name, Ort, E-Mail oder Telefon.",
      "4. Kundenzeile anklicken = aufklappen für Detailansicht.",
      "5. Details enthalten: Anschrift, Kontakt, Angebote, Rechnungen, Einsätze, Portal.",
      "6. Anrede (Herr/Frau) wird automatisch aus Vornamen erkannt (z.B. Lisa → Frau).",
      "7. Neuen Kunden anlegen: 'Neuer Kunde' oben rechts.",
      "8. Import aus CSV/Excel: 'Import' oben rechts → Datei hochladen, Felder zuordnen.",
      "9. Export aller Kunden: 'Export' → Format wählen (CSV/Excel/JSON/XML).",
      "10. Dubletten-Prüfung automatisch beim Anlegen (E-Mail + Name).",
    ],
  },
  {
    id: "einstellungen",
    icon: Settings,
    title: "Einstellungen",
    intro: "Alle grundlegenden Konfigurationen der Suite.",
    lines: [
      "1. Firmendaten: Adresse, Telefon, Steuer-Nr. – erscheinen im PDF-Briefkopf.",
      "2. Kalkulation: Standard-Preise, Stundensätze, MwSt.-Satz, Lohnanteil.",
      "3. E-Mail: SMTP-Versand und IMAP-Empfang konfigurieren + Ignore-Liste.",
      "4. Benutzer: Neue Benutzer anlegen, Passwort ändern, Rollen verwalten.",
      "5. Mitarbeiter: Pro-Verwaltung mit Zeiten, Lohn, Urlaub.",
      "6. Dokument-Vorlagen: Briefkopf-Schrift, PDF-Schriftgröße, Slogan-Größe, Farben.",
      "7. Angebot/Rechnung-Vorlagen: Gespeicherte Dokumentvorlagen + Favoriten.",
      "8. Diverses / Info: Push-Benachrichtigungen, Sonstiges.",
      "9. Backup: Manuelles Backup auslösen, wiederherstellen.",
    ],
  },
  {
    id: "shortcuts",
    icon: Keyboard,
    title: "Nützliche Tipps & Tricks",
    intro: "Kleine Kniffe, die Zeit sparen.",
    lines: [
      "1. Vor dem Abmelden: Backup-Dialog bestätigen – sichert alle Daten als ZIP.",
      "2. Dashboard-Hinweise (blau/gelb oben) sind anklickbar und führen direkt zum Problem.",
      "3. PDF-Button speichert immer zuerst – keine 'alten Stände' mehr im PDF.",
      "4. Textvorlagen können Platzhalter enthalten: {kunde}, {anrede_brief}, {datum}, {firma}.",
      "5. '---' in einer Zeile = Seitenumbruch im PDF.",
      "6. Plausibilitätsprüfung: Warnt bei 0,00 €-Positionen vor dem Speichern.",
      "7. Hilfe-Modus (gelbe Glühbirne): Tooltips für neue Mitarbeiter – siehe oben.",
      "8. Preview vs. Live: Änderungen testest du auf Preview, dann 'Redeploy' für Live.",
      "9. Bei Problemen: Backup ist jederzeit wiederherstellbar.",
    ],
  },
  {
    id: "benachrichtigungen",
    icon: Mail,
    title: "Benachrichtigungen – Wo und wie?",
    intro: "Die Suite informiert dich automatisch über wichtige Ereignisse.",
    lines: [
      "1. E-Mail an service24@tischlerei-graupner.de: wenn Kunde im Portal hochlädt oder sendet.",
      "2. E-Mail: wenn Portal wegen zu vieler Uploads automatisch gesperrt wurde.",
      "3. Push-Notification (Browser/Handy): gleiche 4 Events, falls aktiviert.",
      "4. Dashboard-Badge (oben): 'X neue Kundenportal-Mitteilungen' + 'Y unbearbeitete E-Mails'.",
      "5. Seitenleiste rot blinkend: E-Mail und Kundenportale mit Zahl + Ping-Effekt.",
      "6. Sound: leises Piep in der Suite, wenn neue Mails ankommen.",
      "7. Auto-Refresh alle 60 Sekunden, damit die Zahlen immer aktuell sind.",
      "8. Browser-Fokus (App wieder öffnen): löst ebenfalls sofortige Aktualisierung aus.",
    ],
  },
];

export const HilfeTab = () => {
  const [openId, setOpenId] = useState("hilfe-modus");

  const toggle = (id) => setOpenId(openId === id ? null : id);

  return (
    <div className="space-y-4" data-testid="hilfe-tab">
      <Card className="p-4 lg:p-6 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-amber-900">Hilfe & Bedienungsanleitung</h3>
            <p className="text-sm text-amber-800 mt-1">
              Diese Seite ist Ihr <strong>persönliches Handbuch</strong>. Hier finden Sie jede wichtige Funktion der Graupner Suite Schritt für Schritt erklärt.
              Ideal für neue Mitarbeiter oder wenn Sie eine Funktion mal nicht mehr wissen.
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Tipp: Klicken Sie auf die gelbe Glühbirne unten rechts, um direkt im Programm Tooltips beim Hover zu bekommen.
            </p>
          </div>
        </div>
      </Card>

      {HELP_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isOpen = openId === section.id;
        return (
          <Card
            key={section.id}
            className="overflow-hidden"
            data-testid={`help-section-${section.id}`}
          >
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="w-full px-4 py-3 lg:px-6 lg:py-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
              data-testid={`help-toggle-${section.id}`}
            >
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <span className="font-semibold flex-1">{section.title}</span>
              {isOpen ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 py-3 lg:px-6 lg:py-4 border-t bg-background/50">
                {section.intro && (
                  <p className="text-sm text-muted-foreground italic mb-3 leading-relaxed">
                    {section.intro}
                  </p>
                )}
                <ol className="space-y-2">
                  {section.lines.map((line, idx) => (
                    <li
                      key={idx}
                      className="text-sm leading-relaxed pl-4 border-l-2 border-primary/20 hover:border-primary/60 transition-colors"
                    >
                      {line}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        );
      })}

      <Card className="p-4 lg:p-6 bg-slate-50 border-slate-200">
        <p className="text-xs text-slate-600">
          <strong>Hinweis:</strong> Diese Hilfe wird laufend erweitert. Wenn Sie einen Punkt vermissen oder eine Erklärung
          anpassen möchten, sagen Sie einfach Bescheid – neue Abschnitte sind in wenigen Minuten ergänzt.
        </p>
      </Card>
    </div>
  );
};
