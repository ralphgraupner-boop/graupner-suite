import { useHelp } from "@/lib/helpContext";
import { Lightbulb, LightbulbOff } from "lucide-react";
import { toast } from "sonner";

/**
 * Globaler Hilfe-Schalter — erscheint unten rechts auf jeder Seite.
 * Schaltet den Hilfe-Modus an/aus. Status wird im Browser gespeichert.
 */
export const HelpToggle = () => {
  const { enabled, setEnabled } = useHelp();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    toast[next ? "success" : "info"](
      next
        ? "Hilfe-Modus aktiviert — Fahren Sie mit der Maus über Buttons für Erklärungen."
        : "Hilfe-Modus deaktiviert.",
      { duration: 3000 }
    );
  };

  return (
    <button
      onClick={toggle}
      data-testid="btn-help-toggle"
      title={enabled ? "Hilfe-Modus ausschalten" : "Hilfe-Modus einschalten"}
      className={`
        fixed bottom-24 lg:bottom-6 right-6 z-40
        w-14 h-14 rounded-full shadow-lg hover:shadow-xl
        flex items-center justify-center transition-all duration-200
        hover:scale-110 active:scale-95
        ${enabled
          ? "bg-amber-400 hover:bg-amber-500 text-amber-950 ring-4 ring-amber-200 animate-pulse-slow"
          : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border"
        }
      `}
      aria-pressed={enabled}
      aria-label="Hilfe-Modus"
    >
      {enabled ? (
        <Lightbulb className="w-6 h-6" fill="currentColor" strokeWidth={1.5} />
      ) : (
        <LightbulbOff className="w-6 h-6" strokeWidth={1.5} />
      )}
      {enabled && (
        <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
          HILFE
        </span>
      )}
    </button>
  );
};
