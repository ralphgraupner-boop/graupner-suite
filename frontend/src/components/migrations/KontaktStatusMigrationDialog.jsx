import { Wand2 } from "lucide-react";
import { Button } from "@/components/common";

/**
 * Dialog fuer die einmalige Kontakt-Status-Aufraeum-Migration.
 * Ausgelagert aus KundenModulPage.jsx (23.04.2026) damit die Core-Seite schlank bleibt.
 *
 * Props:
 *   preview:   { total_kunden, unchanged, to_change, final_distribution, changes[] }
 *   executing: bool – wenn true, laeuft die Ausfuehrung
 *   onCancel:  () => void
 *   onExecute: () => Promise<void>  – Main-Agent fuehrt Request durch
 */
export const KontaktStatusMigrationDialog = ({ preview, executing, onCancel, onExecute }) => {
  if (!preview) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={() => !executing && onCancel()}
      data-testid="migration-dialog"
    >
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" /> Kontakt-Status aufräumen
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Setzt bei allen Einträgen ohne Kontakt-Status automatisch einen passenden Wert.
            <br />Regel: Webhook-Anfragen → <b>Neu</b>, alle anderen → <b>Kunde</b>.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border rounded-lg p-3">
              <div className="text-2xl font-bold">{preview.total_kunden}</div>
              <div className="text-xs text-muted-foreground">Gesamt</div>
            </div>
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-2xl font-bold">{preview.unchanged}</div>
              <div className="text-xs text-muted-foreground">Unverändert</div>
            </div>
            <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-300">
              <div className="text-2xl font-bold text-emerald-700">{preview.to_change}</div>
              <div className="text-xs text-muted-foreground">Werden geändert</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">Verteilung nach Migration:</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(preview.final_distribution).map(([k, v]) => (
                <span key={k} className="px-2 py-1 rounded bg-muted border">{k}: <b>{v}</b></span>
              ))}
            </div>
          </div>

          {preview.changes.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Änderungen im Detail:</div>
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y text-sm">
                {preview.changes.map(c => (
                  <div key={c.id} className="px-3 py-2 flex items-center gap-2 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Quelle: {c.source || "—"} · Legacy-Status: {c.legacy_status || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-600">{c.kontakt_status_old || "leer"}</span>
                      <span>→</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold">{c.kontakt_status_new}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
          <Button variant="outline" onClick={onCancel} disabled={executing} data-testid="btn-migration-cancel">
            Abbrechen
          </Button>
          <Button
            onClick={onExecute}
            disabled={executing || preview.to_change === 0}
            data-testid="btn-migration-execute"
          >
            {executing ? "Wird ausgeführt…" : `Jetzt ausführen (${preview.to_change} Änderungen)`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KontaktStatusMigrationDialog;
