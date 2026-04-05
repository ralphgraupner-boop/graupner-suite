import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common";
import { api } from "@/lib/api";

const EmailDialog = ({ type, titles, docNumber, customer, settings, emailForm, setEmailForm, emailTemplates, setEmailTemplates, sendingEmail, onSend, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6" data-testid="email-dialog">
        <h3 className="text-lg font-semibold mb-4">{titles[type]} per E-Mail senden</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">An</label>
            <input value={emailForm.to_email} onChange={e => setEmailForm(f => ({ ...f, to_email: e.target.value }))}
              placeholder="empfaenger@email.de" className="w-full border rounded px-3 py-2 text-sm mt-1" data-testid="email-to-input" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Betreff</label>
            <input value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
              placeholder={`${titles[type]} ${docNumber}`} className="w-full border rounded px-3 py-2 text-sm mt-1" data-testid="email-subject-input" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Nachricht</label>
              <select
                className="text-xs border rounded px-2 py-1 text-muted-foreground"
                data-testid="email-template-select"
                value=""
                onChange={(e) => {
                  const tpl = emailTemplates.find(t => t.id === e.target.value);
                  if (tpl) {
                    const content = tpl.content
                      .replace(/\{kunde_name\}/g, customer?.name || "")
                      .replace(/\{anrede_brief\}/g, customer?.name ? (customer.name.includes("Frau") ? `Sehr geehrte ${customer.name}` : `Sehr geehrter Herr ${customer.name.split(" ").pop()}`) : "Sehr geehrte Damen und Herren")
                      .replace(/\{firma\}/g, settings.company_name || "Tischlerei Graupner")
                      .replace(/\{dokument_nr\}/g, docNumber || "")
                      .replace(/\{datum\}/g, new Date().toLocaleDateString("de-DE"));
                    setEmailForm(f => ({ ...f, message: content }));
                  }
                }}
              >
                <option value="">Vorlage wählen...</option>
                {emailTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <textarea value={emailForm.message} onChange={e => setEmailForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Nachricht eingeben oder Vorlage wählen..." rows={5} className="w-full border rounded px-3 py-2 text-sm mt-1" data-testid="email-message-input" />
            {emailForm.message && (
              <button
                className="text-xs text-primary hover:underline mt-1"
                data-testid="btn-save-email-template"
                onClick={async () => {
                  const name = prompt("Vorlagenname:");
                  if (!name) return;
                  try {
                    await api.post("/text-templates", {
                      doc_type: "allgemein", text_type: "email", title: name, content: emailForm.message
                    });
                    const res = await api.get(`/text-templates?text_type=email`);
                    setEmailTemplates(res.data || []);
                    toast.success("E-Mail-Vorlage gespeichert");
                  } catch { toast.error("Fehler beim Speichern"); }
                }}
              >
                Als Vorlage speichern
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button size="sm" onClick={onSend} disabled={sendingEmail} data-testid="btn-send-email">
            <Mail className="w-4 h-4 mr-1" />
            {sendingEmail ? "Sende..." : "Senden"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export { EmailDialog };
