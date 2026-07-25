import { useState, useEffect } from "react";
import { Mail, Save, Plus, Pencil, Trash2, FileText, BookOpen, Star, AlertTriangle, Link2, ChevronDown, ChevronUp, Users, Hash, Type, Palette, Check } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Card, Modal, Badge } from "@/components/common";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/themeContext";

const TYPEN = [
  { value: "notiz", label: "Notiz", icon: FileText, color: "bg-blue-100 text-blue-700" },
  { value: "anweisung", label: "Anweisung", icon: AlertTriangle, color: "bg-amber-100 text-amber-700" },
  { value: "hinweis", label: "Hinweis", icon: Star, color: "bg-green-100 text-green-700" },
  { value: "beschreibung", label: "Beschreibung", icon: BookOpen, color: "bg-purple-100 text-purple-700" },
  { value: "link", label: "Link", icon: Link2, color: "bg-cyan-100 text-cyan-700" },
];

const DEFAULT_KATEGORIEN = ["Allgemein", "Anweisungen", "Hinweise", "Programmbeschreibung", "Links"];
const FarbschemaCard = () => {
  const { theme, setTheme } = useTheme();
  const SCHEMAS = [
    { value: "light",      label: "Hell",  swatch: "#ffffff", mark: "#14532d" },
    { value: "dark",       label: "Dunkel", swatch: "#1b1d22", mark: "#3ad07a" },
    { value: "dark-blue",  label: "Blau",  swatch: "#16243f", mark: "#5ad08a" },
    { value: "dark-green", label: "Grün",  swatch: "#0f2a0f", mark: "#6adf6a" },
    { value: "gray",       label: "Grau",  swatch: "#2d2d2d", mark: "#ffffff" },
  ];
  return (
    <Card className="p-4 lg:p-6" data-testid="farbschema-card">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Palette className="w-5 h-5 text-primary" /> Farbschema
      </h3>
      <p className="text-sm text-muted-foreground mb-3">Wählen Sie das Design der Oberfläche.</p>
      <div className="flex flex-wrap gap-3">
        {SCHEMAS.map((s) => {
          const active = theme === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setTheme(s.value)}
              data-testid={`farbschema-${s.value}`}
              title={s.label}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-md border-2 transition-smooth ${active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}
            >
              <span className="w-11 h-11 rounded-md border shadow-sm flex items-center justify-center" style={{ backgroundColor: s.swatch }}>
                {active && <Check className="w-5 h-5" style={{ color: s.mark }} />}
              </span>
              <span className="text-xs font-medium">{s.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

const SchriftgroesseCard = () => {
  const SIZES = [
    { value: 14, label: "Klein" },
    { value: 16, label: "Standard" },
    { value: 18, label: "Groß" },
    { value: 20, label: "Sehr groß" },
  ];
  const [size, setSize] = useState(16);

  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem("ui_font_size_px"), 10);
      if (stored && SIZES.some(s => s.value === stored)) setSize(stored);
    } catch { /* ignore */ }
  }, []);

  const apply = (newSize) => {
    setSize(newSize);
    document.documentElement.style.fontSize = `${newSize}px`;
    try { localStorage.setItem("ui_font_size_px", String(newSize)); } catch { /* ignore */ }
    toast.success(`Schriftgröße: ${SIZES.find(s => s.value === newSize)?.label}`);
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="schriftgroesse-card">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Type className="w-5 h-5 text-primary" /> Schriftgröße
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Stellt die Schriftgröße der gesamten App ein. Wirkt sofort, gilt pro Browser/Gerät.
      </p>
      <div className="flex flex-wrap gap-2">
        {SIZES.map(s => (
          <button
            key={s.value}
            onClick={() => apply(s.value)}
            className={`px-4 py-2 rounded-sm border transition-colors ${size === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-input"}`}
            data-testid={`btn-font-${s.value}`}
          >
            <span style={{ fontSize: `${s.value}px` }}>{s.label}</span>
            <span className="text-xs opacity-70 ml-2">({s.value}px)</span>
          </button>
        ))}
      </div>
    </Card>
  );
};

const RechnungsnummernCard = () => {
  const [format, setFormat] = useState("R-{MM}/{YY}-{NNNNN}");
  const [next, setNext] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/settings");
        setSettings(res.data);
        setFormat(res.data.invoice_number_format || "R-{MM}/{YY}-{NNNNN}");
        setNext(parseInt(res.data.invoice_number_next) || 1);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const buildPreview = (fmt, n) => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    const yy = yyyy.slice(-2);
    const seq = parseInt(n) || 0;
    return (fmt || "")
      .replace("{MM}", mm)
      .replace("{YYYY}", yyyy)
      .replace("{YY}", yy)
      .replace("{NNNNNN}", String(seq).padStart(6, "0"))
      .replace("{NNNNN}", String(seq).padStart(5, "0"))
      .replace("{NNNN}", String(seq).padStart(4, "0"));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const payload = { ...settings, invoice_number_format: format, invoice_number_next: parseInt(next) || 1 };
      const res = await api.put("/settings", payload);
      setSettings(res.data);
      toast.success("Rechnungsnummern-Format gespeichert");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="rechnungsnummern-card">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Hash className="w-5 h-5 text-primary" /> Rechnungsnummern-Format
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Bestimmt, wie neue Rechnungsnummern automatisch erzeugt werden. Bereits vergebene Nummern bleiben unverändert.
      </p>
      {loading ? (
        <div className="text-sm text-muted-foreground">Lädt...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Format</label>
              <Input
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="R-{MM}/{YY}-{NNNNN}"
                data-testid="input-invoice-format"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Platzhalter: <code>{"{MM}"}</code> Monat, <code>{"{YY}"}</code> Jahr 2-stellig, <code>{"{YYYY}"}</code> Jahr 4-stellig, <code>{"{NNNN}"}</code> / <code>{"{NNNNN}"}</code> / <code>{"{NNNNNN}"}</code> laufende Nummer.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nächste laufende Nummer</label>
              <Input
                type="number"
                min="1"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="125"
                data-testid="input-invoice-next"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird bei jeder neuen Rechnung automatisch um 1 hochgezählt.
              </p>
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-sm border">
            <p className="text-xs text-muted-foreground mb-1">Vorschau nächste Rechnung:</p>
            <p className="font-mono text-base font-semibold" data-testid="invoice-format-preview">
              {buildPreview(format, next) || "—"}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-invoice-format">
              <Save className="w-4 h-4" /> {saving ? "Speichere..." : "Speichern"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

const FeatureFlagsCard = () => {
  const [flags, setFlags] = useState({});

  useEffect(() => {
    try { setFlags(JSON.parse(localStorage.getItem("feature_flags") || "{}")); } catch { /* ignore */ }
  }, []);

  const toggle = (key) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    localStorage.setItem("feature_flags", JSON.stringify(next));
    toast.success("Feature-Flag gespeichert. Seite neu laden, damit Menüeintrag erscheint/verschwindet.");
    setTimeout(() => window.location.reload(), 1500);
  };

  const features = [
    {
      key: "rechnungen_v2",
      title: "Rechnungen (Neu) – BETA",
      desc: "Neues Rechnungs-Modul mit GoBD-konformem Verweis auf Angebot/Auftragsbestätigung. Komplett getrennt vom alten Rechnungsmodul; kann jederzeit deaktiviert werden, ohne dass Daten im alten Modul verloren gehen. Separater Nummernkreis RV2-2026-…",
    },
    {
      key: "email_module_enabled",
      title: "E-Mail-Modul in der Sidebar anzeigen",
      desc: "Wenn Sie hauptsächlich mit Betterbird / einem externen Mailprogramm arbeiten, kann das integrierte E-Mail-Modul ausgeblendet werden. Neue Anfragen aus dem Kontaktformular werden weiterhin über den Button 'Anfragen abrufen' (Dashboard / Kontakte) importiert. Standard: AUS.",
    },
  ];

  return (
    <Card className="p-4 lg:p-6" data-testid="feature-flags-card">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" /> Experimentelle Funktionen
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Diese Funktionen sind optional. Standardmäßig sind sie aus. Schalten Sie sie nur ein wenn Sie sie testen möchten.
      </p>
      <div className="space-y-3">
        {features.map(f => (
          <label key={f.key} className="flex items-start gap-3 p-3 border rounded-sm cursor-pointer hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={!!flags[f.key]}
              onChange={() => toggle(f.key)}
              className="mt-1 h-4 w-4 rounded border-input"
              data-testid={`flag-${f.key}`}
            />
            <div className="flex-1">
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </Card>
  );
};
const PopOutPrefsCard = () => {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    try { setEnabled(localStorage.getItem("ui_direct_popout") !== "false"); } catch { /* ignore */ }
  }, []);
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem("ui_direct_popout", next ? "true" : "false"); } catch { /* ignore */ }
    toast.success(next ? "Direkt-Popout aktiviert" : "Direkt-Popout deaktiviert — Modals öffnen wieder im Hauptfenster");
  };
  return (
    <Card className="p-4 lg:p-6" data-testid="popout-prefs-card">
      <h3 className="text-lg font-semibold mb-2">Fenster-Verhalten (Desktop)</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Steuert, was passiert, wenn Sie z.B. auf „Kunde bearbeiten" klicken.
      </p>
      <label className="flex items-start gap-3 p-3 border rounded-sm cursor-pointer hover:bg-muted/30 transition-colors">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          className="mt-1 h-4 w-4 rounded border-input"
          data-testid="toggle-direct-popout"
        />
        <div className="flex-1">
          <p className="font-medium">Bearbeiten-Klick öffnet direkt als eigenes Browser-Fenster</p>
          <p className="text-xs text-muted-foreground">
            An: Klick öffnet sofort ein neues Browser-Fenster (multi-monitor-tauglich, Windows-Taskleiste).
            Aus: Klick öffnet das klassische schwebende In-App-Modal (Drag/Resize/Snap).
            Bei aktiviertem Popup-Blocker wird automatisch das In-App-Modal genutzt.
          </p>
        </div>
      </label>
    </Card>
  );
};

const TextvorlagenInfoCard = () => (
  <Card className="p-4 lg:p-6">
    <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
      <BookOpen className="w-5 h-5 text-primary" /> Zwei Wege, eine Vorlage
    </h3>
    <p className="text-sm text-muted-foreground">
      Textvorlagen koennen auf zwei Arten bearbeitet werden: hier in den Einstellungen, oder direkt beim Erstellen eines Dokuments ueber den "Textvorlagen"-Button. Beide greifen auf dieselben Daten zu - Aenderungen sind sofort ueberall sichtbar.
    </p>
    <p className="text-sm text-muted-foreground mt-2">
      Der Inhalt wird bewusst als einfacher Text ohne Formatierung (fett/kursiv) gespeichert. Das verhindert, dass beim Uebernehmen einer Vorlage in ein Dokument technischer Formatierungs-Code sichtbar wird.
    </p>
  </Card>
);

const DiversesTab = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterKat, setFilterKat] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ titel: "", kategorie: "Allgemein", inhalt: "", typ: "notiz", wichtig: false });
  const [kundenStatus, setKundenStatus] = useState([]);
  const [editingKundenStatus, setEditingKundenStatus] = useState(false);
  const [kundenStatusInput, setKundenStatusInput] = useState("");

  const loadKundenStatus = async () => {
    try {
      const res = await api.get("/kunden-status");
      setKundenStatus(res.data);
    } catch (err) {
      console.error("Fehler beim Laden der Kunden-Status:", err);
    }
  };

  const saveKundenStatus = async () => {
    try {
      await api.put("/kunden-status", { status: kundenStatus });
      toast.success("Kunden-Status gespeichert");
      setEditingKundenStatus(false);
    } catch (err) {
      toast.error("Fehler beim Speichern");
    }
  };

  const addKundenStatus = () => {
    if (!kundenStatusInput.trim()) return;
    if (kundenStatus.includes(kundenStatusInput.trim())) {
      toast.error("Status existiert bereits");
      return;
    }
    setKundenStatus([...kundenStatus, kundenStatusInput.trim()]);
    setKundenStatusInput("");
  };

  const removeKundenStatus = (status) => {
    setKundenStatus(kundenStatus.filter(s => s !== status));
  };

  const loadItems = async () => {
    try {
      const res = await api.get("/diverses");
      setItems(res.data);
    } catch { toast.error("Fehler beim Laden"); } finally { setLoading(false); }
  };

  useEffect(() => { 
    loadItems();
    loadKundenStatus();
  }, []);

  const kategorien = [...new Set([...DEFAULT_KATEGORIEN, ...items.map(i => i.kategorie)])].sort();
  const filteredItems = filterKat ? items.filter(i => i.kategorie === filterKat) : items;

  const handleSave = async () => {
    if (!form.titel.trim()) { toast.error("Bitte Titel eingeben"); return; }
    try {
      if (editItem) {
        await api.put(`/diverses/${editItem.id}`, form);
        toast.success("Eintrag aktualisiert");
      } else {
        await api.post("/diverses", form);
        toast.success("Eintrag erstellt");
      }
      setShowForm(false);
      setEditItem(null);
      setForm({ titel: "", kategorie: "Allgemein", inhalt: "", typ: "notiz", wichtig: false });
      loadItems();
    } catch { toast.error("Fehler beim Speichern"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eintrag wirklich löschen?")) return;
    try {
      await api.delete(`/diverses/${id}`);
      toast.success("Eintrag gelöscht");
      loadItems();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  const openEdit = (item) => {
    setForm({ titel: item.titel, kategorie: item.kategorie, inhalt: item.inhalt, typ: item.typ, wichtig: item.wichtig || false });
    setEditItem(item);
    setShowForm(true);
  };

  const openNew = (kat) => {
    setForm({ titel: "", kategorie: kat || "Allgemein", inhalt: "", typ: "notiz", wichtig: false });
    setEditItem(null);
    setShowForm(true);
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <SchriftgroesseCard />
      <FarbschemaCard />
      <TextvorlagenInfoCard />
      <RechnungsnummernCard />
      <FeatureFlagsCard />
      <PopOutPrefsCard />

      {/* Kunden-Status Verwaltung */}
      <Card className="p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Kunden-Status Verwaltung
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Definieren Sie eigene Status-Werte für Kunden (z.B. Aktiv, Inaktiv, Interessent)
            </p>
          </div>
          {!editingKundenStatus && (
            <Button variant="outline" size="sm" onClick={() => setEditingKundenStatus(true)}>
              <Pencil className="w-4 h-4" /> Bearbeiten
            </Button>
          )}
        </div>

        {editingKundenStatus ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Neuer Status (z.B. Stammkunde)"
                value={kundenStatusInput}
                onChange={(e) => setKundenStatusInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addKundenStatus()}
              />
              <Button onClick={addKundenStatus} variant="outline">
                <Plus className="w-4 h-4" /> Hinzufügen
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {kundenStatus.map((status) => (
                <div
                  key={status}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm"
                >
                  <span>{status}</span>
                  <button
                    onClick={() => removeKundenStatus(status)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingKundenStatus(false);
                  loadKundenStatus();
                }}
              >
                Abbrechen
              </Button>
              <Button onClick={saveKundenStatus}>
                <Save className="w-4 h-4" /> Speichern
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {kundenStatus.map((status) => (
              <Badge key={status} variant="secondary" className="px-3 py-1">
                {status}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Diverses / Info</h2>
          <p className="text-sm text-muted-foreground">Anweisungen, Hinweise, Programmbeschreibung und mehr</p>
        </div>
        <Button onClick={() => openNew(filterKat)} size="sm">
          <Plus className="w-4 h-4" /> Neuer Eintrag
        </Button>
      </div>

      {/* Kategorie-Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterKat("")} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${!filterKat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          Alle ({items.length})
        </button>
        {kategorien.map(kat => {
          const count = items.filter(i => i.kategorie === kat).length;
          if (count === 0 && !DEFAULT_KATEGORIEN.includes(kat)) return null;
          return (
            <button key={kat} onClick={() => setFilterKat(kat === filterKat ? "" : kat)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filterKat === kat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {kat} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Items Liste */}
      {filteredItems.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">
            {filterKat ? `Keine Einträge in "${filterKat}"` : "Noch keine Einträge vorhanden"}
          </p>
          <Button onClick={() => openNew(filterKat)} size="sm" variant="outline" className="mt-3">
            <Plus className="w-4 h-4" /> Ersten Eintrag erstellen
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const typInfo = TYPEN.find(t => t.value === item.typ) || TYPEN[0];
            const TypIcon = typInfo.icon;
            const isExpanded = expandedId === item.id;
            return (
              <Card key={item.id} className={`overflow-hidden transition-all ${item.wichtig ? "border-amber-300 bg-amber-50/30" : ""}`}>
                <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0 ${typInfo.color}`}>
                    <TypIcon className="w-3 h-3" /> {typInfo.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.wichtig && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                      <h3 className="font-semibold text-sm truncate">{item.titel}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{item.kategorie}</span>
                      <span>{new Date(item.updated_at || item.created_at).toLocaleDateString("de-DE")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-muted rounded-sm transition-colors" title="Bearbeiten">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-destructive/10 rounded-sm transition-colors" title="Löschen">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t pt-3">
                    <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">{item.inhalt || <span className="text-muted-foreground italic">Kein Inhalt</span>}</div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Formular Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditItem(null); }} title={editItem ? "Eintrag bearbeiten" : "Neuer Eintrag"} size="lg">
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <Input value={form.titel} onChange={(e) => setForm({...form, titel: e.target.value})} placeholder="z.B. Anleitung Rechnungserstellung" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Kategorie</label>
              <select value={form.kategorie} onChange={(e) => setForm({...form, kategorie: e.target.value})} className="w-full border rounded-md p-2 text-sm">
                {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Typ</label>
              <select value={form.typ} onChange={(e) => setForm({...form, typ: e.target.value})} className="w-full border rounded-md p-2 text-sm">
                {TYPEN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Inhalt</label>
            <textarea value={form.inhalt} onChange={(e) => setForm({...form, inhalt: e.target.value})} className="w-full border rounded-md p-2 text-sm min-h-[200px] resize-y" placeholder="Beschreibung, Anleitung, Hinweis..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.wichtig} onChange={(e) => setForm({...form, wichtig: e.target.checked})} className="rounded" />
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Als wichtig markieren</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditItem(null); }}>Abbrechen</Button>
            <Button onClick={handleSave}><Save className="w-4 h-4" /> {editItem ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};



export { DiversesTab };
