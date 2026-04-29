import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Calendar, Plus, Trash2, X, ChevronDown, ChevronUp, MapPin, Clock, Pencil,
  AlertTriangle, CheckCircle2, XCircle, HardHat,
} from "lucide-react";
import { TerminSendDialog } from "@/components/TerminSendDialog";

const STATUS = {
  wartet_auf_go: { cls: "bg-amber-50 text-amber-800 border-amber-200", icon: AlertTriangle, label: "Wartet auf GO" },
  bestaetigt: { cls: "bg-blue-50 text-blue-800 border-blue-200", icon: Clock, label: "Bestätigt" },
  im_kalender: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2, label: "Im Kalender" },
  abgesagt: { cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle, label: "Abgesagt" },
};

const TYP_LABEL = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
  abnahme: "Abnahme",
  intern: "Intern",
  sonstiges: "Sonstiges",
};

const fmtDateTime = (s) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
  catch { return s; }
};

/**
 * Wiederverwendbares Termine-Panel.
 * Datenmaske: liest und schreibt nur in module_termine, gefiltert auf Kunde oder Projekt.
 */
export const TerminePanel = ({ kunde_id = "", projekt_id = "", title = "Termine", defaultCollapsed = true, compact = true }) => {
  const [termine, setTermine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sendingTermin, setSendingTermin] = useState(null);
  const [mitarbeiter, setMitarbeiter] = useState([]);

  const params = {};
  if (kunde_id) params.kunde_id = kunde_id;
  if (projekt_id) params.projekt_id = projekt_id;

  const load = async () => {
    if (!kunde_id && !projekt_id) return;
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        api.get("/module-termine", { params }),
        mitarbeiter.length ? Promise.resolve({ data: mitarbeiter }) : api.get("/module-aufgaben/mitarbeiter").catch(() => ({ data: [] })),
      ]);
      setTermine(Array.isArray(r.data) ? r.data : []);
      if (!mitarbeiter.length) setMitarbeiter(Array.isArray(m.data) ? m.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Termine konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [kunde_id, projekt_id]);  // eslint-disable-line

  const onGo = async (t) => {
    if (!window.confirm(`Termin "${t.titel}" am ${fmtDateTime(t.start)} bestätigen (GO)?`)) return;
    try {
      await api.patch(`/module-termine/${t.id}/go`);
      toast.success("Termin bestätigt – jetzt Empfänger wählen und ICS senden");
      setSendingTermin(t);  // Empfänger-Dialog öffnen
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "GO fehlgeschlagen"); }
  };

  const onCancel = async (t) => {
    const grund = window.prompt(`Grund für Absage von "${t.titel}"?`, "");
    if (grund === null) return;
    try {
      await api.patch(`/module-termine/${t.id}/cancel`, { status: "abgesagt", grund });
      toast.success("Termin abgesagt"); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Absage fehlgeschlagen"); }
  };

  const onDelete = async (t) => {
    if (!window.confirm(`Termin "${t.titel}" löschen?`)) return;
    try {
      await api.delete(`/module-termine/${t.id}`);
      toast.success("Termin gelöscht"); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen"); }
  };

  const offenCount = termine.filter(t => t.status === "wartet_auf_go" || t.status === "bestaetigt").length;

  return (
    <div className="border rounded-md bg-background" data-testid={`termine-panel-${kunde_id || projekt_id}`}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{title}</span>
          {termine.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {offenCount > 0 ? `${offenCount} offen / ` : ""}{termine.length} gesamt
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!collapsed && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowCreate(true); } }}
              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 flex items-center gap-1 cursor-pointer"
              data-testid={`btn-termin-add-${kunde_id || projekt_id}`}
            >
              <Plus className="w-3 h-3" /> Neu
            </span>
          )}
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t p-3 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-3">Lade…</p>
          ) : termine.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Keine Termine für {kunde_id ? "diesen Kunden" : "dieses Projekt"}.
              <button onClick={() => setShowCreate(true)} className="block mx-auto mt-2 text-primary hover:underline">
                + Ersten Termin anlegen
              </button>
            </div>
          ) : (
            termine.map(t => {
              const sty = STATUS[t.status] || STATUS.wartet_auf_go;
              const Icon = sty.icon;
              const monteurName = mitarbeiter.find(m => m.username === t.monteur_username)?.anzeige_name;
              return (
                <div
                  key={t.id}
                  className="border rounded-sm p-2"
                  data-testid={`panel-termin-${t.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`p-1 rounded-sm border ${sty.cls} flex-shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{t.titel}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${sty.cls}`}>{sty.label}</span>
                        <span className="text-[10px] text-muted-foreground">{TYP_LABEL[t.typ] || t.typ}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDateTime(t.start)}</span>
                        {t.ort && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {t.ort}</span>}
                        {monteurName && <span className="flex items-center gap-1"><HardHat className="w-3 h-3" /> {monteurName}</span>}
                      </div>
                      {!compact && t.beschreibung && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.beschreibung}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {t.status === "wartet_auf_go" && (
                        <button
                          onClick={() => onGo(t)}
                          className="text-xs px-2 py-0.5 bg-emerald-500 text-white rounded-sm hover:bg-emerald-600 font-bold"
                          data-testid={`panel-termin-go-${t.id}`}
                        >
                          GO
                        </button>
                      )}
                      {(t.status === "bestaetigt" || t.status === "im_kalender") && (
                        <button
                          onClick={() => setSendingTermin(t)}
                          className="text-xs px-2 py-0.5 border border-blue-300 text-blue-700 rounded-sm hover:bg-blue-50"
                          title="ICS-Mail (erneut) senden"
                          data-testid={`panel-termin-send-${t.id}`}
                        >
                          📧
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1 text-muted-foreground hover:bg-muted rounded-sm"
                        title="Bearbeiten"
                        data-testid={`panel-termin-edit-${t.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {t.status !== "abgesagt" && t.status !== "im_kalender" && (
                        <button
                          onClick={() => onCancel(t)}
                          className="text-xs px-1.5 py-0.5 border border-red-200 text-red-700 rounded-sm hover:bg-red-50"
                          title="Absagen"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(t)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-sm"
                        title="Löschen"
                        data-testid={`panel-termin-delete-${t.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {(showCreate || editing) && (
        <QuickTerminDialog
          existing={editing}
          kunde_id={kunde_id}
          projekt_id={projekt_id}
          mitarbeiter={mitarbeiter}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}

      {sendingTermin && (
        <TerminSendDialog
          termin_id={sendingTermin.id}
          onClose={() => setSendingTermin(null)}
          onSent={() => { setSendingTermin(null); load(); }}
        />
      )}
    </div>
  );
};

const toLocalInput = (s) => {
  if (!s) return "";
  // Backend liefert ISO; datetime-local braucht "YYYY-MM-DDTHH:MM"
  try {
    const d = new Date(s);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return s.slice(0, 16); }
};

const QuickTerminDialog = ({ existing, kunde_id, projekt_id, mitarbeiter, onClose, onSaved }) => {
  const isEdit = !!existing;
  const [data, setData] = useState({
    titel: existing?.titel || "",
    typ: existing?.typ || "ausfuehrung",
    start: toLocalInput(existing?.start) || "",
    ende: toLocalInput(existing?.ende) || "",
    ort: existing?.ort || "",
    beschreibung: existing?.beschreibung || "",
    monteur_username: existing?.monteur_username || "",
    kunde_id: existing?.kunde_id || kunde_id,
    projekt_id: existing?.projekt_id || projekt_id,
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setData(d => ({ ...d, [k]: v }));

  const save = async () => {
    if (!data.titel.trim()) { toast.error("Titel erforderlich"); return; }
    if (!data.start.trim()) { toast.error("Startzeit erforderlich"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/module-termine/${existing.id}`, data);
        toast.success("Termin aktualisiert");
      } else {
        await api.post("/module-termine", data);
        toast.success("Termin angelegt – wartet auf GO");
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="termin-quick-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">{isEdit ? "Termin bearbeiten" : "Neuer Termin"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <input
              value={data.titel}
              onChange={(e) => upd("titel", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="z. B. Aufmaß vor Ort"
              data-testid="quick-termin-titel"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Typ</label>
              <select
                value={data.typ}
                onChange={(e) => upd("typ", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="quick-termin-typ"
              >
                {Object.keys(TYP_LABEL).map(t => <option key={t} value={t}>{TYP_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ort / Adresse</label>
              <input
                value={data.ort}
                onChange={(e) => upd("ort", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                placeholder="optional"
                data-testid="quick-termin-ort"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start *</label>
              <input
                type="datetime-local"
                value={data.start}
                onChange={(e) => upd("start", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="quick-termin-start"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ende</label>
              <input
                type="datetime-local"
                value={data.ende}
                onChange={(e) => upd("ende", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="quick-termin-ende"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monteur</label>
            <select
              value={data.monteur_username}
              onChange={(e) => upd("monteur_username", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="quick-termin-monteur"
            >
              <option value="">— niemand —</option>
              {mitarbeiter.map(m => (
                <option key={m.username} value={m.username}>{m.anzeige_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung / Arbeitsanweisung</label>
            <textarea
              value={data.beschreibung}
              onChange={(e) => upd("beschreibung", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[60px]"
              placeholder="optional"
              data-testid="quick-termin-beschreibung"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Änderungen werden sofort gespeichert. Bei Datums-/Empfänger-Änderungen ggf. ICS-Mail erneut senden."
              : `Termin wird ${kunde_id ? "diesem Kunden" : "diesem Projekt"} zugeordnet und erscheint hier sowie im Termine-Modul. Status: „Wartet auf GO" – muss von dir per GO bestätigt werden.`}
          </p>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="quick-termin-save"
          >
            {saving ? "Speichere…" : isEdit ? "Speichern" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminePanel;
