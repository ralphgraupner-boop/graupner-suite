import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { PortalsPage } from "@/pages/PortalsPage";
import { BuchhaltungPage } from "@/pages/BuchhaltungPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { MitarbeiterModulPage } from "@/pages/MitarbeiterModulPage";
import { EinsaetzeModulPage } from "@/pages/EinsaetzeModulPage";
import { RechnungenV2Page } from "@/pages/RechnungenV2Page";
import { PortalV2AdminPage } from "@/pages/portal_v2/PortalV2AdminPage";
import { PortalV2DetailPage } from "@/pages/portal_v2/PortalV2DetailPage";
import { PortalV2LoginPage } from "@/pages/portal_v2/PortalV2LoginPage";
import { PortalV2CustomerPage } from "@/pages/portal_v2/PortalV2CustomerPage";
import { PortalV3AdminPage } from "@/pages/portal_v3/PortalV3AdminPage";
import { PortalV3DetailPage } from "@/pages/portal_v3/PortalV3DetailPage";
import { PortalV3LoginPage } from "@/pages/portal_v3/PortalV3LoginPage";
import { PortalV3CustomerPage } from "@/pages/portal_v3/PortalV3CustomerPage";
import { PortalV4AdminPage } from "@/pages/portal_v4/PortalV4AdminPage";
import { PortalV4DetailPage } from "@/pages/portal_v4/PortalV4DetailPage";
import { PortalV4LoginPage } from "@/pages/portal_v4/PortalV4LoginPage";
import { PortalV4CustomerPage } from "@/pages/portal_v4/PortalV4CustomerPage";
import { MonteurAppPage } from "@/pages/monteur_app/MonteurAppPage";
import { MonteurEinsatzDetailPage } from "@/pages/monteur_app/MonteurEinsatzDetailPage";
import { HandyZugangPage } from "@/pages/handy_zugang/HandyZugangPage";
import { WissenPage } from "@/pages/wissen/WissenPage";
import { DokumenteV2Page } from "@/pages/dokumente_v2/DokumenteV2Page";
import { DokumenteV2DetailPage } from "@/pages/dokumente_v2/DokumenteV2DetailPage";
import { DuplikateModulPage } from "@/pages/DuplikateModulPage";
import { HelpProvider } from "@/lib/helpContext";
import { HelpToggle } from "@/components/HelpToggle";

const MainLayout = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLogout={onLogout} />
      <MobileNav onLogout={onLogout} />
      <HelpToggle />
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 px-4 lg:px-8 py-4 lg:py-8">{children}</main>
    </div>
  );
};

function App() {
  const { login, logout, isAuthenticated } = useAuth();
  const role = getUserRole();
  const defaultPage = "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      subscribeToPush();
    }
  }, [isAuthenticated]);

  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <HelpProvider>
      <BrowserRouter>
        <Routes>
          {/* Kundenportal (oeffentlich) */}
          <Route path="/portal/:token" element={<CustomerPortalPage />} />
          {/* Kundenportal v2 (oeffentlich) */}
          <Route path="/portal-v2/login" element={<PortalV2LoginPage />} />
          <Route path="/portal-v2/login/:token" element={<PortalV2LoginPage />} />
          <Route path="/portal-v2/app" element={<PortalV2CustomerPage />} />
          {/* Kundenportal v3 (oeffentlich, Test) */}
          <Route path="/portal-v3/login" element={<PortalV3LoginPage />} />
          <Route path="/portal-v3/login/:token" element={<PortalV3LoginPage />} />
          <Route path="/portal-v3/app" element={<PortalV3CustomerPage />} />
          {/* Kundenportal v4 (oeffentlich, Test mit Dokumente-Anbindung) */}
          <Route path="/portal-v4/login" element={<PortalV4LoginPage />} />
          <Route path="/portal-v4/login/:token" element={<PortalV4LoginPage />} />
          <Route path="/portal-v4/app" element={<PortalV4CustomerPage />} />
          {!isAuthenticated ? (
            <Route path="*" element={<LoginPage onLogin={login} />} />
          ) : (
            <>
              {/* Dashboard */}
              <Route path="/dashboard" element={<MainLayout onLogout={logout}><DashboardPage /></MainLayout>} />

              {/* Module */}
              <Route path="/module/kontakt" element={<MainLayout onLogout={logout}><KontaktModulPage /></MainLayout>} />
              <Route path="/module/kunden" element={<MainLayout onLogout={logout}><KundenModulPage /></MainLayout>} />
              <Route path="/module/artikel" element={<MainLayout onLogout={logout}><ArtikelModulPage /></MainLayout>} />
              <Route path="/module/dokumente" element={<MainLayout onLogout={logout}><DokumenteModulPage /></MainLayout>} />
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
              <Route path="/buchhaltung" element={<MainLayout onLogout={logout}><BuchhaltungPage /></MainLayout>} />
              <Route path="/invoices" element={<MainLayout onLogout={logout}><InvoicesPage /></MainLayout>} />
              <Route path="/rechnungen-v2" element={<MainLayout onLogout={logout}><RechnungenV2Page /></MainLayout>} />
              <Route path="/portal-v2" element={<MainLayout onLogout={logout}><PortalV2AdminPage /></MainLayout>} />
              <Route path="/portal-v2/detail/:id" element={<MainLayout onLogout={logout}><PortalV2DetailPage /></MainLayout>} />
              <Route path="/portal-v3" element={<MainLayout onLogout={logout}><PortalV3AdminPage /></MainLayout>} />
              <Route path="/portal-v3/detail/:id" element={<MainLayout onLogout={logout}><PortalV3DetailPage /></MainLayout>} />
              <Route path="/portal-v4" element={<MainLayout onLogout={logout}><PortalV4AdminPage /></MainLayout>} />
              <Route path="/portal-v4/detail/:id" element={<MainLayout onLogout={logout}><PortalV4DetailPage /></MainLayout>} />
              {/* Monteur-App (mobile, eigenes Modul) */}
              <Route path="/monteur" element={<MainLayout onLogout={logout}><MonteurAppPage /></MainLayout>} />
              <Route path="/monteur/einsatz/:id" element={<MainLayout onLogout={logout}><MonteurEinsatzDetailPage /></MainLayout>} />
              <Route path="/handy-zugang" element={<MainLayout onLogout={logout}><HandyZugangPage /></MainLayout>} />
              <Route path="/wissen" element={<MainLayout onLogout={logout}><WissenPage /></MainLayout>} />
              <Route path="/dokumente-v2" element={<MainLayout onLogout={logout}><DokumenteV2Page /></MainLayout>} />
              <Route path="/dokumente-v2/:id" element={<MainLayout onLogout={logout}><DokumenteV2DetailPage /></MainLayout>} />
              <Route path="/module/duplikate" element={<MainLayout onLogout={logout}><DuplikateModulPage /></MainLayout>} />
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
      </HelpProvider>
    </div>
  );
}

export default App;
