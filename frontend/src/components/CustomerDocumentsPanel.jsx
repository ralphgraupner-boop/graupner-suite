import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/common";
import { api } from "@/lib/api";
import {
  Plus, FileText, ClipboardCheck, Receipt, Eye,
} from "lucide-react";

/**
 * Zeigt alle Angebote, Auftragsbestaetigungen und Rechnungen eines Kunden.
 * Wird in der KundenModulPage UND in der ProjektWerkbank wiederverwendet.
 *
 * Props:
 *   customerId  (Pflicht)  Kunden-ID
 *   projektId   (optional) wenn gesetzt, wird sie an die "Neu"-URLs angehaengt
 *                          (`/quotes/new?customer=…&projekt_id=…`). Backend ignoriert
 *                          den Parameter aktuell noch; spaeter dient er der Verknuepfung.
 */
export const CustomerDocumentsPanel = ({ customerId, projektId = null }) => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState({ quotes: [], orders: [], invoices: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        const [q, o, i] = await Promise.all([
          api.get("/quotes").then(r => r.data.filter(x => x.customer_id === customerId)).catch(() => []),
          api.get("/orders").then(r => r.data.filter(x => x.customer_id === customerId)).catch(() => []),
          api.get("/invoices").then(r => r.data.filter(x => x.customer_id === customerId)).catch(() => []),
        ]);
        setDocs({ quotes: q, orders: o, invoices: i });
      } finally { setLoading(false); }
    };
    load();
  }, [customerId]);

  const projektSuffix = projektId ? `&projekt_id=${projektId}` : "";
  const newQuote = () => navigate(`/quotes/new?customer=${customerId}${projektSuffix}`);
  const newInvoice = () => navigate(`/invoices/new?customer=${customerId}${projektSuffix}`);
  const newOrder = async () => {
    try {
      const res = await api.post(`/orders/blank-for-customer/${customerId}`);
      toast.success("Auftragsbestätigung angelegt");
      navigate(`/orders/edit/${res.data.id}${projektId ? `?projekt_id=${projektId}` : ""}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Fehler beim Anlegen"); }
  };
  const orderFromQuote = async (quoteId) => {
    try {
      const res = await api.post(`/orders/from-quote/${quoteId}`);
      toast.success("Auftragsbestätigung erstellt");
      navigate(`/orders/edit/${res.data.id}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Fehler"); }
  };
  const invoiceFromOrder = async (orderId) => {
    try {
      const res = await api.post(`/invoices/from-order/${orderId}`);
      toast.success("Rechnung erstellt");
      navigate(`/invoices/edit/${res.data.id}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Fehler"); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "—";
  const fmtEur = (n) => (n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  const statusColor = (status) => ({
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    open: "bg-amber-100 text-amber-700",
    cancelled: "bg-gray-100 text-gray-500",
  }[status] || "bg-gray-100 text-gray-700");

  const total = docs.quotes.length + docs.orders.length + docs.invoices.length;

  const tabs = [
    { id: "all", label: "Alle", icon: FileText, count: total },
    { id: "quotes", label: "Angebote", icon: FileText, count: docs.quotes.length, color: "blue" },
    { id: "orders", label: "Aufträge", icon: ClipboardCheck, count: docs.orders.length, color: "purple" },
    { id: "invoices", label: "Rechnungen", icon: Receipt, count: docs.invoices.length, color: "green" },
  ];

  const renderDocRow = (doc, type) => {
    const isQuote = type === "quote", isOrder = type === "order";
    const number = doc.quote_number || doc.order_number || doc.invoice_number || doc.id?.slice(0, 8);
    const editUrl = isQuote ? `/quotes/edit/${doc.id}` : isOrder ? `/orders/edit/${doc.id}` : `/invoices/edit/${doc.id}`;
    const Icon = isQuote ? FileText : isOrder ? ClipboardCheck : Receipt;
    const typeColor = isQuote ? "text-blue-600" : isOrder ? "text-purple-600" : "text-green-600";
    return (
      <div key={doc.id} className="flex items-center gap-3 p-2.5 border rounded-sm hover:bg-muted/30 transition-colors group" data-testid={`doc-row-${doc.id}`}>
        <Icon className={`w-5 h-5 flex-shrink-0 ${typeColor}`} />
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-2 items-center">
          <div className="font-mono text-sm font-medium truncate">{number}</div>
          <div className="text-xs text-muted-foreground">{fmtDate(doc.created_at || doc.date)}</div>
          <Badge className={`${statusColor(doc.status)} text-xs w-fit`}>{doc.status || "—"}</Badge>
          <div className="text-sm font-mono text-right">{fmtEur(doc.total_gross ?? doc.total ?? doc.brutto ?? 0)}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => navigate(editUrl)}
            className="p-1.5 hover:bg-primary/10 text-primary rounded-sm transition-colors"
            title="Öffnen / Bearbeiten"
            data-testid={`btn-open-${doc.id}`}
          >
            <Eye className="w-4 h-4" />
          </button>
          {isQuote && (
            <button
              onClick={() => orderFromQuote(doc.id)}
              className="p-1.5 hover:bg-purple-50 text-purple-600 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
              title="Auftragsbestätigung daraus erstellen"
              data-testid={`btn-to-order-${doc.id}`}
            >
              <ClipboardCheck className="w-4 h-4" />
            </button>
          )}
          {isOrder && (
            <button
              onClick={() => invoiceFromOrder(doc.id)}
              className="p-1.5 hover:bg-green-50 text-green-600 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
              title="Rechnung daraus erstellen"
              data-testid={`btn-to-invoice-${doc.id}`}
            >
              <Receipt className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 pt-4 border-t" data-testid={`customer-docs-${customerId}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <FileText className="w-4 h-4" /> Dokumente &amp; Vorgänge {total > 0 && <Badge className="bg-slate-100 text-slate-700">{total}</Badge>}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={newQuote} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200" data-testid={`btn-new-quote-${customerId}`}>
            <Plus className="w-3 h-3" /> Angebot
          </button>
          <button onClick={newOrder} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-sm bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200" data-testid={`btn-new-order-${customerId}`}>
            <Plus className="w-3 h-3" /> Auftragsbestätigung
          </button>
          <button onClick={newInvoice} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-sm bg-green-50 text-green-700 hover:bg-green-100 border border-green-200" data-testid={`btn-new-invoice-${customerId}`}>
            <Plus className="w-3 h-3" /> Rechnung
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-3">Lade Dokumente...</div>
      ) : total === 0 ? (
        <CreateDocPrompt onQuote={newQuote} onOrder={newOrder} onInvoice={newInvoice} />
      ) : (
        <>
          <div className="flex gap-1 mb-3 border-b">
            {tabs.map(t => {
              const T = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  data-testid={`tab-${t.id}-${customerId}`}
                >
                  <T className="w-3.5 h-3.5" /> {t.label} {t.count > 0 && <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-600">{t.count}</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            {(tab === "all" || tab === "quotes") && docs.quotes.map(d => renderDocRow(d, "quote"))}
            {(tab === "all" || tab === "orders") && docs.orders.map(d => renderDocRow(d, "order"))}
            {(tab === "all" || tab === "invoices") && docs.invoices.map(d => renderDocRow(d, "invoice"))}
          </div>
        </>
      )}
    </div>
  );
};


// ==================== CREATE DOC PROMPT (Empty State mit Auswahl) ====================
const CreateDocPrompt = ({ onQuote, onOrder, onInvoice }) => {
  const [choosing, setChoosing] = useState(false);

  if (!choosing) {
    return (
      <div className="text-center py-8 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-lg border-2 border-dashed border-slate-200" data-testid="empty-docs-prompt">
        <FileText className="w-10 h-10 mx-auto mb-3 text-primary/60" />
        <div className="text-sm font-medium text-slate-700 mb-1">Noch keine Dokumente für diesen Kunden</div>
        <div className="text-xs text-muted-foreground mb-4">Möchtest du ein Dokument anlegen?</div>
        <button
          onClick={() => setChoosing(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 shadow-sm"
          data-testid="btn-prompt-create-doc"
        >
          <Plus className="w-4 h-4" /> Ja, Dokument anlegen
        </button>
      </div>
    );
  }

  return (
    <div className="py-6 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-lg border-2 border-dashed border-primary/30" data-testid="empty-docs-choose">
      <div className="text-center mb-5">
        <div className="text-sm font-semibold text-slate-800 mb-1">Was möchtest du anlegen?</div>
        <div className="text-xs text-muted-foreground">Du kannst jederzeit aus einem Angebot eine Auftragsbestätigung oder Rechnung ableiten.</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto px-4">
        <button
          onClick={onQuote}
          className="group flex flex-col items-center gap-2 p-5 bg-card border-2 border-blue-200 dark:border-blue-900 rounded-lg hover:border-blue-400 hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all"
          data-testid="choose-quote"
        >
          <FileText className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-blue-900 dark:text-blue-200">Angebot</div>
          <div className="text-xs text-center text-muted-foreground leading-relaxed">Preisvorschlag an den Kunden. Standard-Startpunkt.</div>
        </button>
        <button
          onClick={onOrder}
          className="group flex flex-col items-center gap-2 p-5 bg-card border-2 border-purple-200 dark:border-purple-900 rounded-lg hover:border-purple-400 hover:shadow-md hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all"
          data-testid="choose-order"
        >
          <ClipboardCheck className="w-8 h-8 text-purple-600 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-purple-900 dark:text-purple-200">Auftragsbestätigung</div>
          <div className="text-xs text-center text-muted-foreground leading-relaxed">Bestätigt dem Kunden den Auftrag schriftlich.</div>
        </button>
        <button
          onClick={onInvoice}
          className="group flex flex-col items-center gap-2 p-5 bg-card border-2 border-green-200 dark:border-green-900 rounded-lg hover:border-green-400 hover:shadow-md hover:bg-green-50 dark:hover:bg-green-950/40 transition-all"
          data-testid="choose-invoice"
        >
          <Receipt className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-green-900 dark:text-green-200">Rechnung</div>
          <div className="text-xs text-center text-muted-foreground leading-relaxed">Direkte Rechnung ohne vorherigen Auftrag.</div>
        </button>
      </div>
      <div className="text-center mt-4">
        <button onClick={() => setChoosing(false)} className="text-xs text-muted-foreground hover:text-foreground underline">
          Abbrechen
        </button>
      </div>
    </div>
  );
};

export default CustomerDocumentsPanel;
