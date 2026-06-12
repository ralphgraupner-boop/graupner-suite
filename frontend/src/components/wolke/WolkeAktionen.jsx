/**
 * WolkeAktionen — Schnell-Aktionen im „+ Neu"-Tab der Wolke.
 *
 * Ruft ausschließlich bestehende Module/Dialoge auf (Module-First, kein Neubau):
 *  - Neuer Einsatz → bestehendes EinsatzModal (mit Kunden-Auswahl davor)
 *  - Neue Aufgabe  → bestehender QuickAufgabeDialog
 *  - Neuer Termin  → bestehender QuickTerminDialog
 *  - Notiz         → bestehendes Notizen-Modul (POST /module-feedback)
 *
 * Erweiterbar: weitere Module einfach als zusätzlichen Button + Zweig ergänzen.
 */
import { useEffect, useState } from "react";
import { Wrench, Briefcase, Calendar, StickyNote, X, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { EinsatzModal } from "@/components/EinsatzModal";
import { QuickAufgabeDialog } from "@/components/AufgabenPanel";
import { QuickTerminDialog } from "@/components/TerminePanel";

const kundeLabelOf = (k) =>
  k?.firma || [k?.vorname, k?.nachname].filter(Boolean).join(" ") || k?.name || "(ohne Name)";

const AKTIONEN = [
  { id: "einsatz", label: "Neuer Einsatz", icon: Wrench, color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
  { id: "aufgabe", label: "Neue Aufgabe", icon: Briefcase, color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  { id: "termin", label: "Neuer Termin", icon: Calendar, color: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" },
  { id: "notiz", label: "Notiz", icon: StickyNote, color: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" },
];

export const WolkeAktionen = ({ onCreated, kunde }) => {
  const [aktion, setAktion] = useState(null);

  // Einsatz: Kunden-Auswahl davor (EinsatzModal braucht zwingend einen Kunden)
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState([]);
  const [einsatzKundeId, setEinsatzKundeId] = useState(null);

  // Notiz
  const [notizText, setNotizText] = useState("");
  const [notizSaving, setNotizSaving] = useState(false);

  useEffect(() => {
    if (aktion !== "einsatz" || suche.trim().length < 2) { setTreffer([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/modules/kunden/data?search=${encodeURIComponent(suche.trim())}`);
        if (!cancel) setTreffer((res.data || []).slice(0, 10));
      } catch { /* ignore */ }
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [suche, aktion]);

  const reset = () => {
    setAktion(null);
    setSuche("");
    setTreffer([]);
    setEinsatzKundeId(null);
    setNotizText("");
  };

  const fertig = () => { onCreated?.(); reset(); };

  const speichereNotiz = async () => {
    const text = notizText.trim();
    if (!text) { toast.error("Bitte Text eingeben"); return; }
    setNotizSaving(true);
    try {
      await api.post("/module-feedback", {
        title: text.slice(0, 120),
        description: text.length > 120 ? text : "",
        typ: "idee",
        prio: "normal",
      });
      toast.success("Notiz gespeichert");
      fertig();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setNotizSaving(false);
    }
  };

  return (
    <>
      {/* Aktions-Buttons */}
      <div className="grid grid-cols-2 gap-2" data-testid="wolke-aktionen">
        {AKTIONEN.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAktion(id)}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${color}`}
            data-testid={`wolke-aktion-${id}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      <div className="my-3 border-t" />

      {/* Einsatz: bei vorgewähltem Kunden Picker überspringen, sonst Kunden-Auswahl */}
      {aktion === "einsatz" && !einsatzKundeId && !kunde?.id && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={reset}>
          <div className="bg-background rounded-lg shadow-2xl border w-full max-w-sm flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()} data-testid="wolke-einsatz-picker">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-base font-bold flex items-center gap-2"><Wrench className="w-4 h-4 text-orange-500" /> Einsatz — Kunde wählen</h2>
              <button onClick={reset} className="p-1.5 rounded hover:bg-muted" data-testid="wolke-einsatz-picker-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder="Name / Firma suchen…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
                  data-testid="wolke-einsatz-picker-search"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {suche.trim().length < 2 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Mindestens 2 Zeichen eingeben.</p>
              ) : treffer.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Kein Kunde gefunden.</p>
              ) : (
                treffer.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setEinsatzKundeId(k.id)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted"
                    data-testid={`wolke-einsatz-kunde-${k.id}`}
                  >
                    {kundeLabelOf(k)}{k.ort ? <span className="text-xs text-muted-foreground"> · {k.ort}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {aktion === "einsatz" && (einsatzKundeId || kunde?.id) && (
        <EinsatzModal open onClose={reset} onSaved={fertig} context={{ kundeId: einsatzKundeId || kunde.id }} />
      )}

      {/* Aufgabe (bestehender Dialog; Kunde vorbelegt → Projektauswahl im Dialog) */}
      {aktion === "aufgabe" && (
        <QuickAufgabeDialog kunde_id={kunde?.id || ""} projekt_id="" mitarbeiter={[]} onClose={reset} onSaved={fertig} />
      )}

      {/* Termin (bestehender Dialog; Kunde vorbelegt → Projektauswahl im Dialog) */}
      {aktion === "termin" && (
        <QuickTerminDialog kunde_id={kunde?.id || ""} projekt_id="" mitarbeiter={[]} onClose={reset} onSaved={fertig} />
      )}

      {/* Notiz (einfaches Freitextfeld → Notizen-Modul) */}
      {aktion === "notiz" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={reset}>
          <div className="bg-background rounded-lg shadow-2xl border w-full max-w-md" onClick={(e) => e.stopPropagation()} data-testid="wolke-notiz-dialog">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-base font-bold flex items-center gap-2"><StickyNote className="w-4 h-4 text-slate-500" /> Neue Notiz</h2>
              <button onClick={reset} className="p-1.5 rounded hover:bg-muted" data-testid="wolke-notiz-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                autoFocus
                value={notizText}
                onChange={(e) => setNotizText(e.target.value)}
                rows={5}
                placeholder="Notiz eingeben…"
                className="w-full border rounded-lg p-2 text-sm resize-y"
                data-testid="wolke-notiz-text"
              />
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button onClick={reset} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
              <button
                onClick={speichereNotiz}
                disabled={notizSaving}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
                data-testid="wolke-notiz-save"
              >
                {notizSaving && <Loader2 className="w-4 h-4 animate-spin" />} Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WolkeAktionen;
