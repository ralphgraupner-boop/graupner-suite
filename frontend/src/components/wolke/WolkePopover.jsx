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
import { Cloud, X, Send, Check, Trash2, Inbox, ArrowUpRight, Plus, User, Folder, Wrench, Reply, Archive } from "lucide-react";
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

const PAGE = 10;

const StatusHaekchen = ({ wolke }) => {
  // 3 Stufen: ✓ gesendet · ✓✓ empfangen · ✓✓✓ gelesen (blau)
  if (wolke.gelesen_am) return <span title="Gelesen" className="text-sky-600 font-semibold" data-testid={`wolke-status-${wolke.id}`}>✓✓✓</span>;
  if (wolke.erhalten_am) return <span title="Empfangen" className="text-muted-foreground" data-testid={`wolke-status-${wolke.id}`}>✓✓</span>;
  return <span title="Gesendet" className="text-muted-foreground" data-testid={`wolke-status-${wolke.id}`}>✓</span>;
};

const WolkeKarte = ({ wolke, ansicht, onErledigt, onDelete, onNavigate, onReply }) => {
  const isAufgabe = wolke.type === "aufgabe";
  const isErledigt = wolke.status === "erledigt";
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
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
          {wolke.antwort_auf_id && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-700" title="Antwort auf eine Nachricht">↩ Antwort</span>
          )}
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
        <div className="text-xs flex items-center gap-2">
          {isErledigt ? (
            <span className="text-emerald-700">✓ erledigt {wolke.erledigt_am ? `· ${fmtZeit(wolke.erledigt_am)}` : ""}</span>
          ) : (
            <span className="text-amber-700">● offen</span>
          )}
          {(ansicht === "gesendet" || ansicht === "archiv") && <StatusHaekchen wolke={wolke} />}
        </div>
        <div className="flex gap-2 items-center">
          {ansicht === "erhalten" && isAufgabe && !isErledigt && (
            <button
              onClick={() => onErledigt(wolke.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              data-testid={`wolke-btn-erledigt-${wolke.id}`}
            >
              <Check className="w-4 h-4" /> Erledigt
            </button>
          )}
          {ansicht === "erhalten" && (
            <button
              onClick={() => setReplyOpen(v => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-sky-700 hover:bg-sky-50"
              data-testid={`wolke-btn-reply-${wolke.id}`}
              title="Antworten"
            >
              <Reply className="w-3.5 h-3.5" /> Antworten
            </button>
          )}
          <button
            onClick={() => onDelete(wolke.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 hover:bg-red-50"
            data-testid={`wolke-btn-delete-${wolke.id}`}
            title="Löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {replyOpen && ansicht === "erhalten" && (
        <div className="pt-2 space-y-2" data-testid={`wolke-reply-box-${wolke.id}`}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={2}
            placeholder={`Antwort an ${wolke.absender_name}…`}
            className="w-full border rounded-lg p-2 text-sm resize-y"
            data-testid={`wolke-reply-text-${wolke.id}`}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setReplyOpen(false); setReplyText(""); }}
              className="px-3 py-1.5 text-xs border rounded-sm hover:bg-muted"
            >Abbrechen</button>
            <button
              disabled={replySending || !replyText.trim()}
              onClick={async () => {
                setReplySending(true);
                const ok = await onReply(wolke.id, replyText.trim());
                setReplySending(false);
                if (ok) { setReplyOpen(false); setReplyText(""); }
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-sky-600 text-white rounded-sm hover:bg-sky-700 disabled:opacity-50"
              data-testid={`wolke-reply-send-${wolke.id}`}
            >
              <Send className="w-3.5 h-3.5" /> Senden
            </button>
          </div>
        </div>
      )}
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
  const [archiv, setArchiv] = useState([]);
  const [more, setMore] = useState({ erhalten: false, gesendet: false, archiv: false });
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [banner, setBanner] = useState("");
  const [neuKunde, setNeuKunde] = useState(null);

  const setterFor = (which) => which === "erhalten" ? setErhalten : which === "gesendet" ? setGesendet : setArchiv;
  const pathFor = (which) => which === "archiv" ? "archiv" : which;

  const reloadCount = useCallback(async () => {
    try {
      const res = await api.get("/module-wolke/count-offen");
      setCount(res.data?.count || 0);
    } catch { /* ignore */ }
  }, []);

  // Pagination + Regel 16: refresht die erste Seite (10), merged Status in bereits geladene
  // ältere Einträge -> RAM wächst nur, wenn der Nutzer aktiv "Mehr anzeigen" klickt.
  const reloadActive = useCallback(async (which) => {
    if (which === "neu") return;
    try {
      const res = await api.get(`/module-wolke/${pathFor(which)}?limit=${PAGE}&skip=0`);
      const fresh = res.data || [];
      const freshIds = new Set(fresh.map(f => f.id));
      setterFor(which)(prev => [...fresh, ...prev.filter(x => !freshIds.has(x.id))]);
      setMore(m => ({ ...m, [which]: fresh.length === PAGE }));
    } catch { /* ignore */ }
  }, []);

  const loadMore = async (which) => {
    const cur = which === "erhalten" ? erhalten : which === "gesendet" ? gesendet : archiv;
    try {
      const res = await api.get(`/module-wolke/${pathFor(which)}?limit=${PAGE}&skip=${cur.length}`);
      const older = res.data || [];
      const ids = new Set(cur.map(p => p.id));
      setterFor(which)(prev => [...prev, ...older.filter(o => !ids.has(o.id))]);
      setMore(m => ({ ...m, [which]: older.length === PAGE }));
    } catch { /* ignore */ }
  };

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

  // Beim Öffnen / Tab-Wechsel: aktiven Tab laden; danach nur diesen Tab alle 10s pollen (Regel 16).
  useEffect(() => {
    if (!open) return;
    reloadActive(tab);
    const t = setInterval(() => reloadActive(tab), 10000);
    return () => clearInterval(t);
  }, [open, tab, reloadActive]);

  // Empfangene Nachrichten beim Anzeigen als 'gelesen' markieren (3. Bestätigungsstufe).
  useEffect(() => {
    if (!open || tab !== "erhalten") return;
    const ungelesen = erhalten.filter(w => !w.gelesen_am);
    if (ungelesen.length === 0) return;
    (async () => {
      await Promise.all(ungelesen.map(w => api.patch(`/module-wolke/${w.id}/gelesen`).catch(() => {})));
      reloadActive("erhalten");
      reloadCount();
    })();
  }, [open, tab, erhalten, reloadActive, reloadCount]);

  const markErhalten = async (id) => {
    try {
      await api.patch(`/module-wolke/${id}/erhalten`);
      toast.success("Erhalten bestätigt");
      await Promise.all([reloadActive(tab), reloadCount()]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Konnte nicht bestätigt werden");
    }
  };

  const markErledigt = async (id) => {
    try {
      await api.patch(`/module-wolke/${id}/erledigt`);
      toast.success("Erledigt");
      await Promise.all([reloadActive(tab), reloadCount()]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Konnte nicht erledigt werden");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Nachricht wirklich löschen? (wird nur für dich ausgeblendet)")) return;
    try {
      await api.delete(`/module-wolke/${id}`);
      setErhalten(prev => prev.filter(x => x.id !== id));
      setGesendet(prev => prev.filter(x => x.id !== id));
      setArchiv(prev => prev.filter(x => x.id !== id));
      toast.success("Ausgeblendet");
      reloadCount();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  const reply = async (id, text) => {
    try {
      await api.post(`/module-wolke/${id}/antwort`, { text });
      toast.success("Antwort gesendet");
      await Promise.all([reloadActive(tab), reloadCount()]);
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Antwort fehlgeschlagen");
      return false;
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
        className="fixed z-40 bottom-44 right-4 md:bottom-24 md:right-6 w-14 h-14 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg flex items-center justify-center"
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
                { id: "archiv", icon: Archive, label: "Archiv", n: null },
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
                  : <>
                      {erhalten.map(w => <WolkeKarte key={w.id} wolke={w} ansicht="erhalten" onErledigt={markErledigt} onDelete={del} onNavigate={openRecord} onReply={reply} />)}
                      {more.erhalten && <button onClick={() => loadMore("erhalten")} className="w-full py-2 text-sm text-sky-700 hover:bg-sky-50 rounded-lg" data-testid="wolke-more-erhalten">Mehr anzeigen</button>}
                    </>
              )}
              {tab === "gesendet" && (
                gesendet.length === 0
                  ? <div className="text-center text-sm text-muted-foreground py-8">Keine Wolken gesendet</div>
                  : <>
                      {gesendet.map(w => <WolkeKarte key={w.id} wolke={w} ansicht="gesendet" onErledigt={markErledigt} onDelete={del} onNavigate={openRecord} />)}
                      {more.gesendet && <button onClick={() => loadMore("gesendet")} className="w-full py-2 text-sm text-sky-700 hover:bg-sky-50 rounded-lg" data-testid="wolke-more-gesendet">Mehr anzeigen</button>}
                    </>
              )}
              {tab === "archiv" && (
                archiv.length === 0
                  ? <div className="text-center text-sm text-muted-foreground py-8">Archiv ist leer<br/><span className="text-xs">Erledigte &amp; gelesene Nachrichten älter als 30 Tage landen hier.</span></div>
                  : <>
                      {archiv.map(w => <WolkeKarte key={w.id} wolke={w} ansicht="archiv" onDelete={del} onNavigate={openRecord} />)}
                      {more.archiv && <button onClick={() => loadMore("archiv")} className="w-full py-2 text-sm text-sky-700 hover:bg-sky-50 rounded-lg" data-testid="wolke-more-archiv">Mehr anzeigen</button>}
                    </>
              )}
              {tab === "neu" && (
                <>
                <WolkeAktionen onCreated={() => { reloadActive(tab); reloadCount(); }} kunde={neuKunde} />
                <WolkeNeuForm
                  mitarbeiter={mitarbeiter}
                  onKundeChange={setNeuKunde}
                  onSent={async (bannerText) => {
                    setBanner(bannerText || "Wolke verschickt");
                    setTab("gesendet");
                    await Promise.all([reloadActive("gesendet"), reloadCount()]);
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
