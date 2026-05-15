import { Calculator, Save } from "lucide-react";
import { Button, Input, Card } from "@/components/common";

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



export { KalkulationTab };
