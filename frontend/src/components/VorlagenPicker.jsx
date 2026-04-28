import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BookOpen, Check, X } from "lucide-react";

/**
 * Vorlagen-Picker für Textvorlagen (doc_type=...).
 * Zeigt eine Liste aller Vorlagen des gegebenen doc_type.
 * Klick auf Vorlage ruft onSelect({title, content}) auf.
 */
export const VorlagenPicker = ({ doc_type = "aufgabe", onSelect, label = "Vorlage wählen", compact = false }) => {
  const [vorlagen, setVorlagen] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (vorlagen.length > 0) return;
    setLoading(true);
    try {
      const r = await api.get(`/modules/textvorlagen/data?doc_type=${encodeURIComponent(doc_type)}`);
      setVorlagen(Array.isArray(r.data) ? r.data : []);
    } catch {
      setVorlagen([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (!open) await load();
    setOpen(o => !o);
  };

  const pick = (v) => {
    onSelect && onSelect({ title: v.title, content: v.content || "" });
    setOpen(false);
  };

  return (
    <div className="relative" data-testid={`vorlagen-picker-${doc_type}`}>
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-1 border rounded-sm px-2 py-1 text-xs hover:bg-muted text-muted-foreground ${compact ? "" : "w-full justify-center"}`}
        data-testid="btn-vorlagen-toggle"
      >
        <BookOpen className="w-3 h-3" />
        {label}
        {vorlagen.length > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">{vorlagen.length}</span>}
      </button>

      {open && (
        <>
          {/* Backdrop damit Klick außerhalb schließt */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-40 mt-1 w-[min(90vw,520px)] bg-background border rounded-md shadow-2xl max-h-[70vh] overflow-y-auto"
            data-testid="vorlagen-list"
          >
            <div className="flex items-center justify-between p-3 border-b bg-muted/40 sticky top-0 z-10">
              <span className="text-sm font-semibold">Aus Vorlage wählen</span>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded-sm" aria-label="Schließen">
                <X className="w-4 h-4" />
              </button>
            </div>
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Lade…</p>
            ) : vorlagen.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Keine Vorlagen angelegt.
                <a href="/module/textvorlagen" target="_blank" rel="noopener noreferrer" className="block mt-2 text-primary hover:underline">
                  + Vorlage anlegen
                </a>
              </div>
            ) : (
              <>
                {vorlagen.map(v => (
                  <button
                    key={v.id}
                    onClick={() => pick(v)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b last:border-b-0 transition-colors"
                    data-testid={`vorlage-${v.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{v.title}</div>
                        {v.content && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {(v.content || "").replace(/<[^>]*>/g, "").slice(0, 180)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                <a
                  href="/module/textvorlagen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 text-sm text-primary hover:bg-primary/5 border-t text-center font-medium"
                >
                  + Neue Vorlage anlegen / bearbeiten
                </a>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VorlagenPicker;
