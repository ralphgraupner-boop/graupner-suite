import { useState, useEffect, useMemo, useRef } from "react";
import { Mic, MicOff, CheckCircle2, X, Clock, Sparkles, Loader2 } from "lucide-react";

const HOURS = [1, 2, 4, 8];

const LABEL = {
  quote: "Angebots-Wiedervorlage",
  invoice: "Rechnungs-Erinnerung",
  task: "Aufgabe",
  termin: "Termin",
};

// ---------------------------------------------------------------------------
// Mein-Assistent Phase 1
// Erste Bausteine eines KI-Assistenten: Quick-Actions + Sprache.
// Erweiterbar: Voice-Befehle werden lokal per Schlüsselwort gemappt.
// Spätere Phasen können den Text an einen LLM-Intent-Endpoint senden.
// ---------------------------------------------------------------------------

const interpretVoiceCommand = (text) => {
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;
  // Erledigt-Varianten
  const doneWords = ["erledigt", "fertig", "abgeschlossen", "erledige das", "ist erledigt", "ist fertig", "done"];
  if (doneWords.some((w) => t.includes(w))) return { type: "done" };
  // Snooze
  const numMap = {
    "1": 1, "ein": 1, "eine": 1, "einer": 1,
    "2": 2, "zwei": 2,
    "3": 4, "drei": 4, // Sonderfall: 3 wird auf 4 gerundet (nur 1/2/4/8 erlaubt)
    "4": 4, "vier": 4,
    "5": 4, "fünf": 4, "fuenf": 4,
    "6": 8, "sechs": 8,
    "7": 8, "sieben": 8,
    "8": 8, "acht": 8,
  };
  // Suchmuster: "X stund" oder "in X stund"
  const m = t.match(/(?:in\s+)?(\d+|ein(?:e|er)?|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht)\s*stund/);
  if (m && numMap[m[1]] !== undefined) {
    return { type: "snooze", hours: numMap[m[1]] };
  }
  // „Später" allein → 2 Std Default
  if (t.includes("später") || t.includes("spater")) return { type: "snooze", hours: 2 };
  return null;
};

export default function SnoozePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const entityType = params.get("type");
  const entityId = params.get("id");
  const token = params.get("token");

  const [phase, setPhase] = useState("ready"); // ready | sending | success | invalid | error
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [animateIn, setAnimateIn] = useState(false);

  // Voice
  const [recSupported, setRecSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceNote, setVoiceNote] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const valid = entityType && entityId && token;
  const friendlyType = LABEL[entityType] || "Eintrag";

  useEffect(() => {
    if (!valid) { setPhase("invalid"); return; }
    if (typeof window !== "undefined" && (!navigator?.mediaDevices?.getUserMedia || !window.MediaRecorder)) {
      setRecSupported(false);
    }
    const t = setTimeout(() => setAnimateIn(true), 20);
    return () => {
      clearTimeout(t);
      try { recorderRef.current?.stop(); } catch { /* noop */ }
      streamRef.current?.getTracks()?.forEach((tr) => tr.stop());
      clearInterval(timerRef.current);
    };
  }, [valid]);

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  const tryClose = () => {
    setAnimateIn(false);
    setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 220);
  };

  // ── Aktion ausführen ────────────────────────────────────────────────────
  const sendAction = async (action, hours) => {
    if (phase === "sending") return;
    setPhase("sending");
    setErrMsg("");
    try {
      const body = {
        push_token: token,
        entity_type: entityType,
        entity_id: entityId,
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
      setResult({ action, hours, until: data.snooze_until, message: data.message });
      setPhase("success");
      closeTimerRef.current = setTimeout(tryClose, 1800);
    } catch (e) {
      setErrMsg(e.message || "Aktion fehlgeschlagen");
      setPhase("error");
    }
  };

  // ── Voice ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!recSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : (MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "");
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleVoiceStop;
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      setVoiceText("");
      setVoiceNote("");
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (err) {
      setVoiceNote("Mikrofon-Zugriff verweigert");
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks()?.forEach((t) => t.stop());
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleVoiceStop = async () => {
    setVoiceProcessing(true);
    try {
      const type = recorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size < 1000) { setVoiceNote("Aufnahme zu kurz"); return; }
      const ext = type.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `aufnahme.${ext}`);
      fd.append("language", "de");
      fd.append("token", token);
      const r = await fetch("/api/push/voice", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Transkription fehlgeschlagen");
      const txt = (data.text || "").trim();
      setVoiceText(txt);
      const cmd = interpretVoiceCommand(txt);
      if (cmd?.type === "done") {
        setVoiceNote("Verstanden: Erledigt");
        sendAction("done");
      } else if (cmd?.type === "snooze") {
        setVoiceNote(`Verstanden: Erinnerung in ${cmd.hours} Std`);
        sendAction("snooze", cmd.hours);
      } else {
        setVoiceNote("Ich habe dich nicht verstanden. Bitte tippe eine der Optionen unten an.");
      }
    } catch (err) {
      setVoiceNote(err.message || "Transkription fehlgeschlagen");
    } finally {
      setVoiceProcessing(false);
    }
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-end sm:items-center justify-center transition-opacity duration-200 ${animateIn ? "opacity-100" : "opacity-0"}`}
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={tryClose}
      data-testid="assistant-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-background border shadow-2xl w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl transition-transform duration-200 ${animateIn ? "translate-y-0" : "translate-y-full sm:translate-y-2"}`}
        data-testid="assistant-sheet"
      >
        {/* Drag-Indikator (Mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight">Mein Assistent</h1>
              <p className="text-xs text-muted-foreground truncate">{friendlyType}</p>
            </div>
          </div>
          <button onClick={tryClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Schließen" data-testid="btn-assistant-close">
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

          {(phase === "ready" || phase === "sending") && (
            <>
              {/* Begrüßung */}
              <p className="text-sm mb-4">
                Hallo Ralph 👋 — soll ich dich an diese {friendlyType} später erinnern, oder ist das schon erledigt?
              </p>

              {/* Mikrofon prominent */}
              <div className="flex flex-col items-center mb-5">
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={!recSupported || voiceProcessing || phase === "sending"}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg ${
                    recording
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  data-testid="btn-assistant-mic"
                  title={recording ? "Aufnahme stoppen" : "Spracheingabe starten"}
                >
                  {voiceProcessing
                    ? <Loader2 className="w-8 h-8 animate-spin" />
                    : recording
                      ? <MicOff className="w-8 h-8" />
                      : <Mic className="w-8 h-8" />}
                </button>
                <div className="text-xs text-muted-foreground mt-2 h-4">
                  {!recSupported && "Mikrofon nicht unterstützt"}
                  {recSupported && recording && <span className="text-destructive font-medium">Aufnahme läuft · {fmtTime(recSeconds)}</span>}
                  {recSupported && !recording && !voiceProcessing && voiceText === "" && "Sprich z. B. 'Erledigt' oder 'In 2 Stunden'"}
                  {voiceProcessing && "Wird verarbeitet..."}
                  {voiceText && !recording && !voiceProcessing && (
                    <span className="italic">„{voiceText}"</span>
                  )}
                </div>
                {voiceNote && (
                  <div className="text-xs text-primary mt-1 font-medium">{voiceNote}</div>
                )}
              </div>

              {/* Quick-Actions */}
              <p className="text-xs text-muted-foreground mb-2">Oder tippe direkt:</p>
              <div className="grid grid-cols-5 gap-2">
                <button
                  onClick={() => sendAction("done")}
                  disabled={phase === "sending"}
                  className="col-span-1 aspect-square rounded-xl bg-green-600 text-white hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center justify-center"
                  data-testid="btn-assistant-done"
                  title="Als erledigt markieren"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Erledigt</span>
                </button>
                {HOURS.map((h) => (
                  <button
                    key={h}
                    onClick={() => sendAction("snooze", h)}
                    disabled={phase === "sending"}
                    className="aspect-square rounded-xl border-2 border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                    data-testid={`btn-assistant-snooze-${h}h`}
                  >
                    <Clock className="w-4 h-4 opacity-70" />
                    <span className="text-base font-bold leading-none mt-0.5">{h}h</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "success" && result && (
            <div className="text-center py-3" data-testid="assistant-success">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
              {result.action === "done" ? (
                <p className="text-sm font-medium">Als erledigt markiert ✓</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Erinnerung in {result.hours} Std</p>
                  {result.until && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(result.until).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="text-center py-3" data-testid="assistant-error">
              <X className="w-10 h-10 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive mb-3">{errMsg}</p>
              <button onClick={() => setPhase("ready")} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted">
                Erneut versuchen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
