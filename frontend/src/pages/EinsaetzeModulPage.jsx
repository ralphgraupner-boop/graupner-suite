import { useState, useEffect, useCallback } from "react";
import { Wrench, Plus, Search, Pencil, Trash2, X, User, Phone, Mail, MapPin, Calendar, Clock, Upload, Image as ImageIcon, Send, Download, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";

const BILD_KAT_LABELS = {
  kundenanfrage: "Kundenanfrage", besichtigung: "Besichtigung",
  waehrend_arbeit: "Waehrend Arbeit", abnahme: "Abnahme",
  hinweise: "Hinweise", sonstiges: "Sonstiges"
};

const EinsaetzeModulPage = () => {
  const [einsaetze, setEinsaetze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("aktiv");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [config, setConfig] = useState({ reparaturgruppen: [], materialien: [], bild_kategorien: [], prioritaeten: [] });
  const [mitarbeiter, setMitarbeiter] = useState([]);

  const load = useCallback(async () => {
    try {
      const [res, cfgRes, maRes] = await Promise.all([
        api.get(`/einsaetze?status=${statusFilter}`),
        api.get("/einsatz-config"),
        api.get("/mitarbeiter")
      ]);
      setEinsaetze(res.data);
      setConfig(cfgRes.data);
      setMitarbeiter(maRes.data.filter(m => m.status === "aktiv"));
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = einsaetze.filter(e => {
    const t = search.toLowerCase();
    return !t ||
      (e.kunde_name || e.customer_name || "").toLowerCase().includes(t) ||
      (e.betreff || "").toLowerCase().includes(t) ||
      (e.reparaturgruppe || "").toLowerCase().includes(t) ||
      (e.monteur_name || "").toLowerCase().includes(t);
  });

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Einsaetze</h1>
          <p className="text-muted-foreground mt-1 text-sm">{einsaetze.length} Einsaetze</p>
        </div>
        <button onClick={() => { setSelected(null); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium hover:bg-primary/90" data-testid="btn-new-einsatz">
          <Plus className="w-4 h-4" /> Neuer Einsatz
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen nach Kunde, Betreff, Reparaturgruppe..." className="w-full pl-10 pr-4 py-2 border rounded-sm text-sm" data-testid="einsatz-search" />
        </div>
        <div className="flex border rounded-sm overflow-hidden text-sm">
          {["aktiv", "inaktiv", ""].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 ${statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {s === "" ? "Alle" : s === "aktiv" ? "Aktiv" : "Inaktiv"}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <EinsatzForm
          item={selected}
          config={config}
          mitarbeiter={mitarbeiter}
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
          {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground">Keine Einsaetze gefunden.</Card>}
          {filtered.map((e) => (
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
          ))}
        </div>
      )}
    </div>
  );
};


// ==================== DETAIL VIEW ====================
const EinsatzDetail = ({ einsatz, config, mitarbeiter, onBack, onEdit, onReload }) => {
  const [bildKat, setBildKat] = useState("");
  const [uploading, setUploading] = useState(false);
  const e = einsatz;
  const bilder = e.bilder || [];
  const filteredBilder = bildKat ? bilder.filter(b => b.kategorie === bildKat) : bilder;
  const katCounts = {};
  bilder.forEach(b => { katCounts[b.kategorie] = (katCounts[b.kategorie] || 0) + 1; });

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

  const openMailto = () => {
    const subject = encodeURIComponent(e.betreff || "");
    const body = encodeURIComponent(e.beschreibung || "");
    window.location.href = `mailto:${e.kunde_email}?subject=${subject}&body=${body}`;
  };

  const downloadIcs = () => {
    const token = localStorage.getItem("token");
    window.open(`${API}/einsaetze/${e.id}/ics?token=${token}`, "_blank");
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
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted"><Pencil className="w-3.5 h-3.5" /> Bearbeiten</button>
          {e.kunde_email && <button onClick={openMailto} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted"><Send className="w-3.5 h-3.5" /> E-Mail</button>}
          {e.termin && <button onClick={downloadIcs} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted"><Download className="w-3.5 h-3.5" /> Termin (.ics)</button>}
        </div>
      </div>

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
const EinsatzForm = ({ item, config, mitarbeiter, onClose, onSaved }) => {
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
  const [showKundenSelect, setShowKundenSelect] = useState(false);

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
    api.get("/modules/kunden/data").then(r => setKunden(r.data)).catch(() => {});
  }, [item]);

  const selectKunde = (k) => {
    const name = k.vorname || k.nachname ? `${k.vorname || ""} ${k.nachname || ""}`.trim() : (k.name || "");
    const addr = k.address || [k.strasse, k.hausnummer, k.plz, k.ort].filter(Boolean).join(", ");
    setForm(f => ({ ...f, kunde_name: name, kunde_email: k.email || "", kunde_telefon: k.phone || "", kunde_adresse: addr, objekt_strasse: k.strasse || "", objekt_plz: k.plz || "", objekt_ort: k.ort || "" }));
    setShowKundenSelect(false);
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

  const F = ({ label, name, type = "text", ...props }) => (
    <div className={props.className || ""}>
      <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
      {type === "select" ? (
        <select value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} className="w-full border rounded-sm p-2 text-sm" data-testid={`einsatz-field-${name}`}>
          <option value="">-- Bitte waehlen --</option>
          {(props.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-y" placeholder={props.placeholder} data-testid={`einsatz-field-${name}`} />
      ) : (
        <input type={type} value={form[name]} onChange={(e) => setForm({ ...form, [name]: type === "number" ? Number(e.target.value) : e.target.value })} className="w-full border rounded-sm p-2 text-sm" placeholder={props.placeholder} step={props.step} data-testid={`einsatz-field-${name}`} />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" data-testid="einsatz-form-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{item ? "Einsatz bearbeiten" : "Neuer Einsatz"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Kunde */}
          <div className="border rounded-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Kunde</h3>
              <button onClick={() => setShowKundenSelect(!showKundenSelect)} className="text-xs text-primary hover:underline">Aus Kunden-Modul waehlen</button>
            </div>
            {showKundenSelect && (
              <div className="mb-3 border rounded-sm max-h-32 overflow-y-auto">
                {kunden.map(k => {
                  const nm = k.vorname || k.nachname ? `${k.vorname || ""} ${k.nachname || ""}`.trim() : (k.name || "");
                  return <button key={k.id} onClick={() => selectKunde(k)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0">{nm} {k.firma ? `(${k.firma})` : ""}</button>;
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <F label="Name" name="kunde_name" placeholder="Kundenname" />
              <F label="E-Mail" name="kunde_email" type="email" placeholder="email@example.de" />
              <F label="Telefon" name="kunde_telefon" placeholder="040-123456" />
              <F label="Adresse" name="kunde_adresse" placeholder="Strasse, PLZ Ort" />
            </div>
          </div>

          {/* Objektadresse */}
          <div className="grid grid-cols-3 gap-3">
            <F label="Objekt Strasse" name="objekt_strasse" placeholder="Musterstr. 1" />
            <F label="PLZ" name="objekt_plz" placeholder="22453" />
            <F label="Ort" name="objekt_ort" placeholder="Hamburg" />
          </div>

          {/* Anfrage */}
          <F label="Betreff" name="betreff" placeholder="z.B. Schiebetuer-Reparatur" />
          <F label="Beschreibung (Kundentext)" name="beschreibung" type="textarea" placeholder="Anfrage-Text des Kunden..." />
          <F label="Bemerkungen / Anmerkungen" name="bemerkungen" type="textarea" placeholder="Interne Notizen..." />

          {/* Kategorisierung */}
          <div className="grid grid-cols-2 gap-3">
            <F label="Reparaturgruppe" name="reparaturgruppe" type="select" options={config.reparaturgruppen || []} />
            <F label="Material" name="material" type="select" options={config.materialien || []} />
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
            <F label="Verantwortlich" name="verantwortlich" placeholder="Wer ist zustaendig?" className="mt-3" />
          </div>

          {/* Finanzen */}
          <div className="grid grid-cols-3 gap-3">
            <F label="Summe Netto (EUR)" name="summe_netto" type="number" step="0.01" />
            <F label="MwSt. (%)" name="mwst_satz" type="number" />
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Brutto (EUR)</label>
              <div className="w-full border rounded-sm p-2 text-sm bg-muted">{calcBrutto(form.summe_netto, form.mwst_satz).toLocaleString("de-DE", {minimumFractionDigits: 2})}</div>
            </div>
          </div>

          {/* Status & Termine */}
          <div className="grid grid-cols-3 gap-3">
            <F label="Status" name="status" type="select" options={["aktiv", "in_bearbeitung", "abgeschlossen", "inaktiv"]} />
            <F label="Prioritaet" name="prioritaet" type="select" options={config.prioritaeten || ["niedrig", "normal", "hoch", "dringend"]} />
            <F label="Termin" name="termin" type="datetime-local" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Startdatum" name="startdatum" type="date" />
            <F label="Enddatum" name="enddatum" type="date" />
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
