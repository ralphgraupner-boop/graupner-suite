import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Receipt, Download, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";
import { DocumentPreview } from "@/components/DocumentPreview";

const OrdersPage = ({ readOnly = false }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(o =>
      (o.betreff || "").toLowerCase().includes(term) ||
      (o.customer_name || "").toLowerCase().includes(term) ||
      (o.order_number || "").toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get("/orders");
      setOrders(res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      toast.error("Fehler beim Laden der Aufträge");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (orderId, e) => {
    e?.stopPropagation();
    try {
      await api.post(`/invoices/from-order/${orderId}`, { due_days: 14 });
      toast.success("Rechnung erstellt");
      loadOrders();
    } catch (err) {
      toast.error("Fehler beim Erstellen der Rechnung");
    }
  };

  const handleDownloadPDF = async (id, number, e) => {
    e?.stopPropagation();
    try {
      const res = await api.get(`/pdf/order/${id}`, { responseType: "blob", params: { download: true } });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Auftragsbestaetigung_${number}.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 200);
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const handleEdit = (order, e) => {
    e?.stopPropagation();
    navigate(`/orders/edit/${order.id}`);
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      await api.delete(`/orders/${id}`);
      toast.success("Auftrag gelöscht");
      setConfirmDeleteId(null);
      loadOrders();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Offen: "warning",
      "In Arbeit": "info",
      Abgeschlossen: "success",
      Abgerechnet: "success"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div data-testid="orders-page">
      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Aufträge</h1>
        <p className="text-muted-foreground mt-1 text-sm lg:text-base">{orders.length} Aufträge gesamt</p>
      </div>

      {/* Suchfeld */}
      <div className="relative mb-4" data-testid="orders-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Suchen nach Beschreibung, Kunde oder Nr..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border rounded-sm text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="input-search-orders"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <ClipboardCheck className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Aufträge vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">Erstellen Sie Aufträge aus Angeboten</p>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="p-4" onClick={() => setPreviewOrder(order)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-muted-foreground">{order.order_number}</p>
                    <p className="font-semibold truncate">{order.customer_name}</p>
                    {order.betreff && <p className="text-sm text-muted-foreground truncate mt-0.5">{order.betreff}</p>}
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("de-DE")}
                  </div>
                  <div className="font-mono font-semibold">
                    {order.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                  {!readOnly && <button data-testid={`btn-edit-order-${order.id}`} onClick={(e) => handleEdit(order, e)} className="p-2 hover:bg-muted rounded-sm"><Edit className="w-4 h-4" /></button>}
                  <button onClick={(e) => handleDownloadPDF(order.id, order.order_number, e)} className="p-2 hover:bg-muted rounded-sm"><Download className="w-4 h-4" /></button>
                  {!readOnly && order.status !== "Abgerechnet" && (
                    <button onClick={(e) => handleCreateInvoice(order.id, e)} className="p-2 hover:bg-primary/10 text-primary rounded-sm"><Receipt className="w-4 h-4" /></button>
                  )}
                  {!readOnly && <button data-testid={`btn-delete-order-${order.id}`} onClick={(e) => handleDelete(order.id, e)} className={`p-2 rounded-sm transition-colors ${confirmDeleteId === order.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`} title={confirmDeleteId === order.id ? "Nochmal klicken" : "Löschen"}>
                    {confirmDeleteId === order.id ? <span className="text-xs font-bold px-1">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                  </button>}
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
                  <th className="text-left p-4 font-semibold">Auftrags-Nr.</th>
                  <th className="text-left p-4 font-semibold">Kunde</th>
                  <th className="text-left p-4 font-semibold">Beschreibung</th>
                  <th className="text-left p-4 font-semibold">Datum</th>
                  <th className="text-right p-4 font-semibold">Betrag</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-right p-4 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="border-b table-row-hover cursor-pointer"
                    onClick={() => setPreviewOrder(order)}
                  >
                    <td className="p-4 font-mono text-sm">{order.order_number}</td>
                    <td className="p-4">{order.customer_name}</td>
                    <td className="p-4 text-muted-foreground text-sm max-w-[250px] truncate">{order.betreff || "-"}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {order.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="p-4">{getStatusBadge(order.status)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        {!readOnly && <button
                          data-testid={`btn-edit-order-${order.id}`}
                          onClick={(e) => handleEdit(order, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>}
                        <button
                          data-testid={`btn-download-order-${order.id}`}
                          onClick={(e) => handleDownloadPDF(order.id, order.order_number, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {!readOnly && order.status !== "Abgerechnet" && (
                          <button
                            data-testid={`btn-create-invoice-${order.id}`}
                            onClick={(e) => handleCreateInvoice(order.id, e)}
                            className="p-2 hover:bg-primary/10 text-primary rounded-sm"
                            title="Rechnung erstellen"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                        {!readOnly && <button
                          data-testid={`btn-delete-order-${order.id}`}
                          onClick={(e) => handleDelete(order.id, e)}
                          className={`p-2 rounded-sm transition-colors ${confirmDeleteId === order.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                          title={confirmDeleteId === order.id ? "Nochmal klicken zum Löschen" : "Löschen"}
                        >
                          {confirmDeleteId === order.id ? <span className="text-xs font-bold px-1">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                        </button>}
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
        isOpen={!!previewOrder}
        onClose={() => setPreviewOrder(null)}
        document={previewOrder}
        type="order"
        onDownload={(id, num) => handleDownloadPDF(id, num)}
        onEdit={(o) => handleEdit(o)}
      />
    </div>
  );
};


export { OrdersPage };
