import { useEffect, useState } from "react";
import { Mic, MicOff, X, CheckCircle2, Clock } from "lucide-react";
import { VoiceIntakeRecorder } from "@/components/VoiceIntakeRecorder";
import { KiChatPanel } from "@/components/KiChatPanel";
import { toast } from "sonner";

/**
 * GlobalAssistantSheet
 *
 * Kompaktes Bottom-Sheet (Mobile) / zentriertes Modal (Desktop) für den globalen
 * Sprach-Assistenten. Zwei Modi:
 *
 *   1) DEFAULT      → Voice-Notizen (Phase 1)
 *   2) SNOOZE       → wird über Push-Benachrichtigung „⏰ Später" geöffnet:
 *                      Erledigt-Button + 1h/2h/4h/8h Snooze + Voice-Befehle.
 *                      Aktiv wenn Prop `snoozeContext` gesetzt ist.
 *
 * Designprinzip: kein Vollbild, App bleibt im Hintergrund sichtbar.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   snoozeContext: { entity_type, entity_id, push_token } | null
 */

const LABEL = {
  quote: "Angebots-Wiedervorlage",
  invoice: "Rechnungs-Erinnerung",
  task: "Aufgabe",
  termin: "Termin",
};

// Voice → Aktion (kopiert aus SnoozePage Phase 1)
const interpretVoiceCommand = (text) => {
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;
  const doneWords = ["erledigt", "fertig", "abgeschlossen", "erledige das", "ist erledigt", "ist fertig", "done"];
  if (doneWords.some((w) => t.includes(w))) return { type: "done" };
  const numMap = {
    "1": 1, "ein": 1, "eine": 1, "einer": 1,
    "2": 2, "zwei": 2,
    "3": 4, "drei": 4,
    "4": 4, "vier": 4,
    "5": 4, "fünf": 4, "fuenf": 4,
    "6": 8, "sechs": 8,
    "7": 8, "sieben": 8,
    "8": 8, "acht": 8,
  };
  const m = t.match(/(?:in\s+)?(\d+|ein(?:e|er)?|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht)\s*stund/);
  if (m && numMap[m[1]] !== undefined) return { type: "snooze", hours: numMap[m[1]] };
  if (t.includes("später") || t.includes("spater")) return { type: "snooze", hours: 2 };
  return null;
};

const NoMicBanner = () => (
  <div
    className="mb-3 flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs"
    data-testid="assistant-no-mic-banner"
  >
    <MicOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
    <div>
      <b>Mikrofon nicht verfügbar.</b><br />
      Dein Browser oder Gerät lässt keine Sprachaufnahme zu — du kannst deine Notiz aber jederzeit eintippen.
    </div>
  </div>
);

export const GlobalAssistantSheet = ({ open, onClose, snoozeContext = null }) => {
  const [micAvailable, setMicAvailable] = useState(true);
  const [phase, setPhase] = useState("ready"); // ready | sending | success | error
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  // ESC schließt
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Mikrofon-Verfügbarkeit beim Öffnen prüfen
  useEffect(() => {
    if (!open) return;
    const hasApi = typeof window !== "undefined"
      && !!navigator?.mediaDevices?.getUserMedia
      && !!window.MediaRecorder;
    setMicAvailable(hasApi);
    // State beim erneuten Öffnen zurücksetzen
    setPhase("ready");
    setResult(null);
    setErrMsg("");
  }, [open]);

  if (!open) return null;

  const sendAction = async (action, hours) => {
    if (!snoozeContext || phase === "sending") return;
    setPhase("sending");
    setErrMsg("");
    try {
      const body = {
        push_token: snoozeContext.push_token,
        entity_type: snoozeContext.entity_type,
        entity_id: snoozeContext.entity_id,
        action,
      };
      if (action === "snooze") body.snooze_hours = hours;
      const res = await fetch("/api/push/quick-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Aktion fehlgeschlagen");
      setResult({ action, hours, until: data.snooze_until });
      setPhase("success");
      setTimeout(() => { onClose?.(); }, 1800);
    } catch (e) {
      setErrMsg(e.message || "Aktion fehlgeschlagen");
      setPhase("error");
    }
  };

  const handleResult = ({ text } = {}) => {
    if (text) toast.success(`Erkannt: „${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`);
    if (snoozeContext) {
      const cmd = interpretVoiceCommand(text);
      if (cmd?.type === "done") sendAction("done");
      else if (cmd?.type === "snooze") sendAction("snooze", cmd.hours);
    }
    // Phase 2: hier wird LLM-Intent für Default-Modus ausgewertet.
  };

  const friendlyType = snoozeContext ? (LABEL[snoozeContext.entity_type] || "Erinnerung") : "Mein Assistent";

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
          <div className="flex items-center gap-2 min-w-0">
            <Mic className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight">Mein Assistent</h2>
              {snoozeContext && (
                <p className="text-xs text-muted-foreground truncate">{friendlyType}</p>
              )}
            </div>
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
          {snoozeContext ? (
            phase === "success" && result ? (
              <div className="text-center py-6" data-testid="snooze-success">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
                {result.action === "done" ? (
                  <p className="text-sm font-medium">Als erledigt markiert ✓</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">Erinnerung in {result.hours} Std</p>
                    {result.until && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(result.until).toLocaleString("de-DE", {
                          hour: "2-digit", minute: "2-digit",
                          day: "2-digit", month: "2-digit",
                          timeZone: "Europe/Berlin",
                        })} Hamburg
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : phase === "error" ? (
              <div className="text-center py-4" data-testid="snooze-error">
                <X className="w-10 h-10 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive mb-3">{errMsg}</p>
                <button
                  onClick={() => setPhase("ready")}
                  className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted"
                >
                  Erneut versuchen
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm mb-3">
                  Hallo Ralph 👋 — soll ich dich an diese {friendlyType} später erinnern, oder ist sie schon erledigt?
                </p>
                {!micAvailable && <NoMicBanner />}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  <button
                    onClick={() => sendAction("done")}
                    disabled={phase === "sending"}
                    data-testid="btn-assistant-done"
                    className="aspect-square rounded-xl bg-green-600 text-white hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center justify-center"
                    title="Als erledigt markieren"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5">Erledigt</span>
                  </button>
                  {[1, 2, 4, 8].map((h) => (
                    <button
                      key={h}
                      onClick={() => sendAction("snooze", h)}
                      disabled={phase === "sending"}
                      data-testid={`btn-assistant-snooze-${h}h`}
                      className="aspect-square rounded-xl border-2 border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                    >
                      <Clock className="w-4 h-4 opacity-70" />
                      <span className="text-base font-bold leading-none mt-0.5">{h}h</span>
                    </button>
                  ))}
                </div>
                {micAvailable && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">Oder per Sprache („erledigt" / „in 2 Stunden"):</p>
                    <VoiceIntakeRecorder onResult={handleResult} compact />
                  </>
                )}
              </>
            )
          ) : (
            <>
              {!micAvailable && <NoMicBanner />}
              <KiChatPanel compact onClose={onClose} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalAssistantSheet;
