import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Briefcase, Plus, Trash2, X, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronUp, Pencil,
} from "lucide-react";
import { VorlagenPicker } from "@/components/VorlagenPicker";

const STATUS_STYLES = {
  offen: { cls: "bg-amber-50 text-amber-800 border-amber-200", icon: AlertCircle, label: "Offen" },
  in_arbeit: { cls: "bg-blue-50 text-blue-800 border-blue-200", icon: Clock, label: "In Arbeit" },
  erledigt: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2, label: "Erledigt" },
};

const PRIO_STYLES = {
  hoch: "bg-red-50 text-red-700 border-red-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  niedrig: "bg-gray-50 text-gray-600 border-gray-200",
};

/**
 * Wiederverwendbares Aufgaben-Panel.
 * Wird in Kunden-Detail (kunde_id) und Projekt-Werkbank (projekt_id) eingebettet.
 *
 * Datenmaske: liest und schreibt nur in module_aufgaben, vorgefiltert auf den Kontext.
 */
export const AufgabenPanel = ({ kunde_id = "", projekt_id = "", title = "Aufgaben", defaultCollapsed = false, compact = false }) => {
  const [aufgaben, setAufgaben] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mitarbeiter, setMitarbeiter] = useState([]);

  const params = {};
  if (kunde_id) params.kunde_id = kunde_id;
  if (projekt_id) params.projekt_id = projekt_id;

  const load = async () => {
    if (!kunde_id && !projekt_id) return;
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        api.get("/module-aufgaben", { params }),
        mitarbeiter.length ? Promise.resolve({ data: mitarbeiter }) : api.get("/module-aufgaben/mitarbeiter").catch(() => ({ data: [] })),
      ]);
      setAufgaben(Array.isArray(r.data) ? r.data : []);
      if (!mitarbeiter.length) setMitarbeiter(Array.isArray(m.data) ? m.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Aufgaben konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [kunde_id, projekt_id]);  // eslint-disable-line

  const setStatus = async (a, status) => {
    try {
      await api.patch(`/module-aufgaben/${a.id}/status`, { status });
      toast.success(`Aufgabe: ${STATUS_STYLES[status].label}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Statusänderung fehlgeschlagen");
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Aufgabe "${a.titel}" löschen?`)) return;
    try {
      await api.delete(`/module-aufgaben/${a.id}`);
      toast.success("Aufgabe gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  const offenCount = aufgaben.filter(a => a.status !== "erledigt").length;

  return (
    <div className="border rounded-md bg-background" data-testid={`aufgaben-panel-${kunde_id || projekt_id}`}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{title}</span>
          {aufgaben.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {offenCount > 0 ? `${offenCount} offen / ` : ""}{aufgaben.length} gesamt
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!collapsed && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowCreate(true); } }}
              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 flex items-center gap-1 cursor-pointer"
              data-testid={`btn-aufgabe-add-${kunde_id || projekt_id}`}
            >
              <Plus className="w-3 h-3" /> Neu
            </span>
          )}
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t p-3 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-3">Lade…</p>
          ) : aufgaben.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Keine Aufgaben für {kunde_id ? "diesen Kunden" : "dieses Projekt"}.
              <button onClick={() => setShowCreate(true)} className="block mx-auto mt-2 text-primary hover:underline">
                + Erste Aufgabe anlegen
              </button>
            </div>
          ) : (
            aufgaben.map(a => {
              const sty = STATUS_STYLES[a.status] || STATUS_STYLES.offen;
              const Icon = sty.icon;
              const mitName = mitarbeiter.find(m => m.username === a.zugewiesen_an)?.anzeige_name || a.zugewiesen_an;
              return (
                <div
                  key={a.id}
                  className={`border rounded-sm p-2 flex items-start gap-2 ${a.status === "erledigt" ? "opacity-60" : ""}`}
                  data-testid={`panel-aufgabe-${a.id}`}
                >
                  <div className={`p-1 rounded-sm border ${sty.cls} flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${a.status === "erledigt" ? "line-through text-muted-foreground" : ""}`}>
                        {a.titel}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${PRIO_STYLES[a.prioritaet]}`}>{a.prioritaet}</span>
                      {mitName && <span className="text-[10px] text-muted-foreground">👤 {mitName}</span>}
                      {a.faellig_am && <span className="text-[10px] text-muted-foreground">📅 {new Date(a.faellig_am).toLocaleDateString("de-DE")}</span>}
                    </div>
                    {!compact && a.beschreibung && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.beschreibung}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={a.status}
                      onChange={(e) => setStatus(a, e.target.value)}
                      className="text-xs border rounded-sm px-1.5 py-0.5 bg-background"
                      data-testid={`panel-status-${a.id}`}
                    >
                      <option value="offen">Offen</option>
                      <option value="in_arbeit">In Arbeit</option>
                      <option value="erledigt">Erledigt</option>
                    </select>
                    <button
                      onClick={() => setEditing(a)}
                      className="p-1 text-muted-foreground hover:bg-muted rounded-sm"
                      title="Bearbeiten"
                      data-testid={`panel-edit-${a.id}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-sm"
                      title="Löschen"
                      data-testid={`panel-delete-${a.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {(showCreate || editing) && (
        <QuickAufgabeDialog
          existing={editing}
          kunde_id={kunde_id}
          projekt_id={projekt_id}
          mitarbeiter={mitarbeiter}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

const QuickAufgabeDialog = ({ existing, kunde_id, projekt_id, mitarbeiter, onClose, onSaved }) => {
  const isEdit = !!existing;
  const [data, setData] = useState({
    titel: existing?.titel || "",
    beschreibung: existing?.beschreibung || "",
    kategorie: existing?.kategorie || "sonstige",
    prioritaet: existing?.prioritaet || "normal",
    zugewiesen_an: existing?.zugewiesen_an || "",
    faellig_am: existing?.faellig_am || "",
    wiederholung: existing?.wiederholung || "einmalig",
    status: existing?.status || "offen",
    kunde_id: existing?.kunde_id || kunde_id,
    projekt_id: existing?.projekt_id || projekt_id,
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setData(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!data.titel.trim()) { toast.error("Titel erforderlich"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/module-aufgaben/${existing.id}`, data);
        toast.success("Aufgabe aktualisiert");
      } else {
        const { status: _ignored, ...createData } = data;
        await api.post("/module-aufgaben", createData);
        toast.success("Aufgabe angelegt");
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="aufgabe-quick-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">{isEdit ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Titel *</label>
              <VorlagenPicker
                doc_type="aufgabe"
                label="Vorlage"
                compact
                onSelect={({ title, content }) => setData(d => ({
                  ...d,
                  titel: title,
                  beschreibung: d.beschreibung || (content || "").replace(/<[^>]*>/g, ""),
                }))}
              />
            </div>
            <input
              value={data.titel}
              onChange={(e) => upd("titel", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="z. B. Türrahmen vor Ort vermessen"
              data-testid="quick-input-titel"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={data.beschreibung}
              onChange={(e) => upd("beschreibung", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[60px]"
              placeholder="Optional"
              data-testid="quick-input-beschreibung"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Priorität</label>
              <select
                value={data.prioritaet}
                onChange={(e) => upd("prioritaet", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="quick-select-prio"
              >
                <option value="niedrig">niedrig</option>
                <option value="normal">normal</option>
                <option value="hoch">hoch</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fällig am</label>
              <input
                type="date"
                value={data.faellig_am ? data.faellig_am.slice(0, 10) : ""}
                onChange={(e) => upd("faellig_am", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="quick-input-faellig"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Zugewiesen an</label>
            <select
              value={data.zugewiesen_an}
              onChange={(e) => upd("zugewiesen_an", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="quick-select-mit"
            >
              <option value="">— Niemand —</option>
              {mitarbeiter.map(m => (
                <option key={m.username} value={m.username}>{m.anzeige_name}</option>
              ))}
            </select>
          </div>
          {isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={data.status}
                onChange={(e) => upd("status", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="quick-select-status"
              >
                <option value="offen">Offen</option>
                <option value="in_arbeit">In Arbeit</option>
                <option value="erledigt">Erledigt</option>
              </select>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Diese Aufgabe wird {kunde_id ? "diesem Kunden" : "diesem Projekt"} zugeordnet und erscheint überall, wo die Aufgaben dieses {kunde_id ? "Kunden" : "Projekts"} angezeigt werden.
          </p>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="quick-btn-save"
          >
            {saving ? "Speichere…" : isEdit ? "Speichern" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AufgabenPanel;
