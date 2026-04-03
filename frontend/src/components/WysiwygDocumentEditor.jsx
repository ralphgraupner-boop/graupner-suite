import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Package, Plus, Mic, MicOff, Download, Trash2, Edit, TrendingUp, Search, Save, Wrench, ArrowLeft, Copy, GripVertical, Calculator, ChevronDown, Bookmark, BookmarkCheck, FileSearch, Filter } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Button, Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";
import { TextTemplateSelect } from "@/components/TextTemplateSelect";
import { SettingsPage } from "@/pages/SettingsPage";

const WysiwygDocumentEditor = ({ type = "quote" }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isNew = !id || id === "new";
  
  const [customers, setCustomers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Document state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customer, setCustomer] = useState(null);
  const [positions, setPositions] = useState([
    { pos_nr: 1, description: "", quantity: 1, unit: "Stück", price_net: 0 }
  ]);
  const [notes, setNotes] = useState("");
  const [vortext, setVortext] = useState("");
  const [schlusstext, setSchlusstext] = useState("");
  const [betreff, setBetreff] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [status, setStatus] = useState(type === "quote" ? "Entwurf" : type === "order" ? "Offen" : "Offen");
  const [depositAmount, setDepositAmount] = useState(0);
  const [docNumber, setDocNumber] = useState("");
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());
  
  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // 3-Column Layout state (Desktop)
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarTab, setSidebarTab] = useState("services"); // "services" | "articles"
  const [costPrices, setCostPrices] = useState({});
  const [kalkulationOpen, setKalkulationOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [templateDocs, setTemplateDocs] = useState([]);
  const [similarDocs, setSimilarDocs] = useState([]);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [rightTab, setRightTab] = useState("vorlagen"); // expanded detail view

  const titles = { quote: "Angebot", order: "Auftragsbestätigung", invoice: "Rechnung" };
  const listPaths = { quote: "/quotes", order: "/orders", invoice: "/invoices" };
  const docTypeMap = { quote: "angebot", order: "auftrag", invoice: "rechnung" };

  useEffect(() => {
    loadData();
  }, [id]);

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
      setSettings(settingsRes.data);

      // Load existing document if editing
      if (!isNew) {
        const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
        const res = await api.get(`/${endpoint}/${id}`);
        const doc = res.data;
        setSelectedCustomerId(doc.customer_id);
        setCustomer({ name: doc.customer_name, address: doc.customer_address });
        setPositions(doc.positions || []);
        setNotes(doc.notes || "");
        setVortext(doc.vortext || "");
        setSchlusstext(doc.schlusstext || "");
        setBetreff(doc.betreff || "");
        setVatRate(doc.vat_rate || 19);
        setStatus(doc.status || "");
        setDepositAmount(doc.deposit_amount || 0);
        setDocNumber(doc.quote_number || doc.order_number || doc.invoice_number);
        setCreatedAt(doc.created_at);
      } else {
        // Pre-select customer from query param
        const params = new URLSearchParams(location.search);
        const preselectedCustomerId = params.get("customer");
        if (preselectedCustomerId) {
          const cust = customersRes.data.find(c => c.id === preselectedCustomerId);
          if (cust) {
            setSelectedCustomerId(preselectedCustomerId);
            setCustomer(cust);
          }
        }
      }
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find(c => c.id === customerId);
    setCustomer(cust || null);
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
    if (positions.length <= 1) return;
    const updated = positions.filter((_, i) => i !== index);
    updated.forEach((p, i) => (p.pos_nr = i + 1));
    setPositions(updated);
  };

  const movePosition = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= positions.length) return;
    const updated = [...positions];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    updated.forEach((p, i) => (p.pos_nr = i + 1));
    setPositions(updated);
  };

  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const addFromStamm = (item) => {
    const newIdx = positions.length;
    setPositions([
      ...positions,
      {
        pos_nr: newIdx + 1,
        description: item.name + (item.description ? ` - ${item.description}` : ""),
        quantity: 1,
        unit: item.unit,
        price_net: item.price_net
      }
    ]);
    const ekPrice = item.ek_preis || item.purchase_price || 0;
    if (ekPrice > 0) {
      setCostPrices(prev => ({ ...prev, [newIdx]: ekPrice }));
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const item = JSON.parse(e.dataTransfer.getData("application/json"));
      addFromStamm(item);
      toast.success(`"${item.name}" hinzugefügt`);
    } catch {}
  };

  const updateCostPrice = (idx, value) => {
    setCostPrices(prev => ({ ...prev, [idx]: parseFloat(value) || 0 }));
  };

  const calculateKalkulation = () => {
    const revenue = positions.reduce((sum, p) => sum + (p.quantity || 0) * (p.price_net || 0), 0);
    const costs = positions.reduce((sum, p, idx) => sum + (p.quantity || 0) * (costPrices[idx] || 0), 0);
    const margin = revenue - costs;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
    const hasCosts = Object.values(costPrices).some(v => v > 0);
    return { revenue, costs, margin, marginPercent, hasCosts };
  };

  // Filter items for sidebar search
  const filteredServices = articles.filter(a =>
    (a.typ === "Leistung" || a.typ === "Fremdleistung") &&
    (a.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    (a.description || "").toLowerCase().includes(sidebarSearch.toLowerCase()))
  );
  const filteredArticles = articles.filter(a =>
    a.typ === "Artikel" &&
    (a.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    (a.description || "").toLowerCase().includes(sidebarSearch.toLowerCase()))
  );

  // Load templates & similar docs
  const loadSuggestions = async () => {
    try {
      const currentDescs = positions.filter(p => p.description).map(p => p.description).join(",");
      const res = await api.get(`/documents/suggestions/${type}?customer_id=${selectedCustomerId}&current_positions=${encodeURIComponent(currentDescs)}`);
      setTemplateDocs(res.data.templates || []);
      setSimilarDocs(res.data.similar || []);
    } catch {}
  };

  useEffect(() => {
    if (!loading) loadSuggestions();
  }, [loading, selectedCustomerId]);

  const copyPositionsFromDoc = (doc) => {
    if (doc.positions && doc.positions.length > 0) {
      const newPositions = doc.positions.map((p, idx) => ({
        ...p,
        pos_nr: positions.length + idx + 1
      }));
      setPositions([...positions, ...newPositions]);
      toast.success(`${newPositions.length} Position(en) übernommen`);
    }
  };

  const toggleDocTemplate = async (docId) => {
    try {
      const res = await api.put(`/documents/${type}/${docId}/template`);
      toast.success(res.data.is_template ? "Als Vorlage markiert" : "Vorlage entfernt");
      loadSuggestions();
    } catch {}
  };

  const calculateTotals = () => {
    const subtotal = positions.reduce((sum, p) => sum + (p.quantity || 0) * (p.price_net || 0), 0);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    const final = total - depositAmount;
    return { subtotal, vat, total, final };
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Aufnahme gestartet - Sprechen Sie jetzt...");
    } catch (err) {
      toast.error("Mikrofon-Zugriff verweigert");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    if (!selectedCustomerId) {
      toast.error("Bitte wählen Sie zuerst einen Kunden aus");
      return;
    }

    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const sttRes = await axios.post(`${API}/speech-to-text`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const text = sttRes.data.text;

      const aiRes = await api.post("/ai/generate-quote", {
        customer_id: selectedCustomerId,
        transcribed_text: text,
        vat_rate: vatRate
      });

      if (aiRes.data.positions && aiRes.data.positions.length > 0) {
        setPositions(aiRes.data.positions);
        if (aiRes.data.notes) setNotes(aiRes.data.notes);
        toast.success("KI hat das Dokument erstellt!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Fehler bei der Sprachverarbeitung");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCustomerId) {
      toast.error("Bitte wählen Sie einen Kunden aus");
      return;
    }
    if (positions.length === 0 || !positions[0].description) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setSaving(true);
    try {
      const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
      
      if (isNew) {
        const payload = {
          customer_id: selectedCustomerId,
          positions: positions.filter(p => p.description),
          notes,
          vortext,
          schlusstext,
          betreff,
          vat_rate: vatRate,
          ...(type === "quote" && { valid_days: 30 }),
          ...(type === "invoice" && { due_days: 14, deposit_amount: depositAmount })
        };
        await api.post(`/${endpoint}`, payload);
        toast.success(`${titles[type]} erstellt!`);
      } else {
        const payload = {
          positions: positions.filter(p => p.description),
          notes,
          vortext,
          schlusstext,
          betreff,
          vat_rate: vatRate,
          status,
          ...(type === "invoice" && { deposit_amount: depositAmount })
        };
        await api.put(`/${endpoint}/${id}`, payload);
        toast.success(`${titles[type]} aktualisiert!`);
      }
      navigate(listPaths[type]);
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (isNew) {
      toast.error("Bitte speichern Sie zuerst das Dokument");
      return;
    }
    try {
      const endpoint = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
      const res = await axios.get(`${API}/pdf/${endpoint}/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${titles[type]}_${docNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const { subtotal, vat, total, final } = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toolbar */}
      <div className="fixed top-0 left-0 right-0 bg-card border-b z-40 shadow-sm">
        <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-3">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(listPaths[type])}>
              <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">Zurück</span>
            </Button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <h1 className="text-sm lg:text-xl font-bold text-primary truncate">
              {isNew ? `${titles[type]}` : `${titles[type]} ${docNumber}`}
            </h1>
            {!isNew && (
              <Badge variant={status === "Bezahlt" || status === "Beauftragt" ? "success" : "warning"}>
                {status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 lg:gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              data-testid="btn-settings-topbar"
            >
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Einstellungen</span>
            </Button>
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={aiLoading}
              data-testid="btn-voice-input"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="hidden sm:inline">{isRecording ? "Stop" : "Spracheingabe"}</span>
            </Button>
            {aiLoading && (
              <span className="text-xs text-muted-foreground animate-pulse hidden sm:inline">KI verarbeitet...</span>
            )}
            {!isNew && (
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving} data-testid="btn-save-document">
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{saving ? "..." : "Speichern"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Document Area - 3 Column Layout (Desktop) */}
      <div className="pt-14 lg:pt-20 pb-4 lg:pb-8 px-2 lg:px-4">
        <div className="lg:grid lg:grid-cols-[340px_1fr_300px] lg:gap-4 lg:max-w-[1600px] lg:mx-auto">

          {/* === LEFT SIDEBAR: Services & Articles (Desktop only) === */}
          <div className="hidden lg:block">
            <div className="sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto space-y-3 pr-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-card text-sm"
                  data-testid="sidebar-search"
                />
              </div>

              {/* Tabs */}
              <div className="flex rounded-md border border-input overflow-hidden">
                <button
                  onClick={() => setSidebarTab("services")}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === "services" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                  data-testid="tab-services"
                >
                  <Wrench className="w-3.5 h-3.5 inline mr-1" />
                  Leistungen ({filteredServices.length})
                </button>
                <button
                  onClick={() => setSidebarTab("articles")}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === "articles" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                  data-testid="tab-articles"
                >
                  <Package className="w-3.5 h-3.5 inline mr-1" />
                  Artikel ({filteredArticles.length})
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                {(sidebarTab === "services" ? filteredServices : filteredArticles).map((item) => (
                  <div key={item.id}>
                    <div
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, item)}
                      onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                      className={`group flex items-start gap-2 p-2.5 rounded-md border cursor-grab active:cursor-grabbing transition-all ${selectedItem?.id === item.id ? "border-primary bg-primary/5 shadow-sm" : "border-input bg-card hover:border-primary/40 hover:shadow-sm"}`}
                      data-testid={`draggable-item-${item.id}`}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item.typ === "Fremdleistung" && (
                            <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0 rounded font-medium shrink-0">Sub</span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        )}
                        {item.subunternehmer && (
                          <p className="text-[10px] text-orange-600 truncate">{item.subunternehmer}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono font-semibold text-primary">{item.price_net.toFixed(2)} €</span>
                          <span className="text-[10px] text-muted-foreground">/ {item.unit}</span>
                          {item.ek_preis > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono">EK: {item.ek_preis.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5 transition-transform ${selectedItem?.id === item.id ? "rotate-180 text-primary" : ""}`} />
                    </div>

                    {/* Expanded Detail View */}
                    {selectedItem?.id === item.id && (
                      <div className="mt-1 rounded-md border border-primary/20 bg-white p-4 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200" data-testid={`detail-view-${item.id}`}>
                        <h4 className="font-semibold text-base mb-1">{item.name}</h4>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{item.description}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-slate-50 rounded-md p-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Preis (Netto)</p>
                            <p className="text-lg font-bold font-mono text-primary">{item.price_net.toFixed(2)} €</p>
                          </div>
                          <div className="bg-slate-50 rounded-md p-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Einheit</p>
                            <p className="text-lg font-bold">{item.unit}</p>
                          </div>
                        </div>
                        {item.category && (
                          <p className="text-xs text-muted-foreground mb-3">Kategorie: <span className="font-medium">{item.category}</span></p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); addFromStamm(item); toast.success(`"${item.name}" hinzugefügt`); }}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                            data-testid={`btn-add-item-${item.id}`}
                          >
                            <Plus className="w-4 h-4" />
                            Ins Dokument
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/articles`); }}
                            className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
                            data-testid={`btn-edit-item-${item.id}`}
                          >
                            <Edit className="w-4 h-4" />
                            Bearbeiten
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-2">Oder per Drag & Drop ins Dokument ziehen</p>
                      </div>
                    )}
                  </div>
                ))}
                {(sidebarTab === "services" ? filteredServices : filteredArticles).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    {sidebarSearch ? "Keine Ergebnisse" : `Keine ${sidebarTab === "services" ? "Leistungen" : "Artikel"} vorhanden`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* === CENTER: Document === */}
          <div>
            {/* Mobile Side Tools (unchanged) */}
            <div className="mb-3 lg:mb-4 flex gap-2 flex-wrap lg:hidden">
            <select
              value=""
              onChange={(e) => {
                const item = articles.find(a => a.id === e.target.value);
                if (item) { addFromStamm(item); toast.success(`"${item.name}" hinzugefügt`); }
              }}
              className="h-8 rounded-sm border border-input bg-card px-2 text-xs flex-1 min-w-0"
              data-testid="mobile-add-item"
            >
              <option value="">+ Aus Stammdaten</option>
              <optgroup label="Leistungen">
                {articles.filter(a => a.typ === "Leistung" || a.typ === "Fremdleistung").map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.price_net}€){a.typ === "Fremdleistung" ? " [Sub]" : ""}</option>
                ))}
              </optgroup>
              <optgroup label="Artikel">
                {articles.filter(a => a.typ === "Artikel").map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.price_net}€)</option>
                ))}
              </optgroup>
            </select>
            </div>
            {/* Status Dropdown (all screen sizes) */}
            {!isNew && (
              <div className="mb-3 lg:mb-4">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-8 lg:h-9 rounded-sm border border-input bg-card px-2 lg:px-3 text-xs lg:text-sm"
              >
                {type === "quote" && (
                  <>
                    <option value="Entwurf">Status: Entwurf</option>
                    <option value="Gesendet">Status: Gesendet</option>
                    <option value="Beauftragt">Status: Beauftragt</option>
                    <option value="Abgelehnt">Status: Abgelehnt</option>
                  </>
                )}
                {type === "order" && (
                  <>
                    <option value="Offen">Status: Offen</option>
                    <option value="In Arbeit">Status: In Arbeit</option>
                    <option value="Abgeschlossen">Status: Abgeschlossen</option>
                  </>
                )}
                {type === "invoice" && (
                  <>
                    <option value="Offen">Status: Offen</option>
                    <option value="Gesendet">Status: Gesendet</option>
                    <option value="Bezahlt">Status: Bezahlt</option>
                    <option value="Überfällig">Status: Überfällig</option>
                  </>
                )}
              </select>
              </div>
            )}

          {/* Paper Document - Drop Zone */}
          <div
            className="bg-white shadow-xl rounded-sm border"
            style={{ minHeight: "600px" }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            data-testid="document-drop-zone"
          >
            {/* Document Header */}
            <div className="p-4 lg:p-10 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                {/* Left: Document Title & Info */}
                <div>
                  <h2 className="text-2xl lg:text-4xl font-bold text-primary tracking-tight mb-2 lg:mb-4">
                    {titles[type].toUpperCase()}
                  </h2>
                  <div className="space-y-0.5 text-xs lg:text-sm text-muted-foreground">
                    <p>{type === "quote" ? "Angebots-Nr." : type === "order" ? "Auftrags-Nr." : "Rechnungs-Nr."}: {docNumber || "(wird beim Speichern vergeben)"}</p>
                    <p>Datum: {new Date(createdAt).toLocaleDateString("de-DE")}</p>
                  </div>
                </div>
                {/* Right: Company Info */}
                <div className="sm:text-right">
                  <p className="font-bold text-base lg:text-lg">{settings.company_name || "Ihr Firmenname"}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground whitespace-pre-line">
                    {settings.address || "Ihre Adresse"}
                  </p>
                  {settings.phone && <p className="text-xs lg:text-sm text-muted-foreground">Tel: {settings.phone}</p>}
                  {settings.email && <p className="text-xs lg:text-sm text-muted-foreground">{settings.email}</p>}
                </div>
              </div>
            </div>

            {/* Customer Selection / Address */}
            <div className="px-4 lg:px-10 py-4 lg:py-6 border-b bg-slate-50/50">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">Kunde:</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full max-w-md h-10 rounded-sm border border-input bg-white px-3"
                  data-testid="wysiwyg-customer-select"
                >
                  <option value="">Kunde auswählen...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.customer_type !== "Privat" ? `(${c.customer_type})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {customer && (
                <div className="mt-3">
                  <p className="font-semibold text-lg">{customer.name}</p>
                  {customer.address && (
                    <p className="text-muted-foreground whitespace-pre-line">{customer.address.split(/,\s*/).join("\n")}</p>
                  )}
                  {customer.address && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await api.post("/calculate-distance", { to_address: customer.address });
                          const d = res.data;
                          if (window.confirm(
                            `Entfernung: ${d.distance_km} km (ca. ${d.duration_minutes} Min.)\n` +
                            `km-Kosten: ${d.km_cost.toFixed(2)} €\n` +
                            `Fahrzeit-Kosten: ${d.time_cost.toFixed(2)} €\n` +
                            `Gesamt: ${d.total_cost.toFixed(2)} € netto\n\n` +
                            `Als Position "Fahrtkostenanteil" hinzufügen?`
                          )) {
                            setPositions(prev => [...prev, {
                              pos_nr: prev.length + 1,
                              description: `Fahrtkostenanteil (${d.distance_km} km, ca. ${d.duration_minutes} Min.)`,
                              quantity: 1,
                              unit: "pauschal",
                              price_net: d.total_cost
                            }]);
                          }
                        } catch (err) {
                          toast.error(err?.response?.data?.detail || "Entfernung konnte nicht berechnet werden. Bitte Firmenstandort in den Einstellungen hinterlegen.");
                        }
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      data-testid="btn-calc-travel"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      Fahrtkosten berechnen
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Betreff */}
            <div className="px-4 lg:px-10 py-3 lg:py-4 border-b">
              <TextTemplateSelect
                docType={docTypeMap[type]}
                textType="betreff"
                value={betreff}
                onChange={setBetreff}
                customer={customer}
                settings={settings}
                docNumber={docNumber}
              />
            </div>

            {/* Vortext */}
            <div className="px-4 lg:px-10 py-3 lg:py-4 border-b">
              <TextTemplateSelect
                docType={docTypeMap[type]}
                textType="vortext"
                value={vortext}
                onChange={setVortext}
                customer={customer}
                settings={settings}
                docNumber={docNumber}
              />
            </div>

            {/* Positions Table - Editable */}
            <div className="px-4 lg:px-10 py-4 lg:py-8">
              {/* Mobile Positions - Card Layout */}
              <div className="lg:hidden space-y-3">
                {positions.map((pos, idx) => (
                  <div key={idx} className="border rounded-sm p-3 bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          {idx > 0 && <button onClick={() => movePosition(idx, idx - 1)} className="p-0.5 hover:bg-muted rounded text-muted-foreground"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg></button>}
                          {idx < positions.length - 1 && <button onClick={() => movePosition(idx, idx + 1)} className="p-0.5 hover:bg-muted rounded text-muted-foreground"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg></button>}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">Pos. {pos.pos_nr}</span>
                      </div>
                      <button onClick={() => removePosition(idx)} className="p-1 hover:bg-destructive/10 rounded-sm">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                    <textarea
                      value={pos.description}
                      onChange={(e) => updatePosition(idx, "description", e.target.value)}
                      placeholder="Beschreibung..."
                      rows={1}
                      className="w-full border rounded px-2 py-1.5 text-sm mb-2 resize-none overflow-hidden"
                      style={{ minHeight: "36px" }}
                      onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.max(36, e.target.scrollHeight) + "px"; }}
                      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(36, el.scrollHeight) + "px"; } }}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Menge</label>
                        <input type="number" step="0.01" value={pos.quantity}
                          onChange={(e) => updatePosition(idx, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1.5 text-sm text-center font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Einheit</label>
                        <input value={pos.unit}
                          onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-sm text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Preis (€)</label>
                        <input type="number" step="0.01" value={pos.price_net}
                          onChange={(e) => updatePosition(idx, "price_net", parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1.5 text-sm text-right font-mono" />
                      </div>
                    </div>
                    <div className="text-right mt-2 font-mono text-sm font-semibold">
                      = {((pos.quantity || 0) * (pos.price_net || 0)).toFixed(2)} €
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Positions - Table */}
              <table className="hidden lg:table w-full">
                <thead>
                  <tr className="border-b-2 border-primary/30">
                    <th className="w-8"></th>
                    <th className="text-left py-3 text-sm font-semibold text-primary w-12">Pos</th>
                    <th className="text-left py-3 text-sm font-semibold text-primary">Beschreibung</th>
                    <th className="text-right py-3 text-sm font-semibold text-primary" style={{ width: "70px" }}>Menge</th>
                    <th className="text-left py-3 text-sm font-semibold text-primary pl-2" style={{ width: "70px" }}>Einheit</th>
                    <th className="text-right py-3 text-sm font-semibold text-primary" style={{ width: "100px" }}>Einzelpreis</th>
                    <th className="text-right py-3 text-sm font-semibold text-primary" style={{ width: "100px" }}>Gesamt</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, idx) => (
                    <tr key={idx}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={() => { movePosition(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); }}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      className={`border-b border-slate-100 group transition-colors ${dragOverIndex === idx ? "bg-primary/5 border-primary/30" : ""} ${dragIndex === idx ? "opacity-40" : ""}`}
                    >
                      <td className="py-2 align-bottom">
                        <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground align-top">{pos.pos_nr}</td>
                      <td className="py-2">
                        <textarea value={pos.description}
                          onChange={(e) => updatePosition(idx, "description", e.target.value)}
                          placeholder="Beschreibung eingeben..."
                          rows={1}
                          className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm resize-none overflow-hidden"
                          style={{ minHeight: "32px" }}
                          onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.max(32, e.target.scrollHeight) + "px"; }}
                          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(32, el.scrollHeight) + "px"; } }}
                        />
                      </td>
                      <td className="py-2 align-bottom">
                        <input type="number" step="0.01" value={pos.quantity}
                          onChange={(e) => updatePosition(idx, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm text-right font-mono" />
                      </td>
                      <td className="py-2 align-bottom">
                        <input type="text" value={pos.unit}
                          onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="py-2 align-bottom">
                        <div className="flex items-center justify-end">
                          <input type="number" step="0.01" value={pos.price_net}
                            onChange={(e) => updatePosition(idx, "price_net", parseFloat(e.target.value) || 0)}
                            className="w-20 bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm text-right font-mono" />
                          <span className="text-sm text-muted-foreground ml-1">€</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-sm align-bottom">
                        {((pos.quantity || 0) * (pos.price_net || 0)).toFixed(2)} €
                      </td>
                      <td className="py-3 align-bottom">
                        <button onClick={() => removePosition(idx)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add Position Button */}
              <button
                onClick={addPosition}
                data-testid="btn-add-position"
                className="mt-4 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Position hinzufügen
              </button>
            </div>

            {/* Totals */}
            <div className="px-4 lg:px-10 py-4 lg:py-6 border-t">
              <div className="flex justify-end">
                <div className="w-full sm:w-72 space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Netto</span>
                    <span className="font-mono">{subtotal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between py-2 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">MwSt</span>
                      <select
                        value={vatRate}
                        onChange={(e) => setVatRate(parseFloat(e.target.value))}
                        className="h-7 text-xs border rounded px-1 bg-white"
                      >
                        <option value={19}>19%</option>
                        <option value={7}>7%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                    <span className="font-mono">{vat.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
                    <span>Gesamt</span>
                    <span className="font-mono">{total.toFixed(2)} €</span>
                  </div>
                  {type === "invoice" && (
                    <>
                      <div className="flex justify-between py-2 items-center">
                        <span className="text-muted-foreground">Anzahlung</span>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="0.01"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                            className="w-20 border rounded px-2 py-1 text-sm text-right font-mono"
                          />
                          <span className="ml-1">€</span>
                        </div>
                      </div>
                      {depositAmount > 0 && (
                        <div className="flex justify-between py-2 text-primary font-semibold">
                          <span>Restbetrag</span>
                          <span className="font-mono">{final.toFixed(2)} €</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="px-4 lg:px-10 py-4 lg:py-6 border-t">
              <label className="text-sm font-medium text-muted-foreground block mb-2">Anmerkungen:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Anmerkungen..."
                className="w-full bg-slate-50 border rounded-sm px-3 lg:px-4 py-2 lg:py-3 text-sm min-h-[60px] lg:min-h-[80px] focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Schlusstext */}
            <div className="px-4 lg:px-10 py-3 lg:py-4 border-t">
              <TextTemplateSelect
                docType={docTypeMap[type]}
                textType="schlusstext"
                value={schlusstext}
                onChange={setSchlusstext}
                customer={customer}
                settings={settings}
                docNumber={docNumber}
              />
            </div>

            {/* Footer */}
            {type === "invoice" && settings.iban && (
              <div className="px-4 lg:px-10 py-4 lg:py-6 border-t bg-slate-50/50 text-xs lg:text-sm text-muted-foreground">
                <p className="font-medium mb-1">Bankverbindung:</p>
                <p className="break-all">{settings.bank_name} | IBAN: {settings.iban} | BIC: {settings.bic}</p>
                {settings.tax_id && <p className="mt-2">Steuernummer: {settings.tax_id}</p>}
              </div>
            )}
          </div>
          </div>

          {/* === RIGHT SIDEBAR: Vorlagen & Kalkulation (Desktop only) === */}
          <div className="hidden lg:block">
            <div className="sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto space-y-3 pl-1">

              {/* Right Tabs */}
              <div className="flex rounded-md border border-input overflow-hidden">
                <button
                  onClick={() => setRightTab("vorlagen")}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${rightTab === "vorlagen" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                  data-testid="tab-vorlagen"
                >
                  <Bookmark className="w-3.5 h-3.5 inline mr-1" />
                  Vorlagen
                </button>
                <button
                  onClick={() => setRightTab("kalkulation")}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${rightTab === "kalkulation" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                  data-testid="tab-kalkulation"
                >
                  <Calculator className="w-3.5 h-3.5 inline mr-1" />
                  Kalkulation
                </button>
              </div>

              {/* Vorlagen Tab */}
              {rightTab === "vorlagen" && (
                <div className="space-y-3">
                  {/* Templates */}
                  <div className="rounded-md border border-input bg-card overflow-hidden">
                    <div className="p-2.5 border-b bg-amber-50/50">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />
                        Vorlagen
                      </p>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-[240px] overflow-y-auto">
                      {templateDocs.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Noch keine Vorlagen. Markieren Sie ein bestehendes {titles[type]} als Vorlage.
                        </p>
                      )}
                      {templateDocs.map(doc => (
                        <div key={doc.id} className="rounded-md border border-input hover:border-primary/30 transition-all">
                          <button
                            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                            className="w-full flex items-center justify-between p-2 text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{doc.quote_number || doc.order_number || doc.invoice_number}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{doc.customer_name} · {doc.total_gross?.toFixed(0)}€</p>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${expandedDoc === doc.id ? "rotate-180" : ""}`} />
                          </button>
                          {expandedDoc === doc.id && (
                            <div className="border-t p-2 bg-slate-50/50 space-y-1">
                              {(doc.positions || []).map((p, i) => (
                                <p key={i} className="text-[10px] text-muted-foreground">
                                  {p.pos_nr}. {p.description} — {p.quantity}x {p.price_net?.toFixed(2)}€
                                </p>
                              ))}
                              <button
                                onClick={() => copyPositionsFromDoc(doc)}
                                className="w-full mt-1.5 flex items-center justify-center gap-1 h-7 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                                data-testid={`btn-copy-positions-${doc.id}`}
                              >
                                <Copy className="w-3 h-3" />
                                Positionen übernehmen
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Similar Documents */}
                  <div className="rounded-md border border-input bg-card overflow-hidden">
                    <div className="p-2.5 border-b bg-blue-50/50">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <FileSearch className="w-3.5 h-3.5 text-blue-600" />
                        Ähnliche {titles[type]}
                      </p>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-[240px] overflow-y-auto">
                      {similarDocs.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Keine ähnlichen {titles[type]} gefunden
                        </p>
                      )}
                      {similarDocs.map(doc => (
                        <div key={doc.id} className="rounded-md border border-input hover:border-blue-300 transition-all">
                          <div className="flex items-center justify-between p-2">
                            <button
                              onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                              className="min-w-0 text-left flex-1"
                            >
                              <p className="text-xs font-medium truncate">{doc.quote_number || doc.order_number || doc.invoice_number}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{doc.customer_name} · {doc.total_gross?.toFixed(0)}€</p>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleDocTemplate(doc.id)}
                                className="p-1 hover:bg-amber-100 rounded transition-colors"
                                title="Als Vorlage markieren"
                              >
                                <Bookmark className="w-3 h-3 text-muted-foreground hover:text-amber-600" />
                              </button>
                              <button
                                onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                                className="p-1"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedDoc === doc.id ? "rotate-180" : ""}`} />
                              </button>
                            </div>
                          </div>
                          {expandedDoc === doc.id && (
                            <div className="border-t p-2 bg-slate-50/50 space-y-1">
                              {(doc.positions || []).map((p, i) => (
                                <p key={i} className="text-[10px] text-muted-foreground">
                                  {p.pos_nr}. {p.description} — {p.quantity}x {p.price_net?.toFixed(2)}€
                                </p>
                              ))}
                              <div className="flex gap-1 mt-1.5">
                                <button
                                  onClick={() => copyPositionsFromDoc(doc)}
                                  className="flex-1 flex items-center justify-center gap-1 h-7 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                                  data-testid={`btn-copy-positions-${doc.id}`}
                                >
                                  <Copy className="w-3 h-3" />
                                  Übernehmen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Kalkulation Tab */}
              {rightTab === "kalkulation" && (() => {
                const kalk = calculateKalkulation();
                return (
                  <div className="rounded-md border border-input bg-card p-3 space-y-3">
                    {/* Revenue Summary */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Erlöse</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Netto</span>
                        <span className="font-mono font-medium">{subtotal.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">MwSt ({vatRate}%)</span>
                        <span className="font-mono">{vat.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-1.5">
                        <span>Brutto</span>
                        <span className="font-mono">{total.toFixed(2)} €</span>
                      </div>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Cost Calculation */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Kosten pro Position</p>
                      <p className="text-[10px] text-muted-foreground">EK-Preise eingeben für Margenberechnung</p>
                      {positions.map((pos, idx) => pos.description && (
                        <div key={idx} className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground w-5 shrink-0">{pos.pos_nr}.</span>
                          <span className="truncate flex-1" title={pos.description}>
                            {pos.description.substring(0, 20)}{pos.description.length > 20 ? "…" : ""}
                          </span>
                          <div className="flex items-center shrink-0">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="EK"
                              value={costPrices[idx] || ""}
                              onChange={(e) => updateCostPrice(idx, e.target.value)}
                              className="w-16 h-6 border rounded px-1.5 text-xs text-right font-mono bg-slate-50 focus:ring-1 focus:ring-primary/30"
                              data-testid={`cost-price-${idx}`}
                            />
                            <span className="text-muted-foreground ml-0.5">€</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Margin Result */}
                    {kalk.hasCosts && (
                      <>
                        <div className="h-px bg-border" />
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ergebnis</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Erlöse (Netto)</span>
                            <span className="font-mono">{kalk.revenue.toFixed(2)} €</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Kosten</span>
                            <span className="font-mono text-red-600">-{kalk.costs.toFixed(2)} €</span>
                          </div>
                          <div className={`flex justify-between text-sm font-bold border-t pt-1.5 ${kalk.margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              Marge
                            </span>
                            <span className="font-mono">{kalk.margin.toFixed(2)} €</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Marge in %</span>
                            <span className={`font-mono font-semibold ${kalk.marginPercent >= 20 ? "text-emerald-600" : kalk.marginPercent >= 0 ? "text-amber-600" : "text-red-600"}`}>
                              {kalk.marginPercent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${kalk.marginPercent >= 20 ? "bg-emerald-500" : kalk.marginPercent >= 0 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(Math.max(kalk.marginPercent, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {!kalk.hasCosts && (
                      <div className="text-xs text-muted-foreground bg-slate-50 rounded-md p-2.5 text-center">
                        Tragen Sie EK-Preise ein, um die Marge zu berechnen
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Quick Info (always visible) */}
              <div className="rounded-md border border-input bg-card p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Übersicht</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-md p-2 text-center">
                    <p className="text-lg font-bold font-mono text-primary">{positions.filter(p => p.description).length}</p>
                    <p className="text-[10px] text-muted-foreground">Positionen</p>
                  </div>
                  <div className="bg-slate-50 rounded-md p-2 text-center">
                    <p className="text-lg font-bold font-mono text-primary">{total.toFixed(0)}€</p>
                    <p className="text-[10px] text-muted-foreground">Brutto</p>
                  </div>
                </div>
                {customer && (
                  <div className="bg-slate-50 rounded-md p-2">
                    <p className="text-[10px] text-muted-foreground">Kunde</p>
                    <p className="text-sm font-medium truncate">{customer.name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Settings Slide-Over Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex" data-testid="settings-overlay">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative ml-auto w-full max-w-4xl bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Einstellungen</h2>
              <Button variant="outline" size="sm" onClick={() => { setShowSettings(false); loadData(); }} data-testid="btn-close-settings">
                <ArrowLeft className="w-4 h-4" /> Zurück zum Dokument
              </Button>
            </div>
            <div className="p-6">
              <SettingsPage />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export { WysiwygDocumentEditor };
