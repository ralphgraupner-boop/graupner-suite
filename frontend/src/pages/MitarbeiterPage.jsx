import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { toast } from "sonner";
import {
  Users, Plus, Pencil, Trash2, Search, UserPlus, Calendar, Heart,
  FileText, Euro, GraduationCap, Phone, Mail, MapPin, Shield, Clock,
  ChevronLeft, ChevronRight, Upload, Download, AlertTriangle, CheckCircle, X, Eye,
  Briefcase, Building2, TrendingUp, XCircle, CreditCard, UserCircle, Globe, Save
} from "lucide-react";

const POSITIONS = ["Meister", "Geselle", "Azubi", "Büro", "Praktikant", "Aushilfe"];
const STEUERKLASSEN = ["", "1", "2", "3", "4", "5", "6"];
const KONFESSIONEN = ["keine", "ev", "rk", "andere"];
const BESCHAEFTIGUNGSARTEN = ["", "Vollzeit", "Teilzeit", "Minijob", "Azubi", "Werkstudent", "Praktikant"];
const PERSONENGRUPPEN = [
  "",
  "101 - SV-pflichtig ohne bes. Merkmale",
  "102 - Auszubildende",
  "109 - Geringfügig entlohnt",
  "110 - Kurzfristig Beschäftigte",
  "119 - Versicherungsfreie Altersvollrentner",
  "120 - Werkstudenten",
  "190 - Geschäftsführer ohne SV-Pflicht",
];
const FUEHRERSCHEINE = ["", "B", "BE", "B96", "C", "CE", "C1", "C1E", "Keiner"];
const URLAUB_TYPEN = [
  { value: "urlaub", label: "Erholungsurlaub" },
  { value: "sonderurlaub", label: "Sonderurlaub" },
  { value: "unbezahlt", label: "Unbezahlter Urlaub" },
];
const NOTFALL_BEZIEHUNGEN = ["", "Ehepartner/in", "Eltern", "Kind", "Geschwister", "Partner/in", "Sonstige"];

const fmt = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "-";
const fmtEuro = (v) => Number(v || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const isoToDE = (iso) => { if (!iso) return ""; const p = iso.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso; };
const deToISO = (de) => { const m = de.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : de; };

const EMPTY_FORM = {
  anrede: "Herr", vorname: "", nachname: "", geburtsdatum: "", personalnummer: "", status: "aktiv",
  telefon: "", email: "", strasse: "", plz: "", ort: "",
  position: "", beschaeftigungsart: "", wochenstunden: "", eintrittsdatum: "", austrittsdatum: "", urlaubsanspruch: 30,
  steuer_id: "", sv_nummer: "", krankenkasse: "", steuerklasse: "", kinderfreibetraege: 0, konfession: "keine", personengruppe: "",
  iban: "", bank: "", fuehrerschein: "",
  lohnart: "stundenlohn", stundenlohn: 0, monatsgehalt: 0, vwl_betrag: 0, vwl_ag_anteil: 0,
  notfallkontakt_name: "", notfallkontakt_telefon: "", notfallkontakt_beziehung: "",
  bemerkungen: "",
};

// ════════════════════ REUSABLE FIELD COMPONENTS (stable, no re-creation) ════════════════════

function Field({ label, value, onChange, type = "text", placeholder, testId, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={e => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder}
        className="h-9"
        data-testid={testId}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, testId, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm"
        data-testid={testId}
      >
        {options.map(o => {
          const val = typeof o === "object" ? o.value : o;
          const lbl = typeof o === "object" ? o.label : (o || "– Bitte wählen –");
          return <option key={val} value={val}>{lbl}</option>;
        })}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange, testId, className = "" }) {
  const [display, setDisplay] = useState(isoToDE(value || ""));
  useEffect(() => { setDisplay(isoToDE(value || "")); }, [value]);

  const handleChange = (e) => {
    let v = e.target.value.replace(/[^\d.]/g, "");
    const digits = v.replace(/\./g, "");
    if (digits.length >= 2 && !v.includes(".")) v = digits.slice(0, 2) + "." + digits.slice(2);
    if (digits.length >= 4 && v.split(".").length < 3) {
      const parts = v.split(".");
      v = parts[0] + "." + parts[1].slice(0, 2) + "." + (parts[1].slice(2) + (parts[2] || ""));
    }
    if (v.length > 10) v = v.slice(0, 10);
    setDisplay(v);
    if (v.match(/^\d{2}\.\d{2}\.\d{4}$/)) onChange(deToISO(v));
    else if (v === "") onChange("");
  };

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <Input value={display} onChange={handleChange} placeholder="TT.MM.JJJJ" className="h-9" maxLength={10} data-testid={testId} />
    </div>
  );
}

// ════════════════════ WIZARD STEPS ════════════════════

const WIZARD_STEPS = [
  { id: "person", label: "Person", icon: UserCircle },
  { id: "kontakt", label: "Kontakt & Adresse", icon: Phone },
  { id: "beschaeftigung", label: "Beschäftigung", icon: Briefcase },
  { id: "steuer", label: "Steuer & SV", icon: Shield },
  { id: "bank", label: "Bank & Lohn", icon: Euro },
  { id: "notfall", label: "Notfall & Sonstiges", icon: AlertTriangle },
];

function WizardForm({ form, setForm, onSave, saving, isNew, onCancel }) {
  const [step, setStep] = useState(0);
  const current = WIZARD_STEPS[step];

  const updateField = useCallback((field) => (val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  }, [setForm]);

  const next = () => { if (step < WIZARD_STEPS.length - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  const handleSave = () => {
    if (!form.vorname || !form.nachname) { toast.error("Vor- und Nachname sind Pflichtfelder"); return; }
    onSave();
  };

  return (
    <div data-testid="wizard-form">
      {/* Step Indicator */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              i === step ? "bg-primary text-primary-foreground shadow-sm" : i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`wizard-step-${s.id}`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {current.id === "person" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SelectField label="Anrede" value={form.anrede} onChange={updateField("anrede")} options={["Herr", "Frau", "Divers"]} testId="wiz-anrede" />
            <Field label="Vorname *" value={form.vorname} onChange={updateField("vorname")} testId="wiz-vorname" />
            <Field label="Nachname *" value={form.nachname} onChange={updateField("nachname")} testId="wiz-nachname" />
            <DateInput label="Geburtsdatum" value={form.geburtsdatum} onChange={updateField("geburtsdatum")} testId="wiz-geburtsdatum" />
            <Field label="Personalnummer" value={form.personalnummer} onChange={updateField("personalnummer")} placeholder="z.B. 1001" testId="wiz-pnr" />
            <SelectField label="Status" value={form.status} onChange={updateField("status")} options={["aktiv", "inaktiv", "ausgeschieden"]} testId="wiz-status" />
          </div>
        )}

        {current.id === "kontakt" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Telefon" value={form.telefon} onChange={updateField("telefon")} testId="wiz-telefon" />
            <Field label="E-Mail" value={form.email} onChange={updateField("email")} type="email" testId="wiz-email" />
            <div className="hidden md:block" />
            <Field label="Straße & Hausnr." value={form.strasse} onChange={updateField("strasse")} testId="wiz-strasse" className="col-span-2 md:col-span-1" />
            <Field label="PLZ" value={form.plz} onChange={updateField("plz")} testId="wiz-plz" />
            <Field label="Ort" value={form.ort} onChange={updateField("ort")} testId="wiz-ort" />
          </div>
        )}

        {current.id === "beschaeftigung" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SelectField label="Position" value={form.position} onChange={updateField("position")} options={["", ...POSITIONS]} testId="wiz-position" />
            <SelectField label="Beschäftigungsart" value={form.beschaeftigungsart} onChange={updateField("beschaeftigungsart")} options={BESCHAEFTIGUNGSARTEN.map(b => b || { value: "", label: "– Bitte wählen –" })} testId="wiz-beschaeftigung" />
            <Field label="Wochenstunden" value={form.wochenstunden} onChange={updateField("wochenstunden")} type="number" placeholder="z.B. 40" testId="wiz-wochenstunden" />
            <DateInput label="Eintrittsdatum" value={form.eintrittsdatum} onChange={updateField("eintrittsdatum")} testId="wiz-eintritt" />
            <DateInput label="Austrittsdatum" value={form.austrittsdatum} onChange={updateField("austrittsdatum")} testId="wiz-austritt" />
            <Field label="Urlaubsanspruch (Tage/Jahr)" value={form.urlaubsanspruch} onChange={updateField("urlaubsanspruch")} type="number" testId="wiz-urlaub" />
          </div>
        )}

        {current.id === "steuer" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Steuer-ID" value={form.steuer_id} onChange={updateField("steuer_id")} testId="wiz-steuerid" />
            <Field label="SV-Nummer" value={form.sv_nummer} onChange={updateField("sv_nummer")} testId="wiz-svnr" />
            <Field label="Krankenkasse" value={form.krankenkasse} onChange={updateField("krankenkasse")} testId="wiz-kk" />
            <SelectField label="Steuerklasse" value={form.steuerklasse} onChange={updateField("steuerklasse")} options={STEUERKLASSEN.map(s => s || { value: "", label: "– Bitte wählen –" })} testId="wiz-stkl" />
            <Field label="Kinderfreibeträge" value={form.kinderfreibetraege} onChange={updateField("kinderfreibetraege")} type="number" testId="wiz-kinder" />
            <SelectField label="Konfession" value={form.konfession} onChange={updateField("konfession")} options={[{value:"keine",label:"Keine / Konfessionslos"},{value:"ev",label:"Evangelisch"},{value:"rk",label:"Röm.-Katholisch"},{value:"andere",label:"Andere"}]} testId="wiz-konfession" />
            <SelectField label="Personengruppe (SV-Schlüssel)" value={form.personengruppe} onChange={updateField("personengruppe")} options={PERSONENGRUPPEN.map(p => p || { value: "", label: "– Bitte wählen –" })} testId="wiz-pg" className="col-span-2 md:col-span-3" />
          </div>
        )}

        {current.id === "bank" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="IBAN" value={form.iban} onChange={updateField("iban")} placeholder="DE89 3704 0044 0532 0130 00" testId="wiz-iban" className="col-span-2 md:col-span-2" />
            <Field label="Bank" value={form.bank} onChange={updateField("bank")} placeholder="z.B. Commerzbank" testId="wiz-bank" />
            <div className="col-span-2 md:col-span-3 border-t pt-4 mt-2">
              <p className="text-xs font-semibold text-primary mb-3">Vergütung</p>
            </div>
            <SelectField label="Lohnart" value={form.lohnart} onChange={updateField("lohnart")} options={[{value:"stundenlohn",label:"Stundenlohn"},{value:"monatsgehalt",label:"Monatsgehalt"}]} testId="wiz-lohnart" />
            {form.lohnart === "stundenlohn" ? (
              <Field label="Stundenlohn (€)" value={form.stundenlohn} onChange={updateField("stundenlohn")} type="number" testId="wiz-stundenlohn" />
            ) : (
              <Field label="Monatsgehalt (€)" value={form.monatsgehalt} onChange={updateField("monatsgehalt")} type="number" testId="wiz-monatsgehalt" />
            )}
            <Field label="Wochenstunden" value={form.wochenstunden} onChange={updateField("wochenstunden")} type="number" testId="wiz-std2" />
            <Field label="VWL Arbeitnehmer (€)" value={form.vwl_betrag} onChange={updateField("vwl_betrag")} type="number" testId="wiz-vwl-an" />
            <Field label="VWL Arbeitgeber (€)" value={form.vwl_ag_anteil} onChange={updateField("vwl_ag_anteil")} type="number" testId="wiz-vwl-ag" />
            <SelectField label="Führerscheinklasse" value={form.fuehrerschein} onChange={updateField("fuehrerschein")} options={FUEHRERSCHEINE.map(f => f || { value: "", label: "– Keine Angabe –" })} testId="wiz-fs" />
          </div>
        )}

        {current.id === "notfall" && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-primary mb-3">Notfallkontakt</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Name" value={form.notfallkontakt_name} onChange={updateField("notfallkontakt_name")} testId="wiz-nf-name" />
                <Field label="Telefon" value={form.notfallkontakt_telefon} onChange={updateField("notfallkontakt_telefon")} testId="wiz-nf-tel" />
                <SelectField label="Beziehung" value={form.notfallkontakt_beziehung} onChange={updateField("notfallkontakt_beziehung")} options={NOTFALL_BEZIEHUNGEN.map(b => b || { value: "", label: "– Bitte wählen –" })} testId="wiz-nf-bez" />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-primary mb-3">Bemerkungen</p>
              <Textarea value={form.bemerkungen || ""} onChange={e => setForm(prev => ({ ...prev, bemerkungen: e.target.value }))} rows={3} placeholder="Interne Notizen zum Mitarbeiter..." data-testid="wiz-bemerkungen" />
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <div>
          {onCancel && <Button variant="outline" onClick={onCancel} data-testid="wiz-cancel">Abbrechen</Button>}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={prev} data-testid="wiz-prev">
              <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
            </Button>
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <Button onClick={next} data-testid="wiz-next">
              Weiter <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} data-testid="wiz-save">
              <Save className="w-4 h-4 mr-1" /> {saving ? "Speichern..." : (isNew ? "Mitarbeiter anlegen" : "Änderungen speichern")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════ MAIN PAGE ════════════════════

export default function MitarbeiterPage() {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try { const res = await api.get("/mitarbeiter"); setMitarbeiter(res.data); }
    catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    if (!search) return mitarbeiter;
    const s = search.toLowerCase();
    return mitarbeiter.filter(m => `${m.vorname} ${m.nachname} ${m.position} ${m.personalnummer}`.toLowerCase().includes(s));
  }, [mitarbeiter, search]);

  const aktive = mitarbeiter.filter(m => m.status === "aktiv").length;

  if (showNew) {
    return <NewMitarbeiterView onBack={() => setShowNew(false)} onCreated={(ma) => { loadAll(); setSelected(ma); setShowNew(false); }} />;
  }

  if (selected) {
    return <MitarbeiterDetail ma={selected} onBack={() => { setSelected(null); loadAll(); }} onUpdate={loadAll} />;
  }

  return (
    <div className="space-y-6" data-testid="mitarbeiter-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Mitarbeiter
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{aktive} aktive Mitarbeiter</p>
        </div>
        <Button onClick={() => setShowNew(true)} data-testid="btn-new-mitarbeiter">
          <UserPlus className="w-4 h-4 mr-1" /> Neuer Mitarbeiter
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Gesamt" value={mitarbeiter.length} />
        <KpiCard icon={CheckCircle} label="Aktiv" value={aktive} color="text-green-600" />
        <KpiCard icon={Briefcase} label="Positionen" value={[...new Set(mitarbeiter.map(m => m.position).filter(Boolean))].length} />
        <KpiCard icon={GraduationCap} label="Azubis" value={mitarbeiter.filter(m => m.position === "Azubi").length} color="text-blue-600" />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mitarbeiter suchen..." className="pl-10" data-testid="search-mitarbeiter" />
      </div>

      <div className="grid gap-3">
        {loading ? <p className="text-center text-muted-foreground py-8">Laden...</p> :
        filtered.length === 0 ? <p className="text-center text-muted-foreground py-8">Keine Mitarbeiter gefunden</p> :
        filtered.map(m => (
          <Card key={m.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4" style={{ borderLeftColor: m.status === "aktiv" ? "#16a34a" : "#9ca3af" }} onClick={() => setSelected(m)} data-testid={`ma-card-${m.id}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {m.vorname?.charAt(0)}{m.nachname?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{m.vorname} {m.nachname}</p>
                <p className="text-sm text-muted-foreground">{m.position || "Keine Position"} {m.personalnummer ? `· #${m.personalnummer}` : ""}</p>
              </div>
              <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                {m.telefon && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{m.telefon}</span>}
                {m.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{m.email}</span>}
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />seit {fmt(m.eintrittsdatum)}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === "aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {m.status === "aktiv" ? "Aktiv" : "Inaktiv"}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color = "text-primary" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
      </div>
    </Card>
  );
}

// ════════════════════ NEW EMPLOYEE (WIZARD) ════════════════════

function NewMitarbeiterView({ onBack, onCreated }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post("/mitarbeiter", form);
      toast.success("Mitarbeiter angelegt");
      onCreated(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="new-mitarbeiter-wizard">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4" /> Zurück</Button>
        <h1 className="text-xl font-bold">Neuer Mitarbeiter</h1>
      </div>
      <WizardForm form={form} setForm={setForm} onSave={handleSave} saving={saving} isNew={true} onCancel={onBack} />
    </div>
  );
}

// ════════════════════ DETAIL VIEW ════════════════════

function MitarbeiterDetail({ ma: initialMa, onBack, onUpdate }) {
  const [ma, setMa] = useState(initialMa);
  const [activeTab, setActiveTab] = useState("stammdaten");
  const [form, setForm] = useState({ ...initialMa });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadDetail(); loadStats(); }, []);

  const loadDetail = async () => {
    try { const res = await api.get(`/mitarbeiter/${ma.id}`); setMa(res.data); setForm(res.data); } catch {}
  };

  const loadStats = async () => {
    try { const res = await api.get(`/mitarbeiter/${ma.id}/statistiken`); setStats(res.data); } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/mitarbeiter/${ma.id}`, form);
      toast.success("Gespeichert");
      loadDetail();
      onUpdate();
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${ma.vorname} ${ma.nachname} wirklich löschen?`)) return;
    try { await api.delete(`/mitarbeiter/${ma.id}`); toast.success("Gelöscht"); onBack(); }
    catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const tabs = [
    { id: "stammdaten", label: "Stammdaten", icon: FileText },
    { id: "lohn", label: "Lohn & Gehalt", icon: Euro },
    { id: "urlaub", label: "Urlaub", icon: Calendar },
    { id: "krankmeldungen", label: "Krankmeldungen", icon: Heart },
    { id: "dokumente", label: "Dokumente", icon: Upload },
    { id: "fortbildungen", label: "Fortbildungen", icon: GraduationCap },
  ];

  return (
    <div className="space-y-6" data-testid="mitarbeiter-detail">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack} data-testid="btn-back">
          <ChevronLeft className="w-4 h-4" /> Zurück
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{ma.anrede} {ma.vorname} {ma.nachname}</h1>
          <p className="text-sm text-muted-foreground">{ma.position} {ma.personalnummer ? `· #${ma.personalnummer}` : ""}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${ma.status === "aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          {ma.status === "aktiv" ? "Aktiv" : "Inaktiv"}
        </span>
        <Button variant="destructive" size="sm" onClick={handleDelete} data-testid="btn-delete-ma"><Trash2 className="w-4 h-4" /></Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Calendar} label="Resturlaub" value={`${stats.urlaub_rest} Tage`} color={stats.urlaub_rest < 5 ? "text-amber-600" : "text-green-600"} />
          <KpiCard icon={Calendar} label="Urlaub genommen" value={`${stats.urlaub_genommen}/${stats.urlaubsanspruch}`} />
          <KpiCard icon={Heart} label="Kranktage" value={stats.kranktage} color={stats.kranktage > 10 ? "text-red-600" : "text-muted-foreground"} />
          <KpiCard icon={Euro} label={ma.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"} value={ma.lohnart === "monatsgehalt" ? fmtEuro(ma.monatsgehalt) : fmtEuro(ma.stundenlohn)} />
        </div>
      )}

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-${t.id}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === "stammdaten" && (
        <WizardForm form={form} setForm={setForm} onSave={handleSave} saving={saving} isNew={false} />
      )}
      {activeTab === "lohn" && <LohnTab ma={ma} onUpdate={() => { loadDetail(); loadStats(); }} />}
      {activeTab === "urlaub" && <UrlaubTab ma={ma} onUpdate={loadStats} />}
      {activeTab === "krankmeldungen" && <KrankmeldungenTab ma={ma} onUpdate={loadStats} />}
      {activeTab === "dokumente" && <DokumenteTab ma={ma} />}
      {activeTab === "fortbildungen" && <FortbildungenTab ma={ma} />}
    </div>
  );
}

// ════════════════════ LOHN TAB ════════════════════

function LohnTab({ ma, onUpdate }) {
  const [history, setHistory] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ lohnart: ma.lohnart || "stundenlohn", stundenlohn: ma.stundenlohn || 0, monatsgehalt: ma.monatsgehalt || 0, gueltig_ab: "", bemerkung: "" });

  useEffect(() => { loadHistory(); }, []);
  const loadHistory = async () => { try { const res = await api.get(`/mitarbeiter/${ma.id}/lohnhistorie`); setHistory(res.data); } catch {} };

  const handleSave = async () => {
    if (!form.gueltig_ab) { toast.error("Gültig ab ist erforderlich"); return; }
    try { await api.post(`/mitarbeiter/${ma.id}/lohnhistorie`, form); toast.success("Lohnänderung gespeichert"); setShowNew(false); loadHistory(); onUpdate(); }
    catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><Euro className="w-4 h-4" /> Aktueller Lohn</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><p className="text-xs text-muted-foreground">Lohnart</p><p className="font-medium">{ma.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"}</p></div>
          <div><p className="text-xs text-muted-foreground">{ma.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"}</p><p className="font-medium text-lg">{ma.lohnart === "monatsgehalt" ? fmtEuro(ma.monatsgehalt) : fmtEuro(ma.stundenlohn)}</p></div>
          <div><p className="text-xs text-muted-foreground">Wochenstunden</p><p className="font-medium">{ma.wochenstunden || 40} Std.</p></div>
          <div><p className="text-xs text-muted-foreground">VWL (AN / AG)</p><p className="font-medium">{fmtEuro(ma.vwl_betrag)} / {fmtEuro(ma.vwl_ag_anteil)}</p></div>
        </div>
      </Card>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Lohnhistorie</h3>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-lohn"><Plus className="w-4 h-4 mr-1" /> Lohnänderung</Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DateInput label="Gültig ab *" value={form.gueltig_ab} onChange={v => setForm(p => ({ ...p, gueltig_ab: v }))} testId="lohn-ab" />
            <SelectField label="Lohnart" value={form.lohnart} onChange={v => setForm(p => ({ ...p, lohnart: v }))} options={[{value:"stundenlohn",label:"Stundenlohn"},{value:"monatsgehalt",label:"Monatsgehalt"}]} />
            <Field label={form.lohnart === "monatsgehalt" ? "Monatsgehalt (€)" : "Stundenlohn (€)"} type="number" value={form.lohnart === "monatsgehalt" ? form.monatsgehalt : form.stundenlohn} onChange={v => setForm(p => ({ ...p, [form.lohnart === "monatsgehalt" ? "monatsgehalt" : "stundenlohn"]: v }))} />
            <Field label="Bemerkung" value={form.bemerkung} onChange={v => setForm(p => ({ ...p, bemerkung: v }))} placeholder="z.B. Lohnerhöhung" />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-lohn">Speichern</Button>
          </div>
        </Card>
      )}

      {history.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">Gültig ab</th><th className="text-left p-3 font-medium">Lohnart</th><th className="text-right p-3 font-medium">Betrag</th><th className="text-left p-3 font-medium">Bemerkung</th></tr></thead>
            <tbody>{history.map(h => (<tr key={h.id} className="border-t"><td className="p-3">{fmt(h.gueltig_ab)}</td><td className="p-3">{h.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"}</td><td className="p-3 text-right font-medium">{h.lohnart === "monatsgehalt" ? fmtEuro(h.monatsgehalt) : fmtEuro(h.stundenlohn)}</td><td className="p-3 text-muted-foreground">{h.bemerkung || "-"}</td></tr>))}</tbody>
          </table>
        </Card>
      ) : <p className="text-sm text-muted-foreground text-center py-4">Keine Lohnhistorie vorhanden</p>}
    </div>
  );
}

// ════════════════════ URLAUB TAB ════════════════════

function UrlaubTab({ ma, onUpdate }) {
  const [entries, setEntries] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ von: "", bis: "", tage: 0, typ: "urlaub", status: "genehmigt", bemerkung: "" });

  useEffect(() => { load(); }, []);
  const load = async () => { try { const r = await api.get(`/mitarbeiter/${ma.id}/urlaub`); setEntries(r.data); } catch {} };

  const calcDays = (von, bis) => {
    if (!von || !bis) return 0;
    let count = 0; const cur = new Date(von);
    while (cur <= new Date(bis)) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  };

  const handleDateChange = (field, val) => {
    setForm(prev => {
      const nf = { ...prev, [field]: val };
      if (nf.von && nf.bis) nf.tage = calcDays(nf.von, nf.bis);
      return nf;
    });
  };

  const handleSave = async () => {
    if (!form.von || !form.bis) { toast.error("Von und Bis erforderlich"); return; }
    try { await api.post(`/mitarbeiter/${ma.id}/urlaub`, form); toast.success("Urlaub eingetragen"); setShowNew(false); setForm({ von: "", bis: "", tage: 0, typ: "urlaub", status: "genehmigt", bemerkung: "" }); load(); onUpdate(); } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handleDelete = async (id) => { try { await api.delete(`/mitarbeiter/${ma.id}/urlaub/${id}`); toast.success("Gelöscht"); load(); onUpdate(); } catch {} };

  const typColors = { urlaub: "bg-blue-100 text-blue-700", sonderurlaub: "bg-purple-100 text-purple-700", unbezahlt: "bg-gray-100 text-gray-700" };
  const statusColors = { genehmigt: "bg-green-100 text-green-700", beantragt: "bg-amber-100 text-amber-700", abgelehnt: "bg-red-100 text-red-700", genommen: "bg-blue-100 text-blue-700" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Urlaubsübersicht ({ma.urlaubsanspruch} Tage/Jahr)</h3>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-urlaub"><Plus className="w-4 h-4 mr-1" /> Urlaub eintragen</Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div><label className="block text-xs font-medium mb-1">Von *</label><Input type="date" value={form.von} onChange={e => handleDateChange("von", e.target.value)} /></div>
            <div><label className="block text-xs font-medium mb-1">Bis *</label><Input type="date" value={form.bis} onChange={e => handleDateChange("bis", e.target.value)} /></div>
            <Field label="Arbeitstage" value={form.tage} onChange={v => setForm(p => ({ ...p, tage: v }))} type="number" />
            <SelectField label="Typ" value={form.typ} onChange={v => setForm(p => ({ ...p, typ: v }))} options={URLAUB_TYPEN} />
            <SelectField label="Status" value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={[{value:"beantragt",label:"Beantragt"},{value:"genehmigt",label:"Genehmigt"},{value:"genommen",label:"Genommen"},{value:"abgelehnt",label:"Abgelehnt"}]} />
          </div>
          <div className="mt-3"><Field label="Bemerkung" value={form.bemerkung} onChange={v => setForm(p => ({ ...p, bemerkung: v }))} /></div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-urlaub">Speichern</Button>
          </div>
        </Card>
      )}

      {entries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">Von</th><th className="text-left p-3 font-medium">Bis</th><th className="text-right p-3 font-medium">Tage</th><th className="text-left p-3 font-medium">Typ</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Bemerkung</th><th className="p-3"></th></tr></thead>
            <tbody>{entries.map(e => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{fmt(e.von)}</td><td className="p-3">{fmt(e.bis)}</td><td className="p-3 text-right font-medium">{e.tage}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${typColors[e.typ] || ""}`}>{URLAUB_TYPEN.find(t => t.value === e.typ)?.label || e.typ}</span></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[e.status] || ""}`}>{e.status}</span></td>
                <td className="p-3 text-muted-foreground">{e.bemerkung || "-"}</td>
                <td className="p-3"><button onClick={() => handleDelete(e.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      ) : <p className="text-sm text-muted-foreground text-center py-4">Keine Urlaubseinträge</p>}
    </div>
  );
}

// ════════════════════ KRANKMELDUNGEN TAB ════════════════════

function KrankmeldungenTab({ ma, onUpdate }) {
  const [entries, setEntries] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ von: "", bis: "", tage: 0, au_bescheinigung: false, arzt: "", bemerkung: "" });

  useEffect(() => { load(); }, []);
  const load = async () => { try { const r = await api.get(`/mitarbeiter/${ma.id}/krankmeldungen`); setEntries(r.data); } catch {} };

  const calcDays = (von, bis) => {
    if (!von || !bis) return 0;
    let count = 0; const cur = new Date(von);
    while (cur <= new Date(bis)) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  };

  const handleDateChange = (field, val) => {
    setForm(prev => { const nf = { ...prev, [field]: val }; if (nf.von && nf.bis) nf.tage = calcDays(nf.von, nf.bis); return nf; });
  };

  const handleSave = async () => {
    if (!form.von) { toast.error("Datum erforderlich"); return; }
    try { await api.post(`/mitarbeiter/${ma.id}/krankmeldungen`, form); toast.success("Krankmeldung eingetragen"); setShowNew(false); setForm({ von: "", bis: "", tage: 0, au_bescheinigung: false, arzt: "", bemerkung: "" }); load(); onUpdate(); } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handleDelete = async (id) => { try { await api.delete(`/mitarbeiter/${ma.id}/krankmeldungen/${id}`); toast.success("Gelöscht"); load(); onUpdate(); } catch {} };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Krankmeldungen</h3>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-krank"><Plus className="w-4 h-4 mr-1" /> Krankmeldung</Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div><label className="block text-xs font-medium mb-1">Von *</label><Input type="date" value={form.von} onChange={e => handleDateChange("von", e.target.value)} /></div>
            <div><label className="block text-xs font-medium mb-1">Bis</label><Input type="date" value={form.bis} onChange={e => handleDateChange("bis", e.target.value)} /></div>
            <Field label="Arbeitstage" value={form.tage} onChange={v => setForm(p => ({ ...p, tage: v }))} type="number" />
            <Field label="Arzt" value={form.arzt} onChange={v => setForm(p => ({ ...p, arzt: v }))} placeholder="Name" />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.au_bescheinigung} onChange={e => setForm(p => ({ ...p, au_bescheinigung: e.target.checked }))} className="rounded" />
                AU vorhanden
              </label>
            </div>
          </div>
          <div className="mt-3"><Field label="Bemerkung" value={form.bemerkung} onChange={v => setForm(p => ({ ...p, bemerkung: v }))} /></div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-krank">Speichern</Button>
          </div>
        </Card>
      )}

      {entries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">Von</th><th className="text-left p-3 font-medium">Bis</th><th className="text-right p-3 font-medium">Tage</th><th className="text-left p-3 font-medium">Arzt</th><th className="text-center p-3 font-medium">AU</th><th className="text-left p-3 font-medium">Bemerkung</th><th className="p-3"></th></tr></thead>
            <tbody>{entries.map(e => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{fmt(e.von)}</td><td className="p-3">{fmt(e.bis)}</td><td className="p-3 text-right font-medium">{e.tage}</td>
                <td className="p-3">{e.arzt || "-"}</td>
                <td className="p-3 text-center">{e.au_bescheinigung ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                <td className="p-3 text-muted-foreground">{e.bemerkung || "-"}</td>
                <td className="p-3"><button onClick={() => handleDelete(e.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      ) : <p className="text-sm text-muted-foreground text-center py-4">Keine Krankmeldungen</p>}
    </div>
  );
}

// ════════════════════ DOKUMENTE TAB ════════════════════

const DOK_SEKTIONEN = [
  { key: "mitarbeiter", label: "Dokumente für Ihre Mitarbeiter", icon: UserCircle, hint: "Lohnabrechnungen, Bescheinigungen, Verträge",
    kategorien: ["Lohnabrechnung", "Arbeitsvertrag", "Nachtrag", "Zeugnis", "Bescheinigung", "Sonstiges"] },
  { key: "arbeitgeber", label: "Dokumente für Sie als Arbeitgeber", icon: Building2, hint: "Bewerbung, Personalfragebogen, Steuer-Anmeldung",
    kategorien: ["Bewerbung", "Personalfragebogen", "Steuer-Anmeldung", "SV-Meldung", "Führungszeugnis", "Gesundheitszeugnis", "Sonstiges"] },
  { key: "entsendung", label: "Entsendungen (A1)", icon: Globe, hint: "A1-Bescheinigungen für Auslandseinsätze (EU)",
    kategorien: ["A1-Bescheinigung", "Entsendungsvertrag", "Sonstiges"] },
  { key: "entgelt", label: "Entgeltbescheinigungen", icon: Euro, hint: "Verdienstbescheinigungen, ELStAM, Jahresmeldungen",
    kategorien: ["Verdienstbescheinigung", "ELStAM", "Jahresmeldung", "Sonstiges"] },
  { key: "bea", label: "Arbeitsbescheinigungen (BEA)", icon: FileText, hint: "Für die Agentur für Arbeit",
    kategorien: ["Arbeitsbescheinigung", "EU-Bescheinigung", "Nebeneinkommensbescheinigung", "Sonstiges"] },
];

function DokumenteTab({ ma }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { try { const r = await api.get(`/mitarbeiter/${ma.id}/dokumente`); setDocs(r.data); } catch {} };

  const handleUpload = async (e, sektion, kategorie) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(sektion);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kategorie", `${sektion}::${kategorie}`);
      await api.post(`/mitarbeiter/${ma.id}/dokumente`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Dokument hochgeladen");
      load();
    } catch { toast.error("Upload fehlgeschlagen"); }
    finally { setUploading(null); e.target.value = ""; }
  };

  const handleDelete = async (id) => { try { await api.delete(`/mitarbeiter/${ma.id}/dokumente/${id}`); toast.success("Gelöscht"); load(); } catch {} };

  const getDocsForSection = (sectionKey) => docs.filter(d => (d.kategorie || "").startsWith(sectionKey + "::"));

  return (
    <div className="space-y-4" data-testid="dokumente-tab">
      {DOK_SEKTIONEN.map(section => {
        const sectionDocs = getDocsForSection(section.key);
        const isOpen = expandedSection === section.key;
        return (
          <Card key={section.key} className="overflow-hidden">
            <button onClick={() => setExpandedSection(isOpen ? null : section.key)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors" data-testid={`dok-section-${section.key}`}>
              <section.icon className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{section.label}</p><p className="text-xs text-muted-foreground">{section.hint}</p></div>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">{sectionDocs.length}</span>
              <ChevronLeft className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "-rotate-90" : ""}`} />
            </button>
            {isOpen && (
              <div className="border-t px-4 pb-4 pt-3 space-y-3">
                <DokUploadRow kategorien={section.kategorien} sectionKey={section.key} uploading={uploading === section.key} onUpload={handleUpload} />
                {sectionDocs.length > 0 ? (
                  <div className="grid gap-2">{sectionDocs.map(d => {
                    const katLabel = (d.kategorie || "").includes("::") ? d.kategorie.split("::")[1] : d.kategorie;
                    return (
                      <div key={d.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{d.filename}</p><p className="text-xs text-muted-foreground">{katLabel} · {fmt(d.created_at)}</p></div>
                        {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="p-1 hover:text-primary"><Download className="w-4 h-4" /></a>}
                        <button onClick={() => handleDelete(d.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    );
                  })}</div>
                ) : <p className="text-xs text-muted-foreground text-center py-2">Keine Dokumente in dieser Kategorie</p>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function DokUploadRow({ kategorien, sectionKey, uploading, onUpload }) {
  const [kat, setKat] = useState(kategorien[0]);
  const fileRef = useRef(null);
  return (
    <div className="flex gap-2 items-center">
      <select value={kat} onChange={e => setKat(e.target.value)} className="h-8 rounded-sm border border-input bg-background px-2 text-xs flex-1">
        {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <input ref={fileRef} type="file" className="hidden" onChange={e => onUpload(e, sectionKey, kat)} disabled={uploading} />
      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs h-8" data-testid={`btn-upload-${sectionKey}`}>
        <Upload className="w-3.5 h-3.5 mr-1" /> {uploading ? "..." : "Hochladen"}
      </Button>
    </div>
  );
}

// ════════════════════ FORTBILDUNGEN TAB ════════════════════

function FortbildungenTab({ ma }) {
  const [entries, setEntries] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ bezeichnung: "", anbieter: "", datum: "", bis_datum: "", kosten: 0, zertifikat: false, bemerkung: "" });

  useEffect(() => { load(); }, []);
  const load = async () => { try { const r = await api.get(`/mitarbeiter/${ma.id}/fortbildungen`); setEntries(r.data); } catch {} };

  const handleSave = async () => {
    if (!form.bezeichnung) { toast.error("Bezeichnung erforderlich"); return; }
    try { await api.post(`/mitarbeiter/${ma.id}/fortbildungen`, form); toast.success("Fortbildung eingetragen"); setShowNew(false); setForm({ bezeichnung: "", anbieter: "", datum: "", bis_datum: "", kosten: 0, zertifikat: false, bemerkung: "" }); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handleDelete = async (id) => { try { await api.delete(`/mitarbeiter/${ma.id}/fortbildungen/${id}`); toast.success("Gelöscht"); load(); } catch {} };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Fortbildungen & Schulungen</h3>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-fortbildung"><Plus className="w-4 h-4 mr-1" /> Fortbildung</Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Bezeichnung *" value={form.bezeichnung} onChange={v => setForm(p => ({ ...p, bezeichnung: v }))} placeholder="z.B. CNC-Kurs" />
            <Field label="Anbieter" value={form.anbieter} onChange={v => setForm(p => ({ ...p, anbieter: v }))} placeholder="z.B. HWK Hamburg" />
            <Field label="Kosten (€)" value={form.kosten} onChange={v => setForm(p => ({ ...p, kosten: v }))} type="number" />
            <div><label className="block text-xs font-medium mb-1">Von</label><Input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium mb-1">Bis</label><Input type="date" value={form.bis_datum} onChange={e => setForm(p => ({ ...p, bis_datum: e.target.value }))} /></div>
            <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.zertifikat} onChange={e => setForm(p => ({ ...p, zertifikat: e.target.checked }))} className="rounded" />Zertifikat erhalten</label></div>
          </div>
          <div className="mt-3"><Field label="Bemerkung" value={form.bemerkung} onChange={v => setForm(p => ({ ...p, bemerkung: v }))} /></div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-fortbildung">Speichern</Button>
          </div>
        </Card>
      )}

      {entries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">Bezeichnung</th><th className="text-left p-3 font-medium">Anbieter</th><th className="text-left p-3 font-medium">Zeitraum</th><th className="text-right p-3 font-medium">Kosten</th><th className="text-center p-3 font-medium">Zertifikat</th><th className="p-3"></th></tr></thead>
            <tbody>{entries.map(e => (
              <tr key={e.id} className="border-t">
                <td className="p-3 font-medium">{e.bezeichnung}</td><td className="p-3">{e.anbieter || "-"}</td>
                <td className="p-3">{fmt(e.datum)}{e.bis_datum ? ` – ${fmt(e.bis_datum)}` : ""}</td>
                <td className="p-3 text-right">{fmtEuro(e.kosten)}</td>
                <td className="p-3 text-center">{e.zertifikat ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                <td className="p-3"><button onClick={() => handleDelete(e.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      ) : <p className="text-sm text-muted-foreground text-center py-4">Keine Fortbildungen eingetragen</p>}
    </div>
  );
}
