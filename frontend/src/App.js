import { useEffect, useMemo, useRef, useCallback } from "react";
import "@/App.css";
import { createBrowserRouter, RouterProvider, createRoutesFromElements, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/auth";
import { subscribeToPush } from "@/lib/push";
import { Sidebar, MobileNav, getUserRole } from "@/components/layout/Navigation";
import { WysiwygDocumentEditor } from "@/components/WysiwygDocumentEditor";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { EmailPage } from "@/pages/EmailPage";
import CustomerPortalPage from "@/pages/CustomerPortalPage";
import { KontaktModulPage } from "@/pages/KontaktModulPage";
import { ArtikelModulPage } from "@/pages/ArtikelModulPage";
import { DokumenteModulPage } from "@/pages/DokumenteModulPage";
import { TextvorlagenModulPage } from "@/pages/TextvorlagenModulPage";
import { KundenModulPage } from "@/pages/KundenModulPage";
import ModuleMailInboxPage from "@/pages/mail_inbox/ModuleMailInboxPage";
import { PortalsPage } from "@/pages/PortalsPage";
import PortalsKlonPage from "@/pages/PortalsKlonPage";
import { BuchhaltungPage } from "@/pages/BuchhaltungPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { MitarbeiterModulPage } from "@/pages/MitarbeiterModulPage";
import { EinsaetzeModulPage } from "@/pages/EinsaetzeModulPage";
import { RechnungenV2Page } from "@/pages/RechnungenV2Page";
import KundenLinkPage from "@/pages/KundenLinkPage";
import PopupShell from "@/pages/PopupShell";
import { MonteurAppPage } from "@/pages/monteur_app/MonteurAppPage";
import { MonteurEinsatzDetailPage } from "@/pages/monteur_app/MonteurEinsatzDetailPage";
import { HandyZugangPage } from "@/pages/handy_zugang/HandyZugangPage";
import { WissenPage } from "@/pages/wissen/WissenPage";
import { DokumenteV2Page } from "@/pages/dokumente_v2/DokumenteV2Page";
import { DokumenteV2DetailPage } from "@/pages/dokumente_v2/DokumenteV2DetailPage";
import { DuplikateModulPage } from "@/pages/DuplikateModulPage";
import { ProjekteListe } from "@/pages/projekte/ProjekteListe";
import ModuleAufgabenPage from "@/pages/aufgaben/ModuleAufgabenPage";
import ModuleTerminePage from "@/pages/termine/ModuleTerminePage";
import ModuleFeedbackPage from "@/pages/feedback/ModuleFeedbackPage";
import AssistentPage from "@/pages/assistent/AssistentPage";
import { ProjektDetail } from "@/pages/projekte/ProjektDetail";
import { ProjektWerkbank } from "@/pages/projekte/ProjektWerkbank";
import { HelpProvider } from "@/lib/helpContext";
import { HelpToggle } from "@/components/HelpToggle";
import { HealthBanner } from "@/components/HealthBanner";
import FeedbackWidget from "@/components/FeedbackWidget";
import TrashStartupCheck from "@/components/TrashStartupCheck";
import KundenLinkExpiryCheck from "@/components/KundenLinkExpiryCheck";
import { WindowManagerProvider } from "@/components/windows/WindowManager";
import { detectAppEnv } from "@/lib/env";

const MainLayout = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLogout={onLogout} />
      <MobileNav onLogout={onLogout} />
      <HelpToggle />
      <FeedbackWidget />
      <TrashStartupCheck />
      <KundenLinkExpiryCheck />
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <HealthBanner />
        <div className="px-4 lg:px-8 py-4 lg:py-8">{children}</div>
      </main>
    </div>
  );
};

function App() {
  const { login, logout, isAuthenticated } = useAuth();
  const role = getUserRole();
  const defaultPage = "/dashboard";

  // Tab-Titel und Favicon-Hinweis je Umgebung
  useEffect(() => {
    const env = detectAppEnv();
    if (env.kind === "preview") document.title = "🔵 Graupner Suite (PREVIEW)";
    else if (env.kind === "live") document.title = "🔴 Graupner Suite";
    else document.title = "Graupner Suite";
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      subscribeToPush();
    }
  }, [isAuthenticated]);

  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <HelpProvider>
      <WindowManagerProvider>
      <AppRouter isAuthenticated={isAuthenticated} login={login} logout={logout} defaultPage={defaultPage} />
      </WindowManagerProvider>
      </HelpProvider>
    </div>
  );
}

// Eigene Router-Komponente: Data-Router (createBrowserRouter) statt klassischem
// <BrowserRouter>. Das aktiviert useBlocker/usePrompt und damit den
// Datenverlust-Schutz im WysiwygDocumentEditor. Routes-Definition bleibt 1:1.
//
// WICHTIG: Der Router wird NUR von isAuthenticated abhaengig gemacht. login/
// logout/defaultPage werden ueber Refs durchgereicht, damit nicht bei jedem
// App-Render ein neuer Router entsteht und der gesamte Route-Tree (inkl.
// Dokument-Editor mit ungespeicherten Aenderungen!) remountet.
const AppRouter = ({ isAuthenticated, login, logout, defaultPage }) => {
  const loginRef = useRef(login);
  const logoutRef = useRef(logout);
  const defaultPageRef = useRef(defaultPage);
  useEffect(() => { loginRef.current = login; }, [login]);
  useEffect(() => { logoutRef.current = logout; }, [logout]);
  useEffect(() => { defaultPageRef.current = defaultPage; }, [defaultPage]);

  const doLogin = useCallback((...args) => loginRef.current(...args), []);
  const doLogout = useCallback((...args) => logoutRef.current(...args), []);
  const defaultPageFn = useCallback(() => defaultPageRef.current, []);

  const router = useMemo(() => createBrowserRouter(createRoutesFromElements(
    <Route>
      {/* Kundenportal (oeffentlich) */}
      <Route path="/portal/:token" element={<CustomerPortalPage />} />
      {/* Mitarbeiter-Kundenlink (oeffentlich, 30 Tage gueltig) */}
      <Route path="/m/:token" element={<KundenLinkPage />} />
      {!isAuthenticated ? (
        <Route path="*" element={<LoginPage onLogin={doLogin} />} />
      ) : (
        <>
          {/* Dashboard */}
          <Route path="/dashboard" element={<MainLayout onLogout={doLogout}><DashboardPage /></MainLayout>} />

          {/* Pop-Out-Fenster (eigene Browser-Fenster, ohne Sidebar — multi-monitor) */}
          <Route path="/popup/:type/:id" element={<PopupShell />} />
          <Route path="/popup/:type" element={<PopupShell />} />

          {/* Module */}
          <Route path="/module/kontakt" element={<MainLayout onLogout={doLogout}><KontaktModulPage /></MainLayout>} />
          <Route path="/module/kunden" element={<MainLayout onLogout={doLogout}><KundenModulPage /></MainLayout>} />
          <Route path="/module/mail-inbox" element={<MainLayout onLogout={doLogout}><ModuleMailInboxPage /></MainLayout>} />
          <Route path="/module/artikel" element={<MainLayout onLogout={doLogout}><ArtikelModulPage /></MainLayout>} />
          <Route path="/module/dokumente" element={<MainLayout onLogout={doLogout}><DokumenteModulPage /></MainLayout>} />
          {/* Sicherungskopie (v6) – verwendet bewusst dieselbe Komponente. Bleibt erhalten,
              damit jederzeit ein heiler Stand verfuegbar ist, falls am Hauptpfad weiter
              entwickelt wird. Wird per "Alt-Module ausblenden" versteckt. */}
          <Route path="/module/dokumente-v6" element={<MainLayout onLogout={doLogout}><DokumenteModulPage /></MainLayout>} />
          <Route path="/module/textvorlagen" element={<MainLayout onLogout={doLogout}><TextvorlagenModulPage /></MainLayout>} />

          {/* Dokument-Editor (Angebote/Auftraege/Rechnungen) */}
          <Route path="/quotes/new" element={<WysiwygDocumentEditor type="quote" />} />
          <Route path="/quotes/edit/:id" element={<WysiwygDocumentEditor type="quote" />} />
          <Route path="/orders/edit/:id" element={<WysiwygDocumentEditor type="order" />} />
          <Route path="/invoices/new" element={<WysiwygDocumentEditor type="invoice" />} />
          <Route path="/invoices/edit/:id" element={<WysiwygDocumentEditor type="invoice" />} />

          {/* E-Mail & Einstellungen */}
          <Route path="/email" element={<MainLayout onLogout={doLogout}><EmailPage /></MainLayout>} />
          <Route path="/portals" element={<MainLayout onLogout={doLogout}><PortalsPage /></MainLayout>} />
          <Route path="/portals-klon" element={<MainLayout onLogout={doLogout}><PortalsKlonPage /></MainLayout>} />
          <Route path="/buchhaltung" element={<MainLayout onLogout={doLogout}><BuchhaltungPage /></MainLayout>} />
          <Route path="/invoices" element={<MainLayout onLogout={doLogout}><InvoicesPage /></MainLayout>} />
          <Route path="/rechnungen-v2" element={<MainLayout onLogout={doLogout}><RechnungenV2Page /></MainLayout>} />
          {/* Monteur-App (mobile, eigenes Modul) */}
          <Route path="/monteur" element={<MainLayout onLogout={doLogout}><MonteurAppPage /></MainLayout>} />
          <Route path="/monteur/einsatz/:id" element={<MainLayout onLogout={doLogout}><MonteurEinsatzDetailPage /></MainLayout>} />
          <Route path="/handy-zugang" element={<MainLayout onLogout={doLogout}><HandyZugangPage /></MainLayout>} />
          <Route path="/wissen" element={<MainLayout onLogout={doLogout}><WissenPage /></MainLayout>} />
          <Route path="/dokumente-v2" element={<MainLayout onLogout={doLogout}><DokumenteV2Page /></MainLayout>} />
          <Route path="/dokumente-v2/:id" element={<MainLayout onLogout={doLogout}><DokumenteV2DetailPage /></MainLayout>} />
          <Route path="/module/duplikate" element={<MainLayout onLogout={doLogout}><DuplikateModulPage /></MainLayout>} />
          <Route path="/module/aufgaben" element={<MainLayout onLogout={doLogout}><ModuleAufgabenPage /></MainLayout>} />
          <Route path="/module/termine" element={<MainLayout onLogout={doLogout}><ModuleTerminePage /></MainLayout>} />
          <Route path="/module/feedback" element={<MainLayout onLogout={doLogout}><ModuleFeedbackPage /></MainLayout>} />
          <Route path="/module/assistent" element={<MainLayout onLogout={doLogout}><AssistentPage /></MainLayout>} />
          <Route path="/module/projekte" element={<MainLayout onLogout={doLogout}><ProjekteListe /></MainLayout>} />
          <Route path="/module/projekte/werkbank/:kunde_id" element={<MainLayout onLogout={doLogout}><ProjektWerkbank /></MainLayout>} />
          <Route path="/module/projekte/:id" element={<MainLayout onLogout={doLogout}><ProjektDetail /></MainLayout>} />
          <Route path="/mitarbeiter" element={<MainLayout onLogout={doLogout}><MitarbeiterModulPage /></MainLayout>} />
          <Route path="/einsaetze" element={<MainLayout onLogout={doLogout}><EinsaetzeModulPage /></MainLayout>} />
          <Route path="/settings" element={<MainLayout onLogout={doLogout}><SettingsPage /></MainLayout>} />

          {/* Fallback */}
          <Route path="/" element={<Navigate to={defaultPageFn()} replace />} />
          <Route path="*" element={<Navigate to={defaultPageFn()} replace />} />
        </>
      )}
    </Route>
  )), [isAuthenticated, doLogin, doLogout, defaultPageFn]);

  return <RouterProvider router={router} />;
};

export default App;
