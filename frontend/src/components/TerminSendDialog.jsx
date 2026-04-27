import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Mail, User as UserIcon, HardHat, Users, Plus, Trash2 } from "lucide-react";

/**
 * Dialog zum Versenden eines Termins als ICS-Mail an verschiedene Empfänger.
 * Wird beim "GO"-Klick geöffnet (oder einem separaten "Senden"-Knopf).
 */
export const TerminSendDialog = ({ termin_id, onClose, onSent }) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sachbearbeiter, setSachbearbeiter] = useState(true);
  const [aucheKunde, setAuchKunde] = useState(true);
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState([]);
  const [extern, setExtern] = useState([]);
  const [externDraft, setExternDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/module-kalender-export/termin/${termin_id}/preview-recipients`);
        setInfo(r.data);
        // Wenn ein Monteur am Termin hängt, ihn vorausgewählt anbieten
        if (r.data.monteur && r.data.monteur.email) {
          setSelectedMitarbeiter([r.data.monteur.username]);
        }
        // Wenn kein Kunde verknüpft, Kunde-Option ausblenden (auchKunde nicht setzbar)
        if (!r.data.kunde || !r.data.kunde.email) setAuchKunde(false);
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Termin nicht gefunden");
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [termin_id]);  // eslint-disable-line

  const toggleMitarbeiter = (un) => {
    setSelectedMitarbeiter(s => s.includes(un) ? s.filter(x => x !== un) : [...s, un]);
  };

  const addExtern = () => {
    const e = (externDraft || "").trim();
    if (!e || !e.includes("@")) { toast.error("Gültige E-Mail eingeben"); return; }
    setExtern(arr => [...arr, e]);
    setExternDraft("");
  };

  const send = async () => {
    if (!sachbearbeiter && !selectedMitarbeiter.length && !aucheKunde && !extern.length) {
      toast.error("Mindestens einen Empfänger auswählen"); return;
    }
    setSending(true);
    try {
      const res = await api.post(`/module-kalender-export/termin/${termin_id}/send`, {
        sachbearbeiter,
        mitarbeiter_usernames: selectedMitarbeiter,
        auch_kunde: aucheKunde,
        externe_mails: extern,
      });
      const d = res.data;
      if (d.count_failed > 0) {
        toast.warning(`${d.count_sent} versendet, ${d.count_failed} Fehler – siehe Log`);
      } else {
        toast.success(`📧 ICS-Mail an ${d.count_sent} Empfänger gesendet`);
      }
      onSent && onSent(d);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Senden fehlgeschlagen");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg p-6">Lade…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="termin-send-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Termin als ICS senden
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Eine Kalender-Datei (.ics) wird per E-Mail an alle ausgewählten Empfänger geschickt.
            Beim Öffnen im Mailprogramm landet der Termin automatisch im Kalender (Google, Outlook, Apple, Thunderbird).
          </p>

          {/* Sachbearbeiter (immer da) */}
          <label className="flex items-start gap-2 p-2 border rounded-sm hover:bg-muted/30 cursor-pointer" data-testid="opt-sachbearbeiter">
            <input
              type="checkbox"
              checked={sachbearbeiter}
              onChange={(e) => setSachbearbeiter(e.target.checked)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Nur ich (Sachbearbeiter)</span>
              </div>
              <p className="text-xs text-muted-foreground">{info.sachbearbeiter.email || <em>Keine E-Mail hinterlegt</em>}</p>
            </div>
          </label>

          {/* Kunde (falls verknüpft) */}
          {info.kunde && info.kunde.email && (
            <label className="flex items-start gap-2 p-2 border rounded-sm hover:bg-muted/30 cursor-pointer" data-testid="opt-kunde">
              <input
                type="checkbox"
                checked={aucheKunde}
                onChange={(e) => setAuchKunde(e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Auch an Kunde: {info.kunde.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{info.kunde.email}</p>
              </div>
            </label>
          )}
          {info.kunde && !info.kunde.email && (
            <div className="text-xs text-muted-foreground p-2 border border-dashed rounded-sm">
              Kunde verknüpft ({info.kunde.name}), aber keine E-Mail-Adresse hinterlegt.
            </div>
          )}

          {/* Mitarbeiter (Multi-Select) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Mitarbeiter (Mehrfachauswahl)</span>
              {selectedMitarbeiter.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedMitarbeiter.length}</span>
              )}
            </div>
            <div className="border rounded-sm max-h-48 overflow-y-auto">
              {info.mitarbeiter_verfuegbar.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">Keine weiteren Mitarbeiter angelegt.</p>
              ) : (
                info.mitarbeiter_verfuegbar.map(m => {
                  const checked = selectedMitarbeiter.includes(m.username);
                  const hasMail = !!m.email;
                  return (
                    <label
                      key={m.username}
                      className={`flex items-center gap-2 p-2 border-b last:border-b-0 cursor-pointer ${checked ? "bg-emerald-50" : "hover:bg-muted/30"} ${!hasMail ? "opacity-50" : ""}`}
                      data-testid={`opt-mit-${m.username}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!hasMail}
                        onChange={() => toggleMitarbeiter(m.username)}
                      />
                      <HardHat className="w-3.5 h-3.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{m.anzeige_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {hasMail ? m.email : <em>keine E-Mail</em>} · {m.role}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Externe Mails */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Zusätzliche E-Mail-Adresse</span>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={externDraft}
                onChange={(e) => setExternDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtern(); } }}
                placeholder="z. B. partner@firma.de"
                className="flex-1 border rounded-sm p-2 text-sm"
                data-testid="input-extern-mail"
              />
              <button onClick={addExtern} className="px-3 border rounded-sm hover:bg-muted text-sm" data-testid="btn-add-extern">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {extern.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {extern.map((e, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-sm">
                    {e}
                    <button onClick={() => setExtern(arr => arr.filter((_, j) => j !== i))} className="hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={send}
            disabled={sending}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
            data-testid="btn-termin-send"
          >
            <Mail className="w-4 h-4" /> {sending ? "Sende…" : "ICS-Mail senden"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminSendDialog;
