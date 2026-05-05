import { useState } from "react";
import { Check, X, Loader2, Trash2, Mail, Phone, MapPin, ExternalLink, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/common";
import { api } from "@/lib/api";

/**
 * MailDetailModal
 * Öffnet eine Mail-Anfrage zum Prüfen.
 * Zeigt:
 *  - Volltext der Mail (body_excerpt)
 *  - Geparste Felder (Anrede, Name, E-Mail, Telefon, Adresse, Anliegen)
 *  - Aktionen:
 *      • Als Kunde übernehmen → legt Kunde mit den geparsten Daten an
 *        und navigiert direkt ins Kunden-Modul (Bearbeiten-Maske offen)
 *      • Ignorieren
 *      • Löschen
 *      • Schließen
 *
 * Folgt VISION.md: KEIN eigenes Kunden-Formular hier — Bearbeitung passiert
 * im bestehenden Kunden-Modul (Datenmaske, einzige Wahrheit).
 */
const MailDetailModal = ({ entry, onClose, onChanged }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");

  if (!entry) return null;
  const p = entry.parsed || {};
  const fullName = [p.vorname, p.nachname].filter(Boolean).join(" ") || entry.from_name || "(ohne Name)";
  const isVorschlag = entry.status === "vorschlag" || entry.status === "spam_verdacht";

  const accept = async () => {
    setBusy("accept");
    try {
      const r = await api.post(`/module-mail-inbox/accept/${entry.id}`);
      toast.success(`Kunde „${r.data.kunde_name || fullName}" angelegt — öffne Datenmaske…`);
      onChanged?.();
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ }
      // Direkt ins bestehende Kunden-Modul (Bearbeiten-Maske)
      navigate(`/kunden?edit=${r.data.kunde_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Übernahme fehlgeschlagen");
      setBusy("");
    }
  };

  const reject = async () => {
    if (!window.confirm("Diese Anfrage als ignoriert markieren?")) return;
    setBusy("reject");
    try {
      await api.post(`/module-mail-inbox/reject/${entry.id}`);
      toast.success("Anfrage ignoriert");
      onChanged?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm("Diesen Eintrag endgültig löschen? Bei späteren Scans wird er nicht erneut importiert.")) return;
    setBusy("delete");
    try {
      await api.delete(`/module-mail-inbox/${entry.id}`);
      toast.success("Eintrag gelöscht");
      onChanged?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    } finally {
      setBusy("");
    }
  };

  return (
    <Modal isOpen={!!entry} onClose={onClose} title="Mail-Anfrage prüfen" size="xl">
      <div className="space-y-3 text-sm" data-testid="mail-detail-modal">
        {/* Kopf */}
        <div className="border rounded-sm p-3 bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-base">
              {p.anrede ? `${p.anrede} ` : ""}{fullName}
            </h3>
            {p.format && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-mono">{p.format}</span>
            )}
            {entry.account_label && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-700">{entry.account_label}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 break-words">
            <span className="font-mono">Betreff:</span> {entry.subject || "(kein Betreff)"}
          </div>
          <div className="text-xs text-muted-foreground break-all">
            <span className="font-mono">Von:</span> {entry.from_email || "—"}
            {entry.received_at && <> · <span className="font-mono">{new Date(entry.received_at).toLocaleString("de-DE")}</span></>}
          </div>
        </div>

        {/* Geparste Felder */}
        <div className="border rounded-sm p-3 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground mb-1">Erkannte Daten (werden als Kunde übernommen)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {p.email && (
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <a href={`mailto:${p.email}`} className="text-primary hover:underline truncate">{p.email}</a>
              </div>
            )}
            {p.telefon && (
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <a href={`tel:${p.telefon.replace(/\s/g, "")}`} className="text-primary hover:underline truncate">{p.telefon}</a>
              </div>
            )}
            {(p.strasse || p.plz || p.ort) && (
              <div className="flex items-center gap-2 sm:col-span-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">
                  {[p.strasse, [p.plz, p.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {p.source_url && (
              <div className="flex items-center gap-2 sm:col-span-2 min-w-0">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">{p.source_url}</a>
              </div>
            )}
          </div>
          {p.nachricht && (
            <div className="pt-2 border-t mt-2">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Anliegen</div>
              <pre className="text-xs whitespace-pre-wrap break-words">{p.nachricht}</pre>
            </div>
          )}
        </div>

        {/* Volltext der Mail */}
        <div className="border rounded-sm">
          <div className="text-xs font-semibold text-muted-foreground px-3 py-2 border-b bg-muted/20">
            Mail-Volltext
          </div>
          <pre
            className="text-xs whitespace-pre-wrap break-words p-3 max-h-[40vh] overflow-auto"
            data-testid="mail-detail-body"
          >
            {entry.body_excerpt || "(kein Inhalt vorhanden)"}
          </pre>
        </div>

        {/* Aktionen */}
        <div className="flex flex-wrap justify-between gap-2 pt-2 border-t">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm border rounded-sm hover:bg-muted"
            disabled={!!busy}
            data-testid="btn-detail-close"
          >
            Schließen
          </button>
          {isVorschlag && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={remove}
                disabled={!!busy}
                className="px-3 py-2 text-sm border border-red-200 text-red-700 rounded-sm hover:bg-red-50 inline-flex items-center gap-1 disabled:opacity-50"
                data-testid="btn-detail-delete"
              >
                {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Löschen
              </button>
              <button
                onClick={reject}
                disabled={!!busy}
                className="px-3 py-2 text-sm border rounded-sm hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50"
                data-testid="btn-detail-reject"
              >
                {busy === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Ignorieren
              </button>
              <button
                onClick={accept}
                disabled={!!busy}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 inline-flex items-center gap-1 disabled:opacity-50"
                data-testid="btn-detail-accept"
                title="Anlegen und im Kunden-Modul öffnen"
              >
                {busy === "accept" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Als Kunde übernehmen
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MailDetailModal;
