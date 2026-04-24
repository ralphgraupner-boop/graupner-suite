import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * Prueft alle 60s, ob das Backend eine neue Version ausliefert (z.B. nach Deploy).
 * Zeigt dann ein Banner „Neue Version verfuegbar", das den Browser neu laedt.
 *
 * Usage:
 *   const { outdated, reload } = useVersionCheck();
 *   {outdated && <Banner onClick={reload} />}
 */
export function useVersionCheck(intervalMs = 60000) {
  const [outdated, setOutdated] = useState(false);
  const initialRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await api.get("/monteur/version");
        const version = res?.data?.version;
        if (!version) return;
        if (initialRef.current === null) {
          initialRef.current = version;
        } else if (version !== initialRef.current) {
          if (!cancelled) setOutdated(true);
        }
      } catch {
        /* offline oder 403 (Feature aus) -> ignorieren */
      }
    };

    check();
    const interval = setInterval(check, intervalMs);
    // Bei Zurueckkehren aus Hintergrund sofort pruefen
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  const reload = () => {
    // Cache umgehen
    if ("caches" in window) {
      try {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      } catch { /* ignore */ }
    }
    window.location.reload();
  };

  return { outdated, reload };
}

export default useVersionCheck;
