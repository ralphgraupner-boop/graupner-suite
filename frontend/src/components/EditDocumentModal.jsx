import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Modal } from "@/components/common";
import { api, API } from "@/lib/api";
import { TextTemplateSelect } from "@/components/TextTemplateSelect";

const EditDocumentModal = ({ isOpen, onClose, document, type, onSave }) => {
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState("");
  const [vortext, setVortext] = useState("");
  const [schlusstext, setSchlusstext] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [status, setStatus] = useState("");
  const [customTotal, setCustomTotal] = useState("");
  const [depositAmount, setDepositAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);
  const [companySettings, setCompanySettings] = useState({});

  const titles = { quote: "Angebot", order: "Auftrag", invoice: "Rechnung" };
  const statusOptions = {
    quote: ["Entwurf", "Gesendet", "Beauftragt", "Abgelehnt"],
    order: ["Offen", "In Arbeit", "Abgeschlossen", "Abgerechnet"],
    invoice: ["Offen", "Gesendet", "Bezahlt", "Überfällig"]
  };

  const docTypeMap = { quote: "angebot", order: "auftrag", invoice: "rechnung" };

  useEffect(() => {
    if (document) {
      setPositions(document.positions || []);
      setNotes(document.notes || "");
      setVortext(document.vortext || "");
      setSchlusstext(document.schlusstext || "");
      setVatRate(document.vat_rate || 19);
      setStatus(document.status || "");
      setCustomTotal("");
      setDepositAmount(document.deposit_amount || 0);
    }
    loadStammdaten();
  }, [document]);

  const loadStammdaten = async () => {
    try {
      const [articlesRes, servicesRes, settingsRes] = await Promise.all([
        api.get("/articles"),
        api.get("/services"),
        api.get("/settings")
      ]);
      setArticles(articlesRes.data);
      setServices(servicesRes.data);
      setCompanySettings(settingsRes.data);
    } catch (err) {
      console.error("Fehler beim Laden der Stammdaten");
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
    const final = total - depositAmount;
    return { subtotal, vat, total, final };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (positions.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setLoading(true);
    try {
      const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
      const docId = document.id;
      
      const payload = {
        positions,
        notes,
        vortext,
        schlusstext,
        vat_rate: vatRate,
        status: status || undefined,
        custom_total: customTotal ? parseFloat(customTotal) : undefined
      };

      if (type === "invoice") {
        payload.deposit_amount = depositAmount;
      }

      await api.put(`/${endpoint}/${docId}`, payload);
      toast.success(`${titles[type]} aktualisiert!`);
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vat, total, final } = calculateTotals();
  const docNumber = document?.quote_number || document?.order_number || document?.invoice_number;

  if (!document) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${titles[type]} ${docNumber} bearbeiten`} size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-sm">
          <p className="text-sm text-muted-foreground">Kunde: <strong>{document.customer_name}</strong></p>
          <p className="text-sm text-muted-foreground">Erstellt: {new Date(document.created_at).toLocaleDateString("de-DE")}</p>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full h-10 rounded-sm border border-input bg-background px-3"
          >
            {statusOptions[type].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Vortext */}
        <TextTemplateSelect
          docType={docTypeMap[type]}
          textType="vortext"
          value={vortext}
          onChange={setVortext}
          customer={{ name: document?.customer_name, address: document?.customer_address }}
          settings={companySettings}
          docNumber={docNumber}
        />

        {/* Positions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium">Positionen</label>
            <div className="flex gap-2 flex-wrap">
              {services.length > 0 && (
                <select
                  onChange={(e) => {
                    const service = services.find((s) => s.id === e.target.value);
                    if (service) addService(service);
                    e.target.value = "";
                  }}
                  className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
                >
                  <option value="">+ Leistung</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
                  className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
                >
                  <option value="">+ Artikel</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addPosition}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {positions.map((pos, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-muted/30 rounded-sm">
                <div className="col-span-5">
                  <Input
                    value={pos.description}
                    onChange={(e) => updatePosition(index, "description", e.target.value)}
                    placeholder="Beschreibung"
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={pos.quantity}
                    onChange={(e) => updatePosition(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    value={pos.unit}
                    onChange={(e) => updatePosition(index, "unit", e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={pos.price_net}
                    onChange={(e) => updatePosition(index, "price_net", parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removePosition(index)}
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">Anmerkungen</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Schlusstext */}
        <TextTemplateSelect
          docType={docTypeMap[type]}
          textType="schlusstext"
          value={schlusstext}
          onChange={setSchlusstext}
          customer={{ name: document?.customer_name, address: document?.customer_address }}
          settings={companySettings}
          docNumber={docNumber}
        />

        {/* VAT, Custom Total & Deposit */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">MwSt-Satz</label>
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
            <label className="block text-sm font-medium mb-2">Gesamtsumme ändern (Brutto)</label>
            <Input
              type="number"
              step="0.01"
              value={customTotal}
              onChange={(e) => setCustomTotal(e.target.value)}
              placeholder={`${total.toFixed(2)} €`}
            />
            <p className="text-xs text-muted-foreground mt-1">Positionen werden proportional angepasst</p>
          </div>
          {type === "invoice" && (
            <div>
              <label className="block text-sm font-medium mb-2">Anzahlung (€)</label>
              <Input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <div className="space-y-1 text-right">
            <p className="text-sm text-muted-foreground">Netto: <span className="font-mono">{subtotal.toFixed(2)} €</span></p>
            <p className="text-sm text-muted-foreground">MwSt: <span className="font-mono">{vat.toFixed(2)} €</span></p>
            <p className="font-bold">Gesamt: <span className="font-mono">{total.toFixed(2)} €</span></p>
            {type === "invoice" && depositAmount > 0 && (
              <p className="text-primary font-semibold">Restbetrag: <span className="font-mono">{final.toFixed(2)} €</span></p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Speichern..." : "Änderungen speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};


export { EditDocumentModal };
