import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api, API } from "@/lib/api";

const ServicesPage = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editService, setEditService] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const res = await api.get("/services");
      setServices(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Leistungen");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Leistung wirklich löschen?")) return;
    try {
      await api.delete(`/services/${id}`);
      toast.success("Leistung gelöscht");
      loadServices();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <div data-testid="services-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Leistungsstamm</h1>
          <p className="text-muted-foreground mt-2">Verwalten Sie Ihre Arbeitsleistungen und Dienstleistungen</p>
        </div>
        <Button
          data-testid="btn-new-service"
          onClick={() => {
            setEditService(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-5 h-5" />
          Neue Leistung
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : services.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Leistungen vorhanden</h3>
          <p className="text-muted-foreground mt-2">
            Erstellen Sie Leistungsvorlagen für schnellere Angebotserstellung
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id} className="p-6 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditService(service);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-muted rounded-sm"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{service.unit}</span>
                <div className="text-right">
                  <span className="text-lg font-mono font-semibold">
                    {service.price_net.toFixed(2)} €
                  </span>
                  {service.purchase_price > 0 && (
                    <span className="block text-xs text-muted-foreground font-mono">
                      EK: {service.purchase_price.toFixed(2)} € ({((1 - service.purchase_price / service.price_net) * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ServiceModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        service={editService}
        onSave={() => {
          setShowModal(false);
          loadServices();
        }}
      />
    </div>
  );
};

const ServiceModal = ({ isOpen, onClose, service, onSave }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit: "Stunde",
    price_net: 0,
    purchase_price: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name || "",
        description: service.description || "",
        unit: service.unit || "Stunde",
        price_net: service.price_net || 0,
        purchase_price: service.purchase_price || 0
      });
    } else {
      setForm({ name: "", description: "", unit: "Stunde", price_net: 0, purchase_price: 0 });
    }
  }, [service]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (service) {
        await api.put(`/services/${service.id}`, form);
        toast.success("Leistung aktualisiert");
      } else {
        await api.post("/services", form);
        toast.success("Leistung erstellt");
      }
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={service ? "Leistung bearbeiten" : "Neue Leistung"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Bezeichnung *</label>
          <Input
            data-testid="input-service-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Türreparatur"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Beschreibung</label>
          <Textarea
            data-testid="input-service-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optionale Beschreibung..."
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Einheit</label>
            <select
              data-testid="select-service-unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="Stunde">Stunde</option>
              <option value="Pauschal">Pauschal</option>
              <option value="Tag">Tag</option>
              <option value="m²">m²</option>
              <option value="lfm">lfm</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">VK-Preis (Netto €)</label>
            <Input
              data-testid="input-service-price"
              type="number"
              step="0.01"
              value={form.price_net}
              onChange={(e) => setForm({ ...form, price_net: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">EK-Preis (Netto €)</label>
            <Input
              data-testid="input-service-purchase-price"
              type="number"
              step="0.01"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Marge</label>
            <div className="h-10 flex items-center px-3 rounded-sm border border-input bg-muted/50 font-mono text-sm">
              {form.price_net > 0 && form.purchase_price > 0
                ? `${((1 - form.purchase_price / form.price_net) * 100).toFixed(1)}%`
                : "—"}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" data-testid="btn-save-service" disabled={loading}>
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};


export { ServicesPage };
