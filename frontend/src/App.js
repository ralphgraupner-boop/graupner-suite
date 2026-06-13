import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/auth";
import { subscribeToPush } from "@/lib/push";
import { ThemeProvider } from "@/lib/themeContext";
import { Sidebar, MobileNav, getUserRole } from "@/components/layout/Navigation";
import { WysiwygDocumentEditor } from "@/components/WysiwygDocumentEditor";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { EmailPage } from "@/pages/EmailPage";
import CustomerPortalPage from "@/pages/CustomerPortalPage";
import SnoozePage from "@/pages/SnoozePage";
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
import { HelpSlideOver } from "@/components/HelpSlideOver";
import { HealthBanner } from "@/components/HealthBanner";
import FeedbackWidget from "@/components/FeedbackWidget";
import TrashStartupCheck from "@/components/TrashStartupCheck";
import KundenLinkExpiryCheck from "@/components/KundenLinkExpiryCheck";
import { WolkePopover } from "@/components/wolke/WolkePopover";
import { EinsatzFloatingButton } from "@/components/EinsatzFloatingButton";
import { WindowManagerProvider } from "@/components/windows/WindowManager";
import { detectAppEnv } from "@/lib/env";

const MainLayout = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLogout={onLogout} />
      <MobileNav onLogout={onLogout} />
      <HelpSlideOver />
      <FeedbackWidget />
      <TrashStartupCheck />
      <KundenLinkExpiryCheck />
      <WolkePopover />
      <EinsatzFloatingButton />
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
  // Phase 1 Rollen-Konzept: Monteur/Mitarbeiter landen direkt in der Monteur-App,
  // alle anderen Rollen (admin, buchhaltung, ...) wie bisher auf dem Dashboard.
  const defaultPage = (role === "monteur" || role === "mitarbeiter") ? "/monteur" : "/dashboard";

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
      <ThemeProvider>
      <HelpProvider>
      <WindowManagerProvider>
      <BrowserRouter>
        <Routes>
          {/* Kundenportal (oeffentlich) */}
          <Route path="/portal/:token" element={<CustomerPortalPage />} />
          {/* Mitarbeiter-Kundenlink (oeffentlich, 30 Tage gueltig) */}
          <Route path="/m/:token" element={<KundenLinkPage />} />
          {/* Snooze-Seite (oeffentlich, Auth via push_token) */}
          <Route path="/snooze" element={<SnoozePage />} />
          {!isAuthenticated ? (
            <Route path="*" element={<LoginPage onLogin={login} />} />
          ) : (
            <>
              {/* Dashboard */}
              <Route path="/dashboard" element={<MainLayout onLogout={logout}><DashboardPage /></MainLayout>} />

              {/* Pop-Out-Fenster (eigene Browser-Fenster, ohne Sidebar — multi-monitor) */}
              <Route path="/popup/:type/:id" element={<PopupShell />} />
              <Route path="/popup/:type" element={<PopupShell />} />

              {/* Module */}
              <Route path="/module/kontakt" element={<MainLayout onLogout={logout}><KontaktModulPage /></MainLayout>} />
              <Route path="/module/kunden" element={<MainLayout onLogout={logout}><KundenModulPage /></MainLayout>} />
              <Route path="/module/mail-inbox" element={<MainLayout onLogout={logout}><ModuleMailInboxPage /></MainLayout>} />
              <Route path="/module/artikel" element={<MainLayout onLogout={logout}><ArtikelModulPage /></MainLayout>} />
              <Route path="/module/dokumente" element={<MainLayout onLogout={logout}><DokumenteModulPage /></MainLayout>} />
              {/* Sicherungskopie (v6) – verwendet bewusst dieselbe Komponente. Bleibt erhalten,
                  damit jederzeit ein heiler Stand verfuegbar ist, falls am Hauptpfad weiter
                  entwickelt wird. Wird per "Alt-Module ausblenden" versteckt. */}
              <Route path="/module/dokumente-v6" element={<MainLayout onLogout={logout}><DokumenteModulPage /></MainLayout>} />
              <Route path="/module/textvorlagen" element={<MainLayout onLogout={logout}><TextvorlagenModulPage /></MainLayout>} />

              {/* Dokument-Editor (Angebote/Auftraege/Rechnungen) */}
              <Route path="/quotes/new" element={<WysiwygDocumentEditor type="quote" />} />
              <Route path="/quotes/edit/:id" element={<WysiwygDocumentEditor type="quote" />} />
              <Route path="/orders/edit/:id" element={<WysiwygDocumentEditor type="order" />} />
              <Route path="/invoices/new" element={<WysiwygDocumentEditor type="invoice" />} />
              <Route path="/invoices/edit/:id" element={<WysiwygDocumentEditor type="invoice" />} />

              {/* E-Mail & Einstellungen */}
              <Route path="/email" element={<MainLayout onLogout={logout}><EmailPage /></MainLayout>} />
              <Route path="/portals" element={<MainLayout onLogout={logout}><PortalsPage /></MainLayout>} />
              <Route path="/portals-klon" element={<MainLayout onLogout={logout}><PortalsKlonPage /></MainLayout>} />
              <Route path="/buchhaltung" element={<MainLayout onLogout={logout}><BuchhaltungPage /></MainLayout>} />
              <Route path="/invoices" element={<MainLayout onLogout={logout}><InvoicesPage /></MainLayout>} />
              <Route path="/rechnungen-v2" element={<MainLayout onLogout={logout}><RechnungenV2Page /></MainLayout>} />
              {/* Monteur-App (mobile, eigenes Modul) */}
              <Route path="/monteur" element={<MainLayout onLogout={logout}><MonteurAppPage /></MainLayout>} />
              <Route path="/monteur/einsatz/:id" element={<MainLayout onLogout={logout}><MonteurEinsatzDetailPage /></MainLayout>} />
              <Route path="/handy-zugang" element={<MainLayout onLogout={logout}><HandyZugangPage /></MainLayout>} />
              <Route path="/wissen" element={<MainLayout onLogout={logout}><WissenPage /></MainLayout>} />
              <Route path="/dokumente-v2" element={<MainLayout onLogout={logout}><DokumenteV2Page /></MainLayout>} />
              <Route path="/dokumente-v2/:id" element={<MainLayout onLogout={logout}><DokumenteV2DetailPage /></MainLayout>} />
              <Route path="/module/duplikate" element={<MainLayout onLogout={logout}><DuplikateModulPage /></MainLayout>} />
              <Route path="/module/aufgaben" element={<MainLayout onLogout={logout}><ModuleAufgabenPage /></MainLayout>} />
              <Route path="/module/termine" element={<MainLayout onLogout={logout}><ModuleTerminePage /></MainLayout>} />
              <Route path="/module/feedback" element={<MainLayout onLogout={logout}><ModuleFeedbackPage /></MainLayout>} />
              <Route path="/module/assistent" element={<MainLayout onLogout={logout}><AssistentPage /></MainLayout>} />
              <Route path="/module/projekte" element={<MainLayout onLogout={logout}><ProjekteListe /></MainLayout>} />
              <Route path="/module/projekte/werkbank/:kunde_id" element={<MainLayout onLogout={logout}><ProjektWerkbank /></MainLayout>} />
              <Route path="/module/projekte/:id" element={<MainLayout onLogout={logout}><ProjektDetail /></MainLayout>} />
              <Route path="/mitarbeiter" element={<MainLayout onLogout={logout}><MitarbeiterModulPage /></MainLayout>} />
              <Route path="/einsaetze" element={<MainLayout onLogout={logout}><EinsaetzeModulPage /></MainLayout>} />
              <Route path="/settings" element={<MainLayout onLogout={logout}><SettingsPage /></MainLayout>} />

              {/* Fallback */}
              <Route path="/" element={<Navigate to={defaultPage} replace />} />
              <Route path="*" element={<Navigate to={defaultPage} replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
      </WindowManagerProvider>
      </HelpProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
