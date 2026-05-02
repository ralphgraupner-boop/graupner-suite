import { useState, useEffect, useRef, Fragment } from "react";
import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, FileText, ClipboardCheck, Receipt, Package, Settings, LogOut, Menu, Globe, Inbox, Share2, Wrench, MailOpen, Landmark, AlertTriangle, UserCheck, Download, HardHat, Smartphone, BookOpen, Eye, Copy, Folder, Briefcase, Calendar, GripVertical, ArrowUpDown, RotateCcw, Check, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { HelpTip } from "@/components/HelpTip";
import { detectAppEnv, ENV_BADGE_CLASSES } from "@/lib/env";

const APP_ENV = detectAppEnv();

const allNavItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin"] },
  { path: "/module/kunden", icon: Users, label: "Kunden", roles: ["admin"] },
  { path: "/module/mail-inbox", icon: Inbox, label: "Mail-Anfragen", roles: ["admin"], variant: "new" },
  { path: "/module/duplikate", icon: Copy, label: "Duplikate", roles: ["admin"], variant: "new", parentPath: "/settings" },
  { path: "/module/projekte", icon: Folder, label: "Projekte", roles: ["admin"], variant: "new" },
  { path: "/module/aufgaben", icon: Briefcase, label: "Aufgaben", roles: ["admin", "mitarbeiter", "buchhaltung"], variant: "new" },
  { path: "/module/termine", icon: Calendar, label: "Termine", roles: ["admin"], variant: "new" },
  { path: "/einsaetze", icon: Wrench, label: "Einsaetze", roles: ["admin"] },
  { path: "/module/artikel", icon: Package, label: "Artikel & Leistungen", roles: ["admin"], parentPath: "/settings" },
  { path: "/module/dokumente", icon: FileText, label: "Dokumente", roles: ["admin"], variant: "deprecated", hideByDefault: true },
  { path: "/dokumente-v2", icon: FileText, label: "Dokumente", roles: ["admin"], variant: "new" },
  { path: "/module/textvorlagen", icon: FileText, label: "Textvorlagen", roles: ["admin"], parentPath: "/settings" },
  { path: "/portals", icon: Share2, label: "Kundenportale", roles: ["admin"] },
  { path: "/portals-klon", icon: Globe, label: "Kundenportale (Arbeitskopie)", roles: ["admin"], variant: "new" },
  { path: "/portal-v2", icon: Users, label: "Kundenportal (alt)", roles: ["admin"], variant: "deprecated", hideByDefault: true },
  { path: "/portal-v3", icon: Users, label: "Kundenportal (Test)", roles: ["admin"], variant: "sandbox", hideByDefault: true },
  { path: "/portal-v4", icon: Users, label: "Kundenportal v4 (Sandbox)", roles: ["admin"], variant: "sandbox", hideByDefault: true },
  { path: "/monteur", icon: HardHat, label: "Monteur-App", roles: ["admin", "mitarbeiter", "buchhaltung"], variant: "new" },
  { path: "/handy-zugang", icon: Smartphone, label: "Handy-Zugang", roles: ["admin"], parentPath: "/settings" },
  { path: "/wissen", icon: BookOpen, label: "Wissen & Tipps", roles: ["admin"], parentPath: "/settings" },
  { path: "/buchhaltung", icon: Landmark, label: "Buchhaltung", roles: ["admin", "buchhaltung"] },
  { path: "/invoices", icon: Receipt, label: "Rechnungen", roles: ["admin", "buchhaltung"], hideByDefault: true },
  { path: "/rechnungen-v2", icon: Receipt, label: "Rechnungen (Neu)", roles: ["admin"], featureFlag: "rechnungen_v2", hideByDefault: true },
  { path: "/email", icon: MailOpen, label: "E-Mail", roles: ["admin"], featureFlag: "email_module_enabled" },
  { path: "/settings", icon: Settings, label: "Einstellungen", roles: ["admin"], hasChildren: true },
];

const getUserRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (user && typeof user === "object") return user.role || "admin";
    return "admin";
  } catch { return "admin"; }
};

const getFilteredNavItems = () => {
  const role = getUserRole();
  let flags = {};
  try { flags = JSON.parse(localStorage.getItem("feature_flags") || "{}"); } catch { /* ignore */ }
  // Aufgeräumt-Modus: blendet standardmäßig alle Module mit hideByDefault=true aus.
  // Aktivieren über localStorage.setItem("show_legacy_modules", "1") oder Einstellungen.
  let showLegacy = false;
  try { showLegacy = localStorage.getItem("show_legacy_modules") === "1"; } catch { /* ignore */ }
  return allNavItems.filter(item => {
    if (!item.roles.includes(role)) return false;
    if (item.featureFlag && !flags[item.featureFlag]) return false;
    if (item.hideByDefault && !showLegacy) return false;
    return true;
  });
};

/** Kinder-Items (parentPath gesetzt) werden aus der Top-Liste herausgefiltert
 *  und stattdessen als Kinder unter ihrem Parent angezeigt. */
const getChildren = (allItems, parentPath) => allItems.filter(i => i.parentPath === parentPath);

const Sidebar = ({ onLogout }) => {
  const location = useLocation();
  const allFilteredItems = getFilteredNavItems();
  const baseNavItems = allFilteredItems.filter(i => !i.parentPath); // ohne Kinder-Einträge
  const role = getUserRole();
  const username = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "null"); return typeof u === "object" ? u.username : u; } catch { return ""; } })();
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ email: 0, portal: 0, termine_go: 0 });
  const prevEmailRef = useRef(0);
  const [openedParents, setOpenedParents] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("nav_opened_parents") || "[]")); } catch { return new Set(); }
  });
  const toggleParent = (path) => {
    setOpenedParents(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      try { localStorage.setItem("nav_opened_parents", JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  // ----- Sidebar-Reihenfolge (per User in DB gespeichert) -----
  const [sortMode, setSortMode] = useState(false);
  const [customOrder, setCustomOrder] = useState([]);  // Pfade in gewünschter Reihenfolge
  const [draggedPath, setDraggedPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);

  // Initial-Load der User-Prefs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/module-user-prefs/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Array.isArray(data.sidebar_order)) setCustomOrder(data.sidebar_order);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sortierte Sidebar-Items (custom_order zuerst, Rest in Original-Reihenfolge ans Ende)
  const navItems = (() => {
    if (!customOrder.length) return baseNavItems;
    const byPath = new Map(baseNavItems.map(i => [i.path, i]));
    const ordered = customOrder.map(p => byPath.get(p)).filter(Boolean);
    const orderedSet = new Set(ordered.map(i => i.path));
    const rest = baseNavItems.filter(i => !orderedSet.has(i.path));
    // Neue Items (rest) werden direkt nach ihrem natürlichen Vorgänger in baseNavItems
    // eingefügt, statt ganz unten zu landen. So sieht der User sie sofort.
    if (rest.length === 0) return ordered;
    const out = [...ordered];
    for (const newItem of rest) {
      const origIdx = baseNavItems.findIndex(i => i.path === newItem.path);
      // Finde den nächsten Nachbarn aus baseNavItems der schon in out ist
      let inserted = false;
      for (let k = origIdx - 1; k >= 0; k--) {
        const prevPath = baseNavItems[k].path;
        const pos = out.findIndex(i => i.path === prevPath);
        if (pos !== -1) {
          out.splice(pos + 1, 0, newItem);
          inserted = true;
          break;
        }
      }
      if (!inserted) out.unshift(newItem);
    }
    return out;
  })();

  const persistOrder = async (newOrder) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/module-user-prefs/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({ sidebar_order: newOrder }),
      });
    } catch { /* ignore – UI bleibt trotzdem aktuell */ }
  };

  const handleDragStart = (path) => (e) => {
    if (!sortMode) return;
    setDraggedPath(path);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (path) => (e) => {
    if (!sortMode || !draggedPath) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPath(path);
  };
  const handleDragLeave = () => setDragOverPath(null);
  const handleDrop = (targetPath) => (e) => {
    if (!sortMode || !draggedPath) return;
    e.preventDefault();
    if (draggedPath === targetPath) { setDraggedPath(null); setDragOverPath(null); return; }
    const order = navItems.map(i => i.path);
    const fromIdx = order.indexOf(draggedPath);
    const toIdx = order.indexOf(targetPath);
    if (fromIdx === -1 || toIdx === -1) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, draggedPath);
    setCustomOrder(order);
    setDraggedPath(null);
    setDragOverPath(null);
    persistOrder(order);
  };

  const resetOrder = async () => {
    if (!window.confirm("Standard-Reihenfolge wiederherstellen?")) return;
    setCustomOrder([]);
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/module-user-prefs/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
    } catch { /* ignore */ }
  };
  // ----- Ende Sidebar-Reihenfolge -----

  // Poll fuer ungelesene E-Mails und Portal-Aktivitaeten
  useEffect(() => {
    let cancelled = false;
    // Feature-Flag pruefen: wenn E-Mail-Modul aus -> KEINE IMAP-Calls im Hintergrund
    let emailModuleEnabled = false;
    try {
      const flags = JSON.parse(localStorage.getItem("feature_flags") || "{}");
      emailModuleEnabled = !!flags.email_module_enabled;
    } catch { /* ignore */ }

    const fetchCounts = async () => {
      try {
        const calls = [
          api.get("/portals/unread-count").catch(() => ({ data: { count: 0 } })),
          api.get("/module-termine/wartet-auf-go").catch(() => ({ data: { count: 0 } })),
        ];
        if (emailModuleEnabled) {
          calls.unshift(api.get("/imap/inbox/stats").catch(() => ({ data: { unread: 0 } })));
        }
        const results = await Promise.all(calls);
        if (cancelled) return;
        const emailCount = emailModuleEnabled ? (results[0].data?.unread || 0) : 0;
        const portalIdx = emailModuleEnabled ? 1 : 0;
        const portalCount = results[portalIdx].data?.count || 0;
        const terminGoCount = results[portalIdx + 1].data?.count || 0;
        // Sound bei neuer Mail spielen (nur wenn Anzahl gestiegen)
        if (emailModuleEnabled && emailCount > prevEmailRef.current && prevEmailRef.current !== 0) {
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch { /* ignore */ }
        }
        prevEmailRef.current = emailCount;
        setUnreadCounts({ email: emailCount, portal: portalCount, termine_go: terminGoCount });
      } catch { /* ignore */ }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    const onFocus = () => fetchCounts();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, []);

  const handleLogoutClick = () => {
    setShowBackupDialog(true);
  };

  const handleBackupAndLogout = async () => {
    setIsCreatingBackup(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = response.headers.get('Content-Disposition')?.split('filename=')[1] || 
                        `Graupner_Backup_${new Date().toISOString().slice(0,10)}.zip`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Kurze Verzögerung damit Download startet
        setTimeout(() => {
          setShowBackupDialog(false);
          onLogout();
        }, 500);
      } else {
        alert('Backup fehlgeschlagen. Möchten Sie trotzdem abmelden?');
        setShowBackupDialog(false);
        onLogout();
      }
    } catch (error) {
      alert('Backup fehlgeschlagen. Möchten Sie trotzdem abmelden?');
      setShowBackupDialog(false);
      onLogout();
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleLogoutWithoutBackup = () => {
    setShowBackupDialog(false);
    onLogout();
  };

  return (
    <>
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-card border-r flex-col z-30">
      <div className="p-6 border-b">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-primary">Graupner Suite</h1>
              {APP_ENV.kind !== "unknown" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold tracking-wider ${ENV_BADGE_CLASSES[APP_ENV.color]}`} data-testid="sidebar-env-badge">
                  {APP_ENV.short}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Tischlerei-Software</p>
          </div>
          <button
            onClick={() => setSortMode(s => !s)}
            className={`p-1.5 rounded-sm border transition-colors flex-shrink-0 ${
              sortMode
                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={sortMode ? "Sortieren beenden" : "Reihenfolge ändern"}
            data-testid="btn-sidebar-sort-toggle"
          >
            {sortMode ? <Check className="w-4 h-4" /> : <ArrowUpDown className="w-4 h-4" />}
          </button>
        </div>
        {role === "buchhaltung" && (
          <div className="mt-2 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-sm font-medium" data-testid="role-badge">
            Buchhaltung – {username}
          </div>
        )}
        {sortMode && (
          <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-sm text-xs text-emerald-900" data-testid="sort-mode-hint">
            <strong>Sortier-Modus aktiv.</strong> Einträge per Drag &amp; Drop verschieben.
            <button
              onClick={resetOrder}
              className="mt-1 flex items-center gap-1 text-emerald-700 hover:text-emerald-900 underline"
              data-testid="btn-sidebar-sort-reset"
            >
              <RotateCcw className="w-3 h-3" /> Standard wiederherstellen
            </button>
          </div>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label, variant, hasChildren }) => {
          const children = hasChildren ? getChildren(allFilteredItems, path) : [];
          const isOpen = openedParents.has(path);
          const badgeCount = path === "/email"
            ? unreadCounts.email
            : (path === "/portals"
                ? unreadCounts.portal
                : (path === "/module/termine" ? unreadCounts.termine_go : 0));
          const isActive = location.pathname.startsWith(path);
          const hasBadge = badgeCount > 0 && !isActive;
          const helpKey = `nav.${path.split("/").filter(Boolean).pop()}`;
          const isDeprecated = variant === "deprecated";
          const isNew = variant === "new";
          const isSandbox = variant === "sandbox";
          return (
            <Fragment key={path}>
            <div
              draggable={sortMode}
              onDragStart={handleDragStart(path)}
              onDragOver={handleDragOver(path)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(path)}
              className={`${sortMode ? "cursor-move" : ""} ${dragOverPath === path && draggedPath !== path ? "ring-2 ring-emerald-400 rounded-sm" : ""} ${draggedPath === path ? "opacity-40" : ""}`}
              data-testid={`nav-row-${path.slice(1)}`}
            >
            <HelpTip id={helpKey} placement="right" block>
              {sortMode ? (
                <div
                  data-testid={`nav-${path.slice(1)}`}
                  className={`relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-sm bg-muted/40 border border-dashed border-muted-foreground/30 select-none`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <Icon className="w-4 h-4 text-foreground/70 flex-shrink-0" />
                  <span className="text-foreground/80">{label}</span>
                </div>
              ) : (
              <Link
                to={path}
                data-testid={`nav-${path.slice(1)}`}
                className={`relative flex items-center gap-2.5 px-3 py-2 text-sm rounded-sm transition-smooth ${
                  isActive
                    ? (isNew
                        ? "bg-emerald-100 text-emerald-800 border-l-4 border-emerald-600 shadow-sm"
                        : "bg-primary/10 text-primary border-l-2 border-primary")
                    : isDeprecated
                    ? "text-muted-foreground/60 italic hover:bg-muted hover:text-muted-foreground line-through decoration-muted-foreground/40"
                    : isNew
                    ? "text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/70 border-l-4 border-emerald-300 font-medium"
                    : isSandbox
                    ? "text-amber-700 hover:bg-amber-50 border-l-2 border-dashed border-amber-300"
                    : hasBadge
                    ? "text-foreground bg-red-50 hover:bg-red-100 animate-pulse-slow"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="relative shrink-0">
                  <Icon className={`w-4 h-4 ${hasBadge ? "text-red-600" : isNew ? "text-emerald-600" : ""}`} />
                  {hasBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold animate-pulse ring-2 ring-background" data-testid={`badge-${path.slice(1)}`}>
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </div>
                <span className={`${hasBadge ? "text-red-700 font-medium" : ""}`}>{label}</span>
                {isNew && !isActive && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white tracking-wider">NEU</span>
                )}
                {isDeprecated && (
                  <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 tracking-wider">ALT</span>
                )}
                {isSandbox && !isActive && (
                  <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 tracking-wider border border-amber-300">TEST</span>
                )}
                {hasBadge && !isNew && !isDeprecated && !isSandbox && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
                {hasChildren && children.length > 0 && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleParent(path); }}
                    className="ml-auto p-0.5 hover:bg-black/5 rounded-sm"
                    data-testid={`btn-toggle-${path.slice(1)}`}
                    aria-label={isOpen ? "Zuklappen" : "Aufklappen"}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
              </Link>
              )}
            </HelpTip>
            </div>
            {hasChildren && isOpen && children.length > 0 && (
              <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2" data-testid={`children-${path.slice(1)}`}>
                {children.map((c) => {
                  const CIcon = c.icon;
                  const cActive = location.pathname.startsWith(c.path);
                  return (
                    <Link
                      key={c.path}
                      to={c.path}
                      className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-smooth ${cActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      data-testid={`nav-child-${c.path.slice(1)}`}
                    >
                      <CIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{c.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
            </Fragment>
          );
        })}
      </nav>
      <div className="p-4 border-t space-y-1">
        <button
          onClick={() => {
            try {
              const cur = localStorage.getItem("show_legacy_modules") === "1";
              localStorage.setItem("show_legacy_modules", cur ? "0" : "1");
              window.location.reload();
            } catch { /* ignore */ }
          }}
          data-testid="btn-toggle-legacy"
          className="flex items-center gap-3 px-4 py-2 w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm transition-smooth"
          title="Alt-Module (Dokumente alt, Kundenportale alt, Sandbox v3/v4) ein-/ausblenden"
        >
          <Eye className="w-4 h-4" />
          <span>
            {typeof window !== "undefined" && window.localStorage?.getItem("show_legacy_modules") === "1"
              ? "Alt-Module ausblenden"
              : "Alt-Module einblenden"}
          </span>
        </button>
        <button
          onClick={handleLogoutClick}
          data-testid="btn-logout"
          className="flex items-center gap-3 px-4 py-3 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm transition-smooth"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Abmelden</span>
        </button>
      </div>
    </aside>

    {/* Backup Dialog */}
    {showBackupDialog && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBackupDialog(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Backup vor dem Abmelden?
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Möchten Sie vor dem Abmelden ein Backup Ihrer Daten erstellen? Dies sichert alle Anfragen, Kunden, Rechnungen und Einstellungen.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleBackupAndLogout}
              disabled={isCreatingBackup}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isCreatingBackup ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Erstelle Backup...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Backup & Abmelden
                </>
              )}
            </button>
            <button
              onClick={handleLogoutWithoutBackup}
              disabled={isCreatingBackup}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Ohne Backup abmelden
            </button>
          </div>
          <button
            onClick={() => setShowBackupDialog(false)}
            disabled={isCreatingBackup}
            className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Abbrechen
          </button>
        </div>
      </div>
    )}
  </>
  );
};

const MobileNav = ({ onLogout }) => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const navItems = getFilteredNavItems();
  const role = getUserRole();

  const handleLogoutClick = () => {
    setMoreOpen(false);
    setShowBackupDialog(true);
  };

  const handleBackupAndLogout = async () => {
    setIsCreatingBackup(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = response.headers.get('Content-Disposition')?.split('filename=')[1] || 
                        `Graupner_Backup_${new Date().toISOString().slice(0,10)}.zip`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setTimeout(() => {
          setShowBackupDialog(false);
          onLogout();
        }, 500);
      } else {
        setShowBackupDialog(false);
        onLogout();
      }
    } catch (error) {
      setShowBackupDialog(false);
      onLogout();
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleLogoutWithoutBackup = () => {
    setShowBackupDialog(false);
    onLogout();
  };

  const mobileTabItems = role === "buchhaltung"
    ? [
        { path: "/buchhaltung", icon: Landmark, label: "Buchhaltung" },
        { path: "/invoices", icon: Receipt, label: "Rechnungen" },
        { path: "/orders", icon: ClipboardCheck, label: "Aufträge" },
        { path: "/module/kunden", icon: Users, label: "Kunden" },
      ]
    : [
        { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
        { path: "/module/kunden", icon: Users, label: "Kunden" },
        { path: "/module/dokumente", icon: FileText, label: "Dokumente" },
        { path: "/module/kontakt", icon: Download, label: "Kontakte" },
      ];

  const moreItems = navItems.filter(i => !mobileTabItems.find(t => t.path === i.path));

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-1.5 min-w-0">
          <h1 className="text-lg font-bold text-primary">Graupner Suite</h1>
          {APP_ENV.kind !== "unknown" && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold tracking-wider ${ENV_BADGE_CLASSES[APP_ENV.color]}`} data-testid="mobile-env-badge">
              {APP_ENV.short}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {role === "buchhaltung" && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm font-medium">Buchhaltung</span>}
          <button onClick={() => setMoreOpen(!moreOpen)} className="p-2 hover:bg-muted rounded-sm" data-testid="btn-mobile-menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-around items-center z-30 safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileTabItems.map(({ path, icon: Icon, label }) => (
          <Link key={path} to={path} data-testid={`mobile-nav-${path.slice(1)}`}
            className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] ${location.pathname.startsWith(path) ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className="w-5 h-5" /><span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
        <button onClick={() => setMoreOpen(!moreOpen)} data-testid="mobile-nav-more"
          className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] ${moreOpen ? "text-primary" : "text-muted-foreground"}`}>
          <Menu className="w-5 h-5" /><span className="text-[10px] font-medium">Mehr</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-16 left-0 right-0 bg-card rounded-t-xl shadow-xl border-t p-4 space-y-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }} onClick={e => e.stopPropagation()}>
            {moreItems.map(({ path, icon: Icon, label }) => (
              <Link key={path} to={path} onClick={() => setMoreOpen(false)} data-testid={`mobile-more-${path.slice(1)}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-sm ${location.pathname.startsWith(path) ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Icon className="w-5 h-5" /><span className="font-medium">{label}</span>
              </Link>
            ))}
            <button onClick={handleLogoutClick}
              className="flex items-center gap-3 px-4 py-3 w-full text-destructive rounded-sm mt-2 border-t pt-4">
              <LogOut className="w-5 h-5" /><span className="font-medium">Abmelden</span>
            </button>
          </div>
        </div>
      )}

      {/* Backup Dialog für Mobile */}
      {showBackupDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isCreatingBackup && setShowBackupDialog(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Backup vor dem Abmelden?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Möchten Sie vor dem Abmelden ein Backup Ihrer Daten erstellen? Dies sichert alle Anfragen, Kunden, Rechnungen und Einstellungen.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleBackupAndLogout}
                disabled={isCreatingBackup}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isCreatingBackup ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Erstelle Backup...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Backup & Abmelden
                  </>
                )}
              </button>
              <button
                onClick={handleLogoutWithoutBackup}
                disabled={isCreatingBackup}
                className="px-4 py-3 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Ohne Backup abmelden
              </button>
              <button
                onClick={() => setShowBackupDialog(false)}
                disabled={isCreatingBackup}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { Sidebar, MobileNav, getUserRole };
