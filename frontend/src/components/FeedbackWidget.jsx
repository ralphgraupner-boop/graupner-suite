import { useState, useEffect, useCallback, useRef } from "react";
import { StickyNote, X, Plus, Loader2, Bug, Lightbulb, CheckSquare, Sparkles, Trash2, Archive, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Modal } from "@/components/common";

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

const STATUS_LABELS = {
  offen: "Offen",
  in_arbeit: "In Arbeit",
  erledigt: "Erledigt",
};

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
  const [editItem, setEditItem] = useState(null);
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
      {/* Floating Button — größer auf Mobile, Abstand zur iOS-Bottom-Bar */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-4 sm:bottom-4 sm:right-4 z-40 w-14 h-14 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 hover:scale-110 transition-transform flex items-center justify-center"
        style={{ touchAction: "manipulation", marginBottom: "env(safe-area-inset-bottom)" }}
        data-testid="btn-feedback-open"
        title="Notizen / Bugs / Ideen"
        aria-label="Notizen öffnen"
      >
        <StickyNote className="w-6 h-6 sm:w-5 sm:h-5" />
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
          {/* Panel — auf Mobile fast vollflächig, Safe-Area beachten */}
          <div
            ref={panelRef}
            className="relative pointer-events-auto w-full sm:w-[420px] h-[92vh] sm:h-auto sm:max-h-[calc(100vh-32px)] sm:mb-4 sm:mr-4 bg-card border rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            data-testid="feedback-panel"
          >
            {/* Header — größerer Schließen-Button */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Notizen & Bugs</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-muted rounded-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{ touchAction: "manipulation" }}
                data-testid="btn-feedback-close"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick-Add — als FORM, damit Enter und Submit korrekt funktionieren */}
            <form
              onSubmit={(e) => { e.preventDefault(); if (!submitting && quickTitle.trim()) createItem(); }}
              className="px-4 py-3 border-b bg-muted/30 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Neuer Eintrag…"
                  className="flex-1 px-3 py-3 text-base sm:text-sm border rounded-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-feedback-title"
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                />
                <button
                  type="submit"
                  disabled={submitting || !quickTitle.trim()}
                  className="px-4 py-3 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 active:scale-95 disabled:opacity-40 flex items-center gap-1 min-w-[48px] min-h-[44px] justify-center"
                  style={{ touchAction: "manipulation" }}
                  data-testid="btn-feedback-create"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex gap-1.5 items-center flex-wrap">
                {Object.entries(TYP_META).map(([k, m]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setQuickTyp(k)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-sm border transition-colors ${quickTyp === k ? m.color + " border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                    style={{ touchAction: "manipulation" }}
                    data-testid={`btn-feedback-typ-${k}`}
                  >
                    <m.icon className="w-3 h-3" /> {m.label}
                  </button>
                ))}
                <span className="mx-1 text-muted-foreground">·</span>
                {["hoch", "normal", "niedrig"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setQuickPrio(p)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-sm border transition-colors ${quickPrio === p ? "bg-foreground text-background border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                    style={{ touchAction: "manipulation" }}
                    data-testid={`btn-feedback-prio-${p}`}
                    title={`Priorität ${p}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${PRIO_DOT[p]}`} /> {p}
                  </button>
                ))}
              </div>
            </form>

            {/* Tabs */}
            <div className="flex border-b px-2 items-center">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-2.5 text-sm sm:text-xs border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  style={{ touchAction: "manipulation" }}
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
                          <button
                            type="button"
                            onClick={() => setEditItem(item)}
                            className={`text-sm text-left hover:underline focus:outline-none focus:underline ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
                            data-testid={`btn-feedback-edit-${item.id}`}
                            title="Bearbeiten"
                          >
                            {item.title}
                          </button>
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
                          <button
                            type="button"
                            onClick={() => setEditItem(item)}
                            className="block w-full text-left text-xs text-muted-foreground mt-1 whitespace-pre-wrap hover:text-foreground"
                            data-testid={`btn-feedback-edit-desc-${item.id}`}
                            title="Bearbeiten"
                          >
                            {item.description}
                          </button>
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
      {/* Bearbeiten-Modal */}
      {editItem && (
        <FeedbackEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={async () => {
            setEditItem(null);
            await loadItems();
            await loadBadge();
          }}
          onDeleted={async () => {
            setEditItem(null);
            await loadItems();
            await loadBadge();
          }}
        />
      )}
    </>
  );
};


/**
 * FeedbackEditModal — Vollständiges Bearbeiten eines Notizen-/Bug-Eintrags.
 * Felder: Titel · Beschreibung · Typ · Prio · Status
 * Aktionen: Speichern · Abbrechen · Löschen
 */
const FeedbackEditModal = ({ item, onClose, onSaved, onDeleted }) => {
  const [form, setForm] = useState({
    title: item.title || "",
    description: item.description || "",
    typ: item.typ || "bug",
    prio: item.prio || "normal",
    status: item.status || "offen",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Titel darf nicht leer sein");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/module-feedback/${item.id}`, {
        title: form.title.trim(),
        description: form.description,
        typ: form.typ,
        prio: form.prio,
        status: form.status,
      });
      toast.success("Notiz gespeichert");
      onSaved?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Notiz „${item.title}" endgültig löschen?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/module-feedback/${item.id}`);
      toast.success("Notiz gelöscht");
      onDeleted?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={!!item} onClose={onClose} title="Notiz bearbeiten" size="lg">
      <div className="space-y-3 text-sm" data-testid="feedback-edit-modal">
        {/* Titel */}
        <div>
          <label className="block text-xs font-medium mb-1">Titel</label>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="w-full border rounded-sm p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="input-edit-title"
            autoFocus
          />
        </div>

        {/* Beschreibung */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Beschreibung <span className="text-muted-foreground font-normal">(optional, mehrzeilig)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={5}
            placeholder="Details, Schritte zur Reproduktion, Anmerkungen…"
            className="w-full border rounded-sm p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="textarea-edit-description"
          />
        </div>

        {/* Typ */}
        <div>
          <label className="block text-xs font-medium mb-1">Typ</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TYP_META).map(([k, m]) => {
              const Icon = m.icon;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("typ", k)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm border transition-colors ${form.typ === k ? m.color + " border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                  data-testid={`btn-edit-typ-${k}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prio */}
        <div>
          <label className="block text-xs font-medium mb-1">Priorität</label>
          <div className="flex gap-1.5">
            {["hoch", "normal", "niedrig"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set("prio", p)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm border transition-colors ${form.prio === p ? "bg-foreground text-background border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                data-testid={`btn-edit-prio-${p}`}
              >
                <span className={`w-2 h-2 rounded-full ${PRIO_DOT[p]}`} /> {p}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium mb-1">Status</label>
          <div className="flex gap-1.5">
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => set("status", k)}
                className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${form.status === k ? "bg-primary text-primary-foreground border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                data-testid={`btn-edit-status-${k}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Aktionen */}
        <div className="flex justify-between gap-2 pt-3 border-t flex-wrap">
          <button
            type="button"
            onClick={remove}
            disabled={saving || deleting}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-red-200 text-red-700 rounded-sm hover:bg-red-50 disabled:opacity-50"
            data-testid="btn-edit-delete"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Löschen
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="px-3 py-2 text-sm border rounded-sm hover:bg-muted"
              data-testid="btn-edit-cancel"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || deleting || !form.title.trim()}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
              data-testid="btn-edit-save"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FeedbackWidget;
