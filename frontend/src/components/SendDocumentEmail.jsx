import { useState, useEffect } from "react";
import { Mail, ExternalLink, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const SendDocumentEmail = ({ isOpen, onClose, type, docId, docNumber, customer, settings }) => {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState([]);
  const [sending, setSending] = useState(false);

  const titles = { quote: "Angebot", order: "Auftragsbestaetigung", invoice: "Rechnung" };
  const docTitle = titles[type] || "Dokument";

  useEffect(() => {
    if (!isOpen) return;
    // Kunden-E-Mails sammeln - direkt aus Modul laden wenn noetig
    const loadEmails = async () => {
      let email = customer?.email || "";
      let email2 = customer?.email2 || "";
      
      // Wenn keine E-Mail vorhanden, aus Kunden-Modul/Kontakt-Modul laden
      if (!email && customer?.id) {
        try {
          const kRes = await api.get(`/modules/kunden/data/${customer.id}`).catch(() => null);
          const data = kRes?.data || (await api.get(`/modules/kontakt/data/${customer.id}`).catch(() => null))?.data;
          if (data) {
            email = data.email || "";
            email2 = data.email2 || "";
          }
        } catch {}
      }
      
      const allEmails = [];
      if (email) allEmails.push(email);
      if (email2 && email2 !== email) allEmails.push(email2);
      setEmails(allEmails);
      setSelectedEmail(allEmails[0] || "");
    };
    
    loadEmails();
    setSubject(`${docTitle} ${docNumber || ""}`);
    setMessage("");
    // E-Mail Vorlagen laden
    api.get("/modules/textvorlagen/data", { params: { text_type: "email" } })
      .then(res => setTemplates(res.data || []))
      .catch(() => {});
  }, [isOpen, customer, docNumber]);

  const applyTemplate = (tplId) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    const resolved = tpl.content
      .replace(/\{kunde_name\}/g, customer?.name || "")
      .replace(/\{anrede_brief\}/g, getAnrede())
      .replace(/\{firma\}/g, settings?.company_name || "")
      .replace(/\{dokument_nr\}/g, docNumber || "")
      .replace(/\{datum\}/g, new Date().toLocaleDateString("de-DE"));
    setMessage(resolved);
  };

  const getAnrede = () => {
    if (!customer?.name) return "Sehr geehrte Damen und Herren";
    const name = customer.name;
    const anrede = customer.anrede || "";
    const nachname = name.replace(/^(Herr|Frau|Divers)\s+/i, "").trim().split(/\s+/).pop();
    if (anrede === "Herr" || name.startsWith("Herr ")) return `Sehr geehrter Herr ${nachname}`;
    if (anrede === "Frau" || name.startsWith("Frau ")) return `Sehr geehrte Frau ${nachname}`;
    return `Sehr geehrte/r ${name}`;
  };

  const handleOpenMailClient = () => {
    const to = selectedEmail;
    if (!to) { toast.error("Keine E-Mail-Adresse ausgewaehlt"); return; }
    const s = encodeURIComponent(subject);
    const b = encodeURIComponent(message);
    window.location.href = `mailto:${to}?subject=${s}&body=${b}`;
    toast.success("E-Mail-Programm wird geoeffnet...");
    // Status im Kunden speichern
    logEmailSent(to, "mail-programm");
  };

  const handleDirectSend = async () => {
    if (!selectedEmail) { toast.error("Keine E-Mail-Adresse ausgewaehlt"); return; }
    if (!docId) { toast.error("Bitte zuerst das Dokument speichern"); return; }
    setSending(true);
    try {
      await api.post(`/email/document/${type}/${docId}`, {
        to_email: selectedEmail,
        subject: subject || `${docTitle} ${docNumber}`,
        message: message,
      });
      toast.success(`${docTitle} per E-Mail gesendet an ${selectedEmail}`);
      logEmailSent(selectedEmail, "direkt");
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "E-Mail konnte nicht gesendet werden");
    } finally { setSending(false); }
  };

  const logEmailSent = async (to, method) => {
    if (!customer?.id) return;
    try {
      // Im Kunden-Modul speichern
      const collections = ["module_kunden", "module_kontakt"];
      for (const col of collections) {
        try {
          await api.put(`/modules/${col === "module_kunden" ? "kunden" : "kontakt"}/data/${customer.id}`, {
            email_log: [{
              doc_type: type,
              doc_number: docNumber,
              to_email: to,
              method: method,
              sent_at: new Date().toISOString(),
            }]
          });
          break;
        } catch { /* try next */ }
      }
    } catch { /* silent */ }
  };

  const saveAsTemplate = async () => {
    const name = prompt("Vorlagenname:");
    if (!name) return;
    try {
      await api.post("/modules/textvorlagen/data", {
        doc_type: "allgemein", text_type: "email", title: name, content: message
      });
      const res = await api.get("/modules/textvorlagen/data", { params: { text_type: "email" } });
      setTemplates(res.data || []);
      toast.success("E-Mail-Vorlage gespeichert");
    } catch { toast.error("Fehler beim Speichern"); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="send-email-dialog">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              {docTitle} per E-Mail senden
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{docNumber} an {customer?.name || "Kunde"}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* E-Mail-Adresse */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Empfaenger</label>
            {emails.length > 0 ? (
              <div className="space-y-2">
                {emails.map((em, i) => (
                  <label key={em} className={`flex items-center gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${selectedEmail === em ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}>
                    <input type="radio" name="email" value={em} checked={selectedEmail === em} onChange={() => setSelectedEmail(em)} className="accent-primary" />
                    <span className="text-sm font-mono">{em}</span>
                    {i === 0 && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Haupt</span>}
                  </label>
                ))}
                <label className={`flex items-center gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${!emails.includes(selectedEmail) && selectedEmail ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}>
                  <input type="radio" name="email" value="" checked={!emails.includes(selectedEmail)} onChange={() => setSelectedEmail("")} className="accent-primary" />
                  <input type="email" placeholder="Andere E-Mail eingeben..." value={!emails.includes(selectedEmail) ? selectedEmail : ""}
                    onChange={e => setSelectedEmail(e.target.value)}
                    onFocus={() => { if (emails.includes(selectedEmail)) setSelectedEmail(""); }}
                    className="flex-1 bg-transparent text-sm border-0 outline-none" />
                </label>
              </div>
            ) : (
              <input type="email" value={selectedEmail} onChange={e => setSelectedEmail(e.target.value)}
                placeholder="E-Mail-Adresse eingeben" className="w-full border rounded-sm px-3 py-2.5 text-sm" />
            )}
          </div>

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Betreff</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border rounded-sm px-3 py-2.5 text-sm font-medium" data-testid="email-subject" />
          </div>

          {/* Nachricht */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Nachricht (optional)</label>
              {templates.length > 0 && (
                <select className="text-xs border rounded px-2 py-1 text-muted-foreground" value=""
                  onChange={e => applyTemplate(e.target.value)}>
                  <option value="">Vorlage waehlen...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
            </div>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Optionale Nachricht..." rows={4} className="w-full border rounded-sm px-3 py-2.5 text-sm resize-none" />
            {message && (
              <button onClick={saveAsTemplate} className="text-xs text-primary hover:underline mt-1">Als Vorlage speichern</button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t space-y-2">
          <button onClick={handleDirectSend} disabled={sending || !docId}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="btn-direct-send">
            <Mail className="w-4 h-4" />
            {sending ? "Wird gesendet..." : "Senden"}
          </button>
          {!docId && <p className="text-xs text-destructive text-center">Bitte zuerst das Dokument speichern</p>}
          <div className="flex items-center justify-between">
            <button onClick={handleOpenMailClient} className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> In externem E-Mail-Programm oeffnen
            </button>
            <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { SendDocumentEmail };
