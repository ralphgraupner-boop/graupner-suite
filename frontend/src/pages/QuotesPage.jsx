import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Download, Trash2, Edit, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Button, Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";
import { DocumentPreview } from "@/components/DocumentPreview";

const QuotesPage = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewQuote, setPreviewQuote] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const res = await api.get("/quotes");
      setQuotes(res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      toast.error("Fehler beim Laden der Angebote");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      await api.delete(`/quotes/${id}`);
      toast.success("Angebot gelöscht");
      setConfirmDeleteId(null);
      loadQuotes();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleDownloadPDF = async (id, number, e) => {
    e?.stopPropagation();
    try {
      const res = await axios.get(`${API}/pdf/quote/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Angebot_${number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const handleCreateOrder = async (quoteId, e) => {
    e?.stopPropagation();
    try {
      await api.post(`/orders/from-quote/${quoteId}`);
      toast.success("Auftrag erstellt");
      loadQuotes();
    } catch (err) {
      toast.error("Fehler beim Erstellen des Auftrags");
    }
  };

  const handleEdit = (quote, e) => {
    e?.stopPropagation();
    navigate(`/quotes/edit/${quote.id}`);
  };

  const getStatusBadge = (status) => {
    const variants = {
      Entwurf: "warning",
      Gesendet: "info",
      Beauftragt: "success",
      Abgelehnt: "danger"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div data-testid="quotes-page">
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Angebote</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{quotes.length} Angebote gesamt</p>
        </div>
        <Button data-testid="btn-new-quote" onClick={() => navigate("/quotes/new")} size="sm" className="lg:h-10 lg:px-4">
          <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Neues Angebot</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : quotes.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <FileText className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Angebote vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">Erstellen Sie Ihr erstes Angebot</p>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {quotes.map((quote) => (
              <Card key={quote.id} className="p-4" onClick={() => setPreviewQuote(quote)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-muted-foreground">{quote.quote_number}</p>
                    <p className="font-semibold truncate">{quote.customer_name}</p>
                  </div>
                  {getStatusBadge(quote.status)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-muted-foreground">
                    {new Date(quote.created_at).toLocaleDateString("de-DE")}
                  </div>
                  <div className="font-mono font-semibold">
                    {quote.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                  <button data-testid={`btn-edit-quote-${quote.id}`} onClick={(e) => handleEdit(quote, e)} className="p-2 hover:bg-muted rounded-sm"><Edit className="w-4 h-4" /></button>
                  <button data-testid={`btn-download-quote-m-${quote.id}`} onClick={(e) => handleDownloadPDF(quote.id, quote.quote_number, e)} className="p-2 hover:bg-muted rounded-sm"><Download className="w-4 h-4" /></button>
                  {quote.status === "Entwurf" && (
                    <button onClick={(e) => handleCreateOrder(quote.id, e)} className="p-2 hover:bg-primary/10 text-primary rounded-sm"><CheckCircle className="w-4 h-4" /></button>
                  )}
                  <button onClick={(e) => handleDelete(quote.id, e)} className={`p-2 rounded-sm transition-colors ${confirmDeleteId === quote.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}>
                    {confirmDeleteId === quote.id ? <span className="text-xs font-bold px-1">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">Nr.</th>
                  <th className="text-left p-4 font-semibold">Kunde</th>
                  <th className="text-left p-4 font-semibold">Datum</th>
                  <th className="text-right p-4 font-semibold">Betrag</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-right p-4 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr 
                    key={quote.id} 
                    className="border-b table-row-hover cursor-pointer"
                    onClick={() => setPreviewQuote(quote)}
                  >
                    <td className="p-4 font-mono text-sm">{quote.quote_number}</td>
                    <td className="p-4">{quote.customer_name}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {quote.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="p-4">{getStatusBadge(quote.status)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          data-testid={`btn-edit-quote-${quote.id}`}
                          onClick={(e) => handleEdit(quote, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-download-quote-${quote.id}`}
                          onClick={(e) => handleDownloadPDF(quote.id, quote.quote_number, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {quote.status === "Entwurf" && (
                          <button
                            data-testid={`btn-create-order-${quote.id}`}
                            onClick={(e) => handleCreateOrder(quote.id, e)}
                            className="p-2 hover:bg-primary/10 text-primary rounded-sm"
                            title="Auftrag erstellen"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-delete-quote-${quote.id}`}
                          onClick={(e) => handleDelete(quote.id, e)}
                          className={`p-2 rounded-sm transition-colors ${confirmDeleteId === quote.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                          title={confirmDeleteId === quote.id ? "Nochmal klicken zum Löschen" : "Löschen"}
                        >
                          {confirmDeleteId === quote.id ? <span className="text-xs font-bold px-1">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}

      <DocumentPreview
        isOpen={!!previewQuote}
        onClose={() => setPreviewQuote(null)}
        document={previewQuote}
        type="quote"
        onDownload={(id, num) => handleDownloadPDF(id, num)}
        onEdit={(q) => handleEdit(q)}
      />
    </div>
  );
};


export { QuotesPage };
