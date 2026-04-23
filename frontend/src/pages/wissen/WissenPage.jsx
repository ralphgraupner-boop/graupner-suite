import { BookOpen, Printer, FileCheck, AlertCircle, CheckCircle2, Info, Users, Scale } from "lucide-react";

/**
 * Wissen-Modul – Infoseite fuer Montagsbesprechungen.
 * Reines Frontend-Modul, keine Backend-Abhaengigkeit.
 * Druckbar via window.print().
 */
export function WissenPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="wissen-page">
      {/* Header (wird beim Drucken ausgeblendet) */}
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Wissen für die Familie</h1>
            <p className="text-sm text-muted-foreground">
              Hintergrundwissen für Montagsbesprechungen — kurz, praxisnah, zum Ausdrucken.
            </p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm"
          data-testid="wissen-print-btn"
        >
          <Printer className="w-4 h-4" />
          Drucken / Als PDF
        </button>
      </div>

      {/* Druck-Header: nur sichtbar beim Drucken */}
      <div className="hidden print:block text-center border-b pb-2 mb-4">
        <h1 className="text-xl font-bold">Graupner Suite — Wissen für die Familie</h1>
        <p className="text-xs text-gray-500">Tischlerei R.Graupner · Stand {new Date().toLocaleDateString("de-DE")}</p>
      </div>

      {/* Artikel 1: Rechnungsnummern & GoBD */}
      <article className="border rounded-xl bg-card p-6 space-y-4 print:border-gray-400 print:break-inside-avoid">
        <div className="flex items-center gap-2 border-b pb-3">
          <Scale className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Rechnungsnummern & GoBD — was gilt wirklich?</h2>
        </div>

        <section>
          <h3 className="font-semibold text-base mb-2">Die wichtigste Unterscheidung</h3>
          <p className="text-sm leading-relaxed">
            Die <strong>GoBD</strong> (Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung
            von Büchern) gelten für jeden Gewerbetreibenden — <strong>auch für uns</strong> als Familienbetrieb.
            Aber: der <em>Umfang</em> der Pflichten richtet sich nach dem Grundsatz der <strong>Verhältnismäßigkeit</strong>.
            Kleine Betriebe müssen <em>weniger dokumentieren</em>, aber die Kernpunkte gelten trotzdem.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 font-semibold text-green-800 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              Pflicht (§14 UStG)
            </div>
            <ul className="text-sm text-green-900 space-y-1 list-disc list-inside">
              <li><strong>Rechnungen</strong>: lückenlos fortlaufende Nummer</li>
              <li><strong>Gutschriften</strong>: lückenlos fortlaufende Nummer</li>
              <li>einmalig, eindeutig, unveränderbar</li>
              <li>Aufbewahrung <strong>10 Jahre</strong></li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 font-semibold text-amber-800 mb-2">
              <Info className="w-4 h-4" />
              Keine Nummer-Pflicht
            </div>
            <ul className="text-sm text-amber-900 space-y-1 list-disc list-inside">
              <li><strong>Angebote</strong> (freiwillige Nummer)</li>
              <li><strong>Auftragsbestätigungen</strong></li>
              <li>Allgemeine Geschäftskorrespondenz</li>
              <li>Trotzdem: Aufbewahrung empfohlen</li>
            </ul>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-2">Unser Nummernkreis-System</h3>
          <p className="text-sm mb-2">Vorschlag für Graupner Suite (monatlich zählend):</p>
          <div className="bg-gray-50 border rounded-lg p-3 font-mono text-xs">
            <div>AN-2026-04-0001 &nbsp;— Angebot April 2026, lfd. Nr. 1 (locker)</div>
            <div>AB-2026-04-0001 &nbsp;— Auftragsbestätigung (locker)</div>
            <div>RE-2026-04-0001 &nbsp;— Rechnung (streng, §14 UStG)</div>
            <div>GU-2026-04-0001 &nbsp;— Gutschrift (streng)</div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Monatlicher Reset: erste Rechnung im April bekommt RE-2026-04-<strong>0001</strong>,
            erste im Mai wieder RE-2026-05-<strong>0001</strong>. Vorteil: Auf einen Blick weiß man
            „im April gab's 8 Rechnungen" — auch ein Prüfer versteht das sofort.
          </p>
        </section>

        <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <strong>Wichtig für eine spätere Betriebsprüfung:</strong> Der Prüfer bekommt Zugriff
              auf alle digitalen Rechnungen <em>und</em> die Möglichkeit, sich die Nummernkreise durchgehen
              zu lassen. Wenn zwischen RE-2026-04-<strong>0003</strong> und RE-2026-04-<strong>0005</strong> ein Eintrag
              fehlt, erklärst du das besser <em>vorher</em> schriftlich (z. B. „wurde vor Versand storniert").
              Unsere Software verhindert solche Lücken automatisch.
            </div>
          </div>
        </section>
      </article>

      {/* Artikel 2: Was wir in der Software eingebaut haben */}
      <article className="border rounded-xl bg-card p-6 space-y-4 print:border-gray-400 print:break-inside-avoid">
        <div className="flex items-center gap-2 border-b pb-3">
          <FileCheck className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">So arbeitet unsere Software GoBD-konform</h2>
        </div>

        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Atomare Nummernvergabe:</strong> Die Software vergibt Rechnungsnummern so,
              dass zwei Rechnungen nicht dieselbe Nummer bekommen können — selbst wenn Thorsten und die
              Buchhaltung gleichzeitig arbeiten.
            </div>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Unveränderbarkeit:</strong> Sobald eine Rechnung erstellt ist, kann sie nicht mehr
              <em> gelöscht</em>, sondern nur <strong>storniert</strong> werden (via Gutschrift). Das entspricht der GoBD.
            </div>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Audit-Log:</strong> Für jede Nummernvergabe gibt es einen Protokolleintrag
              (Zeitpunkt, wer, für welches Dokument).
            </div>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Lücken-Prüfung auf Knopfdruck:</strong> „Zeig mir alle Lücken in 2026" →
              System zeigt in 1 Sekunde, ob die Zählung komplett ist. Nutze das vor jedem Steuertermin.
            </div>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Aufbewahrung 10 Jahre:</strong> Alle Rechnungen liegen in der Datenbank und im Object
              Storage. Beide werden automatisch gesichert.
            </div>
          </li>
        </ul>
      </article>

      {/* Artikel 3: Was wir tun müssen */}
      <article className="border rounded-xl bg-card p-6 space-y-4 print:border-gray-400 print:break-inside-avoid">
        <div className="flex items-center gap-2 border-b pb-3">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Was wir als Familie tun sollten</h2>
        </div>

        <ol className="space-y-2 text-sm list-decimal list-inside">
          <li>
            <strong>Software benutzen</strong> — nicht mehr mit Word/Excel Rechnungen schreiben, sobald
            wir die Graupner Suite produktiv nutzen.
          </li>
          <li>
            <strong>Stornieren statt Löschen</strong> — eine falsche Rechnung wird per Gutschrift aufgehoben,
            nicht einfach gelöscht.
          </li>
          <li>
            <strong>Keine manuellen Nummern vergeben</strong> — immer die Software machen lassen.
          </li>
          <li>
            <strong>Monatlicher Check</strong> — einmal im Monat „Lücken-Prüfung" klicken, sichert uns ab.
          </li>
          <li>
            <strong>Jahres-Export</strong> — Anfang jedes neuen Jahres alle Rechnungen des Vorjahres
            als CSV/PDF exportieren und sicher ablegen (z. B. verschlüsselter USB-Stick im Safe).
          </li>
          <li>
            <strong>Bei Betriebsprüfung</strong> — ruhig bleiben, Zugriff geben, Lücken-Liste zeigen.
            Wir haben sauberes System.
          </li>
        </ol>
      </article>

      {/* Artikel 4: Besonderheit Familienbetrieb */}
      <article className="border rounded-xl bg-card p-6 space-y-4 print:border-gray-400 print:break-inside-avoid">
        <div className="flex items-center gap-2 border-b pb-3">
          <AlertCircle className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Familienbetrieb — was besonders ist</h2>
        </div>

        <p className="text-sm">
          Als Familienbetrieb mit Senior (Ralph), Geselle (Thorsten) und Aushilfen sind wir
          ein Kleinbetrieb. Das bedeutet:
        </p>

        <ul className="space-y-2 text-sm list-disc list-inside">
          <li>
            <strong>Verhältnismäßigkeits-Prinzip:</strong> Wir müssen kein riesiges internes
            Kontrollsystem dokumentieren wie ein Konzern. Einfache, nachvollziehbare Abläufe reichen.
          </li>
          <li>
            <strong>Verfahrensdokumentation:</strong> Eine kurze (1-2-seitige) schriftliche
            Beschreibung wie wir arbeiten ist empfehlenswert — spätestens zur Nachfolge-Übergabe Pflicht.
          </li>
          <li>
            <strong>Aufgabenteilung klären:</strong> Wer darf Rechnungen freigeben? Wer storniert?
            Am besten in der Verfahrensdoku festhalten.
          </li>
          <li>
            <strong>Nachfolge-Vorbereitung:</strong> Ein sauberes System macht uns bei einem
            späteren Verkauf / einer Übergabe an Thorsten deutlich wertvoller.
          </li>
        </ul>
      </article>

      {/* Footer nur im Druck */}
      <div className="hidden print:block text-center text-xs text-gray-500 mt-4 pt-2 border-t">
        Dieses Dokument ist ein interner Leitfaden für Familienbesprechungen und ersetzt keine Steuerberatung.
      </div>
    </div>
  );
}

export default WissenPage;
