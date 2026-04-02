import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, FileText, ClipboardCheck, Receipt, ChevronRight, Euro, TrendingUp, Clock, Eye, Inbox, Filter, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { Button, Card, StatCard } from "@/components/common";
import { api, API } from "@/lib/api";

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dueSoon, setDueSoon] = useState([]);
  const [followupQuotes, setFollowupQuotes] = useState([]);
  const [overviewView, setOverviewView] = useState("anfragen");
  const [overviewData, setOverviewData] = useState(null);

  useEffect(() => {
    loadStats();
    checkDueInvoices();
    checkFollowups();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Statistiken");
    } finally {
      setLoading(false);
    }
  };

  const checkDueInvoices = async () => {
    try {
      const [checkRes, dueSoonRes] = await Promise.all([
        api.post("/invoices/check-due"),
        api.get("/invoices/due-soon")
      ]);
      setDueSoon(dueSoonRes.data);
    } catch {}
  };

  const checkFollowups = async () => {
    try {
      const [checkRes, followupRes] = await Promise.all([
        api.post("/quotes/check-followup"),
        api.get("/quotes/followup")
      ]);
      setFollowupQuotes(followupRes.data);
    } catch {}
  };

  useEffect(() => {
    loadOverview();
  }, [overviewView]);

  const loadOverview = async () => {
    try {
      const res = await api.get(`/stats/overview?view=${overviewView}`);
      setOverviewData(res.data);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base">Übersicht Ihrer Geschäftstätigkeit</p>
      </div>

      {/* Fälligkeits-Warnung */}
      {(dueSoon.length > 0 || (stats?.overdue_count || 0) > 0) && (
        <div className="mb-4 lg:mb-6 space-y-2" data-testid="dashboard-due-warnings">
          {dueSoon.length > 0 && (
            <div className="flex items-center gap-3 p-3 lg:p-4 bg-amber-50 border border-amber-200 rounded-sm">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {dueSoon.length === 1
                    ? `Rechnung ${dueSoon[0].invoice_number} an ${dueSoon[0].customer_name} wird in ${dueSoon[0].days_until_due === 0 ? "heute" : `${dueSoon[0].days_until_due} Tag(en)`} fällig`
                    : `${dueSoon.length} Rechnungen werden in den nächsten 3 Tagen fällig`}
                </p>
              </div>
              <Link to="/invoices">
                <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0">
                  Anzeigen
                </Button>
              </Link>
            </div>
          )}
          {(stats?.overdue_count || 0) > 0 && (
            <div className="flex items-center gap-3 p-3 lg:p-4 bg-red-50 border border-red-200 rounded-sm">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  {stats.overdue_count} Rechnung(en) überfällig!
                </p>
              </div>
              <Link to="/invoices">
                <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100 shrink-0" data-testid="btn-view-overdue">
                  Mahnwesen
                </Button>
              </Link>
            </div>
          )}
          {followupQuotes.length > 0 && (
            <div className="flex items-center gap-3 p-3 lg:p-4 bg-blue-50 border border-blue-200 rounded-sm">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-800">
                  {followupQuotes.length === 1
                    ? `Angebot ${followupQuotes[0].quote_number} an ${followupQuotes[0].customer_name} wartet seit ${followupQuotes[0].days_waiting} Tagen`
                    : `${followupQuotes.length} Angebote seit 7+ Tagen ohne Rückmeldung`}
                </p>
              </div>
              <Link to="/quotes">
                <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0" data-testid="btn-view-followup">
                  Wiedervorlage
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-6 mb-6 lg:mb-8">
        <Link to="/anfragen" className="block" data-testid="stat-link-anfragen">
          <StatCard
            title="Neue Anfragen"
            value={stats?.anfragen?.total || 0}
            icon={Inbox}
          />
        </Link>
        <Link to="/customers" className="block" data-testid="stat-link-kunden">
          <StatCard
            title="Kunden"
            value={stats?.customers_count || 0}
            icon={Users}
          />
        </Link>
        <Link to="/quotes" className="block" data-testid="stat-link-angebote">
          <StatCard
            title="Offene Angebote"
            value={stats?.quotes?.open || 0}
            subtitle={`Gesamt: ${stats?.quotes?.total || 0}`}
            icon={FileText}
          />
        </Link>
        <Link to="/orders" className="block" data-testid="stat-link-auftraege">
          <StatCard
            title="Offene Aufträge"
            value={stats?.orders?.open || 0}
            subtitle={`Gesamt: ${stats?.orders?.total || 0}`}
            icon={ClipboardCheck}
          />
        </Link>
        <Link to="/invoices" className="block" data-testid="stat-link-rechnungen">
          <StatCard
            title="Unbezahlte Rechnungen"
            value={stats?.invoices?.unpaid || 0}
            subtitle={`Gesamt: ${stats?.invoices?.total || 0}`}
            icon={Receipt}
          />
        </Link>
      </div>

      {/* Anfragen nach Kategorie */}
      {stats?.anfragen?.total > 0 && (
        <Card className="p-6 mb-6" data-testid="dashboard-anfragen-categories">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Anfragen nach Kategorie
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(stats?.anfragen?.by_category || {}).map(([cat, count]) => (
              <Link to={`/anfragen?category=${encodeURIComponent(cat)}`} key={cat} className="block">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-sm hover:bg-muted transition-colors cursor-pointer">
                  <span className="text-sm font-medium truncate mr-2">{cat}</span>
                  <span className="text-lg font-bold font-mono text-primary">{count}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Umsatz-Chart */}
        <Card className="p-6" data-testid="dashboard-revenue-chart">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Umsatz (letzte 6 Monate)
          </h3>
          {(stats?.monthly || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.monthly} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`} />
                <Bar dataKey="angebote" name="Angebote" fill="#14532D" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rechnungen" name="Rechnungen" fill="#F97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">Noch keine Daten vorhanden</p>
          )}
        </Card>

        {/* Rechnungsstatus-Chart */}
        <Card className="p-6" data-testid="dashboard-invoice-status">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Rechnungsstatus
          </h3>
          {stats?.invoices?.total > 0 ? (() => {
            const pieData = Object.entries(stats?.invoice_statuses || {}).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
            const COLORS = { Offen: "#f59e0b", Gesendet: "#3b82f6", Bezahlt: "#22c55e", "Überfällig": "#ef4444" };
            return (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={COLORS[entry.name] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[entry.name] || "#94a3b8" }} />
                        <span className="text-sm">{entry.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-sm">{entry.value}</span>
                    </div>
                  ))}
                  {(stats?.overdue_count || 0) > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <Link to="/invoices" className="text-sm text-red-600 flex items-center gap-1 hover:underline">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {stats.overdue_count} überfällig
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <p className="text-muted-foreground text-sm py-8 text-center">Noch keine Rechnungen vorhanden</p>
          )}
        </Card>

        {/* Neue Anfragen Widget */}
        <Card className="p-6" data-testid="dashboard-recent-anfragen">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            Letzte Anfragen
          </h3>
          {(stats?.anfragen?.recent || []).length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Keine Anfragen vorhanden</p>
          ) : (
            <div className="space-y-3">
              {(stats?.anfragen?.recent || []).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-sm border">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{a.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(a.categories || []).map((cat) => (
                        <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {new Date(a.created_at).toLocaleDateString("de-DE")}
                  </span>
                </div>
              ))}
              <Link to="/anfragen">
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  Alle Anfragen anzeigen <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Umsatzübersicht
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-sm">
              <span className="text-sm text-muted-foreground">Angebotswert</span>
              <span className="text-lg font-mono font-semibold">
                {(stats?.quotes?.total_value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-sm">
              <span className="text-sm text-muted-foreground">Rechnungswert</span>
              <span className="text-lg font-mono font-semibold">
                {(stats?.invoices?.total_value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-sm border border-green-200">
              <span className="text-sm text-green-800">Bezahlt</span>
              <span className="text-lg font-mono font-semibold text-green-700">
                {(stats?.invoices?.paid_value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Gestaffelte Übersicht */}
      <Card className="p-6 mt-6" data-testid="dashboard-overview">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Übersicht
          </h3>
          <div className="flex gap-1 bg-muted p-1 rounded-sm">
            {[
              { key: "anfragen", label: "Anfragen" },
              { key: "kunden", label: "Kunden" },
              { key: "leistungen", label: "Leistungen" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOverviewView(tab.key)}
                className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-all ${
                  overviewView === tab.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`overview-tab-${tab.key}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {overviewData && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">Gesamt: {overviewData.total}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(overviewData.groups || {}).map(([group, data]) => (
                <div key={group} className="border rounded-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{group}</span>
                    <span className="text-lg font-mono font-bold text-primary">{data.count}</span>
                  </div>
                  {(data.items || []).length > 0 && (
                    <div className="space-y-1">
                      {data.items.slice(0, 3).map((item, i) => (
                        <p key={i} className="text-xs text-muted-foreground truncate">
                          {item.name} {item.price_net ? `— ${item.price_net.toFixed(2)} €` : ""}
                        </p>
                      ))}
                      {data.items.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{data.items.length - 3} weitere</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};


export { DashboardPage };
