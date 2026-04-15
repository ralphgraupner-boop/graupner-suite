import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { api, API } from "@/lib/api";
import { TextTemplateSelect } from "@/components/TextTemplateSelect";

// Sub-components
import { EditorToolbar } from "@/components/wysiwyg/EditorToolbar";
import { EditorSidebar } from "@/components/wysiwyg/EditorSidebar";
import { DocumentHeader } from "@/components/wysiwyg/DocumentHeader";
import { PositionsTable } from "@/components/wysiwyg/PositionsTable";
import { TotalsSection } from "@/components/wysiwyg/TotalsSection";
import { RightSidebar } from "@/components/wysiwyg/RightSidebar";
import { EmailDialog } from "@/components/wysiwyg/EmailDialog";
import { SettingsSlideOver } from "@/components/wysiwyg/SettingsSlideOver";
import { DocumentPreview } from "@/components/DocumentPreview";

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
  const [settingsTab, setSettingsTab] = useState("settings");
  
  // Document state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customer, setCustomer] = useState(null);
  const [positions, setPositions] = useState([
    { type: "position", pos_nr: 1, description: "", quantity: 1, unit: "Stück", price_net: 0 }
  ]);
  const [notes, setNotes] = useState("");
  const [vortext, setVortext] = useState("");
  const [schlusstext, setSchlusstext] = useState("");
  const [betreff, setBetreff] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("percent");
  const [status, setStatus] = useState(type === "quote" ? "Entwurf" : "Offen");
  const [depositAmount, setDepositAmount] = useState(0);
  const [docNumber, setDocNumber] = useState("");
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());
  
  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Sidebar & UI state
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarTab, setSidebarTab] = useState("services");
  const [costPrices, setCostPrices] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [templateDocs, setTemplateDocs] = useState([]);
  const [similarDocs, setSimilarDocs] = useState([]);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [showVorlagen, setShowVorlagen] = useState(false);
  const [activeKalkIdx, setActiveKalkIdx] = useState(null);
  const [titelTemplates, setTitelTemplates] = useState([]);
  const [titelDropdownIdx, setTitelDropdownIdx] = useState(null);
  const [stammChangeIdx, setStammChangeIdx] = useState(null);
  const [leistungsBloecke, setLeistungsBloecke] = useState([]);
  const [selectedPositions, setSelectedPositions] = useState(new Set());
  const [blockSaveName, setBlockSaveName] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [saveAsArticleIdx, setSaveAsArticleIdx] = useState(null);
  const [saveAsType, setSaveAsType] = useState("Leistung");

  // E-Mail Dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [emailForm, setEmailForm] = useState({ to_email: "", subject: "", message: "" });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState([]);

  const titles = { quote: "Angebot", order: "Auftragsbestätigung", invoice: "Rechnung" };
  const listPaths = { quote: "/quotes", order: "/orders", invoice: "/invoices" };
  const docTypeMap = { quote: "angebot", order: "auftrag", invoice: "rechnung" };

  // ==================== DATA LOADING ====================
  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [settingsRes, kontaktRes, modulArtikelRes, kundenModulRes] = await Promise.all([
        api.get("/settings"),
        api.get("/modules/kontakt/data").catch(() => ({ data: [] })),
        api.get("/modules/artikel/data").catch(() => ({ data: [] })),
        api.get("/modules/kunden/data").catch(() => ({ data: [] }))
      ]);
      // NUR Modul-Daten verwenden (kein Legacy)
      const kontaktData = (kontaktRes.data || []).map(k => ({
        ...k,
        name: `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.firma || "Unbekannt",
        address: `${k.strasse || ""} ${k.hausnummer || ""}, ${k.plz || ""} ${k.ort || ""}`.trim().replace(/^,\s*/, "").replace(/,\s*$/, ""),
        _source: "kontakt-modul"
      }));
      const kundenModulData = (kundenModulRes.data || []).map(k => ({
        ...k,
        name: `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.firma || "Unbekannt",
        address: k.address || `${k.strasse || ""} ${k.hausnummer || ""}, ${k.plz || ""} ${k.ort || ""}`.trim().replace(/^,\s*/, "").replace(/,\s*$/, ""),
        _source: "kunden-modul"
      }));
      // Deduplizierung per E-Mail
      const seenEmails = new Set();
      const allModulCustomers = [...kundenModulData, ...kontaktData].filter(c => {
        if (!c.email) return true;
        const lower = c.email.toLowerCase();
        if (seenEmails.has(lower)) return false;
        seenEmails.add(lower);
        return true;
      });
      setCustomers(allModulCustomers);
      // NUR Modul-Artikel verwenden
      const modulArtikel = modulArtikelRes.data || [];
      setArticles(modulArtikel.filter(a => a.typ === "Artikel"));
      setServices(modulArtikel.filter(a => a.typ === "Leistung" || a.typ === "Fremdleistung"));
      setSettings(settingsRes.data);

      try { const titelRes = await api.get("/modules/textvorlagen/data", { params: { text_type: "titel" } }); setTitelTemplates(titelRes.data); } catch {}
      try { const blockRes = await api.get("/leistungsbloecke"); setLeistungsBloecke(blockRes.data); } catch {}

      if (!isNew) {
        const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
        const res = await api.get(`/${endpoint}/${id}`);
        const doc = res.data;
        setSelectedCustomerId(doc.customer_id);
        setCustomer({ name: doc.customer_name, address: doc.customer_address });
        setPositions((doc.positions || []).map(p => ({ ...p, type: p.type || "position" })));
        setNotes(doc.notes || ""); setVortext(doc.vortext || ""); setSchlusstext(doc.schlusstext || "");
        setBetreff(doc.betreff || ""); setVatRate(doc.vat_rate || 19);
        setDiscount(doc.discount || 0); setDiscountType(doc.discount_type || "percent");
        setStatus(doc.status || ""); setDepositAmount(doc.deposit_amount || 0);
        setDocNumber(doc.quote_number || doc.order_number || doc.invoice_number);
        setCreatedAt(doc.created_at);
      } else {
        const params = new URLSearchParams(location.search);
        const preselectedCustomerId = params.get("customer");
        if (preselectedCustomerId) {
          const cust = allModulCustomers.find(c => c.id === preselectedCustomerId);
          if (cust) { setSelectedCustomerId(preselectedCustomerId); setCustomer(cust); }
        }
      }
    } catch { toast.error("Fehler beim Laden der Daten"); } finally { setLoading(false); }
  };

  // ==================== HANDLERS ====================
  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find(c => c.id === customerId) || null;
    if (cust) {
      // Adresse zusammenbauen falls Einzelfelder vorhanden
      const addr = cust.address || `${cust.strasse || ""} ${cust.hausnummer || ""}, ${cust.plz || ""} ${cust.ort || ""}`.trim().replace(/^,\s*/, "").replace(/,\s*$/, "");
      const name = (cust.vorname || cust.nachname) ? `${cust.vorname || ""} ${cust.nachname || ""}`.trim() : cust.name;
      setCustomer({ ...cust, name, address: addr });
    } else {
      setCustomer(null);
    }
  };

  const addPosition = () => setPositions([...positions, { type: "position", pos_nr: 0, description: "", quantity: 1, unit: "Stück", price_net: 0 }]);
  const addTitel = () => setPositions([...positions, { type: "titel", pos_nr: 0, description: "" }]);

  const saveTitelTemplate = async (name) => {
    if (!name?.trim() || titelTemplates.some(t => t.content === name.trim())) return;
    try {
      await api.post("/modules/textvorlagen/data", { doc_type: "allgemein", text_type: "titel", title: name.trim(), content: name.trim() });
      const res = await api.get("/modules/textvorlagen/data", { params: { text_type: "titel" } });
      setTitelTemplates(res.data); toast.success("Titel-Vorlage gespeichert!");
    } catch { toast.error("Fehler beim Speichern"); }
  };

  const togglePositionSelect = (idx) => {
    setSelectedPositions(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  };

  const saveAsLeistungsBlock = async () => {
    if (!blockSaveName.trim() || selectedPositions.size === 0) return;
    const blockPositions = [...selectedPositions].sort().map(idx => {
      const p = positions[idx];
      return { type: p.type, description: p.description, quantity: p.quantity || 0, unit: p.unit || "Stück", price_net: p.price_net || 0 };
    });
    try {
      await api.post("/leistungsbloecke", { name: blockSaveName.trim(), positions: blockPositions });
      const res = await api.get("/leistungsbloecke"); setLeistungsBloecke(res.data);
      setSelectedPositions(new Set()); setBlockSaveName(""); toast.success("Leistungsblock gespeichert!");
    } catch { toast.error("Fehler beim Speichern"); }
  };

  const insertLeistungsBlock = (block) => {
    const newPositions = block.positions.map((p, i) => ({ ...p, pos_nr: positions.length + i + 1 }));
    setPositions([...positions, ...newPositions]);
    toast.success(`Block "${block.name}" eingefügt (${block.positions.length} Positionen)`);
  };

  const deleteLeistungsBlock = async (blockId) => {
    try { await api.delete(`/leistungsbloecke/${blockId}`); setLeistungsBloecke(prev => prev.filter(b => b.id !== blockId)); toast.success("Block gelöscht"); } catch { toast.error("Fehler beim Löschen"); }
  };

  const updatePosition = (index, field, value) => {
    const updated = [...positions]; updated[index][field] = value; setPositions(updated);
  };

  const checkStammChange = (idx) => {
    const pos = positions[idx]; if (!pos?.source_article_id) return;
    const changed = pos.description !== pos.original_description || pos.unit !== pos.original_unit || pos.price_net !== pos.original_price_net;
    if (changed) setStammChangeIdx(idx);
  };

  const saveToStamm = async (idx) => {
    const pos = positions[idx]; if (!pos?.source_article_id) return;
    try {
      const descParts = pos.description.split(" - ");
      const updateData = { name: descParts[0] || pos.description, description: descParts.slice(1).join(" - ") || "", unit: pos.unit, price_net: pos.price_net };
      await api.put(`/modules/artikel/data/${pos.source_article_id}`, updateData);
      const updated = [...positions];
      updated[idx].original_description = pos.description; updated[idx].original_unit = pos.unit; updated[idx].original_price_net = pos.price_net;
      setPositions(updated); toast.success("Stammdaten aktualisiert!");
      const artRes = await api.get("/modules/artikel/data");
      setArticles((artRes.data || []).filter(a => a.typ === "Artikel"));
      setServices((artRes.data || []).filter(a => a.typ === "Leistung" || a.typ === "Fremdleistung"));
    } catch { toast.error("Fehler beim Aktualisieren der Stammdaten"); }
    setStammChangeIdx(null);
  };

  const removePosition = (index) => { if (positions.length <= 1) return; setPositions(positions.filter((_, i) => i !== index)); };
  const movePosition = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= positions.length) return;
    const updated = [...positions]; const [moved] = updated.splice(fromIndex, 1); updated.splice(toIndex, 0, moved); setPositions(updated);
  };

  const handleSavePositionAsArticle = async (idx) => {
    const pos = positions[idx];
    if (!pos.description?.trim()) { toast.error("Beschreibung erforderlich"); return; }
    try {
      const res = await api.post("/modules/artikel/data", { name: pos.description.trim(), typ: saveAsType, price_net: pos.price_net || 0, unit: pos.unit || "Stück" });
      toast.success(`Als ${saveAsType} gespeichert: ${res.data.artikel_nr}`);
      updatePosition(idx, "artikel_nr", res.data.artikel_nr); setSaveAsArticleIdx(null);
      const artRes = await api.get("/modules/artikel/data");
      setArticles((artRes.data || []).filter(a => a.typ === "Artikel"));
      setServices((artRes.data || []).filter(a => a.typ === "Leistung" || a.typ === "Fremdleistung"));
    } catch { toast.error("Fehler beim Speichern"); }
  };

  const addFromStamm = (item, atIndex) => {
    const desc = item.name + (item.description ? ` - ${item.description}` : "");
    const newPos = { type: "position", pos_nr: 0, description: desc, quantity: 1, unit: item.unit, price_net: item.price_net, source_article_id: item.id, original_description: desc, original_unit: item.unit, original_price_net: item.price_net };
    const insertIdx = atIndex != null ? atIndex : positions.length;
    const updated = [...positions];
    updated.splice(insertIdx, 0, newPos);
    setPositions(updated);
    const ekPrice = item.ek_preis || item.purchase_price || 0;
    if (ekPrice > 0) {
      // Shift cost prices for positions after the insert point
      const newCosts = {};
      Object.entries(costPrices).forEach(([k, v]) => {
        const idx = parseInt(k);
        if (idx >= insertIdx) newCosts[idx + 1] = v;
        else newCosts[idx] = v;
      });
      newCosts[insertIdx] = ekPrice;
      setCostPrices(newCosts);
    }
  };

  const handleDragStart = (e, item) => { e.dataTransfer.setData("application/json", JSON.stringify(item)); e.dataTransfer.effectAllowed = "copy"; };

  const handleApplyKalkPrice = async (item, newPrice, newEk) => {
    if (!item?.id) return;
    try {
      await api.put(`/modules/artikel/data/${item.id}`, { price_net: newPrice, ek_preis: newEk });
      toast.success(`VK-Preis für "${item.name}" auf ${newPrice.toFixed(2)} € aktualisiert`);
      const artRes = await api.get("/modules/artikel/data");
      setArticles((artRes.data || []).filter(a => a.typ === "Artikel"));
      setServices((artRes.data || []).filter(a => a.typ === "Leistung" || a.typ === "Fremdleistung"));
    } catch { toast.error("Fehler beim Aktualisieren"); }
  };
  const openPositionKalk = (idx) => {
    const pos = positions[idx];
    if (!pos || pos.type === "titel") return;
    setActiveKalkIdx(idx);
    setShowVorlagen(false);
  };

  const getActiveKalkItem = () => {
    if (activeKalkIdx == null) return null;
    const pos = positions[activeKalkIdx];
    if (!pos || pos.type === "titel") return null;
    if (pos.source_article_id) {
      const allItems = [...articles, ...services];
      const found = allItems.find(a => a.id === pos.source_article_id);
      if (found) return { ...found, _posIdx: activeKalkIdx };
    }
    const descParts = (pos.description || "").split("\n")[0].split(" - ");
    return {
      id: null,
      name: descParts[0] || `Position ${numbering[activeKalkIdx]}`,
      price_net: pos.price_net || 0,
      ek_preis: costPrices[activeKalkIdx] || 0,
      _posIdx: activeKalkIdx,
      _noSource: true,
    };
  };

  const handleKalkApply = (item, newPrice, newEk) => {
    if (item?._posIdx != null) {
      updatePosition(item._posIdx, "price_net", newPrice);
      if (newEk > 0) setCostPrices(prev => ({ ...prev, [item._posIdx]: newEk }));
    }
  };

  const handleSaveKalkToStamm = async (item, kalkData) => {
    if (!item?.id) return;
    try {
      await api.put(`/modules/artikel/data/${item.id}`, {
        price_net: kalkData.vkPreis,
        ek_preis: kalkData.ek,
      });
      await api.post("/kalkulation", {
        article_id: item.id, article_name: item.name, ek: kalkData.ek,
        zeit_meister: kalkData.zeitMeister, zeit_geselle: kalkData.zeitGeselle,
        zeit_azubi: kalkData.zeitAzubi, zeit_helfer: kalkData.zeitHelfer,
        rate_meister: kalkData.meisterRate, rate_geselle: kalkData.geselleRate,
        rate_azubi: kalkData.azubiRate, rate_helfer: kalkData.helferRate,
        sonstige_kosten: kalkData.sonstige, materialzuschlag: kalkData.materialzuschlag,
        gewinnaufschlag: kalkData.gewinnaufschlag, lohnkosten: kalkData.lohnkosten,
        sonstige_summe: kalkData.sonstigeSum, zwischensumme: kalkData.zwischensumme,
        material_betrag: kalkData.materialBetrag, gewinn_betrag: kalkData.gewinnBetrag,
        vk_preis: kalkData.vkPreis,
      });
      toast.success("Stammdaten aktualisiert");
      loadData();
    } catch { toast.error("Fehler beim Speichern"); }
  };

  const handleCreateFromKalk = async (kalkData, typ) => {
    const pos = activeKalkIdx != null ? positions[activeKalkIdx] : null;
    if (!pos) return;
    const name = (pos.description || "").split("\n")[0].trim();
    try {
      const res = await api.post("/modules/artikel/data", {
        name, typ, price_net: kalkData.vkPreis, ek_preis: kalkData.ek,
        unit: pos.unit || (typ === "Leistung" ? "Stunde" : "Stück"),
        description: pos.description || "",
      });
      const newArticle = res.data;
      const newId = newArticle.id;
      if (newId) {
        await api.post("/kalkulation", {
          article_id: newId, article_name: name, ek: kalkData.ek,
          zeit_meister: kalkData.zeitMeister, zeit_geselle: kalkData.zeitGeselle,
          zeit_azubi: kalkData.zeitAzubi, zeit_helfer: kalkData.zeitHelfer,
          rate_meister: kalkData.meisterRate, rate_geselle: kalkData.geselleRate,
          rate_azubi: kalkData.azubiRate, rate_helfer: kalkData.helferRate,
          sonstige_kosten: kalkData.sonstige, materialzuschlag: kalkData.materialzuschlag,
          gewinnaufschlag: kalkData.gewinnaufschlag, lohnkosten: kalkData.lohnkosten,
          sonstige_summe: kalkData.sonstigeSum, zwischensumme: kalkData.zwischensumme,
          material_betrag: kalkData.materialBetrag, gewinn_betrag: kalkData.gewinnBetrag,
          vk_preis: kalkData.vkPreis,
        });
        updatePosition(activeKalkIdx, "source_article_id", newId);
        // Immediately add article to local state to avoid race condition
        if (typ === "Artikel") {
          setArticles(prev => [...prev, newArticle]);
        } else {
          setServices(prev => [...prev, newArticle]);
        }
        toast.success(`${typ} "${name}" angelegt und verknüpft`);
        loadData();
      }
    } catch { toast.error("Fehler beim Anlegen"); }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const handleDrop = (e) => { e.preventDefault(); try { const item = JSON.parse(e.dataTransfer.getData("application/json")); addFromStamm(item); toast.success(`"${item.name}" hinzugefügt`); } catch {} };
  const updateCostPrice = (idx, value) => setCostPrices(prev => ({ ...prev, [idx]: parseFloat(value) || 0 }));

  const getPreviewDocument = () => ({
    id, customer_name: customer?.name || "", customer_address: customer?.address || "",
    customer_email: customer?.email || "", customer_id: customer?.id || "",
    quote_number: type === "quote" ? docNumber : undefined,
    order_number: type === "order" ? docNumber : undefined,
    invoice_number: type === "invoice" ? docNumber : undefined,
    betreff, vortext, schlusstext, status,
    positions, subtotal_net: subtotal, vat_rate: vatRate, vat_amount: vat, total_gross: total,
    discount, discount_type: discountType,
    created_at: new Date().toISOString(),
  });

  // ==================== COMPUTATIONS ====================
  const getNumbering = () => {
    let titelNr = 0, posInTitel = 0, hasTitel = positions.some(p => p.type === "titel"), flatNr = 0;
    return positions.map((p) => {
      if (p.type === "titel") { titelNr++; posInTitel = 0; return String(titelNr); }
      if (hasTitel) { posInTitel++; return titelNr > 0 ? `${titelNr}.${posInTitel}` : String(posInTitel); }
      flatNr++; return String(flatNr);
    });
  };
  const numbering = getNumbering();

  const getTitelGroups = () => {
    const groups = []; let currentGroup = null;
    positions.forEach((p, idx) => {
      if (p.type === "titel") { if (currentGroup) groups.push(currentGroup); currentGroup = { titel: p.description, nr: numbering[idx], sum: 0 }; }
      else if (currentGroup) { currentGroup.sum += (p.quantity || 0) * (p.price_net || 0); }
      else { if (!groups.length || groups[groups.length - 1].titel !== "__ungrouped") groups.push({ titel: "__ungrouped", nr: "", sum: 0 }); groups[groups.length - 1].sum += (p.quantity || 0) * (p.price_net || 0); }
    });
    if (currentGroup) groups.push(currentGroup);
    return groups.filter(g => g.titel !== "__ungrouped" || g.sum > 0);
  };

  const hasTitels = positions.some(p => p.type === "titel");

  const filteredServices = useMemo(() => services.filter(a =>
    a.name.toLowerCase().includes(sidebarSearch.toLowerCase()) || (a.description || "").toLowerCase().includes(sidebarSearch.toLowerCase())
  ), [services, sidebarSearch]);

  const filteredArticles = useMemo(() => articles.filter(a =>
    a.typ === "Artikel" && (a.name.toLowerCase().includes(sidebarSearch.toLowerCase()) || (a.description || "").toLowerCase().includes(sidebarSearch.toLowerCase()))
  ), [articles, sidebarSearch]);

  const calculateTotals = () => {
    const subtotal = positions.filter(p => p.type !== "titel").reduce((sum, p) => sum + (p.quantity || 0) * (p.price_net || 0), 0);
    const discountAmt = discountType === "percent" ? subtotal * (discount / 100) : discount;
    const netAfterDiscount = subtotal - discountAmt;
    const vatAmt = netAfterDiscount * (vatRate / 100);
    const total = netAfterDiscount + vatAmt;
    return { subtotal, discountAmt, netAfterDiscount, vat: vatAmt, total, finalAmount: total - depositAmount };
  };

  const calculateKalkulation = () => {
    const revenue = positions.reduce((sum, p) => sum + (p.quantity || 0) * (p.price_net || 0), 0);
    const costs = positions.reduce((sum, p, idx) => sum + (p.quantity || 0) * (costPrices[idx] || 0), 0);
    const margin = revenue - costs;
    return { revenue, costs, margin, marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0, hasCosts: Object.values(costPrices).some(v => v > 0) };
  };

  // ==================== SUGGESTIONS ====================
  const loadSuggestions = async () => {
    try {
      const currentDescs = positions.filter(p => p.description).map(p => p.description).join(",");
      const res = await api.get(`/documents/suggestions/${type}?customer_id=${selectedCustomerId}&current_positions=${encodeURIComponent(currentDescs)}`);
      setTemplateDocs(res.data.templates || []); setSimilarDocs(res.data.similar || []);
    } catch {}
  };
  useEffect(() => { if (!loading) loadSuggestions(); }, [loading, selectedCustomerId]);

  const copyPositionsFromDoc = (doc) => {
    if (doc.positions?.length > 0) {
      const newPositions = doc.positions.map((p, idx) => ({ ...p, pos_nr: positions.length + idx + 1 }));
      setPositions([...positions, ...newPositions]); toast.success(`${newPositions.length} Position(en) übernommen`);
    }
  };

  const toggleDocTemplate = async (docId) => {
    try { const res = await api.put(`/documents/${type}/${docId}/template`); toast.success(res.data.is_template ? "Als Vorlage markiert" : "Vorlage entfernt"); loadSuggestions(); } catch {}
  };

  // ==================== VOICE ====================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder; chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop()); await processAudio(audioBlob);
      };
      mediaRecorder.start(); setIsRecording(true); toast.info("Aufnahme gestartet - Sprechen Sie jetzt...");
    } catch { toast.error("Mikrofon-Zugriff verweigert"); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const processAudio = async (audioBlob) => {
    if (!selectedCustomerId) { toast.error("Bitte wählen Sie zuerst einen Kunden aus"); return; }
    setAiLoading(true);
    try {
      const formData = new FormData(); formData.append("audio", audioBlob, "recording.webm");
      const sttRes = await axios.post(`${API}/speech-to-text`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      const aiRes = await api.post("/ai/generate-quote", { customer_id: selectedCustomerId, transcribed_text: sttRes.data.text, vat_rate: vatRate });
      if (aiRes.data.positions?.length > 0) { setPositions(aiRes.data.positions); if (aiRes.data.notes) setNotes(aiRes.data.notes); toast.success("KI hat das Dokument erstellt!"); }
    } catch { toast.error("Fehler bei der Sprachverarbeitung"); } finally { setAiLoading(false); }
  };

  // ==================== SAVE / PDF / EMAIL / PRINT ====================
  const handleSave = async () => {
    if (!selectedCustomerId) { toast.error("Bitte wählen Sie einen Kunden aus"); return; }
    if (positions.length === 0 || !positions[0].description) { toast.error("Bitte fügen Sie mindestens eine Position hinzu"); return; }
    setSaving(true);
    try {
      const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
      if (isNew) {
        const payload = { customer_id: selectedCustomerId, positions: positions.filter(p => p.description), notes, vortext, schlusstext, betreff, discount, discount_type: discountType, vat_rate: vatRate, ...(type === "quote" && { valid_days: 30 }), ...(type === "invoice" && { due_days: 14, deposit_amount: depositAmount }) };
        const res = await api.post(`/${endpoint}`, payload); toast.success(`${titles[type]} erstellt!`);
        if (res?.data?.id) navigate(`/${endpoint}/${res.data.id}/edit`, { replace: true });
      } else {
        const payload = { customer_id: selectedCustomerId, positions: positions.filter(p => p.description), notes, vortext, schlusstext, betreff, discount, discount_type: discountType, vat_rate: vatRate, status, ...(type === "invoice" && { deposit_amount: depositAmount }) };
        await api.put(`/${endpoint}/${id}`, payload); toast.success(`${titles[type]} gespeichert!`);
      }
    } catch { toast.error("Fehler beim Speichern"); } finally { setSaving(false); }
  };

  const handleSaveAndExit = async () => { await handleSave(); navigate(listPaths[type]); };

  const handleDownloadPDF = async () => {
    if (isNew) { toast.error("Bitte speichern Sie zuerst das Dokument"); return; }
    try {
      const endpoint = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
      const res = await axios.get(`${API}/pdf/${endpoint}/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a"); link.href = url; link.setAttribute("download", `${titles[type]}_${docNumber}.pdf`);
      document.body.appendChild(link); link.click(); link.remove(); toast.success("PDF heruntergeladen");
    } catch { toast.error("Fehler beim PDF-Download"); }
  };

  const handlePrint = async () => {
    if (isNew) { toast.error("Bitte speichern Sie zuerst das Dokument"); return; }
    try {
      const endpoint = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
      const res = await axios.get(`${API}/pdf/${endpoint}/${id}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) { const link = document.createElement("a"); link.href = url; link.setAttribute("download", `${titles[type]}_${docNumber}.pdf`); document.body.appendChild(link); link.click(); link.remove(); toast.info("PDF heruntergeladen — bitte manuell drucken"); }
    } catch { toast.error("Fehler beim Drucken"); }
  };

  const handleSendEmail = async () => {
    if (!emailForm.to_email) { toast.error("Bitte E-Mail-Adresse eingeben"); return; }
    setSendingEmail(true);
    try {
      await api.post(`/email/document/${type}/${id}`, { to_email: emailForm.to_email, subject: emailForm.subject || `${titles[type]} ${docNumber}`, message: emailForm.message });
      toast.success(`${titles[type]} per E-Mail gesendet`); setShowEmailDialog(false); setEmailForm({ to_email: "", subject: "", message: "" });
    } catch (err) { toast.error(err?.response?.data?.detail || "E-Mail konnte nicht gesendet werden"); } finally { setSendingEmail(false); }
  };

  const onOpenEmailDialog = async () => {
    setEmailForm(f => ({ ...f, to_email: customer?.email || "", subject: `${titles[type]} ${docNumber}` }));
    try { const res = await api.get("/modules/textvorlagen/data", { params: { text_type: "email" } }); setEmailTemplates(res.data || []); } catch {}
    setShowEmailDialog(true);
  };

  // ==================== COMPUTED VALUES ====================
  const { subtotal, discountAmt, netAfterDiscount, vat, total, finalAmount } = calculateTotals();
  const titelGroups = hasTitels ? getTitelGroups() : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-slate-100">
      <EditorToolbar
        type={type} isNew={isNew} titles={titles} listPaths={listPaths} docNumber={docNumber} status={status}
        isRecording={isRecording} aiLoading={aiLoading} saving={saving}
        navigate={navigate} setShowSettings={setShowSettings} startRecording={startRecording} stopRecording={stopRecording}
        handleSave={handleSave} handleSaveAndExit={handleSaveAndExit} handleDownloadPDF={handleDownloadPDF} handlePrint={handlePrint}
        onOpenEmailDialog={onOpenEmailDialog}
        onToggleVorlagen={() => setShowVorlagen(v => !v)}
        onTogglePreview={() => setShowPreview(true)}
      />

      <div className="pt-14 lg:pt-20 pb-4 lg:pb-8 px-2 lg:px-4">
        <div className="lg:grid lg:grid-cols-[340px_1fr_300px] lg:gap-4 lg:max-w-[1600px] lg:mx-auto">

          <EditorSidebar
            sidebarSearch={sidebarSearch} setSidebarSearch={setSidebarSearch}
            sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
            filteredServices={filteredServices} filteredArticles={filteredArticles}
            leistungsBloecke={leistungsBloecke}
            selectedItem={selectedItem} setSelectedItem={setSelectedItem}
            addFromStamm={addFromStamm} deleteLeistungsBlock={deleteLeistungsBlock}
            insertLeistungsBlock={insertLeistungsBlock}
            handleDragStart={handleDragStart} navigate={navigate}
            settings={settings} onApplyKalkPrice={handleApplyKalkPrice}
            onItemUpdated={loadData}
          />

          <div>
            {/* Status Dropdown */}
            {!isNew && (
              <div className="mb-3 lg:mb-4">
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="h-8 lg:h-9 rounded-sm border border-input bg-card px-2 lg:px-3 text-xs lg:text-sm">
                  {type === "quote" && (<><option value="Entwurf">Status: Entwurf</option><option value="Gesendet">Status: Gesendet</option><option value="Beauftragt">Status: Beauftragt</option><option value="Abgelehnt">Status: Abgelehnt</option></>)}
                  {type === "order" && (<><option value="Offen">Status: Offen</option><option value="In Arbeit">Status: In Arbeit</option><option value="Abgeschlossen">Status: Abgeschlossen</option></>)}
                  {type === "invoice" && (<><option value="Offen">Status: Offen</option><option value="Gesendet">Status: Gesendet</option><option value="Bezahlt">Status: Bezahlt</option><option value="Überfällig">Status: Überfällig</option></>)}
                </select>
              </div>
            )}

            {/* Paper Document */}
            <div className="bg-white shadow-xl rounded-sm border" style={{ minHeight: "600px" }}
              onDragOver={handleDragOver} onDrop={handleDrop} data-testid="document-drop-zone">

              <DocumentHeader
                settings={settings} customer={customer} customers={customers}
                selectedCustomerId={selectedCustomerId} handleCustomerChange={handleCustomerChange}
                type={type} docNumber={docNumber} createdAt={createdAt}
                setPositions={setPositions} positions={positions}
              />

              {/* Betreff */}
              <div className="px-4 lg:px-10 py-3 lg:py-4 border-b">
                <TextTemplateSelect docType={docTypeMap[type]} textType="betreff" value={betreff} onChange={setBetreff} customer={customer} settings={settings} docNumber={docNumber} />
              </div>

              {/* Vortext */}
              <div className="px-4 lg:px-10 py-3 lg:py-4 border-b">
                <TextTemplateSelect docType={docTypeMap[type]} textType="vortext" value={vortext} onChange={setVortext} customer={customer} settings={settings} docNumber={docNumber} />
              </div>

              <PositionsTable
                positions={positions} numbering={numbering} type={type}
                selectedPositions={selectedPositions} togglePositionSelect={togglePositionSelect}
                updatePosition={updatePosition} removePosition={removePosition} movePosition={movePosition}
                checkStammChange={checkStammChange} stammChangeIdx={stammChangeIdx} setStammChangeIdx={setStammChangeIdx} saveToStamm={saveToStamm}
                titelTemplates={titelTemplates} titelDropdownIdx={titelDropdownIdx} setTitelDropdownIdx={setTitelDropdownIdx} saveTitelTemplate={saveTitelTemplate}
                dragIndex={dragIndex} setDragIndex={setDragIndex} dragOverIndex={dragOverIndex} setDragOverIndex={setDragOverIndex}
                saveAsArticleIdx={saveAsArticleIdx} setSaveAsArticleIdx={setSaveAsArticleIdx} saveAsType={saveAsType} setSaveAsType={setSaveAsType}
                handleSavePositionAsArticle={handleSavePositionAsArticle}
                addPosition={addPosition} addTitel={addTitel}
                blockSaveName={blockSaveName} setBlockSaveName={setBlockSaveName} saveAsLeistungsBlock={saveAsLeistungsBlock} setSelectedPositions={setSelectedPositions}
                articles={articles} services={services} addFromStamm={addFromStamm}
                onOpenKalkulation={openPositionKalk} activeKalkIdx={activeKalkIdx}
              />

              <TotalsSection
                hasTitels={hasTitels} titelGroups={titelGroups} subtotal={subtotal}
                discount={discount} setDiscount={setDiscount} discountType={discountType}
                discountAmt={discountAmt} netAfterDiscount={netAfterDiscount}
                vatRate={vatRate} setVatRate={setVatRate} vat={vat} total={total}
                type={type} depositAmount={depositAmount} setDepositAmount={setDepositAmount} finalAmount={finalAmount}
              />

              {/* Schlusstext */}
              <div className="px-4 lg:px-10 py-3 lg:py-4 border-t">
                <TextTemplateSelect docType={docTypeMap[type]} textType="schlusstext" value={schlusstext} onChange={setSchlusstext} customer={customer} settings={settings} docNumber={docNumber} />
              </div>

              {/* Footer */}
              <div className="px-4 lg:px-10 py-4 lg:py-5 border-t bg-slate-50/50 text-[10px] lg:text-xs text-muted-foreground text-center space-y-1" data-testid="document-footer">
                <p>{settings.company_name || "Tischlerei Graupner"} {(settings.address || "Erlengrund 129 22453 Hamburg").replace(/\n/g, " ")} Tel. {settings.phone || "040 52530818"} Mail: {settings.email || "Service@tischlerei-graupner.de"}</p>
                <p>Bankverbindung: {settings.owner_name || "Ralph Graupner"} | {settings.bank_name || "N26"} | IBAN: {settings.iban || "DE33 1001 1001 2028 1390 46"} | BIC: {settings.bic || "NTSBDEB1XXX"} SteuerNr. {settings.tax_id || "45/076/04744"}</p>
              </div>
            </div>
          </div>

          <RightSidebar
            showVorlagen={showVorlagen}
            activeKalkItem={getActiveKalkItem()}
            settings={settings}
            onApplyKalkPrice={handleKalkApply}
            onCloseKalk={() => setActiveKalkIdx(null)}
            onSaveToStamm={handleSaveKalkToStamm}
            onCreateNewArticle={handleCreateFromKalk}
            templateDocs={templateDocs} similarDocs={similarDocs} expandedDoc={expandedDoc} setExpandedDoc={setExpandedDoc}
            copyPositionsFromDoc={copyPositionsFromDoc} toggleDocTemplate={toggleDocTemplate}
            titles={titles} type={type} positions={positions}
            subtotal={subtotal} vatRate={vatRate} vat={vat} total={total}
            costPrices={costPrices} updateCostPrice={updateCostPrice} calculateKalkulation={calculateKalkulation}
            customer={customer}
          />

        </div>
      </div>

      {showEmailDialog && (
        <EmailDialog
          type={type} titles={titles} docNumber={docNumber} customer={customer} settings={settings}
          emailForm={emailForm} setEmailForm={setEmailForm} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates}
          sendingEmail={sendingEmail} onSend={handleSendEmail} onClose={() => setShowEmailDialog(false)}
        />
      )}

      <SettingsSlideOver
        showSettings={showSettings} setShowSettings={setShowSettings}
        settingsTab={settingsTab} setSettingsTab={setSettingsTab}
        articles={articles} services={services} leistungsBloecke={leistungsBloecke}
        deleteLeistungsBlock={deleteLeistungsBlock} insertLeistungsBlock={insertLeistungsBlock}
        loadData={loadData} setLeistungsBloecke={setLeistungsBloecke}
      />

      {showPreview && (
        <DocumentPreview
          isOpen={true}
          type={type}
          document={getPreviewDocument()}
          onClose={() => setShowPreview(false)}
          onEdit={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export { WysiwygDocumentEditor };
