import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Download, Package, Wrench, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";

const TYPE_CONFIG = {
  Artikel: { label: "Artikel", color: "bg-blue-100 text-blue-800", icon: Package },
  Leistung: { label: "Leistung", color: "bg-green-100 text-green-800", icon: Wrench },
  Fremdleistung: { label: "Fremdleistung", color: "bg-orange-100 text-orange-800", icon: Users },
};

const ArtikelModulPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTyp, setActiveTyp] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const res = await api.get("/modules/artikel/data");
      setItems(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/modules/artikel/data/${id}`);
      toast.success("Geloescht");
      setConfirmDeleteId(null);
      loadItems();
    } catch { toast.error("Fehler"); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/modules/artikel/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artikel_leistungen_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportiert");
    } catch { toast.error("Fehler"); }
  };

  const filtered = items
    .filter(i => !activeTyp || i.typ === activeTyp)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.description || "").toLowerCase().includes(search.toLowerCase()) || (i.artikel_nr || "").toLowerCase().includes(search.toLowerCase()));

  const counts = { Artikel: 0, Leistung: 0, Fremdleistung: 0 };
  items.forEach(i => { if (counts[i.typ] !== undefined) counts[i.typ]++; });

  return (
    <div data-testid="artikel-modul-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Artikel & Leistungen</h1>
            <Badge variant="default" className="text-xs">Solo</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{items.length} Eintraege gesamt</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="btn-export-artikel">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button size="sm" className="lg:h-10 lg:px-4" onClick={() => { setEditItem(null); setShowModal(true); }} data-testid="btn-new-artikel">
            <Plus className="w-4 h-4" /> Neu
          </Button>
        </div>
      </div>

      {/* Typ Filter */}
      <div className="flex flex-wrap gap-2 mb-4" data-testid="artikel-typ-filter">
        <button onClick={() => setActiveTyp("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!activeTyp ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          Alle ({items.length})
        </button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button key={key} onClick={() => setActiveTyp(activeTyp === key ? "" : key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${activeTyp === key ? cfg.color + " shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              <Icon className="w-3.5 h-3.5" /> {cfg.label} ({counts[key] || 0})
            </button>
          );
        })}
      </div>

      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 lg:h-10" placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-artikel" />
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{search || activeTyp ? "Keine Ergebnisse" : "Erstellen Sie Artikel, Leistungen oder Fremdleistungen"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cfg = TYPE_CONFIG[item.typ] || TYPE_CONFIG.Artikel;
            const Icon = cfg.icon;
            return (
              <Card key={item.id} className="overflow-hidden" data-testid={`artikel-${item.id}`}>
                <div className="flex items-center gap-4 p-3 lg:p-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.artikel_nr && <span className="text-xs font-mono text-muted-foreground">{item.artikel_nr}</span>}
                      <span className="font-semibold truncate">{item.name}</span>
                      <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    {item.description && <p className="text-sm text-muted-foreground truncate mt-0.5">{item.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground text-sm">{item.unit}</span>
                    <div className="text-right">
                      <span className="font-mono font-semibold">{(item.price_net || 0).toFixed(2)} EUR</span>
                      {item.ek_preis > 0 && <p className="text-xs text-muted-foreground">EK: {item.ek_preis.toFixed(2)} EUR</p>}
                    </div>
                    <button onClick={() => { setEditItem(item); setShowModal(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)}
                      className={`p-2 rounded-sm transition-colors ${confirmDeleteId === item.id ? "bg-red-500 text-white" : "hover:bg-destructive/10"}`}>
                      {confirmDeleteId === item.id ? <span className="text-xs font-bold">?</span> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ArtikelFormModal isOpen={showModal} onClose={() => setShowModal(false)} item={editItem} onSave={() => { setShowModal(false); loadItems(); }} />
    </div>
  );
};


// ==================== FORM MODAL ====================
const ArtikelFormModal = ({ isOpen, onClose, item, onSave }) => {
  const [form, setForm] = useState({ name: "", description: "", typ: "Artikel", unit: "Stueck", ek_preis: 0, price_net: 0, subunternehmer: "", artikel_nr: "" });
  const [loading, setLoading] = useState(false);
  const [kalkEk, setKalkEk] = useState(0);
  const [kalkAufschlag, setKalkAufschlag] = useState(0);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "", description: item.description || "", typ: item.typ || "Artikel",
        unit: item.unit || "Stueck", ek_preis: item.ek_preis || 0, price_net: item.price_net || 0,
        subunternehmer: item.subunternehmer || "", artikel_nr: item.artikel_nr || "",
      });
      setKalkEk(item.ek_preis || 0);
      setKalkAufschlag(item.ek_preis > 0 ? Math.round((item.price_net / item.ek_preis - 1) * 100) : 0);
    } else {
      setForm({ name: "", description: "", typ: "Artikel", unit: "Stueck", ek_preis: 0, price_net: 0, subunternehmer: "", artikel_nr: "" });
      setKalkEk(0);
      setKalkAufschlag(0);
    }
  }, [item]);

  const recalc = (ek, aufschlag) => {
    const vk = ek * (1 + aufschlag / 100);
    setForm(f => ({ ...f, price_net: Math.round(vk * 100) / 100, ek_preis: ek }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error("Bezeichnung erforderlich"); return; }
    setLoading(true);
    try {
      if (item) {
        await api.put(`/modules/artikel/data/${item.id}`, form);
        toast.success("Aktualisiert");
      } else {
        await api.post("/modules/artikel/data", form);
        toast.success("Erstellt");
      }
      onSave();
    } catch { toast.error("Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? "Bearbeiten" : "Neu erstellen"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="artikel-form-modal">
        {/* Typ */}
        <div>
          <label className="block text-sm font-medium mb-2">Typ</label>
          <div className="flex gap-2">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key} type="button"
                  onClick={() => setForm({ ...form, typ: key, unit: key !== "Artikel" ? "Stunde" : form.unit })}
                  className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all flex items-center gap-1 ${form.typ === key ? cfg.color + " shadow-sm ring-2 ring-offset-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  <Icon className="w-3.5 h-3.5" /> {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Artikel-Nr.</label>
            <Input value={form.artikel_nr} onChange={(e) => setForm({ ...form, artikel_nr: e.target.value })} placeholder="z.B. ART-001" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Einheit</label>
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
              {["Stueck", "Stunde", "m", "m2", "m3", "kg", "Psch.", "km", "Liter", "Set"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bezeichnung *</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="input-artikel-name" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Beschreibung</label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>

        {/* Kalkulation */}
        <div className="border rounded-sm p-3 bg-muted/20">
          <label className="block text-sm font-semibold mb-2">Preiskalkulation</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">EK-Preis (Netto)</label>
              <Input type="number" step="0.01" value={kalkEk}
                onChange={(e) => { const v = parseFloat(e.target.value) || 0; setKalkEk(v); recalc(v, kalkAufschlag); }} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Aufschlag %</label>
              <Input type="number" value={kalkAufschlag}
                onChange={(e) => { const v = parseFloat(e.target.value) || 0; setKalkAufschlag(v); recalc(kalkEk, v); }} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">VK-Preis (Netto)</label>
              <Input type="number" step="0.01" value={form.price_net}
                onChange={(e) => setForm({ ...form, price_net: parseFloat(e.target.value) || 0 })} data-testid="input-artikel-price" />
            </div>
          </div>
        </div>

        {/* Subunternehmer (nur bei Fremdleistung) */}
        {form.typ === "Fremdleistung" && (
          <div>
            <label className="block text-sm font-medium mb-2">Subunternehmer</label>
            <Input value={form.subunternehmer} onChange={(e) => setForm({ ...form, subunternehmer: e.target.value })} placeholder="Firmenname" />
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" disabled={loading} data-testid="btn-save-artikel">
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export { ArtikelModulPage };
