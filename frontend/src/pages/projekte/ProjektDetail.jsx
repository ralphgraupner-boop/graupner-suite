import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Upload, ImageIcon, X, Camera, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge, Input, Textarea } from "@/components/common";
import { api } from "@/lib/api";

const STATUSES = ["Anfrage", "In Bearbeitung", "Abgeschlossen", "Archiv"];
const KATEGORIEN = ["Innentür", "Fenster", "Haustür", "Schiebetür", "Sonstiges"];
const BILD_KATEGORIEN = ["vorher", "schaden", "nachher", "sonstiges"];

const STATUS_COLORS = {
  "Anfrage": "bg-blue-100 text-blue-700 border-blue-300",
  "In Bearbeitung": "bg-amber-100 text-amber-800 border-amber-300",
  "Abgeschlossen": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Archiv": "bg-gray-100 text-gray-600 border-gray-300",
};

const ProjektDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [projekt, setProjekt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadKategorie, setUploadKategorie] = useState("schaden");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/module-projekte/${id}`);
      setProjekt(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
      navigate("/module/projekte");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const updateField = (field, value) => setProjekt(p => ({ ...p, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/module-projekte/${id}`, {
        titel: projekt.titel,
        beschreibung: projekt.beschreibung,
        kategorie: projekt.kategorie,
        adresse: projekt.adresse,
        status: projekt.status,
        notizen: projekt.notizen,
      });
      setProjekt(res.data);
      toast.success("Projekt gespeichert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Projekt "${projekt.titel}" wirklich löschen? Bilder werden mit gelöscht.`)) return;
    try {
      await api.delete(`/module-projekte/${id}`);
      toast.success("Projekt gelöscht");
      navigate("/module/projekte");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post(`/module-projekte/${id}/bilder?kategorie=${uploadKategorie}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(`${files.length} Bild(er) hochgeladen`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteBild = async (bildId) => {
    if (!window.confirm("Dieses Bild wirklich löschen?")) return;
    try {
      await api.delete(`/module-projekte/${id}/bilder/${bildId}`);
      toast.success("Bild gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const updateBildBeschreibung = async (bildId, beschreibung) => {
    try {
      const res = await api.put(`/module-projekte/${id}/bilder/${bildId}`, { beschreibung });
      setProjekt(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Lade…</div>;
  if (!projekt) return null;

  const bilder = projekt.bilder || [];
  const bilderByKat = BILD_KATEGORIEN.reduce((acc, kat) => {
    acc[kat] = bilder.filter(b => b.kategorie === kat);
    return acc;
  }, {});

  return (
    <div data-testid="projekt-detail-page" className="pb-12 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/module/projekte")} data-testid="btn-back-projekte">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:bg-red-50" data-testid="btn-delete-projekt">
            <Trash2 className="w-4 h-4" /> Löschen
          </Button>
          <Button size="sm" onClick={save} disabled={saving} data-testid="btn-save-projekt">
            <Save className="w-4 h-4" /> {saving ? "Speichere…" : "Speichern"}
          </Button>
        </div>
      </div>

      <Card className="p-4 lg:p-6 mb-4">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Badge className={`text-xs border ${STATUS_COLORS[projekt.status] || ""}`}>{projekt.status}</Badge>
          <span className="text-sm text-muted-foreground">Kunde: <strong>{projekt.kunde_name}</strong></span>
          <span className="text-xs text-muted-foreground ml-auto">Erstellt: {(projekt.created_at || "").slice(0, 10)}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Titel *</label>
            <Input value={projekt.titel || ""} onChange={(e) => updateField("titel", e.target.value)} data-testid="input-titel" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
            <select value={projekt.status} onChange={(e) => updateField("status", e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid="select-status">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Kategorie</label>
            <select value={projekt.kategorie || "Sonstiges"} onChange={(e) => updateField("kategorie", e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid="select-kategorie">
              {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Adresse</label>
            <Input value={projekt.adresse || ""} onChange={(e) => updateField("adresse", e.target.value)} data-testid="input-adresse" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Beschreibung</label>
            <Textarea value={projekt.beschreibung || ""} onChange={(e) => updateField("beschreibung", e.target.value)} rows={3} data-testid="input-beschreibung" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Notizen</label>
            <Textarea value={projekt.notizen || ""} onChange={(e) => updateField("notizen", e.target.value)} rows={3} placeholder="Interne Notizen…" data-testid="input-notizen" />
          </div>
        </div>
      </Card>

      <Card className="p-4 lg:p-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ImageIcon className="w-5 h-5" /> Bilder ({bilder.length})
          </h2>
          <div className="flex items-center gap-2">
            <select value={uploadKategorie} onChange={(e) => setUploadKategorie(e.target.value)} className="border rounded px-2 py-1.5 text-sm" data-testid="select-upload-kategorie">
              {BILD_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm" data-testid="btn-upload-bild">
              <Upload className="w-4 h-4" /> {uploading ? "Lade hoch…" : "Bilder hochladen"}
            </Button>
            <input ref={fileInputRef} type="file" multiple accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
          </div>
        </div>

        {bilder.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded">
            <Camera className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
            Noch keine Bilder. Wähle eine Kategorie und lade Bilder hoch.
          </div>
        ) : (
          <div className="space-y-4">
            {BILD_KATEGORIEN.map(kat => bilderByKat[kat].length > 0 && (
              <div key={kat} data-testid={`bilder-gruppe-${kat}`}>
                <h3 className="text-sm font-medium text-slate-700 mb-2 capitalize">{kat} ({bilderByKat[kat].length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {bilderByKat[kat].map(b => (
                    <BildKarte key={b.id} bild={b} onDelete={() => deleteBild(b.id)} onUpdateBeschreibung={(text) => updateBildBeschreibung(b.id, text)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const BildKarte = ({ bild, onDelete, onUpdateBeschreibung }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(bild.beschreibung || "");
  const handleBlur = () => {
    setEditing(false);
    if (text !== (bild.beschreibung || "")) onUpdateBeschreibung(text);
  };
  return (
    <div className="border rounded overflow-hidden bg-white group relative" data-testid={`bild-${bild.id}`}>
      <a href={bild.url} target="_blank" rel="noopener noreferrer">
        <img src={bild.url} alt={bild.filename} className="w-full h-32 object-cover" />
      </a>
      <button onClick={onDelete} className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition" title="Löschen" data-testid={`btn-delete-bild-${bild.id}`}>
        <X className="w-4 h-4" />
      </button>
      <div className="p-2">
        {editing ? (
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            className="text-xs h-7"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-slate-600 text-left w-full flex items-center gap-1 hover:text-primary" data-testid={`bild-beschreibung-${bild.id}`}>
            <Edit3 className="w-3 h-3 opacity-50" />
            {bild.beschreibung || <span className="italic text-muted-foreground">Beschreibung…</span>}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProjektDetail;
export { ProjektDetail };
