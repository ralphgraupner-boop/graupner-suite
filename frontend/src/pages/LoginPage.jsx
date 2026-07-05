import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { Button, Input, Card } from "@/components/common";
import { api, API } from "@/lib/api";

const detectLoginEnv = () => {
  if (typeof window === "undefined") return { kind: "unknown", label: "Unbekannt", style: "slate" };
  const h = window.location.hostname;
  if (h.includes("preview") || h.includes("emergentagent.com")) {
    return { kind: "preview", label: "PREVIEW · TEST-UMGEBUNG", style: "blue" };
  }
  if (h.includes("85.215.145.155")) {
      return { kind: "live", label: "IONOS LIVE", style: "red" };
    }
    if (h.includes("emergent.host") || h.includes("graupner") || h === "localhost") {
    return { kind: "live", label: "LIVE · PRODUKTIV", style: "red" };
  }
  return { kind: "unknown", label: h, style: "slate" };
};

const ENV_STYLES = {
  blue: {
    banner: "bg-blue-50 border-blue-400 text-blue-900",
    dot: "bg-blue-500",
    btn: "!bg-blue-600 hover:!bg-blue-700 !text-white !border-blue-600",
  },
  red: {
    banner: "bg-red-50 border-red-400 text-red-900",
    dot: "bg-red-500",
    btn: "", // bleibt Standard
  },
  slate: {
    banner: "bg-slate-50 border-slate-400 text-slate-900",
    dot: "bg-slate-500",
    btn: "",
  },
};

const LoginPage = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("Tischlerei Graupner");
  const [loading, setLoading] = useState(false);
  const env = detectLoginEnv();
  const envStyle = ENV_STYLES[env.style] || ENV_STYLES.slate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const data = isRegister
        ? { username, password, company_name: companyName }
        : { username, password };
      const res = await axios.post(`${API}${endpoint}`, data, { timeout: 15000 });
      // Berechtigungen mit /auth/me laden und in User-Objekt mergen
      let berechtigungen = null;
      try {
        const meRes = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${res.data.token}` },
        });
        berechtigungen = meRes.data?.berechtigungen || null;
      } catch {}
      onLogin(res.data.token, {
        username: res.data.username,
        role: res.data.role,
        berechtigungen: berechtigungen || {},
      });
      toast.success(isRegister ? "Registrierung erfolgreich!" : "Willkommen zurueck!");
    } catch (err) {
      // 1) Echter Auth-Fehler (Passwort/Username falsch oder Konto gesperrt)
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        const detail = err.response?.data?.detail;
        toast.error(typeof detail === "string" && detail ? detail : "Benutzername oder Passwort falsch");
      }
      // 2) Validierung (z. B. fehlende Felder)
      else if (status === 400 || status === 422) {
        const detail = err.response?.data?.detail;
        toast.error(typeof detail === "string" && detail ? detail : "Ungueltige Eingabe");
      }
      // 3) Server-Fehler
      else if (status >= 500) {
        toast.error("Server-Fehler. Bitte in einigen Minuten erneut versuchen.");
      }
      // 4) Kein Status = Netzwerk-/Timeout-Problem = Server schlaeft vermutlich
      else if (err?.code === "ECONNABORTED" || err?.message === "Network Error" || !err?.response) {
        toast.error("Server wird gestartet — bitte 10–20 Sekunden warten und nochmal versuchen.", { duration: 6000 });
      }
      // 5) Sonstiges Fallback
      else {
        toast.error(err.response?.data?.detail || "Fehler bei der Anmeldung");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:block lg:w-1/2 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1755237449468-e70840025313?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwyfHxjYXJwZW50ZXIlMjB3b3JraW5nJTIwd29vZCUyMHdvcmtzaG9wJTIwZGV0YWlsZWR8ZW58MHx8fHwxNzczNzQwODAyfDA&ixlib=rb-4.1.0&q=85')`
        }}
      >
        <div className="h-full w-full bg-black/40 flex items-end p-12">
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-4">Graupner Suite 2.0</h2>
            <p className="text-lg opacity-90">Ihre komplette Handwerker-Software</p>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-background">
        <Card className="w-full max-w-md p-6 lg:p-8">
          <div className={`mb-4 px-3 py-2 border rounded-md flex items-center gap-2 text-xs font-bold ${envStyle.banner}`} data-testid="login-env-banner">
            <span className={`w-2 h-2 rounded-full ${envStyle.dot} animate-pulse`} />
            {env.label}
          </div>
          <div className="text-center mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-primary">
              {isRegister ? "Registrieren" : "Anmelden"}
            </h1>
            <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base">
              {isRegister ? "Erstellen Sie Ihr Konto" : "Willkommen zurück"}
            </p>
            <p className="lg:hidden text-xs text-muted-foreground mt-2">Graupner Suite 2.0</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Benutzername</label>
              <Input
                data-testid="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Passwort</label>
              <Input
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {isRegister && (
              <div>
                <label className="block text-sm font-medium mb-2">Firmenname</label>
                <Input
                  data-testid="input-company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Tischlerei Graupner"
                />
              </div>
            )}
            <Button
              type="submit"
              data-testid="btn-login"
              className={`w-full ${envStyle.btn}`}
              disabled={loading}
            >
              {loading ? "Laden..." : isRegister ? "Registrieren" : `Anmelden${env.kind === "preview" ? " (Preview)" : env.kind === "live" ? " (Live)" : ""}`}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-primary hover:underline"
            >
              {isRegister
                ? "Bereits registriert? Jetzt anmelden"
                : "Noch kein Konto? Jetzt registrieren"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};


export { LoginPage };
