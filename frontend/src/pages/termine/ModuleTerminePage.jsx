import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { TerminSendDialog } from "@/components/TerminSendDialog";
import { VorlagenPicker } from "@/components/VorlagenPicker";
import TitleInputWithVorlagen from "@/components/TitleInputWithVorlagen";
import {
  Calendar, Plus, Trash2, X, MapPin, User as UserIcon, Folder, Briefcase, HardHat,
  CheckCircle2, Clock, RefreshCw, Filter, AlertTriangle, ChevronRight, XCircle, Search,
  GripVertical,
} from "lucide-react";

const STATUS_LABEL = {
  wartet_auf_go: "Wartet auf GO",
  bestaetigt: "Bestätigt (bereit für Kalender)",
  im_kalender: "Im Kalender",
  abgesagt: "Abgesagt",
};

const STATUS_STYLES = {
  wartet_auf_go: { cls: "bg-amber-50 text-amber-800 border-amber-200", icon: AlertTriangle },
  bestaetigt: { cls: "bg-blue-50 text-blue-800 border-blue-200", icon: Clock },
  im_kalender: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  abgesagt: { cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

const TYP_LABEL = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
  abnahme: "Abnahme",
  intern: "Intern",
  sonstiges: "Sonstiges",
};

const fmtDate = (s) => {
  if (!s) return "";
  try { return new Date(s).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return s; }
};

export default function ModuleTerminePage() {
  const [termine, setTermine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [enriched, setEnriched] = useState(null);
  const [sendingTermin, setSendingTermin] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Stammdaten für Auswahl
  const [kunden, setKunden] = useState([]);
  const [projekte, setProjekte] = useState([]);
  const [aufgaben, setAufgaben] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  // Such-zuerst-Schema (Ralph 12.05.2026)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, k, p, a, m] = await Promise.all([
        api.get("/module-termine", { params: { status: filterStatus } }),
        kunden.length ? Promise.resolve({ data: kunden }) : api.get("/modules/kunden/data").catch(() => ({ data: [] })),
        projekte.length ? Promise.resolve({ data: projekte }) : api.get("/module-projekte").catch(() => ({ data: [] })),
        aufgaben.length ? Promise.resolve({ data: aufgaben }) : api.get("/module-aufgaben").catch(() => ({ data: [] })),
        mitarbeiter.length ? Promise.resolve({ data: mitarbeiter }) : api.get("/module-aufgaben/mitarbeiter").catch(() => ({ data: [] })),
      ]);
      setTermine(Array.isArray(list.data) ? list.data : []);
      if (!kunden.length) setKunden(Array.isArray(k.data) ? k.data : []);
      if (!projekte.length) setProjekte(Array.isArray(p.data) ? p.data : []);
      if (!aufgaben.length) setAufgaben(Array.isArray(a.data) ? a.data : []);
      if (!mitarbeiter.length) setMitarbeiter(Array.isArray(m.data) ? m.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Termine konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus]); // eslint-disable-line

  const stats = useMemo(() => {
    const s = { wartet_auf_go: 0, bestaetigt: 0, im_kalender: 0, abgesagt: 0 };
    termine.forEach(t => { if (s[t.status] !== undefined) s[t.status] += 1; });
    return s;
  }, [termine]);

  // Helper: Kunden-Label und Such-Treffer
  const kundeLabelOf = (k) => k?.firma || [k?.vorname, k?.nachname].filter(Boolean).join(" ") || k?.name || k?.id || "";
  const kundeLabelById = (id) => {
    const k = kunden.find(x => x.id === id);
    return k ? kundeLabelOf(k) : null;
  };

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return { kunden: [], projekte: [] };
    const ks = kunden
      .map(k => ({ id: k.id, label: kundeLabelOf(k) }))
      .filter(k => k.label.toLowerCase().includes(q))
      .slice(0, 8);
    const ps = projekte
      .map(p => ({ id: p.id, titel: p.titel || "(ohne Titel)", kunde_id: p.kunde_id, kundeLabel: kundeLabelById(p.kunde_id) }))
      .filter(p => p.titel.toLowerCase().includes(q) || (p.kundeLabel || "").toLowerCase().includes(q))
      .slice(0, 8);
    return { kunden: ks, projekte: ps };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, kunden, projekte]);

  const filteredTermine = useMemo(() => {
    if (!selectedTarget) return termine;
    if (selectedTarget.type === "kunde") {
      const projektIdsOfKunde = projekte.filter(p => p.kunde_id === selectedTarget.id).map(p => p.id);
      return termine.filter(t =>
        t.kunde_id === selectedTarget.id || (t.projekt_id && projektIdsOfKunde.includes(t.projekt_id))
      );
    }
    if (selectedTarget.type === "projekt") {
      return termine.filter(t => t.projekt_id === selectedTarget.id);
    }
    return termine;
  }, [termine, selectedTarget, projekte]);

  const onGo = async (t) => {
    if (!window.confirm(
      `"${t.titel}" am ${fmtDate(t.start)} bestätigen?\n\n` +
      `Status wechselt von "Wartet auf GO" → "Bestätigt".\n` +
      `Im Anschluss kannst du wählen, an wen die ICS-Mail geschickt wird.`
    )) return;
    try {
      await api.patch(`/module-termine/${t.id}/go`);
      toast.success("Termin bestätigt – jetzt Empfänger wählen");
      setSendingTermin(t);  // Empfänger-Dialog öffnen
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "GO fehlgeschlagen");
    }
  };

  const onCancel = async (t) => {
    const grund = window.prompt(`Grund für die Absage von "${t.titel}"?`, "");
    if (grund === null) return;
    try {
      await api.patch(`/module-termine/${t.id}/cancel`, { status: "abgesagt", grund });
      toast.success("Termin abgesagt");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Absage fehlgeschlagen");
    }
  };

  const onDelete = async (t) => {
    if (!window.confirm(`Termin "${t.titel}" endgültig löschen?`)) return;
    try {
      await api.delete(`/module-termine/${t.id}`);
      toast.success("Termin gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  const handleRowDrop = async (dropIdx) => {
    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null); setDragOverIndex(null);
      return;
    }
    const reordered = [...filteredTermine];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIdx, 0, moved);

    // Optimistisch lokale Reihenfolge in `termine` übernehmen (nur die gefilterten Termine umsortieren)
    const reorderedIds = reordered.map(t => t.id);
    const otherTermine = termine.filter(t => !reorderedIds.includes(t.id));
    setTermine([...reordered, ...otherTermine]);
    setDragIndex(null); setDragOverIndex(null);

    try {
      await api.patch("/module-termine/reorder", { ids: reorderedIds });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Sortierung speichern fehlgeschlagen");
      load();
    }
  };

  const openEnriched = async (t) => {
    try {
      const res = await api.get(`/module-termine/${t.id}/enrich`);
      setEnriched(res.data);
    } catch (err) {
      toast.error("Datenmaske konnte nicht geladen werden");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6" data-testid="module-termine-page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Termine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Termine mit GO-Workflow. Datenmaske: Termin verknüpft Kunde + Projekt + Aufgabe + Monteur (per ID).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-muted rounded-sm border" title="Neu laden" data-testid="btn-termine-reload">
            <RefreshCw className="w-4 h-4" />
          </button>
          {selectedTarget && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
              data-testid="btn-termin-create"
            >
              <Plus className="w-4 h-4" /> Neuer Termin
            </button>
          )}
        </div>
      </div>

      {/* Suchzeile: Kunde oder Projekt wählen */}
      <div className="mb-4" data-testid="termine-search-section">
        {selectedTarget ? (
          <div className="flex items-center gap-2 p-3 bg-muted/40 border rounded-md" data-testid="termine-selected-target">
            {selectedTarget.type === "kunde" ? <UserIcon className="w-4 h-4 text-blue-700" /> : <Folder className="w-4 h-4 text-emerald-700" />}
            <span className="text-sm font-medium">
              {selectedTarget.type === "kunde" ? "Kunde: " : "Projekt: "}{selectedTarget.label}
            </span>
            <button onClick={() => { setSelectedTarget(null); setSearchQuery(""); }} className="ml-auto p-1 hover:bg-background rounded-sm" title="Auswahl entfernen" data-testid="btn-termine-clear-target">
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
                placeholder="Kunde oder Projekt suchen, um Termine anzuzeigen oder anzulegen …"
                className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
                data-testid="termine-search-input"
              />
            </div>
            {searchFocused && searchQuery.trim() && (searchHits.kunden.length > 0 || searchHits.projekte.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 max-h-80 overflow-auto" data-testid="termine-search-results">
                {searchHits.kunden.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">Kunden ({searchHits.kunden.length})</div>
                    {searchHits.kunden.map(k => (
                      <button key={`k-${k.id}`} onClick={() => { setSelectedTarget({ type: "kunde", id: k.id, label: k.label }); setSearchQuery(""); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0" data-testid={`termine-hit-kunde-${k.id}`}>
                        <UserIcon className="w-4 h-4 text-blue-700 flex-shrink-0" />
                        <span>{k.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchHits.projekte.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">Projekte ({searchHits.projekte.length})</div>
                    {searchHits.projekte.map(p => (
                      <button key={`p-${p.id}`} onClick={() => { setSelectedTarget({ type: "projekt", id: p.id, label: p.titel, kunde_id: p.kunde_id }); setSearchQuery(""); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0" data-testid={`termine-hit-projekt-${p.id}`}>
                        <Folder className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        <span>{p.titel}</span>
                        {p.kundeLabel && <span className="text-xs text-muted-foreground ml-auto">({p.kundeLabel})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {searchFocused && searchQuery.trim() && searchHits.kunden.length === 0 && searchHits.projekte.length === 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 p-3 text-sm text-muted-foreground" data-testid="termine-search-empty">
                Keine Treffer für „{searchQuery}".
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.keys(STATUS_STYLES).map(key => {
          const Icon = STATUS_STYLES[key].icon;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={`border rounded-md p-3 text-left transition-colors ${
                filterStatus === key
                  ? STATUS_STYLES[key].cls + " ring-2 ring-offset-1 ring-current"
                  : "bg-background hover:bg-muted/50"
              }`}
              data-testid={`stat-${key}`}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="w-3.5 h-3.5" /> {STATUS_LABEL[key]}
              </div>
              <div className="text-2xl font-bold mt-1">{stats[key]}</div>
            </button>
          );
        })}
      </div>

      {filterStatus && (
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" /> Filter: {STATUS_LABEL[filterStatus]}
          <button onClick={() => setFilterStatus("")} className="text-primary hover:underline">zurücksetzen</button>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Termine…</div>
      ) : filteredTermine.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-md text-muted-foreground" data-testid="empty-state">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{selectedTarget ? `Keine Termine für ${selectedTarget.type === "kunde" ? "diesen Kunden" : "dieses Projekt"}${filterStatus ? " in diesem Status" : ""}.` : "Keine Termine vorhanden."}</p>
          {selectedTarget && <p className="text-xs mt-1">Klicke oben rechts auf „+ Neuer Termin".</p>}
        </div>
      ) : (
        <div className="space-y-2" data-testid="termine-list">
          {filteredTermine.map((t, idx) => {
            const styles = STATUS_STYLES[t.status] || STATUS_STYLES.wartet_auf_go;
            const Icon = styles.icon;
            const kundeName = kunden.find(k => k.id === t.kunde_id);
            const projektTitel = projekte.find(p => p.id === t.projekt_id)?.titel;
            return (
              <div
                key={t.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={() => handleRowDrop(idx)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                className={`border rounded-md p-3 bg-background hover:shadow-sm transition-shadow ${dragOverIndex === idx ? "border-primary/50 bg-primary/5" : ""} ${dragIndex === idx ? "opacity-40" : ""}`}
                data-testid={`termin-${t.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0" title="Zum Sortieren ziehen" data-testid={`drag-handle-${t.id}`}>
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className={`p-2 rounded-sm border flex-shrink-0 ${styles.cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{t.titel}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-sm border ${styles.cls}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">{TYP_LABEL[t.typ] || t.typ}</span>
                    </div>
                    {t.beschreibung?.trim() && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`termin-beschreibung-${t.id}`}>
                        {t.beschreibung}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(t.start)}</span>
                      {t.ende && <span>– {fmtDate(t.ende)}</span>}
                      {t.ort && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {t.ort}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {kundeName && (
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          {`${kundeName.vorname || ""} ${kundeName.nachname || ""}`.trim() || kundeName.name || "—"}
                        </span>
                      )}
                      {projektTitel && (
                        <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> {projektTitel}</span>
                      )}
                      {t.monteur_username && (
                        <span className="flex items-center gap-1"><HardHat className="w-3 h-3" /> {t.monteur_username}</span>
                      )}
                    </div>
                    {t.status === "abgesagt" && t.abgesagt_grund && (
                      <p className="text-xs text-red-600 mt-1">Grund: {t.abgesagt_grund}</p>
                    )}
                    {t.status === "im_kalender" && t.google_event_id && (
                      <p className="text-xs text-emerald-600 mt-1">📅 Google Event ID: {t.google_event_id}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {t.status === "wartet_auf_go" && (
                      <button
                        onClick={() => onGo(t)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-sm text-xs font-bold hover:bg-emerald-700"
                        data-testid={`btn-go-${t.id}`}
                      >
                        ✓ GO
                      </button>
                    )}
                    {(t.status === "bestaetigt" || t.status === "im_kalender") && (
                      <button
                        onClick={() => setSendingTermin(t)}
                        className="px-3 py-1.5 border border-blue-300 text-blue-700 rounded-sm text-xs hover:bg-blue-50 flex items-center justify-center gap-1"
                        data-testid={`btn-send-${t.id}`}
                      >
                        📧 ICS senden
                      </button>
                    )}
                    {t.status === "abgesagt" && (
                      <button
                        onClick={() => onGo(t)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-sm text-xs hover:bg-emerald-700"
                      >
                        Reaktivieren
                      </button>
                    )}
                    <button
                      onClick={() => openEnriched(t)}
                      className="text-xs px-2 py-1 border rounded-sm hover:bg-muted flex items-center gap-1"
                      data-testid={`btn-enrich-${t.id}`}
                    >
                      Datenmaske <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditing(t)}
                      className="text-xs px-2 py-1 border rounded-sm hover:bg-muted"
                      data-testid={`btn-edit-${t.id}`}
                    >
                      Bearbeiten
                    </button>
                    {t.status !== "abgesagt" && (
                      <button onClick={() => onCancel(t)} className="text-xs px-2 py-1 border border-red-200 text-red-700 rounded-sm hover:bg-red-50">
                        Absagen
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(t)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-sm border border-transparent hover:border-red-200"
                      title="Löschen"
                      data-testid={`btn-delete-${t.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showCreate || editing) && (
        <TerminDialog
          termin={editing}
          kunden={kunden}
          projekte={projekte}
          aufgaben={aufgaben}
          mitarbeiter={mitarbeiter}
          selectedTarget={selectedTarget}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}

      {enriched && <EnrichedView data={enriched} onClose={() => setEnriched(null)} />}

      {sendingTermin && (
        <TerminSendDialog
          termin_id={sendingTermin.id}
          onClose={() => setSendingTermin(null)}
          onSent={() => { setSendingTermin(null); load(); }}
        />
      )}
    </div>
  );
}

const TerminDialog = ({ termin, kunden, projekte, aufgaben, mitarbeiter, selectedTarget, onClose, onSaved }) => {
  const isEdit = !!termin;
  const initialKunde = isEdit
    ? (termin?.kunde_id || "")
    : (selectedTarget?.type === "kunde" ? selectedTarget.id : (selectedTarget?.type === "projekt" ? (selectedTarget.kunde_id || "") : ""));
  const initialProjekt = isEdit
    ? (termin?.projekt_id || "")
    : (selectedTarget?.type === "projekt" ? selectedTarget.id : "");
  const [data, setData] = useState({
    titel: termin?.titel || "",
    typ: termin?.typ || "ausfuehrung",
    start: termin?.start || "",
    ende: termin?.ende || "",
    ort: termin?.ort || "",
    beschreibung: termin?.beschreibung || "",
    kunde_id: initialKunde,
    projekt_id: initialProjekt,
    aufgabe_id: termin?.aufgabe_id || "",
    monteur_username: termin?.monteur_username || "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setData(d => ({ ...d, [k]: v }));

  // Filter Projekte nach gewähltem Kunden
  const projekteFiltered = data.kunde_id
    ? projekte.filter(p => p.kunde_id === data.kunde_id)
    : projekte;

  const save = async () => {
    if (!data.titel.trim()) { toast.error("Titel erforderlich"); return; }
    if (!data.start.trim()) { toast.error("Startzeit erforderlich"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/module-termine/${termin.id}`, data);
        toast.success("Termin aktualisiert");
      } else {
        await api.post("/module-termine", data);
        toast.success("Termin angelegt – wartet auf GO");
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="termin-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? "Termin bearbeiten" : "Neuer Termin"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <TitleInputWithVorlagen
            value={data.titel}
            onChange={(v) => upd("titel", v)}
            docType="termin_titel"
            fallbackDocTypes={["termin"]}
            label="Titel"
            required
            autoFocus
            placeholder="z.B. Besichtigung Familie Müller"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Typ</label>
              <select
                value={data.typ}
                onChange={(e) => upd("typ", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="select-typ"
              >
                {Object.keys(TYP_LABEL).map(t => <option key={t} value={t}>{TYP_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ort / Adresse</label>
              <input
                value={data.ort}
                onChange={(e) => upd("ort", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                placeholder="Optional"
                data-testid="input-ort"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start *</label>
              <input
                type="datetime-local"
                value={data.start}
                onChange={(e) => upd("start", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="input-start"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ende</label>
              <input
                type="datetime-local"
                value={data.ende}
                onChange={(e) => upd("ende", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="input-ende"
              />
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Datenmaske-Verknüpfung</strong> – Termin referenziert per ID (Daten bleiben in den jeweiligen Modulen):
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5" /> Kunde
                </label>
                <select
                  value={data.kunde_id}
                  onChange={(e) => upd("kunde_id", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="select-kunde"
                >
                  <option value="">— kein Kunde —</option>
                  {kunden.map(k => {
                    const name = `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.name || "Unbenannt";
                    return <option key={k.id} value={k.id}>{name}{k.firma ? ` (${k.firma})` : ""}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5" /> Projekt
                </label>
                <select
                  value={data.projekt_id}
                  onChange={(e) => upd("projekt_id", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="select-projekt"
                  disabled={!projekteFiltered.length}
                >
                  <option value="">— kein Projekt —</option>
                  {projekteFiltered.map(p => <option key={p.id} value={p.id}>{p.titel}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> Interne Aufgabe
                </label>
                <select
                  value={data.aufgabe_id}
                  onChange={(e) => upd("aufgabe_id", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="select-aufgabe"
                >
                  <option value="">— keine Aufgabe —</option>
                  {aufgaben.map(a => <option key={a.id} value={a.id}>{a.titel}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <HardHat className="w-3.5 h-3.5" /> Monteur
                </label>
                <select
                  value={data.monteur_username}
                  onChange={(e) => upd("monteur_username", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="select-monteur"
                >
                  <option value="">— niemand —</option>
                  {mitarbeiter.map(m => <option key={m.username} value={m.username}>{m.anzeige_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung / Arbeitsanweisung</label>
            <textarea
              value={data.beschreibung}
              onChange={(e) => upd("beschreibung", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[70px]"
              placeholder="Optional"
              data-testid="input-beschreibung"
            />
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-termin-save"
          >
            {saving ? "Speichere…" : isEdit ? "Speichern" : "Anlegen (wartet auf GO)"}
          </button>
        </div>
      </div>
    </div>
  );
};

const EnrichedView = ({ data, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="enriched-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Datenmaske: {data.titel}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <Block title="Termin (module_termine)" icon={Calendar}>
            <Field label="Titel" value={data.titel} />
            <Field label="Typ" value={TYP_LABEL[data.typ] || data.typ} />
            <Field label="Start" value={fmtDate(data.start)} />
            <Field label="Ende" value={fmtDate(data.ende) || "—"} />
            <Field label="Ort" value={data.ort || "—"} />
            <Field label="Status" value={STATUS_LABEL[data.status]} />
          </Block>

          <Block title="Kunde (module_kunden)" icon={UserIcon}>
            {data.kunde_detail ? (
              <>
                <Field label="Name" value={`${data.kunde_detail.vorname || ""} ${data.kunde_detail.nachname || ""}`.trim() || data.kunde_detail.name} />
                <Field label="Firma" value={data.kunde_detail.firma || "—"} />
                <Field label="E-Mail" value={data.kunde_detail.email || "—"} />
                <Field label="Telefon" value={data.kunde_detail.phone || "—"} />
                <Field
                  label="Adresse"
                  value={
                    [data.kunde_detail.strasse, data.kunde_detail.hausnummer, data.kunde_detail.plz, data.kunde_detail.ort]
                      .filter(Boolean)
                      .join(" ") || "—"
                  }
                />
              </>
            ) : (
              <p className="text-muted-foreground italic">— Kein Kunde verknüpft —</p>
            )}
          </Block>

          <Block title="Projekt (module_projekte)" icon={Folder}>
            {data.projekt_detail ? (
              <>
                <Field label="Titel" value={data.projekt_detail.titel} />
                <Field label="Kategorie" value={data.projekt_detail.kategorie || "—"} />
                <Field label="Projekt-Status" value={data.projekt_detail.status || "—"} />
              </>
            ) : (
              <p className="text-muted-foreground italic">— Kein Projekt verknüpft —</p>
            )}
          </Block>

          <Block title="Aufgabe (module_aufgaben)" icon={Briefcase}>
            {data.aufgabe_detail ? (
              <>
                <Field label="Titel" value={data.aufgabe_detail.titel} />
                <Field label="Kategorie" value={data.aufgabe_detail.kategorie} />
                <Field label="Priorität" value={data.aufgabe_detail.prioritaet} />
                <Field label="Status" value={data.aufgabe_detail.status} />
              </>
            ) : (
              <p className="text-muted-foreground italic">— Keine interne Aufgabe verknüpft —</p>
            )}
          </Block>

          <Block title="Monteur" icon={HardHat}>
            {data.monteur_detail ? (
              <>
                <Field label="Name" value={data.monteur_detail.anzeige_name} />
                <Field label="Login" value={data.monteur_detail.username} />
                <Field label="Rolle" value={data.monteur_detail.role} />
              </>
            ) : (
              <p className="text-muted-foreground italic">— Niemand zugewiesen —</p>
            )}
          </Block>
        </div>
      </div>
    </div>
  );
};

const Block = ({ title, icon: Icon, children }) => (
  <div className="border rounded-md p-3 bg-muted/20">
    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" /> {title}
    </h4>
    <div className="space-y-1">{children}</div>
  </div>
);

const Field = ({ label, value }) => (
  <div className="flex items-baseline gap-2 text-sm">
    <span className="text-muted-foreground w-24 flex-shrink-0">{label}:</span>
    <span className="font-medium">{value || "—"}</span>
  </div>
);
