import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Plus, Download, Mail, Trash2, Edit, CheckCircle, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";
import { DocumentPreview } from "@/components/DocumentPreview";

const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [dunningEditor, setDunningEditor] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const [invRes, overdueRes] = await Promise.all([
        api.get("/invoices"),
        api.get("/invoices/overdue")
      ]);
      setInvoices(invRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setOverdueInvoices(overdueRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Rechnungen");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (id, e) => {
    e?.stopPropagation();
    try {
      await api.put(`/invoices/${id}/status`, { status: "Bezahlt" });
      toast.success("Rechnung als bezahlt markiert");
      loadInvoices();
    } catch (err) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const handleDownloadPDF = async (id, number, e) => {
    e?.stopPropagation();
    try {
      const res = await api.get(`/pdf/invoice/${id}`, { responseType: "blob", params: { download: true } });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Rechnung_${number}.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 200);
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm("Rechnung wirklich löschen?")) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success("Rechnung gelöscht");
      loadInvoices();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleEdit = (invoice, e) => {
    e?.stopPropagation();
    navigate(`/invoices/edit/${invoice.id}`);
  };

  const getStatusBadge = (status) => {
    const variants = {
      Offen: "warning",
      Gesendet: "info",
      Bezahlt: "success",
      Überfällig: "danger"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const dunningTexts = {
    1: (inv) => `Sehr geehrte Damen und Herren,\n\nbei Durchsicht unserer Unterlagen haben wir festgestellt, dass die Rechnung\nNr. ${inv.invoice_number} vom ${new Date(inv.created_at).toLocaleDateString("de-DE")}\nüber ${inv.total_gross?.toFixed(2)} EUR noch nicht beglichen wurde.\n\nSicherlich handelt es sich um ein Versehen. Wir bitten Sie, den offenen\nBetrag innerhalb der nächsten 7 Tage auf unser Konto zu überweisen.`,
    2: (inv) => `Sehr geehrte Damen und Herren,\n\ntrotz unserer Zahlungserinnerung ist die Rechnung Nr. ${inv.invoice_number}\nüber ${inv.total_gross?.toFixed(2)} EUR weiterhin unbeglichen.\n\nWir fordern Sie hiermit auf, den fälligen Betrag zuzüglich Mahngebühren\nvon 5,00 EUR innerhalb von 7 Tagen auf unser Konto zu überweisen.`,
    3: (inv) => `Sehr geehrte Damen und Herren,\n\ntrotz mehrfacher Aufforderung ist die Rechnung Nr. ${inv.invoice_number}\nüber ${inv.total_gross?.toFixed(2)} EUR immer noch nicht beglichen.\n\nDies ist unsere letzte Mahnung. Sollte der Gesamtbetrag inkl. Mahngebühren\nvon 10,00 EUR nicht innerhalb von 5 Tagen bei uns eingehen, werden wir\nohne weitere Ankündigung rechtliche Schritte einleiten.`
  };

  const openDunningEditor = (inv, e) => {
    e?.stopPropagation();
    const nextLevel = Math.min((inv.dunning_level || 0) + 1, 3);
    setDunningEditor({
      invoice: inv,
      level: nextLevel,
      text: dunningTexts[nextLevel]?.(inv) || "",
      saving: false
    });
  };

  const handleDunningSubmit = async () => {
    if (!dunningEditor) return;
    setDunningEditor(prev => ({ ...prev, saving: true }));
    try {
      await api.post(`/invoices/${dunningEditor.invoice.id}/dunning`, {
        level: dunningEditor.level,
        custom_text: dunningEditor.text
      });
      toast.success(`${getDunningLabel(dunningEditor.level)} erstellt`);
      setDunningEditor(null);
      loadInvoices();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
      setDunningEditor(prev => ({ ...prev, saving: false }));
    }
  };

  const handleDownloadDunning = async (id, number, e) => {
    e?.stopPropagation();
    try {
      const res = await api.get(`/pdf/dunning/${id}`, { responseType: "blob", params: { download: true } });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Mahnung_${number}.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 200);
      toast.success("Mahnung PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const handleViewDunning = async (id, e) => {
    e?.stopPropagation();
    try {
      const res = await api.get(`/pdf/dunning/${id}`, { responseType: "blob", params: { download: true } });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      toast.error("Fehler beim Öffnen der Mahnung");
    }
  };

  const handleEmailDunning = async (inv, e) => {
    e?.stopPropagation();
    const email = window.prompt("E-Mail-Adresse des Kunden:", inv.customer_email || "");
    if (!email) return;
    try {
      const level = inv.dunning_level || 1;
      const dunningNames = {1: "Zahlungserinnerung", 2: "1. Mahnung", 3: "Letzte Mahnung"};
      await api.post(`/email/dunning/${inv.id}`, {
        to_email: email,
        subject: `${dunningNames[level] || "Mahnung"} - Rechnung ${inv.invoice_number}`
      });
      toast.success(`Mahnung per E-Mail an ${email} gesendet`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "E-Mail-Versand fehlgeschlagen");
    }
  };

  const getDunningLabel = (level) => {
    const labels = { 0: "Keine", 1: "Erinnerung", 2: "1. Mahnung", 3: "Letzte Mahnung" };
    return labels[level] || "Keine";
  };

  return (
    <div data-testid="invoices-page">
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Rechnungen</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{invoices.length} Rechnungen gesamt</p>
        </div>
        <Button data-testid="btn-new-invoice" onClick={() => navigate("/invoices/new")} size="sm" className="lg:h-10 lg:px-4">
          <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Neue Rechnung</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      {/* Tabs: Alle / Mahnwesen */}
      <div className="flex gap-1 mb-4 bg-muted p-1 rounded-sm w-fit" data-testid="invoices-tabs">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-sm text-sm font-medium transition-all ${
            activeTab === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-all-invoices"
        >
          Alle Rechnungen
        </button>
        <button
          onClick={() => setActiveTab("dunning")}
          className={`px-4 py-2 rounded-sm text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "dunning" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-dunning"
        >
          <AlertTriangle className="w-4 h-4" />
          Mahnwesen
          {overdueInvoices.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{overdueInvoices.length}</span>
          )}
        </button>
      </div>

      {activeTab === "dunning" ? (
        /* Mahnwesen Tab */
        <div data-testid="dunning-section">
          {overdueInvoices.length === 0 ? (
            <Card className="p-8 lg:p-12 text-center">
              <CheckCircle className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-base lg:text-lg font-semibold">Keine überfälligen Rechnungen</h3>
              <p className="text-muted-foreground mt-2 text-sm">Alle Rechnungen sind im grünen Bereich</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {overdueInvoices.map((inv) => (
                <Card key={inv.id} className="p-4 lg:p-5 border-l-4 border-l-red-500" data-testid={`dunning-card-${inv.id}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm">{inv.invoice_number}</span>
                        <span className="font-semibold">{inv.customer_name}</span>
                        <Badge variant="danger">{inv.days_overdue} Tage überfällig</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        <span>Betrag: <strong className="text-foreground">{inv.total_gross?.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</strong></span>
                        {inv.dunning_fee > 0 && (
                          <span>+ Mahngebühr: <strong className="text-red-600">{inv.dunning_fee?.toFixed(2)} €</strong></span>
                        )}
                        <span>Fällig: {new Date(inv.due_date).toLocaleDateString("de-DE")}</span>
                        <span>Mahnstufe: <strong className={inv.dunning_level >= 2 ? "text-red-600" : "text-foreground"}>{getDunningLabel(inv.dunning_level || 0)}</strong></span>
                      </div>
                      {/* Mahnungshistorie */}
                      {inv.dunning_history?.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-dashed">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Mahnverlauf:</p>
                          <div className="space-y-0.5">
                            {inv.dunning_history.map((h, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                                <span>{new Date(h.date).toLocaleDateString("de-DE")}</span>
                                <span className="font-medium text-foreground">{h.label}</span>
                                {h.fee > 0 && <span className="text-red-600">({h.fee.toFixed(2)} € Gebühr)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {(inv.dunning_level || 0) > 0 && (
                        <button
                          onClick={(e) => handleViewDunning(inv.id, e)}
                          className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-sm"
                          title="Mahnung ansehen"
                          data-testid={`btn-view-dunning-${inv.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {(inv.dunning_level || 0) > 0 && (
                        <button
                          onClick={(e) => handleDownloadDunning(inv.id, inv.invoice_number, e)}
                          className="p-2.5 bg-muted hover:bg-muted/80 rounded-sm"
                          title="Mahnung PDF herunterladen"
                          data-testid={`btn-download-dunning-${inv.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {(inv.dunning_level || 0) > 0 && (
                        <button
                          onClick={(e) => handleEmailDunning(inv, e)}
                          className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-sm"
                          title="Mahnung per E-Mail senden"
                          data-testid={`btn-email-dunning-${inv.id}`}
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      {(inv.dunning_level || 0) < 3 && (
                        <button
                          onClick={(e) => openDunningEditor(inv, e)}
                          className="p-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-sm"
                          title={`${getDunningLabel((inv.dunning_level || 0) + 1)} erstellen`}
                          data-testid={`btn-dunning-${inv.id}`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleMarkPaid(inv.id, e)}
                        className="p-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-sm"
                        title="Als bezahlt markieren"
                        data-testid={`btn-dunning-paid-${inv.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (

      loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : invoices.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <Receipt className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Rechnungen vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">Erstellen Sie Ihre erste Rechnung</p>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="p-4" onClick={() => setPreviewInvoice(invoice)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-muted-foreground">{invoice.invoice_number}</p>
                    <p className="font-semibold truncate">{invoice.customer_name}</p>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString("de-DE")}
                    {invoice.due_date && <span className="ml-2">Fällig: {new Date(invoice.due_date).toLocaleDateString("de-DE")}</span>}
                  </div>
                  <div className="font-mono font-semibold">
                    {invoice.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                  <button data-testid={`btn-edit-invoice-${invoice.id}`} onClick={(e) => handleEdit(invoice, e)} className="p-2 hover:bg-muted rounded-sm"><Edit className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDownloadPDF(invoice.id, invoice.invoice_number, e)} className="p-2 hover:bg-muted rounded-sm"><Download className="w-4 h-4" /></button>
                  {invoice.status === "Offen" && (
                    <button onClick={(e) => handleMarkPaid(invoice.id, e)} className="p-2 hover:bg-green-100 text-green-700 rounded-sm"><CheckCircle className="w-4 h-4" /></button>
                  )}
                  <button onClick={(e) => handleDelete(invoice.id, e)} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"><Trash2 className="w-4 h-4" /></button>
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
                  <th className="text-left p-4 font-semibold">Rechnungs-Nr.</th>
                  <th className="text-left p-4 font-semibold">Kunde</th>
                  <th className="text-left p-4 font-semibold">Datum</th>
                  <th className="text-left p-4 font-semibold">Fällig</th>
                  <th className="text-right p-4 font-semibold">Betrag</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-right p-4 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr 
                    key={invoice.id} 
                    className="border-b table-row-hover cursor-pointer"
                    onClick={() => setPreviewInvoice(invoice)}
                  >
                    <td className="p-4 font-mono text-sm">{invoice.invoice_number}</td>
                    <td className="p-4">{invoice.customer_name}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(invoice.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {invoice.due_date
                        ? new Date(invoice.due_date).toLocaleDateString("de-DE")
                        : "-"}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {invoice.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="p-4">{getStatusBadge(invoice.status)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          data-testid={`btn-edit-invoice-${invoice.id}`}
                          onClick={(e) => handleEdit(invoice, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-download-invoice-${invoice.id}`}
                          onClick={(e) => handleDownloadPDF(invoice.id, invoice.invoice_number, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {invoice.status === "Offen" && (
                          <button
                            data-testid={`btn-mark-paid-${invoice.id}`}
                            onClick={(e) => handleMarkPaid(invoice.id, e)}
                            className="p-2 hover:bg-green-100 text-green-700 rounded-sm"
                            title="Als bezahlt markieren"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-delete-invoice-${invoice.id}`}
                          onClick={(e) => handleDelete(invoice.id, e)}
                          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
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
      )
      )}

      <DocumentPreview
        isOpen={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        document={previewInvoice}
        type="invoice"
        onDownload={(id, num) => handleDownloadPDF(id, num)}
        onEdit={(inv) => handleEdit(inv)}
      />

      {/* Mahnungs-Editor Dialog */}
      {dunningEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDunningEditor(null)} />
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto" data-testid="dunning-editor-dialog">
            <h3 className="text-lg font-semibold mb-1">Mahnung bearbeiten</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {dunningEditor.invoice.invoice_number} · {dunningEditor.invoice.customer_name} · {dunningEditor.invoice.total_gross?.toFixed(2)} €
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Dringlichkeitsstufe</label>
                <select
                  data-testid="dunning-level-select"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={dunningEditor.level}
                  onChange={(e) => {
                    const newLevel = parseInt(e.target.value);
                    setDunningEditor(prev => ({
                      ...prev,
                      level: newLevel,
                      text: dunningTexts[newLevel]?.(prev.invoice) || prev.text
                    }));
                  }}
                >
                  <option value={1}>Stufe 1 — Zahlungserinnerung (keine Gebühr)</option>
                  <option value={2}>Stufe 2 — 1. Mahnung (5,00 € Gebühr)</option>
                  <option value={3}>Stufe 3 — Letzte Mahnung (10,00 € Gebühr)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mahntext</label>
                <textarea
                  data-testid="dunning-text-area"
                  className="w-full border rounded px-3 py-2 text-sm font-mono"
                  rows={12}
                  value={dunningEditor.text}
                  onChange={(e) => setDunningEditor(prev => ({ ...prev, text: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Der Text wird in der Mahnung verwendet. Sie können ihn frei anpassen.</p>
              </div>

              <div className="bg-muted/50 rounded p-3 text-sm">
                <div className="flex justify-between">
                  <span>Rechnungsbetrag:</span>
                  <span className="font-mono">{dunningEditor.invoice.total_gross?.toFixed(2)} €</span>
                </div>
                {dunningEditor.level >= 2 && (
                  <div className="flex justify-between text-red-600">
                    <span>Mahngebühr (Stufe {dunningEditor.level}):</span>
                    <span className="font-mono">{dunningEditor.level === 2 ? "5,00" : "10,00"} €</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t mt-1 pt-1">
                  <span>Gesamtbetrag:</span>
                  <span className="font-mono">
                    {(dunningEditor.invoice.total_gross + (dunningEditor.level === 2 ? 5 : dunningEditor.level === 3 ? 10 : 0)).toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => setDunningEditor(null)}>Abbrechen</Button>
              <Button size="sm" onClick={handleDunningSubmit} disabled={dunningEditor.saving}
                className={dunningEditor.level >= 2 ? "bg-red-600 hover:bg-red-700" : ""}
                data-testid="btn-submit-dunning">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {dunningEditor.saving ? "..." : `${getDunningLabel(dunningEditor.level)} erstellen`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export { InvoicesPage };
