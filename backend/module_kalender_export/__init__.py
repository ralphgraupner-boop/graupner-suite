"""
module_kalender_export – ICS-Export & E-Mail-Versand für Termine.

Module-First:
- Eigene Collection module_kalender_export_log (Audit) + module_kalender_feed_tokens (Abo-URLs)
- Eigenes Prefix /api/module-kalender-export
- Liest read-only aus module_termine, module_kunden, users
- Schreibt nicht zurück, nur Status-Update via vorhandenem /mark-im-kalender-Endpunkt (optional)

Workflow:
  Termin (bestaetigt) → POST /termin/{id}/send mit Empfaengerliste
                      → ICS generieren, Mails an alle senden
                      → Audit-Log schreiben, Status auf im_kalender setzen
  Monteur-Feed:        → GET /feed/<username>/<token>.ics → ICS aller Termine dieses Monteurs
"""
