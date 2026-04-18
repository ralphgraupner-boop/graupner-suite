import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Pencil, Trash2, Search, Phone, Mail, X, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api } from "@/lib/api";

const MitarbeiterModulPage = () => {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mitarbeiter");
      setMitarbeiter(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = mitarbeiter.filter(m => {
    const term = search.toLowerCase();
    return !term || 
      (m.vorname || "").toLowerCase().includes(term) ||
      (m.nachname || "").toLowerCase().includes(term) ||
      (m.position || "").toLowerCase().includes(term) ||
      (m.personalnummer || "").includes(term);
  });

  const deleteMa = async (id) => {
    if (!window.confirm("Mitarbeiter wirklich löschen?")) return;
    try {
      await api.delete(`/mitarbeiter/${id}`);
      toast.success("Gelöscht");
      if (selected?.id === id) setSelected(null);
      load();
    } catch { toast.error("Fehler"); }
  };

  const statusColor = (s) => s === "aktiv" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto" data-testid="mitarbeiter-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Mitarbeiter</h1>
          <p className="text-muted-foreground mt-1 text-sm">{mitarbeiter.length} Mitarbeiter</p>
        </div>
        <button onClick={() => { setSelected(null); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium hover:bg-primary/90" data-testid="btn-new-mitarbeiter">
          <Plus className="w-4 h-4" /> Neuer Mitarbeiter
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen nach Name, Position, Personalnr..." className="w-full pl-10 pr-4 py-2 border rounded-sm text-sm" data-testid="mitarbeiter-search" />
      </div>

      {showForm && (
        <MitarbeiterForm
          item={selected}
          onClose={() => { setShowForm(false); setSelected(null); }}
          onSaved={() => { setShowForm(false); setSelected(null); load(); }}
        />
      )}

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">Keine Mitarbeiter gefunden.</Card>
        )}
        {filtered.map((m) => (
          <Card key={m.id} className="p-4 hover:shadow-md transition-shadow" data-testid={`ma-card-${m.id}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {(m.vorname || "?").charAt(0)}{(m.nachname || "?").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold truncate">{m.vorname} {m.nachname}</h3>
                    <Badge className={statusColor(m.status)}>{m.status || "aktiv"}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {m.position && <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{m.position}</span>}
                    {m.personalnummer && <span>Nr. {m.personalnummer}</span>}
                    {m.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.telefon}</span>}
                    {m.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</span>}
                    {m.wochenstunden > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.wochenstunden}h/Woche</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <button onClick={() => { setSelected(m); setShowForm(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteMa(m.id)} className="p-2 hover:bg-red-50 rounded-sm text-red-500" title="Löschen">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};


const MitarbeiterForm = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState({
    vorname: "", nachname: "", anrede: "Herr", personalnummer: "",
    position: "", telefon: "", email: "", status: "aktiv",
    wochenstunden: 40, stundenlohn: 0, lohnart: "stundenlohn",
    strasse: "", plz: "", ort: "", bemerkungen: "",
    fuehrerschein: "", eintrittsdatum: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        vorname: item.vorname || "", nachname: item.nachname || "",
        anrede: item.anrede || "Herr", personalnummer: item.personalnummer || "",
        position: item.position || "", telefon: item.telefon || "",
        email: item.email || "", status: item.status || "aktiv",
        wochenstunden: item.wochenstunden || 40, stundenlohn: item.stundenlohn || 0,
        lohnart: item.lohnart || "stundenlohn",
        strasse: item.strasse || "", plz: item.plz || "", ort: item.ort || "",
        bemerkungen: item.bemerkungen || "",
        fuehrerschein: item.fuehrerschein || "", eintrittsdatum: item.eintrittsdatum || ""
      });
    }
  }, [item]);

  const save = async () => {
    if (!form.vorname.trim() || !form.nachname.trim()) { toast.error("Vor- und Nachname erforderlich"); return; }
    setSaving(true);
    try {
      if (item) {
        await api.put(`/mitarbeiter/${item.id}`, form);
        toast.success("Gespeichert");
      } else {
        await api.post("/mitarbeiter", form);
        toast.success("Mitarbeiter angelegt");
      }
      onSaved();
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setSaving(false); }
  };

  const upd = (name, value) => setForm(f => ({ ...f, [name]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="mitarbeiter-form-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{item ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Anrede</label>
              <select value={form.anrede} onChange={e => upd("anrede", e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="ma-field-anrede">
                <option value="Herr">Herr</option><option value="Frau">Frau</option><option value="Divers">Divers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Vorname</label>
              <input value={form.vorname} onChange={e => upd("vorname", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="Max" data-testid="ma-field-vorname" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Nachname</label>
              <input value={form.nachname} onChange={e => upd("nachname", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="Mustermann" data-testid="ma-field-nachname" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Position</label>
              <input value={form.position} onChange={e => upd("position", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="z.B. Tischler, Monteur" data-testid="ma-field-position" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Personalnr.</label>
              <input value={form.personalnummer} onChange={e => upd("personalnummer", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="1001" data-testid="ma-field-personalnummer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Telefon</label>
              <input value={form.telefon} onChange={e => upd("telefon", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="040-123456" data-testid="ma-field-telefon" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">E-Mail</label>
              <input value={form.email} onChange={e => upd("email", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="name@firma.de" data-testid="ma-field-email" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Strasse</label>
              <input value={form.strasse} onChange={e => upd("strasse", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="Musterstr. 1" data-testid="ma-field-strasse" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">PLZ</label>
              <input value={form.plz} onChange={e => upd("plz", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="22453" data-testid="ma-field-plz" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Ort</label>
              <input value={form.ort} onChange={e => upd("ort", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="Hamburg" data-testid="ma-field-ort" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Status</label>
              <select value={form.status} onChange={e => upd("status", e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="ma-field-status">
                <option value="aktiv">aktiv</option><option value="inaktiv">inaktiv</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Wochenstunden</label>
              <input type="number" value={form.wochenstunden} onChange={e => upd("wochenstunden", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" data-testid="ma-field-wochenstunden" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Stundenlohn (EUR)</label>
              <input type="number" value={form.stundenlohn} onChange={e => upd("stundenlohn", Number(e.target.value))} className="w-full border rounded-sm p-2 text-sm" data-testid="ma-field-stundenlohn" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Fuehrerschein</label>
              <input value={form.fuehrerschein} onChange={e => upd("fuehrerschein", e.target.value)} className="w-full border rounded-sm p-2 text-sm" placeholder="B, BE, C" data-testid="ma-field-fuehrerschein" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Eintrittsdatum</label>
              <input type="date" value={form.eintrittsdatum} onChange={e => upd("eintrittsdatum", e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="ma-field-eintrittsdatum" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Bemerkungen</label>
            <textarea value={form.bemerkungen} onChange={e => upd("bemerkungen", e.target.value)} className="w-full border rounded-sm p-2 text-sm min-h-[60px]" placeholder="Notizen zum Mitarbeiter..." data-testid="ma-field-bemerkungen" />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50" data-testid="btn-save-mitarbeiter">
            {saving ? "Speichere..." : item ? "Speichern" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
};

export { MitarbeiterModulPage };
