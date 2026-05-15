import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { PLACEHOLDERS } from "@/components/TextTemplateSelect";

const DOC_TYPE_LABELS = { angebot: "Angebot", auftrag: "Auftragsbestätigung", rechnung: "Rechnung" };
const TextbausteineTab = () => {
  const [templates, setTemplates] = useState([]);
  const [activeDocType, setActiveDocType] = useState("angebot");
  const [editTemplate, setEditTemplate] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", text_type: "vortext", doc_type: "angebot" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try { const res = await api.get("/text-templates"); setTemplates(res.data); } catch { toast.error("Fehler beim Laden"); }
  };

  const openNew = (docType, textType) => {
    setForm({ title: "", content: "", text_type: textType, doc_type: docType });
    setEditTemplate("new");
  };
  const openEdit = (t) => {
    setForm({ title: t.title, content: t.content, text_type: t.text_type, doc_type: t.doc_type });
    setEditTemplate(t.id);
  };

  const handleSave = async () => {
    if (!form.content.trim()) { toast.error("Inhalt erforderlich"); return; }
    // Auto-generate title from content
    const autoTitle = form.content.trim().substring(0, 40) + (form.content.trim().length > 40 ? "..." : "");
    const payload = { ...form, title: autoTitle };
    setSaving(true);
    try {
      if (editTemplate === "new") { await api.post("/text-templates", payload); toast.success("Textbaustein erstellt"); }
      else { await api.put(`/text-templates/${editTemplate}`, payload); toast.success("Aktualisiert"); }
      setEditTemplate(null); loadTemplates();
    } catch { toast.error("Fehler"); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try { await api.delete(`/text-templates/${id}`); toast.success("Gelöscht"); setConfirmDeleteId(null); loadTemplates(); } catch { toast.error("Fehler"); }
  };

  const filtered = templates.filter((t) => t.doc_type === activeDocType);

  // Simplified Betreff section - just titles, inline add/edit
  const [newBetreff, setNewBetreff] = useState("");
  const [editBetreffId, setEditBetreffId] = useState(null);
  const [editBetreffTitle, setEditBetreffTitle] = useState("");

  const handleAddBetreff = async () => {
    if (!newBetreff.trim()) return;
    try {
      await api.post("/text-templates", { doc_type: activeDocType, text_type: "betreff", title: newBetreff.trim(), content: newBetreff.trim() });
      toast.success("Betreff gespeichert");
      setNewBetreff("");
      loadTemplates();
    } catch { toast.error("Fehler"); }
  };

  const handleUpdateBetreff = async (id) => {
    if (!editBetreffTitle.trim()) return;
    try {
      await api.put(`/text-templates/${id}`, { doc_type: activeDocType, text_type: "betreff", title: editBetreffTitle.trim(), content: editBetreffTitle.trim() });
      toast.success("Aktualisiert");
      setEditBetreffId(null);
      loadTemplates();
    } catch { toast.error("Fehler"); }
  };

  const renderBetreffSection = () => {
    const items = filtered.filter((t) => t.text_type === "betreff");
    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-2">Betreff-Zeilen</h4>
        <div className="space-y-2 mb-3">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-2" data-testid={`betreff-${t.id}`}>
              {editBetreffId === t.id ? (
                <>
                  <Input value={editBetreffTitle} onChange={(e) => setEditBetreffTitle(e.target.value)} className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") handleUpdateBetreff(t.id); if (e.key === "Escape") setEditBetreffId(null); }}
                    autoFocus
                  />
                  <Button size="sm" variant="outline" onClick={() => handleUpdateBetreff(t.id)} className="h-9 px-3"><Save className="w-3.5 h-3.5" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm py-1.5 px-3 bg-muted/30 rounded-sm border">{t.title}</span>
                  <button onClick={() => { setEditBetreffId(t.id); setEditBetreffTitle(t.title); }} className="p-1.5 hover:bg-muted rounded-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(t.id)} className={`p-1.5 rounded-sm transition-colors ${confirmDeleteId === t.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}>
                    {confirmDeleteId === t.id ? <span className="text-[10px] font-bold">OK?</span> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newBetreff} onChange={(e) => setNewBetreff(e.target.value)} placeholder="Neue Betreff-Zeile eingeben..."
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleAddBetreff(); }}
            data-testid="input-new-betreff"
          />
          <Button size="sm" variant="outline" onClick={handleAddBetreff} disabled={!newBetreff.trim()} className="h-9" data-testid="btn-add-betreff">
            <Plus className="w-3.5 h-3.5" /> Hinzufügen
          </Button>
        </div>
      </div>
    );
  };

  const renderSection = (textType, label) => {
    const items = filtered.filter((t) => t.text_type === textType);
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">{label}</h4>
          <Button variant="outline" size="sm" onClick={() => openNew(activeDocType, textType)} data-testid={`btn-add-${textType}`}>
            <Plus className="w-3 h-3" /> {label.slice(0, -1)}
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Noch keine {label} für {DOC_TYPE_LABELS[activeDocType]}</p>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-sm border" data-testid={`template-${t.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-line line-clamp-3">{t.content}</p>
                </div>
                <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-muted rounded-sm shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(t.id)} className={`p-1.5 rounded-sm shrink-0 transition-colors ${confirmDeleteId === t.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}>
                  {confirmDeleteId === t.id ? <span className="text-[10px] font-bold">OK?</span> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="text-template-management">
      <h3 className="text-lg font-semibold mb-2">Textbausteine (Vortext / Schlusstext / Bemerkung)</h3>
      <p className="text-sm text-muted-foreground mb-3">Vorgefertigte Texte mit Platzhaltern für Dokumente.</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {PLACEHOLDERS.map((p) => (
          <span key={p.alias} className="text-xs bg-muted px-2 py-1 rounded font-mono" title={p.desc}>{p.alias}</span>
        ))}
      </div>

      <div className="flex gap-2 mb-4 border-b" data-testid="template-doc-type-tabs">
        {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setActiveDocType(key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${activeDocType === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid={`tab-${key}`}>
            {label}
          </button>
        ))}
      </div>

      {renderBetreffSection()}
      {renderSection("vortext", "Vortexte")}
      {renderSection("schlusstext", "Schlusstexte")}
      {renderSection("bemerkung", "Bemerkungen")}

      <Modal isOpen={!!editTemplate} onClose={() => setEditTemplate(null)} title={editTemplate === "new" ? "Neuer Textbaustein" : "Textbaustein bearbeiten"}>
        <div className="space-y-4" data-testid="template-edit-modal">
          <div>
            <label className="block text-sm font-medium mb-1">Inhalt</label>
            <Textarea data-testid="template-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={"Sehr geehrte/r {kunde_name},\n\nvielen Dank..."} rows={6} />
            <div className="flex flex-wrap gap-1 mt-2">
              {PLACEHOLDERS.map((p) => (
                <button key={p.alias} type="button" onClick={() => setForm({ ...form, content: form.content + p.alias })} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 font-mono" title={`${p.desc} einfügen`}>
                  {p.alias}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-template">{saving ? "..." : "Speichern"}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};



export { TextbausteineTab };
