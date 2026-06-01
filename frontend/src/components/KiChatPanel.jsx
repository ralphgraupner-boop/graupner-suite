import { useEffect, useRef, useState } from "react";
import { Mic, Send, Loader2, MessageSquare, X, History } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { VoiceIntakeRecorder } from "@/components/VoiceIntakeRecorder";

/**
 * KiChatPanel
 * -----------
 * Wiederverwendbares Chat-Panel fuer den KI-Assistenten.
 * - Wird sowohl im GlobalAssistantSheet (Bottom-Sheet) als auch in der
 *   AssistentPage (Verlauf-Seite) verwendet.
 * - Spricht denselben Endpoint: POST /api/module-assistent/ask
 * - Whisper laeuft ueber den bestehenden VoiceIntakeRecorder
 *   (transcribe-and-structure), das transkribierte Textfeld wird dann an
 *   /ask weitergereicht.
 *
 * Props:
 *   showHistory (bool)    — wenn true: Liste vergangener Konversationen
 *   onClose (fn, optional) — Schliessen-Button im Compact-Mode
 *   compact (bool)        — kleinere Optik (Sheet) vs. volle Seite
 */
export const KiChatPanel = ({ showHistory = false, onClose, compact = false }) => {
  const [konvId, setKonvId] = useState(null);
  const [beitraege, setBeitraege] = useState([]);
  const [eingabe, setEingabe] = useState("");
  const [busy, setBusy] = useState(false);
  const [konversationen, setKonversationen] = useState([]);
  const [showHist, setShowHist] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [beitraege, busy]);

  const ladeKonversationen = async () => {
    try {
      const r = await api.get("/module-assistent/konversationen");
      setKonversationen(r.data || []);
    } catch (_) {
      setKonversationen([]);
    }
  };

  useEffect(() => {
    if (showHistory) ladeKonversationen();
  }, [showHistory]);

  const oeffneKonv = async (id) => {
    try {
      const r = await api.get(`/module-assistent/konversation/${id}`);
      setKonvId(id);
      setBeitraege(r.data?.beitraege || []);
      setShowHist(false);
    } catch (e) {
      toast.error("Konversation konnte nicht geladen werden");
    }
  };

  const neueKonversation = () => {
    setKonvId(null);
    setBeitraege([]);
  };

  const senden = async (text) => {
    const eingabeText = (text ?? eingabe).trim();
    if (!eingabeText || busy) return;
    setBusy(true);
    setEingabe("");
    // Optimistisch: User-Beitrag sofort anzeigen
    setBeitraege((arr) => [...arr, { rolle: "user", text: eingabeText, zeit: new Date().toISOString() }]);
    try {
      const r = await api.post("/module-assistent/ask", {
        text: eingabeText,
        konversation_id: konvId,
        quelle: compact ? "sheet" : "page",
      });
      const data = r.data || {};
      setKonvId(data.konversation_id);
      setBeitraege((arr) => [
        ...arr,
        {
          rolle: "ki",
          text: data.antwort || "(keine Antwort)",
          tool: data.tool,
          tool_ergebnis: data.tool_ergebnis,
          zeit: new Date().toISOString(),
        },
      ]);
      if (data.tool === "termin_anlegen" && data.tool_ergebnis?.ics_mail === "versendet") {
        toast.success("Termin angelegt — ICS-Mail an Thorsten versendet");
      } else if (data.tool && data.tool_ergebnis?.ok) {
        toast.success(`Aktion ausgefuehrt: ${data.tool}`);
      }
      if (showHistory) ladeKonversationen();
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || "KI-Aufruf fehlgeschlagen";
      setBeitraege((arr) => [
        ...arr,
        { rolle: "ki", text: `Hat nicht geklappt, Ralph: ${detail}`, zeit: new Date().toISOString(), error: true },
      ]);
      toast.error(detail);
    } finally {
      setBusy(false);
    }
  };

  const onVoiceResult = ({ text } = {}) => {
    if (text && text.trim()) {
      senden(text);
    } else {
      toast.error("Nichts erkannt — bitte nochmal versuchen");
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="ki-chat-panel">
      {/* Header / Aktionen */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-medium">
            {konvId ? "Konversation laeuft" : "Neue Konversation"}
          </span>
          {beitraege.length > 0 && (
            <span className="text-xs text-muted-foreground">({beitraege.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showHistory && (
            <button
              type="button"
              onClick={() => { setShowHist((v) => !v); if (!showHist) ladeKonversationen(); }}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
              title="Verlauf"
              data-testid="ki-chat-history-btn"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          {konvId && (
            <button
              type="button"
              onClick={neueKonversation}
              className="text-xs px-2 py-1 rounded border hover:bg-muted"
              data-testid="ki-chat-new-btn"
            >
              Neu
            </button>
          )}
          {compact && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
              data-testid="ki-chat-close-btn"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Verlauf-Liste (toggle) */}
      {showHist && (
        <div
          className="border rounded-lg bg-muted/40 p-2 max-h-48 overflow-y-auto space-y-1"
          data-testid="ki-chat-history-list"
        >
          {konversationen.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Noch keine Konversationen.</p>
          ) : (
            konversationen.map((k) => (
              <button
                key={k.id}
                onClick={() => oeffneKonv(k.id)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-background text-sm flex items-center justify-between gap-2"
                data-testid={`ki-chat-history-item-${k.id}`}
              >
                <span className="truncate">{k.titel || "(ohne Titel)"}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {k.anzahl_beitraege} Beitr.
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Chat-Verlauf */}
      <div
        className={`border rounded-lg bg-background overflow-y-auto p-3 space-y-2 ${
          compact ? "h-56" : "h-[420px]"
        }`}
        data-testid="ki-chat-messages"
      >
        {beitraege.length === 0 && !busy && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>Sag mir was, Ralph.</p>
            <p className="text-xs mt-1">
              z. B. „Termin morgen 10 Uhr mit Mueller" oder „Notiz: Lieferant Hautau +5%"
            </p>
          </div>
        )}
        {beitraege.map((b, i) => (
          <div
            key={i}
            className={`flex ${b.rolle === "user" ? "justify-end" : "justify-start"}`}
            data-testid={`ki-chat-msg-${b.rolle}-${i}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                b.rolle === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : b.error
                  ? "bg-red-50 text-red-900 border border-red-200 rounded-bl-sm"
                  : "bg-muted rounded-bl-sm"
              }`}
            >
              {b.text}
              {b.tool && !b.error && (
                <div className="mt-1 text-[10px] opacity-70 italic">→ {b.tool}</div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            KI denkt nach…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Eingabezeile */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); senden(); } }}
          placeholder="Tippen oder Mikro nutzen…"
          disabled={busy}
          className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="ki-chat-input"
        />
        <button
          type="button"
          onClick={() => senden()}
          disabled={busy || !eingabe.trim()}
          className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
          data-testid="ki-chat-send-btn"
          aria-label="Senden"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Sprachaufnahme */}
      <div data-testid="ki-chat-voice">
        <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
          <Mic className="w-3 h-3" /> oder direkt einsprechen:
        </p>
        <VoiceIntakeRecorder onResult={onVoiceResult} compact />
      </div>
    </div>
  );
};

export default KiChatPanel;
