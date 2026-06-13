import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useF1Help } from "@/lib/useF1Help";import { toast } from "sonner";
import {
  Wrench, Car, Package, Briefcase, Building2, MoreHorizontal,
  Plus, Trash2, X, AlertCircle, CheckCircle2, Clock, RefreshCw, Filter, User as UserIcon, Folder, Search, GripVertical,
} from "lucide-react";
import { VorlagenPicker } from "@/components/VorlagenPicker";
import TitleInputWithVorlagen from "@/components/TitleInputWithVorlagen";
import { TextareaWithAI } from "@/components/TextareaWithAI";
import { colorForUser, initialsOf } from "@/lib/avatarUtils";
import EinsatzModal from "@/components/EinsatzModal";

// Kategorien sind reine Datenmaske aus module_textvorlagen — kein Hardcoding
// (siehe VISION.md, 06.05.2026). Diese Heuristik liefert nur Icons je
// Kategorie-Name (rein optisch, kein Datenpfad).
const ICON_HEURISTIK = (name) => {
  const n = (name || "").toLowerCase();
  if (n.includes("auto") || n.includes("fahrzeug")) return Car;
  if (n.includes("werkzeug") || n.includes("montage")) return Wrench;
  if (n.includes("material") || n.includes("lieferung") || n.includes("lager")) return Package;
  if (n.includes("buero") || n.includes("büro") || n.includes("verwaltung") || n.includes("kunden")) return Briefcase;
  return MoreHorizontal;
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
  useF1Help("hilfe_aufgaben");
  const [aufgaben, setAufgaben] = useState([]);
  const [meta, setMeta] = useState(null);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [kundenMap, setKundenMap] = useState({});      // {id: {vorname, nachname, firma}}
  const [projekteMap, setProjekteMap] = useState({});  // {id: {titel, kunde_id}}
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKategorie, setFilterKategorie] = useState("");
  // Auswahl Kunde/Projekt für gezieltes Aufgaben-Anlegen (Ralph 12.05.2026)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null); // {type:'kunde'|'projekt', id, label}
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState(new Set());
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [einsatzCtx, setEinsatzCtx] = useState(null);  // {kundeId, projektId?} — zentrales EinsatzModal
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [list, m, mit, kRes, pRes] = await Promise.all([
        api.get("/module-aufgaben", {
          params: { status: filterStatus, kategorie: filterKategorie },
        }),
        meta ? Promise.resolve({ data: meta }) : api.get("/module-aufgaben/meta"),
        mitarbeiter.length ? Promise.resolve({ data: mitarbeiter }) : api.get("/module-aufgaben/mitarbeiter"),
        api.get("/modules/kunden/data"),
        api.get("/module-projekte/").catch(() => ({ data: [] })),
      ]);
      setAufgaben(Array.isArray(list.data) ? list.data : []);
      if (!meta) setMeta(m.data);
      if (!mitarbeiter.length) setMitarbeiter(Array.isArray(mit.data) ? mit.data : []);
      // Datenmasken: ID→Name-Maps (kein Daten-Duplikat in Aufgabe selber)
      const km = {};
      (kRes.data || []).forEach(k => { km[k.id] = { vorname: k.vorname, nachname: k.nachname, firma: k.firma }; });
      setKundenMap(km);
      const pm = {};
      (pRes.data || []).forEach(p => { pm[p.id] = { titel: p.titel, kunde_id: p.kunde_id }; });
      setProjekteMap(pm);
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

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const remove = async (a) => {
    if (confirmDeleteId !== a.id) {
      setConfirmDeleteId(a.id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === a.id ? null : cur)), 4000);
      return;
    }
    try {
      await api.delete(`/module-aufgaben/${a.id}`);
      toast.success("Aufgabe gelöscht");
      setConfirmDeleteId(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  // Drag & Drop Sortierung (analog Termine/Projekte)
  const handleRowDrop = async (dropIdx) => {
    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null); setDragOverIndex(null);
      return;
    }
    const reordered = [...filteredAufgaben];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIdx, 0, moved);

    const reorderedIds = reordered.map(a => a.id);
    const others = aufgaben.filter(a => !reorderedIds.includes(a.id));
    setAufgaben([...reordered, ...others]);
    setDragIndex(null); setDragOverIndex(null);

    try {
      await api.patch("/module-aufgaben/reorder", { ids: reorderedIds });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Sortierung speichern fehlgeschlagen");
      load();
    }
  };

  // Datenmaske: ID → lesbarer Kunden-Name
  const kundeLabel = (kunde_id) => {
    const k = kundenMap[kunde_id];
    if (!k) return null;
    if (k.firma) return k.firma;
    return [k.vorname, k.nachname].filter(Boolean).join(" ") || null;
  };

  // Such-Treffer: Kunden + Projekte gefiltert nach Query
  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return { kunden: [], projekte: [] };
    const kunden = Object.entries(kundenMap)
      .map(([id, k]) => {
        const label = k.firma || [k.vorname, k.nachname].filter(Boolean).join(" ") || id;
        return { id, label };
      })
      .filter(k => k.label.toLowerCase().includes(q))
      .slice(0, 8);
    const projekte = Object.entries(projekteMap)
      .map(([id, p]) => {
        const kName = kundeLabel(p.kunde_id);
        return { id, titel: p.titel || "(ohne Titel)", kunde_id: p.kunde_id, kundeLabel: kName };
      })
      .filter(p => (p.titel || "").toLowerCase().includes(q) || (p.kundeLabel || "").toLowerCase().includes(q))
      .slice(0, 8);
    return { kunden, projekte };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, kundenMap, projekteMap]);

  // Gefilterte Aufgaben-Liste basierend auf selectedTarget + Mitarbeiter-Filter
  const filteredAufgaben = useMemo(() => {
    let base = aufgaben;
    if (selectedTarget) {
      if (selectedTarget.type === "kunde") {
        const projektIdsOfKunde = Object.entries(projekteMap)
          .filter(([, p]) => p.kunde_id === selectedTarget.id)
          .map(([id]) => id);
        base = aufgaben.filter(a =>
          a.kunde_id === selectedTarget.id ||
          (a.projekt_id && projektIdsOfKunde.includes(a.projekt_id))
        );
      } else if (selectedTarget.type === "projekt") {
        base = aufgaben.filter(a => a.projekt_id === selectedTarget.id);
      }
    }
    if (selectedMitarbeiter.size > 0) {
      base = base.filter(a => a.zugewiesen_an && selectedMitarbeiter.has(a.zugewiesen_an));
    }
    return base;
  }, [aufgaben, selectedTarget, projekteMap, selectedMitarbeiter]);

  const uniqueMitarbeiter = useMemo(() => {
    const set = new Set();
    aufgaben.forEach(a => { if (a.zugewiesen_an) set.add(a.zugewiesen_an); });
    return Array.from(set).sort();
  }, [aufgaben]);

  const toggleMitarbeiter = (username) => {
    setSelectedMitarbeiter(prev => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6" data-testid="module-aufgaben-page">
      <div className="flex items-center justify-between mb-4">
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
          {selectedTarget && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
              data-testid="btn-aufgabe-create"
            >
              <Plus className="w-4 h-4" /> Neue Aufgabe
            </button>
          )}
          {selectedTarget && (
            <button
              onClick={() => setEinsatzCtx(
                selectedTarget.type === "kunde"
                  ? { kundeId: selectedTarget.id }
                  : { kundeId: selectedTarget.kunde_id, projektId: selectedTarget.id, projektTitel: selectedTarget.label }
              )}
              className="flex items-center gap-1 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-sm hover:bg-orange-100"
              data-testid="btn-aufgabe-einsatz"
              disabled={selectedTarget.type === "projekt" && !selectedTarget.kunde_id}
            >
              <Wrench className="w-4 h-4" /> Neuer Einsatz
            </button>
          )}
        </div>
      </div>

      {/* Suchzeile: Kunde oder Projekt wählen, um Aufgaben zu sehen / anzulegen */}
      <div className="mb-4" data-testid="aufgaben-search-section">
        {selectedTarget ? (
          <div className="flex items-center gap-2 p-3 bg-muted/40 border rounded-md" data-testid="selected-target">
            {selectedTarget.type === "kunde" ? (
              <UserIcon className="w-4 h-4 text-blue-700" />
            ) : (
              <Folder className="w-4 h-4 text-emerald-700" />
            )}
            <span className="text-sm font-medium">
              {selectedTarget.type === "kunde" ? "Kunde: " : "Projekt: "}
              {selectedTarget.label}
            </span>
            <button
              onClick={() => { setSelectedTarget(null); setSearchQuery(""); }}
              className="ml-auto p-1 hover:bg-background rounded-sm"
              title="Auswahl entfernen"
              data-testid="btn-clear-target"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Kunde oder Projekt suchen, um Aufgaben anzuzeigen oder anzulegen …"
                className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
                data-testid="aufgaben-search-input"
              />
            </div>
            {searchFocused && searchQuery.trim() && (searchHits.kunden.length > 0 || searchHits.projekte.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 max-h-80 overflow-auto" data-testid="search-results">
                {searchHits.kunden.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                      Kunden ({searchHits.kunden.length})
                    </div>
                    {searchHits.kunden.map(k => (
                      <button
                        key={`k-${k.id}`}
                        onClick={() => {
                          setSelectedTarget({ type: "kunde", id: k.id, label: k.label });
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0"
                        data-testid={`search-hit-kunde-${k.id}`}
                      >
                        <UserIcon className="w-4 h-4 text-blue-700 flex-shrink-0" />
                        <span>{k.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchHits.projekte.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                      Projekte ({searchHits.projekte.length})
                    </div>
                    {searchHits.projekte.map(p => (
                      <button
                        key={`p-${p.id}`}
                        onClick={() => {
                          setSelectedTarget({ type: "projekt", id: p.id, label: p.titel, kunde_id: p.kunde_id });
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0"
                        data-testid={`search-hit-projekt-${p.id}`}
                      >
                        <Folder className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        <span>{p.titel}</span>
                        {p.kundeLabel && (
                          <span className="text-xs text-muted-foreground ml-auto">({p.kundeLabel})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {searchFocused && searchQuery.trim() && searchHits.kunden.length === 0 && searchHits.projekte.length === 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 p-3 text-sm text-muted-foreground" data-testid="search-empty">
                Keine Treffer für „{searchQuery}".
              </div>
            )}
          </div>
        )}
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

      {/* Kategorie-Filter (Datenmaske: live aus module_textvorlagen) */}
      <div className="flex items-center gap-2 flex-wrap mb-4 text-sm">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <button
          onClick={() => setFilterKategorie("")}
          className={`px-2 py-1 rounded-sm border ${!filterKategorie ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          data-testid="filter-kategorie-alle"
        >
          Alle
        </button>
        {(meta?.kategorien || []).map(k => (
          <button
            key={k}
            onClick={() => setFilterKategorie(filterKategorie === k ? "" : k)}
            className={`px-2 py-1 rounded-sm border ${filterKategorie === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            data-testid={`filter-kategorie-${k}`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Aufgaben...</div>
      ) : filteredAufgaben.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-md text-muted-foreground" data-testid="empty-state">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{selectedTarget ? `Keine Aufgaben für ${selectedTarget.type === "kunde" ? "diesen Kunden" : "dieses Projekt"}${filterStatus || filterKategorie ? " mit diesem Filter" : ""}.` : "Keine Aufgaben vorhanden."}</p>
          {selectedTarget && <p className="text-xs mt-1">Klicke oben rechts auf „+ Neue Aufgabe".</p>}
        </div>
      ) : (
        <div className="space-y-2" data-testid="aufgaben-list">
          {uniqueMitarbeiter.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pb-2 mb-1 border-b" data-testid="mitarbeiter-filter-bar">
              <span className="text-xs text-muted-foreground font-medium">Mitarbeiter-Filter:</span>
              {uniqueMitarbeiter.map(u => {
                const active = selectedMitarbeiter.has(u);
                const c = colorForUser(u);
                const label = mitarbeiter.find(m => m.username === u)?.anzeige_name || u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => toggleMitarbeiter(u)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-full border text-xs transition-all ${active ? `${c.bg} text-white border-transparent shadow` : "bg-background border-border hover:bg-muted"}`}
                    title={label}
                    data-testid={`mitarbeiter-filter-${u}`}
                  >
                    <span className={`w-5 h-5 rounded-full ${c.bg} text-white text-[10px] font-bold flex items-center justify-center`}>
                      {initialsOf(u)}
                    </span>
                    <span className={active ? "" : "text-foreground"}>{label}</span>
                  </button>
                );
              })}
              {selectedMitarbeiter.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMitarbeiter(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  data-testid="mitarbeiter-filter-reset"
                >
                  <X className="w-3 h-3" /> Alle anzeigen
                </button>
              )}
            </div>
          )}
          {filteredAufgaben.map((a, idx) => {
            const Icon = ICON_HEURISTIK(a.kategorie);
            const StatusIcon = STATUS_STYLES[a.status].icon;
            const mitarbeiterName = mitarbeiter.find(m => m.username === a.zugewiesen_an)?.anzeige_name || a.zugewiesen_an;
            const mitColor = colorForUser(a.zugewiesen_an);
            return (
              <div
                key={a.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={() => handleRowDrop(idx)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                className={`border border-l-4 rounded-md p-3 bg-background hover:shadow-sm transition-shadow ${mitColor ? mitColor.border : "border-l-transparent"} ${a.status === "erledigt" ? "opacity-70" : ""} ${dragOverIndex === idx ? "border-primary/50 bg-primary/5" : ""} ${dragIndex === idx ? "opacity-40" : ""}`}
                data-testid={`aufgabe-${a.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0" title="Zum Sortieren ziehen" data-testid={`drag-handle-${a.id}`}>
                    <GripVertical className="w-4 h-4" />
                  </div>
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
                    {a.beschreibung && <p className="text-sm text-foreground mt-1" data-testid={`aufgabe-beschreibung-${a.id}`}>{a.beschreibung}</p>}
                    {(a.kunde_id || a.projekt_id) && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap" data-testid={`aufgabe-zuordnung-${a.id}`}>
                        {a.kunde_id && kundeLabel(a.kunde_id) && (
                          <button
                            onClick={() => navigate(`/kunden?edit=${a.kunde_id}`)}
                            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-sm px-2 py-0.5 hover:bg-blue-100 transition-colors"
                            data-testid={`btn-aufgabe-kunde-${a.id}`}
                            title="Zum Kunden springen"
                          >
                            <UserIcon className="w-3 h-3" /> {kundeLabel(a.kunde_id)}
                          </button>
                        )}
                        {a.projekt_id && projekteMap[a.projekt_id]?.titel && (
                          <button
                            onClick={() => navigate(`/projekte/${a.projekt_id}`)}
                            className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-sm px-2 py-0.5 hover:bg-emerald-100 transition-colors"
                            data-testid={`btn-aufgabe-projekt-${a.id}`}
                            title="Zum Projekt springen"
                          >
                            <Folder className="w-3 h-3" /> {projekteMap[a.projekt_id].titel}
                          </button>
                        )}
                        {a.kunde_id && !kundeLabel(a.kunde_id) && (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-2 py-0.5">
                            Kunde nicht gefunden (gelöscht?)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{a.kategorie || "—"}</span>
                      {a.zugewiesen_an && (
                        <span className="flex items-center gap-1.5">
                          <span className={`w-5 h-5 rounded-full ${mitColor.bg} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`} title={mitarbeiterName}>
                            {initialsOf(a.zugewiesen_an)}
                          </span>
                          <span>{mitarbeiterName}</span>
                        </span>
                      )}
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
                        className={`p-1 rounded-sm border transition-colors ${confirmDeleteId === a.id ? "bg-red-500 text-white border-red-500" : "text-red-500 hover:bg-red-50 border-transparent hover:border-red-200"}`}
                        title={confirmDeleteId === a.id ? "Nochmal klicken zum Bestätigen" : "Löschen"}
                        data-testid={`btn-delete-${a.id}`}
                      >
                        {confirmDeleteId === a.id ? (
                          <span className="text-xs font-bold px-1">Wirklich?</span>
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
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
          kundenMap={kundenMap}
          projekteMap={projekteMap}
          selectedTarget={selectedTarget}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}

      <EinsatzModal
        open={!!einsatzCtx}
        context={einsatzCtx || {}}
        onClose={() => setEinsatzCtx(null)}
        onSaved={() => {}}
      />
    </div>
  );
}

const AufgabeDialog = ({ aufgabe, meta, mitarbeiter, kundenMap, projekteMap, selectedTarget, onClose, onSaved }) => {
  const isEdit = !!aufgabe;
  // Vorbelegung: bei Neuanlage aus selectedTarget; bei Edit aus aufgabe selbst
  const initialKundeId = isEdit
    ? (aufgabe?.kunde_id || "")
    : (selectedTarget?.type === "kunde" ? selectedTarget.id : (selectedTarget?.type === "projekt" ? (selectedTarget.kunde_id || "") : ""));
  const initialProjektId = isEdit
    ? (aufgabe?.projekt_id || "")
    : (selectedTarget?.type === "projekt" ? selectedTarget.id : "");
  const [data, setData] = useState({
    titel: aufgabe?.titel || "",
    beschreibung: aufgabe?.beschreibung || "",
    kategorie: aufgabe?.kategorie || "",
    prioritaet: aufgabe?.prioritaet || "normal",
    zugewiesen_an: aufgabe?.zugewiesen_an || "",
    faellig_am: aufgabe?.faellig_am || "",
    wiederholung: aufgabe?.wiederholung || "einmalig",
    status: aufgabe?.status || "offen",
    kunde_id: initialKundeId,
    projekt_id: initialProjektId,
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
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm" data-testid="btn-dialog-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <TitleInputWithVorlagen
            value={data.titel}
            onChange={(v) => upd("titel", v)}
            docType="aufgabe_titel"
            fallbackDocTypes={["aufgabe"]}
            label="Titel"
            required
            autoFocus
            placeholder="z.B. Firmenwagen waschen"
          />

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <TextareaWithAI
              value={data.beschreibung || ""}
              onChange={(e) => upd("beschreibung", e.target.value)}
              rows={3}
              placeholder="Optional: Details, Hinweise, Material …"
              feldLabel="Aufgaben-Beschreibung"
              kontext="aufgabe"
              testId="aufgabe-beschreibung"
            />
          </div>

          {/* Datenmaske: Kunden- und Projektzuordnung — wird oben in der Seite gewählt, hier nur Info */}
          {(data.kunde_id || data.projekt_id) && (
            <div className="flex items-center gap-2 p-2 bg-muted/40 border rounded-sm text-xs text-muted-foreground" data-testid="aufgabe-context-info">
              <span>Zuordnung:</span>
              {data.kunde_id && kundenMap[data.kunde_id] && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-sm px-2 py-0.5">
                  <UserIcon className="w-3 h-3" />
                  {kundenMap[data.kunde_id].firma || [kundenMap[data.kunde_id].vorname, kundenMap[data.kunde_id].nachname].filter(Boolean).join(" ")}
                </span>
              )}
              {data.projekt_id && projekteMap[data.projekt_id] && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-sm px-2 py-0.5">
                  <Folder className="w-3 h-3" />
                  {projekteMap[data.projekt_id].titel}
                </span>
              )}
            </div>
          )}

          {/* Projekt-Auswahl: optional. Nur anzeigen, wenn der Kunde Projekte hat. */}
          {data.kunde_id && Object.values(projekteMap).some(p => p.kunde_id === data.kunde_id) && (
            <div data-testid="aufgabe-projekt-wrap">
              <label className="block text-sm font-medium mb-1">
                Projekt
                <span className="text-xs text-muted-foreground font-normal"> · optional</span>
              </label>
              <select
                value={data.projekt_id || ""}
                onChange={(e) => upd("projekt_id", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="select-projekt"
              >
                <option value="">— Kein Projekt —</option>
                {Object.entries(projekteMap)
                  .filter(([, p]) => p.kunde_id === data.kunde_id)
                  .map(([id, p]) => (
                    <option key={id} value={id}>{p.titel || "(ohne Titel)"}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Kategorie
                <span className="text-xs text-muted-foreground font-normal"> · Pflege in Einstellungen → Textvorlagen</span>
              </label>
              {(meta?.kategorien || []).length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm p-2">
                  Noch keine Kategorien vorhanden. Lege welche unter Einstellungen → Textvorlagen → „Aufgaben-Kategorie" an.
                </div>
              ) : (
                <select
                  value={data.kategorie}
                  onChange={(e) => upd("kategorie", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="select-kategorie"
                >
                  <option value="">— bitte wählen —</option>
                  {data.kategorie && !(meta?.kategorien || []).includes(data.kategorie) && (
                    <option value={data.kategorie}>{data.kategorie}</option>
                  )}
                  {(meta?.kategorien || []).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              )}
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
