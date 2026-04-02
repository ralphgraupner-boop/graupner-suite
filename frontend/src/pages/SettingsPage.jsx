import { useState, useEffect } from "react";
import { Mail, CheckCircle, Save, Bell, BellOff, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api, API } from "@/lib/api";
import { subscribeToPush, unsubscribeFromPush, ensureVapidKey } from "@/lib/push";
import { PLACEHOLDERS } from "@/components/TextTemplateSelect";

// ==================== PUSH NOTIFICATION SETTINGS ====================
const PushNotificationSettings = () => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    const hasBrowserSupport = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!hasBrowserSupport) {
      setPushSupported(false);
      setLoading(false);
      return;
    }
    const vapidKey = await ensureVapidKey();
    setPushSupported(!!vapidKey);
    if (vapidKey) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      } catch (e) {}
    }
    setLoading(false);
  };

  const togglePush = async () => {
    setLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast.success("Push-Benachrichtigungen deaktiviert");
      } else {
        const sub = await subscribeToPush();
        if (sub) {
          setPushEnabled(true);
          toast.success("Push-Benachrichtigungen aktiviert!");
        } else {
          toast.error("Bitte erlauben Sie Benachrichtigungen in Ihren Browser-Einstellungen.");
        }
      }
    } catch (err) {
      toast.error("Fehler: " + (err.message || "Unbekannter Fehler"));
    } finally {
      setLoading(false);
    }
  };

  const sendTestPush = async () => {
    try {
      const res = await api.post("/push/test");
      if (res.data.success) {
        toast.success(`Push gesendet an ${res.data.subscribers} Gerät(e). Warten Sie 5 Sekunden...`);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error("Fehler: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <Card className="p-4 lg:p-6 mt-6">
      <h3 className="text-base lg:text-lg font-semibold mb-4 flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        Push-Benachrichtigungen
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Erhalten Sie sofort eine Benachrichtigung auf Ihr Gerät, wenn eine neue Kundenanfrage über das Kontaktformular eingeht.
      </p>
      {!pushSupported ? (
        <div className="space-y-3">
          <p className="text-sm text-amber-600 font-medium">
            Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm space-y-2">
            <p className="font-medium text-amber-800">So aktivieren Sie Push-Benachrichtigungen:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-amber-700">
              <li>Öffnen Sie <strong>Google Chrome</strong> auf Ihrem Handy</li>
              <li>Gehen Sie zu dieser Seite: <code className="bg-amber-100 px-1 rounded text-xs break-all">{window.location.origin}</code></li>
              <li>Tippen Sie auf das <strong>3-Punkte-Menü</strong> (oben rechts)</li>
              <li>Wählen Sie <strong>"Zum Startbildschirm hinzufügen"</strong> oder <strong>"App installieren"</strong></li>
              <li>Öffnen Sie die App über das neue Icon auf Ihrem Homescreen</li>
              <li>Gehen Sie zu Einstellungen → Push-Benachrichtigungen → <strong>Aktivieren</strong></li>
            </ol>
            <p className="text-xs text-amber-600 mt-2">Hinweis: Samsung Internet unterstützt keine Web Push. Google Chrome ist empfohlen.</p>
          </div>
        </div>
      ) : (
        <div key="push-controls">
          <div className="flex items-center gap-3 flex-wrap">
            {pushEnabled ? (
              <div className="flex items-center gap-3 flex-wrap" key="enabled">
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Aktiv
                </span>
                <Button variant="outline" size="sm" onClick={sendTestPush} data-testid="btn-test-push">
                  Test senden
                </Button>
                <Button variant="outline" size="sm" onClick={togglePush} disabled={loading} data-testid="btn-toggle-push">
                  <BellOff className="w-4 h-4" />
                  {loading ? "..." : "Aus"}
                </Button>
              </div>
            ) : (
              <div key="disabled">
                <Button onClick={togglePush} disabled={loading} data-testid="btn-toggle-push">
                  <Bell className="w-4 h-4" />
                  {loading ? "..." : "Aktivieren"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

// ==================== TEXT TEMPLATE MANAGEMENT ====================
const DOC_TYPE_LABELS = { angebot: "Angebot", auftrag: "Auftragsbestätigung", rechnung: "Rechnung" };
const TEXT_TYPE_LABELS = { vortext: "Vortext", schlusstext: "Schlusstext" };

const TextTemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [activeDocType, setActiveDocType] = useState("angebot");
  const [editTemplate, setEditTemplate] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", text_type: "vortext", doc_type: "angebot" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.get("/text-templates");
      setTemplates(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Textbausteine");
    }
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
    if (!form.title.trim() || !form.content.trim()) { toast.error("Titel und Inhalt erforderlich"); return; }
    setSaving(true);
    try {
      if (editTemplate === "new") {
        await api.post("/text-templates", form);
        toast.success("Textbaustein erstellt");
      } else {
        await api.put(`/text-templates/${editTemplate}`, form);
        toast.success("Textbaustein aktualisiert");
      }
      setEditTemplate(null);
      loadTemplates();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/text-templates/${id}`);
      toast.success("Textbaustein gelöscht");
      setConfirmDeleteId(null);
      loadTemplates();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const filtered = templates.filter((t) => t.doc_type === activeDocType);
  const vortexte = filtered.filter((t) => t.text_type === "vortext");
  const schlusstexte = filtered.filter((t) => t.text_type === "schlusstext");

  return (
    <Card className="p-4 lg:p-6 mt-6" data-testid="text-template-management">
      <h3 className="text-base lg:text-lg font-semibold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        Textbausteine (Vortext / Schlusstext)
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Erstellen Sie vorgefertigte Texte mit Platzhaltern. Verfügbare Aliase:
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {PLACEHOLDERS.map((p) => (
          <span key={p.alias} className="text-xs bg-muted px-2 py-1 rounded font-mono" title={p.desc}>
            {p.alias} = {p.desc}
          </span>
        ))}
      </div>

      {/* Doc Type Tabs */}
      <div className="flex gap-2 mb-4 border-b" data-testid="template-doc-type-tabs">
        {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveDocType(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              activeDocType === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Vortext Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Vortexte</h4>
          <Button variant="outline" size="sm" onClick={() => openNew(activeDocType, "vortext")} data-testid="btn-add-vortext">
            <Plus className="w-3 h-3" /> Vortext
          </Button>
        </div>
        {vortexte.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Noch keine Vortexte für {DOC_TYPE_LABELS[activeDocType]}</p>
        ) : (
          <div className="space-y-2">
            {vortexte.map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-sm border" data-testid={`template-${t.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{t.content}</p>
                </div>
                <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-muted rounded-sm shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className={`p-1.5 rounded-sm shrink-0 transition-colors ${confirmDeleteId === t.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                >
                  {confirmDeleteId === t.id ? <span className="text-[10px] font-bold">OK?</span> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schlusstext Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Schlusstexte</h4>
          <Button variant="outline" size="sm" onClick={() => openNew(activeDocType, "schlusstext")} data-testid="btn-add-schlusstext">
            <Plus className="w-3 h-3" /> Schlusstext
          </Button>
        </div>
        {schlusstexte.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Noch keine Schlusstexte für {DOC_TYPE_LABELS[activeDocType]}</p>
        ) : (
          <div className="space-y-2">
            {schlusstexte.map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-sm border" data-testid={`template-${t.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{t.content}</p>
                </div>
                <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-muted rounded-sm shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className={`p-1.5 rounded-sm shrink-0 transition-colors ${confirmDeleteId === t.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                >
                  {confirmDeleteId === t.id ? <span className="text-[10px] font-bold">OK?</span> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <Modal isOpen={!!editTemplate} onClose={() => setEditTemplate(null)} title={editTemplate === "new" ? "Neuer Textbaustein" : "Textbaustein bearbeiten"}>
        <div className="space-y-4" data-testid="template-edit-modal">
          <div>
            <label className="block text-sm font-medium mb-1">Titel</label>
            <Input
              data-testid="template-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="z.B. Standard Angebot Vortext"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Inhalt (Aliase verwenden!)</label>
            <Textarea
              data-testid="template-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Sehr geehrte/r {kunde_name},&#10;&#10;vielen Dank für Ihre Anfrage..."
              rows={6}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.alias}
                  type="button"
                  onClick={() => setForm({ ...form, content: form.content + p.alias })}
                  className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors font-mono"
                  title={`${p.desc} einfügen`}
                >
                  {p.alias}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-template">
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};


const SettingsPage = () => {
  const [settings, setSettings] = useState({
    company_name: "",
    owner_name: "",
    address: "",
    phone: "",
    email: "",
    tax_id: "",
    bank_name: "",
    iban: "",
    bic: "",
    default_vat_rate: 19,
    is_small_business: false,
    km_rate: 0.30,
    hourly_travel_rate: 45.0,
    company_address: "",
    default_due_days: 14,
    default_quote_validity_days: 30,
    email_signature: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Einstellungen");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast.success("Einstellungen gespeichert");
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="settings-page">
      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-1 text-sm lg:text-base">Firmendaten und Konfiguration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">Firmendaten</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Firmenname</label>
              <Input
                data-testid="input-company-name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="Tischlerei Graupner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Inhaber</label>
              <Input
                data-testid="input-owner-name"
                value={settings.owner_name}
                onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })}
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Adresse</label>
              <Textarea
                data-testid="input-company-address"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Musterstraße 1&#10;12345 Musterstadt"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Telefon</label>
                <Input
                  data-testid="input-company-phone"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="01234 567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">E-Mail</label>
                <Input
                  data-testid="input-company-email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@tischlerei.de"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Steuernummer</label>
              <Input
                data-testid="input-tax-id"
                value={settings.tax_id}
                onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
                placeholder="123/456/78901"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Bankverbindung</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bank</label>
              <Input
                data-testid="input-bank-name"
                value={settings.bank_name}
                onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                placeholder="Sparkasse Musterstadt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">IBAN</label>
              <Input
                data-testid="input-iban"
                value={settings.iban}
                onChange={(e) => setSettings({ ...settings, iban: e.target.value })}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">BIC</label>
              <Input
                data-testid="input-bic"
                value={settings.bic}
                onChange={(e) => setSettings({ ...settings, bic: e.target.value })}
                placeholder="COBADEFFXXX"
              />
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-8 mb-4">Steuer</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Standard MwSt-Satz</label>
              <select
                data-testid="select-default-vat"
                value={settings.default_vat_rate}
                onChange={(e) => setSettings({ ...settings, default_vat_rate: parseFloat(e.target.value) })}
                className="w-full h-10 rounded-sm border border-input bg-background px-3"
              >
                <option value={19}>19%</option>
                <option value={7}>7%</option>
                <option value={0}>0% (Kleinunternehmer)</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="small-business"
                checked={settings.is_small_business}
                onChange={(e) => setSettings({ ...settings, is_small_business: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="small-business" className="text-sm">
                Kleinunternehmerregelung (§19 UStG)
              </label>
            </div>
          </div>
        </Card>
      </div>

      {/* Fahrtkosten & Zahlungsziele */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mt-6">
        <Card className="p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">Fahrtkosten</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Firmenstandort (für Entfernungsberechnung)</label>
              <Input
                data-testid="input-company-address-calc"
                value={settings.company_address}
                onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                placeholder="z.B. Musterstraße 1, 12345 Musterstadt"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">km-Satz (€)</label>
                <Input
                  data-testid="input-km-rate"
                  type="number"
                  step="0.01"
                  value={settings.km_rate}
                  onChange={(e) => setSettings({ ...settings, km_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Stundensatz Fahrt (€)</label>
                <Input
                  data-testid="input-hourly-travel"
                  type="number"
                  step="0.5"
                  value={settings.hourly_travel_rate}
                  onChange={(e) => setSettings({ ...settings, hourly_travel_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">Zahlungsziele & Standards</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Zahlungsziel (Tage)</label>
                <Input
                  data-testid="input-due-days"
                  type="number"
                  value={settings.default_due_days}
                  onChange={(e) => setSettings({ ...settings, default_due_days: parseInt(e.target.value) || 14 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Angebots-Gültigkeit (Tage)</label>
                <Input
                  data-testid="input-quote-validity"
                  type="number"
                  value={settings.default_quote_validity_days}
                  onChange={(e) => setSettings({ ...settings, default_quote_validity_days: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">E-Mail-Signatur</label>
              <Textarea
                data-testid="input-email-signature"
                value={settings.email_signature}
                onChange={(e) => setSettings({ ...settings, email_signature: e.target.value })}
                placeholder="Mit freundlichen Grüßen&#10;Tischlerei Graupner"
                rows={3}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button data-testid="btn-save-settings" onClick={handleSave} disabled={saving}>
          <Save className="w-5 h-5" />
          {saving ? "Speichern..." : "Einstellungen speichern"}
        </Button>
      </div>

      {/* Push Notifications Section */}
      <PushNotificationSettings />

      {/* Textbausteine Section */}
      <TextTemplateManagement />
    </div>
  );
};


export { SettingsPage };
