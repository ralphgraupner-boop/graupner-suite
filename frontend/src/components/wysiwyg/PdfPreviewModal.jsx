import { useState, useEffect } from "react";
import { X, Loader2, Download, RefreshCw, ExternalLink, Minus, Plus, Maximize2 } from "lucide-react";

/**
 * PDF-Vorschau-Modal — zeigt das echte Druck-PDF in einem iframe.
 * Großes, bildschirmfüllendes Fenster mit Zoom-Steuerung (Breite + 75–150 %).
 * Wird vom „Vorschau"-Button im Editor aufgerufen.
 */
const ZOOM_STEPS = [75, 100, 125, 150];

export const PdfPreviewModal = ({ isOpen, onClose, getPdfBlob, filename = "Dokument.pdf" }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // "FitH" = an Fensterbreite anpassen, sonst Prozentwert
  const [zoom, setZoom] = useState("FitH");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const blob = await getPdfBlob();
      if (!blob) throw new Error("Kein PDF erhalten");
      const namedFile = new File([blob], filename, { type: "application/pdf" });
      const url = URL.createObjectURL(namedFile);
      setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (e) {
      setError(e.message || "PDF konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const fragment = zoom === "FitH" ? "#toolbar=1&view=FitH" : `#toolbar=1&zoom=${zoom}`;
  const iframeSrc = blobUrl ? `${blobUrl}${fragment}` : null;

  const stepZoom = (dir) => {
    setZoom((z) => {
      const cur = z === "FitH" ? 100 : z;
      const idx = ZOOM_STEPS.indexOf(cur);
      const next = ZOOM_STEPS[Math.min(Math.max(idx + dir, 0), ZOOM_STEPS.length - 1)] ?? cur;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4" onClick={onClose} data-testid="pdf-preview-overlay">
      <div onClick={(e) => e.stopPropagation()} className="bg-background border shadow-2xl w-[96vw] h-[94vh] max-w-[1400px] rounded-xl sm:rounded-2xl flex flex-col overflow-hidden" data-testid="pdf-preview-modal">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b flex-wrap">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight">PDF-Vorschau</h2>
            <p className="text-xs text-muted-foreground hidden sm:block">So wird das Dokument gedruckt</p>
          </div>

          {/* Zoom-Steuerung */}
          <div className="flex items-center gap-1 rounded-md border overflow-hidden" data-testid="pdf-zoom-group">
            <button onClick={() => setZoom("FitH")} title="An Breite anpassen" className={`px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 ${zoom === "FitH" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} data-testid="btn-pdf-zoom-fit">
              <Maximize2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Breite</span>
            </button>
            <button onClick={() => stepZoom(-1)} title="Verkleinern" className="px-2 py-1.5 border-l hover:bg-muted" data-testid="btn-pdf-zoom-out">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-xs font-medium tabular-nums min-w-[42px] text-center" data-testid="pdf-zoom-value">
              {zoom === "FitH" ? "Auto" : `${zoom}%`}
            </span>
            <button onClick={() => stepZoom(1)} title="Vergrößern" className="px-2 py-1.5 border-l hover:bg-muted" data-testid="btn-pdf-zoom-in">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5" data-testid="btn-pdf-refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Aktualisieren</span>
            </button>
            {blobUrl && (
              <>
                <a href={blobUrl} download={filename} className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted inline-flex items-center gap-1.5" data-testid="btn-pdf-download">
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download</span>
                </a>
                <a href={blobUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted inline-flex items-center gap-1.5" data-testid="btn-pdf-open">
                  <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Neuer Tab</span>
                </a>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Schließen" data-testid="btn-pdf-close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 bg-muted/30 relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">PDF wird erzeugt...</p>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {iframeSrc && !loading && (
            <iframe key={fragment} src={iframeSrc} title="PDF-Vorschau" className="w-full h-full" data-testid="pdf-preview-iframe" />
          )}
        </div>
      </div>
    </div>
  );
};
