import { useState, useEffect } from "react";
import { Package, Plus, Trash2, Edit, Search, Wrench, Users, Calculator, Clock, ChevronDown, History } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { ZeitInput, toHM, toDec, fmtHM } from "@/components/wysiwyg/KalkulationPanel";

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
    } catch { toast.error("Fehler beim Laden"); } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/articles/${id}`);
      toast.success("Gelöscht"); setConfirmDeleteId(null); loadItems();
    } catch { toast.error("Fehler beim Löschen"); }
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
                      {item.artikel_nr && <span className="text-[10px] font-mono text-muted-foreground">{item.artikel_nr}</span>}
                    </div>
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{item.description}</p>}
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
                    <div className="mt-1 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>EK:</span><span className="font-mono">{item.ek_preis.toFixed(2)} €</span></div>
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

// ==================== ARTIKEL MODAL WITH PROFI-KALKULATION ====================
const ArtikelModal = ({ isOpen, onClose, item, onSave }) => {
  const [form, setForm] = useState({ name: "", description: "", typ: "Artikel", unit: "Stück", ek_preis: 0, price_net: 0, subunternehmer: "", artikel_nr: "" });
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [showKalk, setShowKalk] = useState(false);

  // Kalkulation state
  const [kalkEk, setKalkEk] = useState(0);
  const [zeitMeister, setZeitMeister] = useState(0);
  const [zeitGeselle, setZeitGeselle] = useState(0);
  const [zeitAzubi, setZeitAzubi] = useState(0);
  const [zeitHelfer, setZeitHelfer] = useState(0);
  const [materialzuschlag, setMaterialzuschlag] = useState(10);
  const [gewinnaufschlag, setGewinnaufschlag] = useState(15);
  const [sonstige, setSonstige] = useState([]);

  // Historie
  const [historie, setHistorie] = useState([]);
  const [showHistorie, setShowHistorie] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState(null);

  const meisterRate = settings.kalk_meister || 58;
  const geselleRate = settings.kalk_geselle || 45;
  const azubiRate = settings.kalk_azubi || 18;
  const helferRate = settings.kalk_helfer || 25;

  // Load settings + last kalkulation
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try { const r = await api.get("/settings"); setSettings(r.data); } catch {}
      if (item?.id) {
        try {
          const [latestRes, histRes] = await Promise.all([
            api.get(`/kalkulation/${item.id}/latest`),
            api.get(`/kalkulation/${item.id}`)
          ]);
          setHistorie(histRes.data || []);
          const l = latestRes.data;
          if (l && l.article_id) {
            setKalkEk(l.ek ?? item.ek_preis ?? 0);
            setZeitMeister(l.zeit_meister ?? 0);
            setZeitGeselle(l.zeit_geselle ?? 0);
            setZeitAzubi(l.zeit_azubi ?? 0);
            setZeitHelfer(l.zeit_helfer ?? 0);
            setMaterialzuschlag(l.materialzuschlag ?? 10);
            setGewinnaufschlag(l.gewinnaufschlag ?? 15);
            setSonstige((l.sonstige_kosten || []).map(s => ({ ...s })));
            setShowKalk(true);
          } else {
            resetKalk(item);
          }
        } catch { resetKalk(item); }
      } else {
        resetKalk(null);
      }
    };
    load();
  }, [item, isOpen]);

  const resetKalk = (itm) => {
    setKalkEk(itm?.ek_preis || 0);
    setZeitMeister(0); setZeitGeselle(0); setZeitAzubi(0); setZeitHelfer(0);
    setMaterialzuschlag(settings.kalk_materialzuschlag || 10);
    setGewinnaufschlag(settings.kalk_gewinnaufschlag || 15);
    setSonstige([]); setHistorie([]);
  };

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "", description: item.description || "", typ: item.typ || "Artikel",
        unit: item.unit || "Stück", ek_preis: item.ek_preis || 0,
        price_net: item.price_net || 0, subunternehmer: item.subunternehmer || "", artikel_nr: item.artikel_nr || "",
      });
    } else {
      setForm({ name: "", description: "", typ: "Artikel", unit: "Stück", ek_preis: 0, price_net: 0, subunternehmer: "", artikel_nr: "" });
    }
  }, [item, isOpen]);

  // Berechnung
  const lohnkosten = zeitMeister * meisterRate + zeitGeselle * geselleRate + zeitAzubi * azubiRate + zeitHelfer * helferRate;
  const sonstigeSum = sonstige.reduce((s, p) => s + (p.betrag || 0), 0);
  const zwischensumme = kalkEk + lohnkosten + sonstigeSum;
  const materialBetrag = zwischensumme * (materialzuschlag / 100);
  const nachMaterial = zwischensumme + materialBetrag;
  const gewinnBetrag = nachMaterial * (gewinnaufschlag / 100);
  const vkPreis = nachMaterial + gewinnBetrag;
  const gesamtStunden = zeitMeister + zeitGeselle + zeitAzubi + zeitHelfer;

  const applyKalkPrice = async () => {
    setForm(f => ({ ...f, price_net: Math.round(vkPreis * 100) / 100, ek_preis: kalkEk }));
    // Save to historie
    if (item?.id && vkPreis > 0) {
      try {
        await api.post("/kalkulation", {
          article_id: item.id, article_name: item.name, ek: kalkEk,
          zeit_meister: zeitMeister, zeit_geselle: zeitGeselle, zeit_azubi: zeitAzubi, zeit_helfer: zeitHelfer,
          rate_meister: meisterRate, rate_geselle: geselleRate, rate_azubi: azubiRate, rate_helfer: helferRate,
          sonstige_kosten: sonstige.filter(s => s.name || s.betrag > 0),
          materialzuschlag, gewinnaufschlag, lohnkosten, sonstige_summe: sonstigeSum,
          zwischensumme, material_betrag: materialBetrag, gewinn_betrag: gewinnBetrag, vk_preis: vkPreis,
        });
        const histRes = await api.get(`/kalkulation/${item.id}`);
        setHistorie(histRes.data || []);
        toast.success(`VK-Preis ${vkPreis.toFixed(2)} € übernommen & Kalkulation gespeichert`);
      } catch { toast.success(`VK-Preis ${vkPreis.toFixed(2)} € übernommen`); }
    } else {
      toast.success(`VK-Preis ${vkPreis.toFixed(2)} € übernommen`);
    }
  };

  const loadFromHistorie = (entry) => {
    setKalkEk(entry.ek ?? 0);
    setZeitMeister(entry.zeit_meister ?? 0); setZeitGeselle(entry.zeit_geselle ?? 0);
    setZeitAzubi(entry.zeit_azubi ?? 0); setZeitHelfer(entry.zeit_helfer ?? 0);
    setMaterialzuschlag(entry.materialzuschlag ?? 10);
    setGewinnaufschlag(entry.gewinnaufschlag ?? 15);
    setSonstige((entry.sonstige_kosten || []).map(s => ({ ...s })));
    toast.success("Kalkulation geladen");
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, purchase_price: form.ek_preis };
    try {
      if (item) { await api.put(`/articles/${item.id}`, payload); toast.success("Aktualisiert"); }
      else { await api.post("/articles", payload); toast.success("Erstellt"); }
      onSave();
    } catch { toast.error("Fehler beim Speichern"); } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? "Bearbeiten" : "Neuer Eintrag"} size="xl">
      <form onSubmit={handleSubmit} data-testid="artikel-modal">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Stammdaten */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Stammdaten
            </h3>

            <div>
              <label className="block text-sm font-medium mb-2">Typ</label>
              <div className="flex gap-2" data-testid="artikel-typ-select">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => setForm({ ...form, typ: key, unit: key === "Leistung" || key === "Fremdleistung" ? "Stunde" : form.unit })}
                    className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all flex items-center gap-1 ${form.typ === key ? cfg.color + " shadow-sm ring-2 ring-offset-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    data-testid={`typ-${key.toLowerCase()}`}>
                    <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bezeichnung *</label>
              <Input data-testid="input-artikel-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Türreparatur" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nummer</label>
                <Input data-testid="input-artikel-nr" value={form.artikel_nr} onChange={(e) => setForm({ ...form, artikel_nr: e.target.value })} placeholder="Auto" />
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

            {/* Preisfelder */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">EK-Preis (Netto)</label>
                  <Input data-testid="input-ek-preis" type="number" step="0.01" value={form.ek_preis || ""} onChange={(e) => setForm({ ...form, ek_preis: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">VK-Preis (Netto)</label>
                  <Input data-testid="input-price-net" type="number" step="0.01" value={form.price_net || ""} onChange={(e) => setForm({ ...form, price_net: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                </div>
              </div>
              {form.ek_preis > 0 && form.price_net > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Marge:</span>
                  <span className={`font-mono font-semibold ${((form.price_net - form.ek_preis) / form.price_net * 100) >= 20 ? "text-green-600" : "text-amber-600"}`}>
                    {((form.price_net - form.ek_preis) / form.price_net * 100).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground font-mono">({(form.price_net - form.ek_preis).toFixed(2)} €)</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Profi-Kalkulation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-blue-600" /> Profi-Kalkulation
              </h3>
              <div className="flex items-center gap-1">
                {historie.length > 0 && (
                  <button type="button" onClick={() => setShowHistorie(!showHistorie)}
                    className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${showHistorie ? "bg-blue-100 text-blue-700" : "text-muted-foreground hover:text-blue-600"}`}
                    data-testid="btn-toggle-modal-historie" title="Kalkulationshistorie">
                    <History className="w-3.5 h-3.5" /><span className="text-[10px]">{historie.length}</span>
                  </button>
                )}
                <button type="button" onClick={() => setShowKalk(!showKalk)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${showKalk ? "bg-blue-100 text-blue-700 font-medium" : "text-primary hover:bg-primary/5"}`}
                  data-testid="btn-toggle-kalk">
                  {showKalk ? "Ausblenden" : "Kalkulation öffnen"}
                </button>
              </div>
            </div>

            {showKalk && (
              <div className="rounded-md border border-blue-200 bg-gradient-to-b from-blue-50/80 to-white p-4 space-y-3" data-testid="artikel-kalk-panel">
                {/* EK */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Einkaufspreis (Material/EK)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.01" value={kalkEk || ""} onChange={e => setKalkEk(parseFloat(e.target.value) || 0)}
                      placeholder="0.00" className="flex-1 h-8 border rounded px-2 text-sm font-mono text-right bg-white" data-testid="modal-kalk-ek" />
                    <span className="text-xs text-muted-foreground">€</span>
                  </div>
                </div>

                {/* Zeitanteile */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Zeitanteile</label>
                  <div className="space-y-1.5">
                    <ZeitInput label="Meister" rate={meisterRate} value={zeitMeister} onChange={setZeitMeister} tid="modal-meister" />
                    <ZeitInput label="Geselle" rate={geselleRate} value={zeitGeselle} onChange={setZeitGeselle} tid="modal-geselle" />
                    <ZeitInput label="Azubi" rate={azubiRate} value={zeitAzubi} onChange={setZeitAzubi} tid="modal-azubi" />
                    <ZeitInput label="Helfer" rate={helferRate} value={zeitHelfer} onChange={setZeitHelfer} tid="modal-helfer" />
                    {gesamtStunden > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-blue-100 mt-1">
                        <span className="text-[10px] text-blue-700 font-medium">{fmtHM(gesamtStunden)} gesamt</span>
                        <span className="text-xs font-mono font-semibold text-blue-700">{lohnkosten.toFixed(2)} €</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sonstige */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sonstige Kosten</label>
                    <button type="button" onClick={() => setSonstige([...sonstige, { name: "", betrag: 0 }])} className="text-[10px] text-primary hover:text-primary/80 font-medium" data-testid="modal-kalk-add-sonstige">+ Hinzufügen</button>
                  </div>
                  {sonstige.map((s, i) => (
                    <div key={i} className="flex items-center gap-1 mb-1">
                      <input value={s.name} onChange={e => { const u = [...sonstige]; u[i] = { ...u[i], name: e.target.value }; setSonstige(u); }}
                        placeholder="Bezeichnung" className="flex-1 h-7 border rounded px-2 text-xs bg-white" />
                      <input type="number" step="0.01" value={s.betrag || ""} onChange={e => { const u = [...sonstige]; u[i] = { ...u[i], betrag: parseFloat(e.target.value) || 0 }; setSonstige(u); }}
                        placeholder="0" className="w-16 h-7 border rounded px-1.5 text-xs font-mono text-right bg-white" />
                      <span className="text-xs text-muted-foreground">€</span>
                      <button type="button" onClick={() => setSonstige(sonstige.filter((_, idx) => idx !== i))} className="p-0.5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Zuschläge */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Zuschläge</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground flex-1">Materialzuschlag</span>
                    <input type="number" step="0.5" value={materialzuschlag || ""} onChange={e => setMaterialzuschlag(parseFloat(e.target.value) || 0)}
                      className="w-14 h-7 border rounded px-1.5 text-xs font-mono text-right bg-white" data-testid="modal-kalk-material" />
                    <span className="text-[10px] text-muted-foreground">%</span>
                    <span className="text-xs font-mono w-16 text-right">{materialBetrag.toFixed(2)}€</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground flex-1">Gewinnaufschlag</span>
                    <input type="number" step="0.5" value={gewinnaufschlag || ""} onChange={e => setGewinnaufschlag(parseFloat(e.target.value) || 0)}
                      className="w-14 h-7 border rounded px-1.5 text-xs font-mono text-right bg-white" data-testid="modal-kalk-gewinn" />
                    <span className="text-[10px] text-muted-foreground">%</span>
                    <span className="text-xs font-mono w-16 text-right">{gewinnBetrag.toFixed(2)}€</span>
                  </div>
                </div>

                {/* Ergebnis */}
                <div className="border-t-2 border-blue-300 pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Selbstkosten</span>
                    <span className="font-mono">{zwischensumme.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-blue-800">
                    <span>VK Netto (kalkuliert)</span>
                    <span className="font-mono">{vkPreis.toFixed(2)} €</span>
                  </div>
                  {form.price_net > 0 && Math.abs(form.price_net - vkPreis) > 0.01 && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Aktueller VK: {form.price_net.toFixed(2)} €</span>
                      <span className={vkPreis > form.price_net ? "text-green-600" : "text-red-600"}>
                        {vkPreis > form.price_net ? "+" : ""}{(vkPreis - form.price_net).toFixed(2)} €
                      </span>
                    </div>
                  )}
                </div>

                <button type="button" onClick={applyKalkPrice} disabled={vkPreis <= 0}
                  className="w-full h-9 flex items-center justify-center gap-1.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  data-testid="modal-kalk-apply">
                  VK-Preis übernehmen ({vkPreis.toFixed(2)} €)
                </button>
              </div>
            )}

            {/* Historie */}
            {showHistorie && historie.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-white p-3" data-testid="modal-kalk-historie">
                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Kalkulationshistorie ({historie.length})
                </h5>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {historie.map((entry, idx) => (
                    <div key={entry.id || idx} className="rounded border border-slate-200 bg-slate-50/50 overflow-hidden">
                      <button type="button" onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                        className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-100 transition-colors" data-testid={`modal-hist-entry-${idx}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold font-mono text-blue-700">{entry.vk_preis?.toFixed(2)} €</span>
                            <span className="text-[10px] text-muted-foreground">{fmtDate(entry.created_at)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            EK: {entry.ek?.toFixed(2)}€ · Lohn: {entry.lohnkosten?.toFixed(2)}€ · Mat: {entry.materialzuschlag}% · Gew: {entry.gewinnaufschlag}%
                          </p>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${expandedEntry === entry.id ? "rotate-180" : ""}`} />
                      </button>
                      {expandedEntry === entry.id && (
                        <div className="border-t bg-white px-2 py-2 space-y-1 text-[10px]">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                            <span className="text-muted-foreground">EK-Preis:</span><span className="font-mono text-right">{entry.ek?.toFixed(2)} €</span>
                            {entry.zeit_meister > 0 && (<><span className="text-muted-foreground">Meister:</span><span className="font-mono text-right">{fmtHM(entry.zeit_meister)} × {entry.rate_meister?.toFixed(0)}€</span></>)}
                            {entry.zeit_geselle > 0 && (<><span className="text-muted-foreground">Geselle:</span><span className="font-mono text-right">{fmtHM(entry.zeit_geselle)} × {entry.rate_geselle?.toFixed(0)}€</span></>)}
                            {entry.zeit_azubi > 0 && (<><span className="text-muted-foreground">Azubi:</span><span className="font-mono text-right">{fmtHM(entry.zeit_azubi)} × {entry.rate_azubi?.toFixed(0)}€</span></>)}
                            {entry.zeit_helfer > 0 && (<><span className="text-muted-foreground">Helfer:</span><span className="font-mono text-right">{fmtHM(entry.zeit_helfer)} × {entry.rate_helfer?.toFixed(0)}€</span></>)}
                            {(entry.sonstige_kosten || []).map((s, si) => (
                              <><span key={`n${si}`} className="text-muted-foreground">{s.name || "Sonstige"}:</span><span key={`v${si}`} className="font-mono text-right">{s.betrag?.toFixed(2)} €</span></>
                            ))}
                            <span className="text-muted-foreground">Materialzuschlag:</span><span className="font-mono text-right">{entry.materialzuschlag}% ({entry.material_betrag?.toFixed(2)} €)</span>
                            <span className="text-muted-foreground">Gewinnaufschlag:</span><span className="font-mono text-right">{entry.gewinnaufschlag}% ({entry.gewinn_betrag?.toFixed(2)} €)</span>
                            <span className="font-semibold text-blue-700 border-t pt-0.5 mt-0.5">VK Netto:</span><span className="font-mono font-semibold text-blue-700 text-right border-t pt-0.5 mt-0.5">{entry.vk_preis?.toFixed(2)} €</span>
                          </div>
                          <button type="button" onClick={() => { loadFromHistorie(entry); setExpandedEntry(null); setShowHistorie(false); setShowKalk(true); }}
                            className="w-full mt-1.5 h-6 flex items-center justify-center gap-1 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold hover:bg-blue-200 transition-colors"
                            data-testid={`modal-btn-load-entry-${idx}`}>
                            Diese Kalkulation laden
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!showKalk && !showHistorie && (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                <Calculator className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Professionelle Kalkulation mit Zeitanteilen, Lohnstufen und Zuschlägen</p>
                <button type="button" onClick={() => setShowKalk(true)}
                  className="mt-3 text-sm text-primary font-medium hover:underline" data-testid="btn-open-kalk">
                  Kalkulation starten
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" data-testid="btn-save-artikel" disabled={loading}>{loading ? "Speichern..." : "Speichern"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export { ArtikelPage };
