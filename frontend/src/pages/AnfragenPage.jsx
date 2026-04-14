import { useState, useEffect } from "react";
import { Search, Inbox, UserCheck, Trash2, ChevronDown, Globe, Mail, Phone, Pencil, MessageSquarePlus, Send, Upload, Wrench, FileText, X, Plus, Check, GripVertical, Settings2, CircleDot, Image as ImageIcon, Download, File } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge, Button, Modal, Textarea } from "@/components/common";
import { PortalButtons } from "@/components/PortalButtons";
import { api } from "@/lib/api";

const AnfragenPage = () => {
  const [anfragen, setAnfragen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedAnfrage, setSelectedAnfrage] = useState(null);
  const [editAnfrage, setEditAnfrage] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [quickNoteId, setQuickNoteId] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [quickNoteSaving, setQuickNoteSaving] = useState(false);
  const [vcfUploading, setVcfUploading] = useState(false);
  const [reparaturgruppen, setReparaturgruppen] = useState([]);
  const [emailAnfrage, setEmailAnfrage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editingCategories, setEditingCategories] = useState(false);
  const [catDraft, setCatDraft] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catDragIdx, setCatDragIdx] = useState(null);
  const [catDragOverIdx, setCatDragOverIdx] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [lightboxImg, setLightboxImg] = useState(null);
  const [createAnfrageModal, setCreateAnfrageModal] = useState(false);
  const [createForm, setCreateForm] = useState({
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
    address: "",
    objektadresse: "",
    objekt_strasse: "",
    objekt_hausnummer: "",
    objekt_plz: "",
    objekt_ort: "",
    categories: [],
    nachricht: "",
    notes: "",
    customer_type: "Privat",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    loadAnfragen();
    loadConfig();
    loadCategories();
  }, [activeCategory]);

  const loadConfig = async () => {
    try {
      const res = await api.get("/einsatz-config");
      setReparaturgruppen(res.data.reparaturgruppen || []);
    } catch {}
  };

  const loadCategories = async () => {
    try {
      const res = await api.get("/anfragen-kategorien");
      setCategories(res.data);
    } catch {}
  };

  const saveCategories = async () => {
    setCatSaving(true);
    try {
      await api.put("/anfragen-kategorien", { kategorien: catDraft.filter(c => c.trim()) });
      setCategories(catDraft.filter(c => c.trim()));
      setEditingCategories(false);
      toast.success("Kategorien gespeichert");
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setCatSaving(false); }
  };

  const loadAnfragen = async () => {
    try {
      const params = activeCategory ? { category: activeCategory } : {};
      const res = await api.get("/anfragen", { params });
      setAnfragen(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Anfragen");
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (id) => {
    try {
      await api.post(`/anfragen/${id}/convert`);
      toast.success("Anfrage wurde in Kunde umgewandelt");
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Umwandeln");
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      await api.delete(`/anfragen/${id}`);
      toast.success("Anfrage gelöscht");
      setConfirmDeleteId(null);
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const [editUploadedFiles, setEditUploadedFiles] = useState([]);
  const [editSelectedFiles, setEditSelectedFiles] = useState([]);
  const [editUploadingFiles, setEditUploadingFiles] = useState(false);

  const openEdit = (anfrage) => {
    setEditAnfrage(anfrage);
    // Parse alte Adresse wenn vorhanden
    let strasse = "", hausnummer = "", plz = "", ort = "";
    if (anfrage.address && !anfrage.strasse) {
      const parts = anfrage.address.split(",").map(p => p.trim());
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
    setEditForm({
      anrede: anfrage.anrede || "",
      vorname: anfrage.vorname || "",
      nachname: anfrage.nachname || "",
      name: anfrage.name || "",
      email: anfrage.email || "",
      phone: anfrage.phone || "",
      strasse: anfrage.strasse || strasse,
      hausnummer: anfrage.hausnummer || hausnummer,
      plz: anfrage.plz || plz,
      ort: anfrage.ort || ort,
      address: anfrage.address || "",
      obj_address: anfrage.obj_address || "",
      objekt_strasse: anfrage.objekt_strasse || "",
      objekt_hausnummer: anfrage.objekt_hausnummer || "",
      objekt_plz: anfrage.objekt_plz || "",
      objekt_ort: anfrage.objekt_ort || "",
      firma: anfrage.firma || "",
      customer_type: anfrage.customer_type || "Privat",
      nachricht: anfrage.nachricht || "",
      notes: anfrage.notes || "",
      categories: anfrage.categories || [],
      reparaturgruppen: anfrage.reparaturgruppen || (anfrage.reparaturgruppe ? [anfrage.reparaturgruppe] : []),
    });
    setEditUploadedFiles(anfrage.photos || []);
    setEditSelectedFiles([]);
  };

  const handleSaveEdit = async () => {
    if (!editAnfrage) return;
    setSaving(true);
    try {
      const addressCombined = `${editForm.strasse} ${editForm.hausnummer}, ${editForm.plz} ${editForm.ort}`.trim();
      const payload = {
        ...editForm,
        address: addressCombined || editForm.address,
      };
      await api.put(`/anfragen/${editAnfrage.id}`, payload);
      
      // Upload files if any
      if (editSelectedFiles.length > 0) {
        await handleEditFileUpload(editAnfrage.id);
      }
      
      toast.success("Anfrage aktualisiert");
      setEditAnfrage(null);
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleEditFileUpload = async (anfrageId) => {
    if (editSelectedFiles.length === 0) return;
    setEditUploadingFiles(true);
    try {
      const formData = new FormData();
      editSelectedFiles.forEach(file => formData.append('files', file));
      await api.post(`/anfragen/${anfrageId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEditSelectedFiles([]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Upload");
    } finally {
      setEditUploadingFiles(false);
    }
  };

  const handleEditFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const MAX_FILES = 10;
    const MAX_SIZE = 10 * 1024 * 1024;
    const totalFiles = editUploadedFiles.length + editSelectedFiles.length + files.length;
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
    setEditSelectedFiles(prev => [...prev, ...files]);
  };

  const handleEditDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleEditFileSelect({ target: { files: e.dataTransfer.files } });
  };

  const deleteEditUploadedFile = async (index) => {
    if (!editAnfrage) return;
    try {
      await api.delete(`/anfragen/${editAnfrage.id}/files/${index}`);
      toast.success("Datei gelöscht");
      setEditUploadedFiles(prev => prev.filter((_, i) => i !== index));
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const toggleCategory = (cat) => {
    setEditForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const openQuickNote = (anfrage) => {
    setQuickNoteId(anfrage.id);
    setQuickNoteText("");
  };

  const saveQuickNote = async (anfrage) => {
    if (!quickNoteText.trim()) { setQuickNoteId(null); return; }
    setQuickNoteSaving(true);
    try {
      const timestamp = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const existing = anfrage.notes || "";
      const newNotes = existing
        ? `${existing}\n[${timestamp}] ${quickNoteText.trim()}`
        : `[${timestamp}] ${quickNoteText.trim()}`;
      await api.put(`/anfragen/${anfrage.id}`, { notes: newNotes });
      toast.success("Notiz gespeichert");
      setQuickNoteId(null);
      setQuickNoteText("");
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Speichern der Notiz");
    } finally {
      setQuickNoteSaving(false);
    }
  };

  const STATUS_CYCLE = ["ungelesen", "gelesen", "zu_bearbeiten", "erledigt"];
  const STATUS_LABELS = { ungelesen: "Ungelesen", gelesen: "Gelesen", zu_bearbeiten: "Zu bearbeiten", erledigt: "Erledigt" };
  const STATUS_COLORS = {
    ungelesen: "bg-red-500",
    gelesen: "bg-blue-500",
    zu_bearbeiten: "bg-amber-500",
    erledigt: "bg-green-500",
  };

  const toggleAnfrageStatus = async (anfrage) => {
    const current = anfrage.bearbeitungsstatus || "ungelesen";
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    try {
      await api.put(`/anfragen/${anfrage.id}/status`, { bearbeitungsstatus: next });
      setAnfragen(anfragen.map(a => a.id === anfrage.id ? { ...a, bearbeitungsstatus: next } : a));
    } catch {}
  };

  const handleVcfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVcfUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/anfragen/import-vcf", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`VCF importiert: ${file.name}`);
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim VCF-Import");
    } finally {
      setVcfUploading(false);
      e.target.value = "";
    }
  };

  const handleCreateAnfrage = async () => {
    if (!createForm.vorname && !createForm.nachname && !createForm.firma) {
      toast.error("Vorname, Nachname oder Firmenname ist erforderlich");
      return;
    }
    
    setSaving(true);
    try {
      // Kombiniere Adresse aus Einzelfeldern
      const addressCombined = `${createForm.strasse} ${createForm.hausnummer}, ${createForm.plz} ${createForm.ort}`.trim();
      const objektadresseCombined = `${createForm.objekt_strasse} ${createForm.objekt_hausnummer}, ${createForm.objekt_plz} ${createForm.objekt_ort}`.trim();
      
      // Generate combined name
      const name = createForm.firma || `${createForm.vorname} ${createForm.nachname}`.trim();
      
      const payload = {
        ...createForm,
        name,
        address: addressCombined || createForm.address,
        objektadresse: objektadresseCombined || addressCombined || createForm.address
      };
      
      const res = await api.post("/anfragen", payload);
      const anfrageId = res.data.id;
      
      // Upload files if any
      if (selectedFiles.length > 0 && anfrageId) {
        await handleFileUpload(anfrageId);
      }
      
      toast.success("Anfrage erfolgreich angelegt");
      setCreateAnfrageModal(false);
      setCreateForm({
        anrede: "",
        vorname: "",
        nachname: "",
        name: "",
        firma: "",
        email: "",
        phone: "",
        strasse: "",
        hausnummer: "",
        plz: "",
        ort: "",
        address: "",
        objektadresse: "",
        objekt_strasse: "",
        objekt_hausnummer: "",
        objekt_plz: "",
        objekt_ort: "",
        categories: [],
        nachricht: "",
        notes: "",
        customer_type: "Privat",
      });
      setSelectedFiles([]);
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Anlegen der Anfrage");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (anfrageId) => {
    if (selectedFiles.length === 0) return;
    
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      
      const res = await api.post(`/anfragen/${anfrageId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(res.data.message);
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
    
    const totalFiles = selectedFiles.length + files.length;
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

  const getFileIcon = (file) => {
    const name = file.name || '';
    const type = file.type || '';
    
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const getFileSize = (file) => {
    if (file.size) {
      const kb = file.size / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return '';
  };

  const parseNotes = (notes) => {
    if (!notes) return {};
    const result = {};
    for (const line of notes.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const val = line.substring(colonIdx + 1).trim();
        if (val) result[key] = val;
      }
    }
    return result;
  };

  const filtered = anfragen.filter((a) => {
    if (statusFilter && (a.bearbeitungsstatus || "ungelesen") !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    const repGruppen = a.reparaturgruppen || (a.reparaturgruppe ? [a.reparaturgruppe] : []);
    return (
      ((a.vorname || a.nachname) ? `${a.vorname || ''} ${a.nachname || ''}`.trim() : (a.name || '')).toLowerCase().includes(s) ||
      (a.email || "").toLowerCase().includes(s) ||
      (a.nachricht || "").toLowerCase().includes(s) ||
      (a.phone || "").toLowerCase().includes(s) ||
      (a.firma || "").toLowerCase().includes(s) ||
      (a.categories || []).some((c) => c.toLowerCase().includes(s)) ||
      repGruppen.some((g) => g.toLowerCase().includes(s))
    );
  });

  return (
    <div data-testid="anfragen-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Anfragen</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{anfragen.length} Anfragen gesamt</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={() => setCreateAnfrageModal(true)} data-testid="btn-neue-anfrage" size="sm" className="lg:h-10 lg:px-4">
            <Plus className="w-4 h-4" /> Neue Anfrage
          </Button>
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium cursor-pointer transition-colors ${vcfUploading ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`} data-testid="btn-vcf-import">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{vcfUploading ? "Importiere..." : "VCF importieren"}</span>
            <input type="file" accept=".vcf" onChange={handleVcfUpload} className="hidden" disabled={vcfUploading} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2" data-testid="anfragen-status-filter">
        {[
          { key: "", label: "Alle", color: "" },
          { key: "ungelesen", label: `Ungelesen (${anfragen.filter(a => !a.bearbeitungsstatus || a.bearbeitungsstatus === "ungelesen").length})`, color: "bg-red-500" },
          { key: "gelesen", label: `Gelesen (${anfragen.filter(a => a.bearbeitungsstatus === "gelesen").length})`, color: "bg-blue-500" },
          { key: "zu_bearbeiten", label: `Zu bearbeiten (${anfragen.filter(a => a.bearbeitungsstatus === "zu_bearbeiten").length})`, color: "bg-amber-500" },
          { key: "erledigt", label: `Erledigt (${anfragen.filter(a => a.bearbeitungsstatus === "erledigt").length})`, color: "bg-green-500" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === f.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`status-filter-${f.key || "alle"}`}
          >
            {f.color && <span className={`w-2 h-2 rounded-full ${f.color}`} />}
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="anfragen-category-filter">
        <button
          onClick={() => { setActiveCategory(""); setLoading(true); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            !activeCategory
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          data-testid="filter-all"
        >
          Alle ({anfragen.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setLoading(true); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => { setCatDraft([...categories]); setNewCatName(""); setEditingCategories(true); }}
          className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Kategorien verwalten"
          data-testid="btn-edit-categories"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Kategorie-Editor Inline */}
      {editingCategories && (
        <Card className="p-4 mb-4 border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-200" data-testid="category-editor">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Settings2 className="w-4 h-4" /> Kategorien verwalten
            </h3>
            <button onClick={() => setEditingCategories(false)} className="p-1 hover:bg-muted rounded-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5 mb-3">
            {catDraft.map((cat, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => setCatDragIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); setCatDragOverIdx(idx); }}
                onDragLeave={() => setCatDragOverIdx(null)}
                onDrop={() => {
                  if (catDragIdx != null && catDragIdx !== idx) {
                    const u = [...catDraft];
                    const [moved] = u.splice(catDragIdx, 1);
                    u.splice(idx, 0, moved);
                    setCatDraft(u);
                  }
                  setCatDragIdx(null); setCatDragOverIdx(null);
                }}
                onDragEnd={() => { setCatDragIdx(null); setCatDragOverIdx(null); }}
                className={`flex items-center gap-2 transition-all ${catDragOverIdx === idx ? "border-t-2 border-primary" : ""} ${catDragIdx === idx ? "opacity-40" : ""}`}
              >
                <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/50 hover:text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                </div>
                <input
                  value={cat}
                  onChange={(e) => { const u = [...catDraft]; u[idx] = e.target.value; setCatDraft(u); }}
                  className="flex-1 h-8 border rounded-sm px-3 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  data-testid={`cat-input-${idx}`}
                />
                <button
                  onClick={() => setCatDraft(catDraft.filter((_, i) => i !== idx))}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm transition-colors"
                  title="Löschen"
                  data-testid={`cat-delete-${idx}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatName.trim()) {
                  setCatDraft([...catDraft, newCatName.trim()]);
                  setNewCatName("");
                }
              }}
              placeholder="Neue Kategorie..."
              className="flex-1 h-8 border border-dashed border-primary/40 rounded-sm px-3 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none"
              data-testid="cat-new-input"
            />
            <button
              onClick={() => { if (newCatName.trim()) { setCatDraft([...catDraft, newCatName.trim()]); setNewCatName(""); } }}
              disabled={!newCatName.trim()}
              className="h-8 px-3 text-xs font-medium bg-primary/10 text-primary rounded-sm hover:bg-primary/20 disabled:opacity-40 transition-colors flex items-center gap-1"
              data-testid="cat-add-btn"
            >
              <Plus className="w-3.5 h-3.5" /> Hinzufügen
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingCategories(false)}>Abbrechen</Button>
            <Button size="sm" onClick={saveCategories} disabled={catSaving} data-testid="cat-save-btn">
              {catSaving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
          <Input
            data-testid="input-search-anfragen"
            className="pl-9 lg:pl-10 h-9 lg:h-10"
            placeholder="Anfragen durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <Inbox className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Anfragen vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {search || activeCategory ? "Keine Ergebnisse für diesen Filter" : "Neue Anfragen erscheinen hier automatisch"}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((anfrage) => {
            const isExpanded = expandedId === anfrage.id;
            const parsed = parseNotes(anfrage.notes);
            return (
              <Card
                key={anfrage.id}
                className={`transition-all duration-200 cursor-pointer overflow-hidden ${isExpanded ? 'shadow-lg border-primary/40 ring-1 ring-primary/20' : 'hover:shadow-md hover:border-primary/20'}`}
                data-testid={`anfrage-card-${anfrage.id}`}
              >
                {/* Kompakte Listenzeile */}
                <div
                  className="flex items-center gap-4 p-3 lg:p-4"
                  onClick={() => setSelectedAnfrage(anfrage)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleAnfrageStatus(anfrage); }}
                    className={`w-3 h-3 rounded-full shrink-0 transition-colors ${STATUS_COLORS[anfrage.bearbeitungsstatus || "ungelesen"]}`}
                    title={STATUS_LABELS[anfrage.bearbeitungsstatus || "ungelesen"]}
                    data-testid={`btn-status-${anfrage.id}`}
                  />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    {anfrage.vorname?.charAt(0)?.toUpperCase() || anfrage.nachname?.charAt(0)?.toUpperCase() || anfrage.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">
                        {anfrage.vorname && anfrage.nachname 
                          ? `${anfrage.vorname} ${anfrage.nachname}`
                          : anfrage.name}
                      </span>
                      {anfrage.firma && <Badge variant="info" className="text-xs">{anfrage.firma}</Badge>}
                      {anfrage.source && anfrage.source !== "manual" && (
                        <Badge variant="default" className="text-xs">{anfrage.source}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {anfrage.phone && <span><Phone className="w-3 h-3 inline mr-1" />{anfrage.phone}</span>}
                      {anfrage.email && <span className="truncate hidden sm:inline"><Mail className="w-3 h-3 inline mr-1" />{anfrage.email}</span>}
                      {anfrage.photos && anfrage.photos.length > 0 && <span className="text-primary"><ImageIcon className="w-3 h-3 inline mr-1" />{anfrage.photos.length} Bild{anfrage.photos.length > 1 ? 'er' : ''}</span>}
                      <span className="text-xs">
                        {new Date(anfrage.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  {(anfrage.categories || []).length > 0 && (
                    <div className="hidden lg:flex flex-wrap gap-1">
                      {anfrage.categories.map((cat) => (
                        <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEmailAnfrage(anfrage)}
                      data-testid={`btn-mail-${anfrage.id}`}
                      className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-sm transition-colors"
                      title="E-Mail senden"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openQuickNote(anfrage)}
                      data-testid={`btn-quicknote-${anfrage.id}`}
                      className={`p-2 rounded-sm transition-colors ${quickNoteId === anfrage.id ? 'bg-amber-200 text-amber-800' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'}`}
                      title="Schnellnotiz"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(anfrage)}
                      data-testid={`btn-edit-anfrage-${anfrage.id}`}
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-sm transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleConvert(anfrage.id)}
                      data-testid={`btn-convert-${anfrage.id}`}
                      className="p-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-sm transition-colors"
                      title="Als Kunde übernehmen"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(anfrage.id)}
                      data-testid={`btn-delete-anfrage-${anfrage.id}`}
                      className={`p-2 rounded-sm transition-colors ${confirmDeleteId === anfrage.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                      title={confirmDeleteId === anfrage.id ? "Nochmal klicken" : "Löschen"}
                    >
                      {confirmDeleteId === anfrage.id ? <span className="text-xs font-bold">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>

                {/* Schnellnotiz Inline */}
                {quickNoteId === anfrage.id && (
                  <div className="border-t bg-amber-50/60 px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-1 duration-150" data-testid={`quicknote-bar-${anfrage.id}`} onClick={(e) => e.stopPropagation()}>
                    <MessageSquarePlus className="w-4 h-4 text-amber-600 shrink-0" />
                    <input
                      autoFocus
                      data-testid={`quicknote-input-${anfrage.id}`}
                      className="flex-1 bg-white border border-amber-200 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Schnellnotiz eingeben..."
                      value={quickNoteText}
                      onChange={(e) => setQuickNoteText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveQuickNote(anfrage); if (e.key === "Escape") setQuickNoteId(null); }}
                      disabled={quickNoteSaving}
                    />
                    <button
                      onClick={() => saveQuickNote(anfrage)}
                      disabled={quickNoteSaving || !quickNoteText.trim()}
                      data-testid={`quicknote-save-${anfrage.id}`}
                      className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-sm transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setQuickNoteId(null)}
                      data-testid={`quicknote-cancel-${anfrage.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                    >
                      Esc
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail-Modal */}
      {selectedAnfrage && (() => {
        const anfrage = selectedAnfrage;
        const parsed = parseNotes(anfrage.notes);
        const quickNotes = (anfrage.notes || "").split("\n").filter(l => l.match(/^\[[\d.,: ]+\]/));
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" data-testid="anfrage-detail-modal">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedAnfrage(null)} />
            <div className="relative bg-background rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[calc(100vh-6rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-background border-b px-5 py-3 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold shrink-0">
                    {anfrage.vorname?.charAt(0)?.toUpperCase() || anfrage.nachname?.charAt(0)?.toUpperCase() || anfrage.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">
                      {anfrage.vorname && anfrage.nachname 
                        ? `${anfrage.vorname} ${anfrage.nachname}`
                        : anfrage.name}
                    </h2>
                    {anfrage.firma && (
                      <p className="text-sm text-muted-foreground">{anfrage.firma}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {anfrage.source !== "manual" && anfrage.source ? `Quelle: ${anfrage.source} · ` : ""}
                      {new Date(anfrage.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedAnfrage(null)} className="p-1.5 hover:bg-muted rounded-sm transition-colors" data-testid="btn-close-detail">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Kontaktdaten */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kontaktdaten</h4>
                    <div className="bg-muted/30 rounded-md p-3 space-y-1.5">
                      {anfrage.anrede && (
                        <p className="text-sm"><span className="font-medium">Anrede:</span> {anfrage.anrede}</p>
                      )}
                      {anfrage.firma && (
                        <p className="text-sm"><span className="font-medium">Firma:</span> {anfrage.firma}</p>
                      )}
                      {anfrage.vorname && (
                        <p className="text-sm"><span className="font-medium">Vorname:</span> {anfrage.vorname}</p>
                      )}
                      {anfrage.nachname && (
                        <p className="text-sm"><span className="font-medium">Nachname:</span> {anfrage.nachname}</p>
                      )}
                      {!anfrage.vorname && !anfrage.nachname && anfrage.name && (
                        <p className="text-sm"><span className="font-medium">Name:</span> {anfrage.name}</p>
                      )}
                      {anfrage.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <a href={`mailto:${anfrage.email}`} className="text-primary hover:underline truncate">{anfrage.email}</a>
                        </div>
                      )}
                      {anfrage.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <a href={`tel:${anfrage.phone}`} className="text-primary hover:underline">{anfrage.phone}</a>
                        </div>
                      )}
                      {anfrage.address && (
                        <div className="flex items-start gap-2 text-sm">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="whitespace-pre-line">{anfrage.address}</p>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(anfrage.address)}`); toast.success("Maps-Link kopiert!"); }}
                              className="text-xs text-primary hover:underline mt-0.5">Karten-Link kopieren</button>
                          </div>
                        </div>
                      )}
                      {anfrage.customer_type && <p className="text-sm"><span className="font-medium">Typ:</span> {anfrage.customer_type}</p>}
                    </div>
                  </div>

                  {/* Kategorien */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategorien & Details</h4>
                    {(anfrage.categories || []).length > 0 ? (
                      <div className="space-y-2">
                        {anfrage.categories.map((cat) => {
                          const descKey = Object.keys(parsed).find(k => k === cat);
                          return (
                            <div key={cat} className="bg-muted/30 rounded-md p-3">
                              <span className="text-sm font-medium text-primary">{cat}</span>
                              {descKey && parsed[descKey] && <p className="text-sm text-muted-foreground mt-0.5">{parsed[descKey]}</p>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Keine Kategorien</p>
                    )}
                    {anfrage.obj_address && (
                      <div className="bg-muted/30 rounded-md p-3">
                        <span className="text-xs font-medium text-muted-foreground">Objektadresse</span>
                        <p className="text-sm mt-0.5">{anfrage.obj_address}</p>
                        <button onClick={() => { navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(anfrage.obj_address)}`); toast.success("Maps-Link kopiert!"); }}
                          className="text-xs text-primary hover:underline mt-0.5">Karten-Link kopieren</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nachricht */}
                {anfrage.nachricht && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nachricht</h4>
                    <div className="bg-muted/30 rounded-md p-3">
                      <p className="text-sm whitespace-pre-line">{anfrage.nachricht}</p>
                    </div>
                  </div>
                )}

                {/* Bilder / Fotos */}
                {anfrage.photos && anfrage.photos.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> Bilder ({anfrage.photos.length})
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {anfrage.photos.map((photo, idx) => {
                        const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
                        const imgUrl = `${backendUrl}/api/storage/${photo}`;
                        return (
                          <div key={idx}
                            className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer group"
                            onClick={(e) => { e.stopPropagation(); setLightboxImg(imgUrl); }}>
                            <img src={imgUrl} alt={`Bild ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground text-xs">Bild nicht verfügbar</div>'; }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Weitere Infos */}
                {Object.entries(parsed).filter(([key]) => !categories.includes(key) && !["Themen","Nachricht","Rolle","Firma"].includes(key)).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Weitere Infos</h4>
                    <div className="bg-muted/30 rounded-md p-3 space-y-1">
                      {Object.entries(parsed).filter(([key]) => !categories.includes(key) && !["Themen","Nachricht","Rolle","Firma"].includes(key)).map(([key, val]) => (
                        <p key={key} className="text-sm"><span className="font-medium">{key}:</span> <span className="text-muted-foreground">{val}</span></p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notizen */}
                {quickNotes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <MessageSquarePlus className="w-3.5 h-3.5" /> Notizen ({quickNotes.length})
                    </h4>
                    <div className="space-y-1.5">
                      {quickNotes.map((note, i) => {
                        const tsMatch = note.match(/^\[(.*?)\]\s*(.*)/);
                        return (
                          <div key={i} className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-sm">
                            {tsMatch ? (<><span className="text-xs text-amber-600 font-medium">{tsMatch[1]}</span><p className="text-foreground mt-0.5">{tsMatch[2]}</p></>) : <p>{note}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer-Aktionen */}
              <div className="sticky bottom-0 bg-background border-t px-5 py-3 flex flex-wrap gap-2 rounded-b-lg">
                <PortalButtons email={anfrage.email} anfrageId={anfrage.id} />
                <Button size="sm" variant="outline" onClick={() => { setEmailAnfrage(anfrage); setSelectedAnfrage(null); }} data-testid="modal-btn-mail">
                  <Mail className="w-4 h-4" /> E-Mail
                </Button>
                <Button size="sm" variant="outline" onClick={() => { openQuickNote(anfrage); setSelectedAnfrage(null); }} data-testid="modal-btn-note">
                  <MessageSquarePlus className="w-4 h-4" /> Notiz
                </Button>
                <Button size="sm" variant="outline" onClick={() => { openEdit(anfrage); setSelectedAnfrage(null); }} data-testid="modal-btn-edit">
                  <Pencil className="w-4 h-4" /> Bearbeiten
                </Button>
                <Button size="sm" onClick={() => { handleConvert(anfrage.id); setSelectedAnfrage(null); }} data-testid="modal-btn-convert">
                  <UserCheck className="w-4 h-4" /> Als Kunde
                </Button>
                <div className="ml-auto">
                  <Button size="sm" variant="outline" onClick={() => { handleDelete(anfrage.id); setSelectedAnfrage(null); }} data-testid="modal-btn-delete"
                    className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" /> Ablehnen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Neue Anfrage Modal */}
      <Modal isOpen={createAnfrageModal} onClose={() => setCreateAnfrageModal(false)} title="Neue Anfrage anlegen" size="lg">
        <div className="space-y-4" data-testid="create-anfrage-modal">
          {/* Anrede & Kundentyp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Anrede</label>
              <select
                data-testid="create-anfrage-anrede"
                value={createForm.anrede}
                onChange={(e) => setCreateForm({ ...createForm, anrede: e.target.value })}
                className="w-full h-10 rounded-sm border border-input bg-background px-3"
              >
                <option value="">Bitte wählen</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Divers">Divers</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kundentyp</label>
              <select
                data-testid="create-anfrage-customer-type"
                value={createForm.customer_type}
                onChange={(e) => setCreateForm({ ...createForm, customer_type: e.target.value })}
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
          {(createForm.customer_type === "Firma" || createForm.customer_type === "Gewerblich") && (
            <div>
              <label className="block text-sm font-medium mb-1">Firmenname *</label>
              <Input
                data-testid="create-anfrage-firma"
                value={createForm.firma}
                onChange={(e) => setCreateForm({ ...createForm, firma: e.target.value })}
                placeholder="Firma GmbH"
              />
            </div>
          )}

          {/* Vor- und Nachname */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vorname *</label>
              <Input
                data-testid="create-anfrage-vorname"
                value={createForm.vorname}
                onChange={(e) => setCreateForm({ ...createForm, vorname: e.target.value })}
                placeholder="Vorname"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nachname *</label>
              <Input
                data-testid="create-anfrage-nachname"
                value={createForm.nachname}
                onChange={(e) => setCreateForm({ ...createForm, nachname: e.target.value })}
                placeholder="Nachname"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">E-Mail</label>
              <Input
                data-testid="create-anfrage-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="E-Mail"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <Input
                data-testid="create-anfrage-phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="Telefon"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <Input
                  data-testid="create-anfrage-strasse"
                  placeholder="Straße"
                  value={createForm.strasse}
                  onChange={(e) => setCreateForm({ ...createForm, strasse: e.target.value })}
                />
              </div>
              <div className="col-span-4">
                <Input
                  data-testid="create-anfrage-hausnummer"
                  placeholder="Nr."
                  value={createForm.hausnummer}
                  onChange={(e) => setCreateForm({ ...createForm, hausnummer: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div>
                <Input
                  data-testid="create-anfrage-plz"
                  placeholder="PLZ"
                  value={createForm.plz}
                  onChange={(e) => setCreateForm({ ...createForm, plz: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Input
                  data-testid="create-anfrage-ort"
                  placeholder="Ort"
                  value={createForm.ort}
                  onChange={(e) => setCreateForm({ ...createForm, ort: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Objektadresse (falls abweichend)</label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <Input
                  data-testid="create-anfrage-objekt-strasse"
                  placeholder="Straße"
                  value={createForm.objekt_strasse}
                  onChange={(e) => setCreateForm({ ...createForm, objekt_strasse: e.target.value })}
                />
              </div>
              <div className="col-span-4">
                <Input
                  data-testid="create-anfrage-objekt-hausnummer"
                  placeholder="Nr."
                  value={createForm.objekt_hausnummer}
                  onChange={(e) => setCreateForm({ ...createForm, objekt_hausnummer: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div>
                <Input
                  data-testid="create-anfrage-objekt-plz"
                  placeholder="PLZ"
                  value={createForm.objekt_plz}
                  onChange={(e) => setCreateForm({ ...createForm, objekt_plz: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Input
                  data-testid="create-anfrage-objekt-ort"
                  placeholder="Ort"
                  value={createForm.objekt_ort}
                  onChange={(e) => setCreateForm({ ...createForm, objekt_ort: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Kategorien</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    const current = createForm.categories || [];
                    setCreateForm({
                      ...createForm,
                      categories: current.includes(cat)
                        ? current.filter(c => c !== cat)
                        : [...current, cat]
                    });
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition-all ${
                    (createForm.categories || []).includes(cat)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`create-category-${cat}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <Textarea
              data-testid="create-anfrage-nachricht"
              value={createForm.nachricht}
              onChange={(e) => setCreateForm({ ...createForm, nachricht: e.target.value })}
              placeholder="Nachricht des Kunden"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Interne Notizen</label>
            <Textarea
              data-testid="create-anfrage-notes"
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              placeholder="Interne Notizen"
              rows={3}
            />
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Dateien <span className="text-xs text-muted-foreground">(max 10 Dateien, je 10 MB)</span>
            </label>
            
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
            {selectedFiles.length < 10 && (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-sm p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                onClick={() => document.getElementById('anfrage-file-upload-input').click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  Dateien hier ablegen oder klicken zum Auswählen
                </p>
                <p className="text-xs text-muted-foreground">
                  Bilder, PDFs, Dokumente (max 10 MB pro Datei)
                </p>
                <input
                  id="anfrage-file-upload-input"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setCreateAnfrageModal(false)} data-testid="create-anfrage-cancel">
              Abbrechen
            </Button>
            <Button onClick={handleCreateAnfrage} disabled={saving || uploadingFiles || (!createForm.vorname && !createForm.nachname && !createForm.firma)} data-testid="create-anfrage-save">
              {saving ? "Speichern..." : uploadingFiles ? "Uploading..." : "Anfrage anlegen"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editAnfrage} onClose={() => setEditAnfrage(null)} title="Anfrage bearbeiten" size="lg">
        <div className="space-y-4" data-testid="edit-anfrage-modal">
          {/* Anrede & Kundentyp */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Anrede</label>
              <select
                data-testid="edit-anfrage-anrede"
                value={editForm.anrede || ""}
                onChange={(e) => setEditForm({ ...editForm, anrede: e.target.value })}
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
                data-testid="edit-anfrage-customer-type"
                value={editForm.customer_type || "Privat"}
                onChange={(e) => setEditForm({ ...editForm, customer_type: e.target.value })}
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

          {/* Firmenname */}
          {(editForm.customer_type === "Firma" || editForm.customer_type === "Gewerblich" || editForm.firma) && (
            <div>
              <label className="block text-sm font-medium mb-2">Firmenname *</label>
              <Input
                data-testid="edit-anfrage-firma"
                value={editForm.firma || ""}
                onChange={(e) => setEditForm({ ...editForm, firma: e.target.value })}
                placeholder="Firma GmbH"
              />
            </div>
          )}

          {/* Vor- und Nachname */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Vorname *</label>
              <Input
                data-testid="edit-anfrage-vorname"
                value={editForm.vorname || ""}
                onChange={(e) => setEditForm({ ...editForm, vorname: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Nachname *</label>
              <Input
                data-testid="edit-anfrage-nachname"
                value={editForm.nachname || ""}
                onChange={(e) => setEditForm({ ...editForm, nachname: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">E-Mail</label>
              <Input
                data-testid="edit-anfrage-email"
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Telefon</label>
              <Input
                data-testid="edit-anfrage-phone"
                value={editForm.phone || ""}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Kategorien</label>
            <div className="flex flex-wrap gap-2" data-testid="edit-anfrage-categories">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    (editForm.categories || []).includes(cat)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:border-primary/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-sm font-medium mb-2">Adresse</label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <Input
                  data-testid="edit-anfrage-strasse"
                  placeholder="Straße"
                  value={editForm.strasse || ""}
                  onChange={(e) => setEditForm({ ...editForm, strasse: e.target.value })}
                />
              </div>
              <div className="col-span-4">
                <Input
                  data-testid="edit-anfrage-hausnummer"
                  placeholder="Nr."
                  value={editForm.hausnummer || ""}
                  onChange={(e) => setEditForm({ ...editForm, hausnummer: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div>
                <Input
                  data-testid="edit-anfrage-plz"
                  placeholder="PLZ"
                  value={editForm.plz || ""}
                  onChange={(e) => setEditForm({ ...editForm, plz: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Input
                  data-testid="edit-anfrage-ort"
                  placeholder="Ort"
                  value={editForm.ort || ""}
                  onChange={(e) => setEditForm({ ...editForm, ort: e.target.value })}
                />
              </div>
            </div>
            {(editForm.strasse || editForm.address) && (
              <button
                type="button"
                onClick={() => {
                  const addr = editForm.address || `${editForm.strasse} ${editForm.hausnummer}, ${editForm.plz} ${editForm.ort}`.trim();
                  navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`);
                  toast.success("Maps-Link kopiert!");
                }}
                className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
              >
                <Globe className="w-3 h-3" /> Karten-Link kopieren
              </button>
            )}
          </div>

          {/* Objektadresse */}
          <div>
            <label className="block text-sm font-medium mb-2">Objektadresse (falls abweichend)</label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <Input
                  data-testid="edit-anfrage-obj-strasse"
                  placeholder="Straße"
                  value={editForm.objekt_strasse || ""}
                  onChange={(e) => setEditForm({ ...editForm, objekt_strasse: e.target.value })}
                />
              </div>
              <div className="col-span-4">
                <Input
                  placeholder="Nr."
                  value={editForm.objekt_hausnummer || ""}
                  onChange={(e) => setEditForm({ ...editForm, objekt_hausnummer: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div>
                <Input
                  placeholder="PLZ"
                  value={editForm.objekt_plz || ""}
                  onChange={(e) => setEditForm({ ...editForm, objekt_plz: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Input
                  placeholder="Ort"
                  value={editForm.objekt_ort || ""}
                  onChange={(e) => setEditForm({ ...editForm, objekt_ort: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Nachricht</label>
            <Textarea
              data-testid="edit-anfrage-nachricht"
              value={editForm.nachricht || ""}
              onChange={(e) => setEditForm({ ...editForm, nachricht: e.target.value })}
              placeholder="Nachricht des Kunden"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notizen</label>
            <Textarea
              data-testid="edit-anfrage-notes"
              value={editForm.notes || ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Interne Notizen"
              rows={3}
            />
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Dateien <span className="text-xs text-muted-foreground">(max 10 Dateien, je 10 MB)</span>
            </label>
            
            {/* Uploaded Files */}
            {editUploadedFiles.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs text-muted-foreground">Hochgeladene Dateien:</p>
                {editUploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-sm border">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {typeof file === 'object' && (file.content_type || '').startsWith('image/') 
                        ? <ImageIcon className="w-4 h-4" /> : <File className="w-4 h-4" />}
                      <span className="text-sm truncate">{typeof file === 'string' ? file.split('/').pop() : file.filename || file.name || 'Datei'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {typeof file === 'object' && file.url && (
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-muted rounded-sm" title="Herunterladen">
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </a>
                      )}
                      <button type="button" onClick={() => deleteEditUploadedFile(idx)} className="p-1 hover:bg-destructive/10 rounded-sm" title="Löschen">
                        <X className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Files */}
            {editSelectedFiles.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs text-green-600 font-medium">Ausgewählte Dateien (werden beim Speichern hochgeladen):</p>
                {editSelectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-sm border border-green-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className="w-4 h-4" />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => setEditSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-destructive/10 rounded-sm">
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Drop Zone */}
            {(editUploadedFiles.length + editSelectedFiles.length) < 10 && (
              <div
                onDrop={handleEditDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-sm p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                onClick={() => document.getElementById('edit-anfrage-file-upload').click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">Dateien hier ablegen oder klicken zum Auswählen</p>
                <p className="text-xs text-muted-foreground">Bilder, PDFs, Dokumente (max 10 MB pro Datei)</p>
                <input
                  id="edit-anfrage-file-upload"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                  onChange={handleEditFileSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditAnfrage(null)} data-testid="edit-anfrage-cancel">
              Abbrechen
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || editUploadingFiles || (!editForm.vorname && !editForm.nachname && !editForm.firma)} data-testid="edit-anfrage-save">
              {saving ? "Speichern..." : editUploadingFiles ? "Uploading..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>
      {/* E-Mail Dialog */}
      {emailAnfrage && (
        <AnfrageEmailDialog
          anfrage={emailAnfrage}
          onClose={() => setEmailAnfrage(null)}
        />
      )}

      {/* Lightbox für Vollbild-Ansicht */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button onClick={() => setLightboxImg(null)} className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 rounded-full p-2 z-10">
            <X className="w-6 h-6" />
          </button>
          <a href={lightboxImg} download className="absolute top-4 left-4 text-white hover:text-gray-300 bg-black/50 rounded-full px-4 py-2 text-sm font-medium z-10" onClick={(e) => e.stopPropagation()}>
            ⬇ Herunterladen
          </a>
          <img src={lightboxImg} alt="Vollbild" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};


// ==================== ANFRAGE E-MAIL DIALOG ====================
const AnfrageEmailDialog = ({ anfrage, onClose }) => {
  const [toEmail, setToEmail] = useState(anfrage.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [vorlagen, setVorlagen] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    api.get("/email/vorlagen").then(res => setVorlagen(res.data)).catch(() => {});
  }, []);

  const filtered = vorlagen.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.betreff.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const replacePlaceholders = (text) => {
    return text
      .replace(/\{kunde_name\}/g, (anfrage.vorname || anfrage.nachname) ? `${anfrage.vorname || ''} ${anfrage.nachname || ''}`.trim() : (anfrage.name || ""))
      .replace(/\{email\}/g, anfrage.email || "")
      .replace(/\{firma_name\}/g, "Tischlerei Graupner");
  };

  const applyVorlage = (vorlage) => {
    setSubject(replacePlaceholders(vorlage.betreff));
    setMessage(replacePlaceholders(vorlage.text));
    setSearchTerm(vorlage.name);
    setShowResults(false);
  };

  const handleSend = async () => {
    if (!toEmail || !message) { toast.error("E-Mail und Nachricht erforderlich"); return; }
    setSending(true);
    try {
      await api.post(`/email/anfrage/${anfrage.id}`, { to_email: toEmail, subject, message });
      toast.success(`E-Mail an ${toEmail} gesendet`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Senden");
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="anfrage-email-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5" /> E-Mail an {(anfrage.vorname || anfrage.nachname) ? `${anfrage.vorname || ''} ${anfrage.nachname || ''}`.trim() : anfrage.name}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Vorlage + An in einer Zeile */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Vorlage wählen</label>
              <input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                className="w-full border rounded-sm p-2 text-sm pr-8"
                placeholder="Vorlage suchen... z.B. Bilder"
                data-testid="email-vorlage-search"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute right-2.5 top-[34px]" />
              {showResults && (
                <div className="absolute z-10 mt-1 w-full bg-background border rounded-sm shadow-lg max-h-48 overflow-y-auto" data-testid="email-vorlage-results">
                  {filtered.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Keine Vorlagen gefunden</p>
                  ) : (
                    filtered.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => applyVorlage(v)}
                        className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                        data-testid={`vorlage-option-${v.id}`}
                      >
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{v.betreff}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">An</label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                placeholder="kunde@email.de"
                data-testid="email-to"
              />
            </div>
          </div>

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium mb-1">Betreff</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="Betreff..."
              data-testid="email-subject"
            />
          </div>

          {/* Nachricht */}
          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[250px] resize-y"
              placeholder="Nachricht..."
              data-testid="email-message"
            />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={handleSend}
            disabled={sending || !toEmail || !message}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-send-anfrage-email"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sende..." : "E-Mail senden"}
          </button>
        </div>
      </div>
    </div>
  );
};

export { AnfragenPage };
