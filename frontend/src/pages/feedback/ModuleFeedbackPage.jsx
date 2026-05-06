import { useEffect, useMemo, useState, useCallback } from "react";
import { StickyNote, Loader2, Bug, Lightbulb, CheckSquare, Sparkles, Search, Filter, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import FeedbackDetailModal from "./FeedbackDetailModal";

const TYP_META = {
  bug: { label: "Bug", icon: Bug, color: "bg-red-100 text-red-700" },
  feature: { label: "Feature", icon: Sparkles, color: "bg-violet-100 text-violet-700" },
  idee: { label: "Idee", icon: Lightbulb, color: "bg-amber-100 text-amber-700" },
  test: { label: "Test", icon: CheckSquare, color: "bg-sky-100 text-sky-700" },
};

const PRIO_META = {
  hoch: { dot: "bg-red-500", label: "Hoch" },
  normal: { dot: "bg-amber-400", label: "Normal" },
  niedrig: { dot: "bg-emerald-500", label: "Niedrig" },
};

const STATUS_META = {
  offen: { label: "Offen", color: "bg-blue-100 text-blue-800" },
  in_arbeit: { label: "In Arbeit", color: "bg-amber-100 text-amber-800" },
  erledigt: { label: "Erledigt", color: "bg-emerald-100 text-emerald-800" },
};

const fmt = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
};

const ModuleFeedbackPage = () => {
  const [items, setItems] = useState([]);
  const [historyCounts, setHistoryCounts] = useState({});  // {feedback_id: count}
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [typFilter, setTypFilter] = useState("alle");
  const [prioFilter, setPrioFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const inc = includeArchived ? "&include_archived=true" : "";
      const r = await api.get(`/module-feedback/list?status=alle&typ=alle${inc}&limit=500`);
      setItems(r.data || []);
      // Bemerkungen-Zähler asynchron laden (klein, akzeptabel)
      const counts = {};
      await Promise.all((r.data || []).map(async (it) => {
        try {
          const h = await api.get(`/module-feedback/${it.id}/history`);
          counts[it.id] = (h.data || []).filter((e) => e.type === "kommentar").length;
        } catch { counts[it.id] = 0; }
      }));
      setHistoryCounts(counts);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== "alle" && it.status !== statusFilter) return false;
      if (typFilter !== "alle" && it.typ !== typFilter) return false;
      if (prioFilter !== "alle" && it.prio !== prioFilter) return false;
      if (q) {
        const hay = `${it.title} ${it.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, typFilter, prioFilter, search]);

  const stats = useMemo(() => {
    const s = { total: items.length, offen: 0, in_arbeit: 0, erledigt: 0, hoch: 0 };
    items.forEach((it) => {
      if (it.status in s) s[it.status] += 1;
      if (it.prio === "hoch" && it.status !== "erledigt") s.hoch += 1;
    });
    return s;
  }, [items]);

  return (
    <div className="space-y-6" data-testid="module-feedback-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <StickyNote className="w-6 h-6" /> Notizen & Bugs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Persönliche Notizen, gemeldete Bugs, Ideen und Tests – mit komplettem Verlauf pro Eintrag.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="btn-feedback-page-new"
        >
          <Plus className="w-4 h-4" /> Neuer Eintrag
        </button>
      </div>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
        <div className="border rounded-sm p-3 bg-card">
          <div className="text-xs text-muted-foreground">Gesamt</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
          <div className="text-xs text-blue-800">Offen</div>
          <div className="text-2xl font-bold text-blue-900">{stats.offen}</div>
        </div>
        <div className="border rounded-sm p-3 bg-amber-50 border-amber-200">
          <div className="text-xs text-amber-800">In Arbeit</div>
          <div className="text-2xl font-bold text-amber-900">{stats.in_arbeit}</div>
        </div>
        <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
          <div className="text-xs text-emerald-800">Erledigt</div>
          <div className="text-2xl font-bold text-emerald-900">{stats.erledigt}</div>
        </div>
        <div className="border rounded-sm p-3 bg-red-50 border-red-200">
          <div className="text-xs text-red-800">Hohe Prio offen</div>
          <div className="text-2xl font-bold text-red-900">{stats.hoch}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="border rounded-sm p-3 bg-muted/30 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche in Titel / Beschreibung…"
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-sm bg-background"
              data-testid="input-feedback-search"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-sm bg-background"
            data-testid="select-feedback-status"
          >
            <option value="alle">Alle Status</option>
            <option value="offen">Offen</option>
            <option value="in_arbeit">In Arbeit</option>
            <option value="erledigt">Erledigt</option>
          </select>
          <select
            value={typFilter}
            onChange={(e) => setTypFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-sm bg-background"
            data-testid="select-feedback-typ"
          >
            <option value="alle">Alle Typen</option>
            {Object.entries(TYP_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
          <select
            value={prioFilter}
            onChange={(e) => setPrioFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-sm bg-background"
            data-testid="select-feedback-prio"
          >
            <option value="alle">Alle Prios</option>
            {Object.entries(PRIO_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              data-testid="checkbox-feedback-archive"
            />
            Archiv (älter als 30 Tage) einschließen
          </label>
        </div>
      </div>

      {/* Tabelle */}
      <div className="border rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Titel</th>
                <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">Typ</th>
                <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">Prio</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold hidden lg:table-cell">Erstellt</th>
                <th className="text-left px-3 py-2 font-semibold hidden lg:table-cell">Geändert</th>
                <th className="text-center px-3 py-2 font-semibold hidden md:table-cell">Bemerkungen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Lade…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Keine Einträge mit diesen Filtern.
                </td></tr>
              ) : filtered.map((it) => {
                const meta = TYP_META[it.typ] || TYP_META.bug;
                const TypIcon = meta.icon;
                const prio = PRIO_META[it.prio] || PRIO_META.normal;
                const status = STATUS_META[it.status] || STATUS_META.offen;
                const cnt = historyCounts[it.id] || 0;
                return (
                  <tr
                    key={it.id}
                    onClick={() => setSelected(it)}
                    className="border-b hover:bg-accent/30 cursor-pointer"
                    data-testid={`feedback-row-${it.id}`}
                  >
                    <td className="px-3 py-2 max-w-[420px]">
                      <div className={`font-medium ${it.status === "erledigt" ? "line-through text-muted-foreground" : ""}`}>
                        {it.title}
                      </div>
                      {it.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{it.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-sm ${meta.color} font-medium`}>
                        <TypIcon className="w-2.5 h-2.5" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className={`w-2 h-2 rounded-full ${prio.dot}`} /> {prio.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(it.created_at)}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(it.updated_at)}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-center text-xs">
                      {cnt > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/10 text-primary font-semibold">
                          {cnt}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail/Edit Modal */}
      {selected && (
        <FeedbackDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onChanged={async () => { await load(); }}
          onDeleted={async () => { setSelected(null); await load(); }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <FeedbackDetailModal
          item={null}
          onClose={() => setShowCreate(false)}
          onChanged={async () => { setShowCreate(false); await load(); }}
        />
      )}
    </div>
  );
};

export default ModuleFeedbackPage;
