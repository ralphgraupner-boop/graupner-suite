import { useState, useEffect } from "react";
import { Mail, Save, Bell, BellOff, Plus, Pencil, Trash2, FileText, Building2, Users, Palette, CheckCircle, Key, Send, TestTube, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { subscribeToPush, unsubscribeFromPush, ensureVapidKey } from "@/lib/push";
import { PLACEHOLDERS } from "@/components/TextTemplateSelect";

// ==================== TAB CONFIG ====================
const TABS = [
  { id: "firma", label: "Firmendaten", icon: Building2 },
  { id: "textbausteine", label: "Textbausteine", icon: FileText },
  { id: "email", label: "E-Mail", icon: Mail },
  { id: "benutzer", label: "Benutzer", icon: Users },
  { id: "dokumente", label: "Dokument-Vorlagen", icon: Palette },
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


// ==================== EMAIL TAB ====================
const EmailTab = ({ settings, setSettings, onSave, saving }) => {
  const [testing, setTesting] = useState(false);

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
              value={settings.followup_push_enabled !== false ? "true" : "false"}
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
  const [changePassword, setChangePassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try { const res = await api.get("/users"); setUsers(res.data); } catch { toast.error("Fehler beim Laden"); }
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

  const handleDelete = async (username) => {
    if (confirmDelete !== username) { setConfirmDelete(username); setTimeout(() => setConfirmDelete(null), 3000); return; }
    try { await api.delete(`/users/${username}`); toast.success("Benutzer gelöscht"); setConfirmDelete(null); loadUsers(); } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error("Mindestens 4 Zeichen"); return; }
    try {
      await api.put(`/users/${changePassword}/password`, { password: newPassword });
      toast.success("Passwort geändert");
      setChangePassword(null);
      setNewPassword("");
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
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
              <Button variant="outline" size="sm" onClick={() => { setChangePassword(u.username); setNewPassword(""); }} data-testid={`btn-pw-${u.username}`}>
                <Key className="w-3.5 h-3.5" /> Passwort
              </Button>
              <button
                onClick={() => handleDelete(u.username)}
                className={`p-2 rounded-sm transition-colors ${confirmDelete === u.username ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                data-testid={`btn-delete-${u.username}`}
              >
                {confirmDelete === u.username ? <span className="text-xs font-bold px-1">OK?</span> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Keine Benutzer gefunden</p>}
      </div>

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
              <option value="mitarbeiter">Mitarbeiter</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={saving} data-testid="btn-create-user">{saving ? "..." : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={!!changePassword} onClose={() => setChangePassword(null)} title={`Passwort ändern: ${changePassword}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Neues Passwort</label>
            <Input data-testid="input-change-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mindestens 4 Zeichen" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setChangePassword(null)}>Abbrechen</Button>
            <Button onClick={handlePasswordChange} data-testid="btn-change-password">Passwort ändern</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};


// ==================== DOKUMENT-VORLAGEN TAB ====================
const DokumentVorlagenTab = ({ settings, setSettings, onSave, saving }) => (
  <div className="space-y-4">
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
  </div>
);


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
    pdf_header_text: "", pdf_footer_text: "", pdf_show_logo: true,
    pdf_accent_color: "#1a1a2e", pdf_font_size: "normal", pdf_bemerkung_default: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      {activeTab === "textbausteine" && <TextbausteineTab />}
      {activeTab === "email" && <EmailTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "benutzer" && <BenutzerTab />}
      {activeTab === "dokumente" && <DokumentVorlagenTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
    </div>
  );
};

export { SettingsPage };
