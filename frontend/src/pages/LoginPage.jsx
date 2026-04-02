import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { Button, Input, Card } from "@/components/common";
import { api, API } from "@/lib/api";

const LoginPage = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("Tischlerei Graupner");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const data = isRegister
        ? { username, password, company_name: companyName }
        : { username, password };
      const res = await axios.post(`${API}${endpoint}`, data);
      onLogin(res.data.token, res.data.username);
      toast.success(isRegister ? "Registrierung erfolgreich!" : "Willkommen zurück!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler bei der Anmeldung");
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
            <h2 className="text-4xl font-bold mb-4">Graupner Suite</h2>
            <p className="text-lg opacity-90">Ihre komplette Handwerker-Software</p>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-background">
        <Card className="w-full max-w-md p-6 lg:p-8">
          <div className="text-center mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-primary">
              {isRegister ? "Registrieren" : "Anmelden"}
            </h1>
            <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base">
              {isRegister ? "Erstellen Sie Ihr Konto" : "Willkommen zurück"}
            </p>
            <p className="lg:hidden text-xs text-muted-foreground mt-2">Graupner Suite</p>
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
              className="w-full"
              disabled={loading}
            >
              {loading ? "Laden..." : isRegister ? "Registrieren" : "Anmelden"}
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
