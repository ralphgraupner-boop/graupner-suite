import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { Package, CheckCircle, FileText, ClipboardCheck, Receipt, Search, Star, X, ExternalLink, Save } from "lucide-react";
import { api, API } from "@/lib/api";
import { TextTemplateSelect, getAnredeBrief, resolvePlaceholders } from "@/components/TextTemplateSelect";

// Sub-components
import { EditorToolbar } from "@/components/wysiwyg/EditorToolbar";
import { EditorSidebar } from "@/components/wysiwyg/EditorSidebar";
import { LohnkostenSidebar } from "@/components/wysiwyg/LohnkostenSidebar";
import { DocumentHeader } from "@/components/wysiwyg/DocumentHeader";
import { PositionsTable } from "@/components/wysiwyg/PositionsTable";
import { TotalsSection } from "@/components/wysiwyg/TotalsSection";
import { RightSidebar } from "@/components/wysiwyg/RightSidebar";
import { SettingsSlideOver } from "@/components/wysiwyg/SettingsSlideOver";
import { DocumentPreview } from "@/components/DocumentPreview";
import { TextKorrekturModal, TextKorrekturButton } from "@/components/wysiwyg/TextKorrekturModal";
import { DocumentCheckModal } from "@/components/wysiwyg/DocumentCheckModal";
import { PdfPreviewModal } from "@/components/wysiwyg/PdfPreviewModal";
import { validateDocument } from "@/lib/documentValidator";

const WysiwygDocumentEditor = ({ type = "quote" }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isNew = !id || id === "new";

  // Konvertiert HTML-Reste (<p>, &nbsp;, Umlaut-Entitaeten) zurueck in Plain-Text,
  // damit der Vortext/Schlusstext im Textfeld sauber und komplett lesbar ist.
  const htmlToPlain = (html) => {
    if (!html) return "";
    if (!/<[a-z][^>]*>|&[a-z#0-9]+;/i.test(html)) return html;
    let t = String(html)
      .replace(/<p>\s*---\s*<\/p>/gi, "\n---\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n\n")
      .replace(/<p>/gi, "")
      .replace(/<\/p>/gi, "")
      .replace(/<[^>]+>/g, "");
    // HTML-Entitaeten dekodieren
    try {
      const tmp = document.createElement("textarea");
      tmp.innerHTML = t;
      t = tmp.value;
    } catch { /* no-op */ }
    return t.replace(/\u00A0/g, " ").trim();
  };
  
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
  // KI-Textkorrektur: aktives Feld {kontext, label, text, setter} oder null
  const [korrekturTarget, setKorrekturTarget] = useState(null);
  const [vatRate, setVatRate] = useState(19);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("percent");
  const [status, setStatus] = useState(type === "quote" ? "Entwurf" : "Offen");
  const [depositAmount, setDepositAmount] = useState(0);
  const [dueDays, setDueDays] = useState(null); // null = noch nicht aus Settings/DB geladen
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

  const [showPreview, setShowPreview] = useState(false);
  const [showLohnanteil, setShowLohnanteil] = useState(type === "invoice");
  const [copying, setCopying] = useState(false);
  const [lohnanteilCustom, setLohnanteilCustom] = useState("");
  const [showLohnkosten, setShowLohnkosten] = useState(false);
  const [showLeistungenPanel, setShowLeistungenPanel] = useState(false);
  const [copyFlow, setCopyFlow] = useState(null);
  const [showDocCheck, setShowDocCheck] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

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
      if (isNew && settingsRes.data?.default_vat_rate) {
        setVatRate(settingsRes.data.default_vat_rate);
      }
      // Zahlungsziel beim NEU-Anlegen aus Settings vorbelegen (Default 14)
      if (isNew && type === "invoice" && dueDays === null) {
        const def = settingsRes.data?.default_due_days;
        setDueDays(Number.isFinite(def) ? def : 14);
      }

      try { const titelRes = await api.get("/modules/textvorlagen/data", { params: { text_type: "titel", doc_type: "allgemein" } }); setTitelTemplates(titelRes.data); } catch {}
      try { const blockRes = await api.get("/leistungsbloecke"); setLeistungsBloecke(blockRes.data); } catch {}

      if (!isNew) {
        const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
        const res = await api.get(`/${endpoint}/${id}`);
        const doc = res.data;
        setSelectedCustomerId(doc.customer_id);
        setCustomer({ name: doc.customer_name, address: doc.customer_address, id: doc.customer_id });
        // Kunden-Details aus Modul laden (E-Mail etc.)
        if (doc.customer_id) {
          const custData = allModulCustomers.find(c => c.id === doc.customer_id);
          if (custData) {
            setCustomer({ ...custData, name: doc.customer_name, address: doc.customer_address });
          } else {
            // Fallback: direkt aus Kunden-Modul oder Kontakt-Modul laden
            try {
              const kRes = await api.get(`/modules/kunden/data/${doc.customer_id}`).catch(() => null);
              const data = kRes?.data || (await api.get(`/modules/kontakt/data/${doc.customer_id}`).catch(() => null))?.data;
              if (data) setCustomer({ ...data, name: doc.customer_name, address: doc.customer_address, id: doc.customer_id });
            } catch {}
          }
        }
        setPositions((doc.positions || []).map(p => ({ ...p, type: p.type || "position" })));
        setNotes(doc.notes || ""); setVortext(htmlToPlain(doc.vortext)); setSchlusstext(htmlToPlain(doc.schlusstext));
        setBetreff(doc.betreff || ""); setVatRate(doc.vat_rate || 19);
        setDiscount(doc.discount || 0); setDiscountType(doc.discount_type || "percent");
        setStatus(doc.status || ""); setDepositAmount(doc.deposit_amount || 0);
        if (type === "invoice") {
          // Rückrechnen falls due_days fehlt: due_date - created_at
          let dd = doc.due_days;
          if (dd == null && doc.due_date && doc.created_at) {
            try {
              const a = new Date(doc.created_at);
              const b = new Date(doc.due_date);
              dd = Math.max(0, Math.round((b - a) / 86400000));
            } catch { dd = 14; }
          }
          setDueDays(Number.isFinite(dd) ? dd : 14);
        }
        setDocNumber(doc.quote_number || doc.order_number || doc.invoice_number);
        setCreatedAt(doc.created_at);
        if (doc.show_lohnanteil) setShowLohnanteil(true);
        if (doc.lohnanteil_custom) setLohnanteilCustom(doc.lohnanteil_custom);
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

  // ==================== LOHNANTEIL ====================
  const totalLaborCost = positions.reduce((sum, p) => sum + ((p.labor_cost || 0) * (p.quantity || 1)), 0);
  const effectiveLohnanteil = lohnanteilCustom !== "" ? parseFloat(lohnanteilCustom) || 0 : totalLaborCost;
  const lohnanteilMwst = effectiveLohnanteil * (vatRate / 100);
  const lohnanteilBrutto = effectiveLohnanteil + lohnanteilMwst;

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

  const addPosition = () => setPositions([...positions, { type: "position", pos_nr: 0, description: "", quantity: 1, unit: "Stück", price_net: 0, labor_cost: 0 }]);
  const addTitel = () => setPositions([...positions, { type: "titel", pos_nr: 0, description: "" }]);

  const saveTitelTemplate = async (name) => {
    if (!name?.trim() || titelTemplates.some(t => t.content === name.trim())) return;
    try {
      await api.post("/modules/textvorlagen/data", { doc_type: "allgemein", text_type: "titel", title: name.trim(), content: name.trim() });
      const res = await api.get("/modules/textvorlagen/data", { params: { text_type: "titel", doc_type: "allgemein" } });
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
      setSidebarSearch("");
      setSidebarTab(saveAsType === "Artikel" ? "articles" : "services");
    } catch { toast.error("Fehler beim Speichern"); }
  };

  const addFromStamm = (item, atIndex) => {
    const desc = item.name + (item.description ? ` - ${item.description}` : "");
    const newPos = { type: "position", pos_nr: 0, description: desc, quantity: 1, unit: item.unit, price_net: item.price_net, labor_cost: item.labor_cost || 0, source_article_id: item.id, original_description: desc, original_unit: item.unit, original_price_net: item.price_net };
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
  const validateTextFields = () => {
    const problems = [];
    if (!betreff?.trim()) problems.push("Betreff ist leer");
    if (!vortext?.trim()) problems.push("Vortext ist leer");
    if (!schlusstext?.trim()) problems.push("Schlusstext ist leer");
    if (problems.length === 0) return true;
    return window.confirm(`Folgende Felder sind leer:\n\n${problems.join("\n")}\n\nTrotzdem speichern?`);
  };

  const validatePositions = () => {
    const problems = [];
    positions.filter(p => p.type !== "titel").forEach((p, idx) => {
      if (!p.description?.trim()) return;
      if (!p.price_net || p.price_net === 0) problems.push(`Position ${idx + 1}: "${p.description.substring(0, 45)}${p.description.length > 45 ? "..." : ""}" hat keinen Preis (0,00 EUR)`);
      if (!p.quantity || p.quantity === 0) problems.push(`Position ${idx + 1}: "${p.description.substring(0, 45)}${p.description.length > 45 ? "..." : ""}" hat Menge 0`);
    });
    if (problems.length === 0) return true;
    const msg = `Plausibilitätsprüfung - ${problems.length} Auffälligkeit${problems.length !== 1 ? "en" : ""} gefunden:\n\n${problems.slice(0, 6).join("\n")}${problems.length > 6 ? `\n... und ${problems.length - 6} weitere` : ""}\n\nWirklich trotzdem fortfahren?`;
    return window.confirm(msg);
  };

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);

  const applyTemplate = (tpl) => {
    const snap = tpl.snapshot || {};
    if (Array.isArray(snap.positions) && snap.positions.length > 0) {
      setPositions(snap.positions.map(p => ({ ...p, type: p.type || "position" })));
    }
    if (snap.vortext !== undefined) setVortext(snap.vortext || "");
    if (snap.schlusstext !== undefined) setSchlusstext(snap.schlusstext || "");
    if (snap.betreff !== undefined) setBetreff(snap.betreff || "");
    if (snap.notes !== undefined) setNotes(snap.notes || "");
    if (snap.vat_rate !== undefined) setVatRate(snap.vat_rate);
    if (snap.discount !== undefined) setDiscount(snap.discount);
    if (snap.discount_type !== undefined) setDiscountType(snap.discount_type);
    if (snap.show_lohnanteil !== undefined) setShowLohnanteil(!!snap.show_lohnanteil);
    if (snap.lohnanteil_custom !== undefined) setLohnanteilCustom(snap.lohnanteil_custom);
    toast.success(`Vorlage "${tpl.name}" geladen - ${snap.positions?.length || 0} Position${snap.positions?.length !== 1 ? "en" : ""}`);
    setShowLoadTemplate(false);
  };

  const persistDocument = async (silent = false) => {
    // Silent save - gibt savedId oder null zurueck, ohne Template-Dialog
    if (!selectedCustomerId) { if (!silent) toast.error("Bitte wählen Sie einen Kunden aus"); return null; }
    if (!silent) {
      if (!validateTextFields()) return null;
      if (!validatePositions()) return null;
    }
    setSaving(true);
    try {
      const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
      if (isNew) {
        const _lohn = lohnanteilCustom === "" || lohnanteilCustom === null ? null : Number(String(lohnanteilCustom).replace(",", "."));
        const payload = { customer_id: selectedCustomerId, positions: positions.filter(p => p.description), notes, vortext, schlusstext, betreff, discount, discount_type: discountType, vat_rate: vatRate, show_lohnanteil: showLohnanteil, lohnanteil_custom: (Number.isFinite(_lohn) ? _lohn : null), ...(type === "quote" && { valid_days: settings?.default_quote_validity_days ?? 30 }), ...(type === "invoice" && { deposit_amount: depositAmount, ...(dueDays != null && { due_days: Number(dueDays) }) }) };
        const res = await api.post(`/${endpoint}`, payload);
        if (res?.data?.id) { isDirtyRef.current = false; navigate(`/${endpoint}/edit/${res.data.id}`, { replace: true }); return res.data.id; }
        return null;
      } else {
        const _lohn = lohnanteilCustom === "" || lohnanteilCustom === null ? null : Number(String(lohnanteilCustom).replace(",", "."));
        const payload = { customer_id: selectedCustomerId, positions: positions.filter(p => p.description), notes, vortext, schlusstext, betreff, discount, discount_type: discountType, vat_rate: vatRate, status, show_lohnanteil: showLohnanteil, lohnanteil_custom: (Number.isFinite(_lohn) ? _lohn : null), ...(type === "invoice" && { deposit_amount: depositAmount, ...(dueDays != null && { due_days: Number(dueDays) }) }) };
        await api.put(`/${endpoint}/${id}`, payload);
        isDirtyRef.current = false;
        return id;
      }
    } catch { if (!silent) toast.error("Fehler beim Speichern"); return null; } finally { setSaving(false); }
  };

  // Pflicht-Check vor Druck/PDF/Versand: bei Rechnung mit aktiviertem Lohnanteil
  // muss ein Betrag gesetzt sein. Sonst: Dialog "Default (60% vom Netto) übernehmen?".
  // Bei Bestätigung: Default wird ins Eingabefeld geschrieben (Transparenz) und true zurückgegeben.
  const ensureLohnanteilOrConfirm = async () => {
    if (type !== "invoice") return true;
    if (!showLohnanteil) return true;
    const cur = lohnanteilCustom === null || lohnanteilCustom === undefined ? "" : String(lohnanteilCustom).trim();
    const parsed = cur === "" ? NaN : Number(cur.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return true;
    const netAfter = positions.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.price_net) || 0), 0)
      - (discountType === "percent"
        ? (positions.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.price_net) || 0), 0) * (Number(discount) || 0) / 100)
        : (Number(discount) || 0));
    const dflt = Math.max(0, Math.round(netAfter * 0.6 * 100) / 100);
    const ok = window.confirm(
      `Lohnanteil §35a ist aktiviert, aber kein Betrag eingetragen.\n\n` +
      `Soll der Default von ${dflt.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € ` +
      `(60 % vom Netto) übernommen und in das Eingabefeld eingetragen werden?\n\n` +
      `OK = Default übernehmen und fortfahren\n` +
      `Abbrechen = zurück zur Bearbeitung`
    );
    if (!ok) return false;
    setLohnanteilCustom(String(dflt).replace(".", ","));
    return true;
  };

  const handleSave = async () => {
    const savedId = await persistDocument();
    if (savedId) {
      toast.success(`${titles[type]} gespeichert!`);
      setTimeout(() => setShowTemplateDialog(savedId), 400);
    }
    return savedId;
  };

  const handleSaveAndExit = async () => { const savedId = await handleSave(); navigate(savedId && selectedCustomerId ? `/module/projekte/werkbank/${selectedCustomerId}` : listPaths[type]); };

  // Kopier-Buttons: 1:1-Kopie als neuer Vorgang (gleicher Kunde, neue Nummer, Quelle bleibt unveraendert)
  const copyTargetDocType = { order: "auftrag", "invoice-from-quote": "rechnung", "invoice-from-order": "rechnung" };
  const copyTargetLabel = { order: "Auftragsbestätigung", "invoice-from-quote": "Rechnung", "invoice-from-order": "Rechnung" };
  const handleCopyTo = (target) => {
    if (isNew || !id) { toast.error("Bitte speichern Sie zuerst das Dokument"); return; }
    setCopyFlow({ target, step: "vortext", vortext, schlusstext });
  };
  const finishCopyFlow = async () => {
    if (!copyFlow) return;
    setCopying(true);
    try {
      const cfg = {
        order: { url: `/documents/copy/quote-to-order/${id}`, open: "/orders/edit" },
        "invoice-from-quote": { url: `/documents/copy/quote-to-invoice/${id}`, open: "/invoices/edit" },
        "invoice-from-order": { url: `/documents/copy/order-to-invoice/${id}`, open: "/invoices/edit" },
      }[copyFlow.target];
      const res = await api.post(cfg.url, { vortext_override: copyFlow.vortext, schlusstext_override: copyFlow.schlusstext });
      toast.success(`${copyTargetLabel[copyFlow.target]} erstellt`);
      setCopyFlow(null);
      navigate(`${cfg.open}/${res.data.id}`);
    } catch {
      toast.error("Erstellen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setCopying(false);
    }
  };

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const handleExit = () => { setShowExitConfirm(true); };

  // Autosave: speichert alle 60s im Hintergrund, still (kein Popup/Fehlertoast),
  // damit spontanes Wegnavigieren (z.B. schnell einen Termin anlegen) keine
  // Arbeit mehr verliert. Nutzt Refs, damit der Intervall-Timer nicht bei
  // jedem Tastendruck neu gestartet wird (sonst wuerde er nie abgelaufen).
  const persistDocumentRef = useRef(persistDocument);
  useEffect(() => { persistDocumentRef.current = persistDocument; });
  const savingRef = useRef(saving);
  useEffect(() => { savingRef.current = saving; }, [saving]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (!savingRef.current) persistDocumentRef.current(true);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Merkt sich, ob seit dem letzten Speichern etwas geaendert wurde (fuer den
  // Warnhinweis unten). Erster Render zaehlt nicht als Aenderung.
  const isDirtyRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    isDirtyRef.current = true;
  }, [positions, notes, vortext, schlusstext, betreff, discount, discountType, vatRate, showLohnanteil, lohnanteilCustom, status, depositAmount, dueDays]);

  // Warnhinweis beim Schliessen/Neuladen des Browser-Tabs, wenn ungespeicherte
  // Aenderungen vorliegen (Autosave deckt spontanes Wegklicken innerhalb der
  // Suite bereits ab; dies hier ist die Absicherung fuer Tab zu/Neu laden).
  useEffect(() => {
    const handler = (e) => {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!isDirtyRef.current) return;
      const link = e.target.closest && e.target.closest("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || link.target === "_blank") return;
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm("Ungespeicherte Änderungen - trotzdem verlassen?")) {
        isDirtyRef.current = false;
        navigate(href);
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [navigate]);
  const handleExitWithSave = async () => { setShowExitConfirm(false); const savedId = await handleSave(); navigate(savedId && selectedCustomerId ? `/module/projekte/werkbank/${selectedCustomerId}` : listPaths[type]); };
  const handleExitWithSaveKunde = async () => { setShowExitConfirm(false); const savedId = await handleSave(); navigate(savedId && selectedCustomerId ? `/module/kunden?edit=${selectedCustomerId}` : listPaths[type]); };
  const handleExitWithSaveProjekt = async () => { setShowExitConfirm(false); const savedId = await handleSave(); navigate(savedId && selectedCustomerId ? `/module/projekte/werkbank/${selectedCustomerId}` : listPaths[type]); };
  const handleExitWithoutSave = () => { setShowExitConfirm(false); navigate(selectedCustomerId ? `/module/projekte/werkbank/${selectedCustomerId}` : listPaths[type]); };
  // Zurueck-Button: bei ungespeicherten Aenderungen denselben Beenden-Dialog
  // oeffnen (EA-004, kein neuer Dialog), sonst direkt wie bisher navigieren.
  const handleBack = () => {
    if (isDirtyRef.current) { setShowExitConfirm(true); return; }
    navigate(selectedCustomerId ? `/module/projekte/werkbank/${selectedCustomerId}` : listPaths[type]);
  };

  const handleDownloadPDF = async () => {
    if (!(await ensureLohnanteilOrConfirm())) return;
    // Immer zuerst speichern → PDF zeigt dann aktuellen Stand, nicht die alte Version
    const savedId = await persistDocument();
    if (!savedId) return;
    try {
      const endpoint = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
      // Cache-Buster, damit Browser nicht versehentlich eine alte PDF-Version zeigt
      const res = await api.get(`/pdf/${endpoint}/${savedId}?t=${Date.now()}`, { responseType: "blob" });
      const namedFile = new File([res.data], `${titles[type]}_${docNumber}.pdf`, { type: "application/pdf" });
      const url = window.URL.createObjectURL(namedFile);
      const previewWin = window.open(url, "_blank");
      if (!previewWin) {
        // Fallback bei Popup-Blocker → Download
        const link = document.createElement("a"); link.href = url; link.setAttribute("download", `${titles[type]}_${docNumber}.pdf`);
        document.body.appendChild(link); link.click(); link.remove();
        toast.warning("Popup blockiert - PDF wurde stattdessen heruntergeladen");
      } else {
        toast.success("PDF wird in neuem Tab geöffnet");
      }
    } catch (e) { console.error("PDF error:", e); toast.error("Fehler beim PDF-Erzeugen: " + (e?.response?.statusText || e?.message || "unbekannt")); }
  };

  const handlePrint = async () => {
    if (!(await ensureLohnanteilOrConfirm())) return;
    // Immer zuerst speichern → Druck zeigt aktuellen Stand
    const savedId = await persistDocument();
    if (!savedId) return;
    try {
      const endpoint = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
      const res = await api.get(`/pdf/${endpoint}/${savedId}?t=${Date.now()}`, { responseType: "blob" });
      const namedFile = new File([res.data], `${titles[type]}_${docNumber}.pdf`, { type: "application/pdf" });
      const url = window.URL.createObjectURL(namedFile);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          setTimeout(() => { printWindow.print(); }, 500);
        });
      } else {
        // Fallback: iframe print
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.addEventListener("load", () => {
          setTimeout(() => { iframe.contentWindow.print(); }, 500);
        });
      }
    } catch { toast.error("Fehler beim Drucken"); }
  };

  const [showMailDialog, setShowMailDialog] = useState(null);
  const [mailMode, setMailMode] = useState("bb"); // "bb" = Betterbird direkt, "eml" = .eml-Datei

  const onOpenMailClient = () => {
    if (isNew) { toast.error("Bitte speichern Sie zuerst das Dokument"); return; }
    setShowMailDialog({ open: true });
  };

  const executeMailClient = async (withText, saveFirst) => {
    if (!(await ensureLohnanteilOrConfirm())) return;
    // Immer speichern, damit das angehaengte PDF den aktuellen Stand zeigt
    const savedId = await persistDocument();
    if (!savedId) return;
    try {
      const ep = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
      const res = await api.get(`/eml/${ep}/${savedId}?text=${withText ? 1 : 0}&t=${Date.now()}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "message/rfc822" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titles[type]}_${docNumber || savedId}.eml`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("E-Mail mit PDF-Anhang erstellt - jetzt in Betterbird oeffnen");
      if (status && !["Versendet", "Gesendet", "Bezahlt", "Teilbezahlt"].includes(status)) {
        const newStatus = "Gesendet";
        const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
        api.put(`/${endpoint}/${savedId}/status`, { status: newStatus }).then(() => setStatus(newStatus)).catch(() => {});
      }
    } catch {
      toast.error("Fehler beim Erstellen der E-Mail-Datei");
    }
    setShowMailDialog(null);
  };

  // Betterbird direkt via lokalem Helfer (Protokoll bbcompose://). PDF + Text
  // werden vom Helfer-Skript geladen; siehe windows-helfer/ANLEITUNG.txt.
  const executeBetterbirdDirect = async (withText) => {
    if (!(await ensureLohnanteilOrConfirm())) return;
    // Dokument zuerst speichern, damit eine gueltige ID vorhanden ist.
    const savedId = await persistDocument();
    if (!savedId || typeof savedId !== "string" || !savedId.trim()) {
      toast.error("Dokument konnte nicht gespeichert werden – Betterbird-Aufruf abgebrochen.");
      return;
    }
    const ep = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
    const token = localStorage.getItem("token") || "";
    const base = process.env.REACT_APP_BACKEND_URL || "";
    if (!base) {
      toast.error("Backend-Adresse fehlt – Betterbird-Aufruf abgebrochen.");
      return;
    }
    const url = `bbcompose://compose?base=${encodeURIComponent(base)}&type=${ep}&id=${encodeURIComponent(savedId.trim())}&token=${encodeURIComponent(token)}&text=${withText ? 1 : 0}`;
    window.location.href = url;
    toast.success("Betterbird wird geöffnet … (lokaler Helfer muss installiert sein)");
    if (status && !["Versendet", "Gesendet", "Bezahlt", "Teilbezahlt"].includes(status)) {
      const newStatus = "Gesendet";
      const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
      api.put(`/${endpoint}/${savedId}/status`, { status: newStatus }).then(() => setStatus(newStatus)).catch(() => {});
    }
    setShowMailDialog(null);
  };

  const dispatchMail = (withText) =>
    mailMode === "bb" ? executeBetterbirdDirect(withText) : executeMailClient(withText, false);
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
    <div className="min-h-screen bg-[#E7E3DA] dark:bg-[#3A3632]">
      <EditorToolbar
        type={type} isNew={isNew} titles={titles} listPaths={listPaths} docNumber={docNumber} status={status} selectedCustomerId={selectedCustomerId}
        isRecording={isRecording} aiLoading={aiLoading} saving={saving}
        navigate={navigate} setShowSettings={setShowSettings} startRecording={startRecording} stopRecording={stopRecording}
        handleSave={handleSave} handleExit={handleExit} handleBack={handleBack} handleDownloadPDF={handleDownloadPDF} handlePrint={handlePrint}
        onOpenMailClient={onOpenMailClient}
        onToggleVorlagen={() => setShowVorlagen(v => !v)}
        onTogglePreview={() => setShowPreview(true)}
        onOpenDocTemplates={() => setShowLoadTemplate(true)}
        onToggleLohnkosten={() => setShowLohnkosten(v => !v)}
        onToggleLeistungen={() => setShowLeistungenPanel(v => !v)}
        onOpenDocCheck={() => setShowDocCheck(true)}
        onOpenPdfPreview={() => setShowPdfPreview(true)}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
      />

      <div className="pt-14 lg:pt-20 pb-4 lg:pb-8 overflow-x-auto overflow-y-visible">
        <div
          className="mx-auto"
          style={{
            width: `${794 * (zoomLevel / 100)}px`,
          }}
        >

          <div style={{ width: '794px', transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}>
            {/* Status Dropdown */}
            {!isNew && (
              <div className="mb-3 lg:mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="h-8 lg:h-9 rounded-sm border border-border bg-background text-foreground px-2 lg:px-3 text-xs lg:text-sm">
                    {type === "quote" && (<><option value="Entwurf">Status: Entwurf</option><option value="Gesendet">Status: Gesendet</option><option value="Beauftragt">Status: Beauftragt</option><option value="Abgelehnt">Status: Abgelehnt</option></>)}
                    {type === "order" && (<><option value="Offen">Status: Offen</option><option value="In Arbeit">Status: In Arbeit</option><option value="Gesendet">Status: Gesendet</option><option value="Abgeschlossen">Status: Abgeschlossen</option></>)}
                    {type === "invoice" && (<><option value="Entwurf">Status: Entwurf</option><option value="Offen">Status: Offen</option><option value="Gesendet">Status: Gesendet</option><option value="Bezahlt">Status: Bezahlt</option><option value="Überfällig">Status: Überfällig</option></>)}
                  </select>
                  {type === "quote" && (
                    <>
                      <button type="button" onClick={() => handleCopyTo("order")} disabled={copying} data-testid="btn-create-order-from-quote"
                        className="h-8 lg:h-9 px-3 rounded-sm text-xs lg:text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#1a6e3c" }}>
                        Auftragsbestätigung erstellen
                      </button>
                      <button type="button" onClick={() => handleCopyTo("invoice-from-quote")} disabled={copying} data-testid="btn-create-invoice-from-quote"
                        className="h-8 lg:h-9 px-3 rounded-sm text-xs lg:text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#003399" }}>
                        Rechnung erstellen
                      </button>
                    </>
                  )}
                  {type === "order" && (
                    <button type="button" onClick={() => handleCopyTo("invoice-from-order")} disabled={copying} data-testid="btn-create-invoice-from-order"
                      className="h-8 lg:h-9 px-3 rounded-sm text-xs lg:text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#003399" }}>
                      Rechnung erstellen
                    </button>
                  )}
                  {onOpenMailClient && (
                    <button type="button" onClick={onOpenMailClient} data-testid="btn-mailto-document-row2"
                      className="h-8 lg:h-9 px-3 rounded-sm text-xs lg:text-sm font-medium text-white transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700 flex items-center gap-1">
                      <ExternalLink className="w-4 h-4" /> Mailprogramm
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleSave} disabled={saving} data-testid="btn-save-document-row2"
                    className="h-8 lg:h-9 px-3 rounded-sm text-xs lg:text-sm font-medium text-white transition-colors disabled:opacity-50 bg-primary hover:bg-primary/90 flex items-center gap-1">
                    <Save className="w-4 h-4" /> {saving ? "..." : "Speichern"}
                  </button>
                  <button type="button" onClick={handleExit} disabled={saving} data-testid="btn-exit-document-row2"
                    className="h-8 lg:h-9 px-3 rounded-sm text-xs lg:text-sm font-medium text-white transition-colors disabled:opacity-50 bg-destructive hover:bg-destructive/90 flex items-center gap-1">
                    <X className="w-4 h-4" /> Beenden
                  </button>
                </div>
              </div>
            )}

            {/* Paper Document */}
            <div className="bg-white text-slate-800 shadow-xl rounded-sm border [&_input]:bg-white [&_input]:text-slate-800 [&_textarea]:bg-white [&_textarea]:text-slate-800" style={{ minHeight: "600px" }}
              onDragOver={handleDragOver} onDrop={handleDrop} data-testid="document-drop-zone">

              <DocumentHeader
                settings={settings} customer={customer} customers={customers}
                selectedCustomerId={selectedCustomerId} handleCustomerChange={handleCustomerChange}
                type={type} docNumber={docNumber} createdAt={createdAt}
                setPositions={setPositions} positions={positions}
              />

              {/* Dokument-Ueberschrift: grosse Titel-Zeile ueber Betreff (wie altes System) */}
              <div className="px-4 lg:px-10 py-4 lg:py-5 border-b bg-gradient-to-b from-primary/5 to-transparent">
                <div className="flex items-baseline gap-4 flex-wrap">
                  <h2 className="text-2xl lg:text-3xl font-bold" style={{ color: "#003399" }}>
                    {titles[type]}
                  </h2>
                  <span className="text-xl lg:text-2xl font-semibold text-slate-700 font-mono">
                    {docNumber || (isNew ? "(wird beim Speichern vergeben)" : "")}
                  </span>
                  <div className="flex-1" />
                  {createdAt && (
                    <span className="text-sm text-muted-foreground">
                      Datum: <span className="font-medium text-foreground">{new Date(createdAt).toLocaleDateString("de-DE")}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Betreff */}
              <div className="px-4 lg:px-10 py-3 lg:py-4 border-b">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Betreff</span>
                  <TextKorrekturButton
                    text={betreff}
                    onTrigger={() => setKorrekturTarget({ kontext: "betreff", label: "Betreff", text: betreff, setter: setBetreff })}
                    testId="btn-korrektur-betreff"
                  />
                </div>
                <TextTemplateSelect docType={docTypeMap[type]} textType="betreff" value={betreff} onChange={setBetreff} customer={customer} settings={settings} docNumber={docNumber} lohnanteilData={{ netto: effectiveLohnanteil, mwst: lohnanteilMwst, brutto: lohnanteilBrutto, vatRate }} docContext={{ due_days: dueDays != null ? Number(dueDays) : undefined, anzahlung: depositAmount }} />
              </div>

              {/* Vortext */}
              <div className="px-4 lg:px-10 py-3 lg:py-4 border-b">
                {customer && !customer.anrede && (
                  <div
                    className="mb-2 flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-100 border border-amber-200 dark:border-amber-300 text-amber-800 dark:text-amber-900 rounded-sm px-3 py-2"
                    data-testid="anrede-missing-hint"
                  >
                    <span className="text-amber-600 flex-shrink-0">⚠</span>
                    <span className="flex-1">
                      Keine Anrede beim Kunden hinterlegt – im Vortext wird <strong>„Sehr geehrte Damen und Herren"</strong> verwendet.
                    </span>
                  </div>
                )}
                {customer && customer.anrede && (() => {
                  const vorschlag = `${getAnredeBrief(customer)},`;
                  const schonDrin = (vortext || "").trim().startsWith(vorschlag);
                  if (schonDrin) return null;
                  return (
                    <div
                      className="mb-2 flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-100 border border-blue-200 dark:border-blue-300 text-blue-900 rounded-sm px-3 py-2"
                      data-testid="anrede-vorschlag-box"
                    >
                      <span className="text-blue-600 flex-shrink-0">💡</span>
                      <span className="flex-1">
                        Vorgeschlagene Anrede: <strong>„{vorschlag}"</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const rest = (vortext || "").trim();
                          setVortext(rest ? `${vorschlag}\n\n${rest}` : vorschlag);
                          toast.success("Anrede uebernommen");
                        }}
                        data-testid="btn-anrede-uebernehmen"
                        className="px-2.5 py-1 rounded-sm bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors flex-shrink-0"
                      >
                        Übernehmen
                      </button>
                    </div>
                  );
                })()}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vortext</span>
                  <TextKorrekturButton
                    text={vortext}
                    onTrigger={() => setKorrekturTarget({ kontext: "vortext", label: "Vortext", text: vortext, setter: setVortext })}
                    testId="btn-korrektur-vortext"
                  />
                </div>
                <TextTemplateSelect docType={docTypeMap[type]} textType="vortext" value={vortext} onChange={(v) => setVortext(htmlToPlain(v))} customer={customer} settings={settings} docNumber={docNumber} lohnanteilData={{ netto: effectiveLohnanteil, mwst: lohnanteilMwst, brutto: lohnanteilBrutto, vatRate }} docContext={{ due_days: dueDays != null ? Number(dueDays) : undefined, anzahlung: depositAmount }} />
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
                dueDays={dueDays} setDueDays={setDueDays} createdAt={createdAt}
                showLohnanteil={showLohnanteil} setShowLohnanteil={setShowLohnanteil}
                effectiveLohnanteil={effectiveLohnanteil} lohnanteilMwst={lohnanteilMwst} lohnanteilBrutto={lohnanteilBrutto}
                lohnanteilCustom={lohnanteilCustom} setLohnanteilCustom={setLohnanteilCustom} totalLaborCost={totalLaborCost}
              />

              {/* Schlusstext */}
              <div className="px-4 lg:px-10 py-3 lg:py-4 border-t">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schlusstext</span>
                  <TextKorrekturButton
                    text={schlusstext}
                    onTrigger={() => setKorrekturTarget({ kontext: "schlusstext", label: "Schlusstext", text: schlusstext, setter: setSchlusstext })}
                    testId="btn-korrektur-schlusstext"
                  />
                </div>
                <TextTemplateSelect docType={docTypeMap[type]} textType="schlusstext" value={schlusstext} onChange={(v) => setSchlusstext(htmlToPlain(v))} customer={customer} settings={settings} docNumber={docNumber} lohnanteilData={{ netto: effectiveLohnanteil, mwst: lohnanteilMwst, brutto: lohnanteilBrutto, vatRate }} docContext={{ due_days: dueDays != null ? Number(dueDays) : undefined, anzahlung: depositAmount }} />
              </div>

              {/* Footer (3-spaltig wie PDF: Firma+Inhaber+Adresse · Kontakt+St.-Nr. · Bank) */}
              <div className="px-4 lg:px-10 py-3 lg:py-4 border-t text-[9px] lg:text-[10px] text-slate-600" data-testid="document-footer">
                <div className="border-t border-slate-200 pt-2 grid grid-cols-3 gap-4 leading-tight">
                  <div>
                    <p className="font-bold text-slate-700">{settings.company_name || "Tischlerei Graupner"}</p>
                    {settings.owner_name && <p>Inh. {settings.owner_name}</p>}
                    {(settings.address || "").split("\n").slice(0, 2).map((line, i) => (
                      <p key={i}>{line.trim()}</p>
                    ))}
                  </div>
                  <div>
                    {settings.phone && <p>Tel: {settings.phone}</p>}
                    {settings.email && <p>{settings.email}</p>}
                    {settings.website && <p>{settings.website}</p>}
                    {settings.tax_id && <p>St.-Nr.: {settings.tax_id}</p>}
                  </div>
                  <div>
                    {settings.bank_name && <p>{settings.bank_name}</p>}
                    {settings.iban && <p>IBAN: {settings.iban}</p>}
                    {settings.bic && <p>BIC: {settings.bic}</p>}
                  </div>
                </div>
                <div className="text-right text-[8px] text-slate-400 mt-1">Seite 1</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Leistungen & Artikel Slide-Over, ueber Werkzeugleiste erreichbar, unabhaengig vom Scrollen */}
      {showLeistungenPanel && (
        <div className="fixed left-0 top-14 lg:top-20 bottom-0 w-full sm:w-[380px] z-40 bg-card border-r shadow-2xl overflow-hidden" data-testid="leistungen-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-base font-semibold">Leistungen & Artikel</h2>
            <button onClick={() => setShowLeistungenPanel(false)} className="p-1 hover:bg-muted rounded-sm" data-testid="btn-close-leistungen" title="Schliessen">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
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
          </div>
        </div>
      )}
      {/* Lohnkosten Slide-Over (nicht-modal, Editor bleibt klickbar) */}
      {showLohnkosten && (
        <div className="fixed right-0 top-14 lg:top-20 bottom-0 w-full sm:w-[360px] z-40 bg-card border-l shadow-2xl overflow-y-auto" data-testid="lohnkosten-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-base font-semibold">Lohnkosten</h2>
            <button onClick={() => setShowLohnkosten(false)} className="p-1 hover:bg-muted rounded-sm" data-testid="btn-close-lohnkosten" title="Schliessen">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <LohnkostenSidebar
              positions={positions}
              vatRate={vatRate}
              showLohnanteil={showLohnanteil}
              setShowLohnanteil={setShowLohnanteil}
              lohnanteilCustom={lohnanteilCustom}
              setLohnanteilCustom={setLohnanteilCustom}
            />
          </div>
        </div>
      )}

      {/* In-App-E-Mail (SMTP) entfernt – Versand nur noch über Mailprogramm (Betterbird/.eml) */}

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

      {/* Beenden-Dialog */}
      {showMailDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="mail-client-dialog">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="p-5 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                Mailprogramm öffnen
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Wie soll die E-Mail vorbereitet werden?</p>
            </div>
            <div className="p-5 space-y-2">
              <div className="flex gap-2 mb-1" data-testid="mail-mode-toggle">
                <button
                  type="button"
                  onClick={() => setMailMode("bb")}
                  className={`flex-1 px-3 py-2 text-sm rounded-sm border ${mailMode === "bb" ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"}`}
                  data-testid="btn-mode-betterbird"
                >
                  Betterbird direkt
                </button>
                <button
                  type="button"
                  onClick={() => setMailMode("eml")}
                  className={`flex-1 px-3 py-2 text-sm rounded-sm border ${mailMode === "eml" ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"}`}
                  data-testid="btn-mode-eml"
                >
                  .eml herunterladen
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {mailMode === "bb"
                  ? "Öffnet Betterbird direkt mit PDF-Anhang (lokaler Helfer nötig)."
                  : "Lädt eine .eml-Datei zum Öffnen im Mailprogramm."}
              </p>
              <button
                onClick={() => dispatchMail(true)}
                className="w-full p-3 rounded-sm border-2 border-primary bg-primary/5 hover:bg-primary/10 text-left flex items-start gap-3"
                data-testid="btn-mail-with-text"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">✓</div>
                <div>
                  <div className="font-semibold text-primary">Mit Vortext &amp; Schlusstext senden</div>
                  <div className="text-xs text-muted-foreground">Vortext, Schlusstext und Grußformel werden in die E-Mail übernommen</div>
                </div>
              </button>
              <button
                onClick={() => dispatchMail(false)}
                className="w-full p-3 rounded-sm border hover:bg-muted/40 text-left flex items-start gap-3"
                data-testid="btn-mail-without-text"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0 font-bold">—</div>
                <div>
                  <div className="font-semibold">Ohne Text (leer)</div>
                  <div className="text-xs text-muted-foreground">E-Mail wird ohne Inhalt vorbereitet - du schreibst selbst</div>
                </div>
              </button>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setShowMailDialog(null)}
                className="px-4 py-2 text-sm border rounded-sm hover:bg-muted"
                data-testid="btn-mail-cancel"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="exit-confirm-dialog">
          <div className="bg-card rounded-lg shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Dokument beenden</h3>
            <p className="text-sm text-muted-foreground mb-6">Moechten Sie vor dem Beenden speichern?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleExitWithSaveKunde} className="w-full px-4 py-2.5 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" data-testid="btn-exit-save-kunde">
                Speichern und zum Kunden
              </button>
              <button onClick={handleExitWithSaveProjekt} className="w-full px-4 py-2.5 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" data-testid="btn-exit-save-projekt">
                Speichern und zum Projekt
              </button>
              <button onClick={handleExitWithSave} className="w-full px-4 py-2.5 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" data-testid="btn-exit-save">
                Speichern und Beenden
              </button>
              <button onClick={handleExitWithoutSave} className="w-full px-4 py-2.5 text-sm font-medium rounded-sm border hover:bg-destructive/10 text-destructive transition-colors" data-testid="btn-exit-no-save">
                Ohne Speichern beenden
              </button>
              <button onClick={() => setShowExitConfirm(false)} className="w-full px-4 py-2.5 text-sm font-medium rounded-sm border hover:bg-muted transition-colors" data-testid="btn-exit-cancel">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
      {copyFlow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="copyflow-dialog">
          <div className="bg-card rounded-lg shadow-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-2">{copyFlow.step === "vortext" ? "Vortext" : "Schlusstext"} fuer neue {copyTargetLabel[copyFlow.target]}</h3>
            <p className="text-sm text-muted-foreground mb-4">Vorlage auswaehlen oder den bisherigen Text uebernehmen.</p>
            <TextTemplateSelect
              docType={copyTargetDocType[copyFlow.target]}
              textType={copyFlow.step}
              value={copyFlow.step === "vortext" ? copyFlow.vortext : copyFlow.schlusstext}
              onChange={(v) => setCopyFlow(f => f.step === "vortext" ? { ...f, vortext: htmlToPlain(v) } : { ...f, schlusstext: htmlToPlain(v) })}
              customer={customer}
              settings={settings}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setCopyFlow(null)} className="px-4 py-2 text-sm font-medium rounded-sm border hover:bg-muted transition-colors" data-testid="btn-copyflow-cancel">
                Abbrechen
              </button>
              {copyFlow.step === "vortext" ? (
                <button onClick={() => setCopyFlow(f => ({ ...f, step: "schlusstext" }))} className="px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" data-testid="btn-copyflow-next">
                  Weiter zum Schlusstext
                </button>
              ) : (
                <button onClick={finishCopyFlow} disabled={copying} className="px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50" data-testid="btn-copyflow-finish">
                  {copying ? "Erstelle..." : `${copyTargetLabel[copyFlow.target]} erstellen`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showTemplateDialog && (
        <SaveAsTemplateDialog
          docType={type}
          docId={showTemplateDialog}
          defaultName={betreff || `${titles[type]} vom ${new Date().toLocaleDateString("de-DE")}`}
          onClose={() => setShowTemplateDialog(false)}
        />
      )}

      {showLoadTemplate && (
        <LoadTemplateDialog
          preferredType={type}
          onClose={() => setShowLoadTemplate(false)}
          onSelect={applyTemplate}
        />
      )}

      {korrekturTarget && (
        <TextKorrekturModal
          isOpen={true}
          original={korrekturTarget.text}
          kontext={korrekturTarget.kontext}
          feldLabel={korrekturTarget.label}
          onAccept={(corrected) => korrekturTarget.setter(corrected)}
          onClose={() => setKorrekturTarget(null)}
        />
      )}

      {showPdfPreview && (
        <PdfPreviewModal
          isOpen={true}
          onClose={() => setShowPdfPreview(false)}
          filename={`${titles[type]}_${docNumber}.pdf`}
          getPdfBlob={async () => {
            const savedId = await persistDocument();
            if (!savedId) return null;
            const endpoint = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
            const res = await api.get(`/pdf/${endpoint}/${savedId}?t=${Date.now()}`, { responseType: "blob" });
            return new Blob([res.data], { type: "application/pdf" });
          }}
        />
      )}

      {showDocCheck && (() => {
        const docFields = [
          { id: "betreff", label: "Betreff", text: betreff, kontext: "betreff" },
          { id: "vortext", label: "Vortext", text: vortext, kontext: "vortext" },
          { id: "schlusstext", label: "Schlusstext", text: schlusstext, kontext: "schlusstext" },
          { id: "notes", label: "Bemerkung", text: notes, kontext: "allgemein" },
          ...positions.map((p, i) => ({
            id: `position-${i}`,
            label: `Position ${i + 1}`,
            text: p?.description || "",
            kontext: "allgemein",
          })).filter(f => f.text.trim()),
        ];
        const lohnanteilLeer = !(effectiveLohnanteil > 0);
        const issues = validateDocument({
          customer, betreff, positions, type,
          dueDays, anzahlungProzent: depositAmount, abschlag: discount, mwstSatz: vatRate,
          lohnanteilLeer,
        });
        const applyOne = (r) => {
          if (r.id === "betreff") setBetreff(r.corrected);
          else if (r.id === "vortext") setVortext(r.corrected);
          else if (r.id === "schlusstext") setSchlusstext(r.corrected);
          else if (r.id === "notes") setNotes(r.corrected);
          else if (r.id.startsWith("position-")) {
            const idx = parseInt(r.id.split("-")[1], 10);
            updatePosition(idx, "description", r.corrected);
          }
        };
        const createLohnanteilText = async () => {
          try {
            const res = await api.get("/modules/textvorlagen/data", { params: { doc_type: "allgemein", text_type: "bemerkung" } });
            const tpl = (res.data || []).find(t => /35a|lohnanteil/i.test(t.title || ""));
            if (!tpl) { toast.error("Keine §35a-Textvorlage gefunden"); return false; }
            const lohnanteilData = { netto: effectiveLohnanteil, mwst: lohnanteilMwst, brutto: lohnanteilBrutto, vatRate };
            const text = resolvePlaceholders(tpl.content, customer, settings, docNumber, lohnanteilData);
            setSchlusstext(prev => (prev && prev.trim() ? prev.trimEnd() + "\n\n" : "") + text);
            toast.success("Lohnanteiltext in Schlusstext eingefügt");
            return true;
          } catch {
            toast.error("Fehler beim Laden der Lohnanteil-Textvorlage");
            return false;
          }
        };
        const kontextInfo = [
          `${titles[type]}${docNumber ? " " + docNumber : ""}`,
          customer ? `Kunde: ${(customer.name || customer.firma || "").trim()}` : null,
          positions?.length ? `${positions.length} Position(en)` : null,
        ].filter(Boolean).join(", ");
        return (
          <DocumentCheckModal
            isOpen={true}
            onClose={() => setShowDocCheck(false)}
            fields={docFields}
            issues={issues}
            kontextInfo={kontextInfo}
            type={type}
            lohnanteilEingetragen={effectiveLohnanteil > 0}
            onCreateLohnanteilText={createLohnanteilText}
            onApply={applyOne}
            onApplyAll={(items) => items.forEach(applyOne)}
          />
        );
      })()}
    </div>
  );
};


// ==================== SAVE AS TEMPLATE DIALOG ====================
const SaveAsTemplateDialog = ({ docType, docId, defaultName, onClose }) => {
  const [step, setStep] = useState("ask"); // ask -> name -> done
  const [name, setName] = useState(defaultName);
  const [anonymize, setAnonymize] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Name erforderlich"); return; }
    setSaving(true);
    try {
      await api.post("/document-templates/from-document", {
        doc_type: docType, source_id: docId, name: name.trim(), anonymize,
      });
      setStep("done");
      toast.success("Als Vorlage gespeichert");
    } catch (e) { toast.error(e?.response?.data?.detail || "Fehler"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="save-template-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        {step === "ask" && (
          <>
            <div className="p-5 border-b">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Als Vorlage speichern?</h3>
              </div>
              <p className="text-sm text-muted-foreground">Du kannst dieses Dokument als wiederverwendbare Vorlage ablegen. Beim nächsten ähnlichen Auftrag in 2 Klicks wieder da.</p>
            </div>
            <div className="p-5 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted" data-testid="tpl-ask-no">Nein, danke</button>
              <button onClick={() => setStep("name")} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90" data-testid="tpl-ask-yes">
                Ja, Vorlage anlegen
              </button>
            </div>
          </>
        )}
        {step === "name" && (
          <>
            <div className="p-5 border-b">
              <h3 className="text-lg font-semibold mb-1">Vorlage benennen</h3>
              <p className="text-sm text-muted-foreground">Gib einen Namen, unter dem du die Vorlage später wiederfindest.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Vorlagenname</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-sm p-2 text-sm" autoFocus placeholder='z.B. "Hebeschiebe Wartung Standard"' data-testid="tpl-name-input" />
              </div>
              <label className="flex items-start gap-2 p-3 border rounded-sm cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={anonymize} onChange={e => setAnonymize(e.target.checked)} className="mt-0.5" data-testid="tpl-anonymize" />
                <div>
                  <div className="text-sm font-medium">Anschrift als Max Mustermann anlegen?</div>
                  <div className="text-xs text-muted-foreground">
                    {anonymize ? "✓ Empfohlen: Kundendaten werden durch Mustermann-Anschrift ersetzt. Die Vorlage ist damit allgemein wiederverwendbar." : "✗ Die Vorlage behält die echten Kundendaten (für persönliche Vorlagen eines Stammkunden)."}
                  </div>
                </div>
              </label>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <button onClick={() => setStep("ask")} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Zurück</button>
              <button onClick={save} disabled={saving || !name.trim()} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50" data-testid="tpl-save-final">
                {saving ? "Speichere..." : "Als Vorlage speichern"}
              </button>
            </div>
          </>
        )}
        {step === "done" && (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">Gespeichert!</h3>
            <p className="text-sm text-muted-foreground mb-4">Du findest die Vorlage unter <strong>Einstellungen → Dokument-Vorlagen</strong> oder <strong>Dokumente → Vorlagen</strong>.</p>
            <button onClick={onClose} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">Weiter arbeiten</button>
          </div>
        )}
      </div>
    </div>
  );
};

export { WysiwygDocumentEditor };


// ==================== LOAD TEMPLATE DIALOG ====================
const TYPE_META = {
  quote: { label: "Angebot", icon: FileText, bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-900" },
  order: { label: "Auftragsbestätigung", icon: ClipboardCheck, bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-900" },
  invoice: { label: "Rechnung", icon: Receipt, bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-900" },
};

const LoadTemplateDialog = ({ preferredType, onClose, onSelect }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyFavs, setOnlyFavs] = useState(false);

  useEffect(() => {
    api.get("/document-templates")
      .then(r => setList(r.data))
      .catch(() => toast.error("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = list
    .filter(t => typeFilter === "all" || t.doc_type === typeFilter)
    .filter(t => !onlyFavs || t.favorite)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.name || "").toLowerCase().includes(q) ||
             JSON.stringify(t.snapshot?.positions || []).toLowerCase().includes(q);
    });

  const confirmSelect = (tpl) => {
    if (tpl.doc_type !== preferredType) {
      const typeLabels = { quote: "Angebot", order: "Auftragsbestätigung", invoice: "Rechnung" };
      if (!window.confirm(`Diese Vorlage ist ein "${typeLabels[tpl.doc_type]}". Möchtest du sie trotzdem in dein ${typeLabels[preferredType]} laden?`)) return;
    }
    if (!window.confirm("Bestehende Positionen und Texte werden durch die Vorlage ersetzt. Fortfahren?")) return;
    onSelect(tpl);
  };

  const stats = {
    total: list.length,
    quote: list.filter(t => t.doc_type === "quote").length,
    order: list.filter(t => t.doc_type === "order").length,
    invoice: list.filter(t => t.doc_type === "invoice").length,
  };

  const tabs = [
    { id: "all", label: "Alle", count: stats.total },
    { id: "quote", label: "Angebote", count: stats.quote },
    { id: "order", label: "Aufträge", count: stats.order },
    { id: "invoice", label: "Rechnungen", count: stats.invoice },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="load-template-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Vorlage öffnen</h3>
            <p className="text-xs text-muted-foreground mt-1">Angebote, Auftragsbestätigungen und Rechnungen in einem Modul – wähle eine Vorlage zum Laden.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm">✕</button>
        </div>

        <div className="p-4 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Vorlage suchen (Name oder Position)..."
              className="w-full pl-10 pr-3 py-2 border rounded-sm text-sm"
              autoFocus
              data-testid="load-tpl-search"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1 rounded-sm text-xs font-medium border ${typeFilter === t.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border"}`}
                data-testid={`load-tpl-filter-${t.id}`}
              >
                {t.label} {t.count > 0 && <span className="opacity-70">({t.count})</span>}
              </button>
            ))}
            <button
              onClick={() => setOnlyFavs(!onlyFavs)}
              className={`px-3 py-1 rounded-sm text-xs font-medium border flex items-center gap-1 ${onlyFavs ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700" : "hover:bg-muted border-border"}`}
            >
              <Star className={`w-3 h-3 ${onlyFavs ? "fill-amber-500" : ""}`} /> Favoriten
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Lade Vorlagen...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div className="font-medium mb-1">{list.length === 0 ? "Noch keine Vorlagen" : "Keine Treffer"}</div>
              <div className="text-sm">
                {list.length === 0
                  ? "Speichere ein Dokument und setze den Haken 'Als Vorlage speichern' um deine erste Vorlage zu erstellen."
                  : "Passe Suche oder Filter an."}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(tpl => {
                const meta = TYPE_META[tpl.doc_type] || TYPE_META.quote;
                const Icon = meta.icon;
                const positions = tpl.snapshot?.positions?.length || 0;
                const total = tpl.snapshot?.total_gross || 0;
                const isMatching = tpl.doc_type === preferredType;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => confirmSelect(tpl)}
                    className={`w-full text-left p-3 border rounded-sm hover:shadow-md hover:border-primary transition-all flex items-center gap-3 ${isMatching ? "border-primary/20 bg-primary/5" : ""}`}
                    data-testid={`load-tpl-${tpl.id}`}
                  >
                    <div className={`p-2 rounded-sm ${meta.bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${meta.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{tpl.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.bg} ${meta.text} border ${meta.border}`}>{meta.label}</span>
                        {tpl.favorite && <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />}
                        {isMatching && <span className="text-[10px] text-primary font-semibold">← passt zu {TYPE_META[preferredType].label}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                        <span>{positions} Position{positions !== 1 ? "en" : ""}</span>
                        {total > 0 && <span className="font-mono">{total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>}
                        {tpl.usage_count > 0 && <span>{tpl.usage_count}× genutzt</span>}
                      </div>
                    </div>
                    <span className="text-xs text-primary font-medium flex-shrink-0">Laden →</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            Tipp: Positionen und Texte aus der Vorlage werden ins aktuelle Dokument geladen. Kunde und Dokumentnummer bleiben unverändert.
          </div>
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Schließen</button>
        </div>
      </div>
    </div>
  );
};
