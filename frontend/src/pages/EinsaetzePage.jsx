import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, Filter, Edit, Trash2, X, Settings2, User, Wrench, Package, Calculator, Calendar, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api } from "@/lib/api";

const EinsaetzePage = () => {
  const [einsaetze, setEinsaetze] = useState([]);
  const [config, setConfig] = useState({ monteure: [], reparaturgruppen: [], materialien: [] });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonteur, setFilterMonteur] = useState("");
  const [filterGruppe, setFilterGruppe] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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
    if (filterStatus) {
      items = items.filter(e => e.status === filterStatus);
    }
    return items;
  }, [einsaetze, searchTerm, filterMonteur, filterGruppe, filterStatus]);

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
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-sm px-3 py-2 text-sm bg-background"
          data-testid="filter-status"
        >
          <option value="">Alle Status</option>
          <option value="aktiv">Aktiv</option>
          <option value="wartend">Wartend</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="inaktiv">Inaktiv</option>
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
              statusColors={statusColors}
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


const EinsatzCard = ({ einsatz, statusColors, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const e = einsatz;

  return (
    <Card className="overflow-hidden" data-testid={`einsatz-card-${e.id}`}>
      <div
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{e.customer_name || "Kein Kunde"}</h3>
              <Badge className={statusColors[e.status] || "bg-gray-100"}>{e.status}</Badge>
              {e.reparaturgruppe && (
                <Badge className="bg-slate-100 text-slate-600">{e.reparaturgruppe}</Badge>
              )}
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
            <div><span className="text-muted-foreground">Reparaturgruppe:</span> {e.reparaturgruppe || "-"}</div>
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
          <div className="mt-3 flex gap-2">
            {e.termin && (
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Einsatz: ${e.customer_name || "Kunde"} - ${e.reparaturgruppe || ""}`)}&dates=${e.termin.replace(/[-:]/g, "").replace(/\.\d+/, "").replace("T", "T")}&details=${encodeURIComponent(e.beschreibung || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-xs hover:bg-muted"
                data-testid="btn-google-cal"
              >
                <Calendar className="w-3.5 h-3.5" />
                Google Kalender
              </a>
            )}
            {e.customer_name && (
              <a
                href={`mailto:?subject=${encodeURIComponent(`Termin: ${e.reparaturgruppe || "Einsatz"} - ${e.customer_name}`)}&body=${encodeURIComponent(e.termin_text || e.beschreibung || "")}`}
                className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-xs hover:bg-muted"
                data-testid="btn-mail"
              >
                <FileText className="w-3.5 h-3.5" />
                E-Mail öffnen
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};


const EinsatzDialog = ({ item, config, customers, onClose, onSaved }) => {
  const [customerId, setCustomerId] = useState(item?.customer_id || "");
  const [customerName, setCustomerName] = useState(item?.customer_name || "");
  const [monteur1, setMonteur1] = useState(item?.monteur_1 || "");
  const [monteur2, setMonteur2] = useState(item?.monteur_2 || "");
  const [gruppe, setGruppe] = useState(item?.reparaturgruppe || "");
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

  const handleSave = async () => {
    setSaving(true);
    const data = {
      customer_id: customerId,
      customer_name: customerName,
      monteur_1: monteur1,
      monteur_2: monteur2,
      reparaturgruppe: gruppe,
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
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{item ? "Einsatz bearbeiten" : "Neuer Einsatz"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
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

          {/* Reparaturgruppe */}
          <div>
            <label className="block text-sm font-medium mb-1">Reparaturgruppe</label>
            <select value={gruppe} onChange={(e) => setGruppe(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="select-gruppe">
              <option value="">-- wählen --</option>
              {config.reparaturgruppen.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
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
              {config.materialien.length === 0 && (
                <span className="text-xs text-muted-foreground">Keine Materialien konfiguriert</span>
              )}
            </div>
          </div>

          {/* Schätzung + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Summen-Schätzung (€)</label>
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
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="select-status">
                <option value="aktiv">Aktiv</option>
                <option value="wartend">Wartend</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="inaktiv">Inaktiv</option>
              </select>
            </div>
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-none"
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
              className="w-full border rounded-sm p-2 text-sm min-h-[60px] resize-none"
              placeholder="z.B. Sehr geehrter Herr Müller, wir kommen am..."
              data-testid="input-termintext"
            />
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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/einsatz-config", {
        monteure: monteure.split("\n").map(s => s.trim()).filter(Boolean),
        reparaturgruppen: gruppen.split("\n").map(s => s.trim()).filter(Boolean),
        materialien: materialien.split("\n").map(s => s.trim()).filter(Boolean),
      });
      toast.success("Auswahlfelder gespeichert");
      onSaved();
    } catch (e) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="config-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Auswahlfelder konfigurieren</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1">
              <User className="w-4 h-4" /> Monteure (ein Name pro Zeile)
            </label>
            <textarea
              value={monteure}
              onChange={(e) => setMonteure(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-none font-mono"
              placeholder={"Ralph Graupner\nMax Mustermann\nPeter Schmidt"}
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
              placeholder={"Fenster\nTüren\nDach\nBoden\nFassade"}
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
              placeholder={"Holz\nGlas\nDichtung\nBeschläge\nFarbe"}
              data-testid="config-materialien"
            />
          </div>
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


export { EinsaetzePage };
