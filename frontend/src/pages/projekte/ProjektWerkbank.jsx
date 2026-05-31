import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User as UserIcon, MapPin, Phone, Mail, Edit, Plus,
  Folder, Image as ImageIcon, Upload, Trash2, X, Save, Sparkles,
  ChevronDown, ChevronUp, Calendar, Edit3, Globe, Wrench, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge, Input, Textarea, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { useF1Help } from "@/lib/useF1Help";
import { AufgabenPanel } from "@/components/AufgabenPanel";
import { TerminePanel } from "@/components/TerminePanel";
import KundenLinkDialog from "@/components/KundenLinkDialog";
import NewProjektDialog, { useTextvorlagen } from "@/components/NewProjektDialog";
import ProjektBild from "@/components/ProjektBild";
import MailHistoryModal from "@/components/MailHistoryModal";
import { CustomerDocumentsPanel } from "@/components/CustomerDocumentsPanel";

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
  useF1Help("hilfe_projekte");
  const { kunde_id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [mailHistoryFor, setMailHistoryFor] = useState(null);

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

  if (loading) return <div className="p-8 text-center text-muted-foreground">Lade…</div>;
  if (!data) return null;

  const { kunde, projekte, stats } = data;
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

        {/* === Aktionsleiste === */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {kunde.email && (
            <button
              onClick={() => setMailHistoryFor({
                email: kunde.email,
                name: kunde.name || `${kunde.vorname || ""} ${kunde.nachname || ""}`.trim() || kunde.email,
              })}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors"
              data-testid="btn-werkbank-mail-history"
              title="Alle Mails von/an diesen Kunden aus IMAP anzeigen"
            >
              <Mail className="w-4 h-4" /> Mailverlauf
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const res = await api.get(`/portals/for-customer/${kunde_id}`);
                if (res.data?.exists && res.data?.portal?.id) {
                  navigate(`/portals?portal=${res.data.portal.id}`);
                } else {
                  if (!kunde.email) { toast.error("Kunde hat keine E-Mail – erst ergänzen"); return; }
                  if (!window.confirm(`Neues Kundenportal für ${kunde.vorname || ""} ${kunde.nachname || ""}${kunde.firma ? ` (${kunde.firma})` : ""} anlegen?`)) return;
                  const created = await api.post(`/portals/from-customer/${kunde_id}`, {});
                  const newId = created.data?.id;
                  toast.success("Portal erstellt");
                  navigate(newId ? `/portals?portal=${newId}` : `/portals`);
                }
              } catch (err) {
                toast.error(err?.response?.data?.detail || "Fehler");
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
            data-testid="btn-werkbank-portal"
          >
            <Globe className="w-4 h-4" /> Kundenportal öffnen / anlegen
          </button>
          <button
            onClick={async () => {
              try {
                await api.post(`/einsaetze/from-kunde/${kunde_id}`);
                toast.success("Einsatz erstellt");
                navigate("/einsaetze");
              } catch (err) {
                toast.error(err?.response?.data?.detail || "Fehler beim Erstellen");
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors"
            data-testid="btn-werkbank-einsatz"
          >
            <Wrench className="w-4 h-4" /> Einsatz erstellen
          </button>
        </div>
      </div>

      {/* Dokumente & Vorgaenge */}
      <div className="mb-4">
        <CustomerDocumentsPanel customerId={kunde_id} />
      </div>

      {/* Aufgaben + Termine ohne Projekt-Bezug (Kunden-Ebene) */}
      <div className="mb-4 space-y-2">
        <AufgabenPanel kunde_id={kunde_id} onlyWithoutProjekt title="Aufgaben ohne Projekt-Bezug" defaultCollapsed compact />
        <TerminePanel kunde_id={kunde_id} onlyWithoutProjekt title="Termine ohne Projekt-Bezug" defaultCollapsed compact />
      </div>

      {/* === Projekte === */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder className="w-5 h-5 text-emerald-600" />
          Projekte
          <Badge variant="outline" className="text-xs">{stats.projekte_total} gesamt · {stats.projekte_aktiv} aktiv</Badge>
        </h2>
        <Button
          onClick={() => setShowNew(true)}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="btn-new-projekt"
        >
          <Plus className="w-4 h-4" /> Neues Projekt
        </Button>
      </div>

      {projekte.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state-werkbank">
          <Folder className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-lg font-semibold">Noch keine Projekte für {kundeName}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Klicke auf „+ Neues Projekt" — Adresse, Anliegen und Kategorie werden automatisch
            aus den Kundendaten vorgeschlagen.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {projekte.map(p => (
            <ProjektKarte key={p.id} projekt={p} kundeId={kunde_id} kunde={kunde} onChanged={load} />
          ))}
        </div>
      )}

      {showNew && (
        <NewProjektDialog
          kundeId={kunde_id}
          kunde={kunde}
          isFirstProjekt={projekte.length === 0}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}

      <MailHistoryModal
        isOpen={!!mailHistoryFor}
        onClose={() => setMailHistoryFor(null)}
        email={mailHistoryFor?.email || ""}
        kundeName={mailHistoryFor?.name || ""}
      />
    </div>
  );
};

// ==================== Projekt-Karte (inline editierbar) ====================
const ProjektKarte = ({ projekt, kundeId, kunde, onChanged }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [data, setData] = useState(projekt);
  const [saving, setSaving] = useState(false);
  const [uploadKategorie, setUploadKategorie] = useState("schaden");
  const [uploading, setUploading] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [tabStats, setTabStats] = useState({ aufgaben: null, termine: null });
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const statusOptions = useTextvorlagen("projekt_status");
  const kategorieOptions = useTextvorlagen("projekt_kategorie");
  const bildKatOptions = useTextvorlagen("projekt_bild_kategorie");
  const statusList = statusOptions.map(s => s.title).filter(Boolean);
  const kategorieList = kategorieOptions.map(s => s.title).filter(Boolean);
  const bildKatList = bildKatOptions.map(s => s.title).filter(Boolean);

  // Wenn der Outer-projekt-prop sich aendert (nach load): synchronisieren
  useEffect(() => { setData(projekt); }, [projekt]);

  // Tab-Stats: laden beim Expand und beim Tab-Wechsel (refetch sorgt fuer frische Counts nach Mutation)
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const loadStats = async () => {
      try {
        const [a, t] = await Promise.all([
          api.get("/module-aufgaben/stats/uebersicht", { params: { projekt_id: data.id } }).then(r => r.data).catch(() => null),
          api.get("/module-termine/stats/uebersicht", { params: { projekt_id: data.id } }).then(r => r.data).catch(() => null),
        ]);
        if (!cancelled) setTabStats({ aufgaben: a, termine: t });
      } catch { /* ignore */ }
    };
    loadStats();
    return () => { cancelled = true; };
  }, [expanded, activeTab, data.id]);

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
          {/* Tab-Strip */}
          <div className="flex gap-1 border-b" data-testid={`tabs-projekt-${data.id}`}>
            {(() => {
              const aufgOpen = (tabStats.aufgaben?.offen || 0) + (tabStats.aufgaben?.in_arbeit || 0);
              const aufgTotal = tabStats.aufgaben?.gesamt ?? null;
              const termOpen = (tabStats.termine?.wartet_auf_go || 0);
              const termTotal = tabStats.termine?.gesamt ?? null;
              const tabs = [
                { id: "details", label: "Details" },
                { id: "aufgaben", label: "Aufgaben", count: aufgTotal, hasOffen: aufgOpen > 0 },
                { id: "termine", label: "Termine", count: termTotal, hasOffen: termOpen > 0 },
                { id: "bilder", label: `Bilder (${bilder.length})` },
              ];
              return tabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  data-testid={`tab-${t.id}-${data.id}`}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1 ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <span>{t.label}</span>
                  {t.count != null && t.count > 0 && (
                    <span className="text-xs text-muted-foreground">({t.count})</span>
                  )}
                  {t.hasOffen && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-orange-500"
                      title="Offene Eintraege"
                      data-testid={`tab-${t.id}-${data.id}-dot`}
                    />
                  )}
                </button>
              ));
            })()}
          </div>

          {/* Tab: Details */}
          {activeTab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Titel *</label>
                <Input value={data.titel || ""} onChange={(e) => update("titel", e.target.value)} data-testid={`input-titel-${data.id}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                <select value={data.status} onChange={(e) => update("status", e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid={`select-status-${data.id}`}>
                  {statusList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Kategorie</label>
                <select value={data.kategorie || (kategorieList[0] || "")} onChange={(e) => update("kategorie", e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                  {kategorieList.map(k => <option key={k} value={k}>{k}</option>)}
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
          )}

          {/* Tab: Aufgaben */}
          {activeTab === "aufgaben" && (
            <AufgabenPanel
              kunde_id={kundeId}
              projekt_id={data.id}
              title="Aufgaben dieses Projekts"
              defaultCollapsed={false}
              compact
            />
          )}

          {/* Tab: Termine */}
          {activeTab === "termine" && (
            <TerminePanel
              kunde_id={kundeId}
              projekt_id={data.id}
              title="Termine dieses Projekts"
              defaultCollapsed={false}
              compact
            />
          )}

          {/* Tab: Bilder */}
          {activeTab === "bilder" && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h4 className="text-sm font-semibold flex items-center gap-1">
                  <ImageIcon className="w-4 h-4" /> Bilder ({bilder.length})
                </h4>
                <div className="flex items-center gap-1">
                  <select value={uploadKategorie} onChange={(e) => setUploadKategorie(e.target.value)} className="border rounded px-2 py-1 text-xs">
                    {bildKatList.map(k => <option key={k} value={k}>{k}</option>)}
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
          )}

          <div className="flex items-center justify-between pt-3 border-t flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:bg-red-50" data-testid={`btn-delete-${data.id}`}>
              <Trash2 className="w-4 h-4" /> Löschen
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/quotes/new?customer=${kundeId}&projekt_id=${data.id}`)}
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                data-testid={`btn-projekt-angebot-${data.id}`}
                title="Angebot fuer dieses Projekt erstellen"
              >
                <FileText className="w-4 h-4" /> Angebot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLinkDialog(true)}
                className="border-violet-300 text-violet-700 hover:bg-violet-50"
                data-testid={`btn-projekt-link-${data.id}`}
                title="Temporären Link für Mitarbeiter mit Projekt-Bildern erzeugen"
              >
                <Mail className="w-4 h-4" /> Link für Mitarbeiter
              </Button>
              <Button size="sm" onClick={save} disabled={saving} data-testid={`btn-save-${data.id}`}>
                <Save className="w-4 h-4" /> {saving ? "Speichere…" : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <KundenLinkDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        kunde={kunde ? { ...kunde, id: kundeId } : { id: kundeId }}
        projekt={{ id: data.id, titel: data.titel }}
      />
    </Card>
  );
};

const BilderGrid = ({ bilder, onDelete }) => {
  const bildKats = useTextvorlagen("projekt_bild_kategorie");
  const kategorien = bildKats.map(b => b.title).filter(Boolean);
  // Bilder ohne bekannte Kategorie unter "sonstiges" gruppieren
  const known = new Set(kategorien);
  const groups = kategorien.reduce((acc, kat) => {
    acc[kat] = bilder.filter(b => b.kategorie === kat);
    return acc;
  }, {});
  const orphan = bilder.filter(b => !known.has(b.kategorie));
  if (orphan.length) {
    const fallback = kategorien.includes("sonstiges") ? "sonstiges" : kategorien[0] || "sonstiges";
    groups[fallback] = [...(groups[fallback] || []), ...orphan];
  }
  return (
    <div className="space-y-3">
      {kategorien.map(kat => (groups[kat] || []).length > 0 && (
        <div key={kat}>
          <div className="text-xs font-medium text-slate-600 capitalize mb-1">{kat} ({groups[kat].length})</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {groups[kat].map(b => (
              <ProjektBild key={b.id} bild={b} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};


export default ProjektWerkbank;
export { ProjektWerkbank };
