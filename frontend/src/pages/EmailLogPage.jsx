import { useState, useEffect } from "react";
import { Mail, CheckCircle, Search, X, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";

const EmailLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const res = await api.get("/email/log");
      setLogs(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden des E-Mail-Protokolls");
    } finally {
      setLoading(false);
    }
  };

  const typeLabels = { quote: "Angebot", order: "Auftrag", invoice: "Rechnung", dunning: "Mahnung" };

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
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.sent_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.sent_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};


export { EmailLogPage };
