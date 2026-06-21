import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, SkipForward, RotateCcw, ListChecks, HelpCircle } from "lucide-react";
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
  const [showHelp, setShowHelp] = useState(false);
  const [askMode, setAskMode] = useState(false); // Kunden: ersetzen/hinzufügen?

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
    // Kunden mit bereits vorhandenen Kategorien: erst fragen ersetzen/hinzufügen
    if (modul === "kunden" && (cur.current || "").trim()) {
      setAskMode(true);
      return;
    }
    await doApply("ersetzen");
  };

  const doApply = async (mode) => {
    setAskMode(false);
    setBusy(true);
    try {
      await api.post("/modules/textvorlagen/category-walkthrough/apply", {
        modul,
        id: cur.id,
        new_value: choice,
        mode,
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
        <div className="flex items-center gap-2" data-testid="walkthrough-modul-switch">
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
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Hilfe (F1)"
            data-testid="walkthrough-help-toggle"
          >
            <HelpCircle className="w-4 h-4" /> Hilfe
          </button>
        </div>

        {showHelp && (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 space-y-1.5" data-testid="walkthrough-help">
            <div className="font-semibold">F1-Hilfe — Kategorien Schritt für Schritt</div>
            <p>
              Dieser Dialog führt dich <b>einzeln</b> durch alle Projekte bzw. Kunden, damit du jedem Datensatz
              die richtige Kategorie zuweisen kannst.
            </p>
            <p>
              <b>Vorschlag:</b> Die Suite liest Titel/Beschreibung (bzw. Anliegen/Nachricht) und vergleicht sie
              mit den <b>Stichwörtern</b> der Kategorien. Die beste Übereinstimmung wird mit Trefferzahl vorgeschlagen.
              Im <b>Dropdown</b> kannst du den Vorschlag jederzeit von Hand korrigieren.
            </p>
            <p>
              <b>Ja, übernehmen</b> = gewählte Kategorie speichern (mit automatischem Snapshot). ·
              <b> Behalten</b> = aktuelle Kategorie unverändert lassen. ·
              <b> Überspringen</b> = später entscheiden, nichts ändern.
            </p>
            <p>
              <b>Nur bei Kunden:</b> Hat ein Kunde schon Kategorien, fragt die Suite nach —
              <b> Ersetzen</b> (alte durch neue tauschen) oder <b>Hinzufügen</b> (neue zusätzlich behalten).
            </p>
          </div>
        )}

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

            {askMode && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2" data-testid="walkthrough-ask-mode">
                <p className="text-sm font-medium">Kategorie ersetzen oder hinzufügen?</p>
                <p className="text-xs text-muted-foreground">
                  Aktuell: <strong>{cur.current}</strong> → Neu: <strong>{choice}</strong>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => doApply("ersetzen")}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50"
                    data-testid="walkthrough-mode-ersetzen"
                  >
                    Ersetzen
                  </button>
                  <button
                    onClick={() => doApply("hinzufuegen")}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-primary text-primary rounded-sm hover:bg-primary/10 disabled:opacity-50"
                    data-testid="walkthrough-mode-hinzufuegen"
                  >
                    Hinzufügen
                  </button>
                </div>
                <button onClick={() => setAskMode(false)} className="text-xs text-muted-foreground hover:text-foreground" data-testid="walkthrough-mode-cancel">
                  Abbrechen
                </button>
              </div>
            )}

            {modul === "kunden" && !askMode && (
              <p className="text-[11px] text-amber-700">
                Hinweis: Bei Kunden mit vorhandener Kategorie fragt die Suite nach „Ersetzen oder Hinzufügen". Ein Snapshot wird vorher gesichert.
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
