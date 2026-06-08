import { useEffect } from "react";

// Registry der aktuell aktiven, seiten-spezifischen F1-Kontexte.
// Damit weiss der globale Fallback (HelpSlideOver), ob eine Seite F1 bereits
// selbst behandelt — sonst oeffnet der Fallback die Workflow-Uebersicht.
export const activeF1Contexts = new Set();

/**
 * Globaler F1-Hook fuer Modul-spezifische Hilfe.
 *
 * Verwendung in einer Seite:
 *   useF1Help("hilfe_kunden");
 *
 * Wirkung:
 *   - Druecken von F1 verhindert Browser-Default-Hilfe
 *   - Setzt eine globale CustomEvent "graupner:f1-help" mit dem Kontext
 *   - HelpSlideOver (in App.js global gerendert) hoert auf das Event
 *     und oeffnet das Hilfe-Panel mit dem richtigen Kontext.
 */
export const useF1Help = (context) => {
  useEffect(() => {
    if (!context) return;
    activeF1Contexts.add(context);
    const onKey = (e) => {
      if (e.key !== "F1") return;
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("graupner:f1-help", { detail: { context } }));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      activeF1Contexts.delete(context);
    };
  }, [context]);
};
