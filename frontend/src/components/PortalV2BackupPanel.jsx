import { useState, useEffect } from "react";
import { Shield, RefreshCw, Plus, RotateCcw, Trash2, Download, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge } from "@/components/common";
import { api } from "@/lib/api";

/**
 * Portal v2 – Sicherungen-Panel
 * Zeigt Liste aller Snapshots, Knopf zum manuellen Erstellen,
 * Wiederherstellen + Download + Löschen pro Snapshot.
 * Module-First: spricht ausschließlich /api/module-portal-v2-backup/*
 */
export const PortalV2BackupPanel = () => {
  const [data, setData] = useState({ snapshots: [], total: 0, retention_days: 30 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/module-portal-v2-backup/list");
      setData(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.post("/module-portal-v2-backup/create");
      toast.success(`Sicherung erstellt: ${res.data.datum_label}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setCreating(false);
    }
  };

  const restore = async (snap) => {
    if (!window.confirm(
      `Portal v2 wird auf den Stand vom ${snap.datum_label} zurückgesetzt!\n\n` +
      `Aktuelle v2-Daten werden überschrieben.\n` +
      `Vor dem Zurücksetzen wird automatisch ein Sicherheits-Backup erstellt.\n\n` +
      `Wirklich fortfahren?`
    )) return;
    setRestoring(snap.id);
    try {
      const res = await api.post(`/module-portal-v2-backup/${snap.id}/restore`);
      toast.success(`Wiederhergestellt vom ${snap.datum_label}. Sicherheits-Backup angelegt.`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setRestoring(null);
    }
  };

  const download = async (snap) => {
    try {
      const res = await api.get(`/module-portal-v2-backup/${snap.id}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${snap.datum_id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download gestartet");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const remove = async (snap) => {
    if (!window.confirm(`Sicherung vom ${snap.datum_label} löschen?\nDas kann nicht rückgängig gemacht werden.`)) return;
    try {
      await api.delete(`/module-portal-v2-backup/${snap.id}`);
      toast.success("Sicherung gelöscht");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="portal-v2-backup-panel">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" /> Portal v2 – Sicherungen
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Snapshots aller v2-Daten (Konten, Nachrichten, Uploads, Einstellungen).
            Aufbewahrung: {data.retention_days} Tage. Automatisches Backup täglich um 03:00.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="btn-refresh-backups">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={create} disabled={creating} size="sm" data-testid="btn-create-backup">
            <Plus className="w-4 h-4" /> {creating ? "Erstelle…" : "Sicherung jetzt erstellen"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Lade…</div>
      ) : data.snapshots.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded">
          <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <div>Noch keine Sicherungen vorhanden</div>
          <div className="text-xs mt-1">Klicke „Sicherung jetzt erstellen", um einen ersten Snapshot anzulegen.</div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span>{data.total} Sicherung(en)</span>
            <span>·</span>
            <span>Sortiert nach Datum (neueste zuerst)</span>
          </div>
          {data.snapshots.map((s, idx) => (
            <div
              key={s.id}
              className={`border rounded p-3 flex items-center justify-between gap-3 flex-wrap ${idx === 0 ? "bg-emerald-50 border-emerald-200" : "bg-white"}`}
              data-testid={`backup-row-${s.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{s.datum_label}</span>
                  <Badge className={`text-xs ${
                    s.quelle === "automatisch" ? "bg-blue-100 text-blue-700 border-blue-300" :
                    s.quelle === "vor_restore" ? "bg-amber-100 text-amber-800 border-amber-300" :
                    "bg-slate-100 text-slate-700 border-slate-300"
                  }`}>
                    {s.quelle === "automatisch" ? "🤖 Auto" : s.quelle === "vor_restore" ? "⚠️ vor Restore" : "👤 Manuell"}
                  </Badge>
                  {idx === 0 && <Badge className="text-xs bg-emerald-600 text-white">aktuellste</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                  <span>📋 {s.counts?.portal2_accounts || 0} Konten</span>
                  <span>💬 {s.counts?.portal2_messages || 0} Nachrichten</span>
                  <span>📎 {s.counts?.portal2_uploads || 0} Uploads</span>
                  <span>⚙️ {s.counts?.portal2_settings || 0} Settings</span>
                  <span>· {Math.round((s.size_bytes || 0) / 1024)} KB</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => download(s)} title="Download als JSON" data-testid={`btn-download-${s.id}`}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restore(s)}
                  disabled={restoring === s.id}
                  title="Diese Sicherung wiederherstellen"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  data-testid={`btn-restore-${s.id}`}
                >
                  <RotateCcw className="w-4 h-4" /> {restoring === s.id ? "…" : "Restore"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(s)} title="Sicherung löschen" className="text-red-600 hover:bg-red-50" data-testid={`btn-delete-${s.id}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Tipp:</strong> Vor jedem Restore wird automatisch ein „vor_restore"-Backup erstellt –
          du kannst also jederzeit zurück, falls etwas schiefgeht.
        </div>
      </div>
    </Card>
  );
};
