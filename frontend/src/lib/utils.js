import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/* Konvertiert Plain-Text (mit \n) sicher zu HTML fuer die Anzeige.
   - HTML-Sonderzeichen werden escaped, damit keine fremden Tags interpretiert werden
   - Zeilenumbrueche werden zu <br/>
   - Enthaelt der Text bereits eigene HTML-Tags (z.B. aus dem Rich-Text-Editor
     gespeichert), wird er unveraendert durchgereicht, damit Absaetze/Formatierung
     korrekt gerendert werden, statt als sichtbarer Rohtext zu erscheinen. */
export function safeHtmlFromText(text) {
  if (!text) return "";
  if (/<(p|br|div|span|strong|em|b|i|u)[\s>/]/i.test(text)) return text;
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

/* Wandelt HTML (z.B. aus dem Rich-Text-Editor gespeichert) in sauberen
   Klartext um - fuer Textfelder, die den Inhalt nur als Text anzeigen/
   bearbeiten koennen (keine Formatierung). Gleiches bewaehrtes Muster wie
   in PortalsPage.jsx (applyVorlage). */
export function htmlToPlainText(text) {
  if (!text) return "";
  return String(text)
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}
