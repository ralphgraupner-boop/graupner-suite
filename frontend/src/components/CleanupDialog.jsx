import { useState, useEffect } from "react";
import { Trash2, ArrowRightLeft, Loader2, X, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { api, API as API_BASE } from "@/lib/api";

/**
 * Cleanup-Dialog für ein Konsistenz-Issue.
 * Bietet "Löschen" und (für orphans) "Neuem Kunden zuweisen" an.
 * Bei Löschen wird ein vorheriger Mini-Export angeboten als Sicherheitsnetz.
 */
export const CleanupDialog = ({ issue, onClose, onDone }) => {
  const [mode, setMode] = useState("reassign"); // reassign | delete
  const [kunden, setKunden] = useState([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const isLegacy = issue.type === "legacy_collection";
  const ids = (issue.details || []).map(d => d.id).filter(Boolean);

  useEffect(() => {
    if (isLegacy) { setMode("delete"); return; }
    api.get("/modules/kunden/data").then(r => setKunden(r.data || [])).catch(() => {});
  }, [isLegacy]);

  const exportFirst = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/module-export/alle/zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vor-cleanup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Sicherungs-Export heruntergeladen");
    } catch (err) {
      toast.error(`Sicherungs-Export fehlgeschlagen: ${err.message}`);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const body = { action: mode, ids, target_kunde_id: mode === "reassign" ? target : null };
      const r = await api.post(`/module-health/cleanup/${issue.type}`, body);
      const msg = mode === "delete"
        ? `${r.data.deleted ?? 0} Eintrag/Einträge gelöscht`
        : `${r.data.reassigned ?? 0} Eintrag/Einträge zu „${r.data.target_name}" verschoben`;
      toast.success(msg);
      onDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* ignore */ }
    }
  };

  const canSubmit = isLegacy ? true : (mode === "delete" || (mode === "reassign" && target));

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" /> Konsistenz beheben
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="bg-muted/30 rounded-sm p-3 border">
            <div className="font-medium">{issue.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{issue.message}</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs flex items-start gap-2">
            <Download className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-700" />
            <div className="flex-1">
              <strong>Sicherheitsnetz:</strong> Vor dem Aufräumen kannst du dir alle Daten als ZIP-Backup herunterladen.
              <button
                onClick={exportFirst}
                className="ml-2 underline text-blue-700 hover:text-blue-900"
                data-testid="btn-cleanup-export-first"
              >
                Jetzt sichern
              </button>
            </div>
          </div>

          {!isLegacy && (
            <div>
              <label className="block text-sm font-medium mb-2">Was soll passieren?</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="cleanup-mode" value="reassign" checked={mode === "reassign"} onChange={() => setMode("reassign")} className="mt-0.5" />
                  <span>
                    <span className="font-medium flex items-center gap-1"><ArrowRightLeft className="w-3.5 h-3.5" /> Anderem Kunden zuweisen</span>
                    <span className="block text-xs text-muted-foreground">Verschiebt {ids.length} Einträge zu einem existierenden Kunden.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="cleanup-mode" value="delete" checked={mode === "delete"} onChange={() => setMode("delete")} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-red-700 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Endgültig löschen</span>
                    <span className="block text-xs text-muted-foreground">Entfernt {ids.length} Einträge dauerhaft.</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {!isLegacy && mode === "reassign" && (
            <div>
              <label className="block text-sm font-medium mb-1">Ziel-Kunde</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="select-cleanup-target"
              >
                <option value="">— Kunden wählen —</option>
                {kunden.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.name || `${k.vorname || ""} ${k.nachname || ""}`.trim()} {k.email ? `· ${k.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isLegacy && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-xs">
              <strong>Hinweis:</strong> Die alte <code>customers</code>-Collection enthält {issue.message?.match(/\d+/)?.[0] || "?"} Demo-Datensätze ohne aktive Verbindungen. Sie werden alle gelöscht.
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={run}
            disabled={busy || !canSubmit}
            className={`px-4 py-2 text-sm text-white rounded-sm inline-flex items-center gap-2 disabled:opacity-50 ${mode === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}
            data-testid="btn-cleanup-run"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === "delete" ? <Trash2 className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />)}
            {isLegacy ? "Legacy löschen" : (mode === "delete" ? `${ids.length} löschen` : `${ids.length} verschieben`)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CleanupDialog;
