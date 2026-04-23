import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  FileText, Plus, Search, CheckCircle2, AlertCircle, Clock, XCircle,
  Settings as SettingsIcon, Scale, Trash2, Hash, Power,
} from "lucide-react";

/**
 * Dokumente v2 – Admin-Übersicht (Phase 1: Liste + CRUD + Nummer + GoBD-Schutz)
 * Strikt isoliert von bestehenden Dokument-Seiten.
 */
const TYPE_LABEL = {
  angebot: "Angebot",
  auftrag: "Auftrag",
  rechnung: "Rechnung",
  gutschrift: "Gutschrift",
};

const TYPE_STRICT = { rechnung: true, gutschrift: true };

const STATUS_BADGES = {
  entwurf: { label: "Entwurf", cls: "bg-gray-100 text-gray-700", icon: Clock },
  erstellt: { label: "Erstellt", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
  storniert: { label: "Storniert", cls: "bg-red-100 text-red-700", icon: XCircle },
};

export function DokumenteV2Page() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState("angebot");
  const [newKunde, setNewKunde] = useState("");
  const [newBetreff, setNewBetreff] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        api.get("/dokumente-v2/admin/settings"),
        api.get("/dokumente-v2/admin/dokumente", { params: typeFilter ? { type: typeFilter } : {} }),
      ]);
      setSettings(s.data);
      setItems(Array.isArray(d.data) ? d.data : []);
    } catch (err) {
      toast.error("Laden fehlgeschlagen: " + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [typeFilter]); // eslint-disable-line

  const filtered = items.filter(d => {
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    return (d.nummer || "").toLowerCase().includes(t)
      || (d.kunde_name || "").toLowerCase().includes(t)
      || (d.betreff || "").toLowerCase().includes(t);
  });

  const toggleFeature = async () => {
    try {
      const res = await api.put("/dokumente-v2/admin/settings", { feature_enabled: !settings?.feature_enabled });
      setSettings(res.data);
      toast.success(res.data.feature_enabled ? "Modul aktiviert" : "Deaktiviert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const createDraft = async () => {
    if (!newKunde || !newBetreff) {
      toast.error("Kundenname und Betreff sind erforderlich");
      return;
    }
    try {
      const res = await api.post("/dokumente-v2/admin/dokumente", {
        type: newType,
        kunde_name: newKunde,
        betreff: newBetreff,
      });
      toast.success(`${TYPE_LABEL[newType]} als Entwurf angelegt`);
      setShowNew(false);
      setNewKunde(""); setNewBetreff("");
      navigate(`/dokumente-v2/${res.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const issueDoc = async (d) => {
    if (!window.confirm(`${TYPE_LABEL[d.type]} erstellen und Nummer vergeben? (nicht mehr änderbar bei Rechnung/Gutschrift)`)) return;
    try {
      const res = await api.post(`/dokumente-v2/admin/dokumente/${d.id}/issue`);
      toast.success(`Nummer vergeben: ${res.data.nummer}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const deleteDoc = async (d) => {
    if (!window.confirm("Wirklich löschen?")) return;
    try {
      await api.delete(`/dokumente-v2/admin/dokumente/${d.id}`);
      toast.success("Gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const cancelDoc = async (d) => {
    const reason = window.prompt("Stornierungsgrund:", "");
    if (reason === null) return;
    try {
      await api.post(`/dokumente-v2/admin/dokumente/${d.id}/cancel`, {}, { params: { reason } });
      toast.success("Storniert");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  return (
    <div className="space-y-6" data-testid="dokumente-v2-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dokumente v2</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Neues isoliertes Modul · GoBD-konforme Nummernkreise
              {settings && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${settings.feature_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  <Power className="w-3 h-3" />
                  {settings.feature_enabled ? "Aktiv" : "Inaktiv"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(v => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted text-sm" data-testid="dok-v2-settings-btn">
            <SettingsIcon className="w-4 h-4" /> Einstellungen
          </button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm" data-testid="dok-v2-new-btn">
            <Plus className="w-4 h-4" /> Neu
          </button>
        </div>
      </div>

      {showSettings && settings && (
        <div className="border rounded-xl bg-card p-4 space-y-2" data-testid="dok-v2-settings-panel">
          <div className="flex items-center justify-between">
            <div className="font-medium">Modul-Status</div>
            <button onClick={toggleFeature} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${settings.feature_enabled ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"}`} data-testid="dok-v2-feature-toggle">
              {settings.feature_enabled ? "Aktiv" : "Inaktiv"}
            </button>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-2 grid grid-cols-2 gap-y-1">
            <div>Prefix Angebot: <code>{settings.prefix_angebot}</code></div>
            <div>Prefix Auftrag: <code>{settings.prefix_auftrag}</code></div>
            <div>Prefix Rechnung: <code>{settings.prefix_rechnung}</code></div>
            <div>Prefix Gutschrift: <code>{settings.prefix_gutschrift}</code></div>
            <div>Reset: <code>{settings.counter_reset}</code></div>
            <div>Padding: <code>{settings.number_padding}</code></div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {["", "angebot", "auftrag", "rechnung", "gutschrift"].map(t => (
            <button
              key={t || "all"}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              data-testid={`dok-v2-filter-${t || "all"}`}
            >
              {t ? TYPE_LABEL[t] : "Alle"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nummer, Kunde, Betreff…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            data-testid="dok-v2-search"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="border rounded-xl bg-card overflow-hidden" data-testid="dok-v2-list">
        <div className="px-4 py-3 border-b bg-muted/30 text-sm font-medium flex justify-between">
          <span>{loading ? "Lade…" : `${filtered.length} Dokument${filtered.length === 1 ? "" : "e"}`}</span>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Noch keine Dokumente. Klicke <strong>„Neu"</strong> um zu starten.
          </div>
        )}
        <div className="divide-y">
          {filtered.map(d => {
            const sb = STATUS_BADGES[d.status] || STATUS_BADGES.entwurf;
            const StatusIcon = sb.icon;
            return (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 gap-3" data-testid={`dok-v2-row-${d.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">{TYPE_LABEL[d.type]}</span>
                    {d.nummer ? (
                      <span className="font-mono text-sm font-semibold">{d.nummer}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">(noch keine Nummer)</span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sb.cls}`}>
                      <StatusIcon className="w-3 h-3" /> {sb.label}
                    </span>
                    {TYPE_STRICT[d.type] && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200" title="GoBD-geschützt">
                        <Scale className="w-3 h-3" /> GoBD
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {d.kunde_name || "(kein Kunde)"} · {d.betreff || "(kein Betreff)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Brutto: {(d.brutto || 0).toFixed(2).replace(".", ",")} € · {new Date(d.created_at).toLocaleString("de-DE")}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {d.status === "entwurf" && (
                    <button onClick={() => issueDoc(d)} title="Erstellen + Nummer" className="p-2 rounded-lg hover:bg-primary/10 text-primary" data-testid={`dok-v2-issue-${d.id}`}>
                      <Hash className="w-4 h-4" />
                    </button>
                  )}
                  {d.status === "erstellt" && TYPE_STRICT[d.type] && (
                    <button onClick={() => cancelDoc(d)} title="Stornieren (GoBD)" className="p-2 rounded-lg hover:bg-red-50 text-red-600" data-testid={`dok-v2-cancel-${d.id}`}>
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  )}
                  {!(TYPE_STRICT[d.type] && d.status === "erstellt") && (
                    <button onClick={() => deleteDoc(d)} title="Löschen" className="p-2 rounded-lg hover:bg-red-50 text-red-600" data-testid={`dok-v2-delete-${d.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialog Neu */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()} data-testid="dok-v2-new-dialog">
            <div className="font-semibold text-lg">Neues Dokument (Entwurf)</div>
            <label className="block">
              <span className="text-xs text-muted-foreground">Typ</span>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" data-testid="dok-v2-new-type">
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Kunde (Name)</span>
              <input type="text" value={newKunde} onChange={e => setNewKunde(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" data-testid="dok-v2-new-kunde" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Betreff</span>
              <input type="text" value={newBetreff} onChange={e => setNewBetreff(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" data-testid="dok-v2-new-betreff" />
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-lg border text-sm hover:bg-muted">Abbrechen</button>
              <button onClick={createDraft} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90" data-testid="dok-v2-new-save">Anlegen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DokumenteV2Page;
