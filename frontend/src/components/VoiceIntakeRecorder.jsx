import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * VoiceIntakeRecorder
 * -------------------
 * Browser-Mikrofon → MediaRecorder (webm/opus) → Backend Whisper-Endpoint.
 * Unterstützt zwei Modi:
 *   • mit Login: POST /api/voice-intake/transcribe-and-structure
 *   • ohne Login (Mitarbeiter-Link): POST /api/voice-intake/transcribe-public/{token}
 *
 * Props:
 *   onResult({text, fields}) — wird aufgerufen wenn Aufnahme + Strukturierung fertig sind
 *   publicToken (optional)  — wenn gesetzt: ohne-Login-Pfad
 */
export const VoiceIntakeRecorder = ({ onResult, publicToken = null, compact = false }) => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [supported, setSupported] = useState(true);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator?.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setSupported(false);
    }
    return () => {
      try { recorderRef.current?.stop(); } catch { /* noop */ }
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
      clearInterval(timerRef.current);
    };
  }, []);

  const start = async () => {
    if (!supported) {
      toast.error("Dein Browser unterstützt keine Sprachaufnahme.");
      return;
    }
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
      rec.onstop = handleStop;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      toast.error("Mikrofon-Zugriff verweigert: " + (err?.message || ""));
    }
  };

  const stop = () => {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks()?.forEach((t) => t.stop());
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleStop = async () => {
    setProcessing(true);
    try {
      const type = recorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size < 1000) {
        toast.error("Aufnahme zu kurz (< 1 Sekunde).");
        return;
      }
      const ext = type.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `aufnahme.${ext}`);
      fd.append("language", "de");
      const url = publicToken
        ? `/voice-intake/transcribe-public/${publicToken}`
        : "/voice-intake/transcribe-and-structure";
      const r = await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (onResult) onResult(r.data || {});
      toast.success("Aufnahme transkribiert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Transkription fehlgeschlagen");
    } finally {
      setProcessing(false);
    }
  };

  if (!supported) {
    return (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm p-2">
        Sprachaufnahme nicht unterstützt — bitte aktuellen Browser auf Smartphone verwenden.
      </div>
    );
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={processing}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm border transition-colors ${recording ? "bg-red-500 text-white border-red-500 animate-pulse" : "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200"} disabled:opacity-50`}
        data-testid="voice-intake-btn"
      >
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {processing ? "Verarbeite…" : recording ? `Stop (${fmt(seconds)})` : "Sprachnotiz"}
      </button>
    );
  }

  return (
    <div className="rounded-sm border border-violet-200 bg-violet-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-700" />
        <div className="text-sm font-medium text-violet-900">Besichtigung einsprechen</div>
      </div>
      <p className="text-xs text-violet-800">
        Sprich frei: Objekt, Material, Hersteller, Alter, Schaden. Die KI macht
        daraus einen Text und füllt die Felder vor.
      </p>
      <div className="flex items-center gap-2">
        {!recording && !processing && (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-violet-600 text-white hover:bg-violet-700"
            data-testid="voice-intake-start"
          >
            <Mic className="w-4 h-4" />
            Aufnahme starten
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-red-600 text-white hover:bg-red-700 animate-pulse"
            data-testid="voice-intake-stop"
          >
            <Square className="w-4 h-4" />
            Stop ({fmt(seconds)})
          </button>
        )}
        {processing && (
          <div className="inline-flex items-center gap-2 px-3 py-2 text-sm text-violet-800">
            <Loader2 className="w-4 h-4 animate-spin" />
            Transkribiere & strukturiere…
          </div>
        )}
      </div>
    </div>
  );
};


/**
 * VoiceIntakeResultModal
 * ----------------------
 * Zeigt Transkript + KI-Vorschläge nach Aufnahme. Nutzer kann Werte
 * übernehmen (onApply) oder verwerfen.
 */
export const VoiceIntakeResultModal = ({ result, onClose, onApply }) => {
  if (!result) return null;
  const { text, fields = {} } = result;
  const fieldOrder = ["reparaturgruppe", "material", "hersteller", "alter_jahre", "schaden", "beschreibung", "farbe", "abmessungen", "sonstiges"];
  const visible = fieldOrder.filter((k) => fields?.[k]);
  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4" data-testid="voice-result-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" /> Transkript & KI-Vorschläge
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-auto">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Transkript</div>
            <div className="text-sm bg-muted/40 p-2 rounded-sm whitespace-pre-wrap" data-testid="voice-text">
              {text || <span className="italic text-muted-foreground">Kein Text erkannt</span>}
            </div>
          </div>
          {visible.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">KI-Vorschläge</div>
              <div className="space-y-1.5">
                {visible.map((k) => (
                  <div key={k} className="flex gap-2 text-sm">
                    <span className="font-medium w-32 capitalize text-violet-800">{k.replace(/_/g, " ")}:</span>
                    <span className="flex-1">{String(fields[k])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {visible.length === 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm p-2">
              Keine strukturierten Felder erkannt — nur Roh-Transkript verfügbar.
            </div>
          )}
        </div>
        <div className="p-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded-sm hover:bg-muted">Verwerfen</button>
          {onApply && (
            <button onClick={() => { onApply({ text, fields }); onClose(); }} className="px-3 py-2 text-sm font-medium rounded-sm bg-violet-600 text-white hover:bg-violet-700 inline-flex items-center gap-1.5" data-testid="btn-voice-apply">
              <Check className="w-4 h-4" /> Übernehmen
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceIntakeRecorder;
