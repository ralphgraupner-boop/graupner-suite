import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, Database, Clock, X, ShieldAlert, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { CleanupDialog } from "./CleanupDialog";

/**
 * Status-Banner direkt unter dem Header.
 * - LIVE   = roter Banner (Achtung: echte Daten)
 * - PREVIEW = oranger Banner (Test-Umgebung)
 * Klick öffnet Detail-Panel: Version, Counts, Backup-Status, Server-Zeit.
 */

const detectEnvFromHost = () => {
  if (typeof window === "undefined") return { kind: "unknown", label: "?" };
  const h = window.location.hostname;
  if (h.includes("preview") || h.includes("emergentagent.com")) {
    return { kind: "preview", label: "PREVIEW · TEST-UMGEBUNG", color: "amber" };
  }
  if (h.includes("emergent.host") || h.includes("graupner") || h === "localhost") {
    return { kind: "live", label: "LIVE · PRODUKTIV", color: "red" };
  }
  return { kind: "unknown", label: h, color: "slate" };
};

export const HealthBanner = () => {
  const [data, setData] = useState(null);
  const [consistency, setConsistency] = useState(null);
  const [open, setOpen] = useState(false);
  const [cleanupIssue, setCleanupIssue] = useState(null);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem("health_banner_hidden") === "1");
  const env = detectEnvFromHost();

  const reloadConsistency = () => {
    api.get("/module-health/consistency").then(r => setConsistency(r.data)).catch(() => {});
  };

  useEffect(() => {
    let mounted = true;
    api.get("/module-health/status").then(r => { if (mounted) setData(r.data); }).catch(() => {});
    api.get("/module-health/consistency").then(r => { if (mounted) setConsistency(r.data); }).catch(() => {});

    // Auto-Refresh: nach jeder Lösch-/Cleanup-Aktion einen Recheck triggern.
    // Dispatch über window-Events macht die Kopplung lose: jede Page kann nach einer Mutation
    // einfach `window.dispatchEvent(new CustomEvent('graupner:data-changed'))` feuern.
    const handler = () => { if (mounted) { api.get("/module-health/consistency").then(r => setConsistency(r.data)).catch(() => {}); } };
    window.addEventListener("graupner:data-changed", handler);
    return () => { mounted = false; window.removeEventListener("graupner:data-changed", handler); };
  }, []);

  if (hidden) return null;

  const colorClasses = {
    red: "bg-red-50 border-red-300 text-red-900",
    amber: "bg-amber-50 border-amber-300 text-amber-900",
    slate: "bg-slate-50 border-slate-300 text-slate-900",
  };
  const dotClasses = {
    red: "bg-red-500",
    amber: "bg-amber-500",
    slate: "bg-slate-500",
  };
  const cls = colorClasses[env.color] || colorClasses.slate;
  const dot = dotClasses[env.color] || dotClasses.slate;
  const c = data?.data_counts || {};
  const ver = data?.version?.version || "—";

  return (
    <>
      <div
        className={`border-b ${cls} px-4 py-1.5 flex items-center gap-3 text-xs cursor-pointer select-none flex-wrap`}
        onClick={() => setOpen(true)}
        data-testid="health-banner"
      >
        <span className={`w-2 h-2 rounded-full ${dot} animate-pulse flex-shrink-0`} />
        <span className="font-bold tracking-wider">{env.label}</span>
        <span className="opacity-60">·</span>
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" /> {data?.environment?.db_name || "…"}
        </span>
        {data && (
          <>
            <span className="opacity-60">·</span>
            <span title="Kunden / Projekte / Aufgaben / Termine / Angebote">
              K {c.module_kunden ?? "—"} · P {c.module_projekte ?? "—"} · A {c.module_aufgaben ?? "—"} · T {c.module_termine ?? "—"} · Q {c.quotes ?? "—"}
            </span>
          </>
        )}
        <span className="opacity-60">·</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {data?.server_time_hamburg || "—"}</span>
        <span className="opacity-60">·</span>
        <span>v{ver}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setHidden(true); sessionStorage.setItem("health_banner_hidden", "1"); }}
          className="ml-auto p-1 hover:bg-black/5 rounded-sm"
          title="Bis zum nächsten Login ausblenden"
          data-testid="btn-health-banner-close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-background rounded-lg shadow-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="health-detail-dialog"
          >
            <div className={`p-4 border-b ${cls}`}>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <h2 className="text-lg font-bold">{env.label}</h2>
              </div>
              <p className="text-xs mt-1 opacity-80">
                {env.kind === "preview"
                  ? "Hier kannst du testen. Datenänderungen wirken sich auf dieselbe DB wie LIVE aus, solange noch keine Trennung aktiv ist."
                  : env.kind === "live"
                    ? "Echte Kundendaten. Vorsichtig sein."
                    : "Unbekannte Umgebung – bitte URL prüfen."}
              </p>
            </div>
            <div className="p-4 space-y-3 text-sm">
              {!data ? (
                <p className="text-muted-foreground">Lade Status…</p>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono font-medium">{data.version?.version}</span>
                  </div>
                  {data.version?.build_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Build</span>
                      <span className="font-mono text-xs">{data.version.build_date}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Datenbank</span>
                    <span className="font-mono">{data.environment?.db_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Server-Zeit</span>
                    <span>{data.server_time_hamburg}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-semibold mb-2">Datenbestand</div>
                    <ul className="space-y-1">
                      {Object.entries(data.data_counts || {}).map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-medium">{v >= 0 ? v : "—"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-semibold mb-2">Backup</div>
                    <div className="flex items-center gap-2">
                      {data.backup?.status === "ok" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      <span>
                        {data.backup?.last_success_at
                          ? `vor ${data.backup.age_hours} h`
                          : "Status wird noch nicht in der DB protokolliert (geplante Aufgabe in Backlog)"}
                      </span>
                    </div>
                  </div>
                  {consistency && (
                    <div className="border-t pt-3">
                      <div className="font-semibold mb-2 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> Konsistenz-Check
                      </div>
                      {consistency.ok ? (
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" /> Alle Daten konsistent
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {consistency.errors_count} Fehler · {consistency.warnings_count} Warnung{consistency.warnings_count === 1 ? "" : "en"}
                          </p>
                          {consistency.issues.map((i, idx) => (
                            <div
                              key={idx}
                              className={`border rounded-sm p-2 ${i.severity === "error" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold">{i.title}</div>
                                  <div className="text-xs mt-0.5">{i.message}</div>
                                  {i.fix_hint && (
                                    <div className="text-xs mt-1 italic opacity-80">→ {i.fix_hint}</div>
                                  )}
                                </div>
                                <button
                                  onClick={() => setCleanupIssue(i)}
                                  className="text-xs px-2 py-1 bg-background border rounded-sm hover:bg-muted inline-flex items-center gap-1 flex-shrink-0"
                                  data-testid={`btn-fix-${i.type}`}
                                >
                                  <Wrench className="w-3 h-3" /> Beheben
                                </button>
                              </div>
                              {i.details && i.details.length > 0 && (
                                <details className="mt-1">
                                  <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
                                    {i.count > i.details.length ? `${i.details.length} von ${i.count} anzeigen` : `${i.details.length} Eintrag${i.details.length === 1 ? "" : "e"}`}
                                  </summary>
                                  <ul className="text-[11px] mt-1 space-y-0.5 font-mono">
                                    {i.details.map((d, di) => (
                                      <li key={di} className="truncate">
                                        {d.titel || d.kunde_name_snapshot || d.customer_name_snapshot || d.objekt || d.quote_number || d.id?.slice(0, 8)}
                                        {d.broken_refs && ` (${d.broken_refs.join(", ")})`}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Schließen</button>
            </div>
          </div>
        </div>
      )}

      {cleanupIssue && (
        <CleanupDialog
          issue={cleanupIssue}
          onClose={() => setCleanupIssue(null)}
          onDone={() => { setCleanupIssue(null); reloadConsistency(); }}
        />
      )}
    </>
  );
};

export default HealthBanner;
