import { useState, useEffect } from "react";
import { Trash2, X, Loader2, Download, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";
import { api, API as API_BASE } from "@/lib/api";
import { saveBlobWithPicker } from "@/lib/saveBlob";

/**
 * Sicherer Lösch-Dialog für einen Kunden.
 * 1. Lädt Vorschau via /module-export/preview/{id}
 * 2. Zeigt was alles mitgelöscht wird
 * 3. Beim Bestätigen: erzeugt Backup-ZIP, sendet Mail + downloaded
 * 4. Erst dann wird wirklich gelöscht
 */
export const KundeDeleteDialog = ({ kunde_id, kunde_name, onClose, onDeleted }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sendMail, setSendMail] = useState(true);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    api.get(`/module-export/preview/${kunde_id}`)
      .then(r => setPreview(r.data))
      .catch(err => toast.error(err?.response?.data?.detail || "Vorschau fehlgeschlagen"))
      .finally(() => setLoading(false));
  }, [kunde_id]);

  const expected = kunde_name || "Kunde";
  const canDelete = !deleting && confirm.trim().toLowerCase() === expected.trim().toLowerCase();

  const execute = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/module-kunde-delete/execute/${kunde_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ send_mail: sendMail, reason: reason || null }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m ? m[1] : `loesch-${kunde_id}.zip`;
      const mailSent = res.headers.get("X-Mail-Sent") === "1";
      const result = await saveBlobWithPicker(blob, filename);
      if (result.aborted) {
        toast.info("ZIP-Speichern abgebrochen, Lösch wurde aber durchgeführt");
      } else {
        toast.success(`Kunde gelöscht. Backup gespeichert${mailSent ? " + per Mail gesendet" : ""}.`);
      }
      onDeleted?.();
    } catch (err) {
      toast.error(`Lösch fehlgeschlagen: ${err.message}`);
    } finally {
      setDeleting(false);
      // Health-Banner soll Konsistenz neu laden
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* ignore */ }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()} data-testid="kunde-delete-dialog">
        <div className="p-4 border-b bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Kunde endgültig löschen
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white rounded-sm"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-red-900 mt-1 truncate">{kunde_name}</p>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {loading || !preview ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Prüfe Daten…</div>
          ) : (
            <>
              <div>
                <p className="font-semibold mb-2">Folgendes wird unwiderruflich gelöscht:</p>
                <ul className="text-sm space-y-1 bg-muted/30 rounded-sm p-3 border">
                  <li className="flex justify-between"><span>Kunde</span><span className="font-medium">{preview.kunde}</span></li>
                  <li className="flex justify-between"><span>Projekte</span><span className="font-medium">{preview.projekte}</span></li>
                  <li className="flex justify-between"><span>Aufgaben</span><span className="font-medium">{preview.aufgaben}</span></li>
                  <li className="flex justify-between"><span>Termine</span><span className="font-medium">{preview.termine}</span></li>
                  <li className="flex justify-between"><span>Einsätze</span><span className="font-medium">{preview.einsaetze}</span></li>
                  <li className="flex justify-between"><span>Angebote</span><span className="font-medium">{preview.quotes}</span></li>
                  <li className="flex justify-between"><span>Rechnungen</span><span className="font-medium">{preview.rechnungen}</span></li>
                  <li className="flex justify-between"><span>Portale</span><span className="font-medium">{preview.portale}</span></li>
                  <li className="flex justify-between"><span>Portal-Uploads</span><span className="font-medium">{preview.portal_uploads}</span></li>
                  <li className="flex justify-between"><span>Monteur-App-Einträge</span><span className="font-medium">{preview.monteur_eintraege}</span></li>
                  <li className="flex justify-between"><span>Dateien</span><span className="font-medium">{preview.dateien}</span></li>
                </ul>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-3 text-xs flex items-start gap-2">
                <Download className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-700" />
                <div className="flex-1">
                  <strong>Sicherheitsnetz aktiv:</strong> Vor dem Lösch wird automatisch ein vollständiges ZIP-Backup erstellt und an dich heruntergeladen.
                  Der Kunde kann jederzeit wieder über „Import" eingelesen werden.
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} className="mt-0.5" data-testid="chk-delete-mail" />
                <span>
                  <span className="flex items-center gap-1 font-medium"><Mail className="w-3.5 h-3.5" /> Lösch-Quittung per E-Mail senden</span>
                  <span className="block text-xs text-muted-foreground">an service24@tischlerei-graupner.de mit ZIP im Anhang</span>
                </span>
              </label>

              <div>
                <label className="block text-xs font-medium mb-1">Begründung (optional, fürs Audit-Log)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="z. B. Testdaten, Duplikat, Storno..."
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="input-delete-reason"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-sm p-3">
                <label className="block text-xs font-medium mb-1">
                  Zur Bestätigung: Tippe den Namen <code className="bg-white px-1 rounded">{expected}</code> exakt ein:
                </label>
                <input
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="input-delete-confirm"
                  autoFocus
                />
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={execute}
            disabled={!canDelete}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-sm disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="btn-delete-execute"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Endgültig löschen
          </button>
        </div>
      </div>
    </div>
  );
};

export default KundeDeleteDialog;
