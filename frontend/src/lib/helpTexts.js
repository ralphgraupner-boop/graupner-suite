/**
 * Zentraler Hilfe-Text-Katalog fuer die Graupner Suite.
 *
 * Ergaenzen so:  "<key>": "<Hilfetext>",
 *
 * Verwendung im JSX:
 *   <HelpTip id="key">
 *     <Button>...</Button>
 *   </HelpTip>
 */

export const HELP_TEXTS = {
  // ========== Globale Navigation ==========
  "nav.dashboard": "Übersichtsseite mit den wichtigsten Zahlen: offene Angebote, Aufträge, unbezahlte Rechnungen und letzte Anfragen.",
  "nav.kunden": "Alle Kunden und Interessenten. Hier können Sie Kunden anlegen, bearbeiten, zu ihnen Dokumente und Portale öffnen.",
  "nav.einsaetze": "Einsatzplanung für Termine und Aufträge vor Ort. Zeigt, welcher Mitarbeiter wann wo ist.",
  "nav.artikel": "Produkt- und Leistungskatalog: alle Artikel, die Sie in Angebote und Rechnungen einfügen können. Import/Export möglich.",
  "nav.dokumente": "Alle Angebote, Auftragsbestätigungen und Rechnungen. Hier können Sie neue Dokumente erstellen und bestehende öffnen.",
  "nav.textvorlagen": "Wiederverwendbare Textbausteine für Briefkopf, Vortexte, Schlusstexte und Standard-Beschreibungen.",
  "nav.portals": "Kundenportale – Online-Bereich für Kunden, in dem sie Bilder hochladen und mit Ihnen kommunizieren können.",
  "nav.buchhaltung": "Übersicht für die Buchhaltung: Einnahmen, Rechnungen, Zahlungseingänge, DATEV-Export.",
  "nav.invoices": "Alle Rechnungen mit Zahlungsstatus. Mahnwesen, Zahlungseingänge, Export.",
  "nav.email": "Posteingang: alle eingehenden E-Mails. Versandprotokoll: alle von Ihnen versendeten Mails.",
  "nav.settings": "Einstellungen für Firma, E-Mail, Benutzer, Bankverbindung, PDF-Layout, Kundenportal-Texte und mehr.",

  // ========== Dashboard ==========
  "dashboard.stat-anfragen": "Anzahl der neuen Kundenanfragen. Klick führt zur Liste.",
  "dashboard.stat-kunden": "Gesamtzahl Ihrer Kunden.",
  "dashboard.stat-quotes": "Offene Angebote, die noch nicht zum Auftrag wurden.",
  "dashboard.stat-orders": "Aktive Aufträge.",
  "dashboard.stat-invoices": "Unbezahlte Rechnungen.",
  "dashboard.portal-hint": "Ein Kunde hat im Kundenportal etwas hochgeladen oder Ihnen geschrieben. Klick öffnet die Portal-Liste.",
  "dashboard.inbox-hint": "Ungelesene E-Mails im Posteingang. Klick öffnet das E-Mail-Modul.",

  // ========== Kunden-Modul ==========
  "kunde.btn-new": "Neuen Kunden anlegen.",
  "kunde.btn-import": "Kunden aus CSV/Excel-Datei importieren.",
  "kunde.btn-export": "Alle Kunden in eine Datei exportieren (CSV/Excel/JSON/XML).",
  "kunde.row-expand": "Zeile anklicken = Kundendetails aufklappen.",
  "kunde.btn-open-portal": "Kundenportal für diesen Kunden öffnen oder erstellen.",
  "kunde.btn-new-quote": "Neues Angebot direkt für diesen Kunden erstellen.",

  // ========== Dokumenten-Editor ==========
  "doc.btn-save": "Dokument speichern. Danach wird gefragt, ob Sie es auch als Vorlage speichern möchten.",
  "doc.btn-pdf": "PDF öffnen – wird automatisch gespeichert und in neuem Tab geöffnet, so dass Sie den aktuellen Stand sehen.",
  "doc.btn-mail": "Mailprogramm öffnen – zwei Optionen: Mit Vortext & Schlusstext oder nur Betreff.",
  "doc.btn-template": "Vorlage laden: Ein gespeichertes Standard-Angebot/Rechnung übernehmen und anpassen.",
  "doc.btn-save-template": "Aktuelles Dokument als Vorlage speichern – zum späteren Wiederverwenden.",
  "doc.position-add": "Neue Position hinzufügen – Beschreibung, Menge, Preis.",
  "doc.position-save-article": "Diese Position als wiederverwendbaren Artikel/Leistung speichern.",
  "doc.vortext": "Anrede und einleitender Text. Platzhalter wie {anrede_brief} werden automatisch durch die Kundenanrede ersetzt.",
  "doc.schlusstext": "Abschluss-Text vor der Grußformel. Kann Zahlungsbedingungen, Gewährleistung etc. enthalten.",
  "doc.sidebar-search": "In Artikeln, Leistungen und Textbausteinen suchen und per Klick einfügen.",
  "doc.headline": "Die fettgedruckte Überschrift ist die Dokumenten-Nummer. Sie wird automatisch vergeben.",
  "doc.discount": "Rabatt gesamt oder pro Position. Wird in der Summe berücksichtigt.",
  "doc.lohnanteil": "Lohnanteil nach § 35a EStG für Steuer-Abzug beim Kunden. Wird bei Privatkunden im PDF angezeigt.",

  // ========== E-Mail-Modul ==========
  "email.btn-fetch": "E-Mails vom Server abrufen (normalerweise alle 30 Minuten automatisch).",
  "email.btn-bulk-mark-read": "Ausgewählte Mails als gelesen markieren.",
  "email.btn-bulk-delete": "Ausgewählte Mails aus der Suite löschen – bleiben in Ihrem Mailprogramm (Betterbird) erhalten.",
  "email.filter-ungelesen": "Nur ungelesene E-Mails anzeigen.",
  "email.filter-anfrage": "Automatisch als Kundenanfrage erkannte Mails.",
  "email.filter-bekannt": "Mails von bekannten Kunden.",
  "email.mail-reply": "Direkt auf diese Mail antworten – Vorlage Ihres Brief-Schemas wird geladen.",
  "email.mail-create-anfrage": "Aus dieser Mail eine neue Kundenanfrage erstellen.",
  "email.mail-assign": "Mail einem bestehenden Kunden zuordnen.",
  "email.bulk-select-all": "Alle sichtbaren (also gefilterten) E-Mails auf einmal auswählen.",

  // ========== Kundenportal ==========
  "portal.btn-create": "Neues Kundenportal für einen Kunden anlegen. Der Kunde erhält einen Link per E-Mail.",
  "portal.btn-deactivate": "Portal deaktivieren – Kunde kann nicht mehr hochladen. Rückgängig möglich.",
  "portal.max-images": "Max. 5 Bilder pro Upload als Schutz vor Missbrauch.",
  "portal.new-badge": "Dieses Portal hat neue Nachrichten oder Bilder vom Kunden.",

  // ========== Einstellungen ==========
  "settings.tab-firmendaten": "Anschrift, Kontakt und Steuernummer Ihrer Firma – erscheinen im PDF-Briefkopf.",
  "settings.tab-bankverbindung": "IBAN/BIC – erscheint auf Rechnungen.",
  "settings.tab-email": "SMTP (Versand) und IMAP (Empfang) konfigurieren.",
  "settings.tab-users": "Benutzer anlegen, Rollen vergeben, Passwörter ändern.",
  "settings.tab-portal": "Begrüßungstexte und Hinweise für das Kundenportal.",
  "settings.tab-briefkopf": "Logo, Schriftgröße und Slogan im PDF-Briefkopf anpassen.",
  "settings.tab-dokument-vorlagen": "Standard-Einstellungen für PDF: Schriftgröße, Farben, Zahlungsbedingungen.",
  "settings.ignore-list": "E-Mails von diesen Absendern werden nicht in die Suite importiert (nur in Ihrem Mailprogramm sichtbar).",
  "settings.slogan-font-size": "Größe der Texte 'seit 1960' und 'Mitglied der Handwerkskammer' im Briefkopf (Standard 9pt).",
  "settings.pdf-font-size": "Schriftgröße für Fließtext im PDF: Klein=9pt, Normal=10pt, Groß=11pt.",

  // ========== Toggle selbst ==========
  "help.toggle": "Hilfe-Modus: An/Aus. Wenn an, erscheinen Tooltips wenn Sie mit der Maus über Buttons fahren.",
};
