import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Download, Package, FileText, ClipboardCheck, Receipt, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { RichTextEditor } from "@/components/RichTextEditor";

const DOC_TYPE_LABELS = { angebot: "Angebot", auftrag: "Auftrag", rechnung: "Rechnung", kundenportal: "Kundenportal", einsatz: "Einsatz", termin: "Termin", allgemein: "Allgemein" };
const TEXT_TYPE_LABELS = { vortext: "Vortext", schlusstext: "Schlusstext", betreff: "Betreff", bemerkung: "Bemerkung", titel: "Titel", email: "E-Mail", mahnung: "Mahnung" };
const TEXT_TYPE_COLORS = { vortext: "bg-blue-100 text-blue-800", schlusstext: "bg-green-100 text-green-800", betreff: "bg-purple-100 text-purple-800", bemerkung: "bg-gray-100 text-gray-800", titel: "bg-amber-100 text-amber-800", email: "bg-cyan-100 text-cyan-800", mahnung: "bg-red-100 text-red-800" };

const TextvorlagenModulPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTextType, setFilterTextType] = useState("");
  const [filterDocType, setFilterDocType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [placeholders, setPlaceholders] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    loadItems();
    api.get("/modules/textvorlagen/placeholders").then(res => setPlaceholders(res.data)).catch(() => {});
  }, []);

  const loadItems = async () => {
    try {
      const res = await api.get("/modules/textvorlagen/data");
      setItems(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/modules/textvorlagen/data/${id}`);
      toast.success("Geloescht");
      setConfirmDeleteId(null);
      loadItems();
    } catch { toast.error("Fehler"); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/modules/textvorlagen/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `textvorlagen_${new Date().toISOString().split("T")[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportiert");
    } catch { toast.error("Fehler"); }
  };

  const filtered = items.filter(i => {
    const matchSearch = !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.content.toLowerCase().includes(search.toLowerCase());
    const matchText = !filterTextType || i.text_type === filterTextType;
    const matchDoc = !filterDocType || i.doc_type === filterDocType;
    return matchSearch && matchText && matchDoc;
  });

  const textTypeCounts = {};
  items.forEach(i => { textTypeCounts[i.text_type] = (textTypeCounts[i.text_type] || 0) + 1; });

  return (
    <div data-testid="textvorlagen-modul-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Textvorlagen</h1>
            <Badge variant="default" className="text-xs">Solo</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{items.length} Vorlagen gesamt</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4" /> Export</Button>
          <Button size="sm" className="lg:h-10 lg:px-4" onClick={() => { setEditItem(null); setShowModal(true); }} data-testid="btn-new-vorlage">
            <Plus className="w-4 h-4" /> Neue Vorlage
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => setFilterTextType("")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!filterTextType ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          Alle ({items.length})
        </button>
        {Object.entries(TEXT_TYPE_LABELS).map(([key, label]) => textTypeCounts[key] ? (
          <button key={key} onClick={() => setFilterTextType(filterTextType === key ? "" : key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${filterTextType === key ? TEXT_TYPE_COLORS[key] + " shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {label} ({textTypeCounts[key]})
          </button>
        ) : null)}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setFilterDocType(filterDocType === key ? "" : key)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${filterDocType === key ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      <Card className="p-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {/* Platzhalter-Info */}
      {placeholders.length > 0 && (
        <Card className="p-3 mb-4 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Verfuegbare Platzhalter (klicken zum Kopieren):</p>
          <div className="flex flex-wrap gap-1">
            {placeholders.map(p => (
              <button key={p.alias} onClick={() => { navigator.clipboard.writeText(p.alias); toast.success(`${p.alias} kopiert`); }}
                className="px-2 py-0.5 bg-background border rounded text-xs font-mono hover:bg-primary/5 hover:border-primary/30 transition-all" title={p.beschreibung}>
                {p.alias}
              </button>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{search || filterTextType ? "Keine Ergebnisse" : "Erstellen Sie Ihre erste Textvorlage"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <Card key={item.id} className="overflow-hidden" data-testid={`vorlage-${item.id}`}>
              <div className="flex items-start gap-3 p-3 lg:p-4">
                <div className="flex-1 min-w-0 group/content" style={{ maxWidth: "680px" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{item.title}</span>
                    <Badge className={`text-xs ${TEXT_TYPE_COLORS[item.text_type] || ""}`}>{TEXT_TYPE_LABELS[item.text_type] || item.text_type}</Badge>
                    <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[item.doc_type] || item.doc_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 group-hover/content:line-clamp-none whitespace-pre-line transition-all">{item.content}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { navigator.clipboard.writeText(item.content); toast.success("Inhalt kopiert"); }} className="p-2 hover:bg-muted rounded-sm" title="Kopieren">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditItem(item); setShowModal(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item.id)}
                    className={`p-2 rounded-sm transition-colors ${confirmDeleteId === item.id ? "bg-red-500 text-white" : "hover:bg-destructive/10"}`}>
                    {confirmDeleteId === item.id ? <span className="text-xs font-bold">?</span> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VorlageFormModal isOpen={showModal} onClose={() => setShowModal(false)} item={editItem} onSave={() => { setShowModal(false); loadItems(); }} />
    </div>
  );
};

const VorlageFormModal = ({ isOpen, onClose, item, onSave }) => {
  const [form, setForm] = useState({ title: "", content: "", doc_type: "allgemein", text_type: "vortext" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) setForm({ title: item.title || "", content: item.content || "", doc_type: item.doc_type || "allgemein", text_type: item.text_type || "vortext" });
    else setForm({ title: "", content: "", doc_type: "allgemein", text_type: "vortext" });
  }, [item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) { toast.error("Titel und Inhalt erforderlich"); return; }
    setLoading(true);
    try {
      if (item) await api.put(`/modules/textvorlagen/data/${item.id}`, form);
      else await api.post("/modules/textvorlagen/data", form);
      toast.success(item ? "Aktualisiert" : "Erstellt");
      onSave();
    } catch { toast.error("Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? "Vorlage bearbeiten" : "Neue Vorlage"} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="vorlage-form">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Textart</label>
            <select value={form.text_type} onChange={(e) => setForm({ ...form, text_type: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
              {Object.entries(TEXT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Dokumenttyp</label>
            <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Titel *</label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="input-vorlage-title" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Inhalt *</label>
          <RichTextEditor value={form.content} onChange={(val) => setForm({ ...form, content: val })} placeholder="Text eingeben... Formatierung mit der Toolbar" />
          <p className="text-xs text-muted-foreground mt-1">Platzhalter wie {"{kunde_name}"}, {"{datum}"} werden automatisch ersetzt</p>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" disabled={loading}>{loading ? "Speichern..." : "Speichern"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export { TextvorlagenModulPage };
