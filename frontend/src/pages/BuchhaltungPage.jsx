import { useState, useEffect, useMemo } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Pencil, Search,
  Receipt, ArrowUpCircle, ArrowDownCircle, Settings2, X, Check, Filter,
  CreditCard, Undo2, BarChart3, Calculator
} from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge, Button, Modal, Textarea } from "@/components/common";
import { api } from "@/lib/api";

// ==================== MAIN PAGE ====================
const BuchhaltungPage = () => {
  const [tab, setTab] = useState("uebersicht");
  const [buchungen, setBuchungen] = useState([]);
  const [stats, setStats] = useState(null);
  const [offenePosten, setOffenePosten] = useState([]);
  const [kategorien, setKategorien] = useState({ einnahme: [], ausgabe: [] });
  const [loading, setLoading] = useState(true);
  const [zeitraum, setZeitraum] = useState("jahr");
  const [typFilter, setTypFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [editBuchung, setEditBuchung] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showKategorien, setShowKategorien] = useState(false);

  useEffect(() => {
    loadAll();
  }, [zeitraum, typFilter]);

  const loadAll = async () => {
    try {
      const [buchRes, statsRes, postenRes, katRes] = await Promise.all([
        api.get("/buchhaltung/buchungen", { params: { zeitraum, typ: typFilter } }),
        api.get("/buchhaltung/statistiken", { params: { zeitraum } }),
        api.get("/buchhaltung/offene-posten"),
        api.get("/buchhaltung/kategorien"),
      ]);
      setBuchungen(buchRes.data);
      setStats(statsRes.data);
      setOffenePosten(postenRes.data);
      setKategorien(katRes.data);
    } catch {
      toast.error("Fehler beim Laden der Buchhaltungsdaten");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBuchung = async (id) => {
    try {
      await api.delete(`/buchhaltung/buchungen/${id}`);
      setBuchungen(buchungen.filter((b) => b.id !== id));
      toast.success("Buchung rückstandslos gelöscht");
      loadAll();
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await api.post(`/buchhaltung/zahlungseingang/${invoiceId}`, { buchung_erstellen: true });
      toast.success("Rechnung als bezahlt markiert");
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const handleUndoPayment = async (invoiceId) => {
    try {
      await api.post(`/buchhaltung/zahlung-rueckgaengig/${invoiceId}`);
      toast.success("Zahlung rückgängig gemacht");
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const filtered = useMemo(() => {
    if (!search) return buchungen;
    const s = search.toLowerCase();
    return buchungen.filter(
      (b) =>
        (b.beschreibung || "").toLowerCase().includes(s) ||
        (b.kategorie || "").toLowerCase().includes(s) ||
        (b.kunde || "").toLowerCase().includes(s) ||
        (b.rechnung_nr || "").toLowerCase().includes(s)
    );
  }, [buchungen, search]);

  const zeitraumLabels = { monat: "Monat", quartal: "Quartal", jahr: "Jahr", alle: "Gesamt" };

  const tabs = [
    { key: "uebersicht", label: "Übersicht", icon: BarChart3 },
    { key: "buchungen", label: "Buchungen", icon: Receipt },
    { key: "posten", label: "Offene Posten", icon: CreditCard },
    { key: "ust", label: "USt/MwSt", icon: Calculator },
  ];

  return (
    <div data-testid="buchhaltung-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Buchhaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            Einnahmen, Ausgaben & Finanzen verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKategorien(true)}
            data-testid="btn-kategorien"
          >
            <Settings2 className="w-4 h-4 mr-1.5" /> Kategorien
          </Button>
          <Button onClick={() => setShowNewForm(true)} data-testid="btn-neue-buchung">
            <Plus className="w-4 h-4 mr-1.5" /> Neue Buchung
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b" data-testid="buchhaltung-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${t.key}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Zeitraum Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["monat", "quartal", "jahr", "alle"].map((z) => (
          <button
            key={z}
            onClick={() => setZeitraum(z)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              zeitraum === z
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`zeitraum-${z}`}
          >
            {zeitraumLabels[z]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {tab === "uebersicht" && <UebersichtTab stats={stats} />}
          {tab === "buchungen" && (
            <BuchungenTab
              buchungen={filtered}
              search={search}
              setSearch={setSearch}
              typFilter={typFilter}
              setTypFilter={setTypFilter}
              onDelete={handleDeleteBuchung}
              onEdit={(b) => setEditBuchung(b)}
            />
          )}
          {tab === "posten" && (
            <OffenePostenTab
              posten={offenePosten}
              onMarkPaid={handleMarkPaid}
              onUndoPayment={handleUndoPayment}
            />
          )}
          {tab === "ust" && <UstTab stats={stats} zeitraum={zeitraum} />}
        </>
      )}

      {/* New / Edit Modal */}
      {(showNewForm || editBuchung) && (
        <BuchungFormModal
          buchung={editBuchung}
          kategorien={kategorien}
          onClose={() => { setShowNewForm(false); setEditBuchung(null); }}
          onSaved={() => { setShowNewForm(false); setEditBuchung(null); loadAll(); }}
        />
      )}

      {/* Kategorien Modal */}
      {showKategorien && (
        <KategorienModal
          kategorien={kategorien}
          onClose={() => setShowKategorien(false)}
          onSaved={() => { setShowKategorien(false); loadAll(); }}
        />
      )}
    </div>
  );
};


// ==================== ÜBERSICHT TAB ====================
const UebersichtTab = ({ stats }) => {
  if (!stats) return null;

  const maxMonat = Math.max(...(stats.monatlich || []).map(m => Math.max(m.einnahmen, m.ausgaben)), 1);

  return (
    <div className="space-y-6" data-testid="tab-content-uebersicht">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Einnahmen (brutto)</p>
              <p className="text-2xl font-bold text-green-600" data-testid="kpi-einnahmen">
                {stats.einnahmen_brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </p>
            </div>
            <ArrowUpCircle className="w-8 h-8 text-green-500/30" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ausgaben (brutto)</p>
              <p className="text-2xl font-bold text-red-600" data-testid="kpi-ausgaben">
                {stats.ausgaben_brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </p>
            </div>
            <ArrowDownCircle className="w-8 h-8 text-red-500/30" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gewinn (brutto)</p>
              <p className={`text-2xl font-bold ${stats.gewinn_brutto >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="kpi-gewinn">
                {stats.gewinn_brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </p>
            </div>
            {stats.gewinn_brutto >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-500/30" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-500/30" />
            )}
          </div>
        </Card>
      </div>

      {/* Monthly Bar Chart */}
      {stats.monatlich?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Monatliche Übersicht</h3>
          <div className="space-y-3">
            {stats.monatlich.map((m) => {
              const monatLabel = (() => {
                try {
                  const [y, mo] = m.monat.split("-");
                  return new Date(y, parseInt(mo) - 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
                } catch { return m.monat; }
              })();
              return (
                <div key={m.monat} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">{monatLabel}</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-3 rounded-full bg-green-500 transition-all" style={{ width: `${(m.einnahmen / maxMonat) * 100}%`, minWidth: m.einnahmen > 0 ? "4px" : "0" }} />
                      <span className="text-xs text-green-700">{m.einnahmen.toLocaleString("de-DE")} EUR</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 rounded-full bg-red-400 transition-all" style={{ width: `${(m.ausgaben / maxMonat) * 100}%`, minWidth: m.ausgaben > 0 ? "4px" : "0" }} />
                      <span className="text-xs text-red-700">{m.ausgaben.toLocaleString("de-DE")} EUR</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Einnahmen</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400" /> Ausgaben</span>
          </div>
        </Card>
      )}

      {/* Kategorien Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(stats.kategorien_einnahmen || {}).length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-green-600" /> Einnahmen nach Kategorie
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.kategorien_einnahmen).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{k}</span>
                  <span className="font-medium text-green-700">{v.toLocaleString("de-DE")} EUR</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {Object.keys(stats.kategorien_ausgaben || {}).length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-red-600" /> Ausgaben nach Kategorie
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.kategorien_ausgaben).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{k}</span>
                  <span className="font-medium text-red-700">{v.toLocaleString("de-DE")} EUR</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};


// ==================== BUCHUNGEN TAB ====================
const BuchungenTab = ({ buchungen, search, setSearch, typFilter, setTypFilter, onDelete, onEdit }) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDelete = (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    onDelete(id);
    setConfirmDeleteId(null);
  };

  return (
    <div data-testid="tab-content-buchungen">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["alle", "einnahme", "ausgabe"].map((t) => (
          <button
            key={t}
            onClick={() => setTypFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              typFilter === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`typ-filter-${t}`}
          >
            {t === "alle" ? "Alle" : t === "einnahme" ? "Einnahmen" : "Ausgaben"}
          </button>
        ))}
      </div>

      <Card className="p-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Buchungen durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-buchungen"
          />
        </div>
      </Card>

      {buchungen.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Buchungen vorhanden</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {buchungen.map((b) => (
            <Card key={b.id} className="p-4" data-testid={`buchung-${b.id}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-sm shrink-0 ${b.typ === "einnahme" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                  {b.typ === "einnahme" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{b.beschreibung || "Keine Beschreibung"}</span>
                    {b.kategorie && <Badge variant="default" className="text-xs">{b.kategorie}</Badge>}
                    {b.rechnung_nr && <span className="text-xs font-mono text-muted-foreground">{b.rechnung_nr}</span>}
                  </div>
                  <div className="flex gap-x-4 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground">
                    {b.kunde && <span>Kunde: {b.kunde}</span>}
                    <span>{new Date(b.datum).toLocaleDateString("de-DE")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-bold text-sm ${b.typ === "einnahme" ? "text-green-600" : "text-red-600"}`}>
                    {b.typ === "einnahme" ? "+" : "-"}{(b.betrag_brutto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
                  </span>
                  <button
                    onClick={() => onEdit(b)}
                    className="p-2 rounded-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    title="Bearbeiten"
                    data-testid={`btn-edit-buchung-${b.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className={`p-2 rounded-sm transition-colors ${
                      confirmDeleteId === b.id
                        ? "bg-red-500 text-white"
                        : "text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                    }`}
                    title={confirmDeleteId === b.id ? "Nochmal klicken zum Löschen" : "Rückstandslos löschen"}
                    data-testid={`btn-delete-buchung-${b.id}`}
                  >
                    {confirmDeleteId === b.id ? <span className="text-xs font-bold px-1">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};


// ==================== OFFENE POSTEN TAB ====================
const OffenePostenTab = ({ posten, onMarkPaid, onUndoPayment }) => {
  const total = posten.reduce((sum, p) => sum + (p.betrag || 0), 0);

  return (
    <div data-testid="tab-content-posten">
      <Card className="p-4 mb-4 bg-amber-50 border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">{posten.length} offene Posten</p>
            <p className="text-xs text-amber-700">Gesamtbetrag: {total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
          </div>
          <CreditCard className="w-6 h-6 text-amber-400" />
        </div>
      </Card>

      {posten.length === 0 ? (
        <Card className="p-12 text-center">
          <Check className="w-12 h-12 text-green-500/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Keine offenen Posten – alles bezahlt!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {posten.map((p) => (
            <Card key={p.id} className={`p-4 ${p.status === "Überfällig" ? "border-red-300 bg-red-50/30" : ""}`} data-testid={`posten-${p.id}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-sm shrink-0 ${p.status === "Überfällig" ? "bg-red-100 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{p.rechnung_nr}</span>
                    <Badge variant={p.status === "Überfällig" ? "destructive" : "default"} className="text-xs">{p.status}</Badge>
                  </div>
                  <div className="flex gap-x-4 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground">
                    <span>Kunde: {p.kunde}</span>
                    <span>Erstellt: {new Date(p.datum).toLocaleDateString("de-DE")}</span>
                    {p.faellig_am && <span>Fällig: {new Date(p.faellig_am).toLocaleDateString("de-DE")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-sm">{(p.betrag || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span>
                  <Button
                    size="sm"
                    onClick={() => onMarkPaid(p.id)}
                    data-testid={`btn-bezahlt-${p.id}`}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Bezahlt
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};


// ==================== UST TAB ====================
const UstTab = ({ stats, zeitraum }) => {
  if (!stats) return null;
  const zeitraumLabels = { monat: "diesen Monat", quartal: "dieses Quartal", jahr: "dieses Jahr", alle: "gesamt" };

  return (
    <div className="space-y-4" data-testid="tab-content-ust">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">USt/MwSt-Übersicht ({zeitraumLabels[zeitraum]})</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm">Umsatzsteuer (eingenommen)</span>
            <span className="font-bold text-sm">{stats.ust_einnahmen.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm">Vorsteuer (gezahlt)</span>
            <span className="font-bold text-sm">-{stats.vst_ausgaben.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span>
          </div>
          <div className={`flex justify-between items-center py-3 rounded-sm px-3 ${stats.ust_zahllast >= 0 ? "bg-amber-50" : "bg-green-50"}`}>
            <span className="text-sm font-semibold">
              {stats.ust_zahllast >= 0 ? "USt-Zahllast (an Finanzamt)" : "Vorsteuerüberhang (Erstattung)"}
            </span>
            <span className={`font-bold text-lg ${stats.ust_zahllast >= 0 ? "text-amber-700" : "text-green-700"}`}>
              {Math.abs(stats.ust_zahllast).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Einnahmen</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span>Netto</span><span>{stats.einnahmen_netto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
            <div className="flex justify-between text-sm"><span>USt</span><span>{stats.ust_einnahmen.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2"><span>Brutto</span><span>{stats.einnahmen_brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Ausgaben</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span>Netto</span><span>{stats.ausgaben_netto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
            <div className="flex justify-between text-sm"><span>VSt</span><span>{stats.vst_ausgaben.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2"><span>Brutto</span><span>{stats.ausgaben_brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
};


// ==================== BUCHUNG FORM MODAL ====================
const BuchungFormModal = ({ buchung, kategorien, onClose, onSaved }) => {
  const isEdit = !!buchung;
  const [form, setForm] = useState({
    typ: buchung?.typ || "ausgabe",
    kategorie: buchung?.kategorie || "",
    beschreibung: buchung?.beschreibung || "",
    betrag_netto: buchung?.betrag_netto || "",
    mwst_satz: buchung?.mwst_satz ?? 19,
    betrag_brutto: buchung?.betrag_brutto || "",
    datum: buchung?.datum ? buchung.datum.substring(0, 10) : new Date().toISOString().substring(0, 10),
    notizen: buchung?.notizen || "",
    kunde: buchung?.kunde || "",
  });
  const [saving, setSaving] = useState(false);

  const catOptions = form.typ === "einnahme" ? (kategorien.einnahme || []) : (kategorien.ausgabe || []);

  const handleNettoChange = (val) => {
    const netto = parseFloat(val) || 0;
    const brutto = Math.round(netto * (1 + form.mwst_satz / 100) * 100) / 100;
    setForm({ ...form, betrag_netto: val, betrag_brutto: brutto || "" });
  };

  const handleBruttoChange = (val) => {
    const brutto = parseFloat(val) || 0;
    const netto = Math.round((brutto / (1 + form.mwst_satz / 100)) * 100) / 100;
    setForm({ ...form, betrag_brutto: val, betrag_netto: netto || "" });
  };

  const handleMwstChange = (val) => {
    const mwst = parseFloat(val) || 0;
    const netto = parseFloat(form.betrag_netto) || 0;
    const brutto = Math.round(netto * (1 + mwst / 100) * 100) / 100;
    setForm({ ...form, mwst_satz: val, betrag_brutto: brutto || form.betrag_brutto });
  };

  const handleSave = async () => {
    if (!form.beschreibung && !form.kategorie) {
      toast.error("Beschreibung oder Kategorie erforderlich");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        betrag_netto: parseFloat(form.betrag_netto) || 0,
        betrag_brutto: parseFloat(form.betrag_brutto) || 0,
        mwst_satz: parseFloat(form.mwst_satz) || 0,
      };
      if (isEdit) {
        await api.put(`/buchhaltung/buchungen/${buchung.id}`, payload);
        toast.success("Buchung aktualisiert");
      } else {
        await api.post("/buchhaltung/buchungen", payload);
        toast.success("Buchung erstellt");
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? "Buchung bearbeiten" : "Neue Buchung"} size="lg">
      <div className="space-y-4" data-testid="buchung-form-modal">
        {/* Typ */}
        <div className="flex gap-2" data-testid="buchung-typ-toggle">
          <button
            type="button"
            onClick={() => setForm({ ...form, typ: "einnahme", kategorie: "" })}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all ${
              form.typ === "einnahme" ? "bg-green-600 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid="typ-einnahme"
          >
            <ArrowUpCircle className="w-4 h-4" /> Einnahme
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, typ: "ausgabe", kategorie: "" })}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all ${
              form.typ === "ausgabe" ? "bg-red-600 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid="typ-ausgabe"
          >
            <ArrowDownCircle className="w-4 h-4" /> Ausgabe
          </button>
        </div>

        {/* Kategorie + Datum */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kategorie</label>
            <select
              value={form.kategorie}
              onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
              className="w-full border rounded-sm p-2 text-sm bg-background"
              data-testid="input-kategorie"
            >
              <option value="">-- Wählen --</option>
              {catOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <Input
              type="date"
              value={form.datum}
              onChange={(e) => setForm({ ...form, datum: e.target.value })}
              data-testid="input-datum"
            />
          </div>
        </div>

        {/* Beschreibung */}
        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung</label>
          <Input
            value={form.beschreibung}
            onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
            placeholder="z.B. Material Eiche, Werkzeug-Kauf..."
            data-testid="input-beschreibung"
          />
        </div>

        {/* Beträge */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Netto (EUR)</label>
            <Input
              type="number"
              step="0.01"
              value={form.betrag_netto}
              onChange={(e) => handleNettoChange(e.target.value)}
              placeholder="0.00"
              data-testid="input-betrag-netto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MwSt %</label>
            <Input
              type="number"
              step="1"
              value={form.mwst_satz}
              onChange={(e) => handleMwstChange(e.target.value)}
              data-testid="input-mwst-satz"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Brutto (EUR)</label>
            <Input
              type="number"
              step="0.01"
              value={form.betrag_brutto}
              onChange={(e) => handleBruttoChange(e.target.value)}
              placeholder="0.00"
              data-testid="input-betrag-brutto"
            />
          </div>
        </div>

        {/* Kunde */}
        <div>
          <label className="block text-sm font-medium mb-1">Kunde (optional)</label>
          <Input
            value={form.kunde}
            onChange={(e) => setForm({ ...form, kunde: e.target.value })}
            placeholder="Kundenname"
            data-testid="input-kunde"
          />
        </div>

        {/* Notizen */}
        <div>
          <label className="block text-sm font-medium mb-1">Notizen (optional)</label>
          <Textarea
            value={form.notizen}
            onChange={(e) => setForm({ ...form, notizen: e.target.value })}
            placeholder="Interne Notizen..."
            rows={2}
            data-testid="input-notizen"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-buchung">
            {saving ? "Speichern..." : isEdit ? "Aktualisieren" : "Buchung erstellen"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};


// ==================== KATEGORIEN MODAL ====================
const KategorienModal = ({ kategorien, onClose, onSaved }) => {
  const [einnahme, setEinnahme] = useState([...(kategorien.einnahme || [])]);
  const [ausgabe, setAusgabe] = useState([...(kategorien.ausgabe || [])]);
  const [newEin, setNewEin] = useState("");
  const [newAus, setNewAus] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/buchhaltung/kategorien", {
        einnahme: einnahme.filter((k) => k.trim()),
        ausgabe: ausgabe.filter((k) => k.trim()),
      });
      toast.success("Kategorien gespeichert");
      onSaved();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Buchungs-Kategorien verwalten" size="lg">
      <div className="space-y-6" data-testid="kategorien-modal">
        {/* Einnahme */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-green-600" /> Einnahme-Kategorien
          </h3>
          <div className="space-y-1.5 mb-2">
            {einnahme.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={k}
                  onChange={(e) => { const u = [...einnahme]; u[i] = e.target.value; setEinnahme(u); }}
                  className="flex-1 h-8 border rounded-sm px-3 text-sm bg-white"
                />
                <button onClick={() => setEinnahme(einnahme.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newEin}
              onChange={(e) => setNewEin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newEin.trim()) { setEinnahme([...einnahme, newEin.trim()]); setNewEin(""); } }}
              placeholder="Neue Kategorie..."
              className="flex-1 h-8 border border-dashed rounded-sm px-3 text-sm"
              data-testid="input-new-einnahme-kat"
            />
            <button
              onClick={() => { if (newEin.trim()) { setEinnahme([...einnahme, newEin.trim()]); setNewEin(""); } }}
              disabled={!newEin.trim()}
              className="h-8 px-3 text-xs font-medium bg-green-50 text-green-700 rounded-sm hover:bg-green-100 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Ausgabe */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ArrowDownCircle className="w-4 h-4 text-red-600" /> Ausgabe-Kategorien
          </h3>
          <div className="space-y-1.5 mb-2">
            {ausgabe.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={k}
                  onChange={(e) => { const u = [...ausgabe]; u[i] = e.target.value; setAusgabe(u); }}
                  className="flex-1 h-8 border rounded-sm px-3 text-sm bg-white"
                />
                <button onClick={() => setAusgabe(ausgabe.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newAus}
              onChange={(e) => setNewAus(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newAus.trim()) { setAusgabe([...ausgabe, newAus.trim()]); setNewAus(""); } }}
              placeholder="Neue Kategorie..."
              className="flex-1 h-8 border border-dashed rounded-sm px-3 text-sm"
              data-testid="input-new-ausgabe-kat"
            />
            <button
              onClick={() => { if (newAus.trim()) { setAusgabe([...ausgabe, newAus.trim()]); setNewAus(""); } }}
              disabled={!newAus.trim()}
              className="h-8 px-3 text-xs font-medium bg-red-50 text-red-700 rounded-sm hover:bg-red-100 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-kategorien">
            {saving ? "Speichern..." : "Kategorien speichern"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export { BuchhaltungPage };
