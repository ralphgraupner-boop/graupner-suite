import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card } from "@/components/common";
import { api, API } from "@/lib/api";
import { TextTemplateSelect } from "@/components/TextTemplateSelect";

const NewInvoicePage = () => {
  const [customers, setCustomers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState("");
  const [vortext, setVortext] = useState("");
  const [schlusstext, setSchlusstext] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [dueDays, setDueDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersRes, articlesRes, settingsRes] = await Promise.all([
        api.get("/customers"),
        api.get("/articles"),
        api.get("/settings")
      ]);
      setCustomers(customersRes.data);
      setArticles(articlesRes.data);
      setServices(articlesRes.data.filter(a => a.typ === "Leistung" || a.typ === "Fremdleistung"));
      setCompanySettings(settingsRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    }
  };

  const addPosition = () => {
    setPositions([
      ...positions,
      { pos_nr: positions.length + 1, description: "", quantity: 1, unit: "Stück", price_net: 0 }
    ]);
  };

  const updatePosition = (index, field, value) => {
    const updated = [...positions];
    updated[index][field] = value;
    setPositions(updated);
  };

  const removePosition = (index) => {
    const updated = positions.filter((_, i) => i !== index);
    updated.forEach((p, i) => (p.pos_nr = i + 1));
    setPositions(updated);
  };

  const addArticle = (article) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: article.name + (article.description ? ` - ${article.description}` : ""),
        quantity: 1,
        unit: article.unit,
        price_net: article.price_net
      }
    ]);
  };

  const addService = (service) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: service.name + (service.description ? ` - ${service.description}` : ""),
        quantity: 1,
        unit: service.unit,
        price_net: service.price_net
      }
    ]);
  };

  const calculateTotals = () => {
    const subtotal = positions.reduce((sum, p) => sum + p.quantity * p.price_net, 0);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    return { subtotal, vat, total };
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error("Bitte wählen Sie einen Kunden aus");
      return;
    }
    if (positions.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setLoading(true);
    try {
      await api.post("/invoices", {
        customer_id: selectedCustomer,
        positions,
        notes,
        vortext,
        schlusstext,
        vat_rate: vatRate,
        due_days: dueDays
      });
      toast.success("Rechnung erstellt!");
      navigate("/invoices");
    } catch (err) {
      toast.error("Fehler beim Erstellen der Rechnung");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vat, total } = calculateTotals();

  return (
    <div data-testid="new-invoice-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Neue Rechnung</h1>
        <p className="text-muted-foreground mt-2">Erstellen Sie eine Rechnung für Ihren Kunden</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Kunde</h3>
            <select
              data-testid="select-invoice-customer"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="">Kunde auswählen...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Card>

          {/* Vortext */}
          <Card className="p-6">
            <TextTemplateSelect
              docType="rechnung"
              textType="vortext"
              value={vortext}
              onChange={setVortext}
              customer={customers.find((c) => c.id === selectedCustomer)}
              settings={companySettings}
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Positionen</h3>
              <div className="flex gap-2 flex-wrap">
                {services.length > 0 && (
                  <select
                    onChange={(e) => {
                      const service = services.find((s) => s.id === e.target.value);
                      if (service) addService(service);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Leistung hinzufügen...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - {s.price_net.toFixed(2)}€/{s.unit}
                      </option>
                    ))}
                  </select>
                )}
                {articles.length > 0 && (
                  <select
                    onChange={(e) => {
                      const article = articles.find((a) => a.id === e.target.value);
                      if (article) addArticle(article);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Artikel hinzufügen...</option>
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} - {a.price_net.toFixed(2)}€
                      </option>
                    ))}
                  </select>
                )}
                <Button variant="outline" onClick={addPosition}>
                  <Plus className="w-4 h-4" />
                  Position
                </Button>
              </div>
            </div>

            {positions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Keine Positionen. Fügen Sie Positionen hinzu.
              </p>
            ) : (
              <div className="space-y-4">
                {positions.map((pos, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-start p-4 bg-muted/50 rounded-sm">
                    <div className="col-span-1">
                      <label className="text-xs text-muted-foreground">Pos</label>
                      <Input value={pos.pos_nr} disabled className="bg-background" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground">Beschreibung</label>
                      <Textarea
                        value={pos.description}
                        onChange={(e) => updatePosition(index, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Menge</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pos.quantity}
                        onChange={(e) => updatePosition(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Einheit</label>
                      <Input
                        value={pos.unit}
                        onChange={(e) => updatePosition(index, "unit", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Preis (€)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pos.price_net}
                        onChange={(e) => updatePosition(index, "price_net", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button
                        onClick={() => removePosition(index)}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Anmerkungen</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Anmerkungen zur Rechnung..."
              rows={4}
            />
          </Card>

          {/* Schlusstext */}
          <Card className="p-6">
            <TextTemplateSelect
              docType="rechnung"
              textType="schlusstext"
              value={schlusstext}
              onChange={setSchlusstext}
              customer={customers.find((c) => c.id === selectedCustomer)}
              settings={companySettings}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Zusammenfassung</h3>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-2 block">MwSt-Satz</label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(parseFloat(e.target.value))}
                  className="w-full h-10 rounded-sm border border-input bg-background px-3"
                >
                  <option value={19}>19% MwSt</option>
                  <option value={7}>7% MwSt</option>
                  <option value={0}>0% (Kleinunternehmer)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Zahlungsziel</label>
                <select
                  value={dueDays}
                  onChange={(e) => setDueDays(parseInt(e.target.value))}
                  className="w-full h-10 rounded-sm border border-input bg-background px-3"
                >
                  <option value={7}>7 Tage</option>
                  <option value={14}>14 Tage</option>
                  <option value={30}>30 Tage</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 py-4 border-t">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono">{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MwSt ({vatRate}%)</span>
                <span className="font-mono">{vat.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t">
                <span>Gesamt</span>
                <span className="font-mono">{total.toFixed(2)} €</span>
              </div>
            </div>

            <Button
              data-testid="btn-save-invoice"
              className="w-full mt-4"
              onClick={handleSubmit}
              disabled={loading || positions.length === 0}
            >
              {loading ? "Speichern..." : "Rechnung erstellen"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};


export { NewInvoicePage };
