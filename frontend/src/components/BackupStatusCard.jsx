import { useEffect, useState } from "react";
import { Shield, ShieldAlert, ShieldCheck, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Button } from "@/components/common";
import { api, API } from "@/lib/api";

/**
 * BackupStatusCard
 * ----------------
 * Zeigt auf dem Dashboard auf einen Blick:
 *  • Wann lief das letzte Backup?
 *  • Status der drei Speicherziele (E-Mail / Lokal / Object-Storage)
 *  • Knopf „Backup jetzt erstellen" (für Admins)
 *  • Knopf „Letztes Backup herunterladen"
 */
const formatHamburg = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
};

export const BackupStatusCard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try {
      const r = await api.get("/backup/auto/status");
      setStatus(r.data);
    } catch (e) {
      // still zeigen, ohne Fehler-Toast
      setStatus({ status: "error", error: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const triggerBackup = async () => {
    setRunning(true);
    try {
      const r = await api.post("/backup/auto/trigger", {}, { timeout: 180000 });
      if (r.data?.ok) {
        toast.success(`Backup erstellt — ${r.data.total_docs} Datensätze, ${r.data.size_kb} KB`);
        load();
      } else {
        toast.error(r.data?.message || "Backup fehlgeschlagen");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Backup-Aufruf fehlgeschlagen");
    } finally {
      setRunning(false);
    }
  };

  const downloadLast = async () => {
    const id = status?.letzter_lauf?.id;
    if (!id) {
      toast.error("Kein Backup zum Herunterladen vorhanden");
      return;
    }
    // Token aus localStorage holen für Header-Auth beim Download
    const token = localStorage.getItem("token");
    const url = `${API}/backup/auto/download/${id}`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = status.letzter_lauf?.filename || "graupner_backup.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Backup heruntergeladen");
    } catch (e) {
      toast.error(`Download fehlgeschlagen: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <Card className="p-4" data-testid="backup-status-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Backup-Status wird geladen…
        </div>
      </Card>
    );
  }

  const last = status?.letzter_lauf;
  const storage = last?.storage || {};
  const istErfolg = last?.status === "success";

  // Ampel-Logik: alles grün, wenn letzter Lauf erfolgreich + ≤ 36 Stunden alt
  let ampel = "rot";
  if (last?.created_at) {
    const alterStd = (Date.now() - new Date(last.created_at).getTime()) / 3600000;
    if (istErfolg && alterStd <= 36) ampel = "gruen";
    else if (istErfolg && alterStd <= 72) ampel = "gelb";
  }
  // Scheduler-Watchdog: wenn kein Heartbeat in 90+ Minuten -> Warnung uebersteuert Ampel
  const schedulerTot = status?.scheduler_lebt === false;
  if (schedulerTot) ampel = "rot";
  const ampelStyle = {
    gruen: "bg-green-100 text-green-800 border-green-200",
    gelb: "bg-amber-100 text-amber-800 border-amber-200",
    rot: "bg-red-100 text-red-800 border-red-200",
  }[ampel];
  const Icon = ampel === "gruen" ? ShieldCheck : ShieldAlert;

  return (
    <Card className={`p-4 border ${ampelStyle}`} data-testid="backup-status-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Icon className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm flex items-center gap-2">
              Datensicherung
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                ampel === "gruen" ? "bg-green-200" : ampel === "gelb" ? "bg-amber-200" : "bg-red-200"
              }`}>
                {ampel === "gruen" && "AKTUELL"}
                {ampel === "gelb" && "ÄLTER ALS 1 TAG"}
                {ampel === "rot" && "KRITISCH — KEIN AKTUELLES BACKUP"}
              </span>
            </div>
            <div className="text-xs mt-1 opacity-90">
              Letzter Lauf: <strong>{formatHamburg(last?.created_at)}</strong> Hamburger Zeit
              {last?.total_docs && (
                <> · {last.total_docs} Datensätze · {last.size_kb} KB</>
              )}
            </div>
            <div className="text-xs mt-1 flex flex-wrap gap-2">
              <span className={storage.email ? "text-green-700" : "text-gray-400"}>
                ✉️ E-Mail {storage.email ? "✓" : "—"}
              </span>
              <span className={storage.lokal ? "text-green-700" : "text-gray-400"}>
                💾 Lokal {storage.lokal ? "✓" : "—"}
              </span>
              <span className={storage.object_storage ? "text-green-700" : "text-gray-400"}>
                ☁️ Cloud {storage.object_storage ? "✓" : "—"}
              </span>
            </div>
            <div className="text-[11px] mt-1 opacity-70">
              {status?.next_backup} · Lokal: {status?.lokal_dateien} Dateien
              {status?.heartbeat_alter_minuten != null && (
                <> · Scheduler-Heartbeat vor {status.heartbeat_alter_minuten} Min</>
              )}
            </div>
            {schedulerTot && (
              <div className="mt-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                ⚠️ Scheduler antwortet nicht — letztes Lebenszeichen vor {status?.heartbeat_alter_minuten ?? "?"} Min.
                Bitte Backend neu starten oder Admin informieren.
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={triggerBackup}
          disabled={running}
          data-testid="backup-trigger-btn"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Shield className="w-3.5 h-3.5 mr-1" />}
          {running ? "Backup läuft…" : "Backup jetzt erstellen"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadLast}
          disabled={!last?.id}
          data-testid="backup-download-btn"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          Letztes herunterladen
        </Button>
      </div>
    </Card>
  );
};

export default BackupStatusCard;
