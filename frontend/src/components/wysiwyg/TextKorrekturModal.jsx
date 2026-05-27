import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Wand2, X, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Wort-Diff: tokenisiert beide Texte und markiert Wörter, die sich vom
 * Original unterscheiden. Bewusst einfach gehalten (kein LCS):
 * Wir vergleichen wortweise an der gleichen Position; reicht, um dem User
 * optisch zu zeigen, was sich geändert hat.
 */
function highlightDiff(original, corrected) {
  const oTokens = (original || "").split(/(\s+)/);
  const cTokens = (corrected || "").split(/(\s+)/);
  // Set der Originalwörter (nur Wörter, keine Whitespaces) für schnelle
  // Mitgliedschaftsprüfung — toleriert verschobene Wortpositionen.
  const oWords = new Set(
    oTokens.filter((t) => !/^\s+$/.test(t) && t.length > 0).map((t) => t.toLowerCase()),
  );
  return cTokens.map((t, idx) => {
    if (/^\s+$/.test(t) || t.length === 0) {
      return { text: t, changed: false, idx };
    }
    const norm = t.toLowerCase();
    return { text: t, changed: !oWords.has(norm), idx };
  });
}

export const TextKorrekturModal = ({
  isOpen,
  onClose,
  original,
  kontext,
  feldLabel,
  onAccept,
}) => {
  const [loading, setLoading] = useState(false);
  const [corrected, setCorrected] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setCorrected("");
    (async () => {
      try {
        const res = await api.post("/module-textkorrektur/check", {
          text: original,
          kontext,
        });
        if (!cancelled) {
          setCorrected(res.data?.corrected || original);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || "Korrektur fehlgeschlagen");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, original, kontext]);

  const diffTokens = useMemo(
    () => (corrected ? highlightDiff(original, corrected) : []),
    [original, corrected],
  );

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!corrected.trim()) {
      toast.error("Korrigierter Text ist leer");
      return;
    }
    onAccept(corrected);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="textkorrektur-modal"
    >
      <div
        className="bg-card text-card-foreground rounded-lg shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            KI-Korrektur: {feldLabel}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-sm"
            data-testid="btn-korrektur-close"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>KI prüft den Text …</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-sm p-3 text-sm">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Original
                </div>
                <div
                  className="bg-muted/50 border border-border rounded-sm p-3 text-sm whitespace-pre-wrap min-h-[200px] max-h-[60vh] overflow-auto font-mono"
                  data-testid="textkorrektur-original"
                >
                  {original}
                </div>
              </div>

              {/* Korrektur (editierbar) */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide flex items-center justify-between">
                  <span>Korrektur (editierbar)</span>
                  {corrected === original ? (
                    <span className="text-emerald-700 dark:text-emerald-400 normal-case font-normal">
                      Keine Änderungen nötig
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400 normal-case font-normal">
                      Änderungen markiert
                    </span>
                  )}
                </div>
                <textarea
                  value={corrected}
                  onChange={(e) => setCorrected(e.target.value)}
                  className="w-full bg-background border border-input rounded-sm p-3 text-sm whitespace-pre-wrap min-h-[200px] max-h-[60vh] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="textkorrektur-corrected-textarea"
                />
                {/* Diff-Vorschau unter dem Textarea */}
                {corrected !== original && (
                  <div
                    className="mt-2 bg-muted/30 border border-border rounded-sm p-3 text-sm whitespace-pre-wrap max-h-40 overflow-auto"
                    data-testid="textkorrektur-diff-preview"
                    title="Geänderte Wörter sind gelb hervorgehoben"
                  >
                    {diffTokens.map((tok) =>
                      tok.changed ? (
                        <mark
                          key={tok.idx}
                          className="bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100 rounded-sm px-0.5"
                        >
                          {tok.text}
                        </mark>
                      ) : (
                        <span key={tok.idx}>{tok.text}</span>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-muted"
            data-testid="btn-korrektur-cancel"
          >
            Abbrechen
          </button>
          <button
            onClick={handleAccept}
            disabled={loading || !!error}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-korrektur-accept"
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Kleiner „Korrigieren"-Button neben Vortext/Schlusstext/Betreff-Feldern.
 * Einheitlicher ✨-Stil wie KiKorrekturWrapper im restlichen System.
 */
export const TextKorrekturButton = ({ text, onTrigger, disabled = false, testId }) => {
  const isEmpty = !(text || "").trim();
  return (
    <button
      type="button"
      onClick={onTrigger}
      disabled={disabled || isEmpty}
      className="inline-flex items-center justify-center p-1 rounded bg-background hover:bg-primary/10 text-muted-foreground hover:text-primary border border-input shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title={isEmpty ? "Text ist leer" : "Rechtschreibung und Grammatik mit KI prüfen"}
      data-testid={testId || "btn-textkorrektur"}
    >
      <Sparkles className="w-3.5 h-3.5" />
    </button>
  );
};
