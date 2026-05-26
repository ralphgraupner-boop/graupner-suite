"""module_wolke — interne Kurzkommunikation zwischen Mitarbeitern.

Module-First:
- Schreibt NUR in module_wolke (eigene Collection)
- Liest aus 'mitarbeiter' (Empfänger-Daten) und 'module_kunden' (optionale Verknüpfung)
- KEIN Eingriff in module_aufgaben / users / Einsätze

Typen:
- 'memo'     — reine Info. Wird NICHT in count-offen mitgezählt.
- 'aufgabe'  — muss vom Empfänger mit 'Erledigt' bestätigt werden.

Voice-Reuse: Frontend nutzt module_voice_intake POST /api/transcribe. Im Wolke-Doc
wird ausschliesslich das Transkript als 'text' gespeichert, kein Audio.
"""
