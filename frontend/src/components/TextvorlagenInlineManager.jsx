import { useState, useEffect, useCallback } from "react";
import { Settings, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/common";
import { api } from "@/lib/api";

/**
 * TextvorlagenInlineManager
 *
 * Wiederverwendbare Inline-Pflege für Auswahlfelder, die ihre Werte aus
 * `module_textvorlagen` ziehen (Regel 1 + 2 — VISION.md). Zeigt ein kleines
 * Zahnrad-Icon, das ein Modal mit CRUD-Liste öffnet.
 *
 * Nutzen: überall dort einbauen, wo Anwender eine Auswahl-Liste pflegen will,
 * ohne ins Textvorlagen-Modul wechseln zu müssen (z. B. Kunden-Kategorie,
 * Kunden-Status, Projekt-Status, Aufgaben-Kategorie, …).
 *
 * Props:
 *   docType:   z. B. "kunden_kategorie"
 *   label:     "Kategorien", für Modal-Titel
 *   onChanged: callback nach jeder Mutation (parent kann seine Liste neu laden)
 *
 * API-Calls:
 *   GET    /api/modules/textvorlagen/data?doc_type=…
 *   POST   /api/modules/textvorlagen/data
 *   PUT    /api/modules/textvorlagen/data/{id}
 *   DELETE /api/modules/textvorlagen/data/{id}
 */
const TextvorlagenInlineManager = ({ docType, label, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editParent, setEditParent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState("");

  // Parent-Auswahl nur für Kategorien sinnvoll
  const supportsGroups = docType === "kunden_kategorie";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/modules/textvorlagen/data?doc_type=${encodeURIComponent(docType)}`);
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [docType]);

  useEffect(() => { if (open) reload(); }, [open, reload]);

  const create = async () => {
    const t = newTitle.trim();
    if (!t) return;
    if (items.some(x => (x.title || "").toLowerCase() === t.toLowerCase())) {
      toast.error("Existiert bereits");
      return;
    }
    setBusy("create");
    try {
      await api.post("/modules/textvorlagen/data", {
        title: t,
        content: "",
        doc_type: docType,
        text_type: "titel",
        keywords: [],
      });
      setNewTitle("");
      await reload();
      onChanged?.();
      toast.success("Hinzugefügt");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Anlegen");
    } finally {
      setBusy("");
    }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditTitle(item.title || "");
    setEditParent(item.parent_category || "");
  };

  const saveEdit = async () => {
    const t = editTitle.trim();
    if (!t) return;
    setBusy(`edit:${editId}`);
    try {
      const payload = { title: t };
      if (supportsGroups) payload.parent_category = editParent.trim() || null;
      await api.put(`/modules/textvorlagen/data/${editId}`, payload);
      setEditId("");
      setEditTitle("");
      setEditParent("");
      await reload();
      onChanged?.();
      toast.success("Gespeichert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setBusy("");
    }
  };

  // Vorschlag für Gruppen-Dropdown: bereits verwendete parent_categories + items die selbst Gruppen sein könnten
  const groupOptions = (() => {
    const used = new Set();
    items.forEach((it) => {
      if (it.parent_category) used.add(it.parent_category);
    });
    // Auch die Top-Level-Einträge (ohne parent) als mögliche Gruppen anbieten
    items.forEach((it) => {
      if (!it.parent_category && it.id !== editId) used.add(it.title);
    });
    return Array.from(used).sort();
  })();

  const remove = async (item) => {
    if (!window.confirm(`„${item.title}" wirklich löschen? Bestehende Kunden mit diesem Wert behalten ihn — nur die Auswahl in Dropdowns verschwindet.`)) return;
    setBusy(`del:${item.id}`);
    try {
      await api.delete(`/modules/textvorlagen/data/${item.id}`);
      await reload();
      onChanged?.();
      toast.success("Gelöscht");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Löschen");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        title={`${label || "Liste"} verwalten`}
        data-testid={`btn-manage-${docType}`}
      >
        <Settings className="w-3.5 h-3.5" /> verwalten
      </button>

      {open && (
        <Modal isOpen={true} onClose={() => setOpen(false)} title={`${label || "Auswahl"} verwalten`} size="sm">
          <div className="p-4 space-y-3" data-testid={`manager-${docType}`}>
            {/* Neu anlegen */}
            <div className="flex items-center gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
                placeholder="Neuer Eintrag …"
                className="flex-1 h-9 rounded-sm border border-input bg-background px-3 text-sm"
                data-testid="input-new-vorlage"
              />
              <button
                onClick={create}
                disabled={!newTitle.trim() || !!busy}
                className="inline-flex items-center gap-1 px-3 h-9 bg-emerald-600 text-white text-sm rounded-sm hover:bg-emerald-700 disabled:opacity-50"
                data-testid="btn-add-vorlage"
              >
                {busy === "create" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Hinzufügen
              </button>
            </div>

            {/* Liste */}
            <div className="border rounded-sm divide-y max-h-[55vh] overflow-auto">
              {loading ? (
                <div className="p-4 text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Lade …</div>
              ) : items.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Noch keine Einträge.</div>
              ) : items.map(item => (
                <div key={item.id} className="px-3 py-2 flex items-center gap-2 text-sm" data-testid={`row-${item.id}`}>
                  {editId === item.id ? (
                    <>
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditId(""); }}
                        className="flex-1 h-8 rounded-sm border border-input bg-background px-2 text-sm"
                        data-testid={`input-edit-${item.id}`}
                      />
                      {supportsGroups && (
                        <input
                          list={`parent-options-${item.id}`}
                          value={editParent}
                          onChange={(e) => setEditParent(e.target.value)}
                          placeholder="Gruppe (optional)"
                          className="w-40 h-8 rounded-sm border border-input bg-background px-2 text-xs"
                          data-testid={`input-parent-${item.id}`}
                        />
                      )}
                      {supportsGroups && (
                        <datalist id={`parent-options-${item.id}`}>
                          {groupOptions.map((g) => <option key={g} value={g} />)}
                        </datalist>
                      )}
                      <button onClick={saveEdit} disabled={!!busy} className="p-1.5 hover:bg-emerald-50 rounded-sm text-emerald-700" title="Speichern" data-testid={`btn-save-${item.id}`}>
                        {busy === `edit:${item.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditId("")} className="p-1.5 hover:bg-muted rounded-sm" title="Abbrechen">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.parent_category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20" title={`Gruppe: ${item.parent_category}`}>
                            ▶ {item.parent_category}
                          </span>
                        )}
                      </div>
                      <button onClick={() => startEdit(item)} className="p-1.5 hover:bg-muted rounded-sm" title="Bearbeiten" data-testid={`btn-edit-${item.id}`}>
                        <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <button onClick={() => remove(item)} disabled={!!busy} className="p-1.5 hover:bg-destructive/10 rounded-sm text-red-600" title="Löschen" data-testid={`btn-del-${item.id}`}>
                        {busy === `del:${item.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="text-[11px] text-muted-foreground">
              Die Liste wird global aus <code>module_textvorlagen</code> geladen — Änderungen wirken sich überall aus, wo dieser Auswahl-Typ verwendet wird.
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm border rounded-sm hover:bg-muted" data-testid="btn-close-manager">Schließen</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default TextvorlagenInlineManager;
export { TextvorlagenInlineManager };
