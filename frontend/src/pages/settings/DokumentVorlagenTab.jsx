import { useState, useEffect } from "react";
import { Mail, Save, Trash2, FileText, Palette, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card } from "@/components/common";
import { api } from "@/lib/api";

const DokumentVorlagenTab = ({ settings, setSettings, onSave, saving }) => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("allgemein");

  const CATEGORIES = [
    { id: "logo", label: "Logo", icon: "🎨" },
    { id: "briefkopf", label: "Briefkopf", icon: "📄" },
    { id: "agb", label: "AGB / Rechtliches", icon: "⚖️" },
    { id: "anhaenge", label: "E-Mail Anhänge", icon: "📎" },
    { id: "allgemein", label: "Allgemein", icon: "📁" },
  ];

  useEffect(() => {
    loadDocuments();
  }, [selectedCategory]);

  const loadDocuments = async () => {
    try {
      const res = await api.get("/settings/documents", { params: { category: selectedCategory } });
      setDocuments(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Dokumente");
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const handleFileInput = async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (files) => {
    setUploading(true);
    let uploaded = 0;
    
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`${file.name} ist keine PDF-Datei`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", selectedCategory);
        
        await api.post("/settings/documents/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        uploaded++;
      } catch (err) {
        toast.error(`Fehler beim Hochladen von ${file.name}`);
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} Dokument(e) hochgeladen`);
      loadDocuments();
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Dokument wirklich löschen?")) return;
    
    try {
      await api.delete(`/settings/documents/${id}`);
      toast.success("Dokument gelöscht");
      loadDocuments();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-4">
      {/* PDF-Layout Einstellungen */}
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" /> PDF-Layout Einstellungen
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Gestalten Sie das Aussehen Ihrer Angebote, Aufträge und Rechnungen.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kopfzeile (wird oben auf jeder Seite angezeigt)</label>
            <Textarea data-testid="input-pdf-header" value={settings.pdf_header_text} onChange={(e) => setSettings({ ...settings, pdf_header_text: e.target.value })} placeholder={"z.B. Tischlerei Graupner - Ihr Partner für Fenster & Türen"} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fußzeile (wird unten auf jeder Seite angezeigt)</label>
            <Textarea data-testid="input-pdf-footer" value={settings.pdf_footer_text} onChange={(e) => setSettings({ ...settings, pdf_footer_text: e.target.value })} placeholder={"z.B. Tischlerei Graupner | Erlenweg 129 | 22453 Hamburg | Tel: 040 555 677 44"} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Standard-Bemerkung (wird in neue Dokumente eingefügt)</label>
            <Textarea data-testid="input-pdf-bemerkung" value={settings.pdf_bemerkung_default} onChange={(e) => setSettings({ ...settings, pdf_bemerkung_default: e.target.value })} placeholder={"z.B. Zahlbar innerhalb von 14 Tagen ohne Abzug."} rows={3} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Akzentfarbe</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={settings.pdf_accent_color} onChange={(e) => setSettings({ ...settings, pdf_accent_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" data-testid="input-pdf-color" />
                <Input value={settings.pdf_accent_color} onChange={(e) => setSettings({ ...settings, pdf_accent_color: e.target.value })} className="flex-1" placeholder="#1a1a2e" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Schriftgröße Fließtext (Vortext, Positionen, Schlusstext)</label>
              <select data-testid="select-pdf-font" value={settings.pdf_font_size || "normal"} onChange={(e) => setSettings({ ...settings, pdf_font_size: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
                <option value="small">Klein (9pt)</option>
                <option value="normal">Normal (10pt)</option>
                <option value="large">Groß (11pt)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Wirkt im PDF auf Vortext, Schlusstext und Positionsbeschreibungen.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Briefkopf-Slogan Schriftgröße (&quot;seit 1960&quot; & &quot;Mitglied der Handwerkskammer&quot;)</label>
            <div className="flex gap-3 items-center">
              <Input
                data-testid="input-slogan-font-size"
                type="number"
                min="7"
                max="16"
                step="1"
                value={settings.slogan_font_size ?? 9}
                onChange={(e) => setSettings({ ...settings, slogan_font_size: parseInt(e.target.value) || 9 })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">pt (Standard: 9pt, Empfehlung: 10–12pt für bessere Lesbarkeit)</span>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.pdf_show_logo} onChange={(e) => setSettings({ ...settings, pdf_show_logo: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Logo im PDF anzeigen</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <Button data-testid="btn-save-pdf-settings" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? "..." : "Speichern"}
          </Button>
        </div>
      </Card>

      {/* PDF Dokument-Manager */}
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" /> PDF Dokument-Manager
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Laden Sie PDFs hoch: Logo, Briefkopf, AGB, E-Mail-Anhänge oder allgemeine Dokumente.
        </p>

        {/* Kategorien */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/20 hover:border-primary/50"
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm font-medium mb-2">
            {dragActive ? "PDF hier ablegen..." : "PDFs hierher ziehen oder klicken"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">Nur PDF-Dateien, max. 10 MB</p>
          <label className="inline-block">
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
              disabled={uploading}
            />
            <Button variant="outline" disabled={uploading} as="span">
              {uploading ? "Hochladen..." : "Dateien auswählen"}
            </Button>
          </label>
        </div>

        {/* Dokument-Liste */}
        {documents.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-sm font-semibold mb-3">
              Hochgeladene Dokumente ({documents.length})
            </h4>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.size)} · {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/settings/documents/${doc.id}/download`, '_blank')}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(doc.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {documents.length === 0 && !uploading && (
          <div className="mt-6 text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Keine Dokumente in dieser Kategorie</p>
          </div>
        )}
      </Card>
    </div>
  );
};



export { DokumentVorlagenTab };
