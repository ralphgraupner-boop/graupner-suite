import { useState, useEffect, useCallback, useRef } from "react";
import { StickyNote, X, Plus, Loader2, Bug, Lightbulb, CheckSquare, Sparkles, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const TYP_META = {
  bug: { label: "Bug", icon: Bug, color: "bg-red-100 text-red-700" },
  feature: { label: "Feature", icon: Sparkles, color: "bg-violet-100 text-violet-700" },
  idee: { label: "Idee", icon: Lightbulb, color: "bg-amber-100 text-amber-700" },
  test: { label: "Test", icon: CheckSquare, color: "bg-sky-100 text-sky-700" },
};

const PRIO_DOT = {
  hoch: "bg-red-500",
  normal: "bg-amber-400",
  niedrig: "bg-emerald-500",
};

const TABS = [
  { key: "offen", label: "Offen" },
  { key: "alle", label: "Alle" },
  { key: "erledigt", label: "Erledigt" },
];

const FeedbackWidget = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [badge, setBadge] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("offen");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTyp, setQuickTyp] = useState("bug");
  const [quickPrio, setQuickPrio] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef(null);

  const loadBadge = useCallback(async () => {
    try {
      const r = await api.get("/module-feedback/count");
      setBadge(r.data?.total_open || 0);
      setArchivedCount(r.data?.archived || 0);
    } catch { /* ignore */ }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === "alle" ? "alle" : tab;
      const inc = includeArchived ? "&include_archived=true" : "";
      const r = await api.get(`/module-feedback/list?status=${status}${inc}`);
      setItems(r.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [tab, includeArchived]);

  useEffect(() => {
    loadBadge();
    const id = setInterval(loadBadge, 60000);
    return () => clearInterval(id);
  }, [loadBadge]);

  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  // Schließen auf Escape
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const createItem = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    setSubmitting(true);
    try {
      await api.post("/module-feedback", {
        title,
        description: "",
        typ: quickTyp,
        prio: quickPrio,
      });
      setQuickTitle("");
      await loadItems();
      await loadBadge();
      toast.success("Notiz angelegt");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Anlegen fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (item) => {
    try {
      await api.post(`/module-feedback/${item.id}/toggle-done`);
      await loadItems();
      await loadBadge();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Notiz "${item.title}" löschen?`)) return;
    try {
      await api.delete(`/module-feedback/${item.id}`);
      await loadItems();
      await loadBadge();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const updatePrio = async (item, prio) => {
    try {
      await api.patch(`/module-feedback/${item.id}`, { prio });
      await loadItems();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
        data-testid="btn-feedback-open"
        title="Notizen / Bugs / Ideen"
        aria-label="Notizen öffnen"
      >
        <StickyNote className="w-5 h-5" />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold ring-2 ring-background" data-testid="badge-feedback-count">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-end sm:justify-end pointer-events-none">
          {/* Backdrop */}
          <button
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => setOpen(false)}
            aria-label="Schließen"
            data-testid="feedback-backdrop"
          />
          {/* Panel */}
          <div
            ref={panelRef}
            className="relative pointer-events-auto w-full sm:w-[420px] max-h-[88vh] sm:max-h-[calc(100vh-32px)] sm:mb-4 sm:mr-4 bg-card border rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col"
            data-testid="feedback-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Notizen & Bugs</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-muted rounded-sm"
                data-testid="btn-feedback-close"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick-Add */}
            <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
              <div className="flex gap-2">
                <input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !submitting) createItem(); }}
                  placeholder="Neuer Eintrag…"
                  className="flex-1 px-3 py-2 text-sm border rounded-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-feedback-title"
                />
                <button
                  onClick={createItem}
                  disabled={submitting || !quickTitle.trim()}
                  className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1"
                  data-testid="btn-feedback-create"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-1.5 items-center flex-wrap">
                {Object.entries(TYP_META).map(([k, m]) => (
                  <button
                    key={k}
                    onClick={() => setQuickTyp(k)}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-sm border transition-colors ${quickTyp === k ? m.color + " border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                    data-testid={`btn-feedback-typ-${k}`}
                  >
                    <m.icon className="w-3 h-3" /> {m.label}
                  </button>
                ))}
                <span className="mx-1 text-muted-foreground">·</span>
                {["hoch", "normal", "niedrig"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setQuickPrio(p)}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-sm border transition-colors ${quickPrio === p ? "bg-foreground text-background border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                    data-testid={`btn-feedback-prio-${p}`}
                    title={`Priorität ${p}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${PRIO_DOT[p]}`} /> {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b px-2 items-center">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-2 text-xs border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  data-testid={`tab-feedback-${t.key}`}
                >
                  {t.label}
                </button>
              ))}
              {(tab === "erledigt" || tab === "alle") && archivedCount > 0 && (
                <button
                  onClick={() => setIncludeArchived((v) => !v)}
                  className={`ml-auto mr-1 inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-sm border transition-colors ${includeArchived ? "bg-slate-800 text-white border-transparent" : "border-border text-muted-foreground hover:bg-muted"}`}
                  data-testid="btn-feedback-archive-toggle"
                  title={`${archivedCount} Einträge sind älter als 30 Tage und ausgeblendet`}
                >
                  <Archive className="w-3 h-3" /> Archiv ({archivedCount})
                </button>
              )}
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Keine Einträge.
                </div>
              ) : items.map((item) => {
                const meta = TYP_META[item.typ] || TYP_META.bug;
                const TypIcon = meta.icon;
                const isDone = item.status === "erledigt";
                return (
                  <div
                    key={item.id}
                    className={`border rounded-sm p-2.5 bg-background ${isDone ? "opacity-60" : ""}`}
                    data-testid={`feedback-item-${item.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleDone(item)}
                        className={`mt-0.5 w-4 h-4 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary"}`}
                        data-testid={`btn-feedback-toggle-${item.id}`}
                        title={isDone ? "Wieder öffnen" : "Als erledigt markieren"}
                      >
                        {isDone ? <CheckSquare className="w-3 h-3" /> : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className={`text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {item.title}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-sm ${meta.color} font-medium`}>
                            <TypIcon className="w-2.5 h-2.5" /> {meta.label}
                          </span>
                          <button
                            onClick={() => {
                              const next = item.prio === "hoch" ? "normal" : item.prio === "normal" ? "niedrig" : "hoch";
                              updatePrio(item, next);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-sm border hover:bg-muted"
                            data-testid={`btn-feedback-prio-toggle-${item.id}`}
                            title={`Priorität: ${item.prio} (Klick zum Wechseln)`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${PRIO_DOT[item.prio] || "bg-gray-400"}`} /> {item.prio}
                          </button>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{item.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString("de-DE") : ""}
                          {item.created_by ? ` · ${item.created_by}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item)}
                        className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-sm flex-shrink-0"
                        data-testid={`btn-feedback-delete-${item.id}`}
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;
