import { useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

const detectEnv = () => {
  if (typeof window === "undefined") return { kind: "unknown", color: "slate", short: "?" };
  const h = window.location.hostname;
  if (h.includes("preview") || h.includes("emergentagent.com")) return { kind: "preview", color: "blue", short: "PREVIEW" };
  if (h.includes("emergent.host")) return { kind: "live", color: "red", short: "LIVE" };
  return { kind: "local", color: "slate", short: "LOCAL" };
};

/**
 * Kompakter Status-Streifen für die Monteur-App.
 * Datenmaske aus module_health, ein Tap = harter Refresh + Service-Worker-Reload.
 */
export const MonteurHealthBadge = ({ onRefresh }) => {
  const [data, setData] = useState(null);
  const [reloading, setReloading] = useState(false);
  const env = detectEnv();

  useEffect(() => {
    api.get("/module-health/status").then(r => setData(r.data)).catch(() => {});
  }, []);

  const hardRefresh = async () => {
    setReloading(true);
    try {
      // Service-Worker invalidieren
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          try { await r.update(); } catch { /* ignore */ }
        }
      }
      // Caches leeren (PWA)
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      // Daten neu laden über Callback (z.B. load() aus MonteurAppPage)
      if (onRefresh) await onRefresh();
      // Hardes Reload damit JS-Bundle nachgezogen wird
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const colorMap = {
    red: { bg: "bg-red-50", border: "border-red-300", text: "text-red-900", dot: "bg-red-500" },
    blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-900", dot: "bg-blue-500" },
    amber: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", dot: "bg-amber-500" },
    slate: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-900", dot: "bg-slate-500" },
  };
  const cls = colorMap[env.color] || colorMap.slate;

  const c = data?.data_counts || {};
  const ver = data?.version?.version?.slice(0, 7) || "—";

  return (
    <div className={`${cls.bg} ${cls.border} ${cls.text} border rounded-lg px-3 py-2 mb-3 text-xs flex items-center gap-2`} data-testid="monteur-health-badge">
      <span className={`w-2 h-2 rounded-full ${cls.dot} animate-pulse flex-shrink-0`} />
      <span className="font-bold">{env.short}</span>
      <span className="opacity-50">·</span>
      <span className="flex items-center gap-1 truncate">
        <Database className="w-3 h-3 flex-shrink-0" />
        {data ? `K${c.module_kunden ?? "?"} P${c.module_projekte ?? "?"} A${c.module_aufgaben ?? "?"} T${c.module_termine ?? "?"}` : "…"}
      </span>
      <span className="opacity-50">·</span>
      <span className="font-mono opacity-70">v{ver}</span>
      <button
        onClick={hardRefresh}
        disabled={reloading}
        className={`ml-auto p-1.5 rounded-md ${cls.text} hover:bg-black/5 disabled:opacity-50`}
        title="Daten und App-Cache erneuern"
        data-testid="btn-monteur-hard-refresh"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${reloading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
};

export default MonteurHealthBadge;
