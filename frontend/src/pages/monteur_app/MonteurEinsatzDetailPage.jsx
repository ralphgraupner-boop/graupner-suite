import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, Phone, Mail, Camera, Plus, Eye, Trash2, Edit2, X, Save,
  ClipboardList, HardHat,
} from "lucide-react";

const PHASE_LABEL = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
};

/**
 * Monteur-App – Einsatz-Detail
 * Tabs: Besichtigung (Foto+Notiz) | Ausführung (Foto+Notiz)
 */
export function MonteurEinsatzDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [einsatz, setEinsatz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState("besichtigung");
  const [notizText, setNotizText] = useState("");
  const [editNotizId, setEditNotizId] = useState(null);
  const [editNotizText, setEditNotizText] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [previewFoto, setPreviewFoto] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/monteur/einsaetze/${id}`);
      setEinsatz(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
      navigate("/monteur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);  // eslint-disable-line

  const addNotiz = async () => {
    if (!notizText.trim()) return;
    try {
      await api.post("/monteur/notizen", { einsatz_id: id, phase: activePhase, text: notizText });
      setNotizText("");
      toast.success("Notiz gespeichert");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const saveNotizEdit = async () => {
    try {
      await api.put(`/monteur/notizen/${editNotizId}`, { text: editNotizText });
      setEditNotizId(null);
      setEditNotizText("");
      toast.success("Notiz aktualisiert");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const deleteNotiz = async (nid) => {
    if (!window.confirm("Notiz wirklich löschen?")) return;
    try {
      await api.delete(`/monteur/notizen/${nid}`);
      toast.success("Gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const uploadFoto = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append("einsatz_id", id);
      fd.append("phase", activePhase);
      fd.append("description", "");
      fd.append("file", file);
      await api.post("/monteur/fotos", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Foto hochgeladen");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteFoto = async (fid) => {
    if (!window.confirm("Foto wirklich löschen?")) return;
    try {
      await api.delete(`/monteur/fotos/${fid}`);
      toast.success("Gelöscht");
      setPreviewFoto(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const openFoto = async (foto) => {
    try {
      const res = await api.get(`/monteur/fotos/${foto.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setPreviewFoto({ ...foto, url });
    } catch {
      toast.error("Foto konnte nicht geladen werden");
    }
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground">Lade…</div>;
  if (!einsatz) return null;

  const kunde = einsatz.kunde_detail || {};
  const adresse = einsatz.kunde_adresse ||
    [kunde.strasse, kunde.hausnummer, kunde.plz, kunde.ort].filter(Boolean).join(" ");
  const telefon = einsatz.kunde_telefon || kunde.phone;
  const email = einsatz.kunde_email || kunde.email;

  const fotosPhase = (einsatz.monteur_fotos || []).filter(f => f.phase === activePhase);
  const notizenPhase = (einsatz.monteur_notizen || []).filter(n => n.phase === activePhase);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24" data-testid="monteur-einsatz-detail">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/monteur")} className="p-2 rounded-lg hover:bg-muted" data-testid="btn-back-monteur">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">Einsatz</div>
          <div className="text-lg font-semibold truncate">{einsatz.customer_name || "(kein Kunde)"}</div>
        </div>
        <HardHat className="w-6 h-6 text-primary" />
      </div>

      {/* Kontakt-Leiste (Quick-Aktionen) */}
      <div className="bg-card border rounded-xl p-4 space-y-2">
        {adresse && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">{adresse}</span>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`}
              target="_blank" rel="noopener noreferrer"
              className="px-3 py-1 rounded-lg bg-blue-500 text-white text-xs font-medium"
              data-testid="btn-nav-detail"
            >
              Navigation
            </a>
          </div>
        )}
        {telefon && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">{telefon}</span>
            <a href={`tel:${telefon}`} className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-medium" data-testid="btn-call-detail">
              Anrufen
            </a>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm truncate">{email}</span>
            <a href={`mailto:${email}`} className="px-3 py-1 rounded-lg bg-muted text-foreground text-xs font-medium" data-testid="btn-mail-detail">
              E-Mail
            </a>
          </div>
        )}
      </div>

      {/* Auftrag-Kurzinfo (aus Einsatz) */}
      {(einsatz.beschreibung || einsatz.termin_text || (einsatz.reparaturgruppen || []).length > 0) && (
        <div className="bg-muted/40 border rounded-xl p-4 space-y-1 text-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <ClipboardList className="w-3.5 h-3.5" /> Auftrag
          </div>
          {einsatz.termin_text && <div><b>Termin:</b> {einsatz.termin_text}</div>}
          {einsatz.beschreibung && <div className="whitespace-pre-wrap">{einsatz.beschreibung}</div>}
          {(einsatz.reparaturgruppen || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {einsatz.reparaturgruppen.map((r, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">{r}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase-Tabs */}
      <div className="flex gap-2 border-b">
        {["besichtigung", "ausfuehrung"].map(p => (
          <button
            key={p}
            onClick={() => setActivePhase(p)}
            className={`flex-1 px-4 py-3 text-sm font-semibold border-b-2 -mb-px ${
              activePhase === p ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
            data-testid={`tab-${p}`}
          >
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Fotos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1"><Camera className="w-4 h-4" /> Fotos ({fotosPhase.length})</h3>
          <label className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${uploadingFoto ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"}`} data-testid="btn-upload-foto">
            <Plus className="w-4 h-4" />
            {uploadingFoto ? "Lade hoch…" : "Foto hinzufügen"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={uploadFoto}
              disabled={uploadingFoto}
              className="hidden"
            />
          </label>
        </div>
        {fotosPhase.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg">
            Noch keine Fotos in dieser Phase. Tippe oben auf „Foto hinzufügen".
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {fotosPhase.map(f => (
              <button
                key={f.id}
                onClick={() => openFoto(f)}
                className="aspect-square rounded-lg bg-muted border hover:border-primary overflow-hidden flex items-center justify-center relative group"
                data-testid={`foto-${f.id}`}
              >
                <Camera className="w-6 h-6 text-muted-foreground" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                  {f.filename}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notizen */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Bemerkungen ({notizenPhase.length})</h3>
        <div className="space-y-2 mb-3">
          {notizenPhase.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-lg">
              Noch keine Bemerkungen.
            </div>
          ) : notizenPhase.map(n => (
            <div key={n.id} className="bg-card border rounded-lg p-3 text-sm" data-testid={`notiz-${n.id}`}>
              {editNotizId === n.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editNotizText}
                    onChange={e => setEditNotizText(e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditNotizId(null); setEditNotizText(""); }} className="px-3 py-1 rounded border text-xs">Abbrechen</button>
                    <button onClick={saveNotizEdit} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs inline-flex items-center gap-1"><Save className="w-3 h-3" /> Speichern</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="whitespace-pre-wrap">{n.text}</div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{n.created_by} · {new Date(n.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditNotizId(n.id); setEditNotizText(n.text); }} className="p-1 hover:bg-muted rounded" data-testid={`notiz-edit-${n.id}`}><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => deleteNotiz(n.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" data-testid={`notiz-del-${n.id}`}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <textarea
            value={notizText}
            onChange={e => setNotizText(e.target.value)}
            placeholder={`Bemerkung zur ${PHASE_LABEL[activePhase]}…`}
            className="w-full p-3 border rounded-lg text-sm"
            rows={3}
            data-testid="notiz-input"
          />
          <button
            onClick={addNotiz}
            disabled={!notizText.trim()}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            data-testid="btn-add-notiz"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Bemerkung speichern
          </button>
        </div>
      </div>

      {/* Foto-Preview-Modal */}
      {previewFoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col" onClick={() => setPreviewFoto(null)}>
          <div className="flex items-center justify-between p-4 text-white">
            <div className="flex-1 truncate text-sm">{previewFoto.filename}</div>
            <button onClick={() => deleteFoto(previewFoto.id)} className="p-2 hover:bg-white/10 rounded text-red-400" data-testid="btn-del-preview-foto">
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={() => setPreviewFoto(null)} className="p-2 hover:bg-white/10 rounded ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <img src={previewFoto.url} alt={previewFoto.filename} className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

export default MonteurEinsatzDetailPage;
