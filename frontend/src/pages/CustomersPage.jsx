import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Mail, Trash2, Edit, ChevronRight, Search, Globe, Inbox, ChevronDown, FileText } from "lucide-react";
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
  const [expandedId, setExpandedId] = useState(null);
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
        <div className="flex flex-col gap-2">
          {filtered.map((customer) => {
            const isExpanded = expandedId === customer.id;
            return (
            <Card
              key={customer.id}
              className={`transition-all duration-200 cursor-pointer overflow-hidden ${isExpanded ? 'shadow-lg border-primary/40 ring-1 ring-primary/20' : 'hover:shadow-md hover:border-primary/20'}`}
              data-testid={`customer-card-${customer.id}`}
            >
              {/* Kompakte Listenzeile */}
              <div
                className="flex items-center gap-4 p-3 lg:p-4"
                onClick={() => setExpandedId(isExpanded ? null : customer.id)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                  {customer.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{customer.name}</span>
                    {customer.customer_type && customer.customer_type !== "Privat" && (
                      <Badge variant="default" className="text-xs">{customer.customer_type}</Badge>
                    )}
                    {customer.status && customer.status !== "Neu" && (
                      <Badge variant={customer.status === "Abgeschlossen" ? "success" : customer.status === "Auftrag erteilt" ? "info" : "warning"} className="text-xs">
                        {customer.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {customer.phone && <span>{customer.phone}</span>}
                    {customer.email && <span className="truncate hidden sm:inline">{customer.email}</span>}
                  </div>
                </div>
                {(customer.categories || []).length > 0 && (
                  <div className="hidden lg:flex flex-wrap gap-1">
                    {customer.categories.map((cat) => (
                      <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    data-testid={`btn-edit-customer-${customer.id}`}
                    onClick={() => { setEditCustomer(customer); setShowModal(true); }}
                    className="p-2 hover:bg-muted rounded-sm"
                    title="Bearbeiten"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    data-testid={`btn-delete-customer-${customer.id}`}
                    onClick={() => handleDelete(customer.id)}
                    className={`p-2 rounded-sm transition-colors ${confirmDeleteId === customer.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                    title={confirmDeleteId === customer.id ? "Nochmal klicken" : "Löschen"}
                  >
                    {confirmDeleteId === customer.id ? <span className="text-xs font-bold">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              </div>

              {/* Aufgeklappte Detail-Ansicht */}
              {isExpanded && (
                <div className="border-t bg-muted/30 p-4 lg:p-6 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Kontaktdaten */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Kontaktdaten</h4>
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Name:</span> {customer.name}</p>
                        {customer.email && <p className="text-sm"><span className="font-medium">E-Mail:</span> {customer.email}</p>}
                        {customer.phone && <p className="text-sm"><span className="font-medium">Telefon:</span> {customer.phone}</p>}
                        {customer.address && (
                          <div>
                            <span className="text-sm font-medium">Adresse:</span>
                            <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{customer.address}</p>
                            <button
                              onClick={() => {
                                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Maps-Link kopiert! In neuem Tab einfügen.");
                              }}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                            >
                              <Globe className="w-3 h-3" /> Karten-Link kopieren
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Kategorien & Status */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Details</h4>
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Typ:</span> {customer.customer_type || "Privat"}</p>
                        <p className="text-sm"><span className="font-medium">Status:</span> {customer.status || "Neu"}</p>
                        {(customer.categories || []).length > 0 && (
                          <div>
                            <span className="text-sm font-medium">Kategorien:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {customer.categories.map((cat) => (
                                <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notizen */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Notizen</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{customer.notes || "Keine Notizen"}</p>
                    </div>
                  </div>

                  {/* Aktionen */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                    <Button size="sm" onClick={() => { setEditCustomer(customer); setShowModal(true); }}>
                      <Edit className="w-4 h-4" /> Bearbeiten
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/quotes/new?customer=${customer.id}`)}>
                      <FileText className="w-4 h-4" /> Angebot erstellen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
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
                      className={confirmDeleteId === `revert-${customer.id}` ? 'bg-amber-500 text-white border-amber-500' : ''}
                    >
                      <Inbox className="w-4 h-4" /> {confirmDeleteId === `revert-${customer.id}` ? "Nochmal klicken!" : "Zurück zu Anfragen"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );})}
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
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address)}`;
                navigator.clipboard.writeText(url);
                toast.success("Maps-Link kopiert! In neuem Tab einfügen.");
              }}
              className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
              data-testid="btn-map-link"
            >
              <Globe className="w-3 h-3" />
              Karten-Link kopieren
            </button>
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
