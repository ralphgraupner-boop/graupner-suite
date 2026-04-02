import { useState, useEffect } from "react";
import { Mail, CheckCircle, Save, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card } from "@/components/common";
import { api, API } from "@/lib/api";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push";

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
    </div>
  );
};


export { SettingsPage };
