import { useEffect, useState } from "react";
import { Mail, RefreshCw, Loader2, Inbox, Check, X, Phone, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const STATUS_LABELS = {
  vorschlag: { label: "Offen", color: "bg-blue-100 text-blue-800" },
  übernommen: { label: "Übernommen", color: "bg-emerald-100 text-emerald-800" },
  ignoriert: { label: "Ignoriert", color: "bg-slate-100 text-slate-600" },
};

const ModuleMailInboxPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState("vorschlag");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/module-mail-inbox/list?status=${statusFilter}`);
      setItems(r.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);  // eslint-disable-line

  const scan = async () => {
    setScanning(true);
    try {
      const r = await api.post("/module-mail-inbox/scan?weeks=6&max_count=30");
      const d = r.data;
      toast.success(`${d.found} neue Anfragen gefunden, ${d.duplicates_skipped} Duplikate übersprungen`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Scan fehlgeschlagen");
    } finally {
      setScanning(false);
    }
  };

  const accept = async (entry) => {
    try {
      const r = await api.post(`/module-mail-inbox/accept/${entry.id}`);
      toast.success(`Kunde "${r.data.kunde_name}" angelegt`);
      await load();
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Übernahme fehlgeschlagen");
    }
  };

  const reject = async (entry) => {
    if (!window.confirm("Diese Anfrage als ignoriert markieren?")) return;
    try {
      await api.post(`/module-mail-inbox/reject/${entry.id}`);
      toast.success("Anfrage ignoriert");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  return (
    <div className="space-y-6" data-testid="module-mail-inbox-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6" /> Mail-Anfragen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kontaktformular-Anfragen aus deinem service24-Postfach. Letzte 6 Wochen, max. 30 pro Scan.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid="btn-mail-scan"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Postfach prüfen
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {[["vorschlag", "Offen"], ["übernommen", "Übernommen"], ["ignoriert", "Ignoriert"], ["all", "Alle"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(k)}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${statusFilter === k ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-${k}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Einträge.</p>
          <p className="text-xs mt-1">Klicke auf „Postfach prüfen" oben rechts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((e) => {
            const p = e.parsed || {};
            const sb = STATUS_LABELS[e.status] || { label: e.status, color: "bg-slate-100" };
            const fullName = [p.vorname, p.nachname].filter(Boolean).join(" ") || e.from_name || "(ohne Name)";
            return (
              <div key={e.id} className="border rounded-sm p-4 bg-card" data-testid={`mail-entry-${e.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{p.anrede ? `${p.anrede} ` : ""}{fullName}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${sb.color}`}>{sb.label}</span>
                      {p.format && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-mono">{p.format}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.received_at ? new Date(e.received_at).toLocaleString("de-DE") : ""} · {e.subject}
                    </p>
                  </div>
                  {e.status === "vorschlag" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => accept(e)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-sm hover:bg-emerald-700"
                        data-testid={`btn-accept-${e.id}`}
                      >
                        <Check className="w-3.5 h-3.5" /> Als Kunde übernehmen
                      </button>
                      <button
                        onClick={() => reject(e)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-sm hover:bg-muted"
                        data-testid={`btn-reject-${e.id}`}
                      >
                        <X className="w-3.5 h-3.5" /> Ignorieren
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {p.email && (
                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" /><a href={`mailto:${p.email}`} className="text-primary hover:underline">{p.email}</a></div>
                  )}
                  {p.telefon && (
                    <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /><a href={`tel:${p.telefon.replace(/\s/g, "")}`} className="text-primary hover:underline">{p.telefon}</a></div>
                  )}
                  {p.source_url && (
                    <div className="flex items-center gap-2 sm:col-span-2 truncate">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">{p.source_url}</a>
                    </div>
                  )}
                </div>

                {p.nachricht && (
                  <details className="mt-3">
                    <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">Nachricht anzeigen</summary>
                    <pre className="mt-2 text-xs whitespace-pre-wrap bg-muted/40 rounded-sm p-3 border max-h-60 overflow-auto">{p.nachricht}</pre>
                  </details>
                )}

                {e.status === "übernommen" && e.kunde_id && (
                  <a href={`/kunden#${e.kunde_id}`} className="text-xs text-primary hover:underline mt-2 inline-block">
                    → zum Kundeneintrag
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModuleMailInboxPage;
