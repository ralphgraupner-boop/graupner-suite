import { useState } from "react";
import { Download, Loader2, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { api, API as API_BASE } from "@/lib/api";

/**
 * Export-Button für einen einzelnen Kunden.
 * Lädt /api/module-export/preview/{id}, zeigt Dialog mit Übersicht,
 * danach Download von /api/module-export/kunde/{id}/zip.
 */
export const KundeExportButton = ({ kunde_id, kunde_name = "" }) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const start = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const r = await api.get(`/module-export/preview/${kunde_id}`);
      setPreview(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Vorschau fehlgeschlagen");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/module-export/kunde/${kunde_id}/zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m ? m[1] : `export-${kunde_id}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export gestartet: ${filename}`);
      setOpen(false);
    } catch (err) {
      toast.error(`Download fehlgeschlagen: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        onClick={start}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
        title="Kunde + alle Daten als ZIP exportieren"
        data-testid={`btn-export-kunde-${kunde_id}`}
      >
        <FileArchive className="w-4 h-4" /> Export
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="export-dialog">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Kunde exportieren</h2>
              <p className="text-sm text-muted-foreground mt-1">{kunde_name}</p>
            </div>
            <div className="p-4">
              {loading || !preview ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Lade Vorschau …
                </div>
              ) : (
                <>
                  <p className="text-sm mb-3">Folgendes wird in das ZIP-Archiv gepackt:</p>
                  <ul className="text-sm space-y-1 bg-muted/30 rounded-sm p-3 border">
                    {[
                      ["Kunde", preview.kunde],
                      ["Projekte", preview.projekte],
                      ["Aufgaben", preview.aufgaben],
                      ["Termine", preview.termine],
                      ["Einsätze", preview.einsaetze],
                      ["Angebote", preview.quotes],
                      ["Rechnungen", preview.rechnungen],
                      ["Portale", preview.portale],
                      ["Portal-Uploads", preview.portal_uploads],
                      ["Portal-Aktivität", preview.portal_activity],
                      ["Monteur-App-Einträge", preview.monteur_eintraege],
                      ["Dateien (Bilder/PDFs)", preview.dateien],
                    ].map(([label, n]) => (
                      <li key={label} className="flex justify-between">
                        <span>{label}</span>
                        <span className={n > 0 ? "font-semibold" : "text-muted-foreground"}>{n}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    Das ZIP enthält JSON-Dateien pro Datentyp + Originaldateien im <code>files/</code>-Ordner. Es kann später über den Import-Button wieder eingelesen werden.
                  </p>
                </>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
              <button
                onClick={download}
                disabled={loading || downloading || !preview}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
                data-testid="btn-export-download"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                ZIP herunterladen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KundeExportButton;
