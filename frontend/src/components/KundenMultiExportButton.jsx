import { useState } from "react";
import { Download, Loader2, FileArchive, Users } from "lucide-react";
import { toast } from "sonner";
import { API as API_BASE } from "@/lib/api";
import { saveBlobWithPicker } from "@/lib/saveBlob";

/**
 * Sammel-Export: alle Kunden ODER nur die übergebene Auswahl.
 * - selectedIds=null oder leer → /alle/zip (komplettes Backup)
 * - selectedIds=[…] → POST /multi/zip
 */
export const KundenMultiExportButton = ({ selectedIds = [], totalCount = 0 }) => {
  const [busy, setBusy] = useState(false);
  const isMulti = selectedIds && selectedIds.length > 0;
  const label = isMulti
    ? `Auswahl exportieren (${selectedIds.length})`
    : `Alle exportieren (${totalCount})`;

  const today = new Date().toISOString().slice(0, 10);
  const suggestedName = isMulti
    ? `graupner-suite-${selectedIds.length}-kunden-${today}.zip`
    : `graupner-suite-alle-kunden-${today}.zip`;

  const run = async () => {
    if (busy) return;
    if (!isMulti && !window.confirm(`Wirklich alle ${totalCount} Kunden mit allen zugehörigen Daten exportieren? Das kann je nach Datenmenge etwas dauern.`)) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      let res;
      if (isMulti) {
        res = await fetch(`${API_BASE}/module-export/multi/zip`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ kunde_ids: selectedIds }),
        });
      } else {
        res = await fetch(`${API_BASE}/module-export/alle/zip`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m ? m[1] : suggestedName;
      const result = await saveBlobWithPicker(blob, filename);
      if (result.aborted) toast.info("Speichern abgebrochen");
      else if (result.picked) toast.success("Export gespeichert");
      else toast.success(`Heruntergeladen: ${filename}`);
    } catch (err) {
      toast.error(`Export fehlgeschlagen: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy || (!isMulti && totalCount === 0)}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
      data-testid="btn-multi-export"
      title={isMulti ? "Markierte Kunden exportieren" : "Alle Kunden exportieren"}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (isMulti ? <FileArchive className="w-4 h-4" /> : <Users className="w-4 h-4" />)}
      <span className="hidden sm:inline">{label}</span>
      {!isMulti && <span className="sm:hidden">Alle</span>}
    </button>
  );
};

export default KundenMultiExportButton;
