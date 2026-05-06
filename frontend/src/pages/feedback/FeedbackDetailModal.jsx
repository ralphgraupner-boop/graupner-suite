import { useEffect, useState, useCallback } from "react";
import { Check, Trash2, Loader2, Bug, Lightbulb, CheckSquare, Sparkles, Send, MessageSquare, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/common";
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

const STATUS_LABELS = {
  offen: "Offen",
  in_arbeit: "In Arbeit",
  erledigt: "Erledigt",
};

const fmt = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
};

/**
 * FeedbackDetailModal — Voll-Editor mit Verlauf und Bemerkungen.
 * Kann zum Anlegen (item=null) oder Bearbeiten (item={...}) genutzt werden.
 */
const FeedbackDetailModal = ({ item, onClose, onChanged, onDeleted }) => {
  const isNew = !item;
  const [form, setForm] = useState({
    title: item?.title || "",
    description: item?.description || "",
    typ: item?.typ || "bug",
    prio: item?.prio || "normal",
    status: item?.status || "offen",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [kommentar, setKommentar] = useState("");
  const [postingKomm, setPostingKomm] = useState(false);
  const [currentItem, setCurrentItem] = useState(item);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const loadHistory = useCallback(async (id) => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const r = await api.get(`/module-feedback/${id}/history`);
      setHistory(r.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Verlauf konnte nicht geladen werden");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentItem?.id) loadHistory(currentItem.id);
  }, [currentItem, loadHistory]);

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Titel darf nicht leer sein");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const r = await api.post("/module-feedback", {
          title: form.title.trim(),
          description: form.description,
          typ: form.typ,
          prio: form.prio,
        });
        toast.success("Notiz angelegt");
        // Bei Bedarf weiter im selben Modal arbeiten (Bemerkungen hinzufügen)
        setCurrentItem(r.data);
        onChanged?.();
      } else {
        await api.patch(`/module-feedback/${currentItem.id}`, {
          title: form.title.trim(),
          description: form.description,
          typ: form.typ,
          prio: form.prio,
          status: form.status,
        });
        toast.success("Gespeichert");
        await loadHistory(currentItem.id);
        onChanged?.();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!currentItem?.id) return;
    if (!window.confirm(`Notiz „${currentItem.title}" endgültig löschen? Verlauf wird ebenfalls entfernt.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/module-feedback/${currentItem.id}`);
      toast.success("Notiz gelöscht");
      onDeleted?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    } finally {
      setDeleting(false);
    }
  };

  const submitKommentar = async () => {
    const text = kommentar.trim();
    if (!text || !currentItem?.id) return;
    setPostingKomm(true);
    try {
      await api.post(`/module-feedback/${currentItem.id}/kommentar`, { text });
      setKommentar("");
      await loadHistory(currentItem.id);
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Bemerkung fehlgeschlagen");
    } finally {
      setPostingKomm(false);
    }
  };

  const removeHistoryItem = async (h) => {
    if (!window.confirm(h.type === "kommentar" ? "Bemerkung löschen?" : "Verlauf-Eintrag löschen?")) return;
    try {
      await api.delete(`/module-feedback/history/${h.id}`);
      await loadHistory(currentItem.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isNew ? "Neue Notiz" : "Notiz bearbeiten"} size="xl">
      <div className="space-y-4 text-sm" data-testid="feedback-detail-modal">
        {/* Bearbeitungs-Bereich */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Titel</label>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="input-detail-title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Beschreibung <span className="text-muted-foreground font-normal">(optional, mehrzeilig)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              placeholder="Details, Schritte zur Reproduktion, Anmerkungen…"
              className="w-full border rounded-sm p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="textarea-detail-description"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Typ</label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(TYP_META).map(([k, m]) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set("typ", k)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm border transition-colors ${form.typ === k ? m.color + " border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                      data-testid={`btn-detail-typ-${k}`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Prio</label>
              <div className="flex flex-wrap gap-1">
                {["hoch", "normal", "niedrig"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("prio", p)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm border transition-colors ${form.prio === p ? "bg-foreground text-background border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                    data-testid={`btn-detail-prio-${p}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${PRIO_DOT[p]}`} /> {p}
                  </button>
                ))}
              </div>
            </div>

            {!isNew && (
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(STATUS_LABELS).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set("status", k)}
                      className={`px-2.5 py-1.5 text-xs rounded-sm border transition-colors ${form.status === k ? "bg-primary text-primary-foreground border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                      data-testid={`btn-detail-status-${k}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {currentItem && (
            <div className="text-[11px] text-muted-foreground border-t pt-2">
              Erstellt: {fmt(currentItem.created_at)}
              {currentItem.created_by && <> · von {currentItem.created_by}</>}
              {currentItem.updated_at && <> · Zuletzt geändert: {fmt(currentItem.updated_at)}</>}
            </div>
          )}

          <div className="flex justify-between gap-2 flex-wrap">
            {!isNew ? (
              <button
                type="button"
                onClick={remove}
                disabled={saving || deleting}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-red-200 text-red-700 rounded-sm hover:bg-red-50 disabled:opacity-50"
                data-testid="btn-detail-delete"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Löschen
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="px-3 py-2 text-sm border rounded-sm hover:bg-muted"
                data-testid="btn-detail-cancel"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || deleting || !form.title.trim()}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
                data-testid="btn-detail-save"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isNew ? "Anlegen" : "Speichern"}
              </button>
            </div>
          </div>
        </div>

        {/* Verlauf + Bemerkungen — nur sichtbar nach Anlegen */}
        {currentItem && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-primary" />
              Verlauf & Bemerkungen
              {history.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">({history.length})</span>
              )}
            </h3>

            {/* Bemerkung hinzufügen */}
            <div className="border rounded-sm p-2 bg-muted/20">
              <div className="flex gap-2">
                <textarea
                  value={kommentar}
                  onChange={(e) => setKommentar(e.target.value)}
                  rows={2}
                  placeholder="Neue Bemerkung hinzufügen…"
                  className="flex-1 border rounded-sm p-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="textarea-detail-kommentar"
                />
                <button
                  type="button"
                  onClick={submitKommentar}
                  disabled={postingKomm || !kommentar.trim()}
                  className="px-3 self-stretch text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
                  data-testid="btn-detail-add-kommentar"
                  title="Bemerkung speichern"
                >
                  {postingKomm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Verlaufs-Liste */}
            {historyLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Lade Verlauf…
              </div>
            ) : history.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">Noch keine Einträge.</div>
            ) : (
              <ul className="space-y-1.5">
                {history.map((h) => {
                  const isKomm = h.type === "kommentar";
                  return (
                    <li
                      key={h.id}
                      className={`group border rounded-sm p-2 text-sm ${isKomm ? "bg-amber-50 border-amber-200" : "bg-background"}`}
                      data-testid={`history-item-${h.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {isKomm ? (
                            <MessageSquare className="w-4 h-4 text-amber-700" />
                          ) : (
                            <HistoryIcon className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">
                            {fmt(h.created_at)}
                            {h.created_by && <> · {h.created_by}</>}
                            <span className="mx-1">·</span>
                            <span className={isKomm ? "text-amber-800 font-medium" : "italic"}>
                              {isKomm ? "Bemerkung" : "Änderung"}
                            </span>
                          </div>
                          <div className={`mt-0.5 whitespace-pre-wrap break-words ${isKomm ? "text-amber-900" : "text-foreground"}`}>
                            {h.text}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeHistoryItem(h)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-sm"
                          data-testid={`btn-history-delete-${h.id}`}
                          title="Eintrag entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default FeedbackDetailModal;
