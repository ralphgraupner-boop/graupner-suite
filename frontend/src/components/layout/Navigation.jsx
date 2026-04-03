import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, FileText, ClipboardCheck, Receipt, Package, Settings, LogOut, Menu, Globe, Inbox, MailCheck, Share2 } from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/anfragen", icon: Inbox, label: "Anfragen" },
  { path: "/customers", icon: Users, label: "Kunden" },
  { path: "/quotes", icon: FileText, label: "Angebote" },
  { path: "/orders", icon: ClipboardCheck, label: "Aufträge" },
  { path: "/invoices", icon: Receipt, label: "Rechnungen" },
  { path: "/articles", icon: Package, label: "Artikel" },
  { path: "/portals", icon: Share2, label: "Kundenportale" },
  { path: "/email-log", icon: MailCheck, label: "E-Mail-Protokoll" },
  { path: "/webhook", icon: Globe, label: "Website-Integration" },
  { path: "/settings", icon: Settings, label: "Einstellungen" }
];

const mobileTabItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { path: "/anfragen", icon: Inbox, label: "Anfragen" },
  { path: "/customers", icon: Users, label: "Kunden" },
  { path: "/quotes", icon: FileText, label: "Angebote" },
];

const Sidebar = ({ onLogout }) => {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-card border-r flex-col z-30">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-primary">Graupner Suite</h1>
        <p className="text-sm text-muted-foreground mt-1">Tischlerei-Software</p>
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
          onClick={onLogout}
          data-testid="btn-logout"
          className="flex items-center gap-3 px-4 py-3 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm transition-smooth"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Abmelden</span>
        </button>
      </div>
    </aside>
  );
};

const MobileNav = ({ onLogout }) => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = navItems.filter(i => !mobileTabItems.find(t => t.path === i.path));

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b flex items-center justify-between px-4 z-30">
        <h1 className="text-lg font-bold text-primary">Graupner Suite</h1>
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="p-2 hover:bg-muted rounded-sm"
          data-testid="btn-mobile-menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-around items-center z-30 safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileTabItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            data-testid={`mobile-nav-${path.slice(1)}`}
            className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] ${
              location.pathname.startsWith(path)
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          data-testid="mobile-nav-more"
          className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] ${
            moreOpen ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mehr</span>
        </button>
      </nav>

      {/* More Menu Overlay */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-16 left-0 right-0 bg-card rounded-t-xl shadow-xl border-t p-4 space-y-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }} onClick={e => e.stopPropagation()}>
            {moreItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMoreOpen(false)}
                data-testid={`mobile-more-${path.slice(1)}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-sm ${
                  location.pathname.startsWith(path)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </Link>
            ))}
            <button
              onClick={() => { setMoreOpen(false); onLogout(); }}
              className="flex items-center gap-3 px-4 py-3 w-full text-destructive rounded-sm mt-2 border-t pt-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Abmelden</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};


export { Sidebar, MobileNav };
