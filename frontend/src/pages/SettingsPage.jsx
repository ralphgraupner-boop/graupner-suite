import { useState, useEffect } from "react";
import { Mail, Save, Bell, BellOff, Plus, Pencil, Trash2, FileText, Building2, Users, Palette, CheckCircle, Key, Send, TestTube, Clock, Wrench, User, Package, Calculator, Eye, EyeOff, RefreshCw, Copy, Shield, BookOpen, Star, AlertTriangle, Link2, ChevronDown, ChevronUp, Download, Upload, Database, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { subscribeToPush, unsubscribeFromPush, ensureVapidKey } from "@/lib/push";
import { PLACEHOLDERS } from "@/components/TextTemplateSelect";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

// ==================== TAB CONFIG ====================
const TABS = [
  { id: "firma", label: "Firmendaten", icon: Building2 },
  { id: "kalkulation", label: "Kalkulation", icon: Calculator },
  { id: "textbausteine", label: "Textbausteine", icon: FileText },
  { id: "einsatzplanung", label: "Einsatzplanung", icon: Wrench },
  { id: "email", label: "E-Mail", icon: Mail },
  { id: "benutzer", label: "Benutzer", icon: Users },
  { id: "dokumente", label: "Dokument-Vorlagen", icon: Palette },
  { id: "diverses", label: "Diverses / Info", icon: BookOpen },
  { id: "backup", label: "Backup & Wiederherstellung", icon: Save },
];

// ==================== FIRMENDATEN TAB ====================
const FirmendatenTab = ({ settings, setSettings, onSave, saving }) => (
  <div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Firmendaten</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Firmenname</label>
            <Input data-testid="input-company-name" value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} placeholder="Tischlerei Graupner" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Inhaber</label>
            <Input data-testid="input-owner-name" value={settings.owner_name} onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })} placeholder="Max Mustermann" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <Textarea data-testid="input-company-address" value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder={"Musterstraße 1\n12345 Musterstadt"} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <Input data-testid="input-company-phone" value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="01234 567890" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-Mail</label>
              <Input data-testid="input-company-email" type="email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} placeholder="info@tischlerei.de" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Steuernummer</label>
            <Input data-testid="input-tax-id" value={settings.tax_id} onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })} placeholder="123/456/78901" />
          </div>
        </div>
      </Card>

      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Bankverbindung</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Bank</label>
            <Input data-testid="input-bank-name" value={settings.bank_name} onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })} placeholder="Sparkasse Musterstadt" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">IBAN</label>
            <Input data-testid="input-iban" value={settings.iban} onChange={(e) => setSettings({ ...settings, iban: e.target.value })} placeholder="DE89 3704 0044 0532 0130 00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">BIC</label>
            <Input data-testid="input-bic" value={settings.bic} onChange={(e) => setSettings({ ...settings, bic: e.target.value })} placeholder="COBADEFFXXX" />
          </div>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-4">Steuer</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Standard MwSt-Satz</label>
            <select data-testid="select-default-vat" value={settings.default_vat_rate} onChange={(e) => setSettings({ ...settings, default_vat_rate: parseFloat(e.target.value) })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
              <option value={19}>19%</option>
              <option value={7}>7%</option>
              <option value={0}>0% (Kleinunternehmer)</option>
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.is_small_business} onChange={(e) => setSettings({ ...settings, is_small_business: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Kleinunternehmerregelung (§19 UStG)</span>
          </label>
        </div>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mt-4">
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Fahrtkosten</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Firmenstandort (für Entfernungsberechnung)</label>
            <Input data-testid="input-company-address-calc" value={settings.company_address} onChange={(e) => setSettings({ ...settings, company_address: e.target.value })} placeholder="z.B. Erlenweg 129, 22453 Hamburg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">km-Satz (EUR)</label>
              <Input data-testid="input-km-rate" type="number" step="0.01" value={settings.km_rate} onChange={(e) => setSettings({ ...settings, km_rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stundensatz Fahrt (EUR)</label>
              <Input data-testid="input-hourly-travel" type="number" step="0.5" value={settings.hourly_travel_rate} onChange={(e) => setSettings({ ...settings, hourly_travel_rate: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4">Zahlungsziele & Standards</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Zahlungsziel (Tage)</label>
              <Input data-testid="input-due-days" type="number" value={settings.default_due_days} onChange={(e) => setSettings({ ...settings, default_due_days: parseInt(e.target.value) || 14 })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Angebots-Gültigkeit (Tage)</label>
              <Input data-testid="input-quote-validity" type="number" value={settings.default_quote_validity_days} onChange={(e) => setSettings({ ...settings, default_quote_validity_days: parseInt(e.target.value) || 30 })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-Mail-Signatur</label>
            <Textarea data-testid="input-email-signature" value={settings.email_signature} onChange={(e) => setSettings({ ...settings, email_signature: e.target.value })} placeholder={"Mit freundlichen Grüßen\nTischlerei Graupner"} rows={3} />
          </div>
        </div>
      </Card>
    </div>

    <div className="mt-6 flex justify-end">
      <Button data-testid="btn-save-settings" onClick={onSave} disabled={saving}>
        <Save className="w-4 h-4" />
        {saving ? "Speichern..." : "Einstellungen speichern"}
      </Button>
    </div>
  </div>
);


// ==================== KALKULATION TAB ====================
const KalkulationTab = ({ settings, setSettings, onSave, saving }) => (
  <div>
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
        <Calculator className="w-5 h-5 text-primary" /> Kalkulationsstufen
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Stundensätze für die Kalkulation von Leistungen und Artikeln. Diese Werte werden im Dokument-Editor als Standardwerte verwendet.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Meisterlohn (€/Std)</label>
          <Input data-testid="input-kalk-meister" type="number" step="0.50" value={settings.kalk_meister || 58} onChange={(e) => setSettings({ ...settings, kalk_meister: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gesellenlohn (€/Std)</label>
          <Input data-testid="input-kalk-geselle" type="number" step="0.50" value={settings.kalk_geselle || 45} onChange={(e) => setSettings({ ...settings, kalk_geselle: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Azubi-Lohn (€/Std)</label>
          <Input data-testid="input-kalk-azubi" type="number" step="0.50" value={settings.kalk_azubi || 18} onChange={(e) => setSettings({ ...settings, kalk_azubi: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Helfer-Lohn (€/Std)</label>
          <Input data-testid="input-kalk-helfer" type="number" step="0.50" value={settings.kalk_helfer || 25} onChange={(e) => setSettings({ ...settings, kalk_helfer: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>
    </Card>

    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
        <Calculator className="w-5 h-5 text-primary" /> Standard-Zuschläge
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Diese Prozentsätze werden bei neuen Kalkulationen als Standardwerte vorbelegt.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Materialzuschlag (%)</label>
          <Input data-testid="input-kalk-material" type="number" step="0.5" value={settings.kalk_materialzuschlag || 10} onChange={(e) => setSettings({ ...settings, kalk_materialzuschlag: parseFloat(e.target.value) || 0 })} />
          <p className="text-xs text-muted-foreground mt-1">Aufschlag auf Material- und Einkaufskosten</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gewinnaufschlag (%)</label>
          <Input data-testid="input-kalk-gewinn" type="number" step="0.5" value={settings.kalk_gewinnaufschlag || 15} onChange={(e) => setSettings({ ...settings, kalk_gewinnaufschlag: parseFloat(e.target.value) || 0 })} />
          <p className="text-xs text-muted-foreground mt-1">Gewinnmarge auf Gesamtkosten</p>
        </div>
      </div>
    </Card>

    <div className="flex justify-end">
      <Button data-testid="btn-save-kalkulation" onClick={onSave} disabled={saving}>
        <Save className="w-4 h-4" />
        {saving ? "Speichern..." : "Kalkulation speichern"}
      </Button>
    </div>
  </div>
);


// ==================== TEXT TEMPLATE TAB ====================
const DOC_TYPE_LABELS = { angebot: "Angebot", auftrag: "Auftragsbestätigung", rechnung: "Rechnung" };

const TextbausteineTab = () => {
  const [templates, setTemplates] = useState([]);
  const [activeDocType, setActiveDocType] = useState("angebot");
  const [editTemplate, setEditTemplate] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", text_type: "vortext", doc_type: "angebot" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try { const res = await api.get("/text-templates"); setTemplates(res.data); } catch { toast.error("Fehler beim Laden"); }
  };

  const openNew = (docType, textType) => {
    setForm({ title: "", content: "", text_type: textType, doc_type: docType });
    setEditTemplate("new");
  };
  const openEdit = (t) => {
    setForm({ title: t.title, content: t.content, text_type: t.text_type, doc_type: t.doc_type });
    setEditTemplate(t.id);
  };

  const handleSave = async () => {
    if (!form.content.trim()) { toast.error("Inhalt erforderlich"); return; }
    // Auto-generate title from content
    const autoTitle = form.content.trim().substring(0, 40) + (form.content.trim().length > 40 ? "..." : "");
    const payload = { ...form, title: autoTitle };
    setSaving(true);
    try {
      if (editTemplate === "new") { await api.post("/text-templates", payload); toast.success("Textbaustein erstellt"); }
      else { await api.put(`/text-templates/${editTemplate}`, payload); toast.success("Aktualisiert"); }
      setEditTemplate(null); loadTemplates();
    } catch { toast.error("Fehler"); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try { await api.delete(`/text-templates/${id}`); toast.success("Gelöscht"); setConfirmDeleteId(null); loadTemplates(); } catch { toast.error("Fehler"); }
  };

  const filtered = templates.filter((t) => t.doc_type === activeDocType);

  // Simplified Betreff section - just titles, inline add/edit
  const [newBetreff, setNewBetreff] = useState("");
  const [editBetreffId, setEditBetreffId] = useState(null);
  const [editBetreffTitle, setEditBetreffTitle] = useState("");

  const handleAddBetreff = async () => {
    if (!newBetreff.trim()) return;
    try {
      await api.post("/text-templates", { doc_type: activeDocType, text_type: "betreff", title: newBetreff.trim(), content: newBetreff.trim() });
      toast.success("Betreff gespeichert");
      setNewBetreff("");
      loadTemplates();
    } catch { toast.error("Fehler"); }
  };

  const handleUpdateBetreff = async (id) => {
    if (!editBetreffTitle.trim()) return;
    try {
      await api.put(`/text-templates/${id}`, { doc_type: activeDocType, text_type: "betreff", title: editBetreffTitle.trim(), content: editBetreffTitle.trim() });
      toast.success("Aktualisiert");
      setEditBetreffId(null);
      loadTemplates();
    } catch { toast.error("Fehler"); }
  };

  const renderBetreffSection = () => {
    const items = filtered.filter((t) => t.text_type === "betreff");
    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-2">Betreff-Zeilen</h4>
        <div className="space-y-2 mb-3">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-2" data-testid={`betreff-${t.id}`}>
              {editBetreffId === t.id ? (
                <>
                  <Input value={editBetreffTitle} onChange={(e) => setEditBetreffTitle(e.target.value)} className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") handleUpdateBetreff(t.id); if (e.key === "Escape") setEditBetreffId(null); }}
                    autoFocus
                  />
                  <Button size="sm" variant="outline" onClick={() => handleUpdateBetreff(t.id)} className="h-9 px-3"><Save className="w-3.5 h-3.5" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm py-1.5 px-3 bg-muted/30 rounded-sm border">{t.title}</span>
                  <button onClick={() => { setEditBetreffId(t.id); setEditBetreffTitle(t.title); }} className="p-1.5 hover:bg-muted rounded-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(t.id)} className={`p-1.5 rounded-sm transition-colors ${confirmDeleteId === t.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}>
                    {confirmDeleteId === t.id ? <span className="text-[10px] font-bold">OK?</span> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newBetreff} onChange={(e) => setNewBetreff(e.target.value)} placeholder="Neue Betreff-Zeile eingeben..."
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleAddBetreff(); }}
            data-testid="input-new-betreff"
          />
          <Button size="sm" variant="outline" onClick={handleAddBetreff} disabled={!newBetreff.trim()} className="h-9" data-testid="btn-add-betreff">
            <Plus className="w-3.5 h-3.5" /> Hinzufügen
          </Button>
        </div>
      </div>
    );
  };

  const renderSection = (textType, label) => {
    const items = filtered.filter((t) => t.text_type === textType);
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">{label}</h4>
          <Button variant="outline" size="sm" onClick={() => openNew(activeDocType, textType)} data-testid={`btn-add-${textType}`}>
            <Plus className="w-3 h-3" /> {label.slice(0, -1)}
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Noch keine {label} für {DOC_TYPE_LABELS[activeDocType]}</p>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-sm border" data-testid={`template-${t.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-line line-clamp-3">{t.content}</p>
                </div>
                <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-muted rounded-sm shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(t.id)} className={`p-1.5 rounded-sm shrink-0 transition-colors ${confirmDeleteId === t.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}>
                  {confirmDeleteId === t.id ? <span className="text-[10px] font-bold">OK?</span> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="text-template-management">
      <h3 className="text-lg font-semibold mb-2">Textbausteine (Vortext / Schlusstext / Bemerkung)</h3>
      <p className="text-sm text-muted-foreground mb-3">Vorgefertigte Texte mit Platzhaltern für Dokumente.</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {PLACEHOLDERS.map((p) => (
          <span key={p.alias} className="text-xs bg-muted px-2 py-1 rounded font-mono" title={p.desc}>{p.alias}</span>
        ))}
      </div>

      <div className="flex gap-2 mb-4 border-b" data-testid="template-doc-type-tabs">
        {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setActiveDocType(key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${activeDocType === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid={`tab-${key}`}>
            {label}
          </button>
        ))}
      </div>

      {renderBetreffSection()}
      {renderSection("vortext", "Vortexte")}
      {renderSection("schlusstext", "Schlusstexte")}
      {renderSection("bemerkung", "Bemerkungen")}

      <Modal isOpen={!!editTemplate} onClose={() => setEditTemplate(null)} title={editTemplate === "new" ? "Neuer Textbaustein" : "Textbaustein bearbeiten"}>
        <div className="space-y-4" data-testid="template-edit-modal">
          <div>
            <label className="block text-sm font-medium mb-1">Inhalt</label>
            <Textarea data-testid="template-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={"Sehr geehrte/r {kunde_name},\n\nvielen Dank..."} rows={6} />
            <div className="flex flex-wrap gap-1 mt-2">
              {PLACEHOLDERS.map((p) => (
                <button key={p.alias} type="button" onClick={() => setForm({ ...form, content: form.content + p.alias })} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 font-mono" title={`${p.desc} einfügen`}>
                  {p.alias}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-template">{saving ? "..." : "Speichern"}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};


// ==================== SIGNATUR VORSCHAU ====================
const SignaturVorschau = () => {
  const [signatur, setSignatur] = useState("");
  const [open, setOpen] = useState(false);

  const loadSignatur = async () => {
    try {
      const res = await api.get("/email/signatur-vorschau");
      setSignatur(res.data.email_signatur);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (open && !signatur) loadSignatur(); }, [open]);

  return (
    <Card className="p-4 lg:p-6" data-testid="signatur-vorschau-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> E-Mail-Signatur & DSGVO-Fußzeile
        </h3>
        <span className="text-xs text-muted-foreground">{open ? "Schließen" : "Vorschau anzeigen"}</span>
      </button>
      {open && signatur && (
        <div className="mt-4 border rounded-sm p-4 bg-white" data-testid="signatur-vorschau-html" dangerouslySetInnerHTML={{ __html: signatur }} />
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Diese Signatur wird automatisch an alle ausgehenden E-Mails angehängt (inkl. Dokumente, Mahnungen, Antworten).
        Datei: <code className="text-primary">utils/email_signatur.py</code>
      </p>
    </Card>
  );
};


// ==================== EMAIL TAB ====================
// ==================== E-MAIL VORLAGEN MANAGER ====================
const EmailVorlagenManager = () => {
  const [vorlagen, setVorlagen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", betreff: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const res = await api.get("/email/vorlagen");
      setVorlagen(res.data);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = vorlagen.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.betreff.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditItem("new"); setForm({ name: "", betreff: "", text: "" }); };
  const openEdit = (v) => { setEditItem(v.id); setForm({ name: v.name, betreff: v.betreff, text: v.text }); };

  const handleSave = async () => {
    if (!form.name) { toast.error("Name erforderlich"); return; }
    setSaving(true);
    try {
      if (editItem === "new") {
        await api.post("/email/vorlagen", form);
        toast.success("Vorlage erstellt");
      } else {
        await api.put(`/email/vorlagen/${editItem}`, form);
        toast.success("Vorlage aktualisiert");
      }
      setEditItem(null);
      load();
    } catch { toast.error("Fehler beim Speichern"); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/email/vorlagen/${id}`);
      toast.success("Vorlage gelöscht");
      load();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="email-vorlagen-settings">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> E-Mail-Vorlagen
        </h3>
        <Button size="sm" onClick={openNew} data-testid="btn-new-vorlage">
          <Plus className="w-4 h-4" /> Neue Vorlage
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Vorlagen für schnellen E-Mail-Versand aus Anfragen und anderen Modulen.
      </p>

      {vorlagen.length > 3 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Vorlagen durchsuchen..."
          className="mb-3"
          data-testid="search-vorlagen"
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-16"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Noch keine Vorlagen. Erstellen Sie die erste!</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {filtered.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3 border rounded-sm hover:bg-muted/30 transition-colors" data-testid={`vorlage-row-${v.id}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground truncate">{v.betreff}</p>
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button onClick={() => openEdit(v)} className="p-1.5 hover:bg-muted rounded-sm" title="Bearbeiten">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(v.id)} className="p-1.5 hover:bg-red-50 rounded-sm text-red-500" title="Löschen">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title={editItem === "new" ? "Neue E-Mail-Vorlage" : "Vorlage bearbeiten"}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name (zum Suchen)</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Bilder anfordern" data-testid="vorlage-name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Betreff</label>
            <Input value={form.betreff} onChange={(e) => setForm({ ...form, betreff: e.target.value })} placeholder="z.B. Bitte um Zusendung von Fotos" data-testid="vorlage-betreff" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <Textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder={"Sehr geehrte/r {kunde_name},\n\nbitte senden Sie uns Fotos des Schadens...\n\nMit freundlichen Grüßen\nTischlerei Graupner"}
              rows={6}
              data-testid="vorlage-text"
            />
            <p className="text-xs text-muted-foreground mt-1">Platzhalter: {"{kunde_name}"}, {"{email}"}, {"{firma_name}"}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-vorlage">
              {saving ? "Speichere..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};


const EmailTab = ({ settings, setSettings, onSave, saving }) => {
  const [testing, setTesting] = useState(false);
  const [imapTesting, setImapTesting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [imapFolders, setImapFolders] = useState([]);

  const handleTestSmtp = async () => {
    setTesting(true);
    try {
      const res = await api.post("/settings/smtp-test", {
        smtp_server: settings.smtp_server,
        smtp_port: settings.smtp_port,
        smtp_user: settings.smtp_user,
        smtp_password: settings.smtp_password,
        smtp_from: settings.smtp_from || settings.smtp_user,
      });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.detail || "SMTP-Test fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  };

  const handleTestImap = async () => {
    setImapTesting(true);
    try {
      const res = await api.post("/imap/test", {
        imap_server: settings.imap_server,
        imap_port: settings.imap_port,
        imap_user: settings.imap_user,
        imap_password: settings.imap_password,
      });
      toast.success(res.data.message);
      setImapFolders(res.data.folders || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "IMAP-Test fehlgeschlagen");
    } finally {
      setImapTesting(false);
    }
  };

  const handleFetchEmails = async () => {
    setFetching(true);
    try {
      const res = await api.post("/imap/fetch");
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.detail || "E-Mail-Abruf fehlgeschlagen");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> SMTP E-Mail-Einstellungen
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Konfigurieren Sie den E-Mail-Versand für Angebote, Rechnungen und Mahnungen.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">SMTP-Server</label>
              <Input data-testid="input-smtp-server" value={settings.smtp_server} onChange={(e) => setSettings({ ...settings, smtp_server: e.target.value })} placeholder="z.B. secure.emailsrvr.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <Input data-testid="input-smtp-port" type="number" value={settings.smtp_port} onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 465 })} placeholder="465" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Benutzername / E-Mail</label>
              <Input data-testid="input-smtp-user" value={settings.smtp_user} onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })} placeholder="service24@tischlerei-graupner.de" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Passwort</label>
              <Input data-testid="input-smtp-password" type="password" value={settings.smtp_password} onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })} placeholder="********" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Absender-Adresse (falls abweichend)</label>
            <Input data-testid="input-smtp-from" value={settings.smtp_from} onChange={(e) => setSettings({ ...settings, smtp_from: e.target.value })} placeholder="Gleich wie Benutzername, wenn leer" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="btn-test-smtp" variant="outline" onClick={handleTestSmtp} disabled={testing}>
            <TestTube className="w-4 h-4" />
            {testing ? "Teste..." : "Verbindung testen"}
          </Button>
          <Button data-testid="btn-save-email" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "..." : "Speichern"}
          </Button>
        </div>
      </Card>

      <WiedervorlageSettings settings={settings} setSettings={setSettings} onSave={onSave} saving={saving} />

      {/* E-Mail-Signatur Vorschau */}
      <SignaturVorschau />

      {/* E-Mail-Vorlagen */}
      <EmailVorlagenManager />

      {/* IMAP Einstellungen */}
      <Card className="p-4 lg:p-6" data-testid="imap-settings">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> IMAP E-Mail-Empfang
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          E-Mails automatisch abrufen und als Anfragen importieren.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">IMAP-Server</label>
              <Input data-testid="input-imap-server" value={settings.imap_server || ""} onChange={(e) => setSettings({ ...settings, imap_server: e.target.value })} placeholder="z.B. imap.emailsrvr.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <Input data-testid="input-imap-port" type="number" value={settings.imap_port || 993} onChange={(e) => setSettings({ ...settings, imap_port: parseInt(e.target.value) || 993 })} placeholder="993" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Benutzername / E-Mail</label>
              <Input data-testid="input-imap-user" value={settings.imap_user || ""} onChange={(e) => setSettings({ ...settings, imap_user: e.target.value })} placeholder="service24@tischlerei-graupner.de" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Passwort</label>
              <Input data-testid="input-imap-password" type="password" value={settings.imap_password || ""} onChange={(e) => setSettings({ ...settings, imap_password: e.target.value })} placeholder="********" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ordner</label>
              {imapFolders.length > 0 ? (
                <select data-testid="select-imap-folder" value={settings.imap_folder || "INBOX"} onChange={(e) => setSettings({ ...settings, imap_folder: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
                  {imapFolders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <Input data-testid="input-imap-folder" value={settings.imap_folder || "INBOX"} onChange={(e) => setSettings({ ...settings, imap_folder: e.target.value })} placeholder="INBOX" />
              )}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Auto-Abruf Intervall (Minuten)</label>
                <Input
                  type="number"
                  min="5"
                  max="1440"
                  data-testid="input-imap-interval"
                  value={settings.imap_polling_interval || 30}
                  onChange={(e) => setSettings({ ...settings, imap_polling_interval: parseInt(e.target.value) || 30 })}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  E-Mails werden automatisch alle X Minuten abgerufen (5-1440 Min)
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer h-10">
                <input type="checkbox" checked={settings.imap_enabled || false} onChange={(e) => setSettings({ ...settings, imap_enabled: e.target.checked })} className="h-4 w-4 rounded border-input" />
                <span className="text-sm font-medium">IMAP aktiv</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="btn-test-imap" variant="outline" onClick={handleTestImap} disabled={imapTesting}>
            <TestTube className="w-4 h-4" />
            {imapTesting ? "Teste..." : "Verbindung testen"}
          </Button>
          <Button data-testid="btn-fetch-imap" variant="outline" onClick={handleFetchEmails} disabled={fetching}>
            <Mail className="w-4 h-4" />
            {fetching ? "Abrufe..." : "Jetzt abrufen"}
          </Button>
          <Button data-testid="btn-save-imap" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "..." : "Speichern"}
          </Button>
        </div>
      </Card>

      <PushNotificationSettings />
    </div>
  );
};


// ==================== WIEDERVORLAGE SETTINGS ====================
const WiedervorlageSettings = ({ settings, setSettings, onSave, saving }) => {
  return (
    <Card className="p-4 lg:p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" /> Wiedervorlage-Einstellungen
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Automatische Erinnerung bei Angeboten die nicht beantwortet wurden.
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Wiedervorlage nach (Tagen)</label>
            <Input
              data-testid="input-followup-days"
              type="number"
              min={1}
              value={settings.followup_days || 7}
              onChange={(e) => setSettings({ ...settings, followup_days: parseInt(e.target.value) || 7 })}
              placeholder="7"
            />
            <p className="text-xs text-muted-foreground mt-1">Angebote werden nach dieser Anzahl Tage zur Wiedervorlage vorgeschlagen.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Automatische Push-Benachrichtigung</label>
            <select
              data-testid="select-followup-push"
              className="w-full border rounded px-3 py-2 text-sm"
              value={settings.followup_push_enabled === false ? "false" : "true"}
              onChange={(e) => setSettings({ ...settings, followup_push_enabled: e.target.value === "true" })}
            >
              <option value="true">Aktiviert</option>
              <option value="false">Deaktiviert</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Push-Nachricht wenn Angebote zur Wiedervorlage fällig sind.</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button data-testid="btn-save-followup" onClick={onSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "..." : "Speichern"}
        </Button>
      </div>
    </Card>
  );
};


// ==================== PUSH NOTIFICATION SETTINGS ====================
const PushNotificationSettings = () => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkPushStatus(); }, []);

  const checkPushStatus = async () => {
    const hasBrowserSupport = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!hasBrowserSupport) { setPushSupported(false); setLoading(false); return; }
    const vapidKey = await ensureVapidKey();
    setPushSupported(!!vapidKey);
    if (vapidKey) {
      try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); setPushEnabled(!!sub); } catch {}
    }
    setLoading(false);
  };

  const togglePush = async () => {
    setLoading(true);
    try {
      if (pushEnabled) { await unsubscribeFromPush(); setPushEnabled(false); toast.success("Push deaktiviert"); }
      else { const sub = await subscribeToPush(); if (sub) { setPushEnabled(true); toast.success("Push aktiviert!"); } else { toast.error("Bitte Benachrichtigungen im Browser erlauben."); } }
    } catch (err) { toast.error("Fehler: " + (err.message || "")); } finally { setLoading(false); }
  };

  return (
    <Card className="p-4 lg:p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Push-Benachrichtigungen</h3>
      <p className="text-sm text-muted-foreground mb-4">Benachrichtigung bei neuen Kundenanfragen.</p>
      {!pushSupported ? (
        <p className="text-sm text-amber-600">Push wird in diesem Browser nicht unterstützt. Nutzen Sie Chrome und installieren Sie die App.</p>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          {pushEnabled ? (
            <>
              <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Aktiv</span>
              <Button variant="outline" size="sm" onClick={async () => { try { await api.post("/push/test"); toast.success("Test-Push gesendet"); } catch {} }} data-testid="btn-test-push">Test senden</Button>
              <Button variant="outline" size="sm" onClick={togglePush} disabled={loading} data-testid="btn-toggle-push"><BellOff className="w-4 h-4" /> Aus</Button>
            </>
          ) : (
            <Button onClick={togglePush} disabled={loading} data-testid="btn-toggle-push"><Bell className="w-4 h-4" /> {loading ? "..." : "Aktivieren"}</Button>
          )}
        </div>
      )}
    </Card>
  );
};


// ==================== BENUTZER TAB ====================
const BenutzerTab = () => {
  const [users, setUsers] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", email: "", role: "mitarbeiter" });
  const [editUser, setEditUser] = useState(null);
  const [editData, setEditData] = useState({ email: "", role: "" });
  const [changePassword, setChangePassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [portals, setPortals] = useState([]);
  const [portalsLoading, setPortalsLoading] = useState(true);
  const [editPerms, setEditPerms] = useState(null);
  const [perms, setPerms] = useState({});
  const [permsSaving, setPermsSaving] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(null); // {action: "perms"|"password"|"delete"|"edit", username: "..."}
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const PERM_LABELS = {
    mitarbeiter_stammdaten: "Stammdaten bearbeiten",
    mitarbeiter_lohn: "Lohn & Gehalt",
    mitarbeiter_urlaub: "Urlaub verwalten",
    mitarbeiter_krankmeldungen: "Krankmeldungen",
    mitarbeiter_dokumente: "Dokumente verwalten",
    mitarbeiter_fortbildungen: "Fortbildungen",
    mitarbeiter_anlegen_loeschen: "Mitarbeiter anlegen/löschen",
  };

  useEffect(() => { loadUsers(); loadPortals(); }, []);

  const loadPortals = async () => {
    try { const res = await api.get("/portals"); setPortals(res.data); } catch {} finally { setPortalsLoading(false); }
  };

  const loadUsers = async () => {
    try { const res = await api.get("/users"); setUsers(res.data); } catch { toast.error("Fehler beim Laden"); }
  };

  const loadPerms = async (username) => {
    try {
      const res = await api.get(`/users/${username}/berechtigungen`);
      setPerms(res.data);
      setEditPerms(username);
    } catch { toast.error("Fehler beim Laden der Berechtigungen"); }
  };

  const verifyAdminPassword = async () => {
    try {
      const res = await api.post("/auth/login", { username: "admin", password: authPassword });
      if (res.data.token) {
        const { action, username } = authPrompt;
        setAuthPrompt(null);
        setAuthPassword("");
        setAuthError("");
        if (action === "perms") loadPerms(username);
        else if (action === "password") { setChangePassword(username); setNewPassword(""); }
        else if (action === "delete") setConfirmDelete(username);
        else if (action === "edit") {
          const user = users.find(u => u.username === username);
          if (user) {
            setEditData({ email: user.email || "", role: user.role || "mitarbeiter" });
            setEditUser(username);
          }
        }
      }
    } catch {
      setAuthError("Falsches Passwort");
    }
  };

  const savePerms = async () => {
    setPermsSaving(true);
    try {
      await api.put(`/users/${editPerms}/berechtigungen`, perms);
      toast.success("Berechtigungen gespeichert");
      setEditPerms(null);
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
    finally { setPermsSaving(false); }
  };

  const handleCreate = async () => {
    if (!newUser.username || !newUser.password) { toast.error("Benutzername und Passwort erforderlich"); return; }
    setSaving(true);
    try {
      await api.post("/users", newUser);
      toast.success("Benutzer erstellt");
      setShowNew(false);
      setNewUser({ username: "", password: "", email: "", role: "mitarbeiter" });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler");
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${editUser}`, editData);
      toast.success("Benutzer aktualisiert");
      setEditUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler");
    } finally { setSaving(false); }
  };

  const handleDelete = async (username) => {
    if (confirmDelete !== username) { setConfirmDelete(username); setTimeout(() => setConfirmDelete(null), 3000); return; }
    try { await api.delete(`/users/${username}`); toast.success("Benutzer gelöscht"); setConfirmDelete(null); loadUsers(); } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error("Mindestens 4 Zeichen"); return; }
    try {
      await api.put(`/users/${changePassword}/password`, { password: newPassword });
      toast.success("Passwort geändert");
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const special = "!@#$%&*";
    let pw = "";
    for (let i = 0; i < 10; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    pw += special.charAt(Math.floor(Math.random() * special.length));
    setNewPassword(pw);
    setShowPassword(true);
  };

  const copyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    toast.success("Passwort kopiert");
  };

  const sendCredentialsEmail = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error("Erst Passwort setzen/generieren"); return; }
    const targetUser = users.find(u => u.username === changePassword);
    if (!targetUser?.email) { toast.error("Keine E-Mail-Adresse beim Benutzer hinterlegt"); return; }
    setSendingEmail(true);
    try {
      await api.put(`/users/${changePassword}/password`, { password: newPassword });
      await api.post(`/users/${changePassword}/send-credentials`, { password: newPassword });
      toast.success(`Zugangsdaten an ${targetUser.email} gesendet`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Senden");
    } finally { setSendingEmail(false); }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="user-management">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Benutzer-Verwaltung</h3>
          <p className="text-sm text-muted-foreground mt-1">Verwalten Sie die Zugänge zur Graupner Suite.</p>
        </div>
        <Button onClick={() => setShowNew(true)} data-testid="btn-add-user"><Plus className="w-4 h-4" /> Neuer Benutzer</Button>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.username} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border" data-testid={`user-${u.username}`}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {u.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{u.username}</p>
              <p className="text-xs text-muted-foreground">{u.email || "Keine E-Mail"} &middot; {u.role || "admin"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAuthPrompt({ action: "edit", username: u.username }); setAuthPassword(""); setAuthError(""); }} data-testid={`btn-edit-${u.username}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setAuthPrompt({ action: "perms", username: u.username }); setAuthPassword(""); setAuthError(""); }} data-testid={`btn-perms-${u.username}`}>
                <Shield className="w-3.5 h-3.5" /> Rechte
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setAuthPrompt({ action: "password", username: u.username }); setAuthPassword(""); setAuthError(""); }} data-testid={`btn-pw-${u.username}`}>
                <Key className="w-3.5 h-3.5" /> Passwort
              </Button>
              <button
                onClick={() => { setAuthPrompt({ action: "delete", username: u.username }); setAuthPassword(""); setAuthError(""); }}
                className="p-2 rounded-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                data-testid={`btn-delete-${u.username}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Keine Benutzer gefunden</p>}
      </div>


      {/* Admin-Passwort Bestätigung */}
      <Modal isOpen={!!authPrompt} onClose={() => setAuthPrompt(null)} title="Admin-Passwort bestätigen">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bitte geben Sie Ihr Admin-Passwort ein um fortzufahren.
          </p>
          <div>
            <Input
              type="password"
              value={authPassword}
              onChange={(e) => { setAuthPassword(e.target.value); setAuthError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && authPassword) verifyAdminPassword(); }}
              placeholder="Admin-Passwort"
              autoFocus
              data-testid="input-auth-password"
            />
            {authError && <p className="text-xs text-red-500 mt-1">{authError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAuthPrompt(null)}>Abbrechen</Button>
            <Button onClick={verifyAdminPassword} disabled={!authPassword} data-testid="btn-auth-confirm">
              Bestätigen
            </Button>
          </div>
        </div>
      </Modal>


      {/* New User Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Neuer Benutzer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Benutzername</label>
            <Input data-testid="input-new-username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="z.B. mueller" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Passwort</label>
            <Input data-testid="input-new-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mindestens 4 Zeichen" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-Mail (optional)</label>
            <Input data-testid="input-new-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="benutzer@firma.de" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rolle</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3" data-testid="select-new-role">
              <option value="admin">Admin</option>
              <option value="buchhaltung">Buchhaltung</option>
              <option value="mitarbeiter">Mitarbeiter</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={saving} data-testid="btn-create-user">{saving ? "..." : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>

      {/* Benutzer bearbeiten Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Benutzer bearbeiten: ${editUser}`}>
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <strong>Hinweis:</strong> Der Benutzername kann nicht geändert werden.
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-Mail</label>
            <Input 
              type="email" 
              value={editData.email} 
              onChange={(e) => setEditData({ ...editData, email: e.target.value })} 
              placeholder="benutzer@firma.de" 
              data-testid="input-edit-email" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rolle</label>
            <select 
              value={editData.role} 
              onChange={(e) => setEditData({ ...editData, role: e.target.value })} 
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
              data-testid="select-edit-role"
            >
              <option value="admin">Admin</option>
              <option value="buchhaltung">Buchhaltung</option>
              <option value="mitarbeiter">Mitarbeiter</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditUser(null)}>Abbrechen</Button>
            <Button onClick={handleEdit} disabled={saving} data-testid="btn-save-edit-user">
              {saving ? "..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>


      {/* Change Password Modal */}
      <Modal isOpen={!!changePassword} onClose={() => { setChangePassword(null); setNewPassword(""); setShowPassword(false); }} title={`Passwort ändern: ${changePassword}`}>
        <div className="space-y-4">
          {(() => { const targetUser = users.find(u => u.username === changePassword); return targetUser?.email ? (
            <p className="text-sm text-muted-foreground">E-Mail: <strong>{targetUser.email}</strong></p>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 rounded p-2">Keine E-Mail hinterlegt – E-Mail-Versand nicht möglich.</p>
          ); })()}
          <div>
            <label className="block text-sm font-medium mb-1">Neues Passwort</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input data-testid="input-change-password" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mindestens 4 Zeichen" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1" data-testid="btn-toggle-pw-visibility">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={generatePassword} data-testid="btn-generate-pw" title="Zufallspasswort generieren">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={copyPassword} disabled={!newPassword} data-testid="btn-copy-pw" title="Passwort kopieren">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {newPassword && showPassword && (
            <div className="bg-muted/50 border rounded p-3 font-mono text-sm tracking-wider text-center select-all" data-testid="pw-display">
              {newPassword}
            </div>
          )}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => { setChangePassword(null); setNewPassword(""); setShowPassword(false); }}>Abbrechen</Button>
              <Button onClick={handlePasswordChange} disabled={!newPassword || newPassword.length < 4} data-testid="btn-change-password">Passwort speichern</Button>
            </div>
            {(() => { const targetUser = users.find(u => u.username === changePassword); return targetUser?.email ? (
              <Button variant="secondary" className="w-full" onClick={sendCredentialsEmail} disabled={sendingEmail || !newPassword || newPassword.length < 4} data-testid="btn-send-credentials">
                <Mail className="w-4 h-4 mr-2" />
                {sendingEmail ? "Wird gesendet..." : `Zugangsdaten an ${targetUser.email} senden`}
              </Button>
            ) : null; })()}
          </div>
        </div>
      </Modal>

      {/* Berechtigungen Modal */}
      <Modal isOpen={!!editPerms} onClose={() => setEditPerms(null)} title={`Berechtigungen: ${editPerms}`}>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground mb-4">Welche Mitarbeiter-Bereiche darf <strong>{editPerms}</strong> bearbeiten?</p>
          {Object.entries(PERM_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors" data-testid={`perm-${key}`}>
              <input
                type="checkbox"
                checked={perms[key] || false}
                onChange={(e) => setPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                className="rounded w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <button onClick={() => { const all = {}; Object.keys(PERM_LABELS).forEach(k => all[k] = true); setPerms(all); }} className="text-xs text-primary hover:underline" data-testid="btn-select-all-perms">Alle auswählen</button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditPerms(null)}>Abbrechen</Button>
              <Button onClick={savePerms} disabled={permsSaving} data-testid="btn-save-perms">
                <Save className="w-4 h-4 mr-1" /> {permsSaving ? "..." : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Portal-Passwörter */}
      <Card className="p-4 lg:p-6 mt-6" data-testid="portal-passwords-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Kundenportal-Passwörter
          </h3>
          <Button
            variant="outline"
            size="sm"
            disabled={portals.length === 0}
            onClick={() => {
              const lines = ["KUNDENPORTAL - PASSWORTLISTE", "=============================", `Erstellt: ${new Date().toLocaleDateString("de-DE")}`, ""];
              portals.forEach(p => {
                lines.push(`Kunde:    ${p.customer_name || "-"}`);
                lines.push(`E-Mail:   ${p.customer_email || "-"}`);
                lines.push(`Passwort: ${p.password_plain || "?"}`);
                lines.push(`Status:   ${p.active ? "Aktiv" : "Deaktiviert"}`);
                lines.push(`Gültig:   ${p.expires_at ? new Date(p.expires_at).toLocaleDateString("de-DE") : "-"}`);
                lines.push(`Link:     ${window.location.origin}/portal/${p.token}`);
                lines.push("-----------------------------");
                lines.push("");
              });
              const blob = new Blob([lines.join("\n")], { type: "text/plain" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `Kundenportal_Passwoerter_${new Date().toISOString().slice(0,10)}.txt`;
              a.click();
              URL.revokeObjectURL(a.href);
              toast.success("Passwort-Datei heruntergeladen");
            }}
            data-testid="btn-download-passwords-settings"
          >
            <Save className="w-4 h-4" /> Als Datei speichern
          </Button>
        </div>
        {portalsLoading ? (
          <div className="flex items-center justify-center h-16"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>
        ) : portals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Kundenportale vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Kunde</th>
                  <th className="pb-2 font-medium">E-Mail</th>
                  <th className="pb-2 font-medium">Passwort</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Gültig bis</th>
                </tr>
              </thead>
              <tbody>
                {portals.map(p => (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="py-2 pr-3">{p.customer_name || "-"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.customer_email || "-"}</td>
                    <td className="py-2 pr-3 font-mono text-xs bg-muted/50 px-2 rounded">{p.password_plain || "?"}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {p.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{p.expires_at ? new Date(p.expires_at).toLocaleDateString("de-DE") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Card>
  );
};


// ==================== DOKUMENT-VORLAGEN TAB ====================
const DokumentVorlagenTab = ({ settings, setSettings, onSave, saving }) => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("allgemein");

  const CATEGORIES = [
    { id: "logo", label: "Logo", icon: "🎨" },
    { id: "briefkopf", label: "Briefkopf", icon: "📄" },
    { id: "agb", label: "AGB / Rechtliches", icon: "⚖️" },
    { id: "anhaenge", label: "E-Mail Anhänge", icon: "📎" },
    { id: "allgemein", label: "Allgemein", icon: "📁" },
  ];

  useEffect(() => {
    loadDocuments();
  }, [selectedCategory]);

  const loadDocuments = async () => {
    try {
      const res = await api.get("/settings/documents", { params: { category: selectedCategory } });
      setDocuments(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Dokumente");
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const handleFileInput = async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (files) => {
    setUploading(true);
    let uploaded = 0;
    
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`${file.name} ist keine PDF-Datei`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", selectedCategory);
        
        await api.post("/settings/documents/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        uploaded++;
      } catch (err) {
        toast.error(`Fehler beim Hochladen von ${file.name}`);
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} Dokument(e) hochgeladen`);
      loadDocuments();
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Dokument wirklich löschen?")) return;
    
    try {
      await api.delete(`/settings/documents/${id}`);
      toast.success("Dokument gelöscht");
      loadDocuments();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-4">
      {/* PDF-Layout Einstellungen */}
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" /> PDF-Layout Einstellungen
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Gestalten Sie das Aussehen Ihrer Angebote, Aufträge und Rechnungen.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kopfzeile (wird oben auf jeder Seite angezeigt)</label>
            <Textarea data-testid="input-pdf-header" value={settings.pdf_header_text} onChange={(e) => setSettings({ ...settings, pdf_header_text: e.target.value })} placeholder={"z.B. Tischlerei Graupner - Ihr Partner für Fenster & Türen"} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fußzeile (wird unten auf jeder Seite angezeigt)</label>
            <Textarea data-testid="input-pdf-footer" value={settings.pdf_footer_text} onChange={(e) => setSettings({ ...settings, pdf_footer_text: e.target.value })} placeholder={"z.B. Tischlerei Graupner | Erlenweg 129 | 22453 Hamburg | Tel: 040 555 677 44"} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Standard-Bemerkung (wird in neue Dokumente eingefügt)</label>
            <Textarea data-testid="input-pdf-bemerkung" value={settings.pdf_bemerkung_default} onChange={(e) => setSettings({ ...settings, pdf_bemerkung_default: e.target.value })} placeholder={"z.B. Zahlbar innerhalb von 14 Tagen ohne Abzug."} rows={3} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Akzentfarbe</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={settings.pdf_accent_color} onChange={(e) => setSettings({ ...settings, pdf_accent_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" data-testid="input-pdf-color" />
                <Input value={settings.pdf_accent_color} onChange={(e) => setSettings({ ...settings, pdf_accent_color: e.target.value })} className="flex-1" placeholder="#1a1a2e" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Schriftgröße</label>
              <select data-testid="select-pdf-font" value={settings.pdf_font_size} onChange={(e) => setSettings({ ...settings, pdf_font_size: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
                <option value="small">Klein (9pt)</option>
                <option value="normal">Normal (10pt)</option>
                <option value="large">Groß (11pt)</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.pdf_show_logo} onChange={(e) => setSettings({ ...settings, pdf_show_logo: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Logo im PDF anzeigen</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <Button data-testid="btn-save-pdf-settings" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? "..." : "Speichern"}
          </Button>
        </div>
      </Card>

      {/* PDF Dokument-Manager */}
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" /> PDF Dokument-Manager
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Laden Sie PDFs hoch: Logo, Briefkopf, AGB, E-Mail-Anhänge oder allgemeine Dokumente.
        </p>

        {/* Kategorien */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/20 hover:border-primary/50"
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm font-medium mb-2">
            {dragActive ? "PDF hier ablegen..." : "PDFs hierher ziehen oder klicken"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">Nur PDF-Dateien, max. 10 MB</p>
          <label className="inline-block">
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
              disabled={uploading}
            />
            <Button variant="outline" disabled={uploading} as="span">
              {uploading ? "Hochladen..." : "Dateien auswählen"}
            </Button>
          </label>
        </div>

        {/* Dokument-Liste */}
        {documents.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-sm font-semibold mb-3">
              Hochgeladene Dokumente ({documents.length})
            </h4>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.size)} · {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/settings/documents/${doc.id}/download`, '_blank')}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(doc.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {documents.length === 0 && !uploading && (
          <div className="mt-6 text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Keine Dokumente in dieser Kategorie</p>
          </div>
        )}
      </Card>
    </div>
  );
};


// ==================== EINSATZPLANUNG TAB ====================
const EinsatzplanungTab = () => {
  const [config, setConfig] = useState({ monteure: [], reparaturgruppen: [], materialien: [], anfrage_schritte: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/einsatz-config").then(res => {
      setConfig(res.data);
    }).catch(() => toast.error("Fehler beim Laden der Einsatz-Konfiguration")).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/einsatz-config", {
        monteure: config.monteure,
        reparaturgruppen: config.reparaturgruppen,
        materialien: config.materialien,
        anfrage_schritte: config.anfrage_schritte,
      });
      toast.success("Einsatzplanung-Konfiguration gespeichert");
    } catch { toast.error("Fehler beim Speichern"); } finally { setSaving(false); }
  };

  const updateList = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value.split("\n").map(s => s.trim()).filter(Boolean) }));
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const sections = [
    { key: "anfrage_schritte", label: "Anfrage-Schritte", icon: FileText, placeholder: "1) Besichtig. Terminieren\n1) Bild+Bes.Term. fordern\n2.05) Geschätzt p. Mail\n5.00) Angebot schreiben\n6.00) Auftragsbestätigung\n6.06) Rechnung schreiben", rows: 8 },
    { key: "reparaturgruppen", label: "Reparaturgruppen", icon: Wrench, placeholder: "Fenster\nTüren\nDach\nSchiebetür", rows: 5 },
    { key: "monteure", label: "Monteure", icon: User, placeholder: "Ralph Graupner\nMax Mustermann", rows: 4 },
    { key: "materialien", label: "Materialien", icon: Package, placeholder: "Holz\nGlas\nDichtung", rows: 4 },
  ];

  return (
    <div className="space-y-4" data-testid="einsatzplanung-settings">
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" /> Einsatzplanung-Konfiguration
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Konfigurieren Sie die Auswahlfelder für die Einsatzplanung und Anfragen. Ein Eintrag pro Zeile.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map(({ key, label, icon: Icon, placeholder, rows }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Icon className="w-4 h-4 text-muted-foreground" /> {label}
              </label>
              <textarea
                value={(config[key] || []).join("\n")}
                onChange={(e) => updateList(key, e.target.value)}
                className="w-full border rounded-sm p-2 text-sm resize-none font-mono bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={placeholder}
                rows={rows}
                data-testid={`config-${key}`}
              />
              <p className="text-xs text-muted-foreground mt-1">{(config[key] || []).length} Einträge</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-einsatz-config">
            <Save className="w-4 h-4" />
            {saving ? "Speichere..." : "Konfiguration speichern"}
          </Button>
        </div>
      </Card>
    </div>
  );
};


// ==================== DIVERSES / INFO TAB ====================
const TYPEN = [
  { value: "notiz", label: "Notiz", icon: FileText, color: "bg-blue-100 text-blue-700" },
  { value: "anweisung", label: "Anweisung", icon: AlertTriangle, color: "bg-amber-100 text-amber-700" },
  { value: "hinweis", label: "Hinweis", icon: Star, color: "bg-green-100 text-green-700" },
  { value: "beschreibung", label: "Beschreibung", icon: BookOpen, color: "bg-purple-100 text-purple-700" },
  { value: "link", label: "Link", icon: Link2, color: "bg-cyan-100 text-cyan-700" },
];

const DEFAULT_KATEGORIEN = ["Allgemein", "Anweisungen", "Hinweise", "Programmbeschreibung", "Links"];

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


// ==================== MAIN SETTINGS PAGE ====================
const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("firma");
  const [settings, setSettings] = useState({
    company_name: "", owner_name: "", address: "", phone: "", email: "",
    tax_id: "", bank_name: "", iban: "", bic: "",
    default_vat_rate: 19, is_small_business: false,
    km_rate: 0.30, hourly_travel_rate: 45.0,
    company_address: "", default_due_days: 14, default_quote_validity_days: 30,
    email_signature: "",
    smtp_server: "", smtp_port: 465, smtp_user: "", smtp_password: "", smtp_from: "",
    imap_server: "", imap_port: 993, imap_user: "", imap_password: "", imap_folder: "INBOX", imap_enabled: false,
    pdf_header_text: "", pdf_footer_text: "", pdf_show_logo: true,
    pdf_accent_color: "#1a1a2e", pdf_font_size: "normal", pdf_bemerkung_default: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


// ==================== BACKUP TAB ====================
const BackupTab = () => {
  const [collections, setCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState("merge");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadCollections();
    loadStats();
  }, []);

  const loadCollections = async () => {
    try {
      const res = await api.get("/backup/collections");
      setCollections(res.data);
      // Alle standardmäßig auswählen
      setSelectedCollections(new Set(res.data.map(c => c.id)));
    } catch (error) {
      toast.error("Fehler beim Laden der Collections");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get("/backup/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Stats loading failed", error);
    }
  };

  const toggleCollection = (id) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCollections(newSelected);
  };

  const toggleAll = () => {
    if (selectedCollections.size === collections.length) {
      setSelectedCollections(new Set());
    } else {
      setSelectedCollections(new Set(collections.map(c => c.id)));
    }
  };

  const handleExport = async () => {
    if (selectedCollections.size === 0) {
      toast.error("Bitte mindestens eine Collection auswählen");
      return;
    }

    setExporting(true);
    try {
      const collectionsList = Array.from(selectedCollections).join(',');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/backup/export?collections=${collectionsList}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) throw new Error('Export fehlgeschlagen');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'backup.zip';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Backup erfolgreich heruntergeladen");
    } catch (error) {
      toast.error("Fehler beim Export: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Nur ZIP-Dateien erlaubt");
      return;
    }

    const confirmed = window.confirm(
      importMode === "replace" 
        ? "ACHTUNG: Alle bestehenden Daten werden GELÖSCHT und durch das Backup ersetzt! Fortfahren?" 
        : "Die Daten aus dem Backup werden mit den bestehenden Daten zusammengeführt. Fortfahren?"
    );

    if (!confirmed) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', importMode);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/backup/import?mode=${importMode}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Import fehlgeschlagen');
      }

      const result = await res.json();
      toast.success(`Backup erfolgreich importiert: ${result.total_documents} Einträge in ${result.collections.length} Collections`);
      
      // Reload stats and collections
      loadCollections();
      loadStats();
    } catch (error) {
      toast.error("Fehler beim Import: " + error.message);
    } finally {
      setImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <div className="flex gap-4">
          <Database className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Backup & Wiederherstellung</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Sichern Sie alle wichtigen Daten der Graupner Suite auf Ihren Rechner.
              Bei Bedarf können Sie die Daten jederzeit wiederherstellen.
            </p>
            {stats && (
              <div className="flex gap-4 text-sm mt-3">
                <span className="font-medium">📊 {stats.total_documents} Einträge gesamt</span>
                <span className="text-muted-foreground">≈ {stats.estimated_size_mb} MB</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Export Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Backup erstellen</h3>
          </div>
          <Button
            onClick={toggleAll}
            variant="outline"
            size="sm"
          >
            {selectedCollections.size === collections.length ? "Alle abwählen" : "Alle auswählen"}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Wählen Sie aus, welche Daten gesichert werden sollen:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {collections.map((coll) => (
            <label
              key={coll.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedCollections.has(coll.id)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedCollections.has(coll.id)}
                onChange={() => toggleCollection(coll.id)}
                className="w-4 h-4 rounded accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{coll.icon}</span>
                  <span className="font-medium text-sm truncate">{coll.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{coll.count} Einträge</span>
              </div>
            </label>
          ))}
        </div>

        <Button
          onClick={handleExport}
          disabled={exporting || selectedCollections.size === 0}
          className="w-full"
          size="lg"
        >
          {exporting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Backup wird erstellt...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Backup herunterladen ({selectedCollections.size} ausgewählt)
            </>
          )}
        </Button>
      </Card>

      {/* Import Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Backup wiederherstellen</h3>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Wichtiger Hinweis</p>
              <p className="text-amber-800 dark:text-amber-200">
                Beim Import im <strong>"Ersetzen"</strong>-Modus werden alle bestehenden Daten gelöscht!
                Im <strong>"Zusammenführen"</strong>-Modus werden Daten ergänzt.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Import-Modus</label>
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              importMode === "merge" ? "border-primary bg-primary/5" : "border-border"
            }`}>
              <input
                type="radio"
                name="importMode"
                value="merge"
                checked={importMode === "merge"}
                onChange={(e) => setImportMode(e.target.value)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <div className="font-medium text-sm">Zusammenführen</div>
                <div className="text-xs text-muted-foreground">Daten ergänzen</div>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              importMode === "replace" ? "border-destructive bg-destructive/5" : "border-border"
            }`}>
              <input
                type="radio"
                name="importMode"
                value="replace"
                checked={importMode === "replace"}
                onChange={(e) => setImportMode(e.target.value)}
                className="w-4 h-4 accent-destructive"
              />
              <div>
                <div className="font-medium text-sm text-destructive">Ersetzen</div>
                <div className="text-xs text-muted-foreground">Alles löschen</div>
              </div>
            </label>
          </div>
        </div>

        <input
          type="file"
          accept=".zip"
          onChange={handleImport}
          disabled={importing}
          className="hidden"
          id="backup-upload"
        />
        <label htmlFor="backup-upload">
          <Button
            as="span"
            variant="outline"
            disabled={importing}
            className="w-full cursor-pointer"
            size="lg"
          >
            {importing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Wird importiert...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Backup-Datei auswählen (.zip)
              </>
            )}
          </Button>
        </label>
      </Card>

      {/* Future: Auto-Backup */}
      <Card className="p-6 opacity-60">
        <div className="flex items-center gap-3 mb-3">
          <HardDrive className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-muted-foreground">Automatisches Backup (Demnächst)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Automatische Backups auf Ihren eigenen Server werden in einer zukünftigen Version verfügbar sein.
        </p>
      </Card>
    </div>
  );
};

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings((prev) => ({ ...prev, ...res.data }));
    } catch { toast.error("Fehler beim Laden"); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try { await api.put("/settings", settings); toast.success("Einstellungen gespeichert"); }
    catch { toast.error("Fehler beim Speichern"); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div data-testid="settings-page">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-4xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-1 text-sm">Konfiguration der Graupner Suite</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto pb-px" data-testid="settings-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
            data-testid={`settings-tab-${id}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "firma" && <FirmendatenTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "kalkulation" && <KalkulationTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "textbausteine" && <TextbausteineTab />}
      {activeTab === "einsatzplanung" && <EinsatzplanungTab />}
      {activeTab === "email" && <EmailTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "benutzer" && <BenutzerTab />}
      {activeTab === "dokumente" && <DokumentVorlagenTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "diverses" && <DiversesTab />}
      {activeTab === "backup" && <BackupTab />}
    </div>
  );
};

export { SettingsPage };
