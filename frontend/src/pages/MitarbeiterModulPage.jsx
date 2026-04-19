import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Pencil, Trash2, Search, Phone, Mail, X, UserCheck, Clock, ArrowLeft, Calendar, Heart, FileText, Banknote, Briefcase, GraduationCap, AlertCircle, Upload, Download, Cake } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { KRANKENKASSEN, STEUERKLASSEN, KONFESSIONEN, BESCHAEFTIGUNGSARTEN, DOKUMENT_KATEGORIEN } from "@/data/krankenkassen";

// Helper: calc age from birthdate
const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

// Helper: days until next birthday
const daysToBirthday = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  const today = new Date();
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
};

const MitarbeiterModulPage = () => {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list"); // list | detail
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("aktiv");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mitarbeiter");
      setMitarbeiter(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = mitarbeiter.filter(m => {
    if (statusFilter !== "alle" && (m.status || "aktiv") !== statusFilter) return false;
    const term = search.toLowerCase();
    return !term ||
      (m.vorname || "").toLowerCase().includes(term) ||
      (m.nachname || "").toLowerCase().includes(term) ||
      (m.position || "").toLowerCase().includes(term) ||
      (m.personalnummer || "").includes(term);
  });

  // Dashboard Metrics
  const stats = {
    total: mitarbeiter.length,
    aktiv: mitarbeiter.filter(m => (m.status || "aktiv") === "aktiv").length,
    birthdaysSoon: mitarbeiter.filter(m => {
      const d = daysToBirthday(m.geburtsdatum);
      return d !== null && d <= 30;
    }).length,
  };

  if (view === "detail" && selected) {
    return <MitarbeiterDetail
      mitarbeiter={selected}
      onBack={() => { setView("list"); setSelected(null); load(); }}
      onUpdate={(updated) => setSelected(updated)}
    />;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto" data-testid="mitarbeiter-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Mitarbeiter</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {stats.aktiv} aktiv · {stats.total} gesamt
            {stats.birthdaysSoon > 0 && <span className="ml-3 inline-flex items-center gap-1 text-pink-600"><Cake className="w-3 h-3" /> {stats.birthdaysSoon} Geburtstage in 30 Tagen</span>}
          </p>
        </div>
        <button onClick={() => { setSelected(null); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium hover:bg-primary/90" data-testid="btn-new-mitarbeiter">
          <Plus className="w-4 h-4" /> Neuer Mitarbeiter
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["aktiv", "inaktiv", "alle"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {s === "aktiv" ? "Aktiv" : s === "inaktiv" ? "Inaktiv" : "Alle"} ({s === "alle" ? stats.total : s === "aktiv" ? stats.aktiv : stats.total - stats.aktiv})
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen nach Name, Position, Personalnr..." className="w-full pl-10 pr-4 py-2 border rounded-sm text-sm" data-testid="mitarbeiter-search" />
      </div>

      {showForm && (
        <MitarbeiterQuickForm
          onClose={() => setShowForm(false)}
          onSaved={(created) => { setShowForm(false); load(); if (created) { setSelected(created); setView("detail"); } }}
        />
      )}

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Keine Mitarbeiter gefunden.
          </Card>
        )}
        {filtered.map((m) => {
          const bdayIn = daysToBirthday(m.geburtsdatum);
          return (
            <Card key={m.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelected(m); setView("detail"); }} data-testid={`ma-card-${m.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {(m.vorname || "?").charAt(0)}{(m.nachname || "?").charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="font-semibold truncate">{m.vorname} {m.nachname}</h3>
                      <Badge className={(m.status || "aktiv") === "aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>{m.status || "aktiv"}</Badge>
                      {bdayIn !== null && bdayIn <= 30 && (
                        <span className="text-xs inline-flex items-center gap-0.5 text-pink-600"><Cake className="w-3 h-3" />in {bdayIn}d</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {m.position && <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{m.position}</span>}
                      {m.personalnummer && <span>Nr. {m.personalnummer}</span>}
                      {m.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.telefon}</span>}
                      {m.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</span>}
                      {m.wochenstunden > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.wochenstunden}h/Wo</span>}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-primary font-medium">Öffnen →</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ==================== QUICK FORM (Neu anlegen) ====================
const MitarbeiterQuickForm = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ anrede: "Herr", vorname: "", nachname: "", position: "", personalnummer: "", telefon: "", email: "", eintrittsdatum: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.vorname.trim() || !form.nachname.trim()) { toast.error("Vor- und Nachname erforderlich"); return; }
    setSaving(true);
    try {
      const res = await api.post("/mitarbeiter", form);
      toast.success("Mitarbeiter angelegt");
      onSaved(res.data);
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setSaving(false); }
  };

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="mitarbeiter-quickform">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Neuer Mitarbeiter</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Nur Pflichtfelder – alle weiteren Daten nach Anlegen im Detail.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Anrede</label>
              <select value={form.anrede} onChange={e => upd("anrede", e.target.value)} className="w-full border rounded-sm p-2 text-sm">
                <option value="Herr">Herr</option><option value="Frau">Frau</option><option value="Divers">Divers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Vorname *</label>
              <input value={form.vorname} onChange={e => upd("vorname", e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="qf-vorname" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nachname *</label>
              <input value={form.nachname} onChange={e => upd("nachname", e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="qf-nachname" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Position</label>
              <input value={form.position} onChange={e => upd("position", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="z.B. Tischler" />
            </div>
            <div><label className="block text-xs font-medium mb-1">Personalnr.</label>
              <input value={form.personalnummer} onChange={e => upd("personalnummer", e.target.value)} className="w-full border rounded-sm p-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Telefon</label>
              <input value={form.telefon} onChange={e => upd("telefon", e.target.value)} className="w-full border rounded-sm p-2 text-sm" />
            </div>
            <div><label className="block text-xs font-medium mb-1">E-Mail</label>
              <input value={form.email} onChange={e => upd("email", e.target.value)} className="w-full border rounded-sm p-2 text-sm" />
            </div>
          </div>
          <div><label className="block text-xs font-medium mb-1">Eintrittsdatum</label>
            <input type="date" value={form.eintrittsdatum} onChange={e => upd("eintrittsdatum", e.target.value)} className="w-full border rounded-sm p-2 text-sm" />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50" data-testid="btn-save-quickform">
            {saving ? "Anlege..." : "Anlegen & öffnen"}
          </button>
        </div>
      </div>
    </div>
  );
};


// ==================== DETAIL (Tab-Ansicht) ====================
const MitarbeiterDetail = ({ mitarbeiter, onBack, onUpdate }) => {
  const [data, setData] = useState(mitarbeiter);
  const [tab, setTab] = useState("stamm");

  // Save helpers - used by every tab
  const save = async (partial) => {
    try {
      await api.put(`/mitarbeiter/${data.id}`, partial);
      const newData = { ...data, ...partial };
      setData(newData);
      onUpdate(newData);
      toast.success("Gespeichert");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler beim Speichern");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${data.vorname} ${data.nachname} wirklich unwiderruflich löschen? Alle Urlaube, Krankmeldungen und Dokumente gehen verloren.`)) return;
    try {
      await api.delete(`/mitarbeiter/${data.id}`);
      toast.success("Mitarbeiter gelöscht");
      onBack();
    } catch { toast.error("Fehler"); }
  };

  const age = calcAge(data.geburtsdatum);

  return (
    <div className="max-w-7xl mx-auto" data-testid="mitarbeiter-detail">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="btn-back-list">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Liste
        </button>
        <button onClick={handleDelete} className="text-xs text-red-600 hover:underline" data-testid="btn-delete-ma">
          Mitarbeiter löschen
        </button>
      </div>

      <Card className="p-5 mb-4 bg-gradient-to-r from-primary/5 to-background">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
            {(data.vorname || "?").charAt(0)}{(data.nachname || "?").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-xl font-bold">{data.anrede} {data.vorname} {data.nachname}</h2>
              <Badge className={(data.status || "aktiv") === "aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>{data.status || "aktiv"}</Badge>
              {data.personalnummer && <span className="text-xs font-mono text-muted-foreground">Nr. {data.personalnummer}</span>}
            </div>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
              {data.position && <span>{data.position}</span>}
              {age !== null && <span>{age} Jahre</span>}
              {data.eintrittsdatum && <span>seit {new Date(data.eintrittsdatum).toLocaleDateString("de-DE")}</span>}
              {data.wochenstunden > 0 && <span>{data.wochenstunden}h/Woche</span>}
            </div>
            <div className="flex gap-3 mt-2 text-xs">
              {data.email && <a href={`mailto:${data.email}`} className="text-blue-600 hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{data.email}</a>}
              {data.telefon && <a href={`tel:${data.telefon}`} className="text-blue-600 hover:underline flex items-center gap-1"><Phone className="w-3 h-3" />{data.telefon}</a>}
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto justify-start gap-1 bg-muted p-1" data-testid="ma-tabs">
          <TabsTrigger value="stamm" data-testid="tab-stamm">Stammdaten</TabsTrigger>
          <TabsTrigger value="beschaeftigung" data-testid="tab-beschaeftigung">Beschäftigung</TabsTrigger>
          <TabsTrigger value="steuer" data-testid="tab-steuer">Steuer & SV</TabsTrigger>
          <TabsTrigger value="bank" data-testid="tab-bank">Bank & Lohn</TabsTrigger>
          <TabsTrigger value="urlaub" data-testid="tab-urlaub">Urlaub</TabsTrigger>
          <TabsTrigger value="krank" data-testid="tab-krank">Krankmeldungen</TabsTrigger>
          <TabsTrigger value="vertraege" data-testid="tab-vertraege">Verträge & Dokumente</TabsTrigger>
          <TabsTrigger value="fortbildung" data-testid="tab-fortbildung">Fortbildungen</TabsTrigger>
          <TabsTrigger value="notfall" data-testid="tab-notfall">Notfall & Notizen</TabsTrigger>
        </TabsList>

        <TabsContent value="stamm"><TabStamm data={data} save={save} /></TabsContent>
        <TabsContent value="beschaeftigung"><TabBeschaeftigung data={data} save={save} /></TabsContent>
        <TabsContent value="steuer"><TabSteuer data={data} save={save} /></TabsContent>
        <TabsContent value="bank"><TabBank data={data} save={save} /></TabsContent>
        <TabsContent value="urlaub"><TabUrlaub maId={data.id} urlaubsanspruch={data.urlaubsanspruch} save={save} /></TabsContent>
        <TabsContent value="krank"><TabKrank maId={data.id} /></TabsContent>
        <TabsContent value="vertraege"><TabDokumente maId={data.id} /></TabsContent>
        <TabsContent value="fortbildung"><TabFortbildung maId={data.id} /></TabsContent>
        <TabsContent value="notfall"><TabNotfall data={data} save={save} /></TabsContent>
      </Tabs>
    </div>
  );
};

// ==================== TAB: STAMMDATEN ====================
const TabStamm = ({ data, save }) => {
  const [f, setF] = useState({
    anrede: data.anrede || "Herr", vorname: data.vorname || "", nachname: data.nachname || "",
    geburtsdatum: data.geburtsdatum || "", strasse: data.strasse || "", plz: data.plz || "",
    ort: data.ort || "", telefon: data.telefon || "", email: data.email || "",
  });
  const u = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Card className="p-5">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="Anrede"><select value={f.anrede} onChange={e => u("anrede", e.target.value)} className="w-full border rounded-sm p-2 text-sm"><option>Herr</option><option>Frau</option><option>Divers</option></select></Field>
        <Field label="Vorname"><input value={f.vorname} onChange={e => u("vorname", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Nachname"><input value={f.nachname} onChange={e => u("nachname", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Geburtsdatum"><input type="date" value={f.geburtsdatum} onChange={e => u("geburtsdatum", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Straße & Hausnr."><input value={f.strasse} onChange={e => u("strasse", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="PLZ"><input value={f.plz} onChange={e => u("plz", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Ort"><input value={f.ort} onChange={e => u("ort", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Telefon"><input value={f.telefon} onChange={e => u("telefon", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
      </div>
      <Field label="E-Mail"><input value={f.email} onChange={e => u("email", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
      <SaveBar onSave={() => save(f)} />
    </Card>
  );
};

// ==================== TAB: BESCHÄFTIGUNG ====================
const TabBeschaeftigung = ({ data, save }) => {
  const [f, setF] = useState({
    personalnummer: data.personalnummer || "", position: data.position || "",
    beschaeftigungsart: data.beschaeftigungsart || "Vollzeit",
    wochenstunden: data.wochenstunden || 40,
    eintrittsdatum: data.eintrittsdatum || "", austrittsdatum: data.austrittsdatum || "",
    status: data.status || "aktiv", fuehrerschein: data.fuehrerschein || "",
  });
  const u = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Personalnummer"><input value={f.personalnummer} onChange={e => u("personalnummer", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Position / Berufsbezeichnung"><input value={f.position} onChange={e => u("position", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="z.B. Tischlermeister" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Beschäftigungsart">
          <select value={f.beschaeftigungsart} onChange={e => u("beschaeftigungsart", e.target.value)} className="w-full border rounded-sm p-2 text-sm">
            {BESCHAEFTIGUNGSARTEN.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Wochenstunden"><input type="number" step="0.5" value={f.wochenstunden} onChange={e => u("wochenstunden", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="Eintrittsdatum"><input type="date" value={f.eintrittsdatum} onChange={e => u("eintrittsdatum", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Austrittsdatum (optional)"><input type="date" value={f.austrittsdatum} onChange={e => u("austrittsdatum", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Status">
          <select value={f.status} onChange={e => u("status", e.target.value)} className="w-full border rounded-sm p-2 text-sm">
            <option value="aktiv">aktiv</option><option value="inaktiv">inaktiv</option><option value="elternzeit">Elternzeit</option>
          </select>
        </Field>
      </div>
      <Field label="Führerscheinklassen"><input value={f.fuehrerschein} onChange={e => u("fuehrerschein", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="z.B. B, BE, C, C1E" /></Field>
      <SaveBar onSave={() => save(f)} />
    </Card>
  );
};

// ==================== TAB: STEUER & SV ====================
const TabSteuer = ({ data, save }) => {
  const [f, setF] = useState({
    steuer_id: data.steuer_id || "", sv_nummer: data.sv_nummer || "",
    krankenkasse: data.krankenkasse || "", steuerklasse: data.steuerklasse || "I",
    kinderfreibetraege: data.kinderfreibetraege || 0, konfession: data.konfession || "keine",
    personengruppe: data.personengruppe || "101 - Sozialversicherungspflichtig Beschäftigte ohne besondere Merkmale",
  });
  const u = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Steuer-ID (IdNr.)"><input value={f.steuer_id} onChange={e => u("steuer_id", e.target.value)} className="w-full border rounded-sm p-2 text-sm font-mono" placeholder="11-stellig" maxLength={11} /></Field>
        <Field label="Sozialversicherungsnummer"><input value={f.sv_nummer} onChange={e => u("sv_nummer", e.target.value)} className="w-full border rounded-sm p-2 text-sm font-mono" placeholder="12-stellig" /></Field>
      </div>
      <Field label={<span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> Krankenkasse</span>}>
        <select value={f.krankenkasse} onChange={e => u("krankenkasse", e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="select-krankenkasse">
          <option value="">— Bitte wählen —</option>
          <optgroup label="Gesetzlich">
            {KRANKENKASSEN.filter(k => k.art === "gesetzlich").map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
          </optgroup>
          <optgroup label="Privat">
            {KRANKENKASSEN.filter(k => k.art === "privat").map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
          </optgroup>
          <optgroup label="Andere">
            {KRANKENKASSEN.filter(k => k.art === "sonstige").map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
          </optgroup>
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3 mt-3 mb-3">
        <Field label="Steuerklasse">
          <select value={f.steuerklasse} onChange={e => u("steuerklasse", e.target.value)} className="w-full border rounded-sm p-2 text-sm">
            {STEUERKLASSEN.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Kinderfreibeträge"><input type="number" step="0.5" value={f.kinderfreibetraege} onChange={e => u("kinderfreibetraege", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Konfession">
          <select value={f.konfession} onChange={e => u("konfession", e.target.value)} className="w-full border rounded-sm p-2 text-sm">
            {KONFESSIONEN.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Personengruppenschlüssel">
        <input value={f.personengruppe} onChange={e => u("personengruppe", e.target.value)} className="w-full border rounded-sm p-2 text-sm" />
      </Field>
      <SaveBar onSave={() => save(f)} />
    </Card>
  );
};

// ==================== TAB: BANK & LOHN ====================
const TabBank = ({ data, save }) => {
  const [f, setF] = useState({
    iban: data.iban || "", bank: data.bank || "",
    lohnart: data.lohnart || "stundenlohn", stundenlohn: data.stundenlohn || 0,
    monatsgehalt: data.monatsgehalt || 0, vwl_betrag: data.vwl_betrag || 0,
    vwl_ag_anteil: data.vwl_ag_anteil || 0,
  });
  const [historie, setHistorie] = useState([]);
  const [newLohn, setNewLohn] = useState({ gueltig_ab: "", stundenlohn: 0, monatsgehalt: 0, grund: "" });
  const u = (k, v) => setF(x => ({ ...x, [k]: v }));

  const loadHistorie = useCallback(async () => {
    try {
      const res = await api.get(`/mitarbeiter/${data.id}/lohnhistorie`);
      setHistorie(res.data);
    } catch {}
  }, [data.id]);
  useEffect(() => { loadHistorie(); }, [loadHistorie]);

  const addLohn = async () => {
    if (!newLohn.gueltig_ab) { toast.error("Datum erforderlich"); return; }
    try {
      await api.post(`/mitarbeiter/${data.id}/lohnhistorie`, newLohn);
      toast.success("Lohn-Eintrag erstellt");
      setNewLohn({ gueltig_ab: "", stundenlohn: 0, monatsgehalt: 0, grund: "" });
      loadHistorie();
    } catch { toast.error("Fehler"); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Banknote className="w-4 h-4" /> Bankverbindung</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="IBAN"><input value={f.iban} onChange={e => u("iban", e.target.value)} className="w-full border rounded-sm p-2 text-sm font-mono" placeholder="DE00 0000 0000 0000 0000 00" /></Field>
          <Field label="Bank"><input value={f.bank} onChange={e => u("bank", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        </div>
        <h3 className="font-semibold mb-3 mt-5 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Lohn (aktuell)</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Field label="Lohnart">
            <select value={f.lohnart} onChange={e => u("lohnart", e.target.value)} className="w-full border rounded-sm p-2 text-sm">
              <option value="stundenlohn">Stundenlohn</option>
              <option value="gehalt">Monatsgehalt</option>
            </select>
          </Field>
          <Field label="Stundenlohn (€)"><input type="number" step="0.01" value={f.stundenlohn} onChange={e => u("stundenlohn", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" /></Field>
          <Field label="Monatsgehalt (€)"><input type="number" step="0.01" value={f.monatsgehalt} onChange={e => u("monatsgehalt", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="VWL-Betrag AN (€)"><input type="number" step="0.01" value={f.vwl_betrag} onChange={e => u("vwl_betrag", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" /></Field>
          <Field label="VWL AG-Anteil (€)"><input type="number" step="0.01" value={f.vwl_ag_anteil} onChange={e => u("vwl_ag_anteil", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" /></Field>
        </div>
        <SaveBar onSave={() => save(f)} />
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Lohnhistorie (Gehaltserhöhungen)</h3>
        <div className="border rounded-sm p-3 bg-muted/20 mb-3">
          <div className="grid grid-cols-4 gap-2 mb-2">
            <input type="date" value={newLohn.gueltig_ab} onChange={e => setNewLohn({...newLohn, gueltig_ab: e.target.value})} className="border rounded-sm p-2 text-sm" placeholder="Gültig ab" />
            <input type="number" step="0.01" value={newLohn.stundenlohn || ""} onChange={e => setNewLohn({...newLohn, stundenlohn: Number(e.target.value)})} className="border rounded-sm p-2 text-sm" placeholder="Std-Lohn" />
            <input type="number" step="0.01" value={newLohn.monatsgehalt || ""} onChange={e => setNewLohn({...newLohn, monatsgehalt: Number(e.target.value)})} className="border rounded-sm p-2 text-sm" placeholder="Gehalt" />
            <input value={newLohn.grund} onChange={e => setNewLohn({...newLohn, grund: e.target.value})} className="border rounded-sm p-2 text-sm" placeholder="Grund" />
          </div>
          <button onClick={addLohn} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-sm" data-testid="btn-add-lohn">+ Eintrag speichern</button>
        </div>
        {historie.length === 0 ? <p className="text-sm text-muted-foreground">Keine Historie vorhanden.</p> : (
          <div className="space-y-1">
            {historie.map(h => (
              <div key={h.id} className="flex items-center justify-between border-b py-2 text-sm">
                <div>
                  <span className="font-medium">{h.gueltig_ab ? new Date(h.gueltig_ab).toLocaleDateString("de-DE") : "—"}</span>
                  {h.grund && <span className="text-muted-foreground ml-2">({h.grund})</span>}
                </div>
                <div className="font-mono">
                  {h.stundenlohn > 0 && `${h.stundenlohn.toFixed(2)} €/h`}
                  {h.monatsgehalt > 0 && ` ${h.monatsgehalt.toFixed(2)} €/Mon`}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ==================== TAB: URLAUB ====================
const TabUrlaub = ({ maId, urlaubsanspruch, save }) => {
  const [list, setList] = useState([]);
  const [anspruch, setAnspruch] = useState(urlaubsanspruch || 30);
  const [newEntry, setNewEntry] = useState({ von: "", bis: "", tage: 0, typ: "urlaub", status: "genehmigt", bemerkung: "" });
  const load = useCallback(async () => {
    try { const res = await api.get(`/mitarbeiter/${maId}/urlaub`); setList(res.data); } catch {}
  }, [maId]);
  useEffect(() => { load(); }, [load]);

  const calcTage = (von, bis) => {
    if (!von || !bis) return 0;
    const d1 = new Date(von), d2 = new Date(bis);
    return Math.max(1, Math.ceil((d2 - d1) / (1000*60*60*24)) + 1);
  };

  const add = async () => {
    if (!newEntry.von || !newEntry.bis) { toast.error("Zeitraum erforderlich"); return; }
    try {
      const tage = newEntry.tage || calcTage(newEntry.von, newEntry.bis);
      await api.post(`/mitarbeiter/${maId}/urlaub`, { ...newEntry, tage });
      toast.success("Urlaub eingetragen");
      setNewEntry({ von: "", bis: "", tage: 0, typ: "urlaub", status: "genehmigt", bemerkung: "" });
      load();
    } catch { toast.error("Fehler"); }
  };

  const del = async (id) => {
    if (!window.confirm("Eintrag löschen?")) return;
    try { await api.delete(`/mitarbeiter/${maId}/urlaub/${id}`); load(); toast.success("Gelöscht"); }
    catch { toast.error("Fehler"); }
  };

  const used = list.filter(u => u.typ === "urlaub").reduce((s, u) => s + (u.tage || 0), 0);

  return (
    <Card className="p-5">
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <Field label="Jahres-Urlaubsanspruch (Tage)" className="flex-1 min-w-[180px]">
          <input type="number" value={anspruch} onChange={e => setAnspruch(Number(e.target.value))} onBlur={() => save({ urlaubsanspruch: anspruch })} className="w-full border rounded-sm p-2 text-sm" />
        </Field>
        <div className="px-3 py-2 bg-muted rounded-sm text-sm">
          Verbraucht: <span className="font-bold">{used}</span> von {anspruch} · Rest: <span className={used > anspruch ? "text-red-600 font-bold" : "text-green-600 font-bold"}>{anspruch - used}</span>
        </div>
      </div>

      <div className="border rounded-sm p-3 bg-muted/20 mb-4">
        <h4 className="font-semibold text-sm mb-2">Neuer Eintrag</h4>
        <div className="grid grid-cols-6 gap-2">
          <input type="date" value={newEntry.von} onChange={e => setNewEntry({...newEntry, von: e.target.value})} className="border rounded-sm p-2 text-sm" />
          <input type="date" value={newEntry.bis} onChange={e => setNewEntry({...newEntry, bis: e.target.value})} className="border rounded-sm p-2 text-sm" />
          <input type="number" value={newEntry.tage || calcTage(newEntry.von, newEntry.bis)} onChange={e => setNewEntry({...newEntry, tage: Number(e.target.value)})} className="border rounded-sm p-2 text-sm" placeholder="Tage" />
          <select value={newEntry.typ} onChange={e => setNewEntry({...newEntry, typ: e.target.value})} className="border rounded-sm p-2 text-sm">
            <option value="urlaub">Urlaub</option><option value="unbezahlt">Unbezahlt</option><option value="sonderurlaub">Sonderurlaub</option><option value="berufsschule">Berufsschule</option>
          </select>
          <select value={newEntry.status} onChange={e => setNewEntry({...newEntry, status: e.target.value})} className="border rounded-sm p-2 text-sm">
            <option value="beantragt">beantragt</option><option value="genehmigt">genehmigt</option><option value="abgelehnt">abgelehnt</option>
          </select>
          <button onClick={add} className="bg-primary text-primary-foreground rounded-sm text-sm font-medium" data-testid="btn-add-urlaub">+ Eintragen</button>
        </div>
        <input value={newEntry.bemerkung} onChange={e => setNewEntry({...newEntry, bemerkung: e.target.value})} className="w-full border rounded-sm p-2 text-sm mt-2" placeholder="Bemerkung (optional)" />
      </div>

      {list.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Einträge.</p> : (
        <div className="space-y-1">
          {list.map(u => (
            <div key={u.id} className="flex items-center justify-between border-b py-2 text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium">{u.von ? new Date(u.von).toLocaleDateString("de-DE") : "—"} – {u.bis ? new Date(u.bis).toLocaleDateString("de-DE") : "—"}</span>
                <Badge className="bg-blue-100 text-blue-700">{u.tage || 0} Tage</Badge>
                <Badge variant="outline">{u.typ}</Badge>
                <Badge className={u.status === "genehmigt" ? "bg-green-100 text-green-700" : u.status === "abgelehnt" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>{u.status}</Badge>
                {u.bemerkung && <span className="text-xs text-muted-foreground">{u.bemerkung}</span>}
              </div>
              <button onClick={() => del(u.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-sm"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ==================== TAB: KRANKMELDUNGEN ====================
const TabKrank = ({ maId }) => {
  const [list, setList] = useState([]);
  const [newEntry, setNewEntry] = useState({ von: "", bis: "", tage: 0, au_vorgelegt: false, bemerkung: "" });
  const load = useCallback(async () => {
    try { const res = await api.get(`/mitarbeiter/${maId}/krankmeldungen`); setList(res.data); } catch {}
  }, [maId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newEntry.von) { toast.error("Von-Datum erforderlich"); return; }
    try {
      await api.post(`/mitarbeiter/${maId}/krankmeldungen`, newEntry);
      toast.success("Krankmeldung eingetragen");
      setNewEntry({ von: "", bis: "", tage: 0, au_vorgelegt: false, bemerkung: "" });
      load();
    } catch { toast.error("Fehler"); }
  };

  const del = async (id) => {
    if (!window.confirm("Eintrag löschen?")) return;
    try { await api.delete(`/mitarbeiter/${maId}/krankmeldungen/${id}`); load(); toast.success("Gelöscht"); }
    catch { toast.error("Fehler"); }
  };

  const totalTage = list.reduce((s, k) => s + (k.tage || 0), 0);

  return (
    <Card className="p-5">
      <div className="mb-3 text-sm text-muted-foreground">
        Krankheitstage gesamt: <span className="font-bold text-foreground">{totalTage}</span>
      </div>
      <div className="border rounded-sm p-3 bg-muted/20 mb-4">
        <h4 className="font-semibold text-sm mb-2">Neue Krankmeldung</h4>
        <div className="grid grid-cols-5 gap-2">
          <input type="date" value={newEntry.von} onChange={e => setNewEntry({...newEntry, von: e.target.value})} className="border rounded-sm p-2 text-sm" />
          <input type="date" value={newEntry.bis} onChange={e => setNewEntry({...newEntry, bis: e.target.value})} className="border rounded-sm p-2 text-sm" />
          <input type="number" value={newEntry.tage} onChange={e => setNewEntry({...newEntry, tage: Number(e.target.value)})} className="border rounded-sm p-2 text-sm" placeholder="Tage" />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={newEntry.au_vorgelegt} onChange={e => setNewEntry({...newEntry, au_vorgelegt: e.target.checked})} /> AU vorgelegt
          </label>
          <button onClick={add} className="bg-primary text-primary-foreground rounded-sm text-sm font-medium" data-testid="btn-add-krank">+ Eintragen</button>
        </div>
        <input value={newEntry.bemerkung} onChange={e => setNewEntry({...newEntry, bemerkung: e.target.value})} className="w-full border rounded-sm p-2 text-sm mt-2" placeholder="Bemerkung (optional)" />
      </div>

      {list.length === 0 ? <p className="text-sm text-muted-foreground">Keine Krankmeldungen.</p> : (
        <div className="space-y-1">
          {list.map(k => (
            <div key={k.id} className="flex items-center justify-between border-b py-2 text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium">{k.von ? new Date(k.von).toLocaleDateString("de-DE") : "—"} – {k.bis ? new Date(k.bis).toLocaleDateString("de-DE") : "—"}</span>
                <Badge className="bg-red-100 text-red-700">{k.tage || 0} Tage</Badge>
                {k.au_vorgelegt && <Badge className="bg-green-100 text-green-700">AU ✓</Badge>}
                {k.bemerkung && <span className="text-xs text-muted-foreground">{k.bemerkung}</span>}
              </div>
              <button onClick={() => del(k.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-sm"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ==================== TAB: DOKUMENTE / VERTRÄGE ====================
const TabDokumente = ({ maId }) => {
  const [list, setList] = useState([]);
  const [kategorie, setKategorie] = useState("arbeitsvertrag");
  const [uploading, setUploading] = useState(false);
  const load = useCallback(async () => {
    try { const res = await api.get(`/mitarbeiter/${maId}/dokumente`); setList(res.data); } catch {}
  }, [maId]);
  useEffect(() => { load(); }, [load]);

  const upload = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kategorie", kategorie);
    try {
      await api.post(`/mitarbeiter/${maId}/dokumente`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Dokument hochgeladen");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload fehlgeschlagen"); }
    finally { setUploading(false); ev.target.value = ""; }
  };

  const del = async (id) => {
    if (!window.confirm("Dokument löschen?")) return;
    try { await api.delete(`/mitarbeiter/${maId}/dokumente/${id}`); load(); toast.success("Gelöscht"); }
    catch { toast.error("Fehler"); }
  };

  const download = async (doc) => {
    try {
      const res = await api.get(`/mitarbeiter/${maId}/dokumente/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = doc.filename || "datei"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download fehlgeschlagen"); }
  };

  const grouped = list.reduce((acc, d) => { (acc[d.kategorie] ||= []).push(d); return acc; }, {});

  return (
    <Card className="p-5">
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <Field label="Kategorie" className="flex-1 min-w-[200px]">
          <select value={kategorie} onChange={e => setKategorie(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="doc-kategorie">
            {DOKUMENT_KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm cursor-pointer hover:bg-primary/90">
          <Upload className="w-4 h-4" /> {uploading ? "Lade..." : "Datei hochladen"}
          <input type="file" className="hidden" onChange={upload} disabled={uploading} data-testid="doc-upload" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
        </label>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8"><FileText className="w-10 h-10 mx-auto mb-2 opacity-40" /> Noch keine Dokumente.</p>
      ) : (
        <div className="space-y-4">
          {DOKUMENT_KATEGORIEN.map(({ value, label }) => {
            const docs = grouped[value];
            if (!docs?.length) return null;
            return (
              <div key={value}>
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-2"><FileText className="w-4 h-4" />{label} ({docs.length})</h4>
                <div className="space-y-1">
                  {docs.map(d => (
                    <div key={d.id} className="flex items-center justify-between border rounded-sm p-2 text-sm hover:bg-muted/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{d.filename}</span>
                        <span className="text-xs text-muted-foreground">{d.created_at ? new Date(d.created_at).toLocaleDateString("de-DE") : ""}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => download(d)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-sm" title="Download"><Download className="w-4 h-4" /></button>
                        <button onClick={() => del(d.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-sm" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

// ==================== TAB: FORTBILDUNG ====================
const TabFortbildung = ({ maId }) => {
  const [list, setList] = useState([]);
  const [newEntry, setNewEntry] = useState({ bezeichnung: "", anbieter: "", datum: "", bis_datum: "", kosten: 0, zertifikat: false, bemerkung: "" });
  const load = useCallback(async () => {
    try { const res = await api.get(`/mitarbeiter/${maId}/fortbildungen`); setList(res.data); } catch {}
  }, [maId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newEntry.bezeichnung) { toast.error("Bezeichnung erforderlich"); return; }
    try {
      await api.post(`/mitarbeiter/${maId}/fortbildungen`, newEntry);
      toast.success("Fortbildung eingetragen");
      setNewEntry({ bezeichnung: "", anbieter: "", datum: "", bis_datum: "", kosten: 0, zertifikat: false, bemerkung: "" });
      load();
    } catch { toast.error("Fehler"); }
  };

  const del = async (id) => {
    if (!window.confirm("Eintrag löschen?")) return;
    try { await api.delete(`/mitarbeiter/${maId}/fortbildungen/${id}`); load(); toast.success("Gelöscht"); }
    catch { toast.error("Fehler"); }
  };

  return (
    <Card className="p-5">
      <div className="border rounded-sm p-3 bg-muted/20 mb-4">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Neue Fortbildung</h4>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={newEntry.bezeichnung} onChange={e => setNewEntry({...newEntry, bezeichnung: e.target.value})} className="border rounded-sm p-2 text-sm" placeholder="Bezeichnung *" />
          <input value={newEntry.anbieter} onChange={e => setNewEntry({...newEntry, anbieter: e.target.value})} className="border rounded-sm p-2 text-sm" placeholder="Anbieter/Schule" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <input type="date" value={newEntry.datum} onChange={e => setNewEntry({...newEntry, datum: e.target.value})} className="border rounded-sm p-2 text-sm" placeholder="Von" />
          <input type="date" value={newEntry.bis_datum} onChange={e => setNewEntry({...newEntry, bis_datum: e.target.value})} className="border rounded-sm p-2 text-sm" placeholder="Bis" />
          <input type="number" step="0.01" value={newEntry.kosten || ""} onChange={e => setNewEntry({...newEntry, kosten: Number(e.target.value)})} className="border rounded-sm p-2 text-sm" placeholder="Kosten €" />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={newEntry.zertifikat} onChange={e => setNewEntry({...newEntry, zertifikat: e.target.checked})} /> Zertifikat</label>
        </div>
        <input value={newEntry.bemerkung} onChange={e => setNewEntry({...newEntry, bemerkung: e.target.value})} className="w-full border rounded-sm p-2 text-sm mt-2" placeholder="Bemerkung" />
        <button onClick={add} className="mt-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium px-3 py-1.5" data-testid="btn-add-fortbildung">+ Eintragen</button>
      </div>

      {list.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Fortbildungen.</p> : (
        <div className="space-y-2">
          {list.map(f => (
            <div key={f.id} className="flex items-start justify-between border rounded-sm p-3 text-sm hover:bg-muted/40">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{f.bezeichnung}</span>
                  {f.zertifikat && <Badge className="bg-purple-100 text-purple-700">Zertifikat ✓</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                  {f.anbieter && <span>{f.anbieter}</span>}
                  {f.datum && <span>{new Date(f.datum).toLocaleDateString("de-DE")}{f.bis_datum ? ` – ${new Date(f.bis_datum).toLocaleDateString("de-DE")}` : ""}</span>}
                  {f.kosten > 0 && <span>{f.kosten.toFixed(2)} €</span>}
                </div>
                {f.bemerkung && <p className="text-xs mt-1">{f.bemerkung}</p>}
              </div>
              <button onClick={() => del(f.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-sm"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ==================== TAB: NOTFALLKONTAKT & NOTIZEN ====================
const TabNotfall = ({ data, save }) => {
  const [f, setF] = useState({
    notfallkontakt_name: data.notfallkontakt_name || "",
    notfallkontakt_telefon: data.notfallkontakt_telefon || "",
    notfallkontakt_beziehung: data.notfallkontakt_beziehung || "",
    bemerkungen: data.bemerkungen || "",
  });
  const u = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /> Notfallkontakt</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Field label="Name"><input value={f.notfallkontakt_name} onChange={e => u("notfallkontakt_name", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Telefon"><input value={f.notfallkontakt_telefon} onChange={e => u("notfallkontakt_telefon", e.target.value)} className="w-full border rounded-sm p-2 text-sm" /></Field>
        <Field label="Beziehung"><input value={f.notfallkontakt_beziehung} onChange={e => u("notfallkontakt_beziehung", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="z.B. Ehefrau, Bruder" /></Field>
      </div>
      <h3 className="font-semibold mb-2">Interne Bemerkungen</h3>
      <textarea value={f.bemerkungen} onChange={e => u("bemerkungen", e.target.value)} className="w-full border rounded-sm p-2 text-sm min-h-[120px]" placeholder="Notizen zum Mitarbeiter..." />
      <SaveBar onSave={() => save(f)} />
    </Card>
  );
};

// ==================== Helper: Field + SaveBar ====================
const Field = ({ label, children, className = "" }) => (
  <div className={className}>
    <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
    {children}
  </div>
);

const SaveBar = ({ onSave }) => (
  <div className="flex justify-end pt-4 mt-3 border-t">
    <button onClick={onSave} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90" data-testid="btn-tab-save">
      Speichern
    </button>
  </div>
);

export { MitarbeiterModulPage };
