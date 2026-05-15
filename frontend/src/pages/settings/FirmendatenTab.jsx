import { Mail, Save } from "lucide-react";
import { Button, Input, Textarea, Card } from "@/components/common";

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

export { FirmendatenTab };
