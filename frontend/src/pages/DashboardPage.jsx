import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, FileText, ClipboardCheck, Receipt, ChevronRight, Euro, TrendingUp, TrendingDown, Clock, Eye, Inbox, Filter, AlertTriangle, MailOpen, FilePlus, Calendar, Bell, MapPin } from "lucide-react";
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
  const isBuchhaltung = user?.role === "buchhaltung";
  const isMonteur = !isAdmin && !isBuchhaltung;
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
  const [adminAufgaben, setAdminAufgaben] = useState([]);
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState("alle");
  const [team, setTeam] = useState([]);

  useEffect(() => {
    loadStats();
    loadMeine();
    loadAdminTeam();
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

  const loadAdminTeam = async () => {
    if (!isAdmin) return;
    try {
      const [tRes, aRes] = await Promise.all([
        api.get("/dashboard/team"),
        api.get("/module-aufgaben"),
      ]);
      setTeam(Array.isArray(tRes.data) ? tRes.data : []);
      const aList = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.items || []);
      setAdminAufgaben(aList.filter(a => a.status !== "erledigt"));
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

  const alertCount = (dueSoon.length) + (stats?.overdue_count || 0) + (followupQuotes.length) + (inboxStats.unread || 0) + (portalUnread.count || 0);
  const _norm = (s) => (s || "").trim().toLowerCase();
  const matchMitarbeiter = (val) => {
    if (selectedMitarbeiter === "alle") return true;
    const p = team.find(t => t.person === selectedMitarbeiter);
    if (!p) return false;
    return (p.aliases || []).map(_norm).includes(_norm(val));
  };
  const termineHeute = (stats?.termine?.heute || []).filter(t => matchMitarbeiter(t.monteur_username));
  const offeneAufgabenGefiltert = adminAufgaben.filter(a => matchMitarbeiter(a.zugewiesen_an));
  const meineTermineHeute = meineTermine.filter(t => (t.start || "").slice(0, 10) === new Date().toISOString().slice(0, 10));

  return (
    <div data-testid="dashboard-page">
      <div className="mb-6 lg:mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base flex items-center gap-1.5" data-testid="dashboard-date-location">
              <span className="capitalize">{new Date().toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              <span className="text-muted-foreground/50">·</span>
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Hamburg</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/module/kunden?filter=aktiv" data-testid="dashboard-kunden-button" className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-sm font-medium">
              <Users className="w-4 h-4 text-primary" /> Kunden
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">{stats?.kunden_aktiv?.total ?? stats?.customers_count ?? 0}</span>
            </Link>
            <AnfragenFetcherButton onFetched={() => { loadStats(); }} />
            <button
              type="button"
              data-testid="dashboard-bell-button"
              onClick={() => document.querySelector('[data-testid="dashboard-due-warnings"]')?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="relative flex items-center justify-center w-9 h-9 rounded-full border bg-card hover:bg-muted transition-colors"
              title="Hinweise anzeigen"
            >
              <Bell className="w-4 h-4 text-foreground" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold" data-testid="dashboard-bell-count">{alertCount}</span>
              )}
            </button>
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

      {/* ===== ADMIN-Ansicht: 4 Statistik-Karten + HEUTE-Timeline (Mockup Phase 1) ===== */}
      {isAdmin && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8" data-testid="admin-stat-cards">
        <HelpTip id="dashboard.stat-mahnwesen" block>
        <Link to="/module/dokumente?status=ueberfaellig" className="block" data-testid="stat-link-mahnwesen">
          <StatCard
            title="Mahnwesen"
            value={stats?.overdue_count || 0}
            subtitle="Rechnungen überfällig"
            icon={AlertTriangle}
            className="rounded-xl"
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
            className="rounded-xl"
          />
        </Link>
        </HelpTip>
        <HelpTip id="dashboard.stat-umsatz" block>
        <div data-testid="stat-link-umsatz">
          {(() => {
            const cur = stats?.revenue?.current_month_paid || 0;
            const last = stats?.revenue?.last_month_paid || 0;
            const showTrend = last >= 50;
            const diff = showTrend ? ((cur - last) / last) * 100 : null;
            const trend = !showTrend
              ? "bezahlt diesen Monat"
              : `Vormonat ${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%`;
            return (
              <StatCard
                title="Umsatz bezahlt"
                value={`${cur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`}
                subtitle={trend}
                icon={diff !== null && diff < 0 ? TrendingDown : TrendingUp}
                className="rounded-xl"
              />
            );
          })()}
        </div>
        </HelpTip>
        <HelpTip id="dashboard.stat-anfragen" block>
        <Link to="/module/mail-inbox" className="block" data-testid="stat-link-anfragen-admin">
          <StatCard
            title="Neue Anfragen"
            value={stats?.anfragen?.total || 0}
            subtitle="Neu / Offen"
            icon={Inbox}
            className="rounded-xl"
          />
        </Link>
        </HelpTip>
      </div>

      {/* Mitarbeiter-Umschalter: Alle · Ralph · Thorsten · Heike (Team-Konfig aus DB) */}
      {team.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap" data-testid="mitarbeiter-switcher">
          <span className="text-xs font-medium text-muted-foreground mr-1">Ansicht:</span>
          <button
            type="button"
            onClick={() => setSelectedMitarbeiter("alle")}
            data-testid="mitarbeiter-pill-alle"
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${selectedMitarbeiter === "alle" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
          >
            Alle
          </button>
          {team.map((t) => (
            <button
              key={t.person}
              type="button"
              onClick={() => setSelectedMitarbeiter(t.person)}
              data-testid={`mitarbeiter-pill-${t.person}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${selectedMitarbeiter === t.person ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
            >
              {t.person}
            </button>
          ))}
        </div>
      )}

      {/* HEUTE-Timeline */}
      <Card className="p-4 lg:p-6 mb-6 lg:mb-8 rounded-xl" data-testid="heute-timeline">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold tracking-wider text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> HEUTE
          </h3>
          <Link to="/module/termine" className="text-xs font-medium text-primary hover:underline flex items-center gap-1" data-testid="heute-alle-termine">
            Alle Termine <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {termineHeute.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="heute-empty">Keine Termine heute.</p>
        ) : (
          <ul className="space-y-2.5">
            {termineHeute.map((t) => {
              const detail = [t.monteur_username, t.kunde_name || t.ort].filter(Boolean).join(" · ");
              return (
                <li key={t.id} className="flex items-center gap-3" data-testid={`heute-termin-${t.id}`}>
                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono font-semibold tabular-nums">
                    {t.uhrzeit || "—"}
                  </span>
                  <div className="min-w-0 flex-1 border-b border-border/40 pb-2.5 -mb-2.5 last:border-0">
                    <p className="text-sm font-medium truncate">{t.titel}</p>
                    {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Offene Aufgaben (gefiltert nach Mitarbeiter-Umschalter) */}
      <Card className="p-4 lg:p-6 mb-6 lg:mb-8 rounded-xl" data-testid="admin-aufgaben">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold tracking-wider text-muted-foreground flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" /> OFFENE AUFGABEN
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{offeneAufgabenGefiltert.length}</span>
          </h3>
          <Link to="/module/aufgaben" className="text-xs font-medium text-primary hover:underline flex items-center gap-1" data-testid="aufgaben-alle">
            Alle Aufgaben <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {offeneAufgabenGefiltert.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="aufgaben-empty">Keine offenen Aufgaben.</p>
        ) : (
          <ul className="space-y-2">
            {offeneAufgabenGefiltert.slice(0, 8).map((a) => {
              const ueberfaellig = a.faellig_am && new Date(a.faellig_am) < new Date(new Date().toDateString());
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 pb-2 last:border-0" data-testid={`aufgabe-${a.id}`}>
                  <span className="truncate">{a.titel}</span>
                  {a.faellig_am && (
                    <span className={`text-xs shrink-0 ${ueberfaellig ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                      {new Date(a.faellig_am).toLocaleDateString("de-DE")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      </>
      )}

      {/* ===== BUCHHALTUNG (Heike): nur Finanz-Kennzahlen ===== */}
      {isBuchhaltung && (
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 lg:gap-6 mb-6 lg:mb-8" data-testid="buchhaltung-cards">
        <Link to="/module/dokumente?status=offen" className="block" data-testid="stat-link-unbezahlt">
          <StatCard
            title="Unbezahlte Rechnungen"
            value={stats?.invoices?.unpaid || 0}
            subtitle={`Gesamt: ${stats?.invoices?.total || 0}`}
            icon={Receipt}
            className="rounded-xl"
          />
        </Link>
        <Link to="/module/dokumente?status=ueberfaellig" className="block" data-testid="stat-link-faellig">
          <StatCard
            title="Fällige Zahlungen"
            value={(stats?.overdue_count || 0) + (dueSoon.length || 0)}
            subtitle={`${stats?.overdue_count || 0} überfällig · ${dueSoon.length || 0} bald fällig`}
            icon={AlertTriangle}
            className="rounded-xl"
          />
        </Link>
      </div>
      )}

      {isMonteur && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" data-testid="meine-aufgaben-termine">
          <Card className="p-6 rounded-xl" data-testid="meine-aufgaben">
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
          <Card className="p-6 rounded-xl" data-testid="meine-termine">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Meine Termine heute ({meineTermineHeute.length})
            </h3>
            {meineTermineHeute.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Termine heute.</p>
            ) : (
              <ul className="space-y-2">
                {meineTermineHeute.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm border-b pb-2 last:border-0">
                    <span className="truncate">{t.titel}</span>
                    {t.start && <span className="text-xs text-muted-foreground shrink-0">{(t.start.split("T")[1] || "").slice(0,5) || new Date(t.start).toLocaleDateString("de-DE")}</span>}
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

      {/* Gestaffelte Übersicht — nur Admin (Chef-Cockpit) */}
      {isAdmin && (
      <Card className="p-6 mt-6 rounded-xl" data-testid="dashboard-overview">
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
      )}
    </div>
  );
};


export { DashboardPage };
