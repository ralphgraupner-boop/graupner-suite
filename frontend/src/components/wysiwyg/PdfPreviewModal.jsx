import { useState, useEffect } from "react";
import { X, Loader2, Download, RefreshCw, ExternalLink } from "lucide-react";

/**
 * PDF-Vorschau-Modal — zeigt das echte Druck-PDF in einem iframe.
 * Wird vom „Vorschau"-Button im Editor aufgerufen.
 */
export const PdfPreviewModal = ({ isOpen, onClose, getPdfBlob, filename = "Dokument.pdf" }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const blob = await getPdfBlob();
      if (!blob) throw new Error("Kein PDF erhalten");
      const url = URL.createObjectURL(blob);
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

  return (
    <div className="fixed inset-0 z-[9000] flex items-stretch justify-center bg-black/60 backdrop-blur-sm" onClick={onClose} data-testid="pdf-preview-overlay">
      <div onClick={(e) => e.stopPropagation()} className="bg-background border shadow-2xl w-full sm:max-w-4xl sm:my-4 sm:rounded-2xl flex flex-col" data-testid="pdf-preview-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-base font-bold">PDF-Vorschau</h2>
            <p className="text-xs text-muted-foreground">So wird das Dokument gedruckt</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5" data-testid="btn-pdf-refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
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
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Schließen">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 bg-muted/30 relative min-h-[60vh]">
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
          {blobUrl && !loading && (
            <iframe src={blobUrl} title="PDF-Vorschau" className="w-full h-full min-h-[60vh]" data-testid="pdf-preview-iframe" />
          )}
        </div>
      </div>
    </div>
  );
};
