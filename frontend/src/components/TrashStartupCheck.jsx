import { useEffect, useState } from "react";
import { Trash2, X, Loader2, AlertTriangle, Archive, RotateCcw, Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * TrashStartupCheck
 * ------------------
 * Wird in `MainLayout` einmal pro Session beim Login eingebunden.
 * Prüft ob Kunden im Papierkorb sind (`module_kunden.deleted_at`-Filter).
 * Falls ja: Modal mit Liste aller Papierkorb-Kunden + Optionen:
 *   - Wiederherstellen (einzeln)
 *   - Endgültig löschen (alle, mit Login-Passwort)
 *   - Später entscheiden (= Modal schließen, beim nächsten Login wieder)
 */
const SESSION_KEY = "graupner_trash_check_done";

const TrashStartupCheck = () => {
  const [show, setShow] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [purging, setPurging] = useState(false);
  const [restoringId, setRestoringId] = useState("");

  useEffect(() => {
    // Pro Session nur einmal prüfen
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    if (!localStorage.getItem("token")) return;
    (async () => {
      try {
        const r = await api.get("/module-papierkorb/count");
        const n = r.data?.count || 0;
        if (n > 0) {
          const list = await api.get("/module-papierkorb/list");
          setItems(list.data || []);
          setShow(true);
        }
      } catch {
        // Backend evtl. noch nicht da → still ignorieren
      } finally {
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    })();
  }, []);

  const restore = async (id) => {
    setRestoringId(id);
    try {
      await api.post(`/module-papierkorb/restore/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Wiederhergestellt");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    } finally {
      setRestoringId("");
    }
  };

  const purgeAll = async () => {
    if (!password) {
      toast.error("Bitte Login-Passwort eingeben");
      return;
    }
    if (!window.confirm(`${items.length} Kunden ENDGÜLTIG löschen?\nDieser Schritt ist nicht umkehrbar.`)) return;
    setPurging(true);
    try {
      const r = await api.post("/module-papierkorb/purge-all", {
        password,
        send_mail: true,
        reason: "Aus Papierkorb beim App-Start endgültig gelöscht",
      });
      const ok = r.data?.deleted_count || 0;
      const fail = r.data?.failed_count || 0;
      toast.success(`${ok} endgültig gelöscht${fail ? `, ${fail} Fehler` : ""}.`);
      setItems([]);
      setShow(false);
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* ignore */ }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Fehler";
      toast.error(msg);
      if (err?.response?.status === 401) setPassword("");
    } finally {
      setPurging(false);
      setLoading(false);
    }
  };

  if (!show || items.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" data-testid="trash-startup-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b bg-amber-50 border-amber-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Papierkorb: {items.length} Kunde{items.length === 1 ? "" : "n"} warten auf endgültige Löschung
          </h2>
          <button
            onClick={() => setShow(false)}
            className="p-1 hover:bg-white rounded-sm"
            data-testid="btn-trash-later"
            title="Später entscheiden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Du hast diese Kunden zwischenzeitlich in den Papierkorb verschoben.
              Du kannst jeden einzeln wiederherstellen, oder alle endgültig löschen.
              Endgültig löschen erfordert dein Login-Passwort als Bestätigung.
            </div>
          </div>

          <div className="space-y-1.5 max-h-[40vh] overflow-auto">
            {items.map((it) => {
              const display = (it.vorname || it.nachname)
                ? `${it.vorname || ""} ${it.nachname || ""}`.trim()
                : (it.name || it.firma || it.email || it.id);
              return (
                <div key={it.id} className="border rounded-sm p-2.5 flex items-center gap-3 hover:bg-accent/30" data-testid={`trash-item-${it.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{display}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {it.email || "—"} · gelöscht am {it.deleted_at?.slice(0, 10) || "?"}
                      {it.deleted_by && ` von ${it.deleted_by}`}
                    </div>
                  </div>
                  <button
                    onClick={() => restore(it.id)}
                    disabled={restoringId === it.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm border hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50"
                    data-testid={`btn-trash-restore-${it.id}`}
                  >
                    {restoringId === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Wiederherstellen
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-3 mt-2">
            <label className="block text-xs font-medium mb-1">
              <Lock className="w-3 h-3 inline mr-1" />
              Login-Passwort zur Bestätigung des endgültigen Löschens:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dein Login-Passwort"
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="input-trash-password"
              autoComplete="current-password"
            />
          </div>
        </div>

        <div className="p-4 border-t flex justify-between gap-2 flex-wrap">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-sm border rounded-sm hover:bg-muted"
            data-testid="btn-trash-decide-later"
          >
            Später entscheiden
          </button>
          <button
            onClick={purgeAll}
            disabled={purging || !password}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-sm disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="btn-trash-purge-all"
          >
            {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Alle {items.length} endgültig löschen
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrashStartupCheck;
