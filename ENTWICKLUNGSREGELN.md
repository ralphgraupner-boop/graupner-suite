# Graupner Suite – Entwicklungsregeln

Diese Regeln gelten verbindlich fuer die gesamte Graupner Suite, unabhaengig davon, welcher Agent oder Entwickler daran arbeitet.

## EP-001 – Sicherung vor jeder Architekturaenderung

Vor jeder Architekturaenderung oder groesseren Implementierung ist der aktuelle Projektstand vollstaendig in GitHub zu sichern.

Ablauf:
1. Architektur fachlich fertigstellen.
2. Architektur technisch freigeben.
3. Vollstaendigen Git-Commit erstellen.
4. Commit nach GitHub uebertragen.
5. Erst danach mit der Implementierung beginnen.
6. Implementierung in kleinen, einzeln pruefbaren Schritten durchfuehren.
7. Nach jedem erfolgreich getesteten Schritt einen eigenen Commit erstellen.

Ziel: jederzeit auf einen funktionierenden Stand zurueckkehren koennen, Architektur und Implementierung sauber trennen, nachvollziehbare Entwicklungsschritte, Risiko von Daten-/Funktionsverlust minimieren.

## EA-001 bis EA-005 – Entwicklungsarchitektur

EA-001 Geschaeftsfall vor Programmierung: (1) Geschaeftsfall beschreiben, (2) fachliche Verantwortung/Datenhoheit festlegen, (3) Navigation definieren, (4) Arbeitskontext beschreiben, (5) erst danach technische Umsetzung.

EA-002 Datenhoheit: Jede Information hat genau ein fuehrendes Modul. Andere Module duerfen sie nutzen, sind aber nicht Eigentuemer.

EA-003 Arbeitskontext: Der Nutzer arbeitet immer innerhalb eines Geschaeftsfalls; die Software darf ihn nie zwingen, seinen Arbeitsfluss neu zu beginnen.

EA-004 Keine Einzelfallprogrammierung: Vor jeder Umsetzung pruefen, ob schon ein allgemeines Muster existiert.

EA-005 Architektur vor Code: Ist der fachliche Ablauf nicht eindeutig beschrieben, darf keine Programmierung beginnen.

## AR-001 – Referenzbeschaffung (allgemeiner, wiederverwendbarer Architekturbaustein)

Beschreibt, wie ein anfragendes Modul eine Referenz auf einen Datensatz aus einer Referenzquelle (heute: Kundenmodul) erhaelt, ohne den eigenen Arbeitskontext zu verlieren. Das anfragende Modul bleibt Eigentuemer des Geschaeftsfalls; die Referenzquelle liefert ausschliesslich eine Referenz (ID) zurueck, niemals Stammdaten-Kopien. Gilt fuer jede kuenftige Kontaktart (Hausverwaltung, Lieferant, Ansprechpartner, Architekt, Gutachter, Versicherung usw.) ueber denselben Baustein, gesteuert durch einen neutralen Filterparameter.
