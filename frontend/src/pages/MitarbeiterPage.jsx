import React, { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { toast } from "sonner";
import {
  Users, Plus, Pencil, Trash2, Search, UserPlus, Calendar, Heart,
  FileText, Euro, GraduationCap, Phone, Mail, MapPin, Shield, Clock,
  ChevronLeft, Upload, Download, AlertTriangle, CheckCircle, X, Eye,
  Briefcase, Baby, Building2, TrendingUp, XCircle, Car, CreditCard, UserCircle, Globe
} from "lucide-react";

const POSITIONS = ["Meister", "Geselle", "Azubi", "Büro", "Praktikant", "Aushilfe"];
const STEUERKLASSEN = ["1", "2", "3", "4", "5", "6"];
const KONFESSIONEN = ["keine", "ev", "rk", "andere"];
const KONFESSION_LABELS = { keine: "Keine / Konfessionslos", ev: "Evangelisch", rk: "Römisch-Katholisch", andere: "Andere" };
const BESCHAEFTIGUNGSARTEN = ["Vollzeit", "Teilzeit", "Minijob", "Azubi", "Werkstudent", "Praktikant"];
const FUEHRERSCHEINE = ["B", "BE", "B96", "C", "CE", "C1", "C1E", "Keiner"];
const DOK_KATEGORIEN = ["Arbeitsvertrag", "Zeugnis", "Bescheinigung", "AU-Bescheinigung", "Zertifikat", "Führerschein", "Sonstiges"];
const URLAUB_TYPEN = [
  { value: "urlaub", label: "Erholungsurlaub" },
  { value: "sonderurlaub", label: "Sonderurlaub" },
  { value: "unbezahlt", label: "Unbezahlter Urlaub" },
];

const fmt = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "-";
const fmtEuro = (v) => Number(v || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

// Konvertierung ISO → TT.MM.JJJJ und zurück
const isoToDE = (iso) => { if (!iso) return ""; const p = iso.split("-"); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso; };
const deToISO = (de) => { const m = de.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : de; };

function DateField({ label, value, editing, onChange }) {
  const [display, setDisplay] = useState(isoToDE(value || ""));
  useEffect(() => { setDisplay(isoToDE(value || "")); }, [value]);

  const handleChange = (e) => {
    let v = e.target.value.replace(/[^\d.]/g, "");
    // Auto-Punkte setzen
    const digits = v.replace(/\./g, "");
    if (digits.length >= 2 && !v.includes(".")) v = digits.slice(0, 2) + "." + digits.slice(2);
    if (digits.length >= 4 && v.split(".").length < 3) { const parts = v.split("."); v = parts[0] + "." + parts[1].slice(0, 2) + "." + (parts[1].slice(2) + (parts[2] || "")); }
    if (v.length > 10) v = v.slice(0, 10);
    setDisplay(v);
    if (v.match(/^\d{2}\.\d{2}\.\d{4}$/)) onChange(deToISO(v));
  };

  if (!editing) return (<div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label><p className="text-sm font-medium">{display || "-"}</p></div>);
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <Input value={display} onChange={handleChange} placeholder="TT.MM.JJJJ" className="h-9" maxLength={10} data-testid="input-geburtsdatum" />
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
    try {
      const res = await api.get("/mitarbeiter");
      setMitarbeiter(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    if (!search) return mitarbeiter;
    const s = search.toLowerCase();
    return mitarbeiter.filter(m =>
      `${m.vorname} ${m.nachname} ${m.position} ${m.personalnummer}`.toLowerCase().includes(s)
    );
  }, [mitarbeiter, search]);

  const aktive = mitarbeiter.filter(m => m.status === "aktiv").length;

  if (selected) {
    return <MitarbeiterDetail ma={selected} onBack={() => { setSelected(null); loadAll(); }} onUpdate={loadAll} />;
  }

  return (
    <div className="space-y-6" data-testid="mitarbeiter-page">
      {/* Header */}
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Gesamt" value={mitarbeiter.length} />
        <KpiCard icon={CheckCircle} label="Aktiv" value={aktive} color="text-green-600" />
        <KpiCard icon={Briefcase} label="Positionen" value={[...new Set(mitarbeiter.map(m => m.position).filter(Boolean))].length} />
        <KpiCard icon={GraduationCap} label="Azubis" value={mitarbeiter.filter(m => m.position === "Azubi").length} color="text-blue-600" />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Mitarbeiter suchen..."
          className="pl-10"
          data-testid="search-mitarbeiter"
        />
      </div>

      {/* List */}
      <div className="grid gap-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Laden...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Keine Mitarbeiter gefunden</p>
        ) : filtered.map(m => (
          <Card
            key={m.id}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4"
            style={{ borderLeftColor: m.status === "aktiv" ? "#16a34a" : "#9ca3af" }}
            onClick={() => setSelected(m)}
            data-testid={`ma-card-${m.id}`}
          >
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

      {/* New Employee Modal */}
      <NewMitarbeiterModal isOpen={showNew} onClose={() => setShowNew(false)} onCreated={(ma) => { loadAll(); setSelected(ma); setShowNew(false); }} />
    </div>
  );
}

// ════════════════════ KPI CARD ════════════════════

function KpiCard({ icon: Icon, label, value, color = "text-primary" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ════════════════════ NEW EMPLOYEE MODAL ════════════════════

function NewMitarbeiterModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({ vorname: "", nachname: "", position: "", email: "", telefon: "", eintrittsdatum: "", personalnummer: "", anrede: "Herr" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.vorname || !form.nachname) { toast.error("Vor- und Nachname erforderlich"); return; }
    setSaving(true);
    try {
      const res = await api.post("/mitarbeiter", form);
      toast.success("Mitarbeiter angelegt");
      onCreated(res.data);
      setForm({ vorname: "", nachname: "", position: "", email: "", telefon: "", eintrittsdatum: "", personalnummer: "", anrede: "Herr" });
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Neuer Mitarbeiter">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Anrede</label>
            <select value={form.anrede} onChange={e => setForm({ ...form, anrede: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3" data-testid="select-anrede">
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
              <option value="Divers">Divers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Personalnr.</label>
            <Input value={form.personalnummer} onChange={e => setForm({ ...form, personalnummer: e.target.value })} placeholder="z.B. 1001" data-testid="input-pnr" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Vorname *</label>
            <Input value={form.vorname} onChange={e => setForm({ ...form, vorname: e.target.value })} data-testid="input-vorname" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nachname *</label>
            <Input value={form.nachname} onChange={e => setForm({ ...form, nachname: e.target.value })} data-testid="input-nachname" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Position</label>
            <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3" data-testid="select-position">
              <option value="">Bitte wählen</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <DateField label="Eintrittsdatum" value={form.eintrittsdatum} editing={true} onChange={v => setForm({ ...form, eintrittsdatum: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Beschäftigungsart</label>
            <select value={form.beschaeftigungsart || ""} onChange={e => setForm({ ...form, beschaeftigungsart: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3" data-testid="select-beschaeftigung">
              <option value="">Bitte wählen</option>
              {BESCHAEFTIGUNGSARTEN.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Wochenstunden</label>
            <Input type="number" value={form.wochenstunden || ""} onChange={e => setForm({ ...form, wochenstunden: Number(e.target.value) })} placeholder="z.B. 40" data-testid="input-wochenstunden" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">E-Mail</label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-email" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Telefon</label>
            <Input value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} data-testid="input-telefon" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-ma">{saving ? "..." : "Anlegen"}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════ DETAIL VIEW ════════════════════

function MitarbeiterDetail({ ma: initialMa, onBack, onUpdate }) {
  const [ma, setMa] = useState(initialMa);
  const [activeTab, setActiveTab] = useState("stammdaten");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...initialMa });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadDetail(); loadStats(); }, []);

  const loadDetail = async () => {
    try {
      const res = await api.get(`/mitarbeiter/${ma.id}`);
      setMa(res.data);
      setForm(res.data);
    } catch {}
  };

  const loadStats = async () => {
    try {
      const res = await api.get(`/mitarbeiter/${ma.id}/statistiken`);
      setStats(res.data);
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/mitarbeiter/${ma.id}`, form);
      toast.success("Gespeichert");
      setEditing(false);
      loadDetail();
      onUpdate();
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${ma.vorname} ${ma.nachname} wirklich löschen? Alle Daten (Urlaub, Krankmeldungen, Dokumente) werden unwiderruflich gelöscht.`)) return;
    try {
      await api.delete(`/mitarbeiter/${ma.id}`);
      toast.success("Mitarbeiter gelöscht");
      onBack();
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
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
      {/* Back + Header */}
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
        <Button variant="destructive" size="sm" onClick={handleDelete} data-testid="btn-delete-ma">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Calendar} label="Resturlaub" value={`${stats.urlaub_rest} Tage`} color={stats.urlaub_rest < 5 ? "text-amber-600" : "text-green-600"} />
          <KpiCard icon={Calendar} label="Urlaub genommen" value={`${stats.urlaub_genommen}/${stats.urlaubsanspruch}`} />
          <KpiCard icon={Heart} label="Kranktage" value={stats.kranktage} color={stats.kranktage > 10 ? "text-red-600" : "text-muted-foreground"} />
          <KpiCard icon={Euro} label={ma.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"} value={ma.lohnart === "monatsgehalt" ? fmtEuro(ma.monatsgehalt) : fmtEuro(ma.stundenlohn)} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${t.id}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "stammdaten" && <StammdatenTab ma={ma} form={form} setForm={setForm} editing={editing} setEditing={setEditing} saving={saving} onSave={handleSave} />}
      {activeTab === "lohn" && <LohnTab ma={ma} onUpdate={() => { loadDetail(); loadStats(); }} />}
      {activeTab === "urlaub" && <UrlaubTab ma={ma} onUpdate={loadStats} />}
      {activeTab === "krankmeldungen" && <KrankmeldungenTab ma={ma} onUpdate={loadStats} />}
      {activeTab === "dokumente" && <DokumenteTab ma={ma} />}
      {activeTab === "fortbildungen" && <FortbildungenTab ma={ma} />}
    </div>
  );
}

// ════════════════════ STAMMDATEN TAB ════════════════════

function StammdatenTab({ ma, form, setForm, editing, setEditing, saving, onSave }) {
  const F = ({ label, field, type = "text", options, half = false }) => {
    const val = editing ? (form[field] ?? "") : (ma[field] ?? "");
    if (options) {
      return (
        <div className={half ? "" : ""}>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
          {editing ? (
            <select value={val} onChange={e => setForm({ ...form, [field]: e.target.value })} className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm">
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : <p className="text-sm font-medium">{val || "-"}</p>}
        </div>
      );
    }
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        {editing ? <Input type={type} value={val} onChange={e => setForm({ ...form, [field]: type === "number" ? Number(e.target.value) : e.target.value })} className="h-9" /> : <p className="text-sm font-medium">{type === "number" ? val : (val || "-")}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({ ...ma }); }}>Abbrechen</Button>
            <Button size="sm" onClick={onSave} disabled={saving} data-testid="btn-save-stamm">{saving ? "..." : "Speichern"}</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="btn-edit-stamm"><Pencil className="w-3.5 h-3.5 mr-1" /> Bearbeiten</Button>
        )}
      </div>

      {/* Persönliche Daten */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Persönliche Daten</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F label="Anrede" field="anrede" options={["Herr", "Frau", "Divers"]} />
          <F label="Vorname" field="vorname" />
          <F label="Nachname" field="nachname" />
          <DateField label="Geburtsdatum" value={editing ? form.geburtsdatum : ma.geburtsdatum} editing={editing} onChange={v => setForm({ ...form, geburtsdatum: v })} />
          <F label="Personalnummer" field="personalnummer" />
          <F label="Status" field="status" options={["aktiv", "inaktiv", "ausgeschieden"]} />
        </div>
      </Card>

      {/* Kontakt */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><Phone className="w-4 h-4" /> Kontaktdaten</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F label="Telefon" field="telefon" />
          <F label="E-Mail" field="email" type="email" />
          <F label="Straße" field="strasse" />
          <F label="PLZ" field="plz" />
          <F label="Ort" field="ort" />
        </div>
      </Card>

      {/* Beschäftigung */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Beschäftigung</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F label="Position" field="position" options={POSITIONS} />
          <F label="Beschäftigungsart" field="beschaeftigungsart" options={BESCHAEFTIGUNGSARTEN} />
          <F label="Wochenstunden" field="wochenstunden" type="number" />
          <DateField label="Eintrittsdatum" value={editing ? form.eintrittsdatum : ma.eintrittsdatum} editing={editing} onChange={v => setForm({ ...form, eintrittsdatum: v })} />
          <DateField label="Austrittsdatum" value={editing ? form.austrittsdatum : ma.austrittsdatum} editing={editing} onChange={v => setForm({ ...form, austrittsdatum: v })} />
          <F label="Urlaubsanspruch (Tage/Jahr)" field="urlaubsanspruch" type="number" />
        </div>
      </Card>

      {/* Steuer & SV */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Steuer & Sozialversicherung</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F label="Steuer-ID" field="steuer_id" />
          <F label="SV-Nummer" field="sv_nummer" />
          <F label="Krankenkasse" field="krankenkasse" />
          <F label="Steuerklasse" field="steuerklasse" options={STEUERKLASSEN} />
          <F label="Kinderfreibeträge" field="kinderfreibetraege" type="number" />
          <F label="Konfession" field="konfession" options={KONFESSIONEN} />
        </div>
      </Card>

      {/* Bankverbindung & Führerschein */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Bankverbindung & Sonstiges</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F label="IBAN" field="iban" />
          <F label="Bank" field="bank" />
          <F label="Führerscheinklasse" field="fuehrerschein" options={FUEHRERSCHEINE} />
        </div>
      </Card>

      {/* Notfall */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Notfallkontakt</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F label="Name" field="notfallkontakt_name" />
          <F label="Telefon" field="notfallkontakt_telefon" />
          <F label="Beziehung" field="notfallkontakt_beziehung" options={["Ehepartner/in", "Eltern", "Kind", "Geschwister", "Partner/in", "Sonstige"]} />
        </div>
      </Card>

      {/* Bemerkungen */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4">Bemerkungen</h3>
        {editing ? (
          <Textarea value={form.bemerkungen || ""} onChange={e => setForm({ ...form, bemerkungen: e.target.value })} rows={3} />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{ma.bemerkungen || "Keine Bemerkungen"}</p>
        )}
      </Card>
    </div>
  );
}

// ════════════════════ LOHN TAB ════════════════════

function LohnTab({ ma, onUpdate }) {
  const [history, setHistory] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ lohnart: ma.lohnart || "stundenlohn", stundenlohn: ma.stundenlohn || 0, monatsgehalt: ma.monatsgehalt || 0, gueltig_ab: "", bemerkung: "" });

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try { const res = await api.get(`/mitarbeiter/${ma.id}/lohnhistorie`); setHistory(res.data); } catch {}
  };

  const handleSave = async () => {
    if (!form.gueltig_ab) { toast.error("Gültig ab ist erforderlich"); return; }
    try {
      await api.post(`/mitarbeiter/${ma.id}/lohnhistorie`, form);
      toast.success("Lohnänderung gespeichert");
      setShowNew(false);
      loadHistory();
      onUpdate();
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  return (
    <div className="space-y-6">
      {/* Current */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><Euro className="w-4 h-4" /> Aktueller Lohn</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><p className="text-xs text-muted-foreground">Lohnart</p><p className="font-medium">{ma.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"}</p></div>
          <div><p className="text-xs text-muted-foreground">{ma.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"}</p><p className="font-medium text-lg">{ma.lohnart === "monatsgehalt" ? fmtEuro(ma.monatsgehalt) : fmtEuro(ma.stundenlohn)}</p></div>
          <div><p className="text-xs text-muted-foreground">Wochenstunden</p><p className="font-medium">{ma.wochenstunden || 40} Std.</p></div>
          <div><p className="text-xs text-muted-foreground">VWL (AN / AG)</p><p className="font-medium">{fmtEuro(ma.vwl_betrag)} / {fmtEuro(ma.vwl_ag_anteil)}</p></div>
        </div>
      </Card>

      {/* New Entry */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Lohnhistorie</h3>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-lohn"><Plus className="w-4 h-4 mr-1" /> Lohnänderung</Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DateField label="Gültig ab *" value={form.gueltig_ab} editing={true} onChange={v => setForm({ ...form, gueltig_ab: v })} />
            <div>
              <label className="block text-xs font-medium mb-1">Lohnart</label>
              <select value={form.lohnart} onChange={e => setForm({ ...form, lohnart: e.target.value })} className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm">
                <option value="stundenlohn">Stundenlohn</option>
                <option value="monatsgehalt">Monatsgehalt</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{form.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"}</label>
              <Input type="number" step="0.01" value={form.lohnart === "monatsgehalt" ? form.monatsgehalt : form.stundenlohn} onChange={e => setForm({ ...form, [form.lohnart === "monatsgehalt" ? "monatsgehalt" : "stundenlohn"]: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Bemerkung</label>
              <Input value={form.bemerkung} onChange={e => setForm({ ...form, bemerkung: e.target.value })} placeholder="z.B. Lohnerhöhung" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-lohn">Speichern</Button>
          </div>
        </Card>
      )}

      {/* History Table */}
      {history.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Gültig ab</th>
                <th className="text-left p-3 font-medium">Lohnart</th>
                <th className="text-right p-3 font-medium">Betrag</th>
                <th className="text-left p-3 font-medium">Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-t">
                  <td className="p-3">{fmt(h.gueltig_ab)}</td>
                  <td className="p-3">{h.lohnart === "monatsgehalt" ? "Monatsgehalt" : "Stundenlohn"}</td>
                  <td className="p-3 text-right font-medium">{h.lohnart === "monatsgehalt" ? fmtEuro(h.monatsgehalt) : fmtEuro(h.stundenlohn)}</td>
                  <td className="p-3 text-muted-foreground">{h.bemerkung || "-"}</td>
                </tr>
              ))}
            </tbody>
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
    const a = new Date(von), b = new Date(bis);
    let count = 0;
    const cur = new Date(a);
    while (cur <= b) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  };

  const handleDateChange = (field, val) => {
    const newForm = { ...form, [field]: val };
    if (newForm.von && newForm.bis) newForm.tage = calcDays(newForm.von, newForm.bis);
    setForm(newForm);
  };

  const handleSave = async () => {
    if (!form.von || !form.bis) { toast.error("Von und Bis erforderlich"); return; }
    try { await api.post(`/mitarbeiter/${ma.id}/urlaub`, form); toast.success("Urlaub eingetragen"); setShowNew(false); setForm({ von: "", bis: "", tage: 0, typ: "urlaub", status: "genehmigt", bemerkung: "" }); load(); onUpdate(); } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/mitarbeiter/${ma.id}/urlaub/${id}`); toast.success("Gelöscht"); load(); onUpdate(); } catch {}
  };

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
            <div>
              <label className="block text-xs font-medium mb-1">Von *</label>
              <Input type="date" value={form.von} onChange={e => handleDateChange("von", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Bis *</label>
              <Input type="date" value={form.bis} onChange={e => handleDateChange("bis", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Arbeitstage</label>
              <Input type="number" value={form.tage} onChange={e => setForm({ ...form, tage: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Typ</label>
              <select value={form.typ} onChange={e => setForm({ ...form, typ: e.target.value })} className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm">
                {URLAUB_TYPEN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm">
                <option value="beantragt">Beantragt</option>
                <option value="genehmigt">Genehmigt</option>
                <option value="genommen">Genommen</option>
                <option value="abgelehnt">Abgelehnt</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium mb-1">Bemerkung</label>
            <Input value={form.bemerkung} onChange={e => setForm({ ...form, bemerkung: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-urlaub">Speichern</Button>
          </div>
        </Card>
      )}

      {entries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Von</th>
                <th className="text-left p-3 font-medium">Bis</th>
                <th className="text-right p-3 font-medium">Tage</th>
                <th className="text-left p-3 font-medium">Typ</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Bemerkung</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">{fmt(e.von)}</td>
                  <td className="p-3">{fmt(e.bis)}</td>
                  <td className="p-3 text-right font-medium">{e.tage}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${typColors[e.typ] || ""}`}>{URLAUB_TYPEN.find(t => t.value === e.typ)?.label || e.typ}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[e.status] || ""}`}>{e.status}</span></td>
                  <td className="p-3 text-muted-foreground">{e.bemerkung || "-"}</td>
                  <td className="p-3"><button onClick={() => handleDelete(e.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
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
    const a = new Date(von), b = new Date(bis);
    let count = 0; const cur = new Date(a);
    while (cur <= b) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  };

  const handleDateChange = (field, val) => {
    const newForm = { ...form, [field]: val };
    if (newForm.von && newForm.bis) newForm.tage = calcDays(newForm.von, newForm.bis);
    setForm(newForm);
  };

  const handleSave = async () => {
    if (!form.von) { toast.error("Datum erforderlich"); return; }
    try { await api.post(`/mitarbeiter/${ma.id}/krankmeldungen`, form); toast.success("Krankmeldung eingetragen"); setShowNew(false); setForm({ von: "", bis: "", tage: 0, au_bescheinigung: false, arzt: "", bemerkung: "" }); load(); onUpdate(); } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/mitarbeiter/${ma.id}/krankmeldungen/${id}`); toast.success("Gelöscht"); load(); onUpdate(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Krankmeldungen</h3>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-krank"><Plus className="w-4 h-4 mr-1" /> Krankmeldung</Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Von *</label>
              <Input type="date" value={form.von} onChange={e => handleDateChange("von", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Bis</label>
              <Input type="date" value={form.bis} onChange={e => handleDateChange("bis", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Arbeitstage</label>
              <Input type="number" value={form.tage} onChange={e => setForm({ ...form, tage: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Arzt</label>
              <Input value={form.arzt} onChange={e => setForm({ ...form, arzt: e.target.value })} placeholder="Name des Arztes" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.au_bescheinigung} onChange={e => setForm({ ...form, au_bescheinigung: e.target.checked })} className="rounded" />
                AU vorhanden
              </label>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium mb-1">Bemerkung</label>
            <Input value={form.bemerkung} onChange={e => setForm({ ...form, bemerkung: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-krank">Speichern</Button>
          </div>
        </Card>
      )}

      {entries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Von</th>
                <th className="text-left p-3 font-medium">Bis</th>
                <th className="text-right p-3 font-medium">Tage</th>
                <th className="text-left p-3 font-medium">Arzt</th>
                <th className="text-center p-3 font-medium">AU</th>
                <th className="text-left p-3 font-medium">Bemerkung</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">{fmt(e.von)}</td>
                  <td className="p-3">{fmt(e.bis)}</td>
                  <td className="p-3 text-right font-medium">{e.tage}</td>
                  <td className="p-3">{e.arzt || "-"}</td>
                  <td className="p-3 text-center">{e.au_bescheinigung ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                  <td className="p-3 text-muted-foreground">{e.bemerkung || "-"}</td>
                  <td className="p-3"><button onClick={() => handleDelete(e.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : <p className="text-sm text-muted-foreground text-center py-4">Keine Krankmeldungen</p>}
    </div>
  );
}

// ════════════════════ DOKUMENTE TAB ════════════════════

const DOK_SEKTIONEN = [
  { key: "mitarbeiter", label: "Dokumente für Ihre Mitarbeiter", icon: UserCircle, hint: "Lohnabrechnungen, Bescheinigungen, Verträge für den Mitarbeiter",
    kategorien: ["Lohnabrechnung", "Arbeitsvertrag", "Nachtrag", "Zeugnis", "Bescheinigung", "Sonstiges"] },
  { key: "arbeitgeber", label: "Dokumente für Sie als Arbeitgeber", icon: Building2, hint: "Bewerbungsunterlagen, Personalfragebogen, Steuer-Anmeldung",
    kategorien: ["Bewerbung", "Personalfragebogen", "Steuer-Anmeldung", "SV-Meldung", "Führungszeugnis", "Gesundheitszeugnis", "Sonstiges"] },
  { key: "entsendung", label: "Entsendungen (A1)", icon: Globe, hint: "A1-Bescheinigungen für Auslandseinsätze (EU)",
    kategorien: ["A1-Bescheinigung", "Entsendungsvertrag", "Sonstiges"] },
  { key: "entgelt", label: "Entgeltbescheinigungen", icon: Euro, hint: "Verdienstbescheinigungen, ELStAM, Jahresmeldungen",
    kategorien: ["Verdienstbescheinigung", "ELStAM", "Jahresmeldung", "Sonstiges"] },
  { key: "bea", label: "Arbeitsbescheinigungen (BEA)", icon: FileText, hint: "Arbeitsbescheinigungen für die Agentur für Arbeit",
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

  const handleDelete = async (id) => {
    try { await api.delete(`/mitarbeiter/${ma.id}/dokumente/${id}`); toast.success("Gelöscht"); load(); } catch {}
  };

  const getDocsForSection = (sectionKey) => docs.filter(d => (d.kategorie || "").startsWith(sectionKey + "::") || (!d.kategorie?.includes("::") && sectionKey === "mitarbeiter" && DOK_SEKTIONEN[0].kategorien.some(k => k === d.kategorie)));

  return (
    <div className="space-y-4" data-testid="dokumente-tab">
      {DOK_SEKTIONEN.map(section => {
        const sectionDocs = getDocsForSection(section.key);
        const isOpen = expandedSection === section.key;
        return (
          <Card key={section.key} className="overflow-hidden">
            <button
              onClick={() => setExpandedSection(isOpen ? null : section.key)}
              className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
              data-testid={`dok-section-${section.key}`}
            >
              <section.icon className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{section.label}</p>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">{sectionDocs.length}</span>
              <ChevronLeft className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "-rotate-90" : ""}`} />
            </button>

            {isOpen && (
              <div className="border-t px-4 pb-4 pt-3 space-y-3">
                {/* Upload */}
                <DokUploadRow
                  kategorien={section.kategorien}
                  sectionKey={section.key}
                  uploading={uploading === section.key}
                  onUpload={handleUpload}
                />

                {/* Files list */}
                {sectionDocs.length > 0 ? (
                  <div className="grid gap-2">
                    {sectionDocs.map(d => {
                      const katLabel = (d.kategorie || "").includes("::") ? d.kategorie.split("::")[1] : d.kategorie;
                      return (
                        <div key={d.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{d.filename}</p>
                            <p className="text-xs text-muted-foreground">{katLabel} · {fmt(d.created_at)}</p>
                          </div>
                          {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="p-1 hover:text-primary" title="Herunterladen"><Download className="w-4 h-4" /></a>}
                          <button onClick={() => handleDelete(d.id)} className="p-1 hover:text-red-600" title="Löschen"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">Keine Dokumente in dieser Kategorie</p>
                )}
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
  const fileRef = React.useRef(null);

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
    try { await api.post(`/mitarbeiter/${ma.id}/fortbildungen`, form); toast.success("Fortbildung eingetragen"); setShowNew(false); setForm({ bezeichnung: "", anbieter: "", datum: "", bis_datum: "", kosten: 0, zertifikat: false, bemerkung: "" }); load(); } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/mitarbeiter/${ma.id}/fortbildungen/${id}`); toast.success("Gelöscht"); load(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Fortbildungen & Schulungen</h3>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="btn-new-fortbildung"><Plus className="w-4 h-4 mr-1" /> Fortbildung</Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Bezeichnung *</label>
              <Input value={form.bezeichnung} onChange={e => setForm({ ...form, bezeichnung: e.target.value })} placeholder="z.B. CNC-Kurs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Anbieter</label>
              <Input value={form.anbieter} onChange={e => setForm({ ...form, anbieter: e.target.value })} placeholder="z.B. HWK Hamburg" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Kosten</label>
              <Input type="number" step="0.01" value={form.kosten} onChange={e => setForm({ ...form, kosten: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Von</label>
              <Input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Bis</label>
              <Input type="date" value={form.bis_datum} onChange={e => setForm({ ...form, bis_datum: e.target.value })} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.zertifikat} onChange={e => setForm({ ...form, zertifikat: e.target.checked })} className="rounded" />
                Zertifikat erhalten
              </label>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium mb-1">Bemerkung</label>
            <Input value={form.bemerkung} onChange={e => setForm({ ...form, bemerkung: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-fortbildung">Speichern</Button>
          </div>
        </Card>
      )}

      {entries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Bezeichnung</th>
                <th className="text-left p-3 font-medium">Anbieter</th>
                <th className="text-left p-3 font-medium">Zeitraum</th>
                <th className="text-right p-3 font-medium">Kosten</th>
                <th className="text-center p-3 font-medium">Zertifikat</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-medium">{e.bezeichnung}</td>
                  <td className="p-3">{e.anbieter || "-"}</td>
                  <td className="p-3">{fmt(e.datum)}{e.bis_datum ? ` – ${fmt(e.bis_datum)}` : ""}</td>
                  <td className="p-3 text-right">{fmtEuro(e.kosten)}</td>
                  <td className="p-3 text-center">{e.zertifikat ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                  <td className="p-3"><button onClick={() => handleDelete(e.id)} className="p-1 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : <p className="text-sm text-muted-foreground text-center py-4">Keine Fortbildungen eingetragen</p>}
    </div>
  );
}
