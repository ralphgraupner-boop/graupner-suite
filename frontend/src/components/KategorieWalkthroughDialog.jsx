import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, SkipForward, RotateCcw, ListChecks } from "lucide-react";
import { Modal } from "@/components/common";
import { api } from "@/lib/api";

/**
 * KategorieWalkthroughDialog
 *
 * Geführte Routine: führt Datensatz für Datensatz (Projekte ODER Kunden) durch
 * die Kategorie-Zuordnung. Pro Datensatz: aktuelle Kategorie + Vorschlag (über
 * die Keyword-Engine), Dropdown zum manuellen Korrigieren, Ja/Behalten/Überspringen.
 * Jede Übernahme legt im Backend einen Einzel-Snapshot an. Nur Preview.
 */
const KategorieWalkthroughDialog = ({ open, onClose, onChanged, initialModul = "projekte" }) => {
  const [modul, setModul] = useState(initialModul);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [records, setRecords] = useState([]);
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ changed: 0, kept: 0, skipped: 0 });
  const [done, setDone] = useState(false);

  const load = async (m) => {
    setLoading(true);
    setDone(false);
    setIdx(0);
    setStats({ changed: 0, kept: 0, skipped: 0 });
    try {
      const r = await api.get(`/modules/textvorlagen/category-walkthrough?modul=${m}`);
      setOptions(r.data.options || []);
      setRecords(r.data.records || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Laden fehlgeschlagen");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load(modul);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modul]);

  const cur = records[idx];

  useEffect(() => {
    if (cur) setChoice(cur.suggestion || cur.current || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, records]);

  const advance = () => {
    if (idx + 1 >= records.length) setDone(true);
    else setIdx(idx + 1);
  };

  const apply = async () => {
    if (!choice) return toast.error("Bitte eine Kategorie wählen");
    if (choice === cur.current) {
      setStats((s) => ({ ...s, kept: s.kept + 1 }));
      return advance();
    }
    setBusy(true);
    try {
      await api.post("/modules/textvorlagen/category-walkthrough/apply", {
        modul,
        id: cur.id,
        new_value: choice,
      });
      setStats((s) => ({ ...s, changed: s.changed + 1 }));
      onChanged?.();
      advance();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Übernehmen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const keep = () => {
    setStats((s) => ({ ...s, kept: s.kept + 1 }));
    advance();
  };

  const skip = () => {
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    advance();
  };

  if (!open) return null;

  return (
    <Modal isOpen={true} onClose={onClose} title="Kategorien Schritt für Schritt" size="md">
      <div className="p-4 space-y-4" data-testid="kategorie-walkthrough">
        {/* Modul-Umschalter */}
        <div className="flex gap-2" data-testid="walkthrough-modul-switch">
          {["projekte", "kunden"].map((m) => (
            <button
              key={m}
              onClick={() => setModul(m)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                modul === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`walkthrough-tab-${m}`}
            >
              {m === "projekte" ? "Projekte" : "Kunden"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Lade …
          </div>
        ) : records.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground" data-testid="walkthrough-empty">
            Keine Datensätze vorhanden.
          </div>
        ) : done ? (
          <div className="py-6 text-center space-y-4" data-testid="walkthrough-done">
            <ListChecks className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="text-lg font-semibold">Fertig!</div>
            <div className="text-sm text-muted-foreground">
              <div>✅ Geändert: <strong>{stats.changed}</strong></div>
              <div>↔️ Behalten: <strong>{stats.kept}</strong></div>
              <div>⏭️ Übersprungen: <strong>{stats.skipped}</strong></div>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => load(modul)} className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-sm hover:bg-muted" data-testid="walkthrough-restart">
                <RotateCcw className="w-4 h-4" /> Erneut durchgehen
              </button>
              <button onClick={onClose} className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-sm" data-testid="walkthrough-close-done">
                Schließen
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground" data-testid="walkthrough-progress">
              Datensatz {idx + 1} von {records.length}
            </div>

            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <div className="font-semibold text-base" data-testid="walkthrough-name">{cur.name}</div>
              {cur.preview && (
                <p className="text-xs text-muted-foreground line-clamp-3" data-testid="walkthrough-preview">{cur.preview}</p>
              )}

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Aktuell:</span>
                <span className="font-medium" data-testid="walkthrough-current">{cur.current || "—"}</span>
              </div>

              {cur.suggestion && (
                <div className="flex items-center gap-2 text-sm text-emerald-700" data-testid="walkthrough-suggestion">
                  <span className="text-muted-foreground">Vorschlag:</span>
                  <span className="font-semibold">{cur.suggestion}</span>
                  <span className="text-xs text-muted-foreground">({cur.suggestion_hits} Treffer)</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1">Neue Kategorie</label>
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className="w-full border rounded-sm px-2 py-2 text-sm bg-background"
                  data-testid="walkthrough-select"
                >
                  <option value="">— wählen —</option>
                  {options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={apply}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50"
                data-testid="walkthrough-apply"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Ja, übernehmen
              </button>
              <button
                onClick={keep}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border rounded-sm hover:bg-muted disabled:opacity-50"
                data-testid="walkthrough-keep"
              >
                <X className="w-4 h-4" /> Behalten
              </button>
              <button
                onClick={skip}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border rounded-sm hover:bg-muted disabled:opacity-50"
                data-testid="walkthrough-skip"
              >
                <SkipForward className="w-4 h-4" /> Überspringen
              </button>
            </div>

            {modul === "kunden" && (
              <p className="text-[11px] text-amber-700">
                Hinweis: Bei Kunden ersetzt „Ja" die Kategorien durch die gewählte. Ein Snapshot wird vorher gesichert.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default KategorieWalkthroughDialog;
export { KategorieWalkthroughDialog };
