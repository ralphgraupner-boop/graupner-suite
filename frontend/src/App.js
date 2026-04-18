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

const MainLayout = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLogout={onLogout} />
      <MobileNav onLogout={onLogout} />
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
      <BrowserRouter>
        <Routes>
          {/* Kundenportal (oeffentlich) */}
          <Route path="/portal/:token" element={<CustomerPortalPage />} />
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
    </div>
  );
}

export default App;
