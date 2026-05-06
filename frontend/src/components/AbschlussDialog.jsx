import { useState, useEffect } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/common";
import { api } from "@/lib/api";

/**
 * AbschlussDialog — zentrales Modal zum "sauberen Abschließen" von Datensätzen
 * (Mail-Anfragen / Kunden / Rechnungen). Lädt Abschluss-Gründe aus dem
 * Textvorlagen-Modul (text_type="abschluss_grund") und lässt den Nutzer
 * eine Vorlage auswählen oder eigenen Text schreiben.
 *
 * Prop-API:
 *   isOpen: boolean
 *   onClose: () => void
 *   onConfirm: async ({grund}) => void   (Aufrufer setzt dann Status + DB-Feld)
 *   titleLabel?: string    Default: "Abschließen"
 *   subjectLabel?: string  z.B. "Jorge Forrmann – Schiebetür-Anfrage"
 */
const AbschlussDialog = ({ isOpen, onClose, onConfirm, titleLabel = "Abschließen", subjectLabel = "" }) => {
  const [vorlagen, setVorlagen] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [grund, setGrund] = useState("");
  const [loadingVorlagen, setLoadingVorlagen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingVorlagen(true);
      try {
        const r = await api.get("/modules/textvorlagen/data?doc_type=abschlussgrund");
        if (!cancelled) setVorlagen(r.data || []);
      } catch {
        if (!cancelled) setVorlagen([]);
      } finally {
        if (!cancelled) setLoadingVorlagen(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Beim Öffnen Felder zurücksetzen
  useEffect(() => {
    if (isOpen) { setSelectedId(""); setGrund(""); }
  }, [isOpen]);

  const pickVorlage = (v) => {
    setSelectedId(v.id);
    setGrund(v.content || v.title || "");
  };

  const submit = async () => {
    const text = grund.trim();
    if (!text) {
      toast.error("Bitte Grund angeben oder eine Vorlage wählen.");
      return;
    }
    setSaving(true);
    try {
      await onConfirm({ grund: text });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title={titleLabel} size="lg">
      <div className="space-y-3 text-sm" data-testid="abschluss-dialog">
        {subjectLabel && (
          <div className="text-xs text-muted-foreground border-b pb-2">
            Betrifft: <span className="font-medium text-foreground">{subjectLabel}</span>
          </div>
        )}

        {/* Vorlagen */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Vorlage wählen <span className="text-muted-foreground font-normal">(Einstellungen → Textvorlagen → Kategorie „Abschlussgrund")</span>
          </label>
          {loadingVorlagen ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Lade Vorlagen…
            </div>
          ) : vorlagen.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">
              Keine Abschluss-Gründe hinterlegt. Du kannst welche unter Einstellungen → Textvorlagen → Kategorie „Abschlussgrund" anlegen.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {vorlagen.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickVorlage(v)}
                  className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${selectedId === v.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-foreground"}`}
                  data-testid={`abschluss-vorlage-${v.id}`}
                >
                  {v.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grund-Textfeld */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Grund <span className="text-red-600">*</span>
            <span className="text-muted-foreground font-normal"> (frei editierbar)</span>
          </label>
          <textarea
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={4}
            placeholder="Warum wird abgeschlossen? (z.B. Kunde hat sich anders entschieden)"
            className="w-full border rounded-sm p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="abschluss-grund-text"
          />
        </div>

        {/* Aktionen */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-sm hover:bg-muted disabled:opacity-50"
            data-testid="abschluss-cancel"
          >
            <X className="w-4 h-4" /> Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !grund.trim()}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50"
            data-testid="abschluss-confirm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Abschließen
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AbschlussDialog;
