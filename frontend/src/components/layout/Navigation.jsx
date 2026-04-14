import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, FileText, ClipboardCheck, Receipt, Package, Settings, LogOut, Menu, Globe, Inbox, Share2, Wrench, MailOpen, Landmark, AlertTriangle, UserCheck, Download } from "lucide-react";

const allNavItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin"] },
  { path: "/anfragen", icon: Inbox, label: "Anfragen", roles: ["admin"] },
  { path: "/email", icon: MailOpen, label: "E-Mail", roles: ["admin"] },
  { path: "/einsaetze", icon: Wrench, label: "Einsatzplanung", roles: ["admin"] },
  { path: "/customers", icon: Users, label: "Kunden", roles: ["admin", "buchhaltung"] },
  { path: "/quotes", icon: FileText, label: "Angebote", roles: ["admin"] },
  { path: "/orders", icon: ClipboardCheck, label: "Aufträge", roles: ["admin", "buchhaltung"] },
  { path: "/invoices", icon: Receipt, label: "Rechnungen", roles: ["admin", "buchhaltung"] },
  { path: "/buchhaltung", icon: Landmark, label: "Buchhaltung", roles: ["admin", "buchhaltung"] },
  { path: "/mahnwesen", icon: AlertTriangle, label: "Mahnwesen", roles: ["admin", "buchhaltung"] },
  { path: "/mitarbeiter", icon: UserCheck, label: "Mitarbeiter", roles: ["admin", "buchhaltung"] },
  { path: "/articles", icon: Package, label: "Artikel", roles: ["admin"] },
  { path: "/portals", icon: Share2, label: "Kundenportale", roles: ["admin"] },
  { path: "/webhook", icon: Globe, label: "Website-Integration", roles: ["admin"] },
  { path: "/settings", icon: Settings, label: "Einstellungen", roles: ["admin"] },
  { path: "/module/kontakt", icon: Download, label: "Kontakt-Modul", roles: ["admin"] },
  { path: "/module/angebote", icon: FileText, label: "Angebots-Modul", roles: ["admin"] },
  { path: "/module/artikel", icon: Package, label: "Artikel & Leistungen", roles: ["admin"] }
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
  return allNavItems.filter(item => item.roles.includes(role));
};

const Sidebar = ({ onLogout }) => {
  const location = useLocation();
  const navItems = getFilteredNavItems();
  const role = getUserRole();
  const username = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "null"); return typeof u === "object" ? u.username : u; } catch { return ""; } })();
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

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
        <h1 className="text-2xl font-bold text-primary">Graupner Suite</h1>
        <p className="text-sm text-muted-foreground mt-1">Tischlerei-Software</p>
        {role === "buchhaltung" && (
          <div className="mt-2 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-sm font-medium" data-testid="role-badge">
            Buchhaltung – {username}
          </div>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            data-testid={`nav-${path.slice(1)}`}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-smooth ${
              location.pathname.startsWith(path)
                ? "bg-primary/10 text-primary border-l-2 border-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
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
        { path: "/customers", icon: Users, label: "Kunden" },
      ]
    : [
        { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
        { path: "/anfragen", icon: Inbox, label: "Anfragen" },
        { path: "/customers", icon: Users, label: "Kunden" },
        { path: "/quotes", icon: FileText, label: "Angebote" },
      ];

  const moreItems = navItems.filter(i => !mobileTabItems.find(t => t.path === i.path));

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b flex items-center justify-between px-4 z-30">
        <h1 className="text-lg font-bold text-primary">Graupner Suite</h1>
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
