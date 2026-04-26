import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Wrench, Car, Package, Briefcase, Building2, MoreHorizontal,
  Plus, Trash2, X, AlertCircle, CheckCircle2, Clock, RefreshCw, Filter,
} from "lucide-react";

const KATEGORIE_LABELS = {
  auto: "Auto / Fahrzeug",
  werkzeug: "Werkzeug",
  lager: "Lager / Material",
  fahrzeug: "Fahrzeug",
  buero: "Büro / Verwaltung",
  sonstige: "Sonstige",
};

const KATEGORIE_ICONS = {
  auto: Car,
  fahrzeug: Car,
  werkzeug: Wrench,
  lager: Package,
  buero: Briefcase,
  sonstige: MoreHorizontal,
};

const PRIO_STYLES = {
  hoch: "bg-red-50 text-red-700 border-red-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  niedrig: "bg-gray-50 text-gray-600 border-gray-200",
};

const STATUS_STYLES = {
  offen: { cls: "bg-amber-50 text-amber-800 border-amber-200", icon: AlertCircle, label: "Offen" },
  in_arbeit: { cls: "bg-blue-50 text-blue-800 border-blue-200", icon: Clock, label: "In Arbeit" },
  erledigt: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2, label: "Erledigt" },
};

const WIEDERHOLUNG_LABELS = {
  einmalig: "Einmalig",
  taeglich: "Täglich",
  woechentlich: "Wöchentlich",
  monatlich: "Monatlich",
};

export default function ModuleAufgabenPage() {
  const [aufgaben, setAufgaben] = useState([]);
  const [meta, setMeta] = useState(null);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKategorie, setFilterKategorie] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [list, m, mit] = await Promise.all([
        api.get("/module-aufgaben", {
          params: { status: filterStatus, kategorie: filterKategorie },
        }),
        meta ? Promise.resolve({ data: meta }) : api.get("/module-aufgaben/meta"),
        mitarbeiter.length ? Promise.resolve({ data: mitarbeiter }) : api.get("/module-aufgaben/mitarbeiter"),
      ]);
      setAufgaben(Array.isArray(list.data) ? list.data : []);
      if (!meta) setMeta(m.data);
      if (!mitarbeiter.length) setMitarbeiter(Array.isArray(mit.data) ? mit.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Aufgaben konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus, filterKategorie]);  // eslint-disable-line

  const stats = useMemo(() => {
    const s = { offen: 0, in_arbeit: 0, erledigt: 0 };
    aufgaben.forEach(a => { if (s[a.status] !== undefined) s[a.status] += 1; });
    return s;
  }, [aufgaben]);

  const setStatus = async (a, status) => {
    try {
      await api.patch(`/module-aufgaben/${a.id}/status`, { status });
      toast.success(`Status: ${STATUS_STYLES[status].label}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Statusänderung fehlgeschlagen");
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Aufgabe "${a.titel}" wirklich löschen?`)) return;
    try {
      await api.delete(`/module-aufgaben/${a.id}`);
      toast.success("Aufgabe gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6" data-testid="module-aufgaben-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Aufgaben
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interne Aufgaben (Auto waschen, Werkzeugpflege, Lager …) – getrennt von Kundenaufträgen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 hover:bg-muted rounded-sm border"
            title="Neu laden"
            data-testid="btn-aufgaben-reload"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
            data-testid="btn-aufgabe-create"
          >
            <Plus className="w-4 h-4" /> Neue Aufgabe
          </button>
        </div>
      </div>

      {/* Stats-Kacheln */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { key: "offen", label: "Offen" },
          { key: "in_arbeit", label: "In Arbeit" },
          { key: "erledigt", label: "Erledigt" },
        ].map(({ key, label }) => {
          const Icon = STATUS_STYLES[key].icon;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={`border rounded-md p-3 text-left transition-colors ${
                filterStatus === key ? STATUS_STYLES[key].cls + " ring-2 ring-offset-1 ring-current" : "bg-background hover:bg-muted/50"
              }`}
              data-testid={`stat-${key}`}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="w-3.5 h-3.5" /> {label}
              </div>
              <div className="text-2xl font-bold mt-1">{stats[key]}</div>
            </button>
          );
        })}
      </div>

      {/* Kategorie-Filter */}
      <div className="flex items-center gap-2 flex-wrap mb-4 text-sm">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <button
          onClick={() => setFilterKategorie("")}
          className={`px-2 py-1 rounded-sm border ${!filterKategorie ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          Alle
        </button>
        {Object.keys(KATEGORIE_LABELS).map(k => (
          <button
            key={k}
            onClick={() => setFilterKategorie(filterKategorie === k ? "" : k)}
            className={`px-2 py-1 rounded-sm border ${filterKategorie === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            data-testid={`filter-kategorie-${k}`}
          >
            {KATEGORIE_LABELS[k]}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Aufgaben...</div>
      ) : aufgaben.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-md text-muted-foreground" data-testid="empty-state">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Aufgaben{filterStatus || filterKategorie ? " mit diesem Filter" : ""}.</p>
          <p className="text-xs mt-1">Lege die erste Aufgabe an, z. B. "Werkbank aufräumen" oder "Firmenwagen waschen".</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="aufgaben-list">
          {aufgaben.map(a => {
            const Icon = KATEGORIE_ICONS[a.kategorie] || MoreHorizontal;
            const StatusIcon = STATUS_STYLES[a.status].icon;
            const mitarbeiterName = mitarbeiter.find(m => m.username === a.zugewiesen_an)?.anzeige_name || a.zugewiesen_an;
            return (
              <div
                key={a.id}
                className={`border rounded-md p-3 bg-background hover:shadow-sm transition-shadow ${a.status === "erledigt" ? "opacity-70" : ""}`}
                data-testid={`aufgabe-${a.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-sm border flex-shrink-0 ${STATUS_STYLES[a.status].cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold ${a.status === "erledigt" ? "line-through text-muted-foreground" : ""}`}>
                        {a.titel}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-sm border ${PRIO_STYLES[a.prioritaet]}`}>
                        {a.prioritaet}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-sm border flex items-center gap-1 ${STATUS_STYLES[a.status].cls}`}>
                        <StatusIcon className="w-3 h-3" /> {STATUS_STYLES[a.status].label}
                      </span>
                      {a.wiederholung !== "einmalig" && (
                        <span className="text-xs text-muted-foreground">⟳ {WIEDERHOLUNG_LABELS[a.wiederholung]}</span>
                      )}
                    </div>
                    {a.beschreibung && <p className="text-sm text-muted-foreground mt-1">{a.beschreibung}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{KATEGORIE_LABELS[a.kategorie] || a.kategorie}</span>
                      {mitarbeiterName && <span>👤 {mitarbeiterName}</span>}
                      {a.faellig_am && <span>📅 fällig: {new Date(a.faellig_am).toLocaleDateString("de-DE")}</span>}
                      {a.erledigt_am && (
                        <span className="text-emerald-700">
                          ✓ erledigt am {new Date(a.erledigt_am).toLocaleDateString("de-DE")} von {a.erledigt_von}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <select
                      value={a.status}
                      onChange={(e) => setStatus(a, e.target.value)}
                      className="text-xs border rounded-sm px-2 py-1 bg-background"
                      data-testid={`select-status-${a.id}`}
                    >
                      <option value="offen">Offen</option>
                      <option value="in_arbeit">In Arbeit</option>
                      <option value="erledigt">Erledigt</option>
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(a)}
                        className="text-xs px-2 py-1 border rounded-sm hover:bg-muted"
                        data-testid={`btn-edit-${a.id}`}
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => remove(a)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-sm border border-transparent hover:border-red-200"
                        title="Löschen"
                        data-testid={`btn-delete-${a.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showCreate || editing) && (
        <AufgabeDialog
          aufgabe={editing}
          meta={meta}
          mitarbeiter={mitarbeiter}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

const AufgabeDialog = ({ aufgabe, meta, mitarbeiter, onClose, onSaved }) => {
  const isEdit = !!aufgabe;
  const [data, setData] = useState({
    titel: aufgabe?.titel || "",
    beschreibung: aufgabe?.beschreibung || "",
    kategorie: aufgabe?.kategorie || "sonstige",
    prioritaet: aufgabe?.prioritaet || "normal",
    zugewiesen_an: aufgabe?.zugewiesen_an || "",
    faellig_am: aufgabe?.faellig_am || "",
    wiederholung: aufgabe?.wiederholung || "einmalig",
    status: aufgabe?.status || "offen",
  });
  const [saving, setSaving] = useState(false);

  const upd = (k, v) => setData(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!data.titel.trim()) { toast.error("Titel erforderlich"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/module-aufgaben/${aufgabe.id}`, data);
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="aufgabe-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm" data-testid="btn-dialog-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <input
              value={data.titel}
              onChange={(e) => upd("titel", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="z.B. Firmenwagen waschen"
              data-testid="input-titel"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={data.beschreibung}
              onChange={(e) => upd("beschreibung", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[70px]"
              placeholder="Optional: Details, Hinweise, Material …"
              data-testid="input-beschreibung"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Kategorie</label>
              <select
                value={data.kategorie}
                onChange={(e) => upd("kategorie", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="select-kategorie"
              >
                {(meta?.kategorien || []).map(k => (
                  <option key={k} value={k}>{KATEGORIE_LABELS[k] || k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priorität</label>
              <select
                value={data.prioritaet}
                onChange={(e) => upd("prioritaet", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="select-prioritaet"
              >
                {(meta?.prioritaeten || []).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Zugewiesen an</label>
              <select
                value={data.zugewiesen_an}
                onChange={(e) => upd("zugewiesen_an", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="select-mitarbeiter"
              >
                <option value="">— Niemand —</option>
                {mitarbeiter.map(m => (
                  <option key={m.username} value={m.username}>{m.anzeige_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fällig am</label>
              <input
                type="date"
                value={data.faellig_am ? data.faellig_am.slice(0, 10) : ""}
                onChange={(e) => upd("faellig_am", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="input-faellig"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Wiederholung</label>
              <select
                value={data.wiederholung}
                onChange={(e) => upd("wiederholung", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="select-wiederholung"
              >
                {(meta?.wiederholungen || []).map(w => (
                  <option key={w} value={w}>{WIEDERHOLUNG_LABELS[w] || w}</option>
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
                  data-testid="select-edit-status"
                >
                  <option value="offen">Offen</option>
                  <option value="in_arbeit">In Arbeit</option>
                  <option value="erledigt">Erledigt</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-dialog-save"
          >
            {saving ? "Speichere…" : isEdit ? "Speichern" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
};
