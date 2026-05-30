import { useEffect } from "react";
import { Mic, X } from "lucide-react";
import { VoiceIntakeRecorder } from "@/components/VoiceIntakeRecorder";
import { toast } from "sonner";

/**
 * GlobalAssistantSheet
 *
 * Kompaktes Bottom-Sheet (Mobile) / zentriertes Modal (Desktop) für den globalen
 * Sprach-Assistenten. Bindet VoiceIntakeRecorder ein.
 *
 * Phase 1 (heute): Aufnahme + Whisper-Transkription + strukturierte Felder
 *   werden angezeigt. KEINE Befehls-Ausführung — kommt in Phase 2 (LLM-Intent).
 *
 * Designprinzip: kein Vollbild, App bleibt im Hintergrund sichtbar.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 */
export const GlobalAssistantSheet = ({ open, onClose }) => {
  // ESC schließt
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleResult = ({ text } = {}) => {
    if (text) toast.success(`Erkannt: „${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`);
    // Phase 2: hier wird LLM-Intent ausgewertet und Navigation/Aktion ausgelöst.
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-end sm:items-center sm:justify-center bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="assistant-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-background border shadow-2xl w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl animate-in slide-in-from-bottom duration-200"
        data-testid="assistant-sheet"
      >
        {/* Drag-Indikator (Mobile) */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base">Mein Assistent</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Schließen"
            data-testid="btn-assistant-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inhalt */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Sprich los — Notizen, Erinnerungen oder Fragen. (Befehlsausführung folgt in Phase 2.)
          </p>
          <VoiceIntakeRecorder onResult={handleResult} compact />
        </div>
      </div>
    </div>
  );
};

export default GlobalAssistantSheet;
