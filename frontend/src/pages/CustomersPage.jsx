import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Mail, Trash2, Edit, ChevronRight, Search, Globe, Inbox, ChevronDown, FileText, Upload, X, File, Image as ImageIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { PortalButtons } from "@/components/PortalButtons";
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

                  {/* Dateien/Anhänge */}
                  {customer.photos && customer.photos.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                        <File className="w-4 h-4" /> Dateien ({customer.photos.length})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {customer.photos.map((file, idx) => {
                          const fileName = typeof file === 'string' ? file.split('/').pop() : file.filename || `Datei ${idx + 1}`;
                          const fileUrl = typeof file === 'string' ? file : file.url;
                          const isImage = typeof file === 'string' 
                            ? /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
                            : file.content_type?.startsWith('image/');
                          
                          return (
                            <a
                              key={idx}
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative border rounded-sm overflow-hidden hover:shadow-lg transition-all hover:border-primary/50 bg-white"
                            >
                              {isImage ? (
                                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                  <img 
                                    src={fileUrl} 
                                    alt={fileName}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="aspect-square bg-muted/30 flex flex-col items-center justify-center p-3">
                                  <File className="w-8 h-8 text-muted-foreground mb-2" />
                                  <p className="text-xs text-center text-muted-foreground line-clamp-2">{fileName}</p>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Download className="w-6 h-6 text-white" />
                              </div>
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

      <CustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        customer={editCustomer}
        customerStatuses={customerStatuses}
        onSave={() => {
          setShowModal(false);
          loadCustomers();
        }}
      />
    </div>
  );
};

const CustomerModal = ({ isOpen, onClose, customer, customerStatuses = CUSTOMER_STATUSES, onSave }) => {
  const [form, setForm] = useState({
    anrede: "",
    vorname: "",
    nachname: "",
    name: "",  // Legacy
    firma: "",
    email: "",
    phone: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    address: "", // Legacy - wird aus Einzelfeldern zusammengesetzt
    notes: "",
    customer_type: "Privat",
    categories: [],
    status: "Neu"
  });
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    if (customer) {
      // Parse alte Adresse wenn vorhanden
      let strasse = "", hausnummer = "", plz = "", ort = "";
      if (customer.address && !customer.strasse) {
        // Alte Adresse parsen (Best-Effort)
        const parts = customer.address.split(",").map(p => p.trim());
        if (parts[0]) {
          const streetParts = parts[0].split(" ");
          hausnummer = streetParts.pop() || "";
          strasse = streetParts.join(" ");
        }
        if (parts[1]) {
          const cityParts = parts[1].split(" ");
          plz = cityParts[0] || "";
          ort = cityParts.slice(1).join(" ");
        }
      }
      
      setForm({
        anrede: customer.anrede || "",
        vorname: customer.vorname || "",
        nachname: customer.nachname || "",
        name: customer.name || "",
        firma: customer.firma || "",
        email: customer.email || "",
        phone: customer.phone || "",
        strasse: customer.strasse || strasse,
        hausnummer: customer.hausnummer || hausnummer,
        plz: customer.plz || plz,
        ort: customer.ort || ort,
        address: customer.address || "",
        notes: customer.notes || "",
        customer_type: customer.customer_type || "Privat",
        categories: customer.categories || [],
        status: customer.status || "Neu"
      });
      setUploadedFiles(customer.photos || []);
    } else {
      setForm({ 
        anrede: "", vorname: "", nachname: "", name: "", firma: "",
        email: "", phone: "", 
        strasse: "", hausnummer: "", plz: "", ort: "",
        address: "", notes: "", customer_type: "Privat", categories: [], status: "Neu" 
      });
      setUploadedFiles([]);
    }
    setSelectedFiles([]);
  }, [customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Kombiniere Adresse aus Einzelfeldern
      const addressCombined = `${form.strasse} ${form.hausnummer}, ${form.plz} ${form.ort}`.trim();
      
      const payload = {
        ...form,
        address: addressCombined || form.address // Fallback auf altes Feld
      };
      
      let customerId = customer?.id;
      
      if (customer) {
        await api.put(`/customers/${customer.id}`, payload);
        toast.success("Kunde aktualisiert");
      } else {
        const res = await api.post("/customers", payload);
        customerId = res.data.id;
        toast.success("Kunde erstellt");
      }
      
      // Upload files if any
      if (selectedFiles.length > 0 && customerId) {
        await handleFileUpload(customerId);
      }
      
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (customerId) => {
    if (selectedFiles.length === 0) return;
    
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      
      const res = await api.post(`/customers/${customerId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(res.data.message);
      setSelectedFiles([]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Upload");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const MAX_FILES = 10;
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    
    const totalFiles = uploadedFiles.length + selectedFiles.length + files.length;
    if (totalFiles > MAX_FILES) {
      toast.error(`Maximale Anzahl Dateien überschritten (max ${MAX_FILES})`);
      return;
    }
    
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        toast.error(`Datei ${file.name} ist zu groß (max 10 MB)`);
        return;
      }
    }
    
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    handleFileSelect({ target: { files } });
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const deleteUploadedFile = async (index) => {
    if (!customer) return;
    try {
      await api.delete(`/customers/${customer.id}/files/${index}`);
      toast.success("Datei gelöscht");
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const getFileIcon = (file) => {
    const name = typeof file === 'string' ? file : file.filename || file.name || '';
    const contentType = typeof file === 'string' ? '' : file.content_type || file.type || '';
    
    if (contentType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const getFileName = (file) => {
    if (typeof file === 'string') {
      return file.split('/').pop();
    }
    return file.filename || file.name || 'Datei';
  };

  const getFileSize = (file) => {
    if (file.size) {
      const kb = file.size / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return '';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customer ? "Kunde bearbeiten" : "Neuer Kunde"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Anrede & Kundentyp */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Anrede</label>
            <select
              data-testid="select-customer-anrede"
              value={form.anrede}
              onChange={(e) => setForm({ ...form, anrede: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="">Bitte wählen</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
              <option value="Divers">Divers</option>
            </select>
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
              <option value="Firma">Firma</option>
              <option value="Vermieter">Vermieter</option>
              <option value="Mieter">Mieter</option>
              <option value="Gewerblich">Gewerblich</option>
              <option value="Hausverwaltung">Hausverwaltung</option>
              <option value="Wohnungsbaugesellschaft">Wohnungsbaugesellschaft</option>
            </select>
          </div>
        </div>

        {/* Firmenname (nur wenn Firma gewählt) */}
        {(form.customer_type === "Firma" || form.customer_type === "Gewerblich") && (
          <div>
            <label className="block text-sm font-medium mb-2">Firmenname *</label>
            <Input
              data-testid="input-customer-firma"
              value={form.firma}
              onChange={(e) => setForm({ ...form, firma: e.target.value })}
              placeholder="Firma GmbH"
            />
          </div>
        )}

        {/* Vor- und Nachname */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Vorname *</label>
            <Input
              data-testid="input-customer-vorname"
              value={form.vorname}
              onChange={(e) => setForm({ ...form, vorname: e.target.value })}
              required={!form.firma}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nachname *</label>
            <Input
              data-testid="input-customer-nachname"
              value={form.nachname}
              onChange={(e) => setForm({ ...form, nachname: e.target.value })}
              required={!form.firma}
            />
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
            {customerStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Adresse</label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <Input
                data-testid="input-customer-strasse"
                placeholder="Straße"
                value={form.strasse}
                onChange={(e) => setForm({ ...form, strasse: e.target.value })}
              />
            </div>
            <div className="col-span-4">
              <Input
                data-testid="input-customer-hausnummer"
                placeholder="Nr."
                value={form.hausnummer}
                onChange={(e) => setForm({ ...form, hausnummer: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div>
              <Input
                data-testid="input-customer-plz"
                placeholder="PLZ"
                value={form.plz}
                onChange={(e) => setForm({ ...form, plz: e.target.value })}
              />
            </div>
            <div className="col-span-3">
              <Input
                data-testid="input-customer-ort"
                placeholder="Ort"
                value={form.ort}
                onChange={(e) => setForm({ ...form, ort: e.target.value })}
              />
            </div>
          </div>
          {(form.strasse || form.address) && (
            <button
              onClick={() => {
                const addr = form.address || `${form.strasse} ${form.hausnummer}, ${form.plz} ${form.ort}`.trim();
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
                navigator.clipboard.writeText(url);
                toast.success("Maps-Link kopiert! In neuem Tab einfügen.");
              }}
              className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
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

        {/* File Upload Section */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Dateien <span className="text-xs text-muted-foreground">(max 10 Dateien, je 10 MB)</span>
          </label>
          
          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="text-xs text-muted-foreground">Hochgeladene Dateien:</p>
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-sm border">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(file)}
                    <span className="text-sm truncate">{getFileName(file)}</span>
                    {file.size && <span className="text-xs text-muted-foreground">{getFileSize(file)}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {typeof file === 'object' && file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-muted rounded-sm"
                        title="Herunterladen"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteUploadedFile(idx)}
                      className="p-1 hover:bg-destructive/10 rounded-sm"
                      title="Löschen"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Files (to upload) */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="text-xs text-green-600 font-medium">Ausgewählte Dateien (werden beim Speichern hochgeladen):</p>
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-sm border border-green-200">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(file)}
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{getFileSize(file)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(idx)}
                    className="p-1 hover:bg-destructive/10 rounded-sm"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drop Zone */}
          {(uploadedFiles.length + selectedFiles.length) < 10 && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-sm p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-upload-input').click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">
                Dateien hier ablegen oder klicken zum Auswählen
              </p>
              <p className="text-xs text-muted-foreground">
                Bilder, PDFs, Dokumente (max 10 MB pro Datei)
              </p>
              <input
                id="file-upload-input"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" data-testid="btn-save-customer" disabled={loading || uploadingFiles}>
            {loading ? "Speichern..." : uploadingFiles ? "Uploading..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};


export { CustomersPage };
