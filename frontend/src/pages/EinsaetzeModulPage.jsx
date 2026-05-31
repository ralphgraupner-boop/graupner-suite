import { useState, useEffect, useCallback, useMemo } from "react";
import { Wrench, Plus, Search, Pencil, Trash2, X, User, Phone, Mail, MapPin, Calendar, Clock, Upload, Image as ImageIcon, Send, Download, ChevronDown, ChevronUp, AlertCircle, CheckCircle, FileText, Printer, Folder, User as UserIcon, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";
import { useF1Help } from "@/lib/useF1Help";
import TitleInputWithVorlagen from "@/components/TitleInputWithVorlagen";

const BILD_KAT_LABELS = {
  kundenanfrage: "Kundenanfrage", besichtigung: "Besichtigung",
  waehrend_arbeit: "Waehrend Arbeit", abnahme: "Abnahme",
  hinweise: "Hinweise", sonstiges: "Sonstiges"
};

const EinsaetzeModulPage = () => {
  useF1Help("hilfe_einsaetze");
  const [einsaetze, setEinsaetze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("aktiv");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [config, setConfig] = useState({ reparaturgruppen: [], materialien: [], bild_kategorien: [], prioritaeten: [] });
  const [mitarbeiter, setMitarbeiter] = useState([]);
  // Such-zuerst-Schema (Ralph 12.05.2026)
  const [kunden, setKunden] = useState([]);
  const [projekte, setProjekte] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, cfgRes, maRes, kRes, pRes] = await Promise.all([
        api.get(`/einsaetze?status=${statusFilter}`),
        api.get("/einsatz-config"),
        api.get("/mitarbeiter"),
        api.get("/modules/kunden/data").catch(() => ({ data: [] })),
        api.get("/module-projekte").catch(() => ({ data: [] })),
      ]);
      setEinsaetze(res.data);
      setConfig(cfgRes.data);
      setMitarbeiter(maRes.data.filter(m => m.status === "aktiv"));
      setKunden(kRes.data || []);
      setProjekte(pRes.data || []);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const kundeLabelOf = (k) => k?.firma || [k?.vorname, k?.nachname].filter(Boolean).join(" ") || k?.name || k?.id || "";
  const kundeLabelById = (id) => {
    const k = kunden.find(x => x.id === id);
    return k ? kundeLabelOf(k) : null;
  };

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return { kunden: [], projekte: [] };
    const ks = kunden
      .map(k => ({ id: k.id, label: kundeLabelOf(k) }))
      .filter(k => k.label.toLowerCase().includes(q))
      .slice(0, 8);
    const ps = projekte
      .map(p => ({ id: p.id, titel: p.titel || "(ohne Titel)", kunde_id: p.kunde_id, kundeLabel: kundeLabelById(p.kunde_id) }))
      .filter(p => p.titel.toLowerCase().includes(q) || (p.kundeLabel || "").toLowerCase().includes(q))
      .slice(0, 8);
    return { kunden: ks, projekte: ps };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, kunden, projekte]);

  const filtered = useMemo(() => {
    if (!selectedTarget) return einsaetze;
    if (selectedTarget.type === "kunde") {
      const projektIdsOfKunde = projekte.filter(p => p.kunde_id === selectedTarget.id).map(p => p.id);
      return einsaetze.filter(e =>
        e.kunde_id === selectedTarget.id || (e.projekt_id && projektIdsOfKunde.includes(e.projekt_id))
      );
    }
    if (selectedTarget.type === "projekt") {
      return einsaetze.filter(e => e.projekt_id === selectedTarget.id);
    }
    return einsaetze;
  }, [einsaetze, selectedTarget, projekte]);

  const deleteEinsatz = async (id) => {
    if (!window.confirm("Einsatz wirklich loeschen?")) return;
    try {
      await api.delete(`/einsaetze/${id}`);
      toast.success("Geloescht");
      if (selected?.id === id) setSelected(null);
      load();
    } catch { toast.error("Fehler"); }
  };

  const statusBadge = (s) => {
    const map = { aktiv: "bg-green-100 text-green-700", in_bearbeitung: "bg-blue-100 text-blue-700", abgeschlossen: "bg-gray-100 text-gray-600", inaktiv: "bg-red-100 text-red-700" };
    return map[s] || "bg-gray-100 text-gray-600";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto" data-testid="einsaetze-page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Einsaetze</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {selectedTarget ? `${filtered.length} Einsatz${filtered.length === 1 ? "" : "e"} für ${selectedTarget.label}` : `${einsaetze.length} Einsätze`}
          </p>
        </div>
        {selectedTarget && (
          <button onClick={() => { setSelected(null); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium hover:bg-primary/90" data-testid="btn-new-einsatz">
            <Plus className="w-4 h-4" /> Neuer Einsatz
          </button>
        )}
      </div>

      {/* Suchzeile (Such-zuerst-Schema) */}
      {!selected && !showForm && (
        <div className="mb-4" data-testid="einsaetze-search-section">
          {selectedTarget ? (
            <div className="flex items-center gap-2 p-3 bg-muted/40 border rounded-md" data-testid="einsaetze-selected-target">
              {selectedTarget.type === "kunde" ? <UserIcon className="w-4 h-4 text-blue-700" /> : <Folder className="w-4 h-4 text-emerald-700" />}
              <span className="text-sm font-medium">
                {selectedTarget.type === "kunde" ? "Kunde: " : "Projekt: "}{selectedTarget.label}
              </span>
              <button onClick={() => { setSelectedTarget(null); setSearchQuery(""); }} className="ml-auto p-1 hover:bg-background rounded-sm" title="Auswahl entfernen" data-testid="btn-einsaetze-clear-target">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Kunde oder Projekt suchen, um Einsätze anzuzeigen oder anzulegen …"
                  className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
                  data-testid="einsaetze-search-input"
                />
              </div>
              {searchFocused && searchQuery.trim() && (searchHits.kunden.length > 0 || searchHits.projekte.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 max-h-80 overflow-auto" data-testid="einsaetze-search-results">
                  {searchHits.kunden.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">Kunden ({searchHits.kunden.length})</div>
                      {searchHits.kunden.map(k => (
                        <button key={`k-${k.id}`} onClick={() => { setSelectedTarget({ type: "kunde", id: k.id, label: k.label }); setSearchQuery(""); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0" data-testid={`einsaetze-hit-kunde-${k.id}`}>
                          <UserIcon className="w-4 h-4 text-blue-700 flex-shrink-0" />
                          <span>{k.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchHits.projekte.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">Projekte ({searchHits.projekte.length})</div>
                      {searchHits.projekte.map(p => (
                        <button key={`p-${p.id}`} onClick={() => { setSelectedTarget({ type: "projekt", id: p.id, label: p.titel, kunde_id: p.kunde_id }); setSearchQuery(""); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0" data-testid={`einsaetze-hit-projekt-${p.id}`}>
                          <Folder className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                          <span>{p.titel}</span>
                          {p.kundeLabel && <span className="text-xs text-muted-foreground ml-auto">({p.kundeLabel})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {searchFocused && searchQuery.trim() && searchHits.kunden.length === 0 && searchHits.projekte.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 p-3 text-sm text-muted-foreground" data-testid="einsaetze-search-empty">
                  Keine Treffer für „{searchQuery}".
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!selected && !showForm && (
        <div className="flex gap-2 mb-4">
          <div className="flex border rounded-sm overflow-hidden text-sm ml-auto">
            {["aktiv", "inaktiv", ""].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 ${statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {s === "" ? "Alle" : s === "aktiv" ? "Aktiv" : "Inaktiv"}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <EinsatzForm
          item={selected}
          config={config}
          mitarbeiter={mitarbeiter}
          selectedTarget={selectedTarget}
          onClose={() => { setShowForm(false); setSelected(null); }}
          onSaved={() => { setShowForm(false); setSelected(null); load(); }}
        />
      )}

      {selected && !showForm && (
        <EinsatzDetail
          einsatz={selected}
          config={config}
          mitarbeiter={mitarbeiter}
          onBack={() => setSelected(null)}
          onEdit={() => setShowForm(true)}
          onReload={() => load().then(() => {
            api.get(`/einsaetze/${selected.id}`).then(r => setSelected(r.data)).catch(() => {});
          })}
        />
      )}

      {!selected && !showForm && (
        <div className="grid gap-3">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              {selectedTarget ? `Keine Einsätze für ${selectedTarget.type === "kunde" ? "diesen Kunden" : "dieses Projekt"}.` : "Keine Einsätze vorhanden."}
            </Card>
          ) : (
            filtered.map((e) => (
            <Card key={e.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(e)} data-testid={`einsatz-card-${e.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <h3 className="font-semibold truncate">{e.betreff || "Ohne Betreff"}</h3>
                    <Badge className={statusBadge(e.status)}>{e.status}</Badge>
                    {e.prioritaet === "dringend" && <Badge className="bg-red-100 text-red-700">Dringend</Badge>}
                    {e.prioritaet === "hoch" && <Badge className="bg-orange-100 text-orange-700">Hoch</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{e.kunde_name || e.customer_name || "-"}</span>
                    {e.reparaturgruppe && <span>{e.reparaturgruppe}</span>}
                    {e.material && <span>{e.material}</span>}
                    {e.monteur_name && <span>Monteur: {e.monteur_name}</span>}
                  </div>
                  {(e.kunde_email || e.kunde_telefon) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {e.kunde_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{e.kunde_email}</span>}
                      {e.kunde_telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{e.kunde_telefon}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span><Calendar className="w-3 h-3 inline mr-1" />{new Date(e.created_at).toLocaleDateString("de-DE")}</span>
                    {e.summe_netto > 0 && <span className="font-medium text-foreground">{Number(e.summe_netto).toLocaleString("de-DE", {minimumFractionDigits: 2})} EUR netto</span>}
                    {(e.bilder || []).length > 0 && <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" />{e.bilder.length} Bilder</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button onClick={(ev) => { ev.stopPropagation(); setSelected(e); setShowForm(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(ev) => { ev.stopPropagation(); deleteEinsatz(e.id); }} className="p-2 hover:bg-red-50 rounded-sm text-red-500" title="Loeschen"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))
          )}
        </div>
      )}
    </div>
  );
};


// ==================== DETAIL VIEW ====================
const EinsatzDetail = ({ einsatz, config, mitarbeiter, onBack, onEdit, onReload }) => {
  const [bildKat, setBildKat] = useState("");
  const [uploading, setUploading] = useState(false);
  const [mailVorlagen, setMailVorlagen] = useState([]);
  const [terminVorlagen, setTerminVorlagen] = useState([]);
  const [showMailPanel, setShowMailPanel] = useState(false);
  const [showTerminPanel, setShowTerminPanel] = useState(false);
  const [mailText, setMailText] = useState("");
  const [mailBetreff, setMailBetreff] = useState("");
  const [terminText, setTerminText] = useState("");
  const [terminDatum, setTerminDatum] = useState("");
  const [sendingMail, setSendingMail] = useState(false);
  const [kundenmappeBusy, setKundenmappeBusy] = useState(false);
  const [mailLinkBusy, setMailLinkBusy] = useState(false);
  const e = einsatz;
  const bilder = e.bilder || [];
  const filteredBilder = bildKat ? bilder.filter(b => b.kategorie === bildKat) : bilder;
  const katCounts = {};
  bilder.forEach(b => { katCounts[b.kategorie] = (katCounts[b.kategorie] || 0) + 1; });

  useEffect(() => {
    api.get("/modules/textvorlagen/data?doc_type=einsatz").then(r => setMailVorlagen(r.data)).catch(() => {});
    api.get("/modules/textvorlagen/data?doc_type=termin").then(r => setTerminVorlagen(r.data)).catch(() => {});
  }, []);

  const replacePlaceholders = (text) => {
    return text
      .replace(/\{kunde_name\}/g, e.kunde_name || "")
      .replace(/\{kunde_adresse\}/g, e.kunde_adresse || "")
      .replace(/\{kunde_telefon\}/g, e.kunde_telefon || "")
      .replace(/\{kunde_email\}/g, e.kunde_email || "")
      .replace(/\{betreff\}/g, e.betreff || "")
      .replace(/\{material\}/g, e.material || "")
      .replace(/\{reparaturgruppe\}/g, e.reparaturgruppe || "")
      .replace(/\{termin_datum\}/g, terminDatum ? new Date(terminDatum).toLocaleDateString("de-DE") : (e.termin ? new Date(e.termin).toLocaleDateString("de-DE") : ""));
  };

  // ======= Kundenmappe (Mitarbeiter-Link) =======
  const ensureActiveLink = async () => {
    if (!e.kunde_id) throw new Error("Kein Kunde zu diesem Einsatz");
    const list = await api.get(`/module-kundenlink/list/${e.kunde_id}`);
    const nowIso = new Date().toISOString();
    const active = (list.data || [])
      .filter(l => !l.revoked && (l.expires_at || "") > nowIso)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    if (active.length > 0) return active[0];
    const created = await api.post(`/module-kundenlink/create/${e.kunde_id}`, {});
    return created.data;
  };

  const openKundenmappe = async () => {
    if (kundenmappeBusy) return;
    setKundenmappeBusy(true);
    try {
      const link = await ensureActiveLink();
      window.open(`${window.location.origin}/m/${link.token}`, "_blank", "noopener");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Kundenmappe konnte nicht geöffnet werden");
    } finally {
      setKundenmappeBusy(false);
    }
  };

  const sendKundenmappeMail = async () => {
    if (mailLinkBusy) return;
    const monteurName = (e.monteur_name || "").trim();
    if (!monteurName) {
      toast.error("Diesem Einsatz ist kein Monteur zugewiesen");
      return;
    }
    setMailLinkBusy(true);
    try {
      const link = await ensureActiveLink();
      const res = await api.post(`/module-kundenlink/${link.id}/send-mail`, {
        recipient_id: e.monteur_id || "",
        recipient_name: monteurName,
        base_url: window.location.origin,
      });
      toast.success(`Link an ${res.data?.sent_to || monteurName} gesendet`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Mail konnte nicht gesendet werden");
    } finally {
      setMailLinkBusy(false);
    }
  };

  const applyMailVorlage = (v) => {
    setMailText(replacePlaceholders(v.content || ""));
    setMailBetreff(e.betreff || v.title || "");
  };

  const applyTerminVorlage = (v) => {
    setTerminText(replacePlaceholders(v.content || ""));
  };

  const sendMail = async () => {
    if (!e.kunde_email) { toast.error("Keine E-Mail-Adresse"); return; }
    if (!mailText.trim()) { toast.error("Nachricht leer"); return; }
    setSendingMail(true);
    try {
      await api.post(`/einsaetze/${e.id}/email`, {
        to_email: e.kunde_email,
        subject: mailBetreff || e.betreff || "Mitteilung",
        message: mailText
      });
      toast.success(`E-Mail an ${e.kunde_email} gesendet`);
      setShowMailPanel(false);
      setMailText("");
    } catch (err) { toast.error(err?.response?.data?.detail || "Fehler beim Senden"); }
    finally { setSendingMail(false); }
  };

  const openMailto = () => {
    const subject = encodeURIComponent(mailBetreff || e.betreff || "");
    const body = encodeURIComponent(mailText || e.beschreibung || "");
    window.location.href = `mailto:${e.kunde_email}?subject=${subject}&body=${body}`;
  };

  const openGoogleCalendar = () => {
    const dt = terminDatum || e.termin || "";
    if (!dt) { toast.error("Bitte Termin-Datum eingeben"); return; }
    const start = new Date(dt);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const title = encodeURIComponent(`Einsatz: ${e.kunde_name} - ${e.reparaturgruppe || e.betreff || ""}`);
    const details = encodeURIComponent(terminText || e.beschreibung || "");
    const location = encodeURIComponent([e.objekt_strasse, e.objekt_plz, e.objekt_ort].filter(Boolean).join(", ") || e.kunde_adresse || "");
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`, "_blank");
  };

  const downloadIcs = () => {
    const token = localStorage.getItem("token");
    window.open(`${API}/einsaetze/${e.id}/ics?token=${token}`, "_blank");
  };

  const downloadPdf = (blanko = false) => {
    const token = localStorage.getItem("token");
    window.open(`${API}/einsaetze/${e.id}/reparaturauftrag-pdf?blanko=${blanko}&token=${token}`, "_blank");
  };

  const uploadBild = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/einsaetze/${e.id}/bilder?kategorie=${bildKat || "sonstiges"}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Bild hochgeladen");
      onReload();
    } catch { toast.error("Upload fehlgeschlagen"); }
    finally { setUploading(false); ev.target.value = ""; }
  };

  const deleteBild = async (bildId) => {
    try {
      await api.delete(`/einsaetze/${e.id}/bilder/${bildId}`);
      toast.success("Bild geloescht");
      onReload();
    } catch { toast.error("Fehler"); }
  };

  return (
    <div data-testid="einsatz-detail">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">&larr; Zurueck</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{e.betreff || "Einsatz"}</h2>
          <p className="text-muted-foreground text-sm">{e.kunde_name} {e.reparaturgruppe ? `- ${e.reparaturgruppe}` : ""}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <Badge className={e.status === "aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>{e.status}</Badge>
            {e.material && <span>Material: {e.material}</span>}
            {e.monteur_name && <span>Monteur: {e.monteur_name}</span>}
            {e.summe_netto > 0 && <span className="font-semibold text-foreground">{Number(e.summe_netto).toLocaleString("de-DE", {minimumFractionDigits: 2})} EUR</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted"><Pencil className="w-3.5 h-3.5" /> Bearbeiten</button>
          <button
            onClick={openKundenmappe}
            disabled={kundenmappeBusy}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-sm text-sm hover:bg-violet-700 disabled:opacity-60"
            data-testid="btn-einsatz-kundenmappe-open"
            title="Kundenmappe (Mitarbeiter-Link) in neuem Tab öffnen"
          >
            <BookOpen className="w-3.5 h-3.5" /> {kundenmappeBusy ? "Lädt…" : "Kundenmappe"}
          </button>
          <button
            onClick={sendKundenmappeMail}
            disabled={mailLinkBusy}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-sm text-sm hover:bg-slate-800 disabled:opacity-60"
            data-testid="btn-einsatz-kundenmappe-mail"
            title="Kundenmappe per Mail an den zugewiesenen Monteur senden"
          >
            <Send className="w-3.5 h-3.5" /> {mailLinkBusy ? "Sende…" : "Mappe per Mail"}
          </button>
          {e.kunde_email && <button onClick={() => setShowMailPanel(!showMailPanel)} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted"><Send className="w-3.5 h-3.5" /> E-Mail</button>}
          <button onClick={() => setShowTerminPanel(!showTerminPanel)} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted"><Calendar className="w-3.5 h-3.5" /> Termin</button>
          <button onClick={() => downloadPdf(false)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm hover:bg-primary/90" data-testid="btn-pdf-filled"><Printer className="w-3.5 h-3.5" /> Reparaturauftrag</button>
          <button onClick={() => downloadPdf(true)} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted" data-testid="btn-pdf-blanko"><FileText className="w-3.5 h-3.5" /> Blanko-Formular</button>
        </div>
      </div>

      {/* E-Mail Panel */}
      {showMailPanel && (
        <Card className="p-4 mb-4 border-blue-200" data-testid="einsatz-mail-panel">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Send className="w-4 h-4 text-blue-600" /> E-Mail an {e.kunde_name}</h3>
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Textvorlage waehlen</label>
            <div className="flex gap-1 flex-wrap">
              {mailVorlagen.map(v => (
                <button key={v.id} onClick={() => applyMailVorlage(v)} className="px-2 py-1 text-xs border rounded-sm hover:bg-blue-50 hover:border-blue-300">{v.title}</button>
              ))}
            </div>
          </div>
          <input value={mailBetreff} onChange={(ev) => setMailBetreff(ev.target.value)} placeholder="Betreff..." className="w-full border rounded-sm p-2 text-sm mb-2" data-testid="einsatz-mail-subject" />
          <textarea value={mailText} onChange={(ev) => setMailText(ev.target.value)} placeholder="Nachricht..." className="w-full border rounded-sm p-2 text-sm min-h-[120px] resize-y mb-3" data-testid="einsatz-mail-text" />
          <div className="flex gap-2 justify-end">
            <button onClick={openMailto} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted" title="In Betterbird/Thunderbird oeffnen"><Mail className="w-3.5 h-3.5" /> Mailprogramm</button>
            <button onClick={sendMail} disabled={sendingMail} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-sm text-sm hover:bg-blue-700 disabled:opacity-50" data-testid="btn-send-einsatz-mail">
              <Send className="w-3.5 h-3.5" /> {sendingMail ? "Sende..." : "Direkt senden"}
            </button>
          </div>
        </Card>
      )}

      {/* Termin Panel */}
      {showTerminPanel && (
        <Card className="p-4 mb-4 border-green-200" data-testid="einsatz-termin-panel">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-green-600" /> Termin planen</h3>
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Termintext-Vorlage</label>
            <div className="flex gap-1 flex-wrap">
              {terminVorlagen.map(v => (
                <button key={v.id} onClick={() => applyTerminVorlage(v)} className="px-2 py-1 text-xs border rounded-sm hover:bg-green-50 hover:border-green-300">{v.title}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Datum & Uhrzeit</label>
              <input type="datetime-local" value={terminDatum} onChange={(ev) => setTerminDatum(ev.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="einsatz-termin-datum" />
            </div>
          </div>
          <textarea value={terminText} onChange={(ev) => setTerminText(ev.target.value)} placeholder="Termindetails..." className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-y mb-3" data-testid="einsatz-termin-text" />
          <div className="flex gap-2 justify-end">
            <button onClick={downloadIcs} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted"><Download className="w-3.5 h-3.5" /> ICS-Datei</button>
            <button onClick={openGoogleCalendar} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-sm text-sm hover:bg-green-700" data-testid="btn-google-calendar">
              <Calendar className="w-3.5 h-3.5" /> An Google Kalender
            </button>
          </div>
        </Card>
      )}

      {/* Kontaktdaten */}
      <Card className="p-4 mb-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Kontaktdaten</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div><span className="text-xs text-muted-foreground block">Name</span>{e.kunde_name || "-"}</div>
          <div><span className="text-xs text-muted-foreground block">E-Mail</span>{e.kunde_email ? <a href={`mailto:${e.kunde_email}`} className="text-primary hover:underline">{e.kunde_email}</a> : "-"}</div>
          <div><span className="text-xs text-muted-foreground block">Telefon</span>{e.kunde_telefon ? <a href={`tel:${e.kunde_telefon}`} className="text-primary hover:underline">{e.kunde_telefon}</a> : "-"}</div>
          <div><span className="text-xs text-muted-foreground block">Adresse</span>{e.kunde_adresse || "-"}</div>
        </div>
        {(e.objekt_strasse || e.objekt_ort) && (
          <div className="mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground block mb-1">Objektadresse</span>
            <span className="text-sm">{[e.objekt_strasse, e.objekt_plz, e.objekt_ort].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </Card>

      {/* Beschreibung */}
      {(e.beschreibung || e.bemerkungen) && (
        <Card className="p-4 mb-4">
          <h3 className="font-semibold mb-2">Beschreibung</h3>
          {e.beschreibung && <p className="text-sm whitespace-pre-wrap mb-2">{e.beschreibung}</p>}
          {e.bemerkungen && <><h4 className="text-xs font-semibold text-muted-foreground mt-3 mb-1">Bemerkungen</h4><p className="text-sm whitespace-pre-wrap">{e.bemerkungen}</p></>}
        </Card>
      )}

      {/* Bilder (kategorisiert) */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Bilder ({bilder.length})</h3>
          <label className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm cursor-pointer hover:bg-muted">
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Lade..." : "Bild hochladen"}
            <input type="file" className="hidden" accept="image/*" onChange={uploadBild} disabled={uploading} />
          </label>
        </div>
        <div className="flex gap-1 mb-3 flex-wrap">
          <button onClick={() => setBildKat("")} className={`px-2 py-1 rounded text-xs ${!bildKat ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}>Alle ({bilder.length})</button>
          {Object.entries(BILD_KAT_LABELS).map(([key, label]) => katCounts[key] ? (
            <button key={key} onClick={() => setBildKat(key)} className={`px-2 py-1 rounded text-xs ${bildKat === key ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}>{label} ({katCounts[key]})</button>
          ) : null)}
        </div>
        {filteredBilder.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Keine Bilder{bildKat ? ` in "${BILD_KAT_LABELS[bildKat]}"` : ""}</p>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
            {filteredBilder.map(b => (
              <div key={b.id} className="relative group border rounded overflow-hidden">
                <img src={b.url} alt={b.filename} className="w-full h-24 object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <button onClick={() => deleteBild(b.id)} className="opacity-0 group-hover:opacity-100 p-1 bg-red-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                </div>
                <div className="px-1 py-0.5 text-[10px] text-muted-foreground truncate">{BILD_KAT_LABELS[b.kategorie] || b.kategorie}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};


// ==================== FORM ====================
const EinsatzForm = ({ item, config, mitarbeiter, selectedTarget, onClose, onSaved }) => {
  const [form, setForm] = useState({
    betreff: "", beschreibung: "", bemerkungen: "", nachricht_kunde: "",
    kunde_name: "", kunde_email: "", kunde_telefon: "", kunde_adresse: "",
    objekt_strasse: "", objekt_plz: "", objekt_ort: "",
    reparaturgruppe: "", material: "", kategorien: [],
    monteur_id: "", monteur_name: "", monteur2_id: "", monteur2_name: "",
    verantwortlich: "",
    summe_netto: 0, mwst_satz: 19, summe_brutto: 0,
    status: "aktiv", prioritaet: "normal",
    startdatum: "", enddatum: "", termin: "", termin_text: "",
  });
  const [saving, setSaving] = useState(false);
  const [kunden, setKunden] = useState([]);
  const [kontakte, setKontakte] = useState([]);
  const [nameSearch, setNameSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        betreff: item.betreff || "", beschreibung: item.beschreibung || "",
        bemerkungen: item.bemerkungen || "", nachricht_kunde: item.nachricht_kunde || "",
        kunde_name: item.kunde_name || item.customer_name || "",
        kunde_email: item.kunde_email || "", kunde_telefon: item.kunde_telefon || "",
        kunde_adresse: item.kunde_adresse || "",
        objekt_strasse: item.objekt_strasse || "", objekt_plz: item.objekt_plz || "", objekt_ort: item.objekt_ort || "",
        reparaturgruppe: item.reparaturgruppe || "", material: item.material || "",
        kategorien: item.kategorien || [],
        monteur_id: item.monteur_id || "", monteur_name: item.monteur_name || "",
        monteur2_id: item.monteur2_id || "", monteur2_name: item.monteur2_name || "",
        verantwortlich: item.verantwortlich || "",
        summe_netto: item.summe_netto || 0, mwst_satz: item.mwst_satz || 19,
        summe_brutto: item.summe_brutto || 0,
        status: item.status || "aktiv", prioritaet: item.prioritaet || "normal",
        startdatum: item.startdatum || "", enddatum: item.enddatum || "",
        termin: item.termin || "", termin_text: item.termin_text || "",
      });
    }
    Promise.all([
      api.get("/modules/kunden/data"),
      api.get("/modules/kontakt/data")
    ]).then(([kRes, koRes]) => {
      setKunden(kRes.data);
      setKontakte(koRes.data);
      // Beim Anlegen mit selectedTarget=Kunde: kunde_id + Felder aus Kundendaten vorbefüllen
      if (!item && selectedTarget?.type === "kunde") {
        const k = (kRes.data || []).find(x => x.id === selectedTarget.id);
        if (k) {
          const nm = k.vorname || k.nachname ? `${k.vorname || ""} ${k.nachname || ""}`.trim() : (k.firma || "");
          setForm(f => ({
            ...f,
            kunde_id: k.id,
            kunde_name: nm,
            kunde_email: k.email || "",
            kunde_telefon: k.telefon || "",
            kunde_adresse: [k.strasse, k.plz && `${k.plz} ${k.ort || ""}`].filter(Boolean).join(", "),
            objekt_strasse: k.strasse || "",
            objekt_plz: k.plz || "",
            objekt_ort: k.ort || "",
          }));
        }
      }
    }).catch(() => {});
  }, [item, selectedTarget]);

  // Live-Suche in Kunden + Kontakte
  const suggestions = (() => {
    const term = (nameSearch || form.kunde_name).toLowerCase().trim();
    if (!term || term.length < 1) return [];
    const results = [];
    kunden.forEach(k => {
      const nm = k.vorname || k.nachname ? `${k.vorname || ""} ${k.nachname || ""}`.trim() : (k.name || "");
      if (nm.toLowerCase().includes(term) || (k.firma || "").toLowerCase().includes(term) || (k.email || "").toLowerCase().includes(term)) {
        results.push({ ...k, _displayName: nm, _source: "Kunde", _sourceColor: "text-blue-600 bg-blue-50" });
      }
    });
    kontakte.forEach(k => {
      const nm = k.vorname || k.nachname ? `${k.vorname || ""} ${k.nachname || ""}`.trim() : (k.name || "");
      const cats = (k.categories || []).join(" ").toLowerCase();
      const nachricht = (k.nachricht || k.notes || "").toLowerCase();
      if (nm.toLowerCase().includes(term) || (k.firma || "").toLowerCase().includes(term) || (k.email || "").toLowerCase().includes(term) || cats.includes(term) || nachricht.includes(term)) {
        results.push({ ...k, _displayName: nm, _source: "Kontakt", _sourceColor: "text-orange-600 bg-orange-50" });
      }
    });
    return results.slice(0, 8);
  })();

  const selectPerson = (p) => {
    const addr = p.address || [p.strasse, p.hausnummer, p.plz, p.ort].filter(Boolean).join(", ");
    setForm(f => ({
      ...f,
      kunde_name: p._displayName,
      kunde_email: p.email || "",
      kunde_telefon: p.phone || "",
      kunde_adresse: addr,
      objekt_strasse: p.strasse || "",
      objekt_plz: p.plz || "",
      objekt_ort: p.ort || "",
      beschreibung: f.beschreibung || p.notes || p.nachricht || "",
      betreff: f.betreff || (p._source === "Kontakt" ? `Anfrage von ${p._displayName}` : ""),
    }));
    setNameSearch("");
    setShowSuggestions(false);
  };

  const selectMonteur = (m, nr) => {
    const name = `${m.vorname} ${m.nachname}`.trim();
    if (nr === 1) setForm(f => ({ ...f, monteur_id: m.id, monteur_name: name }));
    else setForm(f => ({ ...f, monteur2_id: m.id, monteur2_name: name }));
  };

  const calcBrutto = (netto, mwst) => Number((netto * (1 + mwst / 100)).toFixed(2));

  const save = async () => {
    if (!form.betreff.trim() && !form.kunde_name.trim()) { toast.error("Betreff oder Kundenname erforderlich"); return; }
    setSaving(true);
    try {
      const payload = { ...form, summe_brutto: calcBrutto(form.summe_netto, form.mwst_satz) };
      if (item) {
        await api.put(`/einsaetze/${item.id}`, payload);
        toast.success("Gespeichert");
      } else {
        await api.post("/einsaetze", payload);
        toast.success("Einsatz erstellt");
      }
      onSaved();
    } catch { toast.error("Fehler"); }
    finally { setSaving(false); }
  };

  const upd = (name, value) => setForm(f => ({ ...f, [name]: value }));

  const inp = (label, name, placeholder, type = "text", step) => (
    <div>
      <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
      {type === "textarea" ? (
        <textarea value={form[name]} onChange={e => upd(name, e.target.value)} className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-y" placeholder={placeholder} data-testid={`einsatz-field-${name}`} />
      ) : (
        <input type={type} value={form[name]} onChange={e => upd(name, type === "number" ? Number(e.target.value) : e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder={placeholder} step={step} data-testid={`einsatz-field-${name}`} />
      )}
    </div>
  );

  const sel = (label, name, options) => (
    <div>
      <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
      <select value={form[name]} onChange={e => upd(name, e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid={`einsatz-field-${name}`}>
        <option value="">-- Bitte waehlen --</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="einsatz-form-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{item ? "Einsatz bearbeiten" : "Neuer Einsatz"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Kunde */}
          <div className="border rounded-sm p-3">
            <h3 className="text-sm font-semibold mb-2">Kunde</h3>
            <div className="relative mb-3">
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Name (Suche in Kunden & Kontakte)</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  value={showSuggestions ? nameSearch : form.kunde_name}
                  onChange={e => { setNameSearch(e.target.value); upd("kunde_name", e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full border rounded-sm p-2 pl-9 text-sm"
                  placeholder="Name eingeben oder suchen..."
                  data-testid="einsatz-field-kunde_name"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-sm shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((p, i) => (
                    <button key={`${p._source}-${p.id}-${i}`} onClick={() => selectPerson(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{p._displayName}</span>
                        {p.firma && <span className="text-muted-foreground ml-1">({p.firma})</span>}
                        {p.email && <span className="text-xs text-muted-foreground block truncate">{p.email}</span>}
                        {(p.categories || []).length > 0 && (
                          <span className="flex gap-1 mt-0.5 flex-wrap">{p.categories.map((c, ci) => <span key={ci} className="text-[10px] px-1 py-0 bg-primary/10 text-primary rounded">{c}</span>)}</span>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${p._sourceColor}`}>{p._source}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {inp("E-Mail", "kunde_email", "email@example.de", "email")}
              {inp("Telefon", "kunde_telefon", "040-123456")}
              {inp("Adresse", "kunde_adresse", "Strasse, PLZ Ort")}
            </div>
          </div>

          {/* Objektadresse */}
          <div className="grid grid-cols-3 gap-3">
            {inp("Objekt Strasse", "objekt_strasse", "Musterstr. 1")}
            {inp("PLZ", "objekt_plz", "22453")}
            {inp("Ort", "objekt_ort", "Hamburg")}
          </div>

          {/* Anfrage */}
          <TitleInputWithVorlagen
            value={form.betreff}
            onChange={(v) => setForm(f => ({ ...f, betreff: v }))}
            docType="einsatz_betreff"
            fallbackDocTypes={["einsatz"]}
            label="Betreff"
            placeholder="z.B. Schiebetuer-Reparatur"
            testId="input-einsatz-betreff"
          />
          {inp("Beschreibung (Kundentext)", "beschreibung", "Anfrage-Text des Kunden...", "textarea")}
          {inp("Bemerkungen / Anmerkungen", "bemerkungen", "Interne Notizen...", "textarea")}

          {/* Kategorisierung */}
          <div className="grid grid-cols-2 gap-3">
            {sel("Reparaturgruppe", "reparaturgruppe", config.reparaturgruppen || [])}
            {sel("Material", "material", config.materialien || [])}
          </div>

          {/* Monteure */}
          <div className="border rounded-sm p-3">
            <h3 className="text-sm font-semibold mb-2">Monteur-Zuweisung</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">1. Monteur</label>
                <select value={form.monteur_id} onChange={(e) => { const m = mitarbeiter.find(x => x.id === e.target.value); if (m) selectMonteur(m, 1); else setForm(f => ({...f, monteur_id: "", monteur_name: ""})); }} className="w-full border rounded-sm p-2 text-sm" data-testid="einsatz-field-monteur1">
                  <option value="">-- Monteur waehlen --</option>
                  {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname} ({m.position || "Mitarbeiter"})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">2. Monteur</label>
                <select value={form.monteur2_id} onChange={(e) => { const m = mitarbeiter.find(x => x.id === e.target.value); if (m) selectMonteur(m, 2); else setForm(f => ({...f, monteur2_id: "", monteur2_name: ""})); }} className="w-full border rounded-sm p-2 text-sm" data-testid="einsatz-field-monteur2">
                  <option value="">-- Optional --</option>
                  {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              {inp("Verantwortlich", "verantwortlich", "Wer ist zustaendig?")}
            </div>
          </div>

          {/* Finanzen */}
          <div className="grid grid-cols-3 gap-3">
            {inp("Summe Netto (EUR)", "summe_netto", "", "number", "0.01")}
            {inp("MwSt. (%)", "mwst_satz", "", "number")}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Brutto (EUR)</label>
              <div className="w-full border rounded-sm p-2 text-sm bg-muted">{calcBrutto(form.summe_netto, form.mwst_satz).toLocaleString("de-DE", {minimumFractionDigits: 2})}</div>
            </div>
          </div>

          {/* Status & Termine */}
          <div className="grid grid-cols-3 gap-3">
            {sel("Status", "status", ["aktiv", "in_bearbeitung", "abgeschlossen", "inaktiv"])}
            {sel("Prioritaet", "prioritaet", config.prioritaeten || ["niedrig", "normal", "hoch", "dringend"])}
            {inp("Termin", "termin", "", "datetime-local")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {inp("Startdatum", "startdatum", "", "date")}
            {inp("Enddatum", "enddatum", "", "date")}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50" data-testid="btn-save-einsatz">
            {saving ? "Speichere..." : item ? "Speichern" : "Einsatz erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
};

export { EinsaetzeModulPage };
