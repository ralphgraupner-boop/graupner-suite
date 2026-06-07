import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, FileText, ClipboardCheck, Receipt, ChevronRight, Euro, TrendingUp, TrendingDown, Clock, Eye, Inbox, Filter, AlertTriangle, MailOpen, FilePlus, Calendar, Wrench } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { HelpTip } from "@/components/HelpTip";
import { Button, Card, StatCard } from "@/components/common";
import { AnfragenFetcherButton } from "@/components/AnfragenFetcherButton";
import { api, API } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DashboardPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dueSoon, setDueSoon] = useState([]);
  const [followupQuotes, setFollowupQuotes] = useState([]);
  const [overviewView, setOverviewView] = useState("anfragen");
  const [overviewData, setOverviewData] = useState(null);
  const [inboxStats, setInboxStats] = useState({ unread: 0, total: 0 });
  const [portalUnread, setPortalUnread] = useState({ count: 0, items: [] });
  const [meineAufgaben, setMeineAufgaben] = useState([]);
  const [meineTermine, setMeineTermine] = useState([]);

  useEffect(() => {
    loadStats();
    loadMeine();
    checkDueInvoices();
    checkFollowups();
    loadInboxStats();
    loadPortalUnread();

    // Auto-Refresh jede Stunde
    const interval = setInterval(() => {
      loadStats();
      loadInboxStats();
      loadPortalUnread();
    }, 3600000);
    // Kurz-Refresh fuer Portal-Benachrichtigungen alle 60s
    const portalInterval = setInterval(() => {
      loadPortalUnread();
    }, 60000);
    return () => { clearInterval(interval); clearInterval(portalInterval); };
  }, []);

  // Refresh wenn Benutzer zur Seite zurueckkehrt (z.B. von Kunden-Modul)
  useEffect(() => {
    const handleFocus = () => { loadStats(); loadInboxStats(); loadPortalUnread(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadInboxStats = async () => {
    // Feature-Flag pruefen: wenn E-Mail-Modul aus -> keine IMAP-Calls
    try {
      const flags = JSON.parse(localStorage.getItem("feature_flags") || "{}");
      if (!flags.email_module_enabled) {
        setInboxStats({ unread: 0 });
        return;
      }
    } catch { /* ignore */ }
    try {
      const res = await api.get("/imap/inbox/stats");
      setInboxStats(res.data);
    } catch { /* ignore */ }
  };

  const loadPortalUnread = async () => {
    try {
      const res = await api.get("/portals/unread-count");
      setPortalUnread(res.data || { count: 0, items: [] });
    } catch { /* ignore */ }
  };

  const loadMeine = async () => {
    if (isAdmin || !user?.username) return;
    try {
      const [aRes, tRes] = await Promise.all([
        api.get("/module-aufgaben"),
        api.get("/module-termine"),
      ]);
      const aList = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.items || []);
      const tList = Array.isArray(tRes.data) ? tRes.data : (tRes.data?.items || []);
      setMeineAufgaben(aList.filter(a => a.zugewiesen_an === user.username && a.status !== "erledigt"));
      setMeineTermine(tList.filter(t => t.monteur_username === user.username && t.status !== "abgesagt"));
    } catch { /* ignore */ }
  };

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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base">Übersicht Ihrer Geschäftstätigkeit</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/module/kunden?filter=aktiv" data-testid="dashboard-kunden-button" className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-sm font-medium">
              <Users className="w-4 h-4 text-primary" /> Kunden
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">{stats?.kunden_aktiv?.total ?? stats?.customers_count ?? 0}</span>
            </Link>
            <AnfragenFetcherButton onFetched={() => { loadStats(); }} />
          </div>
        </div>
      </div>

      {/* Kompakte Hinweisleiste */}
      {(dueSoon.length > 0 || (stats?.overdue_count || 0) > 0 || followupQuotes.length > 0 || inboxStats.unread > 0 || portalUnread.count > 0) && (
        <div className="mb-4 lg:mb-6 flex flex-wrap gap-2" data-testid="dashboard-due-warnings">
          {portalUnread.count > 0 && (
            <Link to="/portals" className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200/60 rounded-full hover:bg-blue-100 transition-colors group" data-testid="dashboard-portal-hint" title={portalUnread.items?.map(p => p.customer_name).filter(Boolean).join(", ")}>
              <span className="relative flex items-center">
                <span className="absolute -left-0.5 -top-0.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <Users className="w-3.5 h-3.5 text-blue-600 ml-1" />
              </span>
              <span className="text-xs font-medium text-blue-800">
                {portalUnread.count} neue{portalUnread.count !== 1 ? "" : ""} Kundenportal-Mitteilung{portalUnread.count !== 1 ? "en" : ""}
              </span>
              <span className="text-[10px] text-blue-600 group-hover:text-blue-700 font-medium">Anzeigen</span>
            </Link>
          )}
          {inboxStats.unread > 0 && (() => {
            let flags = {};
            try { flags = JSON.parse(localStorage.getItem("feature_flags") || "{}"); } catch { /* ignore */ }
            if (!flags.email_module_enabled) return null;
            return (
              <Link to="/email" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200/60 rounded-full hover:bg-emerald-100 transition-colors group" data-testid="dashboard-inbox-hint">
                <MailOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-800">
                  {inboxStats.unread} unbearbeitete E-Mail{inboxStats.unread !== 1 ? "s" : ""} im Posteingang
                </span>
                <span className="text-[10px] text-emerald-600 group-hover:text-emerald-700 font-medium">Anzeigen</span>
              </Link>
            );
          })()}
          {isAdmin && dueSoon.length > 0 && (
            <Link to="/invoices" className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200/60 rounded-full hover:bg-amber-100 transition-colors group">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-xs font-medium text-amber-800">
                {dueSoon.length === 1
                  ? `${dueSoon[0].invoice_number} wird ${dueSoon[0].days_until_due === 0 ? "heute" : `in ${dueSoon[0].days_until_due} Tag(en)`} fällig`
                  : `${dueSoon.length} Rechnungen bald fällig`}
              </span>
              <span className="text-[10px] text-amber-600 group-hover:text-amber-700 font-medium">Anzeigen</span>
            </Link>
          )}
          {isAdmin && (stats?.overdue_count || 0) > 0 && (
            <Link to="/invoices" className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200/60 rounded-full hover:bg-red-100 transition-colors group">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs font-medium text-red-800">{stats.overdue_count} Rechnung(en) überfällig</span>
              <span className="text-[10px] text-red-600 group-hover:text-red-700 font-medium">Mahnwesen</span>
            </Link>
          )}
          {isAdmin && followupQuotes.length > 0 && (
            <Link to="/quotes" className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200/60 rounded-full hover:bg-blue-100 transition-colors group">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-xs font-medium text-blue-800">
                {followupQuotes.length === 1
                  ? `${followupQuotes[0].quote_number} wartet seit ${followupQuotes[0].days_since_created || "7+"} Tagen`
                  : `${followupQuotes.length} Angebote ohne Rückmeldung`}
              </span>
              <span className="text-[10px] text-blue-600 group-hover:text-blue-700 font-medium">Wiedervorlage</span>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-6 mb-6 lg:mb-8">
        <HelpTip id="dashboard.stat-anfragen" block>
        <Link to="/module/mail-inbox" className="block" data-testid="stat-link-anfragen">
          <StatCard
            title="Mailanfragen"
            value={stats?.anfragen?.total || 0}
            subtitle="Neu / Offen"
            icon={Inbox}
          />
        </Link>
        </HelpTip>
        <HelpTip id="dashboard.stat-kunden" block>
        <Link to="/module/kunden?filter=aktiv" className="block" data-testid="stat-link-kunden">
          <StatCard
            title="Kunden aktiv"
            value={stats?.kunden_aktiv?.total ?? stats?.customers_count ?? 0}
            subtitle={stats?.kunden_aktiv?.archiviert ? `+${stats.kunden_aktiv.archiviert} archiviert` : null}
            icon={Users}
          />
        </Link>
        </HelpTip>
        <HelpTip id="dashboard.stat-quotes" block>
        <Link to="/module/dokumente" className="block" data-testid="stat-link-angebote">
          <StatCard
            title="Offene Angebote"
            value={stats?.quotes?.open || 0}
            subtitle={`Gesamt: ${stats?.quotes?.total || 0}`}
            icon={FileText}
          />
        </Link>
        </HelpTip>
        <HelpTip id="dashboard.stat-orders" block>
        <Link to="/module/dokumente" className="block" data-testid="stat-link-auftraege">
          <StatCard
            title="Offene Aufträge"
            value={stats?.orders?.open || 0}
            subtitle={`Gesamt: ${stats?.orders?.total || 0}`}
            icon={ClipboardCheck}
          />
        </Link>
        </HelpTip>
        {isAdmin && (
        <HelpTip id="dashboard.stat-invoices" block>
        <Link to="/module/dokumente" className="block" data-testid="stat-link-rechnungen">
          <StatCard
            title="Unbezahlte Rechnungen"
            value={stats?.invoices?.unpaid || 0}
            subtitle={`Gesamt: ${stats?.invoices?.total || 0}`}
            icon={Receipt}
          />
        </Link>
        </HelpTip>
        )}
      </div>

      {/* Status-Kacheln (Cockpit) — Stand 06.05.2026 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-6 mb-6 lg:mb-8" data-testid="status-tiles">
        {isAdmin && (
        <Link to="/module/dokumente?status=ueberfaellig" className="block" data-testid="stat-link-overdue">
          <StatCard
            title="Überfällig"
            value={stats?.overdue_count || 0}
            subtitle="Rechnungen > 30 Tage"
            icon={AlertTriangle}
          />
        </Link>
        )}
        {isAdmin && (
        <Link to="/module/dokumente?status=entwurf" className="block" data-testid="stat-link-drafts">
          <StatCard
            title="In Arbeit"
            value={stats?.invoices?.drafts || 0}
            subtitle="Rechnungs-Entwürfe"
            icon={FilePlus}
          />
        </Link>
        )}
        {isAdmin && (
        <div data-testid="stat-revenue-month">
          {(() => {
            const cur = stats?.revenue?.current_month || 0;
            const last = stats?.revenue?.last_month || 0;
            const diff = last > 0 ? ((cur - last) / last) * 100 : null;
            const trend = diff === null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%`;
            return (
              <StatCard
                title="Umsatz / Monat"
                value={`${cur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`}
                subtitle={`Vormonat: ${trend}`}
                icon={diff !== null && diff < 0 ? TrendingDown : TrendingUp}
              />
            );
          })()}
        </div>
        )}
        <Link to="/einsaetze" className="block" data-testid="stat-link-einsaetze">
          <StatCard
            title="Aktive Aufträge"
            value={stats?.orders?.open || 0}
            subtitle="Offene Einsätze"
            icon={Wrench}
          />
        </Link>
        {isAdmin && (
        <Link to="/module/termine" className="block" data-testid="stat-link-termine">
          <StatCard
            title="Termine heute"
            value={stats?.termine?.today || 0}
            subtitle={`${stats?.termine?.next_7_days || 0} in 7 Tagen`}
            icon={Calendar}
          />
        </Link>
        )}
      </div>

      {!isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" data-testid="meine-aufgaben-termine">
          <Card className="p-6" data-testid="meine-aufgaben">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" /> Meine offenen Aufgaben ({meineAufgaben.length})
            </h3>
            {meineAufgaben.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Aufgaben.</p>
            ) : (
              <ul className="space-y-2">
                {meineAufgaben.slice(0, 8).map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm border-b pb-2 last:border-0">
                    <span className="truncate">{a.titel}</span>
                    {a.faellig_am && <span className="text-xs text-muted-foreground shrink-0">{new Date(a.faellig_am).toLocaleDateString("de-DE")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-6" data-testid="meine-termine">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Meine Termine ({meineTermine.length})
            </h3>
            {meineTermine.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Termine.</p>
            ) : (
              <ul className="space-y-2">
                {meineTermine.slice(0, 8).map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm border-b pb-2 last:border-0">
                    <span className="truncate">{t.titel}</span>
                    {t.start && <span className="text-xs text-muted-foreground shrink-0">{new Date(t.start).toLocaleDateString("de-DE")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* "Letzte Anfragen"-Liste entfernt: Dashboard ist Status-Cockpit (Ralph 06.05.2026).
          Anfragen-Verwaltung passiert ausschließlich im Mail-Inbox-Modul. */}

      {isAdmin && (
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

        {/* "Letzte Anfragen"-Seitenwidget entfernt — siehe Hinweis oben.
            Anfragen werden ausschließlich im Mail-Inbox-Modul verwaltet. */}

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
      )}

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
