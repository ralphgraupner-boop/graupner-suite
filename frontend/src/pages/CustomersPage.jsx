import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Mail, Trash2, Edit, ChevronRight, Search, Globe, Inbox, ChevronDown, FileText, Upload, X, File, Image as ImageIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { ContactForm } from "@/components/ContactForm";
import { api, API } from "@/lib/api";
import { CATEGORIES, CUSTOMER_STATUSES } from "@/lib/constants";

const CustomersPage = ({ readOnly = false }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [customerStatuses, setCustomerStatuses] = useState(CUSTOMER_STATUSES);
  const [vcfUploading, setVcfUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadCustomers();
    loadCustomerStatuses();
  }, []);

  const loadCustomerStatuses = async () => {
    try {
      const res = await api.get("/kunden-status");
      setCustomerStatuses(res.data);
    } catch (err) {
      // Fallback to default
      setCustomerStatuses(CUSTOMER_STATUSES);
    }
  };

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

  const handleVcfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVcfUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/customers/import-vcf", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`VCF importiert: ${file.name}`);
      loadCustomers();
    } catch (err) {
      toast.error("Fehler beim VCF-Import");
    } finally {
      setVcfUploading(false);
      e.target.value = "";
    }
  };

  const filtered = customers.filter(
    (c) =>
      (((c.vorname || c.nachname) ? `${c.vorname || ''} ${c.nachname || ''}`.trim() : (c.name || '')).toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())) &&
      (!categoryFilter || (c.categories || []).includes(categoryFilter)) &&
      (!statusFilter || (c.status || "Neu") === statusFilter)
  );

  return (
    <div data-testid="customers-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Kunden</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{customers.length} Kunden gesamt</p>
        </div>
        {!readOnly && <div className="flex items-center gap-2 flex-shrink-0">
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium cursor-pointer transition-colors ${vcfUploading ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`} data-testid="btn-vcf-import-customer">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{vcfUploading ? "Importiere..." : "VCF importieren"}</span>
            <input type="file" accept=".vcf" onChange={handleVcfUpload} className="hidden" disabled={vcfUploading} />
          </label>
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
        </div>}
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
        {customerStatuses.map((st) => (
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
                  {customer.vorname?.charAt(0)?.toUpperCase() || customer.nachname?.charAt(0)?.toUpperCase() || customer.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{(customer.vorname || customer.nachname) ? `${customer.vorname || ''} ${customer.nachname || ''}`.trim() : customer.name}</span>
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
                    {customer.photos && customer.photos.length > 0 && (
                      <span className="text-primary flex items-center gap-1">
                        <File className="w-3 h-3" />
                        {customer.photos.length}
                      </span>
                    )}
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
                  {!readOnly && <button
                    data-testid={`btn-edit-customer-${customer.id}`}
                    onClick={() => { setEditCustomer(customer); setShowModal(true); }}
                    className="p-2 hover:bg-muted rounded-sm"
                    title="Bearbeiten"
                  >
                    <Edit className="w-4 h-4" />
                  </button>}
                  {!readOnly && <button
                    data-testid={`btn-delete-customer-${customer.id}`}
                    onClick={() => handleDelete(customer.id)}
                    className={`p-2 rounded-sm transition-colors ${confirmDeleteId === customer.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                    title={confirmDeleteId === customer.id ? "Nochmal klicken" : "Löschen"}
                  >
                    {confirmDeleteId === customer.id ? <span className="text-xs font-bold">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                  </button>}
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
                        {customer.anrede && <p className="text-sm"><span className="font-medium">Anrede:</span> {customer.anrede}</p>}
                        {customer.firma && <p className="text-sm"><span className="font-medium">Firma:</span> {customer.firma}</p>}
                        {customer.vorname && <p className="text-sm"><span className="font-medium">Vorname:</span> {customer.vorname}</p>}
                        {customer.nachname && <p className="text-sm"><span className="font-medium">Nachname:</span> {customer.nachname}</p>}
                        {!customer.vorname && !customer.nachname && customer.name && (
                          <p className="text-sm"><span className="font-medium">Name:</span> {customer.name}</p>
                        )}
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

                  {/* Bilder-Galerie */}
                  {customer.photos && customer.photos.filter(f => {
                    const name = typeof f === 'string' ? f : f.filename || '';
                    const ct = typeof f === 'string' ? '' : f.content_type || '';
                    return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
                  }).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Bilder ({customer.photos.filter(f => {
                          const name = typeof f === 'string' ? f : f.filename || '';
                          const ct = typeof f === 'string' ? '' : f.content_type || '';
                          return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
                        }).length})
                      </h4>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {customer.photos.filter(f => {
                          const name = typeof f === 'string' ? f : f.filename || '';
                          const ct = typeof f === 'string' ? '' : f.content_type || '';
                          return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
                        }).map((file, idx) => {
                          const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
                          const rawUrl = typeof file === 'string' ? file : file.url;
                          const fileUrl = rawUrl?.startsWith('http') ? rawUrl : `${backendUrl}/api/storage/${rawUrl}`;
                          return (
                            <div
                              key={idx}
                              className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary hover:shadow-lg transition-all cursor-pointer group"
                              onClick={() => window.open(fileUrl, '_blank')}
                            >
                              <img
                                src={fileUrl}
                                alt={`Bild ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground text-xs">Bild nicht verfügbar</div>'; }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dateien/Dokumente (keine Bilder) */}
                  {customer.photos && customer.photos.filter(f => {
                    const name = typeof f === 'string' ? f : f.filename || '';
                    const ct = typeof f === 'string' ? '' : f.content_type || '';
                    return !(ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name));
                  }).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                        <File className="w-4 h-4" /> Dokumente ({customer.photos.filter(f => {
                          const name = typeof f === 'string' ? f : f.filename || '';
                          const ct = typeof f === 'string' ? '' : f.content_type || '';
                          return !(ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name));
                        }).length})
                      </h4>
                      <div className="space-y-2">
                        {customer.photos.filter(f => {
                          const name = typeof f === 'string' ? f : f.filename || '';
                          const ct = typeof f === 'string' ? '' : f.content_type || '';
                          return !(ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name));
                        }).map((file, idx) => {
                          const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
                          const fileName = typeof file === 'string' ? file.split('/').pop() : file.filename || `Datei ${idx + 1}`;
                          const rawUrl = typeof file === 'string' ? file : file.url;
                          const fileUrl = rawUrl?.startsWith('http') ? rawUrl : `${backendUrl}/api/storage/${rawUrl}`;
                          return (
                            <a
                              key={idx}
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-2 rounded-sm border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                            >
                              <File className="w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0" />
                              <span className="text-sm truncate flex-1">{fileName}</span>
                              <Download className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Aktionen */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                    <PortalButtons email={customer.email} customerId={customer.id} />
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

      <ContactForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        contact={editCustomer}
        mode="kunde"
        customerStatuses={customerStatuses}
        onSave={() => {
          setShowModal(false);
          loadCustomers();
        }}
      />
    </div>
  );
};


export { CustomersPage };
