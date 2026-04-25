import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User as UserIcon, MapPin, Phone, Mail, Edit, Plus,
  Folder, Image as ImageIcon, Upload, Trash2, X, Save, Sparkles,
  ChevronDown, ChevronUp, Calendar, Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge, Input, Textarea, Modal } from "@/components/common";
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

/**
 * Werkbank: Kunde oben fest (sticky), Projekte unten scrollbar.
 * Routen-Eintritt:
 *   - aus Kunden-Modul: /module/projekte/werkbank/<kunde_id>
 *   - aus Projekte-Modul: Projekt-Karte -> springt auf werkbank/<kunde_id>?projekt=<id>
 */
const ProjektWerkbank = () => {
  const { kunde_id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/module-projekte/werkbank/${kunde_id}`);
      setData(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
      navigate("/module/projekte");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [kunde_id]);

  const createFromAnfrage = async () => {
    const isFirst = (data?.projekte?.length || 0) === 0;
    const msg = isFirst
      ? "Soll aus den Anfrage-Daten dieses Kunden ein neues Projekt erstellt werden?\nAdresse, Beschreibung, Kategorie und Bilder werden automatisch übernommen."
      : "Soll ein weiteres Projekt aus den Anfrage-Daten erstellt werden?\nAdresse, Beschreibung und Kategorie werden übernommen.\n(Bilder werden NICHT erneut übernommen, da sie schon im 1. Projekt sind.)";
    if (!window.confirm(msg)) return;
    setCreating(true);
    try {
      const res = await api.post(`/module-projekte/from-kunde/${kunde_id}`, { bilder_uebernehmen: true });
      const bilderHinweis = res.data.bilder?.length ? ` (${res.data.bilder.length} Bilder übernommen)` : "";
      toast.success(`Projekt "${res.data.titel}" angelegt${bilderHinweis}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Lade…</div>;
  if (!data) return null;

  const { kunde, projekte, stats, has_anfrage_daten } = data;
  const kundeName = kunde.name || `${kunde.vorname || ""} ${kunde.nachname || ""}`.trim() || "(ohne Name)";

  return (
    <div data-testid="projekt-werkbank-page" className="pb-12">
      {/* === Sticky Kunden-Block === */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b shadow-sm -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-4 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} data-testid="btn-back-werkbank">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <UserIcon className="w-5 h-5 text-primary flex-shrink-0" />
                <h1 className="text-xl lg:text-2xl font-bold truncate">{kundeName}</h1>
                {kunde.kontakt_status && (
                  <Badge variant="outline" className="text-xs">{kunde.kontakt_status}</Badge>
                )}
                {kunde.firma && <Badge variant="outline" className="text-xs">{kunde.firma}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                {(kunde.address || kunde.strasse || kunde.ort) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {kunde.address || `${kunde.strasse || ""} ${kunde.hausnummer || ""}, ${kunde.plz || ""} ${kunde.ort || ""}`.replace(/, *$/, "").trim()}
                  </span>
                )}
                {(kunde.phone || kunde.mobile) && (
                  <a href={`tel:${kunde.phone || kunde.mobile}`} className="flex items-center gap-1 hover:text-primary">
                    <Phone className="w-3.5 h-3.5" /> {kunde.phone || kunde.mobile}
                  </a>
                )}
                {kunde.email && (
                  <a href={`mailto:${kunde.email}`} className="flex items-center gap-1 hover:text-primary">
                    <Mail className="w-3.5 h-3.5" /> {kunde.email}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate(`/module/kunden`)} data-testid="btn-edit-kunde">
              <Edit className="w-4 h-4" /> Kunde bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* === Projekte === */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder className="w-5 h-5 text-emerald-600" />
          Projekte
          <Badge variant="outline" className="text-xs">{stats.projekte_total} gesamt · {stats.projekte_aktiv} aktiv</Badge>
        </h2>
        <div className="flex gap-2">
          {has_anfrage_daten && (
            <Button onClick={createFromAnfrage} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" data-testid="btn-from-anfrage">
              <Sparkles className="w-4 h-4" /> {creating ? "Erstelle…" : "Aus Anfrage anlegen"}
            </Button>
          )}
          <Button onClick={() => setShowNew(true)} size="sm" data-testid="btn-new-leer">
            <Plus className="w-4 h-4" /> Neues leeres Projekt
          </Button>
        </div>
      </div>

      {projekte.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state-werkbank">
          <Folder className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-lg font-semibold">Noch keine Projekte für {kundeName}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {has_anfrage_daten
              ? "Du kannst aus den Anfrage-Daten direkt ein Projekt erstellen (grüner Button oben)."
              : "Lege ein neues Projekt an."}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {projekte.map(p => (
            <ProjektKarte key={p.id} projekt={p} kundeId={kunde_id} onChanged={load} />
          ))}
        </div>
      )}

      {showNew && (
        <NewLeeresProjektDialog
          kundeId={kunde_id}
          kundeName={kundeName}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
};

// ==================== Projekt-Karte (inline editierbar) ====================
const ProjektKarte = ({ projekt, kundeId, onChanged }) => {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(projekt);
  const [saving, setSaving] = useState(false);
  const [uploadKategorie, setUploadKategorie] = useState("schaden");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Wenn der Outer-projekt-prop sich aendert (nach load): synchronisieren
  useEffect(() => { setData(projekt); }, [projekt]);

  const update = (field, value) => setData(d => ({ ...d, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/module-projekte/${data.id}`, {
        titel: data.titel,
        beschreibung: data.beschreibung,
        kategorie: data.kategorie,
        adresse: data.adresse,
        status: data.status,
        notizen: data.notizen,
      });
      setData(res.data);
      toast.success("Projekt gespeichert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Projekt "${data.titel}" wirklich löschen?`)) return;
    try {
      await api.delete(`/module-projekte/${data.id}`);
      toast.success("Projekt gelöscht");
      onChanged();
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
        await api.post(`/module-projekte/${data.id}/bilder?kategorie=${uploadKategorie}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(`${files.length} Bild(er) hochgeladen`);
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteBild = async (bildId) => {
    if (!window.confirm("Bild wirklich löschen?")) return;
    try {
      await api.delete(`/module-projekte/${data.id}/bilder/${bildId}`);
      toast.success("Bild gelöscht");
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const bilder = data.bilder || [];

  return (
    <Card className="overflow-hidden" data-testid={`projekt-card-${data.id}`}>
      {/* Header (immer sichtbar) */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold">{data.titel}</h3>
              <Badge className={`text-xs border ${STATUS_COLORS[data.status] || ""}`}>{data.status}</Badge>
              {data.kategorie && <Badge variant="outline" className="text-xs">{data.kategorie}</Badge>}
              {bilder.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <ImageIcon className="w-3 h-3" /> {bilder.length}
                </span>
              )}
              {data.aus_anfrage && <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">aus Anfrage</Badge>}
            </div>
            {data.beschreibung && !expanded && (
              <p className="text-sm text-slate-700 mt-1 line-clamp-1">{data.beschreibung}</p>
            )}
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar className="w-3 h-3" />{(data.created_at || "").slice(0, 10)}
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </div>

      {/* Detail (ausgeklappt) */}
      {expanded && (
        <div className="border-t bg-muted/10 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Titel *</label>
              <Input value={data.titel || ""} onChange={(e) => update("titel", e.target.value)} data-testid={`input-titel-${data.id}`} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
              <select value={data.status} onChange={(e) => update("status", e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid={`select-status-${data.id}`}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Kategorie</label>
              <select value={data.kategorie || "Sonstiges"} onChange={(e) => update("kategorie", e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Adresse (überschreibt Kunde)</label>
              <Input value={data.adresse || ""} onChange={(e) => update("adresse", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Beschreibung</label>
              <Textarea value={data.beschreibung || ""} onChange={(e) => update("beschreibung", e.target.value)} rows={3} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Notizen (intern)</label>
              <Textarea value={data.notizen || ""} onChange={(e) => update("notizen", e.target.value)} rows={2} />
            </div>
          </div>

          {/* Bilder */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h4 className="text-sm font-semibold flex items-center gap-1">
                <ImageIcon className="w-4 h-4" /> Bilder ({bilder.length})
              </h4>
              <div className="flex items-center gap-1">
                <select value={uploadKategorie} onChange={(e) => setUploadKategorie(e.target.value)} className="border rounded px-2 py-1 text-xs">
                  {BILD_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid={`btn-upload-${data.id}`}>
                  <Upload className="w-3.5 h-3.5" /> {uploading ? "Lade…" : "Hochladen"}
                </Button>
                <input ref={fileInputRef} type="file" multiple accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
            {bilder.length === 0 ? (
              <div className="text-xs text-muted-foreground border-2 border-dashed rounded p-4 text-center">
                Keine Bilder. Wähle Kategorie und lade Bilder hoch.
              </div>
            ) : (
              <BilderGrid bilder={bilder} onDelete={deleteBild} />
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:bg-red-50" data-testid={`btn-delete-${data.id}`}>
              <Trash2 className="w-4 h-4" /> Löschen
            </Button>
            <Button size="sm" onClick={save} disabled={saving} data-testid={`btn-save-${data.id}`}>
              <Save className="w-4 h-4" /> {saving ? "Speichere…" : "Speichern"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

const BilderGrid = ({ bilder, onDelete }) => {
  // Gruppiere nach Kategorie
  const groups = BILD_KATEGORIEN.reduce((acc, kat) => {
    acc[kat] = bilder.filter(b => b.kategorie === kat);
    return acc;
  }, {});
  return (
    <div className="space-y-3">
      {BILD_KATEGORIEN.map(kat => groups[kat].length > 0 && (
        <div key={kat}>
          <div className="text-xs font-medium text-slate-600 capitalize mb-1">{kat} ({groups[kat].length})</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {groups[kat].map(b => {
              const safeUrl = (b.url || "").startsWith("http") || (b.url || "").startsWith("/uploads")
                ? b.url
                : `/${(b.url || "").replace(/^\/+/, "")}`;
              return (
              <div key={b.id} className="border rounded overflow-hidden bg-white group relative">
                <a href={safeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <img src={safeUrl} alt={b.filename} className="w-full h-20 object-cover" />
                </a>
                <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-600 opacity-0 group-hover:opacity-100" title="Löschen">
                  <X className="w-3 h-3" />
                </button>
                {b.beschreibung && <div className="text-[10px] text-slate-600 px-1 py-0.5 truncate">{b.beschreibung}</div>}
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==================== Neues leeres Projekt ====================
const NewLeeresProjektDialog = ({ kundeId, kundeName, onClose, onCreated }) => {
  const [titel, setTitel] = useState("");
  const [kategorie, setKategorie] = useState("Sonstiges");
  const [beschreibung, setBeschreibung] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!titel.trim()) return toast.error("Bitte Titel angeben");
    setSaving(true);
    try {
      await api.post("/module-projekte/", {
        kunde_id: kundeId,
        titel: titel.trim(),
        beschreibung,
        kategorie,
      });
      toast.success("Projekt angelegt");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Neues Projekt für ${kundeName}`} size="md">
      <div className="p-4 space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1">Titel *</label>
          <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z.B. Innentür Wohnzimmer" data-testid="input-leer-titel" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Kategorie</label>
          <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
            {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Beschreibung</label>
          <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving} data-testid="btn-leer-anlegen">{saving ? "Speichere…" : "Anlegen"}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProjektWerkbank;
export { ProjektWerkbank };
