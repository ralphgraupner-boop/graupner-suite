import { useState } from "react";
import { Loader2, UserCheck, UserPlus, X } from "lucide-react";
import { Modal } from "@/components/common";

/**
 * MailAcceptDuplicateDialog
 * Wird gezeigt, wenn /accept einen 409-Conflict liefert (Kunde mit gleicher
 * Mail/Telefon existiert bereits). Bietet drei Wege:
 *   1) Anfrage einem bestehenden Kunden zuordnen (kein Doppel-Kunde)
 *   2) Trotzdem als neuen Kunden anlegen (force_new)
 *   3) Abbrechen
 *
 * Props:
 *   open: bool
 *   duplicates: [{ id, name, email, phone, kontakt_status, match_reason, nachricht }]
 *   onLink:   (kunde_id) => Promise<void>     // /accept-link
 *   onForce:  () => Promise<void>             // /accept mit force_new=true
 *   onClose:  () => void
 */
const MailAcceptDuplicateDialog = ({ open, duplicates = [], onLink, onForce, onClose }) => {
  const [busy, setBusy] = useState("");

  if (!open) return null;

  const handleLink = async (kundeId) => {
    setBusy(`link:${kundeId}`);
    try {
      await onLink(kundeId);
    } finally {
      setBusy("");
    }
  };

  const handleForce = async () => {
    setBusy("force");
    try {
      await onForce();
    } finally {
      setBusy("");
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Kunde existiert bereits" size="md">
      <div className="space-y-3 text-sm" data-testid="mail-accept-duplicate-dialog">
        <p className="text-muted-foreground">
          Es wurde {duplicates.length === 1 ? "ein Kunde" : `${duplicates.length} Kunden`} mit gleicher
          E-Mail oder Telefonnummer gefunden. Bitte zuordnen oder bewusst neu anlegen.
        </p>

        <div className="border rounded-sm divide-y">
          {duplicates.map((k) => (
            <div key={k.id} className="p-3 flex items-start gap-3" data-testid={`duplicate-${k.id}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{k.name || "(ohne Name)"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[k.email, k.phone].filter(Boolean).join(" · ")}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                  {k.kontakt_status && (
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded-sm">{k.kontakt_status}</span>
                  )}
                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded-sm">
                    Treffer: {k.match_reason || "—"}
                  </span>
                </div>
              </div>
              {k.nachricht && (
            <div className="text-xs text-muted-foreground mt-1.5 p-2 bg-muted/40 rounded-sm max-h-24 overflow-y-auto whitespace-pre-line" data-testid={`dup-nachricht-${k.id}`}>
              <span className="font-medium">Bisherige Nachricht: </span>{k.nachricht}
            </div>
          )}
          <button
                onClick={() => handleLink(k.id)}
                disabled={!!busy}
                className="px-3 py-2 text-xs bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 inline-flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
                data-testid={`btn-link-to-${k.id}`}
                title="Anfrage diesem Kunden zuordnen"
              >
                {busy === `link:${k.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Zuordnen
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-2 border-t">
          <button
            onClick={onClose}
            disabled={!!busy}
            className="px-3 py-2 text-sm border rounded-sm hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50"
            data-testid="btn-duplicate-cancel"
          >
            <X className="w-4 h-4" />
            Abbrechen
          </button>
          <button
            onClick={handleForce}
            disabled={!!busy}
            className="px-3 py-2 text-sm border border-amber-300 text-amber-800 rounded-sm hover:bg-amber-50 inline-flex items-center gap-1 disabled:opacity-50"
            data-testid="btn-duplicate-force-new"
            title="Trotzdem als neuen Kunden anlegen"
          >
            {busy === "force" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Trotzdem neu anlegen
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MailAcceptDuplicateDialog;
