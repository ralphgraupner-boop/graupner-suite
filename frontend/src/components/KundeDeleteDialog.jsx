import { useState, useEffect } from "react";
import { Trash2, X, Loader2, AlertTriangle, Archive, Info } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Sicherer Lösch-Dialog (Soft-Delete in den Papierkorb).
 *
 * Workflow:
 *  - Klick „In Papierkorb verschieben" → Kunde bekommt deleted_at gesetzt.
 *  - Beim nächsten App-Start fragt die Suite ob die Papierkorb-Einträge
 *    endgültig gelöscht werden sollen (mit Login-Passwort).
 *  - Bis dahin lässt sich der Kunde im Papierkorb wiederherstellen.
 */
export const KundeDeleteDialog = ({ kunde_id, kunde_name, onClose, onDeleted }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/module-export/preview/${kunde_id}`)
      .then(r => setPreview(r.data))
      .catch(err => toast.error(err?.response?.data?.detail || "Vorschau fehlgeschlagen"))
      .finally(() => setLoading(false));
  }, [kunde_id]);

  const moveToTrash = async () => {
    setDeleting(true);
    try {
      await api.post(`/module-papierkorb/move/${kunde_id}`);
      toast.success(`„${kunde_name || "Kunde"}" in Papierkorb verschoben. Endgültiges Löschen beim nächsten App-Start.`);
      onDeleted?.();
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* ignore */ }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Verschieben fehlgeschlagen");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()} data-testid="kunde-delete-dialog">
        <div className="p-4 border-b bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
              <Archive className="w-5 h-5" /> In Papierkorb verschieben
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white rounded-sm"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-amber-900 mt-1 truncate">{kunde_name}</p>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {loading || !preview ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Prüfe Daten…</div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-700" />
                <div className="flex-1 text-blue-900">
                  <strong>Zwei-Stufen-Lösch:</strong> Der Kunde wird zuerst in den Papierkorb verschoben.
                  Beim nächsten App-Start wirst du gefragt ob er endgültig gelöscht werden soll
                  (mit Passwort-Bestätigung). Bis dahin kannst du ihn jederzeit wiederherstellen.
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">Mit verschoben werden (zur Info):</p>
                <ul className="text-xs space-y-1 bg-muted/30 rounded-sm p-3 border">
                  <li className="flex justify-between"><span>Projekte</span><span className="font-medium">{preview.projekte}</span></li>
                  <li className="flex justify-between"><span>Aufgaben</span><span className="font-medium">{preview.aufgaben}</span></li>
                  <li className="flex justify-between"><span>Termine</span><span className="font-medium">{preview.termine}</span></li>
                  <li className="flex justify-between"><span>Einsätze</span><span className="font-medium">{preview.einsaetze}</span></li>
                  <li className="flex justify-between"><span>Angebote</span><span className="font-medium">{preview.quotes}</span></li>
                  <li className="flex justify-between"><span>Rechnungen</span><span className="font-medium">{preview.rechnungen}</span></li>
                  <li className="flex justify-between"><span>Portale</span><span className="font-medium">{preview.portale}</span></li>
                  <li className="flex justify-between"><span>Dateien</span><span className="font-medium">{preview.dateien}</span></li>
                </ul>
                <p className="text-[11px] text-muted-foreground mt-1">Die Daten bleiben erhalten — der Kunde wird nur ausgeblendet bis zur endgültigen Bestätigung.</p>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted" data-testid="btn-delete-cancel">Abbrechen</button>
          <button
            onClick={moveToTrash}
            disabled={deleting}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-sm disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="btn-delete-execute"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            In Papierkorb verschieben
          </button>
        </div>
      </div>
    </div>
  );
};

export default KundeDeleteDialog;
