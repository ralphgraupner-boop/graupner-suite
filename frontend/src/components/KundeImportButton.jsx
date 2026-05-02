import { useState } from "react";
import { Upload, Loader2, FileArchive, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Import-Button: ZIP-Datei (Graupner-Suite-Export) hochladen, Daten importieren.
 * Modus "new_ids" = Standard, vergibt neue UUIDs damit nichts überschrieben wird.
 */
export const KundeImportButton = ({ onImported }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("new_ids");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => { setFile(null); setMode("new_ids"); setResult(null); };

  const submit = async () => {
    if (!file) { toast.error("Bitte ZIP-Datei wählen"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(`/module-export/import?mode=${mode}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
      if (r.data?.bulk) {
        const total = r.data.kunden_total || 0;
        const ok = r.data.kunden_success || 0;
        const fail = r.data.kunden_failed || 0;
        if (fail === 0) {
          toast.success(`${ok}/${total} Kunden importiert · 0 Fehler`);
        } else {
          toast.warning(`${ok}/${total} Kunden importiert · ${fail} Fehler – Details siehe Dialog`);
        }
      } else {
        toast.success(`Import erfolgreich: ${r.data.kunde_name}`);
      }
      onImported?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Import fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
        data-testid="btn-kunde-import"
      >
        <Upload className="w-4 h-4" /> Import
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="import-dialog">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileArchive className="w-5 h-5" /> Kunde aus ZIP importieren
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Akzeptiert Einzel-Kunden-ZIPs <em>und</em> Sammel-ZIPs aus „Alle exportieren".
              </p>
            </div>
            <div className="p-4 space-y-4">
              {!result ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">ZIP-Datei</label>
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="w-full border rounded-sm p-2 text-sm"
                      data-testid="input-import-file"
                    />
                    {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Modus</label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="mode"
                          value="new_ids"
                          checked={mode === "new_ids"}
                          onChange={() => setMode("new_ids")}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">Neue IDs vergeben</span>
                          <span className="block text-xs text-muted-foreground">Empfohlen. Erstellt einen neuen Kunden, der ursprüngliche bleibt unberührt.</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="mode"
                          value="overwrite"
                          checked={mode === "overwrite"}
                          onChange={() => setMode("overwrite")}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-red-700">Original-IDs behalten</span>
                          <span className="block text-xs text-muted-foreground">Nur für vollständige Wiederherstellung. Kann vorhandene Datensätze duplizieren.</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-sm p-3 text-xs text-amber-900 flex gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Importierte Daten werden zur Datenbank hinzugefügt – nichts wird gelöscht. Beim Modus „Neue IDs" gibt es keine Konflikte.</span>
                  </div>
                </>
              ) : result.bulk ? (
                <div className="text-sm space-y-2" data-testid="import-bulk-result">
                  <p className={`font-medium ${result.kunden_failed > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {result.kunden_failed > 0 ? "⚠ Bulk-Import abgeschlossen (mit Fehlern)" : "✓ Bulk-Import erfolgreich"}
                  </p>
                  <ul className="bg-muted/30 rounded-sm p-3 border space-y-1">
                    <li className="flex justify-between"><span>Kunden insgesamt</span><span className="font-semibold">{result.kunden_total}</span></li>
                    <li className="flex justify-between text-emerald-700"><span>Erfolgreich</span><span className="font-semibold">{result.kunden_success}</span></li>
                    <li className="flex justify-between text-red-700"><span>Fehler</span><span className="font-semibold">{result.kunden_failed}</span></li>
                  </ul>
                  {result.kunden_failed > 0 && Array.isArray(result.failed) && (
                    <details className="bg-red-50 border border-red-200 rounded-sm p-2" open>
                      <summary className="text-xs font-medium text-red-800 cursor-pointer">Fehler-Details ({result.failed.length})</summary>
                      <ul className="mt-2 space-y-1 text-xs text-red-900 max-h-40 overflow-y-auto">
                        {result.failed.map((f, i) => (
                          <li key={i} className="border-b border-red-100 pb-1">
                            <span className="font-mono">{f.file}</span>: {f.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ) : (
                <div className="text-sm space-y-2">
                  <p className="font-medium text-emerald-700">✓ Import erfolgreich</p>
                  <p>Kunde: <span className="font-medium">{result.kunde_name}</span></p>
                  <ul className="bg-muted/30 rounded-sm p-3 border space-y-1">
                    <li className="flex justify-between"><span>Projekte</span><span className="font-semibold">{result.projekte}</span></li>
                    <li className="flex justify-between"><span>Aufgaben</span><span className="font-semibold">{result.aufgaben}</span></li>
                    <li className="flex justify-between"><span>Termine</span><span className="font-semibold">{result.termine}</span></li>
                    <li className="flex justify-between"><span>Einsätze</span><span className="font-semibold">{result.einsaetze}</span></li>
                    <li className="flex justify-between"><span>Angebote</span><span className="font-semibold">{result.quotes}</span></li>
                    <li className="flex justify-between"><span>Rechnungen</span><span className="font-semibold">{result.rechnungen}</span></li>
                    <li className="flex justify-between"><span>Portale</span><span className="font-semibold">{result.portale}</span></li>
                    <li className="flex justify-between"><span>Dateien</span><span className="font-semibold">{result.files}</span></li>
                  </ul>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">
                {result ? "Schließen" : "Abbrechen"}
              </button>
              {!result && (
                <button
                  onClick={submit}
                  disabled={busy || !file}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
                  data-testid="btn-import-submit"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Importieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KundeImportButton;
