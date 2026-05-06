import { useCallback, useEffect, useState } from "react";
import { Copy, Link as LinkIcon, Loader2, Plus, Trash2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/common";
import { api } from "@/lib/api";

/**
 * KundenLinkDialog — Verwaltet Mitarbeiter-Links für einen Kunden.
 * - Zeigt alle bereits erzeugten Links (aktive/abgelaufene/widerrufene)
 * - Neuen Link erzeugen (30 Tage gültig)
 * - Link kopieren / QR-Code anzeigen / widerrufen
 * Probezeit-Feature, wird später durch echte Monteur-App ersetzt.
 */
const KundenLinkDialog = ({ isOpen, onClose, kunde, projekt = null }) => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [qrFor, setQrFor] = useState(null);

  const publicBase = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    if (!kunde?.id) return;
    setLoading(true);
    try {
      const url = projekt?.id
        ? `/module-kundenlink/list/${kunde.id}?projekt_id=${projekt.id}`
        : `/module-kundenlink/list/${kunde.id}`;
      const r = await api.get(url);
      setLinks(r.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [kunde?.id, projekt?.id]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const createLink = async () => {
    setCreating(true);
    try {
      const body = projekt?.id ? { projekt_id: projekt.id } : {};
      await api.post(`/module-kundenlink/create/${kunde.id}`, body);
      toast.success("Link erzeugt");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erzeugen fehlgeschlagen");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (l) => {
    if (!window.confirm("Link wirklich widerrufen? Der Mitarbeiter kann dann nichts mehr öffnen.")) return;
    try {
      await api.post(`/module-kundenlink/${l.id}/revoke`);
      toast.success("Widerrufen");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen – bitte manuell markieren.");
    }
  };

  const statusOf = (l) => {
    if (l.revoked) return { label: "Widerrufen", cls: "bg-red-100 text-red-700" };
    try {
      const exp = new Date(l.expires_at);
      if (new Date() > exp) return { label: "Abgelaufen", cls: "bg-slate-200 text-slate-700" };
      return { label: "Aktiv", cls: "bg-emerald-100 text-emerald-700" };
    } catch {
      return { label: "?", cls: "bg-slate-100 text-slate-600" };
    }
  };

  if (!kunde) return null;
  const fullName = [kunde.vorname, kunde.nachname].filter(Boolean).join(" ") || kunde.firma || "Kunde";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={projekt ? "Link für Mitarbeiter (Projekt)" : "Link für Mitarbeiter (Besichtigung)"} size="lg">
      <div className="space-y-3 text-sm" data-testid="kundenlink-dialog">
        <div className="text-xs text-muted-foreground border-b pb-2">
          Kunde: <span className="font-medium text-foreground">{fullName}</span>
          {projekt && (
            <>
              {" · "}
              Projekt: <span className="font-medium text-foreground">{projekt.titel}</span>
            </>
          )}
          <span className="block mt-1 italic">
            Öffentlicher Link – kein Login nötig. 30 Tage gültig.
            {projekt
              ? " Mitarbeiter sieht Kunde + Projekt-Bilder, -Beschreibung, -Notizen."
              : " Mitarbeiter sehen nur Kontakt, Adresse, Anliegen, Bilder."}
          </span>
        </div>

        {/* Neuer Link */}
        <button
          type="button"
          onClick={createLink}
          disabled={creating}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          data-testid="btn-kundenlink-create"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Neuen Link erzeugen
        </button>

        {/* Liste */}
        {loading ? (
          <div className="text-xs text-muted-foreground py-3 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Lade…
          </div>
        ) : links.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-3">
            Noch kein Link erzeugt.
          </div>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const url = `${publicBase}/m/${l.token}`;
              const st = statusOf(l);
              return (
                <li key={l.id} className="border rounded-sm p-3 bg-muted/30" data-testid={`kundenlink-item-${l.id}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold ${st.cls}`}>{st.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      Erstellt: {new Date(l.created_at).toLocaleString("de-DE")} · Gültig bis: {new Date(l.expires_at).toLocaleDateString("de-DE")}
                      {(l.view_count || 0) > 0 && <> · {l.view_count} Aufruf(e)</>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <input
                      readOnly
                      value={url}
                      onClick={(e) => e.target.select()}
                      className="flex-1 min-w-0 text-xs px-2 py-1 rounded-sm border bg-background font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copy(url)}
                      disabled={l.revoked}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-sm border hover:bg-muted disabled:opacity-40"
                      title="Link in die Zwischenablage"
                      data-testid={`btn-kundenlink-copy-${l.id}`}
                    >
                      <Copy className="w-3.5 h-3.5" /> Kopieren
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrFor(qrFor === l.id ? null : l.id)}
                      disabled={l.revoked}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-sm border hover:bg-muted disabled:opacity-40"
                      title="QR-Code anzeigen"
                      data-testid={`btn-kundenlink-qr-${l.id}`}
                    >
                      <QrCode className="w-3.5 h-3.5" /> QR
                    </button>
                    {!l.revoked && (
                      <button
                        type="button"
                        onClick={() => revoke(l)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-700 rounded-sm hover:bg-red-50"
                        title="Link widerrufen"
                        data-testid={`btn-kundenlink-revoke-${l.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Widerrufen
                      </button>
                    )}
                  </div>
                  {qrFor === l.id && (
                    <div className="mt-3 flex flex-col items-center gap-2 bg-white p-3 rounded-sm border">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`}
                        alt="QR-Code"
                        className="w-56 h-56"
                        data-testid={`kundenlink-qr-img-${l.id}`}
                      />
                      <div className="text-[11px] text-muted-foreground">Zum Scannen vor die Handy-Kamera halten.</div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm border rounded-sm hover:bg-muted"
            data-testid="btn-kundenlink-close"
          >
            Schließen
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default KundenLinkDialog;
