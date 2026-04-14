import { useState, useEffect } from "react";
import { Upload, X, File, Image as ImageIcon, Download, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { CATEGORIES, CUSTOMER_STATUSES } from "@/lib/constants";

/**
 * ContactForm - Gemeinsames Kontaktformular-Modul
 * Wird verwendet für: Kunden erstellen/bearbeiten, Anfragen erstellen/bearbeiten
 * 
 * Props:
 * - isOpen: Boolean - Modal offen?
 * - onClose: Function - Modal schließen
 * - contact: Object|null - Bestehender Kontakt zum Bearbeiten (null = neu)
 * - onSave: Function - Callback nach erfolgreichem Speichern
 * - mode: "kunde"|"anfrage" - Bestimmt API-Endpoint und Extra-Felder
 * - title: String - Modal-Titel (optional, wird automatisch generiert)
 * - customerStatuses: Array - Verfügbare Status-Optionen
 * - categories: Array - Verfügbare Kategorien
 */
const ContactForm = ({
  isOpen,
  onClose,
  contact,
  onSave,
  mode = "kunde",
  title,
  customerStatuses = CUSTOMER_STATUSES,
  categories = CATEGORIES,
}) => {
  const [form, setForm] = useState({
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
    notes: "",
    customer_type: "Privat",
    categories: [],
    status: "Neu",
    // Anfrage-spezifische Felder
    nachricht: "",
    objekt_strasse: "",
    objekt_hausnummer: "",
    objekt_plz: "",
    objekt_ort: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const isAnfrage = mode === "anfrage";
  const apiBase = isAnfrage ? "/anfragen" : "/customers";
  const defaultTitle = contact
    ? (isAnfrage ? "Anfrage bearbeiten" : "Kunde bearbeiten")
    : (isAnfrage ? "Neue Anfrage" : "Neuer Kunde");

  useEffect(() => {
    if (contact) {
      let strasse = "", hausnummer = "", plz = "", ort = "";
      if (contact.address && !contact.strasse) {
        const parts = contact.address.split(",").map(p => p.trim());
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
        anrede: contact.anrede || "",
        vorname: contact.vorname || "",
        nachname: contact.nachname || "",
        name: contact.name || "",
        firma: contact.firma || "",
        email: contact.email || "",
        phone: contact.phone || "",
        strasse: contact.strasse || strasse,
        hausnummer: contact.hausnummer || hausnummer,
        plz: contact.plz || plz,
        ort: contact.ort || ort,
        address: contact.address || "",
        notes: contact.notes || "",
        customer_type: contact.customer_type || "Privat",
        categories: contact.categories || [],
        status: contact.status || "Neu",
        nachricht: contact.nachricht || "",
        objekt_strasse: contact.objekt_strasse || "",
        objekt_hausnummer: contact.objekt_hausnummer || "",
        objekt_plz: contact.objekt_plz || "",
        objekt_ort: contact.objekt_ort || "",
      });
      setUploadedFiles(contact.photos || []);
    } else {
      setForm({
        anrede: "", vorname: "", nachname: "", name: "", firma: "",
        email: "", phone: "",
        strasse: "", hausnummer: "", plz: "", ort: "",
        address: "", notes: "", customer_type: "Privat", categories: [], status: "Neu",
        nachricht: "", objekt_strasse: "", objekt_hausnummer: "", objekt_plz: "", objekt_ort: "",
      });
      setUploadedFiles([]);
    }
    setSelectedFiles([]);
  }, [contact]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vorname && !form.nachname && !form.firma) {
      toast.error("Vorname, Nachname oder Firmenname ist erforderlich");
      return;
    }
    setLoading(true);
    try {
      const addressCombined = `${form.strasse} ${form.hausnummer}, ${form.plz} ${form.ort}`.trim();
      const payload = { ...form, address: addressCombined || form.address };

      if (isAnfrage) {
        const objAddr = `${form.objekt_strasse} ${form.objekt_hausnummer}, ${form.objekt_plz} ${form.objekt_ort}`.trim();
        payload.objektadresse = objAddr || addressCombined || form.address;
        payload.name = form.firma || `${form.vorname} ${form.nachname}`.trim();
      }

      let contactId = contact?.id;

      if (contact) {
        await api.put(`${apiBase}/${contact.id}`, payload);
        toast.success(isAnfrage ? "Anfrage aktualisiert" : "Kunde aktualisiert");
      } else {
        const res = await api.post(apiBase, payload);
        contactId = res.data.id;
        toast.success(isAnfrage ? "Anfrage erstellt" : "Kunde erstellt");
      }

      if (selectedFiles.length > 0 && contactId) {
        await handleFileUpload(contactId);
      }

      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (contactId) => {
    if (selectedFiles.length === 0) return;
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));
      await api.post(`${apiBase}/${contactId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
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
    const MAX_SIZE = 10 * 1024 * 1024;
    const totalFiles = uploadedFiles.length + selectedFiles.length + files.length;
    if (totalFiles > MAX_FILES) {
      toast.error(`Maximale Anzahl Dateien ueberschritten (max ${MAX_FILES})`);
      return;
    }
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        toast.error(`Datei ${file.name} ist zu gross (max 10 MB)`);
        return;
      }
    }
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect({ target: { files: e.dataTransfer.files } });
  };

  const deleteUploadedFile = async (index) => {
    if (!contact) return;
    try {
      await api.delete(`${apiBase}/${contact.id}/files/${index}`);
      toast.success("Datei geloescht");
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    } catch (err) {
      toast.error("Fehler beim Loeschen");
    }
  };

  const getFileIcon = (file) => {
    const name = typeof file === 'string' ? file : file.filename || file.name || '';
    const ct = typeof file === 'string' ? '' : file.content_type || file.type || '';
    if (ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) return <ImageIcon className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const getFileName = (file) => {
    if (typeof file === 'string') return file.split('/').pop();
    return file.filename || file.name || 'Datei';
  };

  const getFileSize = (file) => {
    if (file.size) {
      const kb = file.size / 1024;
      return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
    }
    return '';
  };

  const inputId = `file-upload-${mode}-${contact?.id || 'new'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || defaultTitle} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid={`${mode}-form-modal`}>
        {/* Anrede & Kundentyp */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Anrede</label>
            <select
              data-testid={`select-${mode}-anrede`}
              value={form.anrede}
              onChange={(e) => setForm({ ...form, anrede: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="">Bitte waehlen</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
              <option value="Divers">Divers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Kundentyp</label>
            <select
              data-testid={`select-${mode}-type`}
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

        {/* Firmenname */}
        {(form.customer_type === "Firma" || form.customer_type === "Gewerblich" || form.firma) && (
          <div>
            <label className="block text-sm font-medium mb-2">Firmenname *</label>
            <Input
              data-testid={`input-${mode}-firma`}
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
              data-testid={`input-${mode}-vorname`}
              value={form.vorname}
              onChange={(e) => setForm({ ...form, vorname: e.target.value })}
              required={!form.firma}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nachname *</label>
            <Input
              data-testid={`input-${mode}-nachname`}
              value={form.nachname}
              onChange={(e) => setForm({ ...form, nachname: e.target.value })}
              required={!form.firma}
            />
          </div>
        </div>

        {/* E-Mail & Telefon */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">E-Mail</label>
            <Input
              data-testid={`input-${mode}-email`}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <Input
              data-testid={`input-${mode}-phone`}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        {/* Kategorien */}
        <div>
          <label className="block text-sm font-medium mb-2">Kategorien</label>
          <div className="flex flex-wrap gap-2" data-testid={`${mode}-categories`}>
            {categories.map((cat) => (
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

        {/* Status (nur Kunden) */}
        {!isAnfrage && (
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              data-testid={`select-${mode}-status`}
              className="w-full h-10 px-3 rounded-sm border border-input bg-background text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {customerStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Adresse */}
        <div>
          <label className="block text-sm font-medium mb-2">Adresse</label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <Input
                data-testid={`input-${mode}-strasse`}
                placeholder="Strasse"
                value={form.strasse}
                onChange={(e) => setForm({ ...form, strasse: e.target.value })}
              />
            </div>
            <div className="col-span-4">
              <Input
                data-testid={`input-${mode}-hausnummer`}
                placeholder="Nr."
                value={form.hausnummer}
                onChange={(e) => setForm({ ...form, hausnummer: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div>
              <Input
                data-testid={`input-${mode}-plz`}
                placeholder="PLZ"
                value={form.plz}
                onChange={(e) => setForm({ ...form, plz: e.target.value })}
              />
            </div>
            <div className="col-span-3">
              <Input
                data-testid={`input-${mode}-ort`}
                placeholder="Ort"
                value={form.ort}
                onChange={(e) => setForm({ ...form, ort: e.target.value })}
              />
            </div>
          </div>
          {(form.strasse || form.address) && (
            <button
              type="button"
              onClick={() => {
                const addr = form.address || `${form.strasse} ${form.hausnummer}, ${form.plz} ${form.ort}`.trim();
                navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`);
                toast.success("Maps-Link kopiert!");
              }}
              className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
              data-testid={`btn-${mode}-map-link`}
            >
              <Globe className="w-3 h-3" /> Karten-Link kopieren
            </button>
          )}
        </div>

        {/* Objektadresse (nur Anfragen) */}
        {isAnfrage && (
          <div>
            <label className="block text-sm font-medium mb-2">Objektadresse (falls abweichend)</label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <Input placeholder="Strasse" value={form.objekt_strasse} onChange={(e) => setForm({ ...form, objekt_strasse: e.target.value })} />
              </div>
              <div className="col-span-4">
                <Input placeholder="Nr." value={form.objekt_hausnummer} onChange={(e) => setForm({ ...form, objekt_hausnummer: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div>
                <Input placeholder="PLZ" value={form.objekt_plz} onChange={(e) => setForm({ ...form, objekt_plz: e.target.value })} />
              </div>
              <div className="col-span-3">
                <Input placeholder="Ort" value={form.objekt_ort} onChange={(e) => setForm({ ...form, objekt_ort: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {/* Nachricht (nur Anfragen) */}
        {isAnfrage && (
          <div>
            <label className="block text-sm font-medium mb-2">Nachricht</label>
            <Textarea
              data-testid={`input-${mode}-nachricht`}
              value={form.nachricht}
              onChange={(e) => setForm({ ...form, nachricht: e.target.value })}
              placeholder="Nachricht des Kunden"
              rows={3}
            />
          </div>
        )}

        {/* Notizen */}
        <div>
          <label className="block text-sm font-medium mb-2">Notizen</label>
          <Textarea
            data-testid={`input-${mode}-notes`}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </div>

        {/* Datei-Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Dateien <span className="text-xs text-muted-foreground">(max 10 Dateien, je 10 MB)</span>
          </label>

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
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-muted rounded-sm" title="Herunterladen">
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                    )}
                    <button type="button" onClick={() => deleteUploadedFile(idx)} className="p-1 hover:bg-destructive/10 rounded-sm" title="Loeschen">
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="text-xs text-green-600 font-medium">Ausgewaehlte Dateien (werden beim Speichern hochgeladen):</p>
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-sm border border-green-200">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(file)}
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{getFileSize(file)}</span>
                  </div>
                  <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-destructive/10 rounded-sm">
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(uploadedFiles.length + selectedFiles.length) < 10 && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-sm p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => document.getElementById(inputId).click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Dateien hier ablegen oder klicken zum Auswaehlen</p>
              <p className="text-xs text-muted-foreground">Bilder, PDFs, Dokumente (max 10 MB pro Datei)</p>
              <input
                id={inputId}
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
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" data-testid={`btn-save-${mode}`} disabled={loading || uploadingFiles}>
            {loading ? "Speichern..." : uploadingFiles ? "Uploading..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export { ContactForm };
