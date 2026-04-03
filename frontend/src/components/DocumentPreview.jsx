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
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (isOpen && document) {
      api.get(`/email/log/${type}/${document.id}`).then(res => setEmailHistory(res.data)).catch(() => {});
      api.get("/settings").then(res => setSettings(res.data)).catch(() => {});
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
        <div className="p-6 lg:p-8 bg-white">
          {/* Briefkopf */}
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-baseline gap-0.5 mb-0.5">
                <span className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "#1a1a1a" }}>Tischlerei</span>
                <span className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "#003399" }}>Graupner</span>
                <span className="text-xs font-semibold ml-1.5" style={{ color: "#cc0000" }}>seit 1960</span>
              </div>
              <p className="text-xs font-medium tracking-wide" style={{ color: "#003399" }}>Mitglied der Handwerkskammer Hamburg</p>
            </div>
            <div className="text-right text-xs font-medium" style={{ color: "#003399" }}>
              <p className="font-bold">{settings.company_name || "Tischlerei Graupner"}</p>
              {(settings.address || "Erlengrund 129\n22453 Hamburg").split("\n").map((l, i) => (
                <p key={i}>{l.trim()}</p>
              ))}
              <p>Tel.: {settings.phone || "040 55567744"}</p>
              <p>{settings.email || "Service24@tischlerei-graupner.de"}</p>
              <p>{settings.website || "www.tischlerei-graupner.de"}</p>
              {settings.tax_id && <p>Steuernummer: {settings.tax_id}</p>}
              <div className="mt-2 pt-2 border-t border-blue-200 space-y-0.5">
                <p>Kd.-Nr.: {document.customer_id ? document.customer_id.substring(0, 8).toUpperCase() : "-"}</p>
                <p>Datum: {new Date(document.created_at).toLocaleDateString("de-DE")}</p>
                <p>{numberLabels[type]}: {docNumber}</p>
              </div>
            </div>
          </div>

          {/* DIN 5008 Absenderzeile + Kundenadresse */}
          <div className="mt-6 mb-6 max-w-sm">
            <p className="text-[9px] text-muted-foreground border-b border-muted-foreground/30 pb-0.5 mb-2 tracking-wide">
              {settings.company_name || "Tischlerei Graupner"} · {(settings.address || "Erlengrund 129\n22453 Hamburg").split("\n").map(l => l.trim()).join(" · ")}
            </p>
            <p className="font-semibold text-sm">{document.customer_name}</p>
            {document.customer_address && (
              <p className="text-sm whitespace-pre-line">
                {document.customer_address.includes("\n")
                  ? document.customer_address
                  : document.customer_address.split(/,\s*/).join("\n")}
              </p>
            )}
          </div>

          {/* Angebots-Nr. groß blau */}
          <p className="text-lg font-bold mb-1" style={{ color: "#003399" }}>
            {numberLabels[type]}: {docNumber}
          </p>

          {/* Betreff fett blau */}
          {document.betreff && (
            <p className="font-bold text-base mb-3" style={{ color: "#003399" }}>{document.betreff}</p>
          )}

          {/* Vortext */}
          {document.vortext && (
            <p className="text-sm mb-4 whitespace-pre-line">{document.vortext}</p>
          )}

          {/* Positions Table */}
          <table className="w-full mb-6">
            <thead>
              <tr className="border-b-2 border-primary/20">
                <th className="text-left py-3 text-sm font-semibold text-primary w-10">Pos</th>
                <th className="text-left py-3 text-sm font-semibold text-primary">Beschreibung</th>
                <th className="text-right py-3 text-sm font-semibold text-primary w-16">Menge</th>
                <th className="text-left py-3 text-sm font-semibold text-primary w-16">Einheit</th>
                <th className="text-right py-3 text-sm font-semibold text-primary w-24">Einzelpreis</th>
                <th className="text-right py-3 text-sm font-semibold text-primary w-24">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {document.positions?.map((pos, idx) => {
                if (pos.type === "titel") {
                  return (
                    <tr key={idx} className="border-b bg-amber-50/60">
                      <td className="py-3 text-sm font-bold text-primary">{pos.pos_nr}</td>
                      <td className="py-3 text-sm font-bold text-primary" colSpan={5}>{pos.description}</td>
                    </tr>
                  );
                }
                const descLines = (pos.description || "").split("\n");
                return (
                  <tr key={idx} className="border-b">
                    <td className="py-3 text-sm align-top">{pos.pos_nr}</td>
                    <td className="py-3 text-sm align-top whitespace-pre-line">
                      {descLines.map((line, i) => (
                        <span key={i} className={i === 0 ? "font-bold" : ""}>
                          {line}{i < descLines.length - 1 ? "\n" : ""}
                        </span>
                      ))}
                    </td>
                    <td className="py-3 text-sm text-right font-mono align-top">{pos.quantity}</td>
                    <td className="py-3 text-sm align-top">{pos.unit}</td>
                    <td className="py-3 text-sm text-right font-mono align-top">{pos.price_net?.toFixed(2)} €</td>
                    <td className="py-3 text-sm text-right font-mono align-top">{(pos.quantity * pos.price_net)?.toFixed(2)} €</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-2">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono">{document.subtotal_net?.toFixed(2)} €</span>
              </div>
              {document.discount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">
                    Rabatt {document.discount_type === "percent" ? `(${document.discount}%)` : ""}
                  </span>
                  <span className="font-mono text-red-600">
                    -{document.discount_type === "percent"
                      ? (document.subtotal_net * document.discount / 100).toFixed(2)
                      : document.discount.toFixed(2)} €
                  </span>
                </div>
              )}
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

          {/* Schlusstext */}
          {document.schlusstext && (
            <p className="text-sm whitespace-pre-line mb-4">{document.schlusstext}</p>
          )}

          {document.valid_until && (
            <p className="text-sm font-semibold">Gültig bis: {new Date(document.valid_until).toLocaleDateString("de-DE")}</p>
          )}
          {document.due_date && (
            <p className="text-sm font-semibold">Zahlbar bis: {new Date(document.due_date).toLocaleDateString("de-DE")}</p>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-[11px] text-muted-foreground grid grid-cols-3 gap-4">
            <div>
              <p className="font-bold">{settings.company_name || "Tischlerei Graupner"}</p>
              {settings.owner_name && <p>Inh. {settings.owner_name}</p>}
              {(settings.address || "").split("\n").map((l, i) => <p key={i}>{l.trim()}</p>)}
            </div>
            <div>
              {settings.phone && <p>Tel: {settings.phone}</p>}
              {settings.email && <p>{settings.email}</p>}
              {settings.website && <p>{settings.website}</p>}
              {settings.tax_id && <p>St.-Nr.: {settings.tax_id}</p>}
            </div>
            <div>
              {settings.bank_name && <p>{settings.bank_name}</p>}
              {settings.iban && <p>IBAN: {settings.iban}</p>}
              {settings.bic && <p>BIC: {settings.bic}</p>}
            </div>
          </div>

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
