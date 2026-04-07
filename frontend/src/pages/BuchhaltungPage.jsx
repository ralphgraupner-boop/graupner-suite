import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Pencil, Search,
  Receipt, ArrowUpCircle, ArrowDownCircle, Settings2, X, Check,
  CreditCard, BarChart3, Calculator, BookOpen, Download,
  HelpCircle, AlertTriangle, Info, ChevronDown, ChevronUp, CalendarDays
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
  const [showHilfe, setShowHilfe] = useState(false);

  useEffect(() => { loadAll(); }, [zeitraum, typFilter]);

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
    } finally { setLoading(false); }
  };

  const handleDeleteBuchung = async (id) => {
    try {
      await api.delete(`/buchhaltung/buchungen/${id}`);
      setBuchungen(buchungen.filter((b) => b.id !== id));
      toast.success("Buchung rückstandslos gelöscht");
      loadAll();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await api.post(`/buchhaltung/zahlungseingang/${invoiceId}`, { buchung_erstellen: true });
      toast.success("Rechnung als bezahlt markiert");
      loadAll();
    } catch (err) { toast.error(err?.response?.data?.detail || "Fehler"); }
  };

  const handleUndoPayment = async (invoiceId) => {
    try {
      await api.post(`/buchhaltung/zahlung-rueckgaengig/${invoiceId}`);
      toast.success("Zahlung rückgängig gemacht");
      loadAll();
    } catch (err) { toast.error(err?.response?.data?.detail || "Fehler"); }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get("/buchhaltung/export-csv", { params: { zeitraum }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Buchhaltung_${zeitraum}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV-Export heruntergeladen");
    } catch {
      toast.error("Fehler beim CSV-Export");
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
        (b.rechnung_nr || "").toLowerCase().includes(s) ||
        (b.belegnummer || "").toLowerCase().includes(s)
    );
  }, [buchungen, search]);

  const zeitraumLabels = { monat: "Monat", quartal: "Quartal", jahr: "Jahr", alle: "Gesamt" };

  const tabs = [
    { key: "uebersicht", label: "Übersicht", icon: BarChart3 },
    { key: "buchungen", label: "Buchungen", icon: Receipt },
    { key: "kassenbuch", label: "Kassenbuch", icon: BookOpen },
    { key: "posten", label: "Offene Posten", icon: CreditCard },
    { key: "monatsabschluss", label: "Monatsabschluss", icon: CalendarDays },
    { key: "ust", label: "USt/MwSt", icon: Calculator },
  ];

  return (
    <div data-testid="buchhaltung-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Buchhaltung</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">Einnahmen, Ausgaben & Finanzen verwalten</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHilfe(true)} data-testid="btn-hilfe">
            <HelpCircle className="w-4 h-4 mr-1.5" /> Hilfe
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="btn-export-csv">
            <Download className="w-4 h-4 mr-1.5" /> CSV-Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowKategorien(true)} data-testid="btn-kategorien">
            <Settings2 className="w-4 h-4 mr-1.5" /> Kategorien
          </Button>
          <Button onClick={() => setShowNewForm(true)} data-testid="btn-neue-buchung">
            <Plus className="w-4 h-4 mr-1.5" /> Neue Buchung
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b overflow-x-auto" data-testid="buchhaltung-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
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
              zeitraum === z ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
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
            <BuchungenTab buchungen={filtered} search={search} setSearch={setSearch}
              typFilter={typFilter} setTypFilter={setTypFilter}
              onDelete={handleDeleteBuchung} onEdit={(b) => setEditBuchung(b)} />
          )}
          {tab === "kassenbuch" && <KassenbuchTab zeitraum={zeitraum} />}
          {tab === "posten" && <OffenePostenTab posten={offenePosten} onMarkPaid={handleMarkPaid} onUndoPayment={handleUndoPayment} />}
          {tab === "monatsabschluss" && <MonatsabschlussTab />}
          {tab === "ust" && <UstTab stats={stats} zeitraum={zeitraum} />}
        </>
      )}

      {(showNewForm || editBuchung) && (
        <BuchungFormModal buchung={editBuchung} kategorien={kategorien}
          onClose={() => { setShowNewForm(false); setEditBuchung(null); }}
          onSaved={() => { setShowNewForm(false); setEditBuchung(null); loadAll(); }} />
      )}
      {showKategorien && (
        <KategorienModal kategorien={kategorien}
          onClose={() => setShowKategorien(false)}
          onSaved={() => { setShowKategorien(false); loadAll(); }} />
      )}
      {showHilfe && <HilfeOverlay onClose={() => setShowHilfe(false)} />}
    </div>
  );
};


// ==================== HILFE OVERLAY ====================
const HilfeOverlay = ({ onClose }) => {
  const [openSection, setOpenSection] = useState(null);
  const toggle = (s) => setOpenSection(openSection === s ? null : s);

  const sections = [
    {
      key: "start", title: "Erste Schritte",
      content: `Die Buchhaltung hilft Ihnen, alle Einnahmen und Ausgaben Ihres Betriebs zu erfassen und auszuwerten.\n\n1. Klicken Sie auf "Neue Buchung" um eine Einnahme oder Ausgabe zu erfassen\n2. Wählen Sie den Typ (Einnahme/Ausgabe) und eine Kategorie\n3. Geben Sie den Betrag ein – Netto oder Brutto, das andere wird automatisch berechnet\n4. Jede Buchung erhält automatisch eine fortlaufende Belegnummer`
    },
    {
      key: "uebersicht", title: "Übersicht (Dashboard)",
      content: `Die Übersicht zeigt auf einen Blick:\n• Gesamte Einnahmen und Ausgaben (brutto)\n• Gewinn/Verlust\n• Monatliche Entwicklung als Balkendiagramm\n• Aufschlüsselung nach Kategorien\n\nMit den Zeitraum-Filtern (Monat/Quartal/Jahr/Gesamt) können Sie den Betrachtungszeitraum anpassen.`
    },
    {
      key: "buchungen", title: "Buchungen verwalten",
      content: `Alle Buchungen werden chronologisch aufgelistet.\n\n• Stift-Symbol: Buchung bearbeiten\n• Papierkorb: Buchung rückstandslos löschen (2x klicken zur Sicherheit)\n• Filter: Nach Einnahmen/Ausgaben filtern\n• Suche: Nach Beschreibung, Kategorie, Kunde oder Belegnummer suchen\n\nWichtig: Gelöschte Buchungen sind unwiderruflich entfernt – keine versteckten Logs.`
    },
    {
      key: "kassenbuch", title: "Kassenbuch",
      content: `Das Kassenbuch zeigt alle Buchungen chronologisch mit laufendem Saldo.\n\nSo sehen Sie zu jedem Zeitpunkt, wie hoch Ihr Kassenstand war. Der Endsaldo wird oben angezeigt.`
    },
    {
      key: "posten", title: "Offene Posten",
      content: `Hier sehen Sie alle unbezahlten Rechnungen.\n\n• "Bezahlt"-Button: Markiert die Rechnung als bezahlt UND erstellt automatisch eine Einnahme-Buchung\n• Überfällige Rechnungen werden rot hervorgehoben\n• Der Gesamtbetrag aller offenen Posten wird oben angezeigt`
    },
    {
      key: "monatsabschluss", title: "Monatsabschluss",
      content: `Die Monatsübersicht zeigt für jeden Monat:\n• Einnahmen und Ausgaben\n• Gewinn/Verlust\n• USt-Zahllast\n• Anzahl der Buchungen\n\nPerfekt für die monatliche Kontrolle und Vorbereitung für den Steuerberater.`
    },
    {
      key: "ust", title: "USt/MwSt-Übersicht",
      content: `Zeigt die Umsatzsteuer-Berechnung:\n\n• Umsatzsteuer: MwSt die Sie von Kunden eingenommen haben\n• Vorsteuer: MwSt die Sie bei Einkäufen bezahlt haben\n• Zahllast: Differenz – diesen Betrag schulden Sie dem Finanzamt\n  (oder bekommen zurück, wenn Vorsteuer > Umsatzsteuer)`
    },
    {
      key: "plausibilitaet", title: "Plausibilitätsprüfung",
      content: `Bei jeder neuen Buchung wird automatisch geprüft:\n\n• Ist eine Kategorie angegeben?\n• Ist der Betrag plausibel (nicht 0, nicht ungewöhnlich hoch)?\n• Liegt das Datum in der Zukunft?\n• Gibt es bereits eine ähnliche Buchung (Doppelbuchungs-Erkennung)?\n\nWarnungen werden gelb angezeigt, Fehler rot. Sie können trotzdem speichern.`
    },
    {
      key: "export", title: "CSV-Export",
      content: `Mit "CSV-Export" laden Sie alle Buchungen des gewählten Zeitraums als CSV-Datei herunter.\n\nDie Datei enthält: Belegnr., Datum, Typ, Kategorie, Beschreibung, Kunde, Netto, MwSt, Brutto, Rechnungs-Nr.\n\nDiese Datei können Sie direkt an Ihren Steuerberater weitergeben.`
    },
    {
      key: "kategorien", title: "Kategorien verwalten",
      content: `Unter "Kategorien" können Sie frei konfigurieren, welche Kategorien für Einnahmen und Ausgaben verfügbar sind.\n\nBeispiele für Ausgaben: Material, Werkzeug, Fahrzeug, Versicherung, Personal\nBeispiele für Einnahmen: Rechnung, Bareinnahme, Sonstige\n\nKategorien können jederzeit hinzugefügt, umbenannt oder gelöscht werden.`
    },
  ];

  return (
    <Modal isOpen onClose={onClose} title="Buchhaltung – Bedienungsanleitung" size="lg">
      <div className="space-y-2 max-h-[70vh] overflow-y-auto" data-testid="hilfe-overlay">
        {sections.map((s) => (
          <div key={s.key} className="border rounded-sm overflow-hidden">
            <button
              onClick={() => toggle(s.key)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
              data-testid={`hilfe-${s.key}`}
            >
              <span className="text-sm font-semibold">{s.title}</span>
              {openSection === s.key ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {openSection === s.key && (
              <div className="px-4 pb-3 text-sm text-muted-foreground whitespace-pre-line animate-in fade-in slide-in-from-top-1 duration-200">
                {s.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};


// ==================== ÜBERSICHT TAB ====================
const UebersichtTab = ({ stats }) => {
  if (!stats) return null;
  const maxMonat = Math.max(...(stats.monatlich || []).map(m => Math.max(m.einnahmen, m.ausgaben)), 1);

  return (
    <div className="space-y-6" data-testid="tab-content-uebersicht">
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
            {stats.gewinn_brutto >= 0 ? <TrendingUp className="w-8 h-8 text-green-500/30" /> : <TrendingDown className="w-8 h-8 text-red-500/30" />}
          </div>
        </Card>
      </div>

      {stats.monatlich?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Monatliche Übersicht</h3>
          <div className="space-y-3">
            {stats.monatlich.map((m) => {
              const monatLabel = (() => { try { const [y, mo] = m.monat.split("-"); return new Date(y, parseInt(mo) - 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" }); } catch { return m.monat; } })();
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(stats.kategorien_einnahmen || {}).length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-green-600" /> Einnahmen nach Kategorie</h3>
            <div className="space-y-2">{Object.entries(stats.kategorien_einnahmen).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-medium text-green-700">{v.toLocaleString("de-DE")} EUR</span></div>
            ))}</div>
          </Card>
        )}
        {Object.keys(stats.kategorien_ausgaben || {}).length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-red-600" /> Ausgaben nach Kategorie</h3>
            <div className="space-y-2">{Object.entries(stats.kategorien_ausgaben).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-medium text-red-700">{v.toLocaleString("de-DE")} EUR</span></div>
            ))}</div>
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
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    onDelete(id); setConfirmDeleteId(null);
  };

  return (
    <div data-testid="tab-content-buchungen">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["alle", "einnahme", "ausgabe"].map((t) => (
          <button key={t} onClick={() => setTypFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${typFilter === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            data-testid={`typ-filter-${t}`}
          >{t === "alle" ? "Alle" : t === "einnahme" ? "Einnahmen" : "Ausgaben"}</button>
        ))}
      </div>
      <Card className="p-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buchungen durchsuchen (Beschreibung, Kategorie, Belegnr.)..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-buchungen" />
        </div>
      </Card>

      {buchungen.length === 0 ? (
        <Card className="p-12 text-center"><Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Keine Buchungen vorhanden</p></Card>
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
                    {b.belegnummer && <span className="text-xs font-mono text-primary font-semibold">{b.belegnummer}</span>}
                    <span className="font-medium text-sm">{b.beschreibung || "Keine Beschreibung"}</span>
                    {b.kategorie && <Badge variant="default" className="text-xs">{b.kategorie}</Badge>}
                  </div>
                  <div className="flex gap-x-4 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground">
                    {b.kunde && <span>Kunde: {b.kunde}</span>}
                    {b.rechnung_nr && <span>Re: {b.rechnung_nr}</span>}
                    <span>{new Date(b.datum).toLocaleDateString("de-DE")}</span>
                  </div>
                  {b.warnungen?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {b.warnungen.map((w, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-sm flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> {typeof w === "string" ? w : w.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-bold text-sm ${b.typ === "einnahme" ? "text-green-600" : "text-red-600"}`}>
                    {b.typ === "einnahme" ? "+" : "-"}{(b.betrag_brutto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
                  </span>
                  <button onClick={() => onEdit(b)} className="p-2 rounded-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" title="Bearbeiten" data-testid={`btn-edit-buchung-${b.id}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(b.id)}
                    className={`p-2 rounded-sm transition-colors ${confirmDeleteId === b.id ? "bg-red-500 text-white" : "text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"}`}
                    title={confirmDeleteId === b.id ? "Nochmal klicken" : "Rückstandslos löschen"} data-testid={`btn-delete-buchung-${b.id}`}>
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


// ==================== KASSENBUCH TAB ====================
const KassenbuchTab = ({ zeitraum }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/buchhaltung/kassenbuch", { params: { zeitraum } })
      .then(res => setData(res.data))
      .catch(() => toast.error("Fehler beim Laden des Kassenbuchs"))
      .finally(() => setLoading(false));
  }, [zeitraum]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Lade Kassenbuch...</div>;
  if (!data) return null;

  return (
    <div data-testid="tab-content-kassenbuch">
      <Card className="p-4 mb-4 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">Kassenbuch – Laufender Saldo</p>
            <p className="text-xs text-blue-700">{data.eintraege.length} Buchungen im Zeitraum</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-700">Endsaldo</p>
            <p className={`text-lg font-bold ${data.endsaldo >= 0 ? "text-green-700" : "text-red-700"}`} data-testid="kassenbuch-endsaldo">
              {data.endsaldo.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
            </p>
          </div>
        </div>
      </Card>

      {data.eintraege.length === 0 ? (
        <Card className="p-12 text-center"><BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Keine Einträge im Kassenbuch</p></Card>
      ) : (
        <div className="border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold text-xs">Beleg-Nr.</th>
                <th className="text-left p-3 font-semibold text-xs">Datum</th>
                <th className="text-left p-3 font-semibold text-xs">Beschreibung</th>
                <th className="text-left p-3 font-semibold text-xs">Kategorie</th>
                <th className="text-right p-3 font-semibold text-xs">Einnahme</th>
                <th className="text-right p-3 font-semibold text-xs">Ausgabe</th>
                <th className="text-right p-3 font-semibold text-xs">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.eintraege.map((e, i) => (
                <tr key={e.id || i} className="border-t hover:bg-muted/20 transition-colors" data-testid={`kassenbuch-row-${i}`}>
                  <td className="p-3 font-mono text-xs text-primary">{e.belegnummer || "-"}</td>
                  <td className="p-3 text-xs">{new Date(e.datum).toLocaleDateString("de-DE")}</td>
                  <td className="p-3 text-xs">{e.beschreibung || "-"}</td>
                  <td className="p-3 text-xs">{e.kategorie || "-"}</td>
                  <td className="p-3 text-xs text-right text-green-700 font-medium">
                    {e.typ === "einnahme" ? `${(e.betrag_brutto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                  <td className="p-3 text-xs text-right text-red-700 font-medium">
                    {e.typ === "ausgabe" ? `${(e.betrag_brutto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                  <td className={`p-3 text-xs text-right font-bold ${e.saldo >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {e.saldo.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


// ==================== MONATSABSCHLUSS TAB ====================
const MonatsabschlussTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jahr, setJahr] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    api.get("/buchhaltung/monatsabschluss", { params: { jahr } })
      .then(res => setData(res.data))
      .catch(() => toast.error("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, [jahr]);

  const monatName = (m) => {
    try { const [y, mo] = m.split("-"); return new Date(y, parseInt(mo) - 1).toLocaleDateString("de-DE", { month: "long" }); }
    catch { return m; }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Lade Monatsabschluss...</div>;

  return (
    <div data-testid="tab-content-monatsabschluss">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setJahr(jahr - 1)} className="px-3 py-1.5 bg-muted rounded-sm text-sm font-medium hover:bg-muted/80">&larr; {jahr - 1}</button>
        <span className="text-lg font-bold" data-testid="monatsabschluss-jahr">{jahr}</span>
        <button onClick={() => setJahr(jahr + 1)} className="px-3 py-1.5 bg-muted rounded-sm text-sm font-medium hover:bg-muted/80">{jahr + 1} &rarr;</button>
      </div>

      {!data?.monate?.length ? (
        <Card className="p-12 text-center"><CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Keine Buchungen in {jahr}</p></Card>
      ) : (
        <div className="border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold text-xs">Monat</th>
                <th className="text-right p-3 font-semibold text-xs">Einnahmen</th>
                <th className="text-right p-3 font-semibold text-xs">Ausgaben</th>
                <th className="text-right p-3 font-semibold text-xs">Gewinn</th>
                <th className="text-right p-3 font-semibold text-xs">USt-Zahllast</th>
                <th className="text-right p-3 font-semibold text-xs">Buchungen</th>
              </tr>
            </thead>
            <tbody>
              {data.monate.map((m) => (
                <tr key={m.monat} className="border-t hover:bg-muted/20 transition-colors" data-testid={`monat-${m.monat}`}>
                  <td className="p-3 font-medium">{monatName(m.monat)}</td>
                  <td className="p-3 text-right text-green-700 font-medium">{m.einnahmen.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right text-red-700 font-medium">{m.ausgaben.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className={`p-3 text-right font-bold ${m.gewinn >= 0 ? "text-green-700" : "text-red-700"}`}>{m.gewinn.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className={`p-3 text-right ${m.zahllast >= 0 ? "text-amber-700" : "text-green-700"}`}>{m.zahllast.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right text-muted-foreground">{m.anzahl}</td>
                </tr>
              ))}
              {/* Summenzeile */}
              <tr className="border-t-2 bg-muted/30 font-bold">
                <td className="p-3">Gesamt {jahr}</td>
                <td className="p-3 text-right text-green-700">{data.monate.reduce((s, m) => s + m.einnahmen, 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-right text-red-700">{data.monate.reduce((s, m) => s + m.ausgaben, 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-right">{data.monate.reduce((s, m) => s + m.gewinn, 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-right">{data.monate.reduce((s, m) => s + m.zahllast, 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-right">{data.monate.reduce((s, m) => s + m.anzahl, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


// ==================== OFFENE POSTEN TAB ====================
const OffenePostenTab = ({ posten, onMarkPaid }) => {
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
        <Card className="p-12 text-center"><Check className="w-12 h-12 text-green-500/30 mx-auto mb-3" /><p className="text-muted-foreground">Keine offenen Posten – alles bezahlt!</p></Card>
      ) : (
        <div className="space-y-2">
          {posten.map((p) => (
            <Card key={p.id} className={`p-4 ${p.status === "Überfällig" ? "border-red-300 bg-red-50/30" : ""}`} data-testid={`posten-${p.id}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-sm shrink-0 ${p.status === "Überfällig" ? "bg-red-100 text-red-600" : "bg-amber-50 text-amber-600"}`}><Receipt className="w-4 h-4" /></div>
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
                  <Button size="sm" onClick={() => onMarkPaid(p.id)} data-testid={`btn-bezahlt-${p.id}`}><Check className="w-3.5 h-3.5 mr-1" /> Bezahlt</Button>
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
          <div className="flex justify-between items-center py-2 border-b"><span className="text-sm">Umsatzsteuer (eingenommen)</span><span className="font-bold text-sm">{stats.ust_einnahmen.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
          <div className="flex justify-between items-center py-2 border-b"><span className="text-sm">Vorsteuer (gezahlt)</span><span className="font-bold text-sm">-{stats.vst_ausgaben.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span></div>
          <div className={`flex justify-between items-center py-3 rounded-sm px-3 ${stats.ust_zahllast >= 0 ? "bg-amber-50" : "bg-green-50"}`}>
            <span className="text-sm font-semibold">{stats.ust_zahllast >= 0 ? "USt-Zahllast (an Finanzamt)" : "Vorsteuerüberhang (Erstattung)"}</span>
            <span className={`font-bold text-lg ${stats.ust_zahllast >= 0 ? "text-amber-700" : "text-green-700"}`}>{Math.abs(stats.ust_zahllast).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR</span>
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


// ==================== BUCHUNG FORM MODAL mit Plausibilitätsprüfung ====================
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
  const [warnungen, setWarnungen] = useState([]);
  const [checking, setChecking] = useState(false);

  const catOptions = form.typ === "einnahme" ? (kategorien.einnahme || []) : (kategorien.ausgabe || []);

  const handleNettoChange = (val) => {
    const netto = parseFloat(val) || 0;
    const brutto = Math.round(netto * (1 + (parseFloat(form.mwst_satz) || 0) / 100) * 100) / 100;
    setForm({ ...form, betrag_netto: val, betrag_brutto: brutto || "" });
  };

  const handleBruttoChange = (val) => {
    const brutto = parseFloat(val) || 0;
    const netto = Math.round((brutto / (1 + (parseFloat(form.mwst_satz) || 0) / 100)) * 100) / 100;
    setForm({ ...form, betrag_brutto: val, betrag_netto: netto || "" });
  };

  const handleMwstChange = (val) => {
    const mwst = parseFloat(val) || 0;
    const netto = parseFloat(form.betrag_netto) || 0;
    const brutto = Math.round(netto * (1 + mwst / 100) * 100) / 100;
    setForm({ ...form, mwst_satz: val, betrag_brutto: brutto || form.betrag_brutto });
  };

  const runPlausibility = async () => {
    setChecking(true);
    try {
      const res = await api.post("/buchhaltung/plausibilitaet", {
        ...form,
        betrag_netto: parseFloat(form.betrag_netto) || 0,
        betrag_brutto: parseFloat(form.betrag_brutto) || 0,
      });
      setWarnungen(res.data.warnungen || []);
    } catch { /* ignore */ }
    finally { setChecking(false); }
  };

  const handleSave = async () => {
    // Run plausibility check first
    setChecking(true);
    try {
      const checkRes = await api.post("/buchhaltung/plausibilitaet", {
        ...form,
        betrag_netto: parseFloat(form.betrag_netto) || 0,
        betrag_brutto: parseFloat(form.betrag_brutto) || 0,
      });
      const warns = checkRes.data.warnungen || [];
      setWarnungen(warns);

      // Block on errors
      if (warns.some(w => w.typ === "fehler")) {
        toast.error("Bitte Fehler beheben vor dem Speichern");
        setChecking(false);
        return;
      }
    } catch { /* proceed */ }
    setChecking(false);

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
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? "Buchung bearbeiten" : "Neue Buchung"} size="lg">
      <div className="space-y-4" data-testid="buchung-form-modal">
        {/* Typ */}
        <div className="flex gap-2" data-testid="buchung-typ-toggle">
          <button type="button" onClick={() => setForm({ ...form, typ: "einnahme", kategorie: "" })}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all ${form.typ === "einnahme" ? "bg-green-600 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            data-testid="typ-einnahme"><ArrowUpCircle className="w-4 h-4" /> Einnahme</button>
          <button type="button" onClick={() => setForm({ ...form, typ: "ausgabe", kategorie: "" })}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-sm font-medium transition-all ${form.typ === "ausgabe" ? "bg-red-600 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            data-testid="typ-ausgabe"><ArrowDownCircle className="w-4 h-4" /> Ausgabe</button>
        </div>

        {/* Kategorie + Datum */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kategorie</label>
            <select value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })} className="w-full border rounded-sm p-2 text-sm bg-background" data-testid="input-kategorie">
              <option value="">-- Wählen --</option>
              {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <Input type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} data-testid="input-datum" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung</label>
          <Input value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} placeholder="z.B. Material Eiche, Werkzeug-Kauf..." data-testid="input-beschreibung" />
        </div>

        {/* Beträge */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Netto (EUR)</label>
            <Input type="number" step="0.01" value={form.betrag_netto} onChange={(e) => handleNettoChange(e.target.value)} placeholder="0.00" data-testid="input-betrag-netto" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MwSt %</label>
            <Input type="number" step="1" value={form.mwst_satz} onChange={(e) => handleMwstChange(e.target.value)} data-testid="input-mwst-satz" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Brutto (EUR)</label>
            <Input type="number" step="0.01" value={form.betrag_brutto} onChange={(e) => handleBruttoChange(e.target.value)} placeholder="0.00" data-testid="input-betrag-brutto" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kunde (optional)</label>
          <Input value={form.kunde} onChange={(e) => setForm({ ...form, kunde: e.target.value })} placeholder="Kundenname" data-testid="input-kunde" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notizen (optional)</label>
          <Textarea value={form.notizen} onChange={(e) => setForm({ ...form, notizen: e.target.value })} placeholder="Interne Notizen..." rows={2} data-testid="input-notizen" />
        </div>

        {/* Plausibilitäts-Warnungen */}
        {warnungen.length > 0 && (
          <div className="space-y-1.5 p-3 bg-amber-50 border border-amber-200 rounded-sm" data-testid="plausibilitaet-warnungen">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Plausibilitätsprüfung</p>
            {warnungen.map((w, i) => (
              <p key={i} className={`text-xs flex items-center gap-1 ${w.typ === "fehler" ? "text-red-700" : w.typ === "warnung" ? "text-amber-700" : "text-blue-700"}`}>
                {w.typ === "fehler" ? <X className="w-3 h-3" /> : w.typ === "warnung" ? <AlertTriangle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                {w.text}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t">
          <button onClick={runPlausibility} disabled={checking} className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="btn-plausibilitaet">
            <AlertTriangle className="w-3.5 h-3.5" /> {checking ? "Prüfe..." : "Plausibilitätsprüfung"}
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-buchung">
              {saving ? "Speichern..." : isEdit ? "Aktualisieren" : "Buchung erstellen"}
            </Button>
          </div>
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
      await api.put("/buchhaltung/kategorien", { einnahme: einnahme.filter((k) => k.trim()), ausgabe: ausgabe.filter((k) => k.trim()) });
      toast.success("Kategorien gespeichert");
      onSaved();
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Buchungs-Kategorien verwalten" size="lg">
      <div className="space-y-6" data-testid="kategorien-modal">
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-green-600" /> Einnahme-Kategorien</h3>
          <div className="space-y-1.5 mb-2">
            {einnahme.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={k} onChange={(e) => { const u = [...einnahme]; u[i] = e.target.value; setEinnahme(u); }} className="flex-1 h-8 border rounded-sm px-3 text-sm bg-white" />
                <button onClick={() => setEinnahme(einnahme.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newEin} onChange={(e) => setNewEin(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newEin.trim()) { setEinnahme([...einnahme, newEin.trim()]); setNewEin(""); } }} placeholder="Neue Kategorie..." className="flex-1 h-8 border border-dashed rounded-sm px-3 text-sm" data-testid="input-new-einnahme-kat" />
            <button onClick={() => { if (newEin.trim()) { setEinnahme([...einnahme, newEin.trim()]); setNewEin(""); } }} disabled={!newEin.trim()} className="h-8 px-3 text-xs font-medium bg-green-50 text-green-700 rounded-sm hover:bg-green-100 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-red-600" /> Ausgabe-Kategorien</h3>
          <div className="space-y-1.5 mb-2">
            {ausgabe.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={k} onChange={(e) => { const u = [...ausgabe]; u[i] = e.target.value; setAusgabe(u); }} className="flex-1 h-8 border rounded-sm px-3 text-sm bg-white" />
                <button onClick={() => setAusgabe(ausgabe.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newAus} onChange={(e) => setNewAus(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newAus.trim()) { setAusgabe([...ausgabe, newAus.trim()]); setNewAus(""); } }} placeholder="Neue Kategorie..." className="flex-1 h-8 border border-dashed rounded-sm px-3 text-sm" data-testid="input-new-ausgabe-kat" />
            <button onClick={() => { if (newAus.trim()) { setAusgabe([...ausgabe, newAus.trim()]); setNewAus(""); } }} disabled={!newAus.trim()} className="h-8 px-3 text-xs font-medium bg-red-50 text-red-700 rounded-sm hover:bg-red-100 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-kategorien">{saving ? "Speichern..." : "Kategorien speichern"}</Button>
        </div>
      </div>
    </Modal>
  );
};

export { BuchhaltungPage };
