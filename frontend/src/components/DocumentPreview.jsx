import { useState, useEffect } from "react";
import { Download, Mail, Edit, CheckCircle, X, Send, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Badge } from "@/components/common";
import { api, API } from "@/lib/api";

const DocumentPreview = ({ isOpen, onClose, document, type, onDownload, onEdit }) => {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ to_email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [emailHistory, setEmailHistory] = useState([]);

  useEffect(() => {
    if (isOpen && document) {
      api.get(`/email/log/${type}/${document.id}`).then(res => setEmailHistory(res.data)).catch(() => {});
    }
  }, [isOpen, document, type]);

  if (!isOpen || !document) return null;

  const titles = {
    quote: "Angebot",
    order: "Auftragsbestätigung", 
    invoice: "Rechnung"
  };

  const numberLabels = {
    quote: "Angebots-Nr.",
    order: "Auftrags-Nr.",
    invoice: "Rechnungs-Nr."
  };

  const docNumber = document.quote_number || document.order_number || document.invoice_number;

  const handleSendEmail = async () => {
    if (!emailForm.to_email) { toast.error("Bitte E-Mail-Adresse eingeben"); return; }
    setSending(true);
    try {
      await api.post(`/email/document/${type}/${document.id}`, {
        to_email: emailForm.to_email,
        subject: emailForm.subject || `${titles[type]} ${docNumber}`,
        message: emailForm.message
      });
      toast.success(`${titles[type]} per E-Mail gesendet`);
      setShowEmailDialog(false);
      setEmailForm({ to_email: "", subject: "", message: "" });
      api.get(`/email/log/${type}/${document.id}`).then(res => setEmailHistory(res.data)).catch(() => {});
    } catch (err) {
      toast.error(err?.response?.data?.detail || "E-Mail konnte nicht gesendet werden");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-sm shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 sticky top-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">{titles[type]} {docNumber}</h2>
            <Badge variant={document.status === "Bezahlt" ? "success" : document.status === "Offen" ? "warning" : "default"}>
              {document.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => { onClose(); onEdit(document); }}>
                <Edit className="w-4 h-4" />
                Bearbeiten
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => {
              setEmailForm({
                to_email: document.customer_email || "",
                subject: `${titles[type]} ${docNumber}`,
                message: ""
              });
              setShowEmailDialog(true);
            }} data-testid="btn-email-document">
              <Mail className="w-4 h-4" />
              E-Mail
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDownload(document.id, docNumber)}>
              <Download className="w-4 h-4" />
              PDF
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-sm">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Email Dialog */}
        {showEmailDialog && (
          <div className="p-4 border-b bg-blue-50" data-testid="email-dialog">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {titles[type]} per E-Mail senden
            </h3>
            <div className="space-y-2">
              <Input
                data-testid="input-email-to"
                placeholder="E-Mail-Adresse des Empfängers"
                value={emailForm.to_email}
                onChange={(e) => setEmailForm({ ...emailForm, to_email: e.target.value })}
                type="email"
              />
              <Input
                data-testid="input-email-subject"
                placeholder="Betreff (optional)"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
              />
              <Textarea
                data-testid="input-email-message"
                placeholder="Persönliche Nachricht (optional)"
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(false)}>Abbrechen</Button>
                <Button size="sm" onClick={handleSendEmail} disabled={sending} data-testid="btn-send-email">
                  {sending ? "Senden..." : "Senden"}
                  <Send className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Document Content */}
        <div className="p-8 bg-white">
          {/* Document Header */}
          <div className="flex justify-between mb-8 pb-6 border-b">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">{titles[type].toUpperCase()}</h1>
              <p className="text-muted-foreground">{numberLabels[type]} {docNumber}</p>
              <p className="text-muted-foreground">
                Datum: {new Date(document.created_at).toLocaleDateString("de-DE")}
              </p>
              {document.valid_until && (
                <p className="text-muted-foreground">
                  Gültig bis: {new Date(document.valid_until).toLocaleDateString("de-DE")}
                </p>
              )}
              {document.due_date && (
                <p className="text-muted-foreground">
                  Fällig: {new Date(document.due_date).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">{document.customer_name}</p>
              {document.customer_address && (
                <p className="text-muted-foreground whitespace-pre-line text-sm">
                  {document.customer_address.split(/,\s*/).join("\n")}
                </p>
              )}
            </div>
          </div>

          {/* Betreff */}
          {document.betreff && (
            <p className="font-bold text-base mb-4 border-b pb-2">{document.betreff}</p>
          )}

          {/* Vortext */}
          {document.vortext && (
            <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">{document.vortext}</p>
          )}

          {/* Positions Table */}
          <table className="w-full mb-6">
            <thead>
              <tr className="border-b-2 border-primary/20">
                <th className="text-left py-3 text-sm font-semibold text-primary">Pos</th>
                <th className="text-left py-3 text-sm font-semibold text-primary">Beschreibung</th>
                <th className="text-right py-3 text-sm font-semibold text-primary">Menge</th>
                <th className="text-left py-3 text-sm font-semibold text-primary">Einheit</th>
                <th className="text-right py-3 text-sm font-semibold text-primary">Einzelpreis</th>
                <th className="text-right py-3 text-sm font-semibold text-primary">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {document.positions?.map((pos, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-3 text-sm">{pos.pos_nr}</td>
                  <td className="py-3 text-sm">{pos.description}</td>
                  <td className="py-3 text-sm text-right font-mono">{pos.quantity}</td>
                  <td className="py-3 text-sm">{pos.unit}</td>
                  <td className="py-3 text-sm text-right font-mono">{pos.price_net?.toFixed(2)} €</td>
                  <td className="py-3 text-sm text-right font-mono">{(pos.quantity * pos.price_net)?.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-2">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono">{document.subtotal_net?.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">MwSt ({document.vat_rate}%)</span>
                <span className="font-mono">{document.vat_amount?.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
                <span>Gesamt</span>
                <span className="font-mono">{document.total_gross?.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {document.notes && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Anmerkungen:</p>
              <p className="text-sm whitespace-pre-line">{document.notes}</p>
            </div>
          )}

          {/* Versandhistorie */}
          {emailHistory.length > 0 && (
            <div className="mt-6 pt-6 border-t" data-testid="email-history">
              <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <MailCheck className="w-4 h-4" />
                Versandhistorie ({emailHistory.length})
              </p>
              <div className="space-y-2">
                {emailHistory.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-xs p-2 bg-muted/30 rounded-sm">
                    <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${log.status === "gesendet" ? "text-green-500" : "text-red-500"}`} />
                    <span className="text-muted-foreground">{new Date(log.sent_at).toLocaleDateString("de-DE")} {new Date(log.sent_at).toLocaleTimeString("de-DE", {hour:"2-digit",minute:"2-digit"})}</span>
                    <span className="truncate">An: {log.to_email}</span>
                    <Badge variant={log.status === "gesendet" ? "success" : "danger"} className="text-xs ml-auto shrink-0">{log.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export { DocumentPreview };
