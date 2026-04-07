import { useState, useEffect } from "react";
import { CheckCircle, Search, X, MailCheck, Trash2, RefreshCw, UserCheck, AlertCircle, Send, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge, Button, Modal, Textarea } from "@/components/common";
import { api } from "@/lib/api";

const EmailLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checkResult, setCheckResult] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [resendLog, setResendLog] = useState(null);
  const [resendForm, setResendForm] = useState({ to_email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const res = await api.get("/email/log");
      setLogs(res.data);
    } catch {
      toast.error("Fehler beim Laden des E-Mail-Protokolls");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (logId) => {
    try {
      await api.delete(`/email/log/${logId}`);
      setLogs(logs.filter((l) => l.id !== logId));
      toast.success("Protokolleintrag gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleCheckAddress = async (log) => {
    setCheckingId(log.id);
    try {
      const res = await api.post("/email/check-address", { email: log.to_email });
      setCheckResult({ logId: log.id, email: log.to_email, ...res.data });
    } catch {
      toast.error("Fehler bei Adressprüfung");
    } finally {
      setCheckingId(null);
    }
  };

  const openResend = (log) => {
    setResendLog(log);
    setResendForm({
      to_email: log.to_email,
      subject: log.subject || "",
      message: "",
    });
  };

  const handleResend = async () => {
    if (!resendForm.to_email || !resendForm.message) {
      toast.error("E-Mail und Nachricht erforderlich");
      return;
    }
    setSending(true);
    try {
      await api.post("/email/resend", resendForm);
      toast.success(`E-Mail an ${resendForm.to_email} gesendet`);
      setResendLog(null);
      loadLogs();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Senden");
    } finally {
      setSending(false);
    }
  };

  const typeLabels = { quote: "Angebot", order: "Auftrag", invoice: "Rechnung", dunning: "Mahnung", anfrage: "Anfrage", resend: "Erneut gesendet" };

  const filtered = logs.filter(
    (l) =>
      (l.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.to_email || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.doc_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="email-log-page">
      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">E-Mail-Protokoll</h1>
        <p className="text-muted-foreground mt-1 text-sm lg:text-base">{logs.length} E-Mails versendet</p>
      </div>

      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
          <Input
            data-testid="input-search-email-log"
            className="pl-9 lg:pl-10 h-9 lg:h-10"
            placeholder="E-Mails durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <MailCheck className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine E-Mails versendet</h3>
          <p className="text-muted-foreground mt-2 text-sm">Versendete E-Mails erscheinen hier automatisch</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Card key={log.id} className="p-4" data-testid={`email-log-${log.id}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-sm shrink-0 ${log.status === "gesendet" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                  {log.status === "gesendet" ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{log.subject}</span>
                    <Badge variant="default" className="text-xs">{typeLabels[log.doc_type] || log.doc_type}</Badge>
                    {log.doc_number && <span className="text-xs font-mono text-muted-foreground">{log.doc_number}</span>}
                  </div>
                  <div className="flex gap-x-4 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground">
                    <span>An: {log.to_email}</span>
                    {log.customer_name && <span>Kunde: {log.customer_name}</span>}
                  </div>
                  {/* Adressprüfung Ergebnis inline */}
                  {checkResult && checkResult.logId === log.id && (
                    <div className="mt-2 p-2 rounded-sm border text-xs animate-in fade-in slide-in-from-top-1 duration-200" data-testid={`check-result-${log.id}`}>
                      {checkResult.found ? (
                        <div className="space-y-1">
                          {checkResult.kunden.length > 0 && (
                            <p className="text-green-700 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5" />
                              Kunde: {checkResult.kunden.map((k) => k.name).join(", ")}
                            </p>
                          )}
                          {checkResult.anfragen.length > 0 && (
                            <p className="text-blue-700 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Anfrage: {checkResult.anfragen.map((a) => a.name).join(", ")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-amber-700 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {checkResult.email} nicht in Kunden oder Anfragen gefunden
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Adresse prüfen */}
                  <button
                    onClick={() => handleCheckAddress(log)}
                    disabled={checkingId === log.id}
                    className="p-2 rounded-sm text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Adresse prüfen"
                    data-testid={`btn-check-${log.id}`}
                  >
                    <UserCheck className={`w-4 h-4 ${checkingId === log.id ? "animate-pulse" : ""}`} />
                  </button>
                  {/* Neu bearbeiten / Resend */}
                  <button
                    onClick={() => openResend(log)}
                    className="p-2 rounded-sm text-primary hover:bg-primary/10 transition-colors"
                    title="Neu bearbeiten & senden"
                    data-testid={`btn-resend-${log.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* Löschen */}
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="p-2 rounded-sm text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Rückstandslos löschen"
                    data-testid={`btn-delete-log-${log.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="text-right ml-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.sent_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.sent_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Resend / Neu bearbeiten Modal */}
      {resendLog && (
        <Modal isOpen onClose={() => setResendLog(null)} title="E-Mail neu bearbeiten & senden" size="lg">
          <div className="space-y-4" data-testid="resend-modal">
            <div className="bg-muted/30 rounded-sm p-3 text-xs text-muted-foreground">
              Ursprünglich gesendet am {new Date(resendLog.sent_at).toLocaleDateString("de-DE")} an {resendLog.to_email}
              {resendLog.doc_number && <span> ({typeLabels[resendLog.doc_type] || resendLog.doc_type} {resendLog.doc_number})</span>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">An</label>
              <Input
                type="email"
                value={resendForm.to_email}
                onChange={(e) => setResendForm({ ...resendForm, to_email: e.target.value })}
                data-testid="resend-to-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Betreff</label>
              <Input
                value={resendForm.subject}
                onChange={(e) => setResendForm({ ...resendForm, subject: e.target.value })}
                data-testid="resend-subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nachricht</label>
              <Textarea
                value={resendForm.message}
                onChange={(e) => setResendForm({ ...resendForm, message: e.target.value })}
                placeholder="Nachricht eingeben..."
                rows={8}
                data-testid="resend-message"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setResendLog(null)}>Abbrechen</Button>
              <Button onClick={handleResend} disabled={sending || !resendForm.to_email || !resendForm.message} data-testid="btn-send-resend">
                <Send className="w-4 h-4 mr-1.5" />
                {sending ? "Sende..." : "E-Mail senden"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export { EmailLogPage };
