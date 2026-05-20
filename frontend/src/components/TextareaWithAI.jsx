import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Textarea } from "@/components/common";
import { TextKorrekturModal } from "@/components/wysiwyg/TextKorrekturModal";

/**
 * TextareaWithAI
 * --------------
 * Textarea mit zwei kleinen KI-Helfern:
 *   • Mikrofon-Button     → Sprachaufnahme → Whisper-Transkript hinten anhaengen
 *   • Korrektur-Button    → Rechtschreibung/Grammatik (TextKorrekturModal)
 *
 * Drop-In-Ersatz fuer <Textarea>:
 *   <TextareaWithAI value={x} onChange={e => setX(e.target.value)} ... />
 *
 * Optional:
 *   feldLabel  — fuer das Korrektur-Modal ("Notizen", "Beschreibung", ...)
 *   kontext    — fuer die KI-Korrektur ("kunden_notizen", "aufgabe", ...)
 *   testId     — Praefix fuer data-testid
 */
export const TextareaWithAI = ({
  value = "",
  onChange,
  feldLabel = "Text",
  kontext = "freitext",
  rows = 3,
  placeholder = "",
  className = "",
  testId,
  disabled = false,
  ...rest
}) => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showKorrektur, setShowKorrektur] = useState(false);
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

  const startRecording = async () => {
    if (!supported) { toast.error("Dein Browser unterstuetzt keine Sprachaufnahme."); return; }
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

  const stopRecording = () => {
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
      if (blob.size < 1000) { toast.error("Aufnahme zu kurz (< 1 Sekunde)."); return; }
      const ext = type.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `aufnahme.${ext}`);
      fd.append("language", "de");
      const r = await api.post("/voice-intake/transcribe", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const neuerText = (r.data?.text || "").trim();
      if (!neuerText) { toast.error("Kein Text erkannt."); return; }
      const sep = value && !value.endsWith("\n") ? " " : "";
      const merged = (value || "") + sep + neuerText;
      onChange?.({ target: { value: merged } });
      toast.success("Aufnahme transkribiert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Transkription fehlgeschlagen");
    } finally {
      setProcessing(false);
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const istLeer = !(value || "").trim();

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={`pr-2 ${className}`}
        data-testid={testId ? `${testId}-input` : undefined}
        {...rest}
      />
      <div className="flex items-center justify-end gap-2 mt-1.5">
        {supported && (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={processing || disabled}
            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-sm border transition-colors ${
              recording
                ? "bg-red-500 text-white border-red-500 animate-pulse"
                : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800"
            } disabled:opacity-50`}
            title={recording ? "Aufnahme stoppen" : "Diktat starten — gesprochener Text wird hinten angehaengt"}
            data-testid={testId ? `${testId}-mic` : "btn-mic"}
          >
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : recording ? <Square className="w-3.5 h-3.5" />
              : <Mic className="w-3.5 h-3.5" />}
            <span>{processing ? "Verarbeite…" : recording ? `Stop (${fmt(seconds)})` : "Diktat"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowKorrektur(true)}
          disabled={istLeer || disabled}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-sm border border-border bg-muted text-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={istLeer ? "Text ist leer" : "Rechtschreibung und Grammatik mit KI pruefen"}
          data-testid={testId ? `${testId}-korrektur` : "btn-textkorrektur"}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Korrigieren</span>
        </button>
      </div>
      <TextKorrekturModal
        isOpen={showKorrektur}
        onClose={() => setShowKorrektur(false)}
        original={value || ""}
        kontext="allgemein"
        feldLabel={feldLabel}
        onAccept={(korrigiert) => onChange?.({ target: { value: korrigiert } })}
      />
    </div>
  );
};

export default TextareaWithAI;
