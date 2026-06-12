/**
 * EinsatzFloatingButton — globales Floating-Icon zum schnellen Anlegen eines
 * Einsatzes von überall, ohne Seitenwechsel (Option b).
 *
 * Mounts: einmal in App.js (MainLayout), sitzt oberhalb der Wolke unten rechts.
 * Die Wolke (internes Kommunikations-Modul) bleibt unangetastet.
 *
 * Da das bestehende EinsatzModal zwingend einen Kunden im Kontext braucht,
 * blendet dieser Button bei fehlendem Kontext zuerst eine kleine
 * Kunden-Auswahl ein (Suche im Kundenstamm) und öffnet danach das EinsatzModal.
 */
import { useEffect, useState } from "react";
import { Wrench, X, Search } from "lucide-react";
import { api } from "@/lib/api";
import { EinsatzModal } from "@/components/EinsatzModal";

const kundeLabelOf = (k) =>
  k?.firma || [k?.vorname, k?.nachname].filter(Boolean).join(" ") || k?.name || "(ohne Name)";

export const EinsatzFloatingButton = () => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState([]);
  const [kundeId, setKundeId] = useState(null);

  // Kundensuche (gleiches Datenmasken-Prinzip wie in der Wolke)
  useEffect(() => {
    if (!pickerOpen || suche.trim().length < 2) { setTreffer([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/modules/kunden/data?search=${encodeURIComponent(suche.trim())}`);
        if (!cancel) setTreffer((res.data || []).slice(0, 10));
      } catch { /* ignore */ }
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [suche, pickerOpen]);

  const waehleKunde = (k) => {
    setPickerOpen(false);
    setSuche("");
    setTreffer([]);
    setKundeId(k.id);
  };

  return (
    <>
      {/* Floating Werkzeug-Icon (oberhalb der Wolke) */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="fixed z-40 bottom-36 right-4 md:bottom-24 md:right-6 w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center"
        data-testid="einsatz-floating-button"
        title="Neuen Einsatz anlegen"
      >
        <Wrench className="w-6 h-6" />
      </button>

      {/* Kunden-Picker */}
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setPickerOpen(false)} />
          <div
            className="fixed z-50 inset-x-4 bottom-24 md:inset-x-auto md:right-6 md:bottom-24 md:w-[380px] bg-background rounded-lg shadow-2xl border flex flex-col max-h-[60vh]"
            data-testid="einsatz-picker"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-orange-500" /> Einsatz — Kunde wählen
              </h2>
              <button onClick={() => setPickerOpen(false)} className="p-1.5 rounded hover:bg-muted" data-testid="einsatz-picker-close">
                <X className="w-4 h-4" />
              </button>
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
                  data-testid="einsatz-picker-search"
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
                    onClick={() => waehleKunde(k)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted"
                    data-testid={`einsatz-picker-result-${k.id}`}
                  >
                    {kundeLabelOf(k)}
                    {k.ort ? <span className="text-xs text-muted-foreground"> · {k.ort}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* EinsatzModal mit gewähltem Kunden */}
      <EinsatzModal
        open={!!kundeId}
        onClose={() => setKundeId(null)}
        onSaved={() => { try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ } }}
        context={kundeId ? { kundeId } : {}}
      />
    </>
  );
};

export default EinsatzFloatingButton;
