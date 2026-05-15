import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogIn, Lock, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/portal-v3`;

/**
 * Portal v3 – Login-Seite (öffentlich)
 * Variante 1: Token aus URL-Parameter → Preflight liefert Email/Name
 * Variante 2: ohne Token → klassischer Email-Login
 */
export function PortalV3LoginPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!token);
  const [submitting, setSubmitting] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        const res = await fetch(`${API}/login/preflight`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.detail || "Einladungslink ist ungültig oder abgelaufen.");
        } else {
          const data = await res.json();
          setAccountInfo(data);
        }
      } catch {
        setError("Verbindung fehlgeschlagen.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error("Passwort erforderlich");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const body = token
        ? { token, password }
        : { email: email.trim().toLowerCase(), password };
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Login fehlgeschlagen");
        return;
      }
      localStorage.setItem("portal_v3_session", data.session);
      localStorage.setItem("portal_v3_account", JSON.stringify(data.account));
      navigate("/portal-v3/app");
    } catch {
      setError("Verbindung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="text-sm text-muted-foreground">Lade Einladung…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafaf8] px-4" data-testid="portal-v3-login-page">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#14532D]/10 text-[#14532D]">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold mt-3">Kundenportal</h1>
          <p className="text-sm text-muted-foreground">Tischlerei R.Graupner</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm" data-testid="portal-v3-login-error">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {accountInfo && (
          <div className="p-3 rounded-lg bg-[#14532D]/5 border border-[#14532D]/20 text-sm">
            <div className="text-xs uppercase text-muted-foreground tracking-wide mb-1">Anmeldung als</div>
            <div className="font-medium">{accountInfo.name}</div>
            <div className="text-xs text-muted-foreground">{accountInfo.email}</div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {!token && (
            <label className="block">
              <span className="text-xs text-muted-foreground">E-Mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14532D]/30"
                data-testid="portal-v3-login-email"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" /> Passwort
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14532D]/30"
              data-testid="portal-v3-login-password"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-[#14532D] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            data-testid="portal-v3-login-submit"
          >
            {submitting ? "Anmelden…" : "Anmelden"}
          </button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          Probleme beim Anmelden? Bitte kontaktieren Sie uns unter
          <br />
          <a href="mailto:service24@tischlerei-graupner.de" className="text-[#14532D]">
            service24@tischlerei-graupner.de
          </a>
        </p>
      </div>
    </div>
  );
}

export default PortalV3LoginPage;
