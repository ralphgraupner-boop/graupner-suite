/**
 * WolkePopover — Interne Kurzkommunikation (Wolken-Modul).
 *
 * Mounts: einmal in App.js. Rendert ein festes Cloud-Icon mit Badge
 * rechts oben (Desktop) bzw. unten als Floating-Button (Mobile),
 * öffnet einen Slide-Over mit 3 Tabs: Erhalten · Gesendet · Neu.
 *
 * Module-First: spricht ausschliesslich /api/module-wolke/* an.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { TextareaWithAI } from "@/components/TextareaWithAI";
import { WolkeAktionen } from "@/components/wolke/WolkeAktionen";
import { Cloud, X, Send, Check, Trash2, Inbox, ArrowUpRight, Plus, User, Folder, Wrench } from "lucide-react";
import { toast } from "sonner";

const fmtZeit = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " +
           d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

const WolkeKarte = ({ wolke, ansicht, onErledigt, onDelete, onNavigate }) => {
  const isAufgabe = wolke.type === "aufgabe";
  const isErledigt = wolke.status === "erledigt";
  return (
    <div
      className={`p-3 rounded-lg border ${isAufgabe && !isErledigt ? "border-amber-400 bg-amber-50" : "border-border bg-card"} space-y-2`}
      data-testid={`wolke-karte-${wolke.id}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${isAufgabe ? "bg-amber-200 text-amber-900" : "bg-slate-200 text-slate-700"}`}>
            {isAufgabe ? "Aufgabe" : "Memo"}
          </span>
          <span className="text-muted-foreground truncate">
            {ansicht === "erhalten" ? `von ${wolke.absender_name}` : `an ${wolke.empfaenger_name}`}
          </span>
        </div>
        <span className="text-muted-foreground shrink-0">{fmtZeit(wolke.created_at)}</span>
      </div>
      <div className="text-sm whitespace-pre-wrap break-words">{wolke.text}</div>
      {(wolke.kunde_id || wolke.projekt_id || wolke.einsatz_id) && (
        <div className="flex flex-wrap gap-2" data-testid={`wolke-links-${wolke.id}`}>
          {wolke.kunde_id && (
            <button
              type="button"
              onClick={() => onNavigate?.(`/module/kunden?edit=${wolke.kunde_id}`)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
              data-testid={`wolke-link-kunde-${wolke.id}`}
              title="Zum Kunden springen"
            >
              <User className="w-3.5 h-3.5" /> {wolke.kunde_label || "Kunde öffnen"}
            </button>
          )}
          {wolke.projekt_id && (
            <button
              type="button"
              onClick={() => onNavigate?.(`/module/projekte/werkbank/${wolke.projekt_id}`)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
              data-testid={`wolke-link-projekt-${wolke.id}`}
              title="Zum Projekt springen"
            >
              <Folder className="w-3.5 h-3.5" /> {wolke.projekt_label || "Projekt öffnen"}
            </button>
          )}
          {wolke.einsatz_id && (
            <button
              type="button"
              onClick={() => onNavigate?.(`/einsaetze?id=${wolke.einsatz_id}`)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
              data-testid={`wolke-link-einsatz-${wolke.id}`}
              title="Zum Einsatz springen"
            >
              <Wrench className="w-3.5 h-3.5" /> {wolke.einsatz_label || "Einsatz öffnen"}
            </button>
          )}
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs">
          {isErledigt ? (
            <span className="text-emerald-700">✓ erledigt {wolke.erledigt_am ? `· ${fmtZeit(wolke.erledigt_am)}` : ""}</span>
          ) : (
            <span className="text-amber-700">● offen</span>
          )}
        </div>
        <div className="flex gap-2">
          {ansicht === "erhalten" && isAufgabe && !isErledigt && (
            <button
              onClick={() => onErledigt(wolke.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              data-testid={`wolke-btn-erledigt-${wolke.id}`}
            >
              <Check className="w-4 h-4" /> Erledigt
            </button>
          )}
          {ansicht === "gesendet" && (
            <button
              onClick={() => onDelete(wolke.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 hover:bg-red-50"
              data-testid={`wolke-btn-delete-${wolke.id}`}
              title="Löschen"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const WolkeNeuForm = ({ mitarbeiter, onSent, onKundeChange }) => {
  const [empfaengerId, setEmpfaengerId] = useState("");
  const [type, setType] = useState("aufgabe");
  const [text, setText] = useState("");
  const [kundeSuche, setKundeSuche] = useState("");
  const [kundenTreffer, setKundenTreffer] = useState([]);
  const [kundeId, setKundeId] = useState("");
  const [kundeLabel, setKundeLabel] = useState("");
  const [sending, setSending] = useState(false);

  // Kundensuche
  useEffect(() => {
    if (kundeId || kundeSuche.length < 2) { setKundenTreffer([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/modules/kunden/data?search=${encodeURIComponent(kundeSuche)}`);
        if (!cancel) setKundenTreffer((res.data || []).slice(0, 8));
      } catch { /* ignore */ }
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [kundeSuche, kundeId]);

  const submit = async () => {
    if (sending) return;
    if (!empfaengerId) { toast.error("Bitte Empfänger wählen"); return; }
    if (!text.trim()) { toast.error("Bitte Text oder Sprachnotiz aufnehmen"); return; }
    setSending(true);
    try {
      const empf = mitarbeiter.find(m => m.id === empfaengerId);
      await api.post("/module-wolke", {
        type, empfaenger_id: empfaengerId, kunde_id: kundeId, text: text.trim(),
      });
      const banner = `${type === "aufgabe" ? "Aufgabe" : "Memo"} an ${empf?.name || "Empfänger"} verschickt`;
      toast.success(banner);
      setText(""); setKundeId(""); setKundeLabel(""); setKundeSuche(""); onKundeChange?.(null);
      onSent && onSent(banner);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Senden fehlgeschlagen");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="wolke-neu-form">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Empfänger</label>
        <select
          value={empfaengerId}
          onChange={(e) => setEmpfaengerId(e.target.value)}
          className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
          data-testid="wolke-empfaenger-select"
        >
          <option value="">— wählen —</option>
          {mitarbeiter.map(m => (
            <option key={m.id} value={m.id}>{m.name}{m.position ? ` (${m.position})` : ""}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Typ</label>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setType("aufgabe")}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${type === "aufgabe" ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-muted text-muted-foreground"}`}
            data-testid="wolke-type-toggle-aufgabe"
          >
            Aufgabe (muss erledigt werden)
          </button>
          <button
            type="button"
            onClick={() => setType("memo")}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${type === "memo" ? "bg-slate-200 border-slate-400 text-slate-900" : "bg-muted text-muted-foreground"}`}
            data-testid="wolke-type-toggle-memo"
          >
            Memo (nur Info)
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Kunde (optional)</label>
        {kundeId ? (
          <div className="mt-1 flex items-center justify-between px-3 py-2 rounded-lg border bg-muted text-sm">
            <span>📎 {kundeLabel}</span>
            <button onClick={() => { setKundeId(""); setKundeLabel(""); setKundeSuche(""); onKundeChange?.(null); }} className="text-xs text-red-600">Entfernen</button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={kundeSuche}
              onChange={(e) => setKundeSuche(e.target.value)}
              placeholder="Name/Firma suchen…"
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
              data-testid="wolke-kunde-search"
            />
            {kundenTreffer.length > 0 && (
              <div className="absolute z-50 mt-1 left-0 right-0 max-h-48 overflow-auto bg-popover border rounded-lg shadow-lg">
                {kundenTreffer.map(k => {
                  const label = k.firma || `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.name || "(ohne Name)";
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => { setKundeId(k.id); setKundeLabel(label); setKundenTreffer([]); onKundeChange?.({ id: k.id, label }); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Nachricht (tippen oder Sprachnotiz)</label>
        <TextareaWithAI
          value={text}
          onChange={(e) => setText(e.target.value)}
          feldLabel="Wolken-Nachricht"
          kontext="freitext"
          rows={4}
          placeholder="Was soll dein Kollege wissen oder erledigen?"
          testId="wolke-text-input"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={sending}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-base font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        data-testid="wolke-btn-senden"
      >
        <Send className="w-5 h-5" />
        {sending ? "Sende…" : "Wolke senden"}
      </button>
    </div>
  );
};

export const WolkePopover = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("erhalten");
  const [count, setCount] = useState(0);
  const [erhalten, setErhalten] = useState([]);
  const [gesendet, setGesendet] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [banner, setBanner] = useState("");
  const [neuKunde, setNeuKunde] = useState(null);

  const reloadCount = useCallback(async () => {
    try {
      const res = await api.get("/module-wolke/count-offen");
      setCount(res.data?.count || 0);
    } catch { /* ignore */ }
  }, []);

  const reloadListen = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api.get("/module-wolke/erhalten"),
        api.get("/module-wolke/gesendet"),
      ]);
      setErhalten(a.data || []);
      setGesendet(b.data || []);
    } catch { /* ignore */ }
  }, []);

  // Polling Badge
  useEffect(() => {
    reloadCount();
    const t = setInterval(reloadCount, 60000);
    const onFocus = () => reloadCount();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [reloadCount]);

  // Mitarbeiter einmalig
  useEffect(() => {
    api.get("/module-wolke/mitarbeiter").then(r => setMitarbeiter(r.data || [])).catch(() => {});
  }, []);

  // Beim Öffnen: Listen laden + alle 10 s pollen, damit Absender Bestätigungen live sieht.
  useEffect(() => {
    if (!open) return;
    reloadListen();
    const t = setInterval(reloadListen, 10000);
    return () => clearInterval(t);
  }, [open, reloadListen]);

  const markErhalten = async (id) => {
    try {
      await api.patch(`/module-wolke/${id}/erhalten`);
      toast.success("Erhalten bestätigt");
      await Promise.all([reloadListen(), reloadCount()]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Konnte nicht bestätigt werden");
    }
  };

  const markErledigt = async (id) => {
    try {
      await api.patch(`/module-wolke/${id}/erledigt`);
      toast.success("Erledigt");
      await Promise.all([reloadListen(), reloadCount()]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Konnte nicht erledigt werden");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Wolke wirklich löschen?")) return;
    try {
      await api.delete(`/module-wolke/${id}`);
      toast.success("Gelöscht");
      await reloadListen();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  // Sprung zum verknüpften Datensatz (Kunde/Projekt/Einsatz) – schließt das Slide-Over.
  const openRecord = (to) => {
    if (!to) return;
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      {/* Floating Cloud-Icon mit Badge */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg flex items-center justify-center"
        data-testid="wolke-icon-button"
        title="Wolke öffnen"
      >
        <Cloud className="w-7 h-7" />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold ring-2 ring-background"
            data-testid="wolke-badge-count"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Slide-Over */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-50 inset-y-0 right-0 w-full sm:w-[480px] bg-background shadow-2xl flex flex-col"
            data-testid="wolke-popover"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2"><Cloud className="w-5 h-5 text-sky-500" /> Wolke</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded hover:bg-muted" data-testid="wolke-btn-close"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex border-b">
              {[
                { id: "erhalten", icon: Inbox, label: "Erhalten", n: erhalten.length },
                { id: "gesendet", icon: ArrowUpRight, label: "Gesendet", n: gesendet.length },
                { id: "neu", icon: Plus, label: "Neu", n: null },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 py-3 text-sm font-medium inline-flex items-center justify-center gap-1 ${tab === t.id ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
                    data-testid={`wolke-tab-${t.id}`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}{t.n !== null ? ` (${t.n})` : ""}
                  </button>
                );
              })}
            </div>

            {banner && (
              <div
                className="mx-4 mt-3 px-3 py-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-sm font-medium flex items-center justify-between gap-2"
                data-testid="wolke-success-banner"
              >
                <span className="inline-flex items-center gap-2"><Check className="w-4 h-4" /> {banner}</span>
                <button onClick={() => setBanner("")} className="text-emerald-700 hover:text-emerald-900" data-testid="wolke-banner-close"><X className="w-4 h-4" /></button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {tab === "erhalten" && (
                erhalten.length === 0
                  ? <div className="text-center text-sm text-muted-foreground py-8">Keine Wolken erhalten</div>
                  : erhalten.map(w => <WolkeKarte key={w.id} wolke={w} ansicht="erhalten" onErhalten={markErhalten} onErledigt={markErledigt} onDelete={del} onNavigate={openRecord} />)
              )}
              {tab === "gesendet" && (
                gesendet.length === 0
                  ? <div className="text-center text-sm text-muted-foreground py-8">Keine Wolken gesendet</div>
                  : gesendet.map(w => <WolkeKarte key={w.id} wolke={w} ansicht="gesendet" onErhalten={markErhalten} onErledigt={markErledigt} onDelete={del} onNavigate={openRecord} />)
              )}
              {tab === "neu" && (
                <>
                <WolkeAktionen onCreated={() => { reloadListen(); reloadCount(); }} kunde={neuKunde} />
                <WolkeNeuForm
                  mitarbeiter={mitarbeiter}
                  onKundeChange={setNeuKunde}
                  onSent={async (bannerText) => {
                    setBanner(bannerText || "Wolke verschickt");
                    setTab("gesendet");
                    await Promise.all([reloadListen(), reloadCount()]);
                    setTimeout(() => setBanner(""), 5000);
                  }}
                />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default WolkePopover;
