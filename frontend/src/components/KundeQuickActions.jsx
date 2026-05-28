import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, Mail, Cloud, Calendar, FileText, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Wrappt einen beliebigen Bereich (z. B. Kundenblock im Editor) und
 * zeigt bei Hover (Desktop) / Tap (Mobile) ein Popover mit Schnellaktionen:
 *
 *   📞 Anrufen   📧 E-Mail   ☁️ Wolke   📅 Termin   📋 Notiz
 *
 * Daten werden lazy geladen (erst wenn Popover geöffnet wird).
 */
export const KundeQuickActions = ({ customerId, children, testId = "kunde-quickactions" }) => {
  const [open, setOpen] = useState(false);
  const [kunde, setKunde] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState(null); // "wolke" | "termin" | "notiz" | null
  const wrapperRef = useRef(null);
  const closeTimer = useRef(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(typeof window !== "undefined" && "ontouchstart" in window);
  }, []);

  // Lazy load Kundendaten beim ersten Öffnen
  useEffect(() => {
    if (!open || kunde || !customerId) return;
    setLoading(true);
    api
      .get(`/modules/kunden/data/${customerId}`)
      .then((r) => setKunde(r.data))
      .catch(() => setKunde({ name: "Unbekannt" }))
      .finally(() => setLoading(false));
  }, [open, customerId, kunde]);

  const openNow = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const scheduleClose = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }, []);

  const close = () => {
    setOpen(false);
    setSub(null);
  };

  const phone = kunde?.phone || kunde?.mobile || kunde?.telefon || "";
  const mobile = kunde?.mobile || kunde?.handy || "";
  const email = kunde?.email || "";
  const name = kunde?.name || kunde?.kunde_name || "Kunde";

  if (!customerId) return children;

  return (
    <span
      ref={wrapperRef}
      className="relative inline-block"
      onMouseEnter={!isTouchDevice ? openNow : undefined}
      onMouseLeave={!isTouchDevice ? scheduleClose : undefined}
      onClick={isTouchDevice ? openNow : undefined}
      data-testid={testId}
    >
      <span className="cursor-pointer underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
        {children}
      </span>

      {open && (
        <KundenPopover
          loading={loading}
          name={name}
          phone={phone}
          mobile={mobile}
          email={email}
          onClose={close}
          onSub={setSub}
          isTouchDevice={isTouchDevice}
          onMouseEnter={!isTouchDevice ? openNow : undefined}
          onMouseLeave={!isTouchDevice ? scheduleClose : undefined}
        />
      )}

      {sub === "wolke" && (
        <WolkeSheet customerId={customerId} customerName={name} onDone={close} />
      )}
      {sub === "termin" && (
        <TerminSheet customerId={customerId} customerName={name} onDone={close} />
      )}
      {sub === "notiz" && (
        <NotizSheet kunde={kunde} onDone={(updated) => { setKunde(updated); close(); }} />
      )}
    </span>
  );
};

// ── Popover ───────────────────────────────────────────────────────────────

const KundenPopover = ({ loading, name, phone, mobile, email, onClose, onSub, isTouchDevice, onMouseEnter, onMouseLeave }) => {
  // Mobile = Bottom-Sheet, Desktop = Popover
  if (isTouchDevice) {
    return (
      <div
        className="fixed inset-0 z-[9990] flex items-end justify-center bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        data-testid="kunde-popover-mobile"
      >
        <div
          className="bg-background border shadow-2xl w-full rounded-t-2xl pb-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <PopoverInner loading={loading} name={name} phone={phone} mobile={mobile} email={email} onClose={onClose} onSub={onSub} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute z-[9990] top-full left-0 mt-1 bg-background border shadow-xl rounded-lg w-72"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid="kunde-popover-desktop"
    >
      <PopoverInner loading={loading} name={name} phone={phone} mobile={mobile} email={email} onClose={onClose} onSub={onSub} />
    </div>
  );
};

const PopoverInner = ({ loading, name, phone, mobile, email, onClose, onSub }) => (
  <div className="p-3">
    <div className="flex items-start justify-between mb-2">
      <div className="min-w-0">
        <div className="font-semibold text-sm truncate">{name}</div>
        {(phone || mobile || email) && (
          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
            {phone && <div className="truncate">📞 {phone}</div>}
            {mobile && mobile !== phone && <div className="truncate">📱 {mobile}</div>}
            {email && <div className="truncate">📧 {email}</div>}
          </div>
        )}
      </div>
      <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Schließen">
        <X className="w-4 h-4" />
      </button>
    </div>

    <div className="grid grid-cols-5 gap-1.5 mt-2">
      <ActionBtn icon={<Phone />} label="Anrufen" disabled={!phone && !mobile} onClick={() => { window.location.href = `tel:${(phone || mobile).replace(/\s/g, "")}`; onClose(); }} testId="kqa-btn-call" />
      <ActionBtn icon={<Mail />} label="E-Mail" disabled={!email} onClick={() => { window.location.href = `mailto:${email}`; onClose(); }} testId="kqa-btn-mail" />
      <ActionBtn icon={<Cloud />} label="Wolke" onClick={() => onSub("wolke")} testId="kqa-btn-wolke" />
      <ActionBtn icon={<Calendar />} label="Termin" onClick={() => onSub("termin")} testId="kqa-btn-termin" />
      <ActionBtn icon={<FileText />} label="Notiz" onClick={() => onSub("notiz")} testId="kqa-btn-notiz" />
    </div>
    {loading && <div className="text-xs text-muted-foreground mt-2 text-center">Lädt...</div>}
  </div>
);

const ActionBtn = ({ icon, label, onClick, disabled, testId }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center justify-center gap-1 p-2 rounded-md border hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed min-h-[56px]"
    data-testid={testId}
  >
    <span className="w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
    <span className="text-[10px] leading-none">{label}</span>
  </button>
);

// ── Sub-Sheets ────────────────────────────────────────────────────────────

const SheetWrapper = ({ title, onClose, children, testId }) => (
  <div className="fixed inset-0 z-[9991] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm" onClick={onClose} data-testid={testId}>
    <div className="bg-background border shadow-2xl w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="sm:hidden flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-base font-bold">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  </div>
);

const WolkeSheet = ({ customerId, customerName, onDone }) => {
  const [empfList, setEmpfList] = useState([]);
  const [empfId, setEmpfId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get("/module-wolke/mitarbeiter").then((r) => setEmpfList(r.data || [])).catch(() => { /* ignore */ });
  }, []);

  const submit = async () => {
    if (!empfId) { toast.error("Empfänger wählen"); return; }
    if (!text.trim()) { toast.error("Text fehlt"); return; }
    setSending(true);
    try {
      await api.post("/module-wolke", { type: "memo", empfaenger_id: empfId, kunde_id: customerId, text: text.trim() });
      toast.success("Wolke gesendet");
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Konnte nicht senden");
    } finally { setSending(false); }
  };

  return (
    <SheetWrapper title={`☁️ Wolke senden zu ${customerName}`} onClose={onDone} testId="wolke-sheet">
      <label className="block text-sm font-medium mb-1">Empfänger</label>
      <select value={empfId} onChange={(e) => setEmpfId(e.target.value)} className="w-full border rounded px-2 py-2 text-sm mb-3" data-testid="wolke-empf-select">
        <option value="">Bitte wählen...</option>
        {empfList.map((m) => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
      </select>
      <label className="block text-sm font-medium mb-1">Nachricht</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Kurze interne Nachricht..." className="w-full border rounded px-2 py-2 text-sm mb-3" data-testid="wolke-text" />
      <button onClick={submit} disabled={sending} className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" data-testid="wolke-send">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Senden
      </button>
    </SheetWrapper>
  );
};

const TerminSheet = ({ customerId, customerName, onDone }) => {
  const [titel, setTitel] = useState(`Termin mit ${customerName}`);
  const [start, setStart] = useState("");
  const [ende, setEnde] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!titel.trim()) { toast.error("Titel fehlt"); return; }
    if (!start) { toast.error("Startzeit fehlt"); return; }
    setSending(true);
    try {
      await api.post("/module-termine", { titel: titel.trim(), typ: "termin", start, ende, kunde_id: customerId, beschreibung });
      toast.success("Termin angelegt");
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Konnte nicht anlegen");
    } finally { setSending(false); }
  };

  return (
    <SheetWrapper title={`📅 Termin mit ${customerName}`} onClose={onDone} testId="termin-sheet">
      <label className="block text-sm font-medium mb-1">Titel</label>
      <input value={titel} onChange={(e) => setTitel(e.target.value)} className="w-full border rounded px-2 py-2 text-sm mb-3" data-testid="termin-titel" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-sm font-medium mb-1">Start</label>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid="termin-start" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ende</label>
          <input type="datetime-local" value={ende} onChange={(e) => setEnde(e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid="termin-ende" />
        </div>
      </div>
      <label className="block text-sm font-medium mb-1">Beschreibung (optional)</label>
      <textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={3} className="w-full border rounded px-2 py-2 text-sm mb-3" />
      <button onClick={submit} disabled={sending} className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" data-testid="termin-save">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} Anlegen
      </button>
    </SheetWrapper>
  );
};

const NotizSheet = ({ kunde, onDone }) => {
  const [notiz, setNotiz] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!notiz.trim()) { toast.error("Notiz ist leer"); return; }
    if (!kunde?.id) { toast.error("Kunden-ID fehlt"); return; }
    setSending(true);
    try {
      const stamp = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const newNotes = ((kunde.notes || "").trim() + (kunde.notes ? "\n\n" : "") + `[${stamp}] ${notiz.trim()}`);
      const res = await api.put(`/modules/kunden/data/${kunde.id}`, { notes: newNotes });
      toast.success("Notiz gespeichert");
      onDone(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Konnte nicht speichern");
    } finally { setSending(false); }
  };

  return (
    <SheetWrapper title={`📋 Notiz zu ${kunde?.name || "Kunde"}`} onClose={() => onDone(kunde)} testId="notiz-sheet">
      {kunde?.notes && (
        <div className="text-xs text-muted-foreground mb-2 max-h-32 overflow-y-auto whitespace-pre-wrap bg-muted/30 p-2 rounded">
          {kunde.notes}
        </div>
      )}
      <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={4} placeholder="Neue Notiz..." className="w-full border rounded px-2 py-2 text-sm mb-3" data-testid="notiz-text" />
      <button onClick={submit} disabled={sending} className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" data-testid="notiz-save">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Speichern
      </button>
    </SheetWrapper>
  );
};
