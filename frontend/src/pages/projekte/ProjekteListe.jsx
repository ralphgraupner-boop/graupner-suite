import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Folder, Plus, Search, RefreshCw, ImageIcon, ChevronRight, User as UserIcon, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge, Modal, Input, Textarea } from "@/components/common";
import { api } from "@/lib/api";

const STATUSES = ["Anfrage", "In Bearbeitung", "Abgeschlossen", "Archiv"];
const KATEGORIEN = ["Innentür", "Fenster", "Haustür", "Schiebetür", "Sonstiges"];

const STATUS_COLORS = {
  "Anfrage": "bg-blue-100 text-blue-700 border-blue-300",
  "In Bearbeitung": "bg-amber-100 text-amber-800 border-amber-300",
  "Abgeschlossen": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Archiv": "bg-gray-100 text-gray-600 border-gray-300",
};

const ProjekteListe = () => {
  const [projekte, setProjekte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("aktiv");
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const presetKundeId = new URLSearchParams(location.search).get("kunde_id") || "";

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/module-projekte/");
      setProjekte(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Wenn ?kunde_id=… in URL: automatisch Neu-Dialog öffnen + Liste auf diesen Kunden filtern
  useEffect(() => {
    if (presetKundeId) {
      setShowNew(true);
    }
  }, [presetKundeId]);

  const filtered = projekte.filter(p => {
    // Wenn presetKundeId in URL: zeige nur Projekte dieses Kunden
    if (presetKundeId && p.kunde_id !== presetKundeId) return false;
    if (statusFilter === "aktiv" && p.status === "Archiv") return false;
    if (statusFilter !== "aktiv" && statusFilter !== "" && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (p.titel || "").toLowerCase().includes(s)
          || (p.kunde_name || "").toLowerCase().includes(s)
          || (p.beschreibung || "").toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div data-testid="projekte-liste-page" className="pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Folder className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Projekte</h1>
            <Badge className="bg-amber-100 text-amber-700 border-amber-300">NEU</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            {loading ? "Lade…" : `${filtered.length} Projekt${filtered.length === 1 ? "" : "e"} sichtbar · ${projekte.length} gesamt`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="btn-refresh-projekte">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-projekt">
            <Plus className="w-4 h-4" /> Neues Projekt
          </Button>
        </div>
      </div>

      <Card className="p-3 lg:p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 lg:h-10" placeholder="Projekte oder Kunden suchen…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-projekte" />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterButton active={statusFilter === "aktiv"} onClick={() => setStatusFilter("aktiv")}>Aktive</FilterButton>
        {STATUSES.map(s => (
          <FilterButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</FilterButton>
        ))}
        <FilterButton active={statusFilter === ""} onClick={() => setStatusFilter("")}>Alle</FilterButton>
      </div>

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
          {filtered.map(p => (
            <Card
              key={p.id}
              onClick={() => navigate(`/module/projekte/werkbank/${p.kunde_id}`)}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              data-testid={`projekt-row-${p.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{p.titel}</h3>
                    <Badge className={`text-xs border ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge>
                    {p.kategorie && <Badge variant="outline" className="text-xs">{p.kategorie}</Badge>}
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
                    <p className="text-sm text-slate-700 mt-2 line-clamp-2">{p.beschreibung}</p>
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
          presetKundeId={presetKundeId}
          onClose={() => setShowNew(false)}
          onCreated={(p) => { setShowNew(false); navigate(`/module/projekte/${p.id}`); }}
        />
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
