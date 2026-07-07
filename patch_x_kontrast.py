#!/usr/bin/env python3
"""
Patch-Skript: Macht den X-Schliessen-Knopf in der Textvorlagen-Auswahl
in allen Farbschemata (auch dark-blue) sichtbar, indem er eine
dauerhafte, leicht abgesetzte Flaeche und eine feste Kontrastfarbe bekommt.
Betrifft: TextTemplateSelect.jsx (grosser Auswahl-Dialog) und
          VorlagenPicker.jsx (kleines Auswahl-Dropdown).
Alles-oder-nichts: erst pruefen, dann Backup, dann schreiben.
"""

import shutil
import sys
from datetime import datetime

DATEIEN = [
    {
        "pfad": "/home/graupner/graupner-suite/frontend/src/components/TextTemplateSelect.jsx",
        "alt": '<button onClick={onClose} className="p-2 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>',
        "neu": '<button onClick={onClose} className="p-2 bg-muted/40 hover:bg-muted rounded-sm border border-border text-foreground" aria-label="Schließen"><X className="w-5 h-5" /></button>',
    },
    {
        "pfad": "/home/graupner/graupner-suite/frontend/src/components/VorlagenPicker.jsx",
        "alt": '<button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded-sm" aria-label="Schließen">',
        "neu": '<button onClick={() => setOpen(false)} className="p-1 bg-muted/40 hover:bg-muted rounded-sm border border-border text-foreground" aria-label="Schließen">',
    },
]


def main():
    # Phase 1: pruefen
    inhalte = {}
    for eintrag in DATEIEN:
        with open(eintrag["pfad"], "r", encoding="utf-8") as f:
            inhalt = f.read()
        anzahl = inhalt.count(eintrag["alt"])
        if anzahl != 1:
            print(f"ABBRUCH: Fundstelle in {eintrag['pfad']} kommt {anzahl}x vor (erwartet: 1). Es wurde NICHTS geaendert.")
            sys.exit(1)
        print(f"OK: Fundstelle in {eintrag['pfad']} genau 1x gefunden.")
        inhalte[eintrag["pfad"]] = inhalt

    # Phase 2: Backup
    zeitstempel = datetime.now().strftime("%Y%m%d_%H%M%S")
    for eintrag in DATEIEN:
        backup_pfad = f"{eintrag['pfad']}.backup_x_kontrast_{zeitstempel}"
        shutil.copy2(eintrag["pfad"], backup_pfad)
        print(f"Backup angelegt: {backup_pfad}")

    # Phase 3: Schreiben
    for eintrag in DATEIEN:
        neuer_inhalt = inhalte[eintrag["pfad"]].replace(eintrag["alt"], eintrag["neu"])
        with open(eintrag["pfad"], "w", encoding="utf-8") as f:
            f.write(neuer_inhalt)
        print(f"Geschrieben: {eintrag['pfad']}")

    print("FERTIG: Alle Aenderungen erfolgreich geschrieben.")


if __name__ == "__main__":
    main()
