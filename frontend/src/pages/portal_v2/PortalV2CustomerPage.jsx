import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/portal-v2`;

/**
 * Portal v2 – Kunden-Ansicht nach Login
 * Phase 3: nur Begrüßung + Logout. Nachrichten/Uploads folgen in Phase 4+5.
 */
export function PortalV2CustomerPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("portal_v2_session");
    if (!session) {
      navigate("/portal-v2/login");
      return;
    }
    const run = async () => {
      try {
        const res = await fetch(`${API}/me`, {
          headers: { Authorization: `Bearer ${session}` },
        });
        if (!res.ok) {
          localStorage.removeItem("portal_v2_session");
          localStorage.removeItem("portal_v2_account");
          navigate("/portal-v2/login");
          return;
        }
        const data = await res.json();
        setAccount(data);
      } catch {
        navigate("/portal-v2/login");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("portal_v2_session");
    localStorage.removeItem("portal_v2_account");
    navigate("/portal-v2/login");
  };

  const anredeBrief = (name) => {
    const clean = (name || "").trim();
    if (!clean) return "Herzlich willkommen";
    const parts = clean.split(/\s+/);
    const last = parts[parts.length - 1];
    if (clean.startsWith("Herr ")) return `Sehr geehrter Herr ${last}`;
    if (clean.startsWith("Frau ")) return `Sehr geehrte Frau ${last}`;
    return `Hallo ${clean}`;
  };

  if (loading || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="text-sm text-muted-foreground">Lade…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]" data-testid="portal-v2-customer-page">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-lg text-[#14532D]">Kundenportal</h1>
            <p className="text-xs text-muted-foreground">Tischlerei R.Graupner</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm hidden sm:block">
              <div className="font-medium">{account.name}</div>
              <div className="text-xs text-muted-foreground">{account.email}</div>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
              data-testid="portal-v2-logout"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#14532D]/10 text-[#14532D]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{anredeBrief(account.name)}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Willkommen in Ihrem persönlichen Kundenportal.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 text-sm text-muted-foreground">
          <p>
            In den nächsten Ausbau-Stufen können Sie hier direkt mit uns Nachrichten austauschen,
            Fotos von Ihrem Vorhaben hochladen und Dokumente einsehen.
          </p>
        </div>
      </main>
    </div>
  );
}

export default PortalV2CustomerPage;
