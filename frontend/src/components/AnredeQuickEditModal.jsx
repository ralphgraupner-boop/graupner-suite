import { useEffect, useState } from "react";
import { UserCircle2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * AnredeQuickEditModal
 *
 * Kompaktes Modal zum Ergänzen der Anrede für einen einzelnen Kunden.
 * Pattern: zentriertes Modal (Desktop) / Bottom-Sheet (Mobile), Backdrop-Blur,
 * ESC + Backdrop-Klick schließen.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   customer: { id, name?, vorname?, nachname?, anrede? }
 *   onSaved: (neueAnrede: string) => void
 */
export const AnredeQuickEditModal = ({ open, onClose, customer, onSaved }) => {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(customer?.anrede || "");
  }, [open, customer]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const displayName = (customer?.name ||
    `${customer?.vorname || ""} ${customer?.nachname || ""}`.trim() ||
    "diesen Kunden");

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) { toast.error("Bitte Anrede eingeben"); return; }
    if (!customer?.id) { toast.error("Kunde ohne ID"); return; }
    setSaving(true);
    try {
      await api.put(`/modules/kunden/data/${customer.id}`, { anrede: trimmed });
      toast.success("Anrede gespeichert");
      onSaved?.(trimmed);
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const quickPills = ["Herr", "Frau", "Familie", "Firma"];

  return (
    <div
      className="fixed inset-0 z-[9100] flex items-end sm:items-center sm:justify-center bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="anrede-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-background border shadow-2xl w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl animate-in slide-in-from-bottom duration-200"
        data-testid="anrede-modal"
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight">Anrede ergänzen</h2>
              <p className="text-xs text-muted-foreground truncate">{displayName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Schließen"
            data-testid="btn-anrede-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {quickPills.map((p) => (
              <button
                key={p}
                onClick={() => setValue(p)}
                data-testid={`anrede-pill-${p.toLowerCase()}`}
                className="px-3 h-9 rounded-full border text-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
            placeholder="z. B. Herr / Frau / Familie …"
            data-testid="anrede-input"
            className="w-full h-11 rounded-md border border-input bg-background px-3 text-base"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-10 px-4 rounded-md border text-sm hover:bg-muted"
            >
              Abbrechen
            </button>
            <button
              onClick={save}
              disabled={saving || !value.trim()}
              data-testid="btn-anrede-save"
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnredeQuickEditModal;
