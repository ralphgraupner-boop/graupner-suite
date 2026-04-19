import { useState, useEffect } from "react";
import { Package, FileText, ClipboardCheck, Receipt, Download, Star, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button, Badge, Card } from "@/components/common";
import { api } from "@/lib/api";
import { QuotesPage } from "@/pages/QuotesPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { DocumentTemplatesPanel } from "@/components/DocumentTemplatesPanel";
import { PdfArchivePanel } from "@/components/PdfArchivePanel";

const TABS = [
  { id: "quotes", label: "Angebote", icon: FileText },
  { id: "orders", label: "Auftraege", icon: ClipboardCheck },
  { id: "invoices", label: "Rechnungen", icon: Receipt },
  { id: "templates", label: "Vorlagen", icon: Star },
  { id: "archive", label: "PDF-Archiv", icon: Archive },
];

const DokumenteModulPage = () => {
  const [activeTab, setActiveTab] = useState("quotes");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/modules/dokumente/stats").then(res => setStats(res.data)).catch(() => {});
  }, [activeTab]);

  const handleExport = async () => {
    try {
      const res = await api.get("/modules/dokumente/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dokumente_modul_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Alle Dokumente exportiert");
    } catch { toast.error("Fehler beim Export"); }
  };

  return (
    <div data-testid="dokumente-modul-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Dokumente</h1>
            <Badge variant="default" className="text-xs">Solo</Badge>
          </div>
          {stats && (
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{stats.quotes} Angebote</span>
              <span>{stats.orders} Auftraege</span>
              <span>{stats.invoices} Rechnungen</span>
              {stats.total_invoiced > 0 && (
                <span className="font-medium text-foreground">
                  Gesamt: {stats.total_invoiced.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              )}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} data-testid="btn-export-dokumente">
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const count = stats ? stats[tab.id] || 0 : "";
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`dokumente-tab-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count !== "" && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab Content - Bestehende Seiten */}
      <div>
        {activeTab === "quotes" && <QuotesPage />}
        {activeTab === "orders" && <OrdersPage />}
        {activeTab === "invoices" && <InvoicesPage />}
        {activeTab === "templates" && <DocumentTemplatesPanel variant="embedded" />}
        {activeTab === "archive" && <PdfArchivePanel variant="embedded" />}
      </div>
    </div>
  );
};

export { DokumenteModulPage };
