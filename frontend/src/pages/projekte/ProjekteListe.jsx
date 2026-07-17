import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Folder, Plus, Search, RefreshCw, ImageIcon, ChevronRight, User as UserIcon, Calendar, MapPin, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge, Input, Textarea, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { useF1Help } from "@/lib/useF1Help";
import { openInPopup, useBroadcast } from "@/lib/windowSync";
import PortalStatusBadge from "@/components/module_portal_wizard/PortalStatusBadge";

const STATUSES = ["Anfrage", "In Bearbeitung", "Abgeschlossen", "Archiv"];
const KATEGORIEN = ["Innentür", "Fenster", "Haustür", "Schiebetür", "Sonstiges"];
const ARCHIV_STATES = ["Abgeschlossen", "Archiv"];
const STATUSES_ANZEIGE = STATUSES.filter(s => !ARCHIV_STATES.includes(s));

const STATUS_COLORS = {
  "Anfrage": "bg-blue-100 text-blue-700 border-blue-300",
  "In Bearbeitung": "bg-amber-100 text-amber-800 border-amber-300",
  "Abgeschlossen": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Archiv": "bg-gray-100 text-gray-600 border-gray-300",
};

const ProjekteListe = () => {
  useF1Help("hilfe_projekte");
  const [projekte, setProjekte] = useState([]);
  const [kundenMap, setKundenMap] = useState({});
  const [portalStatuses, setPortalStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("aktiv");
  const [kategorieFilter, setKategorieFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  // Such-zuerst-Schema (Ralph 12.05.2026): erst Kunde oder Projekt wählen
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKunde, setSelectedKunde] = useState(null); // {id, label}
  const [kundeOhneProjekt, setKundeOhneProjekt] = useState(null); // {id, label} – Dialog: Kunde ohne Projekt angeklickt
  const [searchFocused, setSearchFocused] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [sortMode, setSortMode] = useState("manuell");
  const navigate = useNavigate();
  const location = useLocation();

  const presetKundeId = new URLSearchParams(location.search).get("kunde_id") || "";

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, kRes] = await Promise.all([
        api.get("/module-projekte/"),
        api.get("/modules/kunden/data"),
      ]);
      setProjekte(pRes.data);
      const km = {};
      (kRes.data || []).forEach(k => { km[k.id] = { vorname: k.vorname, nachname: k.nachname, firma: k.firma, anliegen: k.anliegen || "", nachricht: k.nachricht || "", phone: k.phone || "", mobile: k.mobile || "", strasse: k.strasse || "", hausnummer: k.hausnummer || "", plz: k.plz || "", ort: k.ort || "" }; });
      setKundenMap(km);
      api.get("/kundenportal/status-alle").then(r => setPortalStatuses(r.data?.statuses || {})).catch(() => {});
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useBroadcast("projekte-changed", () => { load(); });

  // ?kunde_id=… → vorbelegen
  useEffect(() => {
    if (presetKundeId && kundenMap[presetKundeId] && !selectedKunde) {
      const k = kundenMap[presetKundeId];
      const label = k.firma || [k.vorname, k.nachname].filter(Boolean).join(" ") || presetKundeId;
      setSelectedKunde({ id: presetKundeId, label });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKundeId, kundenMap]);

  const kundeLabel = (id) => {
    const k = kundenMap[id];
    if (!k) return null;
    return k.firma || [k.vorname, k.nachname].filter(Boolean).join(" ") || null;
  };

  // Such-Treffer: Kunden + Projekte
  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return { kunden: [], projekte: [] };
    const kunden = Object.entries(kundenMap)
      .map(([id, k]) => {
        const label = k.firma || [k.vorname, k.nachname].filter(Boolean).join(" ") || id;
        const anliegen = k.anliegen || "";
        const nachricht = k.nachricht || "";
        const phone = (k.phone || "").replace(/\s|\/|-/g, "");
        const mobile = (k.mobile || "").replace(/\s|\/|-/g, "");
        const qPhone = q.replace(/\s|\/|-/g, "");
        const adresse = [k.strasse, k.hausnummer, k.plz, k.ort].filter(Boolean).join(" ").toLowerCase();
        let matchedIn = null;
        if (label.toLowerCase().includes(q)) matchedIn = "Name";
        else if (anliegen.toLowerCase().includes(q)) matchedIn = "Anliegen";
        else if (nachricht.toLowerCase().includes(q)) matchedIn = "Nachricht";
        else if (qPhone.length >= 5 && (phone.includes(qPhone) || mobile.includes(qPhone))) matchedIn = "Telefon";
        else if (adresse.includes(q)) matchedIn = "Adresse";
        return { id, label, matchedIn };
      })
      .filter(k => k.matchedIn)
      .slice(0, 8);
    const projekteHits = projekte
      .map(p => {
        const titel = p.titel || "";
        const beschreibung = p.beschreibung || "";
        const notizen = p.notizen || "";
        const kLabel = kundeLabel(p.kunde_id) || "";
        let matchedIn = null;
        if (titel.toLowerCase().includes(q)) matchedIn = "Titel";
        else if (kLabel.toLowerCase().includes(q)) matchedIn = "Kunde";
        else if (beschreibung.toLowerCase().includes(q)) matchedIn = "Beschreibung";
        else if (notizen.toLowerCase().includes(q)) matchedIn = "Notizen";
        return { p, matchedIn, kLabel };
      })
      .filter(x => x.matchedIn)
      .slice(0, 8)
      .map(x => ({ id: x.p.id, titel: x.p.titel || "(ohne Titel)", kunde_id: x.p.kunde_id, kundeLabel: x.kLabel, matchedIn: x.matchedIn }));
    return { kunden, projekte: projekteHits };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, kundenMap, projekte]);

  const kategorien = Array.from(new Set(projekte.map(p => p.kategorie).filter(Boolean))).sort();

  const filtered = projekte.filter(p => {
    if (selectedKunde && p.kunde_id !== selectedKunde.id) return false;
    if (statusFilter === "aktiv" && ARCHIV_STATES.includes(p.status)) return false;
    if (statusFilter === "abgeschlossen" && !ARCHIV_STATES.includes(p.status)) return false;
    if (statusFilter !== "aktiv" && statusFilter !== "abgeschlossen" && statusFilter !== "" && p.status !== statusFilter) return false;
    if (kategorieFilter && p.kategorie !== kategorieFilter) return false;
    return true;
  });

  const sortedFiltered = sortMode === "manuell" ? filtered : [...filtered].sort((a, b) => (b[sortMode] || "").localeCompare(a[sortMode] || ""));

  const handleRowDrop = async (dropIdx) => {
    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null); setDragOverIndex(null);
      return;
    }
    const reordered = [...filtered];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIdx, 0, moved);

    // Optimistisch: nur die sichtbar gefilterten Projekte umsortieren, Rest bleibt
    const reorderedIds = reordered.map(p => p.id);
    const others = projekte.filter(p => !reorderedIds.includes(p.id));
    setProjekte([...reordered, ...others]);
    setDragIndex(null); setDragOverIndex(null);

    try {
      await api.patch("/module-projekte/reorder", { ids: reorderedIds });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Sortierung speichern fehlgeschlagen");
      load();
    }
  };

  return (
    <div data-testid="projekte-liste-page" className="pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Folder className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Projekte</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            {loading ? "Lade…" : selectedKunde ? `${filtered.length} Projekt${filtered.length === 1 ? "" : "e"} für ${selectedKunde.label}` : `${filtered.length} von ${projekte.length} Projekten · sortiert nach Datum`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="btn-refresh-projekte">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
          </Button>
        </div>
      </div>

      {/* Such-zuerst-Schema: Kunde oder Projekt wählen */}
      <Card className="p-3 lg:p-4 mb-4" data-testid="projekte-search-section">
        {selectedKunde ? (
          <div className="flex items-center gap-2" data-testid="selected-kunde">
            <UserIcon className="w-4 h-4 text-blue-700" />
            <span className="text-sm font-medium">Kunde: {selectedKunde.label}</span>
            <button
              onClick={() => setSelectedKunde(null)}
              className="ml-auto p-1 hover:bg-muted rounded-sm"
              title="Auswahl entfernen"
              data-testid="btn-clear-kunde"
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
                placeholder="Kunde oder Projekt suchen, um Projekte anzuzeigen oder anzulegen …"
                className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
                data-testid="projekte-search-input"
              />
            </div>
            {searchFocused && searchQuery.trim() && (searchHits.kunden.length > 0 || searchHits.projekte.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 max-h-80 overflow-auto" data-testid="projekte-search-results">
                {searchHits.kunden.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">Kunden ({searchHits.kunden.length})</div>
                    {searchHits.kunden.map(k => (
                      <button
                        key={`k-${k.id}`}
                        onClick={() => {
                          setSearchQuery("");
                          // Hat der Kunde bereits ein Projekt? -> direkt zur Werkbank.
                          // Sonst Dialog: Projekt anlegen (Werkbank) oder zur Kundenakte.
                          if (projekte.some(p => p.kunde_id === k.id)) {
                            setSelectedKunde({ id: k.id, label: k.label });
                            navigate(`/module/projekte/werkbank/${k.id}`);
                          } else {
                            setKundeOhneProjekt({ id: k.id, label: k.label });
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0"
                        data-testid={`projekte-hit-kunde-${k.id}`}
                      >
                        <UserIcon className="w-4 h-4 text-blue-700 flex-shrink-0" />
                        <span>{k.label}</span>
                        {k.matchedIn && k.matchedIn !== "Name" && (
                          <span className="ml-auto text-xs text-muted-foreground italic">gefunden in: {k.matchedIn}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {searchHits.projekte.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">Projekte ({searchHits.projekte.length})</div>
                    {searchHits.projekte.map(p => (
                      <button
                        key={`p-${p.id}`}
                        onClick={() => navigate(`/module/projekte/werkbank/${p.kunde_id}`)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0"
                        data-testid={`projekte-hit-projekt-${p.id}`}
                      >
                        <Folder className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        <span>{p.titel}</span>
                        {p.kundeLabel && <span className="text-xs text-muted-foreground">({p.kundeLabel})</span>}
                        {p.matchedIn && p.matchedIn !== "Titel" && (
                          <span className="ml-auto text-xs text-muted-foreground italic">gefunden in: {p.matchedIn}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {searchFocused && searchQuery.trim() && searchHits.kunden.length === 0 && searchHits.projekte.length === 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 p-3 text-sm text-muted-foreground" data-testid="projekte-search-empty">
                Keine Treffer für „{searchQuery}".
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex gap-2 mb-4">
        <Button variant={sortMode === "manuell" ? "default" : "outline"} size="sm" onClick={() => setSortMode("manuell")}>Manuell (Ziehen)</Button>
        <Button variant="outline" size="sm" className={sortMode === "created_at" ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white font-bold" : ""} onClick={() => setSortMode("created_at")}>Anlegedatum</Button>
        <Button variant="outline" size="sm" className={sortMode === "updated_at" ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white font-bold" : ""} onClick={() => setSortMode("updated_at")}>Zuletzt bearbeitet</Button>
        {selectedKunde && (
          <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700 font-bold" onClick={() => {
            const url = `/popup/projekt/new?kunde_id=${selectedKunde.id}`;
            if (!openInPopup(url)) setShowNew(true);
          }} data-testid="btn-new-projekt">
            <Plus className="w-4 h-4" /> Neu erstellen
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterButton active={statusFilter === "aktiv"} onClick={() => setStatusFilter("aktiv")}>Aktive ({projekte.filter(p => !ARCHIV_STATES.includes(p.status)).length})</FilterButton>
        {STATUSES_ANZEIGE.map(s => (
          <FilterButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s} ({projekte.filter(p => p.status === s).length})</FilterButton>
        ))}
        <FilterButton active={statusFilter === "abgeschlossen"} onClick={() => setStatusFilter("abgeschlossen")}>Abgeschlossen ({projekte.filter(p => ARCHIV_STATES.includes(p.status)).length})</FilterButton>
        <FilterButton active={statusFilter === ""} onClick={() => setStatusFilter("")}>Alle ({projekte.length})</FilterButton>
      </div>

      {kategorien.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="projekt-kategorie-filter">
          <FilterButton active={kategorieFilter === ""} onClick={() => setKategorieFilter("")}>Alle Kategorien</FilterButton>
          {kategorien.map(k => (
            <FilterButton key={k} active={kategorieFilter === k} onClick={() => setKategorieFilter(k)}>{k} ({projekte.filter(p => {
            if (p.kategorie !== k) return false;
            if (statusFilter === "aktiv") return !ARCHIV_STATES.includes(p.status);
            if (statusFilter === "abgeschlossen") return ARCHIV_STATES.includes(p.status);
            if (statusFilter === "") return true;
            return p.status === statusFilter;
          }).length})</FilterButton>
          ))}
        </div>
      )}

      {loading ? (
        <Card className="p-6 text-center text-muted-foreground">Lade…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state-projekte">
          <Folder className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-lg font-semibold">Keine Projekte vorhanden</div>
          <div className="text-sm text-muted-foreground mt-1">
            Lege ein neues Projekt für einen Kunden an.
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sortedFiltered.map((p, idx) => (
            <Card
              key={p.id}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={() => handleRowDrop(idx)}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
              onClick={() => navigate(`/module/projekte/werkbank/${p.kunde_id}`)}
              className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${dragOverIndex === idx ? "border-primary/50 bg-primary/5" : ""} ${dragIndex === idx ? "opacity-40" : ""}`}
              data-testid={`projekt-row-${p.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                  {sortMode === "manuell" && (
                <div
                    className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
                    title="Zum Sortieren ziehen"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`drag-handle-${p.id}`}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{p.titel}</h3>
                    <Badge className={`text-xs border ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge>
                    {p.kategorie && <Badge variant="outline" className="text-xs">{p.kategorie}</Badge>}
                    <PortalStatusBadge status={portalStatuses[p.kunde_id] || null} showLabel={false} />
                    {p.bilder?.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <ImageIcon className="w-3 h-3" /> {p.bilder.length}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> {p.kunde_name}</span>
                    {p.adresse && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {p.adresse}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {(p.created_at || "").slice(0, 10)}</span>
                  </div>
                  {p.beschreibung && (
                    <p className="text-sm text-foreground mt-2 line-clamp-2">{p.beschreibung}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <NewProjektDialog
          presetKundeId={selectedKunde?.id || presetKundeId}
          onClose={() => setShowNew(false)}
          onCreated={(p) => { setShowNew(false); navigate(`/module/projekte/${p.id}`); }}
        />
      )}

      {kundeOhneProjekt && (
        <Modal isOpen={true} onClose={() => setKundeOhneProjekt(null)} title="Kein Projekt vorhanden" size="sm">
          <div className="space-y-5" data-testid="kunde-ohne-projekt-dialog">
            <p className="text-sm">
              Kunde <strong>{kundeOhneProjekt.label}</strong> hat noch kein Projekt. Möchten Sie ein Projekt anlegen?
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { const id = kundeOhneProjekt.id; setKundeOhneProjekt(null); navigate(`/module/kunden?edit=${id}`); }}
                data-testid="btn-kunde-ohne-projekt-nein"
              >
                Nein, zur Kundenakte
              </Button>
              <Button
                onClick={() => { const { id, label } = kundeOhneProjekt; setKundeOhneProjekt(null); setSelectedKunde({ id, label }); navigate(`/module/projekte/werkbank/${id}`); }}
                data-testid="btn-kunde-ohne-projekt-ja"
              >
                Ja, Projekt anlegen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const FilterButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
  >
    {children}
  </button>
);

// ==================== Neu-Dialog ====================
const NewProjektDialog = ({ onClose, onCreated, presetKundeId }) => {
  const [kunden, setKunden] = useState([]);
  const [kundeId, setKundeId] = useState(presetKundeId);
  const [kundeQuery, setKundeQuery] = useState("");
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [kategorie, setKategorie] = useState("Sonstiges");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // {kunde_name, photos_count, nachricht, kategorien}
  const [bilderUebernehmen, setBilderUebernehmen] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/modules/kunden/data");
        setKunden(res.data || []);
      } catch (err) {
        toast.error("Kundenliste konnte nicht geladen werden");
      }
    })();
  }, []);

  // Wenn Kunde gewählt: Vorschau aus Anfrage holen
  useEffect(() => {
    if (!kundeId) { setPreview(null); return; }
    (async () => {
      try {
        const res = await api.get(`/module-projekte/from-kunde/${kundeId}/preview`);
        setPreview(res.data);
      } catch (err) {
        setPreview(null);
      }
    })();
  }, [kundeId]);

  const filteredKunden = (kundeQuery
    ? kunden.filter(k => {
        const name = (k.name || `${k.vorname || ""} ${k.nachname || ""}`).toLowerCase();
        return name.includes(kundeQuery.toLowerCase()) || (k.email || "").toLowerCase().includes(kundeQuery.toLowerCase());
      })
    : kunden
  ).slice(0, 12);

  const selectedKunde = kunden.find(k => k.id === kundeId);
  const hasAnfrageDaten = preview && (preview.nachricht || preview.photos_count > 0 || preview.kategorien?.length);

  const submit = async () => {
    if (!kundeId) return toast.error("Bitte einen Kunden auswählen");
    if (!titel.trim()) return toast.error("Bitte einen Titel angeben");
    setSaving(true);
    try {
      const res = await api.post("/module-projekte/", {
        kunde_id: kundeId,
        titel: titel.trim(),
        beschreibung,
        kategorie,
      });
      toast.success("Projekt angelegt");
      onCreated(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitFromKunde = async () => {
    if (!kundeId) return toast.error("Bitte einen Kunden auswählen");
    setSaving(true);
    try {
      const res = await api.post(`/module-projekte/from-kunde/${kundeId}`, {
        titel: titel.trim() || null,
        bilder_uebernehmen: bilderUebernehmen,
      });
      toast.success(`Projekt aus Anfrage erstellt${res.data.bilder?.length ? ` (${res.data.bilder.length} Bilder übernommen)` : ""}`);
      onCreated(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Neues Projekt anlegen" size="lg">
      <div className="p-4 space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Kunde *</label>
          {selectedKunde ? (
            <div className="flex items-center gap-2 p-2 border rounded bg-emerald-50" data-testid="selected-kunde">
              <UserIcon className="w-4 h-4 text-emerald-600" />
              <span className="flex-1 text-sm">{selectedKunde.name || `${selectedKunde.vorname || ""} ${selectedKunde.nachname || ""}`.trim()}</span>
              <button onClick={() => { setKundeId(""); setKundeQuery(""); setPreview(null); }} className="text-xs text-primary hover:underline">Ändern</button>
            </div>
          ) : (
            <>
              <Input value={kundeQuery} onChange={(e) => setKundeQuery(e.target.value)} placeholder="Name oder E-Mail eingeben…" data-testid="input-kunde-search" />
              {filteredKunden.length > 0 && (
                <div className="mt-1 border rounded max-h-52 overflow-y-auto">
                  {filteredKunden.map(k => (
                    <button
                      key={k.id}
                      onClick={() => { setKundeId(k.id); setKundeQuery(""); }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                      data-testid={`kunde-option-${k.id}`}
                    >
                      <div className="font-medium">{k.name || `${k.vorname || ""} ${k.nachname || ""}`.trim()}</div>
                      {k.email && <div className="text-xs text-muted-foreground">{k.email}</div>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Anfrage-Vorschau, falls Kunde Anfrage-Daten hat */}
        {selectedKunde && hasAnfrageDaten && (
          <div className="p-3 border-2 border-emerald-300 bg-emerald-50 rounded space-y-2" data-testid="anfrage-preview">
            <div className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
              ✨ Daten aus Kundenanfrage übernehmen
            </div>
            <div className="text-xs text-emerald-800 space-y-1">
              {preview.adresse && <div>📍 {preview.adresse}</div>}
              {preview.kategorien?.length > 0 && <div>🏷️ Kategorien: {preview.kategorien.join(", ")}</div>}
              {preview.nachricht && <div>💬 Nachricht: <span className="italic">"{preview.nachricht.slice(0, 120)}{preview.nachricht.length > 120 ? "…" : ""}"</span></div>}
              {preview.photos_count > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span>📷 <strong>{preview.photos_count} Bild(er)</strong> aus dem Kontaktformular</span>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={bilderUebernehmen} onChange={(e) => setBilderUebernehmen(e.target.checked)} data-testid="checkbox-bilder-uebernehmen" />
                    übernehmen
                  </label>
                </div>
              )}
            </div>
            <Button size="sm" onClick={submitFromKunde} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="btn-from-kunde">
              {saving ? "Erstelle…" : "→ Projekt aus dieser Anfrage erstellen"}
            </Button>
            <div className="text-xs text-emerald-700 text-center">— oder unten manuell ausfüllen —</div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium block mb-1">Titel *</label>
          <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z.B. Innentür Wohnzimmer reparieren" data-testid="input-projekt-titel" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Kategorie</label>
          <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid="select-projekt-kategorie">
            {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Beschreibung</label>
          <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={3} placeholder="Was ist zu tun?" data-testid="input-projekt-beschreibung" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving} data-testid="btn-submit-projekt">{saving ? "Speichern…" : "Leeres Projekt anlegen"}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProjekteListe;
export { ProjekteListe };
