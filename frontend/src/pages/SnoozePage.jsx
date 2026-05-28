import { useState, useEffect, useMemo, useRef } from "react";
import { Clock, CheckCircle2, X } from "lucide-react";

const HOURS = [1, 2, 4, 8];

const LABEL = {
  quote: "Angebots-Wiedervorlage",
  invoice: "Rechnungs-Erinnerung",
  task: "Aufgabe",
  termin: "Termin",
};

export default function SnoozePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const entityType = params.get("type");
  const entityId = params.get("id");
  const token = params.get("token");
  const [phase, setPhase] = useState("choose"); // choose | sending | success | invalid | error
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [animateIn, setAnimateIn] = useState(false);
  const closeTimerRef = useRef(null);

  const valid = entityType && entityId && token;
  const friendlyType = LABEL[entityType] || "Eintrag";

  useEffect(() => {
    if (!valid) {
      setPhase("invalid");
      return;
    }
    // Trigger Einblende-Animation nach Mount
    const t = setTimeout(() => setAnimateIn(true), 20);
    return () => clearTimeout(t);
  }, [valid]);

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  const tryClose = () => {
    setAnimateIn(false);
    setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 220);
  };

  const snooze = async (h) => {
    if (phase === "sending") return;
    setPhase("sending");
    try {
      const res = await fetch("/api/push/quick-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          push_token: token,
          entity_type: entityType,
          entity_id: entityId,
          action: "snooze",
          snooze_hours: h,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler beim Verschieben");
      setResult({ hours: h, until: data.snooze_until });
      setPhase("success");
      closeTimerRef.current = setTimeout(tryClose, 1800);
    } catch (e) {
      setErrMsg(e.message || "Konnte nicht verschieben");
      setPhase("error");
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center sm:items-center justify-center transition-opacity duration-200 ${animateIn ? "opacity-100" : "opacity-0"}`}
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={tryClose}
      data-testid="snooze-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          bg-background border shadow-2xl
          w-full sm:max-w-sm
          rounded-t-2xl sm:rounded-2xl
          self-end sm:self-auto
          transition-transform duration-200
          ${animateIn ? "translate-y-0" : "translate-y-full sm:translate-y-2"}
        `}
        data-testid="snooze-sheet"
      >
        {/* Drag-Indikator (nur Mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight">Erinnere mich später</h1>
              <p className="text-xs text-muted-foreground truncate">{friendlyType}</p>
            </div>
          </div>
          <button
            onClick={tryClose}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Schließen"
            data-testid="btn-snooze-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 pt-2">
          {phase === "invalid" && (
            <div className="text-center py-4">
              <X className="w-10 h-10 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Ungültiger Link. Bitte öffne die Erinnerung erneut aus dem Push-Popup.
              </p>
            </div>
          )}

          {(phase === "choose" || phase === "sending") && (
            <>
              <p className="text-sm text-muted-foreground mb-3">In wie vielen Stunden?</p>
              <div className="grid grid-cols-4 gap-2">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    onClick={() => snooze(h)}
                    disabled={phase === "sending"}
                    className="aspect-square rounded-xl border-2 border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                    data-testid={`btn-snooze-${h}h`}
                  >
                    <div className="text-xl font-bold leading-none">{h}h</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "success" && result && (
            <div className="text-center py-3" data-testid="snooze-success">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Erinnerung in {result.hours} Std</p>
              {result.until && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(result.until).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </p>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="text-center py-3" data-testid="snooze-error">
              <X className="w-10 h-10 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive mb-3">{errMsg}</p>
              <button
                onClick={() => setPhase("choose")}
                className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted"
              >
                Erneut versuchen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
