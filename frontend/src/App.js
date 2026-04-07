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
import { AnfragenPage } from "@/pages/AnfragenPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { QuotesPage } from "@/pages/QuotesPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { ArtikelPage } from "@/pages/ArticlesPage";
import { EmailLogPage } from "@/pages/EmailLogPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { WebhookDocPage } from "@/pages/WebhookDocPage";
import { PortalsPage } from "@/pages/PortalsPage";
import CustomerPortalPage from "@/pages/CustomerPortalPage";
import { EinsaetzePage } from "@/pages/EinsaetzePage";
import { EmailPage } from "@/pages/EmailPage";
import { BuchhaltungPage } from "@/pages/BuchhaltungPage";

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
  const defaultPage = role === "buchhaltung" ? "/buchhaltung" : "/dashboard";

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
          {/* Public portal route */}
          <Route path="/portal/:token" element={<CustomerPortalPage />} />
          {!isAuthenticated ? (
            <Route path="*" element={<LoginPage onLogin={login} />} />
          ) : (
            <>
              {/* Shared routes (all roles) */}
              <Route path="/buchhaltung" element={<MainLayout onLogout={logout}><BuchhaltungPage /></MainLayout>} />
              <Route path="/customers" element={<MainLayout onLogout={logout}><CustomersPage readOnly={role === "buchhaltung"} /></MainLayout>} />
              <Route path="/orders" element={<MainLayout onLogout={logout}><OrdersPage readOnly={role === "buchhaltung"} /></MainLayout>} />
              <Route path="/invoices" element={<MainLayout onLogout={logout}><InvoicesPage readOnly={role === "buchhaltung"} /></MainLayout>} />
              <Route path="/mahnwesen" element={<MainLayout onLogout={logout}><InvoicesPage readOnly={role === "buchhaltung"} defaultTab="overdue" /></MainLayout>} />

              {/* Admin-only routes */}
              {role === "admin" && (
                <>
                  <Route path="/dashboard" element={<MainLayout onLogout={logout}><DashboardPage /></MainLayout>} />
                  <Route path="/customers/new" element={<MainLayout onLogout={logout}><CustomersPage /></MainLayout>} />
                  <Route path="/anfragen" element={<MainLayout onLogout={logout}><AnfragenPage /></MainLayout>} />
                  <Route path="/quotes" element={<MainLayout onLogout={logout}><QuotesPage /></MainLayout>} />
                  <Route path="/quotes/new" element={<WysiwygDocumentEditor type="quote" />} />
                  <Route path="/quotes/edit/:id" element={<WysiwygDocumentEditor type="quote" />} />
                  <Route path="/orders/edit/:id" element={<WysiwygDocumentEditor type="order" />} />
                  <Route path="/invoices/new" element={<WysiwygDocumentEditor type="invoice" />} />
                  <Route path="/invoices/edit/:id" element={<WysiwygDocumentEditor type="invoice" />} />
                  <Route path="/articles" element={<MainLayout onLogout={logout}><ArtikelPage /></MainLayout>} />
                  <Route path="/services" element={<Navigate to="/articles" replace />} />
                  <Route path="/email-log" element={<Navigate to="/email" replace />} />
                  <Route path="/posteingang" element={<Navigate to="/email" replace />} />
                  <Route path="/email" element={<MainLayout onLogout={logout}><EmailPage /></MainLayout>} />
                  <Route path="/settings" element={<MainLayout onLogout={logout}><SettingsPage /></MainLayout>} />
                  <Route path="/webhook" element={<MainLayout onLogout={logout}><WebhookDocPage /></MainLayout>} />
                  <Route path="/portals" element={<MainLayout onLogout={logout}><PortalsPage /></MainLayout>} />
                  <Route path="/einsaetze" element={<MainLayout onLogout={logout}><EinsaetzePage /></MainLayout>} />
                </>
              )}

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
