import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * AnfragenFetcherButton
 * Holt gezielt nur Kontaktformular-Mails aus IMAP und legt sie als Anfragen an.
 * Andere Mails werden nicht beruehrt (BODY.PEEK[]), Betterbird merkt nichts.
 */
const AnfragenFetcherButton = ({ onFetched, size = "sm", variant = "outline", className = "" }) => {
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get("/anfragen/fetch/status");
      setLastFetch(res.data?.last_fetch || null);
    } catch {
      /* silent */
    }
  };

  const handleFetch = async () => {
    setLoading(true);
    try {
      const res = await api.post("/anfragen/fetch");
      const { fetched, skipped, errors } = res.data || {};
      if (fetched > 0) {
        toast.success(`${fetched} neue ${fetched === 1 ? "Anfrage" : "Anfragen"} importiert${skipped ? ` (${skipped} bereits vorhanden)` : ""}`);
      } else {
        toast.info(`Keine neuen Anfragen${skipped ? ` (${skipped} bereits vorhanden)` : ""}`);
      }
      if (errors > 0) toast.warning(`${errors} Fehler beim Import`);
      setLastFetch(res.data?.last_fetch || new Date().toISOString());
      onFetched?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Fehler beim Abrufen";
      toast.error(typeof msg === "string" ? msg : "Fehler beim Abrufen");
    } finally {
      setLoading(false);
    }
  };

  const formatLast = (iso) => {
    if (!iso) return "noch nie";
    try {
      const d = new Date(iso);
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMin < 1) return "gerade eben";
      if (diffMin < 60) return `vor ${diffMin} Min`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `vor ${diffH} Std`;
      return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch { return "-"; }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        onClick={handleFetch}
        disabled={loading}
        size={size}
        variant={variant}
        data-testid="btn-fetch-anfragen"
        className="gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4" />}
        {loading ? "Prüfe..." : "Anfragen abrufen"}
      </Button>
      <span className="text-xs text-slate-500" data-testid="anfragen-fetcher-last">
        Letzte Prüfung: {formatLast(lastFetch)}
      </span>
    </div>
  );
};

export { AnfragenFetcherButton };
