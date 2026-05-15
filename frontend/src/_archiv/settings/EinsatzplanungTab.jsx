import { useState, useEffect } from "react";
import { Mail, Save, FileText, Wrench, User, Package } from "lucide-react";
import { toast } from "sonner";
import { Button, Card } from "@/components/common";
import { api } from "@/lib/api";

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



export { EinsatzplanungTab };
