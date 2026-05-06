import { useEffect, useState } from "react";
import { Link2, X, Loader2, Clock, AlertTriangle, RefreshCw, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * KundenLinkExpiryCheck
 * ---------------------
 * Wird in `App.js` einmal pro Session beim Login angezeigt.
 * Prüft ob aktive Mitarbeiter-Links bald ablaufen oder schon abgelaufen sind
 * (`/api/module-kundenlink/expiring?days=7`).
 *
 * Falls ja → Modal mit Liste pro Kunde + 3 Aktionen:
 *   - Verlängern um 7 / 14 / 30 Tage
 *   - Widerrufen
 *   - Später entscheiden (nur Modal schließen)
 */
const SESSION_KEY = "graupner_kundenlink_expiry_done";
const WARN_DAYS = 7; // Warnung ab 7 Tagen vor Ablauf

const KundenLinkExpiryCheck = () => {
  const [show, setShow] = useState(false);
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    if (!localStorage.getItem("token")) return;
    (async () => {
      try {
        const r = await api.get(`/module-kundenlink/expiring?days=${WARN_DAYS}`);
        const list = r.data || [];
        if (list.length > 0) {
          setItems(list);
          setShow(true);
        }
      } catch {
        // Backend evtl. noch nicht da → still ignorieren
      } finally {
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    })();
  }, []);

  const extend = async (id, days) => {
    setBusyId(id);
    try {
      await api.post(`/module-kundenlink/${id}/extend`, { days });
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success(`Link um ${days} Tage verlängert`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Verlängern");
    } finally {
      setBusyId("");
    }
  };

  const revoke = async (id) => {
    if (!window.confirm("Diesen Link wirklich widerrufen? Der Mitarbeiter sieht ihn dann sofort nicht mehr.")) return;
    setBusyId(id);
    try {
      await api.post(`/module-kundenlink/${id}/revoke`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Link widerrufen");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    } finally {
      setBusyId("");
    }
  };

  if (!show || items.length === 0) return null;

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return "?"; }
  };

  const daysLabel = (n, expired) => {
    if (expired) return "abgelaufen";
    if (n === 0) return "läuft heute ab";
    if (n === 1) return "läuft morgen ab";
    return `läuft in ${n} Tagen ab`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" data-testid="kundenlink-expiry-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b bg-amber-50 border-amber-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            {items.length} Mitarbeiter-Link{items.length === 1 ? "" : "s"} läuft bald ab
          </h2>
          <button
            onClick={() => setShow(false)}
            className="p-1 hover:bg-white rounded-sm"
            data-testid="btn-kundenlink-later"
            title="Später entscheiden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Diese Links erlauben Mitarbeitern, ohne Login Kundendaten zu sehen.
              Verlängern, wenn der Einsatz noch läuft – sonst widerrufen.
            </div>
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-auto">
            {items.map((it) => {
              const isBusy = busyId === it.id;
              return (
                <div
                  key={it.id}
                  className={`border rounded-sm p-3 ${it.expired ? "bg-red-50 border-red-200" : "bg-white"}`}
                  data-testid={`expiring-link-${it.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">
                        Kunde: {it.kunde_name}
                        {it.kunde_firma && <span className="text-muted-foreground font-normal"> ({it.kunde_firma})</span>}
                        {it.projekt_titel && (
                          <span className="text-violet-700 font-normal"> · Projekt: {it.projekt_titel}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                        <span className={`flex items-center gap-1 ${it.expired ? "text-red-700 font-medium" : ""}`}>
                          <Clock className="w-3 h-3" />
                          {daysLabel(it.days_remaining, it.expired)} (am {fmtDate(it.expires_at)})
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {it.view_count} Aufrufe
                        </span>
                        {it.contribution_count > 0 && (
                          <span className="text-emerald-700">{it.contribution_count} Beitrag{it.contribution_count === 1 ? "" : "e"}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-1">Verlängern:</span>
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        onClick={() => extend(it.id, days)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm border hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50"
                        data-testid={`btn-extend-${it.id}-${days}`}
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        +{days} Tage
                      </button>
                    ))}
                    <button
                      onClick={() => revoke(it.id)}
                      disabled={isBusy}
                      className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      data-testid={`btn-revoke-${it.id}`}
                    >
                      <XCircle className="w-3 h-3" />
                      Widerrufen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t flex justify-end">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-sm border rounded-sm hover:bg-muted"
            data-testid="btn-kundenlink-decide-later"
          >
            Später entscheiden
          </button>
        </div>
      </div>
    </div>
  );
};

export default KundenLinkExpiryCheck;
