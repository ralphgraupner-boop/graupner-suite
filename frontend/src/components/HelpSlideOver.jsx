import { useEffect, useState, useCallback } from "react";
import { HelpCircle, X, Sparkles, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { HELP_DEFAULTS, HELP_LABELS } from "@/lib/helpContent";

/**
 * Globales Hilfe-Slide-Over rechts.
 *
 * Hoert auf das CustomEvent "graupner:f1-help" (siehe useF1Help).
 * Laedt Hilfetexte aus module_textvorlagen mit doc_type=<context> und text_type=hilfe.
 * Faellt auf HELP_DEFAULTS zurueck, wenn keine Vorlagen vorhanden sind.
 *
 * In App.js einmal global gerendert.
 */
export const HelpSlideOver = () => {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [usingDefaults, setUsingDefaults] = useState(false);

  const close = useCallback(() => { setOpen(false); }, []);

  // F1-Event-Listener
  useEffect(() => {
    const onF1 = (e) => {
      const ctx = e?.detail?.context;
      if (!ctx) return;
      setContext(ctx);
      setOpen(true);
    };
    window.addEventListener("graupner:f1-help", onF1);
    return () => window.removeEventListener("graupner:f1-help", onF1);
  }, []);

  // ESC schliesst
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Laden, sobald geoeffnet + context gesetzt
  const load = useCallback(async () => {
    if (!context) return;
    setLoading(true);
    try {
      const r = await api.get("/modules/textvorlagen/data", {
        params: { doc_type: context, text_type: "hilfe" },
      });
      const data = Array.isArray(r.data) ? r.data : [];
      if (data.length > 0) {
        data.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || (a.title || "").localeCompare(b.title || ""));
        setItems(data);
        setUsingDefaults(false);
      } else {
        setItems(HELP_DEFAULTS[context] || []);
        setUsingDefaults(true);
      }
    } catch {
      setItems(HELP_DEFAULTS[context] || []);
      setUsingDefaults(true);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => { if (open && context) load(); }, [open, context, load]);

  const seedDefaults = async () => {
    if (!context || seeding) return;
    const defaults = HELP_DEFAULTS[context] || [];
    if (defaults.length === 0) { toast.error("Keine Default-Texte vorhanden"); return; }
    setSeeding(true);
    try {
      for (let i = 0; i < defaults.length; i++) {
        const d = defaults[i];
        await api.post("/modules/textvorlagen/data", {
          doc_type: context,
          text_type: "hilfe",
          title: d.title,
          content: d.content,
          sort_order: (i + 1) * 10,
        });
      }
      toast.success(`${defaults.length} Hilfetexte als Vorlagen gespeichert`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSeeding(false);
    }
  };

  if (!open) return null;

  const label = HELP_LABELS[context] || "Hilfe";

  return (
    <div
      className="fixed inset-0 z-[9200] flex"
      data-testid="help-slideover-root"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-[2px]" />
      {/* Panel rechts */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[420px] bg-card text-card-foreground border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        data-testid="help-slideover-panel"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight truncate">{label}</h2>
              <p className="text-[11px] text-muted-foreground">F1 zum Schließen · ESC zum Schließen</p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Hilfe schliessen"
            data-testid="btn-help-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Für diesen Bereich gibt es noch keine Hilfetexte.
            </p>
          ) : (
            items.map((it, idx) => (
              <div key={it.id || `default-${idx}`} className="border rounded-md bg-muted/20" data-testid={`help-item-${idx}`}>
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">{it.title}</span>
                </div>
                <p className="px-3 py-2.5 text-sm whitespace-pre-line leading-relaxed">{it.content}</p>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t shrink-0 space-y-2">
          {usingDefaults && items.length > 0 && (
            <button
              type="button"
              onClick={seedDefaults}
              disabled={seeding}
              data-testid="btn-help-seed"
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Als Vorlage speichern (zum Anpassen)
            </button>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            Texte sind in Einstellungen → Textvorlagen editierbar
            <br />
            (doc_type: <code>{context}</code>, text_type: <code>hilfe</code>)
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpSlideOver;
