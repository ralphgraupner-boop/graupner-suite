import { useState, useEffect } from "react";
import { X, Loader2, ZoomIn } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Kleines Bild-Tile, das das Projekt-Bild als Blob über den auth-pflichtigen
 * Backend-Endpoint /api/module-projekte/files/{path:path} lädt und per
 * URL.createObjectURL rendert.
 *
 * Hintergrund: bild.url enthält den relativen Storage-Pfad (z. B.
 * "module_projekte/<id>/abc.jpg"). Würden wir den direkt als <a href> oder
 * <img src> ohne Auth setzen, fängt React Router den Pfad ab und zeigt das
 * Dashboard, oder das Backend antwortet mit 401.
 *
 * Klick öffnet eine simple Lightbox (nicht neuer Tab → mobil & Desktop sauber).
 *
 * Props:
 *   bild: { id, url, filename, beschreibung, kategorie }
 *   onDelete(id)
 */
const ProjektBild = ({ bild, onDelete }) => {
  const [thumbUrl, setThumbUrl] = useState("");
  const [error, setError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    (async () => {
      const path = (bild?.url || "").replace(/^\/+/, "");
      if (!path) { setError(true); return; }
      try {
        const r = await api.get(`/module-projekte/files/${path}`, { responseType: "blob" });
        if (!alive) return;
        objectUrl = URL.createObjectURL(r.data);
        setThumbUrl(objectUrl);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bild?.url]);

  return (
    <>
      <div className="border rounded overflow-hidden bg-white group relative" data-testid={`projekt-bild-${bild.id}`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (thumbUrl) setShowLightbox(true); }}
          className="block w-full h-20 bg-slate-100 flex items-center justify-center"
          aria-label={`Bild ${bild.filename || ""} öffnen`}
          data-testid={`btn-open-bild-${bild.id}`}
        >
          {thumbUrl ? (
            <img src={thumbUrl} alt={bild.filename} className="w-full h-20 object-cover" />
          ) : error ? (
            <div className="text-[10px] text-red-600 p-1 text-center">Bild nicht ladbar</div>
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(bild.id); }}
          className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Löschen"
          data-testid={`btn-delete-bild-${bild.id}`}
        >
          <X className="w-3 h-3" />
        </button>
        {thumbUrl && (
          <div className="absolute bottom-1 right-1 p-1 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <ZoomIn className="w-3 h-3 text-slate-700" />
          </div>
        )}
        {bild.beschreibung && (
          <div className="text-[10px] text-slate-600 px-1 py-0.5 truncate">{bild.beschreibung}</div>
        )}
      </div>

      {showLightbox && thumbUrl && (
        <Lightbox
          src={thumbUrl}
          alt={bild.filename}
          caption={bild.beschreibung}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  );
};

const Lightbox = ({ src, alt, caption, onClose }) => {
  // ESC zum Schließen + Body-Scroll-Lock
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="projekt-bild-lightbox"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white"
        aria-label="Schließen"
        data-testid="btn-close-lightbox"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="max-w-full max-h-full flex flex-col items-center gap-3">
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        {caption && (
          <div className="text-white/90 text-sm text-center max-w-xl">{caption}</div>
        )}
      </div>
    </div>
  );
};

export default ProjektBild;
export { ProjektBild };
