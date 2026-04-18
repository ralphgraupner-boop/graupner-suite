import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Bookmark, FileText, Search, X, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const PLACEHOLDERS = [
  { alias: "{anrede_brief}", desc: "Sehr geehrter Herr/Frau + Name" },
  { alias: "{kunde_name}", desc: "Kundenname" },
  { alias: "{kunde_adresse}", desc: "Kundenadresse" },
  { alias: "{kunde_email}", desc: "Kunden-E-Mail" },
  { alias: "{kunde_telefon}", desc: "Kundentelefon" },
  { alias: "{firma}", desc: "Firmenname" },
  { alias: "{datum}", desc: "Heutiges Datum" },
  { alias: "{dokument_nr}", desc: "Dokument-Nr." },
  { alias: "{lohnanteil}", desc: "Lohnanteil netto" },
  { alias: "{lohnanteil_mwst}", desc: "MwSt auf Lohnanteil" },
  { alias: "{lohnanteil_brutto}", desc: "Lohnanteil brutto" },
  { alias: "{mwst_satz}", desc: "MwSt-Satz (z.B. 19,00%)" },
];

const getAnredeBrief = (customer) => {
  if (!customer) return "Sehr geehrte Damen und Herren";
  const anrede = customer.anrede || "";
  const fullName = customer.name || "";
  const cleanName = fullName.replace(/^(Herr|Frau|Divers)\s+/i, "").trim();
  const nameParts = cleanName.split(/\s+/);
  const nachname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : cleanName;

  if (anrede === "Herr" || fullName.startsWith("Herr ")) {
    return `Sehr geehrter Herr ${nachname}`;
  } else if (anrede === "Frau" || fullName.startsWith("Frau ")) {
    return `Sehr geehrte Frau ${nachname}`;
  } else {
    return `Sehr geehrte/r ${cleanName}`;
  }
};

const resolvePlaceholders = (text, customer, settings, docNumber, lohnanteilData) => {
  if (!text) return "";
  const now = new Date();
  const la = lohnanteilData || {};
  const vatRate = la.vatRate || 19;
  return text
    .replace(/\{anrede_brief\}/g, getAnredeBrief(customer))
    .replace(/\{kunde_name\}/g, customer?.name || "")
    .replace(/\{kunde_adresse\}/g, customer?.address || "")
    .replace(/\{kunde_email\}/g, customer?.email || "")
    .replace(/\{kunde_telefon\}/g, customer?.phone || "")
    .replace(/\{firma\}/g, settings?.company_name || "")
    .replace(/\{datum\}/g, now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }))
    .replace(/\{dokument_nr\}/g, docNumber || "")
    .replace(/\{lohnanteil\}/g, (la.netto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    .replace(/\{lohnanteil_mwst\}/g, (la.mwst || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    .replace(/\{lohnanteil_brutto\}/g, (la.brutto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    .replace(/\{mwst_satz\}/g, vatRate.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%");
};

const TextTemplateSelect = ({ docType, textType, value, onChange, customer, settings, docNumber, lohnanteilData }) => {
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const [fromTemplate, setFromTemplate] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(56, el.scrollHeight) + "px";
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [docType, textType]);
  useEffect(() => { autoResize(); }, [value, autoResize]);

  const loadTemplates = async () => {
    try {
      // NUR Modul-Textvorlagen verwenden
      const modulRes = await api.get("/modules/textvorlagen/data", { params: { doc_type: docType, text_type: textType } }).catch(() => ({ data: [] }));
      setTemplates(modulRes.data || []);
    } catch {
      // silent
    }
  };

  const handleSelect = (template) => {
    const resolved = resolvePlaceholders(template.content, customer, settings, docNumber, lohnanteilData);
    onChange(resolved);
    setFromTemplate(true);
    setShowSavePrompt(false);
    setOpen(false);
  };

  const handleChange = (newValue) => {
    onChange(newValue);
    setFromTemplate(false);
    // Show save prompt when user types something new and it's not empty
    if (newValue.trim().length > 3) {
      const isExisting = templates.some(t => t.content === newValue || resolvePlaceholders(t.content, customer, settings, docNumber, lohnanteilData) === newValue);
      setShowSavePrompt(!isExisting);
    } else {
      setShowSavePrompt(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!value?.trim()) return;
    setSavingTemplate(true);
    try {
      // Use first ~40 chars as title
      const title = value.trim().substring(0, 40) + (value.trim().length > 40 ? "..." : "");
      await api.post("/modules/textvorlagen/data", {
        doc_type: docType,
        text_type: textType,
        title,
        content: value.trim()
      });
      toast.success("Als Textbaustein gespeichert!");
      setShowSavePrompt(false);
      setFromTemplate(true);
      loadTemplates();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSavingTemplate(false);
    }
  };

  const labels = { vortext: "Vortext", schlusstext: "Schlusstext", betreff: "Betreff", bemerkung: "Bemerkung" };
  const label = labels[textType] || textType;
  const isBetreff = textType === "betreff";

  return (
    <div data-testid={`template-select-${textType}-${docType}`}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">{label}</label>
        <div className="flex items-center gap-1">
          {showSavePrompt && value?.trim() && (
            <button
              type="button"
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate}
              data-testid={`btn-save-as-template-${textType}`}
              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium px-2 py-1 rounded-sm hover:bg-amber-50 transition-colors animate-pulse"
            >
              <Bookmark className="w-3 h-3" />
              {savingTemplate ? "..." : "Als Textbaustein speichern?"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid={`btn-template-open-${textType}`}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium px-2.5 py-1.5 rounded-sm hover:bg-primary/5 border border-primary/20 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Textvorlagen
          </button>
        </div>
      </div>
      {isBetreff ? (
        <input
          type="text"
          data-testid={`input-${textType}`}
          value={value || ""}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => {
            if (value?.trim() && !fromTemplate) {
              const isExisting = templates.some(t => t.content === value || resolvePlaceholders(t.content, customer, settings, docNumber, lohnanteilData) === value);
              if (!isExisting) setShowSavePrompt(true);
            }
          }}
          placeholder="z.B. Angebot für Schiebetür-Reparatur"
          className="flex w-full h-10 rounded-sm border border-input bg-background px-3 py-2 text-sm font-bold ring-offset-background placeholder:text-muted-foreground placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ color: "#003399" }}
        />
      ) : (
        <textarea
          data-testid={`input-${textType}`}
          value={value || ""}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`${label} eingeben oder aus Textbausteinen waehlen...`}
          rows={3}
          className="flex w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[60px]"
          style={{ minHeight: "56px" }}
        />
      )}
      {!isBetreff && (
        <div className="flex flex-wrap gap-1 mt-1">
          <span className="text-[10px] text-muted-foreground bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded cursor-pointer" title="Seitenumbruch einfuegen"
            onClick={() => onChange(value ? value + "<p>---</p>" : "<p>---</p>")}>--- = Seitenumbruch (klicken zum Einfuegen)</span>
        </div>
      )}

      {/* Textvorlagen Overlay */}
      {open && <TextvorlagenOverlay
        textType={textType}
        docType={docType}
        label={label}
        templates={templates}
        customer={customer}
        settings={settings}
        docNumber={docNumber}
        lohnanteilData={lohnanteilData}
        onSelect={(t) => { handleSelect(t); setOpen(false); }}
        onClose={() => setOpen(false)}
      />}
    </div>
  );
};

const DOC_TYPE_LABELS = { angebot: "Angebot", auftrag: "Auftrag", rechnung: "Rechnung", allgemein: "Allgemein" };
const TEXT_TYPE_LABELS = { vortext: "Vortext", schlusstext: "Schlusstext", betreff: "Betreff", bemerkung: "Bemerkung", titel: "Titel", email: "E-Mail", mahnung: "Mahnung" };

const TextvorlagenOverlay = ({ textType, docType, label, templates, customer, settings, docNumber, lohnanteilData, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [allTemplates, setAllTemplates] = useState([]);
  const [activeFilter, setActiveFilter] = useState(textType);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", content: "", doc_type: docType || "allgemein", text_type: textType || "vortext" });
  const [saving, setSaving] = useState(false);

  const loadAll = () => {
    api.get("/modules/textvorlagen/data").then(res => setAllTemplates(res.data || [])).catch(() => setAllTemplates(templates));
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = allTemplates.filter(t => {
    if (activeFilter && t.text_type !== activeFilter) return false;
    if (!search) return true;
    return t.title?.toLowerCase().includes(search.toLowerCase()) || t.content?.toLowerCase().includes(search.toLowerCase());
  });

  const textTypeCounts = {};
  allTemplates.forEach(t => { textTypeCounts[t.text_type] = (textTypeCounts[t.text_type] || 0) + 1; });

  const selectedTemplate = allTemplates.find(t => t.id === selectedId);
  const resolvedPreview = selectedTemplate ? resolvePlaceholders(selectedTemplate.content, customer, settings, docNumber, lohnanteilData) : "";

  const handleCreate = async () => {
    if (!newForm.title?.trim() || !newForm.content?.trim()) { toast.error("Titel und Inhalt erforderlich"); return; }
    setSaving(true);
    try {
      const res = await api.post("/modules/textvorlagen/data", newForm);
      toast.success("Textvorlage gespeichert und uebernommen!");
      onSelect(res.data);
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="textvorlagen-overlay">
      <div className="bg-card rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Textvorlagen
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Vorlage auswaehlen fuer: <strong>{label}</strong></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>

        {/* Filter-Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-2 shrink-0">
          <button onClick={() => setActiveFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!activeFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            Alle ({allTemplates.length})
          </button>
          {Object.entries(TEXT_TYPE_LABELS).map(([key, lbl]) => textTypeCounts[key] ? (
            <button key={key} onClick={() => setActiveFilter(activeFilter === key ? "" : key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {lbl} ({textTypeCounts[key]})
            </button>
          ) : null)}
        </div>

        {/* Split-Layout: Liste links, Vorschau/Formular rechts */}
        <div className="flex flex-1 min-h-0 border-t">
          {/* Linke Seite: Liste */}
          <div className="w-2/5 border-r flex flex-col">
            <div className="p-3 shrink-0 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input className="w-full h-9 pl-9 pr-3 rounded-sm border border-input bg-background text-sm" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button type="button" onClick={() => { setShowCreate(true); setSelectedId(null); }}
                className="h-9 px-3 rounded-sm bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1"
                data-testid="btn-create-template-overlay">
                + Neu
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Keine Vorlagen</p>
              ) : filtered.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { setSelectedId(t.id); setShowCreate(false); }}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${selectedId === t.id && !showCreate ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50"}`}
                  data-testid={`overlay-template-${t.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                      t.text_type === "vortext" ? "bg-blue-100 text-blue-700" :
                      t.text_type === "schlusstext" ? "bg-green-100 text-green-700" :
                      t.text_type === "betreff" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{TEXT_TYPE_LABELS[t.text_type] || t.text_type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.content}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Rechte Seite: Vorschau oder Neu-Formular */}
          <div className="w-3/5 flex flex-col">
            {showCreate ? (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <h4 className="font-semibold text-sm">Neue Textvorlage erstellen</h4>
                  <div>
                    <label className="block text-xs font-medium mb-1">Titel</label>
                    <input className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm" placeholder="z.B. Standard Vortext Angebot" value={newForm.title} onChange={e => setNewForm({ ...newForm, title: e.target.value })} data-testid="new-template-title" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Textart</label>
                      <select className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm" value={newForm.text_type} onChange={e => setNewForm({ ...newForm, text_type: e.target.value })}>
                        {Object.entries(TEXT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Dokumenttyp</label>
                      <select className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm" value={newForm.doc_type} onChange={e => setNewForm({ ...newForm, doc_type: e.target.value })}>
                        {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Inhalt</label>
                    <textarea value={newForm.content} onChange={e => setNewForm({ ...newForm, content: e.target.value })}
                      placeholder="Text eingeben..." rows={5} className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-none" data-testid="new-template-content" />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {PLACEHOLDERS.map(p => (
                        <button key={p.alias} type="button" onClick={() => setNewForm({ ...newForm, content: newForm.content + p.alias })}
                          className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors" title={p.desc}>{p.alias}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t shrink-0 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium rounded-sm border hover:bg-muted transition-colors">Abbrechen</button>
                  <button type="button" onClick={handleCreate} disabled={saving}
                    className="px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    data-testid="btn-save-new-template">
                    {saving ? "Speichern..." : "Speichern & Uebernehmen"}
                  </button>
                </div>
              </>
            ) : selectedTemplate ? (
              <>
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold">{selectedTemplate.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      selectedTemplate.text_type === "vortext" ? "bg-blue-100 text-blue-700" :
                      selectedTemplate.text_type === "schlusstext" ? "bg-green-100 text-green-700" :
                      selectedTemplate.text_type === "betreff" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{TEXT_TYPE_LABELS[selectedTemplate.text_type]}</span>
                    <span className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[selectedTemplate.doc_type]}</span>
                  </div>
                  <div className="bg-muted/30 rounded-sm p-4 border">
                    <p className="text-sm whitespace-pre-line leading-relaxed">{resolvedPreview}</p>
                  </div>
                </div>
                <div className="p-4 border-t shrink-0 flex justify-end gap-3">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-sm border hover:bg-muted transition-colors">Abbrechen</button>
                  <button type="button" onClick={() => onSelect(selectedTemplate)}
                    className="px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    data-testid="btn-template-confirm">
                    <Check className="w-4 h-4 inline mr-1.5" />Uebernehmen
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Vorlage links auswaehlen</p>
                  <p className="text-xs mt-1">oder <button type="button" onClick={() => setShowCreate(true)} className="text-primary hover:underline font-medium">neue Vorlage erstellen</button></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { TextTemplateSelect, resolvePlaceholders, PLACEHOLDERS };
