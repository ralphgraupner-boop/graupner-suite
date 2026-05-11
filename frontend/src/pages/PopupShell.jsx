import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Monitor, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { broadcast } from "@/lib/windowSync";
import { KundenFormModal } from "@/pages/KundenModulPage";

/**
 * Popup-Shell: rendert ein einzelnes Formular als eigenständige Browser-Window-Instanz
 * (über window.open(...)). Layout ohne Sidebar/Hauptnavigation.
 *
 * Route: /popup/:type/:id?
 *   type=kunde, id=<kunde_id> oder "new"
 *
 * Multi-Screen API: zeigt Monitor-Buttons wenn mehrere Bildschirme erkannt werden.
 */
export default function PopupShell() {
  const { type, id } = useParams();
  const { isAuthenticated } = useAuth();
  const [screens, setScreens] = useState([]);
  const [activeScreenIdx, setActiveScreenIdx] = useState(-1);

  // Multi-Screen Window Placement API (Chromium-only, benötigt Permission)
  useEffect(() => {
    let cancelled = false;
    let details = null;
    const onChange = () => {
      if (!details || cancelled) return;
      setScreens(details.screens || []);
      setActiveScreenIdx(_findActiveScreen(details.screens || []));
    };
    (async () => {
      try {
        if (typeof window !== "undefined" && window.getScreenDetails) {
          details = await window.getScreenDetails();
          if (!cancelled) {
            setScreens(details.screens || []);
            setActiveScreenIdx(_findActiveScreen(details.screens || []));
            details.addEventListener?.("screenschange", onChange);
            details.addEventListener?.("currentscreenchange", onChange);
          }
        }
      } catch {
        // Permission denied oder Browser unterstützt API nicht — kein Problem
      }
    })();
    return () => {
      cancelled = true;
      try {
        details?.removeEventListener?.("screenschange", onChange);
        details?.removeEventListener?.("currentscreenchange", onChange);
      } catch { /* ignore */ }
    };
  }, []);

  const moveToScreen = (screen) => {
    if (!screen) return;
    const w = Math.min(980, screen.availWidth - 40);
    const h = Math.min(800, screen.availHeight - 40);
    const x = Math.round(screen.availLeft + (screen.availWidth - w) / 2);
    const y = Math.round(screen.availTop + (screen.availHeight - h) / 2);
    try {
      window.moveTo(x, y);
      window.resizeTo(w, h);
    } catch { /* ignore */ }
  };

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      {screens.length > 1 && (
        <div
          data-testid="popup-monitor-bar"
          className="fixed top-2 right-2 z-[300] flex gap-1 items-center bg-card/95 backdrop-blur ring-1 ring-border rounded-sm shadow-md px-2 py-1"
        >
          <span className="text-xs font-medium text-muted-foreground pr-1">Monitor:</span>
          {screens.map((s, i) => (
            <button
              key={i}
              data-testid={`popup-move-screen-${i}`}
              onClick={() => moveToScreen(s)}
              disabled={i === activeScreenIdx}
              className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-medium transition-colors ${
                i === activeScreenIdx
                  ? "bg-primary text-primary-foreground cursor-default"
                  : "bg-muted hover:bg-primary hover:text-primary-foreground"
              }`}
              title={s.label ? `${s.label} (${s.availWidth}×${s.availHeight})` : `Monitor ${i + 1}`}
            >
              <Monitor className="w-3 h-3" />
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {type === "kunde" && <KundePopupContent id={id} />}
      {type !== "kunde" && (
        <div className="p-8 text-center text-muted-foreground">
          Unbekannter Popup-Typ: <code>{type}</code>
        </div>
      )}
    </div>
  );
}

const _findActiveScreen = (screens) => {
  if (!screens || screens.length === 0 || typeof window === "undefined") return -1;
  const x = window.screenX;
  const y = window.screenY;
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    if (x >= s.availLeft && x < s.availLeft + s.availWidth && y >= s.availTop && y < s.availTop + s.availHeight) {
      return i;
    }
  }
  return 0;
};

const KundePopupContent = ({ id }) => {
  const [kunde, setKunde] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isNew = !id || id === "new";

  useEffect(() => {
    let cancelled = false;
    if (isNew) {
      setKunde(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    api.get("/modules/kunden/data")
      .then((res) => {
        if (cancelled) return;
        const k = (res.data || []).find((x) => x.id === id);
        if (k) setKunde(k);
        else setError("Kunde nicht gefunden");
      })
      .catch(() => { if (!cancelled) setError("Fehler beim Laden"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isNew]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }
  if (error) {
    return <div className="p-8 text-center text-destructive" data-testid="popup-error">{error}</div>;
  }

  return (
    <KundenFormModal
      isOpen={true}
      kunde={kunde}
      popoutEnabled={false}
      onClose={() => { try { window.close(); } catch { /* ignore */ } }}
      onSave={() => {
        broadcast("kunden-changed", { kundeId: kunde?.id });
        // kleine Verzögerung damit Toast sichtbar bleibt
        setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 800);
      }}
    />
  );
};
