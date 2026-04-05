import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, Filter, Edit, Trash2, X, Settings2, User, Wrench, Package, Calculator, Calendar, FileText, ChevronDown, ChevronUp, Mail, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api } from "@/lib/api";

const EinsaetzePage = () => {
  const [einsaetze, setEinsaetze] = useState([]);
  const [config, setConfig] = useState({ monteure: [], reparaturgruppen: [], materialien: [], anfrage_schritte: [] });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonteur, setFilterMonteur] = useState("");
  const [filterGruppe, setFilterGruppe] = useState("");
  const [filterSchritt, setFilterSchritt] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [eRes, cRes, custRes] = await Promise.all([
        api.get("/einsaetze"),
        api.get("/einsatz-config"),
        api.get("/customers")
      ]);
      setEinsaetze(eRes.data);
      setConfig(cRes.data);
      setCustomers(custRes.data);
    } catch (e) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let items = einsaetze;
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      items = items.filter(e =>
        (e.customer_name || "").toLowerCase().includes(t) ||
        (e.beschreibung || "").toLowerCase().includes(t) ||
        (e.reparaturgruppe || "").toLowerCase().includes(t)
      );
    }
    if (filterMonteur) {
      items = items.filter(e => e.monteur_1 === filterMonteur || e.monteur_2 === filterMonteur);
    }
    if (filterGruppe) {
      items = items.filter(e => e.reparaturgruppe === filterGruppe);
    }
    if (filterSchritt) {
      items = items.filter(e => e.status === filterSchritt);
    }
    return items;
  }, [einsaetze, searchTerm, filterMonteur, filterGruppe, filterSchritt]);

  // Berechne Anzahl pro Anfrage-Schritt
  const schrittCounts = useMemo(() => {
    const counts = {};
    for (const schritt of config.anfrage_schritte || []) {
      counts[schritt] = einsaetze.filter(e => e.status === schritt).length;
    }
    return counts;
  }, [einsaetze, config.anfrage_schritte]);

  const deleteEinsatz = async (id) => {
    if (!window.confirm("Einsatz wirklich löschen?")) return;
    try {
      await api.delete(`/einsaetze/${id}`);
      toast.success("Gelöscht");
      loadData();
    } catch (e) {
      toast.error("Fehler beim Löschen");
    }
  };

  const statusColors = {
    aktiv: "bg-green-100 text-green-700",
    inaktiv: "bg-gray-100 text-gray-600",
    abgeschlossen: "bg-blue-100 text-blue-700",
    wartend: "bg-amber-100 text-amber-700"
  };

  // Dynamische Farben für Anfrage-Schritte basierend auf Nummerierung
  const getSchrittColor = (schritt) => {
    if (!schritt) return "bg-gray-100 text-gray-600";
    if (statusColors[schritt]) return statusColors[schritt];
    const num = parseFloat(schritt);
    if (num < 2) return "bg-amber-100 text-amber-700";
    if (num < 3) return "bg-orange-100 text-orange-700";
    if (num < 5) return "bg-cyan-100 text-cyan-700";
    if (num < 6) return "bg-blue-100 text-blue-700";
    if (num < 6.05) return "bg-green-100 text-green-700";
    return "bg-emerald-100 text-emerald-700";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto" data-testid="einsaetze-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Einsatzplanung</h1>
          <p className="text-muted-foreground mt-1 text-sm">{einsaetze.length} Einsätze gesamt, {filtered.length} angezeigt</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-1 px-3 py-2 border rounded-sm text-sm hover:bg-muted"
            data-testid="btn-config"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Felder</span>
          </button>
          <button
            onClick={() => { setEditItem(null); setShowCreate(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium hover:bg-primary/90"
            data-testid="btn-new-einsatz"
          >
            <Plus className="w-4 h-4" />
            Neuer Einsatz
          </button>
        </div>
      </div>

      {/* Anfrage-Schritte Buttons */}
      {(config.anfrage_schritte || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="schritt-buttons">
          <button
            onClick={() => setFilterSchritt("")}
            className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${
              !filterSchritt ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"
            }`}
            data-testid="btn-schritt-alle"
          >
            Alle ({einsaetze.length})
          </button>
          {(config.anfrage_schritte || []).map(schritt => {
            const count = schrittCounts[schritt] || 0;
            if (count === 0) return null;
            return (
              <button
                key={schritt}
                onClick={() => setFilterSchritt(filterSchritt === schritt ? "" : schritt)}
                className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${
                  filterSchritt === schritt
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-input"
                }`}
                data-testid={`btn-schritt-${schritt}`}
              >
                {count} x {schritt}
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4" data-testid="einsatz-filters">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Suche nach Kunde, Beschreibung..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-sm text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="input-search"
          />
        </div>
        <select
          value={filterMonteur}
          onChange={(e) => setFilterMonteur(e.target.value)}
          className="border rounded-sm px-3 py-2 text-sm bg-background"
          data-testid="filter-monteur"
        >
          <option value="">Alle Monteure</option>
          {config.monteure.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filterGruppe}
          onChange={(e) => setFilterGruppe(e.target.value)}
          className="border rounded-sm px-3 py-2 text-sm bg-background"
          data-testid="filter-gruppe"
        >
          <option value="">Alle Gruppen</option>
          {config.reparaturgruppen.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {einsaetze.length === 0 ? "Noch keine Einsätze angelegt." : "Keine Einsätze für die gewählten Filter."}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <EinsatzCard
              key={e.id}
              einsatz={e}
              config={config}
              getSchrittColor={getSchrittColor}
              onEdit={() => { setEditItem(e); setShowCreate(true); }}
              onDelete={() => deleteEinsatz(e.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {showCreate && (
        <EinsatzDialog
          item={editItem}
          config={config}
          customers={customers}
          onClose={() => { setShowCreate(false); setEditItem(null); }}
          onSaved={() => { setShowCreate(false); setEditItem(null); loadData(); }}
        />
      )}

      {/* Config Dialog */}
      {showConfig && (
        <ConfigDialog
          config={config}
          onClose={() => setShowConfig(false)}
          onSaved={() => { setShowConfig(false); loadData(); }}
        />
      )}
    </div>
  );
};


const EinsatzCard = ({ einsatz, getSchrittColor, config, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const e = einsatz;

  const handleIcsDownload = async () => {
    try {
      const res = await api.get(`/einsaetze/${e.id}/ics`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/calendar" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `termin_${e.customer_name || "einsatz"}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Fehler beim Download"); }
  };

  return (
    <Card className="overflow-hidden" data-testid={`einsatz-card-${e.id}`}>
      <div
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold truncate">{e.customer_name || "Kein Kunde"}</h3>
              <Badge className={getSchrittColor(e.status)}>{e.status || "Neu"}</Badge>
              {(e.reparaturgruppen || (e.reparaturgruppe ? [e.reparaturgruppe] : [])).map((g) => (
                <Badge key={g} className="bg-slate-100 text-slate-600">{g}</Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground truncate">{e.beschreibung || "-"}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {e.monteur_1 && (
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{e.monteur_1}</span>
              )}
              {e.monteur_2 && (
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{e.monteur_2}</span>
              )}
              {e.summe_schaetzung > 0 && (
                <span className="flex items-center gap-1"><Calculator className="w-3 h-3" />{e.summe_schaetzung.toFixed(2)} €</span>
              )}
              {e.termin && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(e.termin).toLocaleDateString("de-DE")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-3">
            <button onClick={(ev) => { ev.stopPropagation(); onEdit(); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={(ev) => { ev.stopPropagation(); onDelete(); }} className="p-2 hover:bg-red-50 rounded-sm text-red-500" title="Löschen">
              <Trash2 className="w-4 h-4" />
            </button>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/20 pt-3">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Monteur 1:</span> {e.monteur_1 || "-"}</div>
            <div><span className="text-muted-foreground">Monteur 2:</span> {e.monteur_2 || "-"}</div>
            <div><span className="text-muted-foreground">Reparaturgruppen:</span> {(e.reparaturgruppen || (e.reparaturgruppe ? [e.reparaturgruppe] : [])).join(", ") || "-"}</div>
            <div><span className="text-muted-foreground">Schätzung:</span> {e.summe_schaetzung ? `${e.summe_schaetzung.toFixed(2)} €` : "-"}</div>
            <div><span className="text-muted-foreground">Material:</span> {(e.material || []).join(", ") || "-"}</div>
            <div><span className="text-muted-foreground">Termin:</span> {e.termin ? new Date(e.termin).toLocaleString("de-DE") : "-"}</div>
          </div>
          {e.beschreibung && (
            <div className="mt-3 p-3 bg-background rounded-sm text-sm whitespace-pre-wrap">{e.beschreibung}</div>
          )}
          {e.termin_text && (
            <div className="mt-2 p-3 bg-blue-50 rounded-sm text-sm">
              <span className="font-medium text-blue-700">Termintext:</span> {e.termin_text}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {e.termin && (
              <>
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Einsatz: ${e.customer_name || "Kunde"} - ${(e.reparaturgruppen || []).join(", ") || e.reparaturgruppe || ""}`)}&dates=${e.termin.replace(/[-:]/g, "").replace(/\.\d+/, "").replace("T", "T")}&details=${encodeURIComponent(e.beschreibung || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-xs hover:bg-muted"
                  data-testid="btn-google-cal"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Google Kalender
                </a>
                <button
                  onClick={handleIcsDownload}
                  className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-xs hover:bg-muted"
                  data-testid="btn-ics-download"
                >
                  <Download className="w-3.5 h-3.5" />
                  .ics Download
                </button>
              </>
            )}
            <button
              onClick={() => setShowEmail(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-xs hover:bg-primary/90"
              data-testid="btn-email-einsatz"
            >
              <Mail className="w-3.5 h-3.5" />
              Termin-E-Mail senden
            </button>
          </div>
        </div>
      )}
      {showEmail && (
        <EinsatzEmailDialog
          einsatz={e}
          config={config}
          onClose={() => setShowEmail(false)}
        />
      )}
    </Card>
  );
};


const EinsatzDialog = ({ item, config, customers, onClose, onSaved }) => {
  // Resolve customer_id: try by ID first, then by name match
  const resolveCustomerId = () => {
    if (item?.customer_id) {
      const match = customers.find(c => c.id === item.customer_id);
      if (match) return item.customer_id;
    }
    if (item?.customer_name) {
      const match = customers.find(c => c.name === item.customer_name);
      if (match) return match.id;
    }
    return "";
  };
  const [customerId, setCustomerId] = useState(resolveCustomerId());
  const [customerName, setCustomerName] = useState(item?.customer_name || "");
  const [monteur1, setMonteur1] = useState(item?.monteur_1 || "");
  const [monteur2, setMonteur2] = useState(item?.monteur_2 || "");
  const [gruppen, setGruppen] = useState(item?.reparaturgruppen || (item?.reparaturgruppe ? [item.reparaturgruppe] : []));
  const [material, setMaterial] = useState(item?.material || []);
  const [schaetzung, setSchaetzung] = useState(item?.summe_schaetzung || 0);
  const [status, setStatus] = useState(item?.status || "aktiv");
  const [beschreibung, setBeschreibung] = useState(item?.beschreibung || "");
  const [termin, setTermin] = useState(item?.termin ? item.termin.slice(0, 16) : "");
  const [terminText, setTerminText] = useState(item?.termin_text || "");
  const [saving, setSaving] = useState(false);

  const handleCustomerSelect = (e) => {
    const id = e.target.value;
    setCustomerId(id);
    const c = customers.find(c => c.id === id);
    if (c) setCustomerName(c.name || "");
  };

  const toggleMaterial = (m) => {
    setMaterial(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const toggleGruppe = (g) => {
    setGruppen(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = {
      customer_id: customerId,
      customer_name: customerName,
      monteur_1: monteur1,
      monteur_2: monteur2,
      reparaturgruppen: gruppen,
      material,
      summe_schaetzung: Number(schaetzung) || 0,
      status,
      beschreibung,
      termin,
      termin_text: terminText,
    };
    try {
      if (item) {
        await api.put(`/einsaetze/${item.id}`, data);
        toast.success("Einsatz aktualisiert");
      } else {
        await api.post("/einsaetze", data);
        toast.success("Einsatz erstellt");
      }
      onSaved();
    } catch (e) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" data-testid="einsatz-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{item ? "Einsatz bearbeiten" : "Neuer Einsatz"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Linke Spalte */}
            <div className="space-y-4">
              {/* Kunde */}
              <div>
                <label className="block text-sm font-medium mb-1">Kunde</label>
                <select value={customerId} onChange={handleCustomerSelect} className="w-full border rounded-sm p-2 text-sm" data-testid="select-customer">
                  <option value="">-- Kunde wählen --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Monteure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Monteur 1</label>
                  <select value={monteur1} onChange={(e) => setMonteur1(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="select-monteur1">
                    <option value="">-- wählen --</option>
                    {config.monteure.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monteur 2</label>
                  <select value={monteur2} onChange={(e) => setMonteur2(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="select-monteur2">
                    <option value="">-- wählen --</option>
                    {config.monteure.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Reparaturgruppen Multi-Select */}
              <div>
                <label className="block text-sm font-medium mb-1">Reparaturgruppen (max. 3)</label>
                <div className="flex flex-wrap gap-2" data-testid="select-gruppen">
                  {config.reparaturgruppen.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGruppe(g)}
                      disabled={!gruppen.includes(g) && gruppen.length >= 3}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        gruppen.includes(g)
                          ? "bg-orange-600 text-white border-orange-600"
                          : gruppen.length >= 3
                            ? "bg-muted text-muted-foreground/50 border-input cursor-not-allowed"
                            : "bg-background text-muted-foreground border-input hover:bg-orange-50 hover:border-orange-300"
                      }`}
                      data-testid={`chip-gruppe-${g}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {gruppen.length > 0 && (
                  <p className="text-xs text-orange-600 mt-1">{gruppen.length} ausgewählt</p>
                )}
              </div>

              {/* Material (Multi-Select Chips) */}
              <div>
                <label className="block text-sm font-medium mb-1">Material</label>
                <div className="flex flex-wrap gap-2">
                  {config.materialien.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMaterial(m)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        material.includes(m)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-input hover:bg-muted"
                      }`}
                      data-testid={`chip-material-${m}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schätzung + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Schätzung (€)</label>
                  <input
                    type="number"
                    value={schaetzung}
                    onChange={(e) => setSchaetzung(e.target.value)}
                    className="w-full border rounded-sm p-2 text-sm"
                    step="0.01"
                    data-testid="input-schaetzung"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Anfrage-Schritt</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="select-status">
                    <option value="">-- Schritt wählen --</option>
                    {config.anfrage_schritte?.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Rechte Spalte - Texte */}
            <div className="space-y-4">
              {/* Beschreibung */}
              <div>
                <label className="block text-sm font-medium mb-1">Beschreibung</label>
                <textarea
                  value={beschreibung}
                  onChange={(e) => setBeschreibung(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm min-h-[100px] resize-none"
                  placeholder="Beschreibung des Einsatzes..."
                  data-testid="input-beschreibung"
                />
              </div>

              {/* Termin */}
              <div>
                <label className="block text-sm font-medium mb-1">Termin</label>
                <input
                  type="datetime-local"
                  value={termin}
                  onChange={(e) => setTermin(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="input-termin"
                />
              </div>

              {/* Termintext */}
              <div>
                <label className="block text-sm font-medium mb-1">Termintext (für E-Mail/Kalender)</label>
                <textarea
                  value={terminText}
                  onChange={(e) => setTerminText(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm min-h-[120px] resize-none"
                  placeholder="z.B. Sehr geehrter Herr Müller, wir kommen am..."
                  data-testid="input-termintext"
                />
                {(config.termin_vorlagen || []).length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">Vorlage einfügen:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {config.termin_vorlagen.map((v, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const customerEntry = customers.find(c => c.id === customerId);
                            let text = v.text || "";
                            text = text
                              .replace(/\{kunde_name\}/g, customerEntry?.name || customerName || "")
                              .replace(/\{termin_datum\}/g, termin ? new Date(termin).toLocaleDateString("de-DE") : "")
                              .replace(/\{termin_zeit\}/g, termin ? new Date(termin).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "")
                              .replace(/\{reparaturgruppe\}/g, gruppen.join(", "))
                              .replace(/\{monteur\}/g, monteur1 || "")
                              .replace(/\{beschreibung\}/g, beschreibung || "")
                              .replace(/\{firma_name\}/g, "Tischlerei Graupner");
                            setTerminText(text);
                          }}
                          className="px-2 py-0.5 text-xs border rounded-sm hover:bg-primary/10 hover:border-primary transition-colors"
                        >
                          {v.name || `Vorlage ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-save-einsatz"
          >
            {saving ? "Speichere..." : item ? "Aktualisieren" : "Erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
};


const ConfigDialog = ({ config, onClose, onSaved }) => {
  const [monteure, setMonteure] = useState((config.monteure || []).join("\n"));
  const [gruppen, setGruppen] = useState((config.reparaturgruppen || []).join("\n"));
  const [materialien, setMaterialien] = useState((config.materialien || []).join("\n"));
  const [schritte, setSchritte] = useState((config.anfrage_schritte || []).join("\n"));
  const [vorlagen, setVorlagen] = useState(config.termin_vorlagen || []);
  const [saving, setSaving] = useState(false);
  const [showVorlagen, setShowVorlagen] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/einsatz-config", {
        monteure: monteure.split("\n").map(s => s.trim()).filter(Boolean),
        reparaturgruppen: gruppen.split("\n").map(s => s.trim()).filter(Boolean),
        materialien: materialien.split("\n").map(s => s.trim()).filter(Boolean),
        anfrage_schritte: schritte.split("\n").map(s => s.trim()).filter(Boolean),
        termin_vorlagen: vorlagen,
      });
      toast.success("Auswahlfelder gespeichert");
      onSaved();
    } catch (e) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const addVorlage = () => {
    setVorlagen([...vorlagen, { name: "", betreff: "", text: "" }]);
  };

  const updateVorlage = (idx, field, value) => {
    setVorlagen(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const removeVorlage = (idx) => {
    setVorlagen(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" data-testid="config-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Auswahlfelder konfigurieren</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Tab toggle */}
          <div className="flex gap-2 border-b pb-2">
            <button onClick={() => setShowVorlagen(false)} className={`px-3 py-1.5 text-sm font-medium rounded-sm ${!showVorlagen ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              Auswahlfelder
            </button>
            <button onClick={() => setShowVorlagen(true)} className={`px-3 py-1.5 text-sm font-medium rounded-sm ${showVorlagen ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              E-Mail-Vorlagen
            </button>
          </div>

          {!showVorlagen ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <FileText className="w-4 h-4" /> Anfrage-Schritte (ein Schritt pro Zeile)
                </label>
                <textarea
                  value={schritte}
                  onChange={(e) => setSchritte(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm min-h-[140px] resize-none font-mono"
                  placeholder={"1) Besichtig. Terminieren\n1) Bild+Bes.Term. fordern\n1.2) Abgelehnt/Ausgelastet\n2.05) Geschätzt p. Mail\n5.00) Angebot schreiben\n6.00) Auftragsbestätigung schreiben\n6.02) Auftrag ausführen\n6.03) Auftrag in Ausführung\n6.06) Rechnung schreiben"}
                  data-testid="config-schritte"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <User className="w-4 h-4" /> Monteure (ein Name pro Zeile)
                </label>
                <textarea
                  value={monteure}
                  onChange={(e) => setMonteure(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-none font-mono"
                  placeholder={"Ralph Graupner\nMax Mustermann"}
                  data-testid="config-monteure"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Wrench className="w-4 h-4" /> Reparaturgruppen (eine pro Zeile)
                </label>
                <textarea
                  value={gruppen}
                  onChange={(e) => setGruppen(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-none font-mono"
                  placeholder={"Fenster\nTüren\nDach"}
                  data-testid="config-gruppen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Package className="w-4 h-4" /> Materialien (eins pro Zeile)
                </label>
                <textarea
                  value={materialien}
                  onChange={(e) => setMaterialien(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-none font-mono"
                  placeholder={"Holz\nGlas\nDichtung"}
                  data-testid="config-materialien"
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Platzhalter: {"{kunde_name}"}, {"{termin_datum}"}, {"{termin_zeit}"}, {"{reparaturgruppe}"}, {"{monteur}"}, {"{beschreibung}"}, {"{firma_name}"}
              </p>
              {vorlagen.map((v, idx) => (
                <div key={idx} className="border rounded-sm p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <input
                      value={v.name}
                      onChange={(e) => updateVorlage(idx, "name", e.target.value)}
                      className="flex-1 border rounded-sm p-1.5 text-sm"
                      placeholder="Vorlagen-Name"
                    />
                    <button onClick={() => removeVorlage(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-sm">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    value={v.betreff}
                    onChange={(e) => updateVorlage(idx, "betreff", e.target.value)}
                    className="w-full border rounded-sm p-1.5 text-sm"
                    placeholder="Betreff z.B. Terminbestätigung - {reparaturgruppe}"
                  />
                  <textarea
                    value={v.text}
                    onChange={(e) => updateVorlage(idx, "text", e.target.value)}
                    className="w-full border rounded-sm p-1.5 text-sm min-h-[80px] resize-none"
                    placeholder={"Sehr geehrte/r {kunde_name},\n\nhiermit bestätigen wir Ihren Termin am {termin_datum} um {termin_zeit} Uhr.\n\nMit freundlichen Grüßen\n{firma_name}"}
                  />
                </div>
              ))}
              <button onClick={addVorlage} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Plus className="w-3.5 h-3.5" /> Neue Vorlage
              </button>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-save-config"
          >
            {saving ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
};


// ==================== EINSATZ E-MAIL DIALOG ====================
const EinsatzEmailDialog = ({ einsatz, config, onClose }) => {
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [vorlagen, setVorlagen] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    api.get("/email/vorlagen").then(res => setVorlagen(res.data)).catch(() => {});
  }, []);

  // Try to find customer email
  useEffect(() => {
    const loadCustomerEmail = async () => {
      if (einsatz.customer_id) {
        try {
          const res = await api.get(`/customers/${einsatz.customer_id}`);
          if (res.data.email) setToEmail(res.data.email);
        } catch {}
      }
    };
    loadCustomerEmail();
  }, [einsatz.customer_id]);

  const filtered = vorlagen.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.betreff.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const replacePlaceholders = (text) => {
    const terminDate = einsatz.termin ? new Date(einsatz.termin).toLocaleDateString("de-DE") : "";
    const terminTime = einsatz.termin ? new Date(einsatz.termin).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
    return text
      .replace(/\{kunde_name\}/g, einsatz.customer_name || "")
      .replace(/\{termin_datum\}/g, terminDate)
      .replace(/\{termin_zeit\}/g, terminTime)
      .replace(/\{reparaturgruppe\}/g, (einsatz.reparaturgruppen || []).join(", ") || einsatz.reparaturgruppe || "")
      .replace(/\{monteur\}/g, einsatz.monteur_1 || "")
      .replace(/\{beschreibung\}/g, einsatz.beschreibung || "")
      .replace(/\{email\}/g, toEmail || "")
      .replace(/\{firma_name\}/g, "Tischlerei Graupner");
  };

  const applyVorlage = (vorlage) => {
    setSubject(replacePlaceholders(vorlage.betreff));
    setMessage(replacePlaceholders(vorlage.text));
    setSearchTerm(vorlage.name);
    setShowResults(false);
  };

  const handleSend = async () => {
    if (!toEmail || !message) { toast.error("E-Mail und Nachricht erforderlich"); return; }
    setSending(true);
    try {
      await api.post(`/einsaetze/${einsatz.id}/email`, { to_email: toEmail, subject, message });
      toast.success(`E-Mail an ${toEmail} gesendet`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Senden");
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="email-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Mail className="w-5 h-5" /> E-Mail an {einsatz.customer_name || "Kunde"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Vorlage + An */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Vorlage wählen</label>
              <input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                className="w-full border rounded-sm p-2 text-sm pr-8"
                placeholder="Vorlage suchen... z.B. Bilder"
                data-testid="email-vorlage-search"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute right-2.5 top-[34px]" />
              {showResults && (
                <div className="absolute z-10 mt-1 w-full bg-background border rounded-sm shadow-lg max-h-48 overflow-y-auto" data-testid="email-vorlage-results">
                  {filtered.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Keine Vorlagen gefunden</p>
                  ) : (
                    filtered.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => applyVorlage(v)}
                        className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                        data-testid={`vorlage-option-${v.id}`}
                      >
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{v.betreff}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">An</label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                placeholder="kunde@email.de"
                data-testid="email-to"
              />
            </div>
          </div>

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium mb-1">Betreff</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="Betreff..."
              data-testid="email-subject"
            />
          </div>

          {/* Nachricht */}
          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[250px] resize-y"
              placeholder="Nachricht..."
              data-testid="email-message"
            />
          </div>

          {einsatz.termin && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Termin-Datei (.ics) wird automatisch als Anhang beigefügt.
            </p>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={handleSend}
            disabled={sending || !toEmail || !message}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-send-email"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sende..." : "E-Mail senden"}
          </button>
        </div>
      </div>
    </div>
  );
};


export { EinsaetzePage };
