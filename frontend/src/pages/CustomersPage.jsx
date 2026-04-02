import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Mail, Trash2, Edit, ChevronRight, Search, Globe, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { api, API } from "@/lib/api";
import { CATEGORIES, CUSTOMER_STATUSES } from "@/lib/constants";

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await api.get("/customers");
      setCustomers(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Kunden");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      await api.delete(`/customers/${id}`);
      toast.success("Kunde gelöscht");
      setConfirmDeleteId(null);
      loadCustomers();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const filtered = customers.filter(
    (c) =>
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())) &&
      (!categoryFilter || (c.categories || []).includes(categoryFilter)) &&
      (!statusFilter || (c.status || "Neu") === statusFilter)
  );

  return (
    <div data-testid="customers-page">
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Kunden</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{customers.length} Kunden gesamt</p>
        </div>
        <Button
          data-testid="btn-new-customer"
          size="sm"
          className="lg:h-10 lg:px-4"
          onClick={() => {
            setEditCustomer(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Neuer Kunde</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
          <Input
            data-testid="input-search-customers"
            className="pl-9 lg:pl-10 h-9 lg:h-10"
            placeholder="Kunden suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-4" data-testid="customers-category-filter">
        <button
          onClick={() => setCategoryFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            !categoryFilter
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Alle
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              categoryFilter === cat
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-4" data-testid="customers-status-filter">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            !statusFilter ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Alle Status
        </button>
        {CUSTOMER_STATUSES.map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(statusFilter === st ? "" : st)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === st ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <Users className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Kunden gefunden</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {search ? "Versuchen Sie eine andere Suche" : "Erstellen Sie Ihren ersten Kunden"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {filtered.map((customer) => (
            <Card
              key={customer.id}
              className="p-4 lg:p-6 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:border-primary/40 hover:z-10 cursor-pointer group relative"
              onClick={() => { setEditCustomer(customer); setShowModal(true); }}
              data-testid={`customer-card-${customer.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{customer.name}</h3>
                    {customer.customer_type && customer.customer_type !== "Privat" && (
                      <Badge variant="default" className="text-xs">{customer.customer_type}</Badge>
                    )}
                  </div>
                  {customer.email && (
                    <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                  )}
                  {customer.phone && (
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  )}
                  {customer.address && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1 group-hover:line-clamp-3 transition-all">{customer.address}</p>
                  )}
                  {customer.status && customer.status !== "Neu" && (
                    <Badge variant={customer.status === "Abgeschlossen" ? "success" : customer.status === "Auftrag erteilt" ? "info" : "warning"} className="mt-2 text-xs">
                      {customer.status}
                    </Badge>
                  )}
                  {(customer.categories || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {customer.categories.map((cat) => (
                        <span key={cat} className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>
                      ))}
                    </div>
                  )}
                  {customer.notes && (
                    <p className="text-xs text-muted-foreground mt-2 hidden group-hover:block line-clamp-2 italic">{customer.notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 ml-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    data-testid={`btn-edit-customer-${customer.id}`}
                    onClick={() => {
                      setEditCustomer(customer);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-muted rounded-sm"
                    title="Bearbeiten"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    data-testid={`btn-to-anfrage-${customer.id}`}
                    onClick={async () => {
                      if (confirmDeleteId === `revert-${customer.id}`) {
                        try {
                          await api.post(`/customers/${customer.id}/to-anfrage`);
                          toast.success("Kunde zurück in Anfragen verschoben");
                          setConfirmDeleteId(null);
                          loadCustomers();
                        } catch (err) { toast.error("Fehler beim Zurückstufen"); }
                      } else {
                        setConfirmDeleteId(`revert-${customer.id}`);
                        setTimeout(() => setConfirmDeleteId(null), 3000);
                      }
                    }}
                    className={`p-2 rounded-sm transition-colors ${confirmDeleteId === `revert-${customer.id}` ? 'bg-amber-500 text-white' : 'hover:bg-amber-50 hover:text-amber-700'}`}
                    title={confirmDeleteId === `revert-${customer.id}` ? "Nochmal klicken" : "Zurück zu Anfragen"}
                  >
                    {confirmDeleteId === `revert-${customer.id}` ? <span className="text-xs font-bold">Zurück?</span> : <Inbox className="w-4 h-4" />}
                  </button>
                  <button
                    data-testid={`btn-delete-customer-${customer.id}`}
                    onClick={() => handleDelete(customer.id)}
                    className={`p-2 rounded-sm transition-colors ${confirmDeleteId === customer.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                    title={confirmDeleteId === customer.id ? "Nochmal klicken zum Löschen" : "Löschen"}
                  >
                    {confirmDeleteId === customer.id ? <span className="text-xs font-bold">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Klicken zum Bearbeiten</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); navigate(`/quotes/new?customer=${customer.id}`); }}
                >
                  Angebot erstellen
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        customer={editCustomer}
        onSave={() => {
          setShowModal(false);
          loadCustomers();
        }}
      />
    </div>
  );
};

const CustomerModal = ({ isOpen, onClose, customer, onSave }) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    customer_type: "Privat",
    categories: [],
    status: "Neu"
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        notes: customer.notes || "",
        customer_type: customer.customer_type || "Privat",
        categories: customer.categories || [],
        status: customer.status || "Neu"
      });
    } else {
      setForm({ name: "", email: "", phone: "", address: "", notes: "", customer_type: "Privat", categories: [], status: "Neu" });
    }
  }, [customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (customer) {
        await api.put(`/customers/${customer.id}`, form);
        toast.success("Kunde aktualisiert");
      } else {
        await api.post("/customers", form);
        toast.success("Kunde erstellt");
      }
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customer ? "Kunde bearbeiten" : "Neuer Kunde"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name *</label>
            <Input
              data-testid="input-customer-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Kundentyp</label>
            <select
              data-testid="select-customer-type"
              value={form.customer_type}
              onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="Privat">Privat</option>
              <option value="Vermieter">Vermieter</option>
              <option value="Mieter">Mieter</option>
              <option value="Gewerblich">Gewerblich</option>
              <option value="Hausverwaltung">Hausverwaltung</option>
              <option value="Wohnungsbaugesellschaft">Wohnungsbaugesellschaft</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">E-Mail</label>
            <Input
              data-testid="input-customer-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <Input
              data-testid="input-customer-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Kategorien</label>
          <div className="flex flex-wrap gap-2" data-testid="customer-categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  const cats = form.categories.includes(cat)
                    ? form.categories.filter(c => c !== cat)
                    : [...form.categories, cat];
                  setForm({ ...form, categories: cats });
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  form.categories.includes(cat)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-input hover:border-primary/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            data-testid="select-customer-status"
            className="w-full h-10 px-3 rounded-sm border border-input bg-background text-sm"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Adresse</label>
          <Textarea
            data-testid="input-customer-address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={3}
          />
          {form.address && (
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(form.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
              data-testid="btn-map-link"
            >
              <Globe className="w-3 h-3" />
              Auf Karte anzeigen
            </a>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Notizen</label>
          <Textarea
            data-testid="input-customer-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" data-testid="btn-save-customer" disabled={loading}>
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};


export { CustomersPage };
