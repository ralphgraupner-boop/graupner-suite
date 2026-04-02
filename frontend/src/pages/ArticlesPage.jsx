import { useState, useEffect } from "react";
import { Package, Plus, Trash2, Edit, Search, Wrench, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";

const TYPE_CONFIG = {
  Artikel: { label: "Artikel", color: "bg-blue-100 text-blue-800", icon: Package },
  Leistung: { label: "Leistung", color: "bg-green-100 text-green-800", icon: Wrench },
  Fremdleistung: { label: "Fremdleistung", color: "bg-orange-100 text-orange-800", icon: Users },
};

const ArtikelPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [activeTyp, setActiveTyp] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const res = await api.get("/articles");
      setItems(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      await api.delete(`/articles/${id}`);
      toast.success("Gelöscht");
      setConfirmDeleteId(null);
      loadItems();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const filtered = items
    .filter((i) => !activeTyp || i.typ === activeTyp)
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.description || "").toLowerCase().includes(search.toLowerCase()));

  const counts = { Artikel: 0, Leistung: 0, Fremdleistung: 0 };
  items.forEach((i) => { if (counts[i.typ] !== undefined) counts[i.typ]++; });

  return (
    <div data-testid="artikel-page">
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Artikel & Leistungen</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{items.length} Einträge gesamt</p>
        </div>
        <Button data-testid="btn-new-artikel" onClick={() => { setEditItem(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 lg:w-5 lg:h-5" /> Neu
        </Button>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 mb-4" data-testid="artikel-type-filter">
        <button onClick={() => setActiveTyp("")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!activeTyp ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          Alle ({items.length})
        </button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setActiveTyp(key)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${activeTyp === key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`} data-testid={`filter-${key.toLowerCase()}`}>
            {cfg.label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Search */}
      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 lg:h-10" placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-artikel" />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Einträge</h3>
          <p className="text-muted-foreground mt-2 text-sm">{search || activeTyp ? "Keine Ergebnisse für diesen Filter" : "Erstellen Sie Artikel, Leistungen oder Fremdleistungen"}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const cfg = TYPE_CONFIG[item.typ] || TYPE_CONFIG.Artikel;
            return (
              <Card key={item.id} className="p-4 lg:p-5 hover:shadow-md transition-shadow" data-testid={`artikel-card-${item.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
                    {item.subunternehmer && <p className="text-xs text-orange-600 mt-0.5">Sub: {item.subunternehmer}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button onClick={() => { setEditItem(item); setShowModal(true); }} className="p-1.5 hover:bg-muted rounded-sm" data-testid={`btn-edit-${item.id}`}><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(item.id)} className={`p-1.5 rounded-sm transition-colors ${confirmDeleteId === item.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`} data-testid={`btn-delete-${item.id}`}>
                      {confirmDeleteId === item.id ? <span className="text-[10px] font-bold">OK?</span> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.unit}</span>
                    <span className="font-mono font-semibold">{(item.price_net || 0).toFixed(2)} €</span>
                  </div>
                  {item.ek_preis > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex justify-between"><span>EK:</span><span className="font-mono">{item.ek_preis.toFixed(2)} €</span></div>
                      {item.vk_preis_1 > 0 && <div className="flex justify-between"><span>VK1 ({item.aufschlag_1}%):</span><span className="font-mono font-medium text-foreground">{item.vk_preis_1.toFixed(2)} €</span></div>}
                      {item.vk_preis_2 > 0 && <div className="flex justify-between"><span>VK2 ({item.aufschlag_2}%):</span><span className="font-mono font-medium text-foreground">{item.vk_preis_2.toFixed(2)} €</span></div>}
                      {item.vk_preis_3 > 0 && <div className="flex justify-between"><span>VK3 ({item.aufschlag_3}%):</span><span className="font-mono font-medium text-foreground">{item.vk_preis_3.toFixed(2)} €</span></div>}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ArtikelModal isOpen={showModal} onClose={() => setShowModal(false)} item={editItem} onSave={() => { setShowModal(false); loadItems(); }} />
    </div>
  );
};

const ArtikelModal = ({ isOpen, onClose, item, onSave }) => {
  const [form, setForm] = useState({ name: "", description: "", typ: "Artikel", unit: "Stück", ek_preis: 0, aufschlag_1: 0, aufschlag_2: 0, aufschlag_3: 0, price_net: 0, subunternehmer: "", purchase_price: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "", description: item.description || "", typ: item.typ || "Artikel",
        unit: item.unit || "Stück", ek_preis: item.ek_preis || 0,
        aufschlag_1: item.aufschlag_1 || 0, aufschlag_2: item.aufschlag_2 || 0, aufschlag_3: item.aufschlag_3 || 0,
        price_net: item.price_net || 0, subunternehmer: item.subunternehmer || "", purchase_price: item.purchase_price || 0,
      });
    } else {
      setForm({ name: "", description: "", typ: "Artikel", unit: "Stück", ek_preis: 0, aufschlag_1: 0, aufschlag_2: 0, aufschlag_3: 0, price_net: 0, subunternehmer: "", purchase_price: 0 });
    }
  }, [item, isOpen]);

  const calcVk = (ek, pct) => ek > 0 && pct > 0 ? +(ek * (1 + pct / 100)).toFixed(2) : 0;
  const vk1 = calcVk(form.ek_preis, form.aufschlag_1);
  const vk2 = calcVk(form.ek_preis, form.aufschlag_2);
  const vk3 = calcVk(form.ek_preis, form.aufschlag_3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, vk_preis_1: vk1, vk_preis_2: vk2, vk_preis_3: vk3, purchase_price: form.ek_preis };
    try {
      if (item) {
        await api.put(`/articles/${item.id}`, payload);
        toast.success("Aktualisiert");
      } else {
        await api.post("/articles", payload);
        toast.success("Erstellt");
      }
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? "Bearbeiten" : "Neuer Eintrag"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="artikel-modal">
        {/* Typ Auswahl */}
        <div>
          <label className="block text-sm font-medium mb-2">Typ</label>
          <div className="flex gap-2" data-testid="artikel-typ-select">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <button key={key} type="button" onClick={() => setForm({ ...form, typ: key, unit: key === "Leistung" || key === "Fremdleistung" ? "Stunde" : form.unit })}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-all flex items-center gap-1.5 ${form.typ === key ? cfg.color + " shadow-sm ring-2 ring-offset-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                data-testid={`typ-${key.toLowerCase()}`}>
                <cfg.icon className="w-4 h-4" /> {cfg.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Bezeichnung *</label>
            <Input data-testid="input-artikel-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Türreparatur" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Einheit</label>
            <select data-testid="select-artikel-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
              <option value="Stück">Stück</option><option value="Stunde">Stunde</option><option value="m²">m²</option>
              <option value="lfm">lfm</option><option value="Pauschal">Pauschal</option><option value="Tag">Tag</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung</label>
          <Textarea data-testid="input-artikel-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optionale Beschreibung..." rows={2} />
        </div>

        {form.typ === "Fremdleistung" && (
          <div>
            <label className="block text-sm font-medium mb-1">Subunternehmer</label>
            <Input data-testid="input-subunternehmer" value={form.subunternehmer} onChange={(e) => setForm({ ...form, subunternehmer: e.target.value })} placeholder="Name des Subunternehmers" />
          </div>
        )}

        {/* Preise */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold mb-3">Preiskalkulation</h4>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">EK-Preis (Netto €)</label>
              <Input data-testid="input-ek-preis" type="number" step="0.01" value={form.ek_preis || ""} onChange={(e) => setForm({ ...form, ek_preis: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">VK-Preis (Netto €)</label>
              <Input data-testid="input-price-net" type="number" step="0.01" value={form.price_net || ""} onChange={(e) => setForm({ ...form, price_net: parseFloat(e.target.value) || 0 })} placeholder="Standardpreis" />
            </div>
          </div>

          {form.ek_preis > 0 && (
            <div className="bg-muted/30 rounded-sm p-3 border space-y-2">
              <p className="text-xs font-medium text-muted-foreground">VK-Preise berechnen (EK + Aufschlag %)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Aufschlag 1 (%)</label>
                  <Input data-testid="input-aufschlag-1" type="number" step="0.1" value={form.aufschlag_1 || ""} onChange={(e) => setForm({ ...form, aufschlag_1: parseFloat(e.target.value) || 0 })} placeholder="%" className="h-8 text-sm" />
                  {vk1 > 0 && <p className="text-xs font-mono font-semibold text-primary mt-1">= {vk1.toFixed(2)} €</p>}
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Aufschlag 2 (%)</label>
                  <Input data-testid="input-aufschlag-2" type="number" step="0.1" value={form.aufschlag_2 || ""} onChange={(e) => setForm({ ...form, aufschlag_2: parseFloat(e.target.value) || 0 })} placeholder="%" className="h-8 text-sm" />
                  {vk2 > 0 && <p className="text-xs font-mono font-semibold text-primary mt-1">= {vk2.toFixed(2)} €</p>}
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Aufschlag 3 (%)</label>
                  <Input data-testid="input-aufschlag-3" type="number" step="0.1" value={form.aufschlag_3 || ""} onChange={(e) => setForm({ ...form, aufschlag_3: parseFloat(e.target.value) || 0 })} placeholder="%" className="h-8 text-sm" />
                  {vk3 > 0 && <p className="text-xs font-mono font-semibold text-primary mt-1">= {vk3.toFixed(2)} €</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" data-testid="btn-save-artikel" disabled={loading}>{loading ? "Speichern..." : "Speichern"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export { ArtikelPage };
