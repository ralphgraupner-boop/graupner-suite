import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, Users, FileText, ClipboardCheck, Receipt, Package,
  Settings, LogOut, Plus, Mic, MicOff, Download, Mail, Trash2, Edit,
  ChevronRight, Euro, TrendingUp, Clock, CheckCircle, Search, X, Save,
  Wrench
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ==================== AUTH CONTEXT ====================
const useAuth = () => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(localStorage.getItem("username"));

  const login = (newToken, username) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", username);
    setToken(newToken);
    setUser(username);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setUser(null);
  };

  return { token, user, login, logout, isAuthenticated: !!token };
};

// ==================== API HELPERS ====================
const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.params = { ...config.params, token };
  }
  return config;
});

// ==================== COMPONENTS ====================
const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-[#14532D] text-[#F0FDF4] hover:bg-[#14532D]/90",
    secondary: "bg-[#F97316] text-white hover:bg-[#F97316]/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
  };
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 py-2",
    lg: "h-12 px-6 text-lg"
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className = "", ...props }) => (
  <input
    className={`flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`flex min-h-[80px] w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Card = ({ children, className = "", ...props }) => (
  <div className={`bg-card text-card-foreground rounded-sm border shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

const StatCard = ({ title, value, subtitle, icon: Icon, trend }) => (
  <Card className="p-6 card-hover">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold mt-2 font-mono">{value}</p>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {Icon && (
        <div className="p-3 bg-primary/10 rounded-sm">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      )}
    </div>
    {trend && (
      <div className="flex items-center gap-1 mt-3 text-sm text-green-600">
        <TrendingUp className="w-4 h-4" />
        {trend}
      </div>
    )}
  </Card>
);

const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-muted text-muted-foreground",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800"
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children, size = "md" }) => {
  if (!isOpen) return null;
  const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-card rounded-sm shadow-lg w-full ${sizes[size]} max-h-[90vh] overflow-auto m-4`}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ==================== SIDEBAR ====================
const Sidebar = ({ onLogout }) => {
  const location = useLocation();
  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/customers", icon: Users, label: "Kunden" },
    { path: "/quotes", icon: FileText, label: "Angebote" },
    { path: "/orders", icon: ClipboardCheck, label: "Aufträge" },
    { path: "/invoices", icon: Receipt, label: "Rechnungen" },
    { path: "/articles", icon: Package, label: "Artikel" },
    { path: "/services", icon: Wrench, label: "Leistungen" },
    { path: "/settings", icon: Settings, label: "Einstellungen" }
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-primary">Graupner Suite</h1>
        <p className="text-sm text-muted-foreground mt-1">Tischlerei-Software</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
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

// ==================== LOGIN PAGE ====================
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary">
              {isRegister ? "Registrieren" : "Anmelden"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isRegister ? "Erstellen Sie Ihr Konto" : "Willkommen zurück"}
            </p>
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

// ==================== DASHBOARD ====================
const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Statistiken");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Übersicht Ihrer Geschäftstätigkeit</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Kunden"
          value={stats?.customers_count || 0}
          icon={Users}
        />
        <StatCard
          title="Offene Angebote"
          value={stats?.quotes?.open || 0}
          subtitle={`Gesamt: ${stats?.quotes?.total || 0}`}
          icon={FileText}
        />
        <StatCard
          title="Offene Aufträge"
          value={stats?.orders?.open || 0}
          subtitle={`Gesamt: ${stats?.orders?.total || 0}`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Unbezahlte Rechnungen"
          value={stats?.invoices?.unpaid || 0}
          subtitle={`Gesamt: ${stats?.invoices?.total || 0}`}
          icon={Receipt}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Umsatzübersicht
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-muted/50 rounded-sm">
              <span className="text-muted-foreground">Angebotswert gesamt</span>
              <span className="text-xl font-mono font-semibold">
                {(stats?.quotes?.total_value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-muted/50 rounded-sm">
              <span className="text-muted-foreground">Rechnungswert gesamt</span>
              <span className="text-xl font-mono font-semibold">
                {(stats?.invoices?.total_value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-sm border border-green-200">
              <span className="text-green-800">Bezahlt</span>
              <span className="text-xl font-mono font-semibold text-green-700">
                {(stats?.invoices?.paid_value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Schnellaktionen
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/quotes/new" data-testid="quick-new-quote">
              <Button variant="outline" className="w-full h-24 flex-col">
                <FileText className="w-6 h-6 mb-2" />
                Neues Angebot
              </Button>
            </Link>
            <Link to="/customers/new" data-testid="quick-new-customer">
              <Button variant="outline" className="w-full h-24 flex-col">
                <Users className="w-6 h-6 mb-2" />
                Neuer Kunde
              </Button>
            </Link>
            <Link to="/invoices/new" data-testid="quick-new-invoice">
              <Button variant="outline" className="w-full h-24 flex-col">
                <Receipt className="w-6 h-6 mb-2" />
                Neue Rechnung
              </Button>
            </Link>
            <Link to="/articles" data-testid="quick-articles">
              <Button variant="outline" className="w-full h-24 flex-col">
                <Package className="w-6 h-6 mb-2" />
                Artikelstamm
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ==================== CUSTOMERS ====================
const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await api.get("/customers");
      setCustomers(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Kunden");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Kunde wirklich löschen?")) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success("Kunde gelöscht");
      loadCustomers();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="customers-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Kunden</h1>
          <p className="text-muted-foreground mt-2">{customers.length} Kunden gesamt</p>
        </div>
        <Button
          data-testid="btn-new-customer"
          onClick={() => {
            setEditCustomer(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-5 h-5" />
          Neuer Kunde
        </Button>
      </div>

      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            data-testid="input-search-customers"
            className="pl-10"
            placeholder="Kunden suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Kunden gefunden</h3>
          <p className="text-muted-foreground mt-2">
            {search ? "Versuchen Sie eine andere Suche" : "Erstellen Sie Ihren ersten Kunden"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((customer) => (
            <Card key={customer.id} className="p-6 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{customer.name}</h3>
                  {customer.email && (
                    <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                  )}
                  {customer.phone && (
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    data-testid={`btn-edit-customer-${customer.id}`}
                    onClick={() => {
                      setEditCustomer(customer);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-muted rounded-sm"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    data-testid={`btn-delete-customer-${customer.id}`}
                    onClick={() => handleDelete(customer.id)}
                    className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {customer.address && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{customer.address}</p>
              )}
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/quotes/new?customer=${customer.id}`)}
                >
                  Angebot erstellen
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        customer={editCustomer}
        onSave={() => {
          setShowModal(false);
          loadCustomers();
        }}
      />
    </div>
  );
};

const CustomerModal = ({ isOpen, onClose, customer, onSave }) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        notes: customer.notes || ""
      });
    } else {
      setForm({ name: "", email: "", phone: "", address: "", notes: "" });
    }
  }, [customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (customer) {
        await api.put(`/customers/${customer.id}`, form);
        toast.success("Kunde aktualisiert");
      } else {
        await api.post("/customers", form);
        toast.success("Kunde erstellt");
      }
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customer ? "Kunde bearbeiten" : "Neuer Kunde"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Name *</label>
          <Input
            data-testid="input-customer-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">E-Mail</label>
            <Input
              data-testid="input-customer-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <Input
              data-testid="input-customer-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Adresse</label>
          <Textarea
            data-testid="input-customer-address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Notizen</label>
          <Textarea
            data-testid="input-customer-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" data-testid="btn-save-customer" disabled={loading}>
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ==================== QUOTES ====================
const QuotesPage = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const res = await api.get("/quotes");
      setQuotes(res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      toast.error("Fehler beim Laden der Angebote");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Angebot wirklich löschen?")) return;
    try {
      await api.delete(`/quotes/${id}`);
      toast.success("Angebot gelöscht");
      loadQuotes();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleDownloadPDF = async (id, number) => {
    try {
      const res = await axios.get(`${API}/pdf/quote/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Angebot_${number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const handleCreateOrder = async (quoteId) => {
    try {
      await api.post(`/orders/from-quote/${quoteId}`);
      toast.success("Auftrag erstellt");
      loadQuotes();
    } catch (err) {
      toast.error("Fehler beim Erstellen des Auftrags");
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Entwurf: "warning",
      Gesendet: "info",
      Beauftragt: "success",
      Abgelehnt: "danger"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div data-testid="quotes-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Angebote</h1>
          <p className="text-muted-foreground mt-2">{quotes.length} Angebote gesamt</p>
        </div>
        <Button data-testid="btn-new-quote" onClick={() => navigate("/quotes/new")}>
          <Plus className="w-5 h-5" />
          Neues Angebot
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : quotes.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Angebote vorhanden</h3>
          <p className="text-muted-foreground mt-2">Erstellen Sie Ihr erstes Angebot</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">Nr.</th>
                  <th className="text-left p-4 font-semibold">Kunde</th>
                  <th className="text-left p-4 font-semibold">Datum</th>
                  <th className="text-right p-4 font-semibold">Betrag</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-right p-4 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-b table-row-hover">
                    <td className="p-4 font-mono text-sm">{quote.quote_number}</td>
                    <td className="p-4">{quote.customer_name}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {quote.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="p-4">{getStatusBadge(quote.status)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          data-testid={`btn-download-quote-${quote.id}`}
                          onClick={() => handleDownloadPDF(quote.id, quote.quote_number)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {quote.status === "Entwurf" && (
                          <button
                            data-testid={`btn-create-order-${quote.id}`}
                            onClick={() => handleCreateOrder(quote.id)}
                            className="p-2 hover:bg-primary/10 text-primary rounded-sm"
                            title="Auftrag erstellen"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-delete-quote-${quote.id}`}
                          onClick={() => handleDelete(quote.id)}
                          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ==================== NEW QUOTE ====================
const NewQuotePage = () => {
  const [customers, setCustomers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mediaRecorderRef = { current: null };
  const chunksRef = { current: [] };

  useEffect(() => {
    loadData();
    const params = new URLSearchParams(location.search);
    const customerId = params.get("customer");
    if (customerId) setSelectedCustomer(customerId);
  }, [location.search]);

  const loadData = async () => {
    try {
      const [customersRes, articlesRes, servicesRes] = await Promise.all([
        api.get("/customers"),
        api.get("/articles"),
        api.get("/services")
      ]);
      setCustomers(customersRes.data);
      setArticles(articlesRes.data);
      setServices(servicesRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    }
  };

  const addPosition = () => {
    setPositions([
      ...positions,
      { pos_nr: positions.length + 1, description: "", quantity: 1, unit: "Stück", price_net: 0 }
    ]);
  };

  const updatePosition = (index, field, value) => {
    const updated = [...positions];
    updated[index][field] = value;
    setPositions(updated);
  };

  const removePosition = (index) => {
    const updated = positions.filter((_, i) => i !== index);
    updated.forEach((p, i) => (p.pos_nr = i + 1));
    setPositions(updated);
  };

  const addArticle = (article) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: article.name + (article.description ? ` - ${article.description}` : ""),
        quantity: 1,
        unit: article.unit,
        price_net: article.price_net
      }
    ]);
  };

  const addService = (service) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: service.name + (service.description ? ` - ${service.description}` : ""),
        quantity: 1,
        unit: service.unit,
        price_net: service.price_net
      }
    ]);
  };

  const calculateTotals = () => {
    const subtotal = positions.reduce((sum, p) => sum + p.quantity * p.price_net, 0);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    return { subtotal, vat, total };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Aufnahme gestartet - Sprechen Sie jetzt...");
    } catch (err) {
      toast.error("Mikrofon-Zugriff verweigert");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const sttRes = await axios.post(`${API}/speech-to-text`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const text = sttRes.data.text;
      setTranscript(text);

      if (!selectedCustomer) {
        toast.error("Bitte wählen Sie zuerst einen Kunden aus");
        setAiLoading(false);
        return;
      }

      const aiRes = await api.post("/ai/generate-quote", {
        customer_id: selectedCustomer,
        transcribed_text: text,
        vat_rate: vatRate
      });

      if (aiRes.data.positions && aiRes.data.positions.length > 0) {
        setPositions(aiRes.data.positions);
        if (aiRes.data.notes) setNotes(aiRes.data.notes);
        toast.success("Angebot wurde von KI erstellt!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Fehler bei der Sprachverarbeitung");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error("Bitte wählen Sie einen Kunden aus");
      return;
    }
    if (positions.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setLoading(true);
    try {
      await api.post("/quotes", {
        customer_id: selectedCustomer,
        positions,
        notes,
        vat_rate: vatRate,
        valid_days: 30
      });
      toast.success("Angebot erstellt!");
      navigate("/quotes");
    } catch (err) {
      toast.error("Fehler beim Erstellen des Angebots");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vat, total } = calculateTotals();

  return (
    <div data-testid="new-quote-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Neues Angebot</h1>
        <p className="text-muted-foreground mt-2">Erstellen Sie ein Angebot für Ihren Kunden</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Kunde</h3>
            <select
              data-testid="select-customer"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="">Kunde auswählen...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Card>

          {/* Voice Input */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Spracheingabe</h3>
            <div className="flex items-center gap-4">
              <Button
                data-testid="btn-voice-record"
                variant={isRecording ? "destructive" : "secondary"}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={aiLoading}
                className="flex items-center gap-2"
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    Aufnahme stoppen
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Aufnahme starten
                  </>
                )}
              </Button>
              {isRecording && (
                <span className="flex items-center gap-2 text-destructive">
                  <span className="w-3 h-3 bg-destructive rounded-full recording-pulse"></span>
                  Aufnahme läuft...
                </span>
              )}
              {aiLoading && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                  KI verarbeitet...
                </span>
              )}
            </div>
            {transcript && (
              <div className="mt-4 p-4 bg-muted rounded-sm">
                <p className="text-sm font-medium text-muted-foreground mb-1">Transkript:</p>
                <p className="text-sm">{transcript}</p>
              </div>
            )}
          </Card>

          {/* Positions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Positionen</h3>
              <div className="flex gap-2 flex-wrap">
                {services.length > 0 && (
                  <select
                    data-testid="select-service"
                    onChange={(e) => {
                      const service = services.find((s) => s.id === e.target.value);
                      if (service) addService(service);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Leistung hinzufügen...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - {s.price_net.toFixed(2)}€/{s.unit}
                      </option>
                    ))}
                  </select>
                )}
                {articles.length > 0 && (
                  <select
                    data-testid="select-article"
                    onChange={(e) => {
                      const article = articles.find((a) => a.id === e.target.value);
                      if (article) addArticle(article);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Artikel hinzufügen...</option>
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} - {a.price_net.toFixed(2)}€
                      </option>
                    ))}
                  </select>
                )}
                <Button variant="outline" onClick={addPosition} data-testid="btn-add-position">
                  <Plus className="w-4 h-4" />
                  Position
                </Button>
              </div>
            </div>

            {positions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Keine Positionen. Fügen Sie Positionen hinzu oder nutzen Sie die Spracheingabe.
              </p>
            ) : (
              <div className="space-y-4">
                {positions.map((pos, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-start p-4 bg-muted/50 rounded-sm">
                    <div className="col-span-1">
                      <label className="text-xs text-muted-foreground">Pos</label>
                      <Input value={pos.pos_nr} disabled className="bg-background" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground">Beschreibung</label>
                      <Textarea
                        data-testid={`input-pos-desc-${index}`}
                        value={pos.description}
                        onChange={(e) => updatePosition(index, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Menge</label>
                      <Input
                        data-testid={`input-pos-qty-${index}`}
                        type="number"
                        step="0.01"
                        value={pos.quantity}
                        onChange={(e) => updatePosition(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Einheit</label>
                      <Input
                        data-testid={`input-pos-unit-${index}`}
                        value={pos.unit}
                        onChange={(e) => updatePosition(index, "unit", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Preis (€)</label>
                      <Input
                        data-testid={`input-pos-price-${index}`}
                        type="number"
                        step="0.01"
                        value={pos.price_net}
                        onChange={(e) => updatePosition(index, "price_net", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button
                        onClick={() => removePosition(index)}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Anmerkungen</h3>
            <Textarea
              data-testid="input-quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Anmerkungen zum Angebot..."
              rows={4}
            />
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Zusammenfassung</h3>
            
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">MwSt-Satz</label>
              <select
                data-testid="select-vat-rate"
                value={vatRate}
                onChange={(e) => setVatRate(parseFloat(e.target.value))}
                className="w-full h-10 rounded-sm border border-input bg-background px-3"
              >
                <option value={19}>19% MwSt</option>
                <option value={7}>7% MwSt</option>
                <option value={0}>0% (Kleinunternehmer)</option>
              </select>
            </div>

            <div className="space-y-3 py-4 border-t">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono">{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MwSt ({vatRate}%)</span>
                <span className="font-mono">{vat.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t">
                <span>Gesamt</span>
                <span className="font-mono">{total.toFixed(2)} €</span>
              </div>
            </div>

            <Button
              data-testid="btn-save-quote"
              className="w-full mt-4"
              onClick={handleSubmit}
              disabled={loading || positions.length === 0}
            >
              {loading ? "Speichern..." : "Angebot erstellen"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ==================== ORDERS ====================
const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get("/orders");
      setOrders(res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      toast.error("Fehler beim Laden der Aufträge");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (orderId) => {
    try {
      await api.post(`/invoices/from-order/${orderId}`, { due_days: 14 });
      toast.success("Rechnung erstellt");
      loadOrders();
    } catch (err) {
      toast.error("Fehler beim Erstellen der Rechnung");
    }
  };

  const handleDownloadPDF = async (id, number) => {
    try {
      const res = await axios.get(`${API}/pdf/order/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Auftragsbestaetigung_${number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Offen: "warning",
      "In Arbeit": "info",
      Abgeschlossen: "success",
      Abgerechnet: "success"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div data-testid="orders-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Aufträge</h1>
        <p className="text-muted-foreground mt-2">{orders.length} Aufträge gesamt</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Aufträge vorhanden</h3>
          <p className="text-muted-foreground mt-2">Erstellen Sie Aufträge aus Angeboten</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">Auftrags-Nr.</th>
                  <th className="text-left p-4 font-semibold">Kunde</th>
                  <th className="text-left p-4 font-semibold">Datum</th>
                  <th className="text-right p-4 font-semibold">Betrag</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-right p-4 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b table-row-hover">
                    <td className="p-4 font-mono text-sm">{order.order_number}</td>
                    <td className="p-4">{order.customer_name}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {order.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="p-4">{getStatusBadge(order.status)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          data-testid={`btn-download-order-${order.id}`}
                          onClick={() => handleDownloadPDF(order.id, order.order_number)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {order.status !== "Abgerechnet" && (
                          <button
                            data-testid={`btn-create-invoice-${order.id}`}
                            onClick={() => handleCreateInvoice(order.id)}
                            className="p-2 hover:bg-primary/10 text-primary rounded-sm"
                            title="Rechnung erstellen"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ==================== INVOICES ====================
const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const res = await api.get("/invoices");
      setInvoices(res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      toast.error("Fehler beim Laden der Rechnungen");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await api.put(`/invoices/${id}/status`, { status: "Bezahlt" });
      toast.success("Rechnung als bezahlt markiert");
      loadInvoices();
    } catch (err) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const handleDownloadPDF = async (id, number) => {
    try {
      const res = await axios.get(`${API}/pdf/invoice/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Rechnung_${number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Rechnung wirklich löschen?")) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success("Rechnung gelöscht");
      loadInvoices();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      Offen: "warning",
      Gesendet: "info",
      Bezahlt: "success",
      Überfällig: "danger"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div data-testid="invoices-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Rechnungen</h1>
          <p className="text-muted-foreground mt-2">{invoices.length} Rechnungen gesamt</p>
        </div>
        <Button data-testid="btn-new-invoice" onClick={() => navigate("/invoices/new")}>
          <Plus className="w-5 h-5" />
          Neue Rechnung
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : invoices.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Rechnungen vorhanden</h3>
          <p className="text-muted-foreground mt-2">Erstellen Sie Ihre erste Rechnung</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">Rechnungs-Nr.</th>
                  <th className="text-left p-4 font-semibold">Kunde</th>
                  <th className="text-left p-4 font-semibold">Datum</th>
                  <th className="text-left p-4 font-semibold">Fällig</th>
                  <th className="text-right p-4 font-semibold">Betrag</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-right p-4 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b table-row-hover">
                    <td className="p-4 font-mono text-sm">{invoice.invoice_number}</td>
                    <td className="p-4">{invoice.customer_name}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(invoice.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {invoice.due_date
                        ? new Date(invoice.due_date).toLocaleDateString("de-DE")
                        : "-"}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {invoice.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="p-4">{getStatusBadge(invoice.status)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          data-testid={`btn-download-invoice-${invoice.id}`}
                          onClick={() => handleDownloadPDF(invoice.id, invoice.invoice_number)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {invoice.status === "Offen" && (
                          <button
                            data-testid={`btn-mark-paid-${invoice.id}`}
                            onClick={() => handleMarkPaid(invoice.id)}
                            className="p-2 hover:bg-green-100 text-green-700 rounded-sm"
                            title="Als bezahlt markieren"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-delete-invoice-${invoice.id}`}
                          onClick={() => handleDelete(invoice.id)}
                          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ==================== NEW INVOICE ====================
const NewInvoicePage = () => {
  const [customers, setCustomers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [dueDays, setDueDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersRes, articlesRes, servicesRes] = await Promise.all([
        api.get("/customers"),
        api.get("/articles"),
        api.get("/services")
      ]);
      setCustomers(customersRes.data);
      setArticles(articlesRes.data);
      setServices(servicesRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    }
  };

  const addPosition = () => {
    setPositions([
      ...positions,
      { pos_nr: positions.length + 1, description: "", quantity: 1, unit: "Stück", price_net: 0 }
    ]);
  };

  const updatePosition = (index, field, value) => {
    const updated = [...positions];
    updated[index][field] = value;
    setPositions(updated);
  };

  const removePosition = (index) => {
    const updated = positions.filter((_, i) => i !== index);
    updated.forEach((p, i) => (p.pos_nr = i + 1));
    setPositions(updated);
  };

  const addArticle = (article) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: article.name + (article.description ? ` - ${article.description}` : ""),
        quantity: 1,
        unit: article.unit,
        price_net: article.price_net
      }
    ]);
  };

  const addService = (service) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: service.name + (service.description ? ` - ${service.description}` : ""),
        quantity: 1,
        unit: service.unit,
        price_net: service.price_net
      }
    ]);
  };

  const calculateTotals = () => {
    const subtotal = positions.reduce((sum, p) => sum + p.quantity * p.price_net, 0);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    return { subtotal, vat, total };
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error("Bitte wählen Sie einen Kunden aus");
      return;
    }
    if (positions.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setLoading(true);
    try {
      await api.post("/invoices", {
        customer_id: selectedCustomer,
        positions,
        notes,
        vat_rate: vatRate,
        due_days: dueDays
      });
      toast.success("Rechnung erstellt!");
      navigate("/invoices");
    } catch (err) {
      toast.error("Fehler beim Erstellen der Rechnung");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vat, total } = calculateTotals();

  return (
    <div data-testid="new-invoice-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Neue Rechnung</h1>
        <p className="text-muted-foreground mt-2">Erstellen Sie eine Rechnung für Ihren Kunden</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Kunde</h3>
            <select
              data-testid="select-invoice-customer"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="">Kunde auswählen...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Positionen</h3>
              <div className="flex gap-2 flex-wrap">
                {services.length > 0 && (
                  <select
                    onChange={(e) => {
                      const service = services.find((s) => s.id === e.target.value);
                      if (service) addService(service);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Leistung hinzufügen...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - {s.price_net.toFixed(2)}€/{s.unit}
                      </option>
                    ))}
                  </select>
                )}
                {articles.length > 0 && (
                  <select
                    onChange={(e) => {
                      const article = articles.find((a) => a.id === e.target.value);
                      if (article) addArticle(article);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Artikel hinzufügen...</option>
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} - {a.price_net.toFixed(2)}€
                      </option>
                    ))}
                  </select>
                )}
                <Button variant="outline" onClick={addPosition}>
                  <Plus className="w-4 h-4" />
                  Position
                </Button>
              </div>
            </div>

            {positions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Keine Positionen. Fügen Sie Positionen hinzu.
              </p>
            ) : (
              <div className="space-y-4">
                {positions.map((pos, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-start p-4 bg-muted/50 rounded-sm">
                    <div className="col-span-1">
                      <label className="text-xs text-muted-foreground">Pos</label>
                      <Input value={pos.pos_nr} disabled className="bg-background" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground">Beschreibung</label>
                      <Textarea
                        value={pos.description}
                        onChange={(e) => updatePosition(index, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Menge</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pos.quantity}
                        onChange={(e) => updatePosition(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Einheit</label>
                      <Input
                        value={pos.unit}
                        onChange={(e) => updatePosition(index, "unit", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Preis (€)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pos.price_net}
                        onChange={(e) => updatePosition(index, "price_net", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button
                        onClick={() => removePosition(index)}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Anmerkungen</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Anmerkungen zur Rechnung..."
              rows={4}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Zusammenfassung</h3>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-2 block">MwSt-Satz</label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(parseFloat(e.target.value))}
                  className="w-full h-10 rounded-sm border border-input bg-background px-3"
                >
                  <option value={19}>19% MwSt</option>
                  <option value={7}>7% MwSt</option>
                  <option value={0}>0% (Kleinunternehmer)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Zahlungsziel</label>
                <select
                  value={dueDays}
                  onChange={(e) => setDueDays(parseInt(e.target.value))}
                  className="w-full h-10 rounded-sm border border-input bg-background px-3"
                >
                  <option value={7}>7 Tage</option>
                  <option value={14}>14 Tage</option>
                  <option value={30}>30 Tage</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 py-4 border-t">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono">{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MwSt ({vatRate}%)</span>
                <span className="font-mono">{vat.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t">
                <span>Gesamt</span>
                <span className="font-mono">{total.toFixed(2)} €</span>
              </div>
            </div>

            <Button
              data-testid="btn-save-invoice"
              className="w-full mt-4"
              onClick={handleSubmit}
              disabled={loading || positions.length === 0}
            >
              {loading ? "Speichern..." : "Rechnung erstellen"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ==================== ARTICLES ====================
const ArticlesPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editArticle, setEditArticle] = useState(null);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const res = await api.get("/articles");
      setArticles(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Artikel");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Artikel wirklich löschen?")) return;
    try {
      await api.delete(`/articles/${id}`);
      toast.success("Artikel gelöscht");
      loadArticles();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <div data-testid="articles-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Artikelstamm</h1>
          <p className="text-muted-foreground mt-2">Verwalten Sie Ihre Materialien und Produkte</p>
        </div>
        <Button
          data-testid="btn-new-article"
          onClick={() => {
            setEditArticle(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-5 h-5" />
          Neuer Artikel
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : articles.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Artikel vorhanden</h3>
          <p className="text-muted-foreground mt-2">
            Erstellen Sie Artikelvorlagen für schnellere Angebotserstellung
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <Card key={article.id} className="p-6 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{article.name}</h3>
                  {article.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {article.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditArticle(article);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-muted rounded-sm"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{article.unit}</span>
                <span className="text-lg font-mono font-semibold">
                  {article.price_net.toFixed(2)} €
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ArticleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        article={editArticle}
        onSave={() => {
          setShowModal(false);
          loadArticles();
        }}
      />
    </div>
  );
};

const ArticleModal = ({ isOpen, onClose, article, onSave }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit: "Stück",
    price_net: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (article) {
      setForm({
        name: article.name || "",
        description: article.description || "",
        unit: article.unit || "Stück",
        price_net: article.price_net || 0
      });
    } else {
      setForm({ name: "", description: "", unit: "Stück", price_net: 0 });
    }
  }, [article]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (article) {
        await api.put(`/articles/${article.id}`, form);
        toast.success("Artikel aktualisiert");
      } else {
        await api.post("/articles", form);
        toast.success("Artikel erstellt");
      }
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={article ? "Artikel bearbeiten" : "Neuer Artikel"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Bezeichnung *</label>
          <Input
            data-testid="input-article-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Türreparatur"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Beschreibung</label>
          <Textarea
            data-testid="input-article-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optionale Beschreibung..."
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Einheit</label>
            <select
              data-testid="select-article-unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="Stück">Stück</option>
              <option value="Stunde">Stunde</option>
              <option value="m²">m²</option>
              <option value="lfm">lfm</option>
              <option value="Pauschal">Pauschal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Preis (Netto €)</label>
            <Input
              data-testid="input-article-price"
              type="number"
              step="0.01"
              value={form.price_net}
              onChange={(e) => setForm({ ...form, price_net: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" data-testid="btn-save-article" disabled={loading}>
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ==================== SERVICES (LEISTUNGEN) ====================
const ServicesPage = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editService, setEditService] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const res = await api.get("/services");
      setServices(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Leistungen");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Leistung wirklich löschen?")) return;
    try {
      await api.delete(`/services/${id}`);
      toast.success("Leistung gelöscht");
      loadServices();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <div data-testid="services-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Leistungsstamm</h1>
          <p className="text-muted-foreground mt-2">Verwalten Sie Ihre Arbeitsleistungen und Dienstleistungen</p>
        </div>
        <Button
          data-testid="btn-new-service"
          onClick={() => {
            setEditService(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-5 h-5" />
          Neue Leistung
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : services.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Leistungen vorhanden</h3>
          <p className="text-muted-foreground mt-2">
            Erstellen Sie Leistungsvorlagen für schnellere Angebotserstellung
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id} className="p-6 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditService(service);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-muted rounded-sm"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{service.unit}</span>
                <span className="text-lg font-mono font-semibold">
                  {service.price_net.toFixed(2)} €
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ServiceModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        service={editService}
        onSave={() => {
          setShowModal(false);
          loadServices();
        }}
      />
    </div>
  );
};

const ServiceModal = ({ isOpen, onClose, service, onSave }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit: "Stunde",
    price_net: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name || "",
        description: service.description || "",
        unit: service.unit || "Stunde",
        price_net: service.price_net || 0
      });
    } else {
      setForm({ name: "", description: "", unit: "Stunde", price_net: 0 });
    }
  }, [service]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (service) {
        await api.put(`/services/${service.id}`, form);
        toast.success("Leistung aktualisiert");
      } else {
        await api.post("/services", form);
        toast.success("Leistung erstellt");
      }
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={service ? "Leistung bearbeiten" : "Neue Leistung"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Bezeichnung *</label>
          <Input
            data-testid="input-service-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Türreparatur"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Beschreibung</label>
          <Textarea
            data-testid="input-service-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optionale Beschreibung..."
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Einheit</label>
            <select
              data-testid="select-service-unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="Stunde">Stunde</option>
              <option value="Pauschal">Pauschal</option>
              <option value="Tag">Tag</option>
              <option value="m²">m²</option>
              <option value="lfm">lfm</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Preis (Netto €)</label>
            <Input
              data-testid="input-service-price"
              type="number"
              step="0.01"
              value={form.price_net}
              onChange={(e) => setForm({ ...form, price_net: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" data-testid="btn-save-service" disabled={loading}>
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ==================== SETTINGS ====================
const SettingsPage = () => {
  const [settings, setSettings] = useState({
    company_name: "",
    owner_name: "",
    address: "",
    phone: "",
    email: "",
    tax_id: "",
    bank_name: "",
    iban: "",
    bic: "",
    default_vat_rate: 19,
    is_small_business: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Einstellungen");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast.success("Einstellungen gespeichert");
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="settings-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-2">Firmendaten und Konfiguration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Firmendaten</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Firmenname</label>
              <Input
                data-testid="input-company-name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="Tischlerei Graupner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Inhaber</label>
              <Input
                data-testid="input-owner-name"
                value={settings.owner_name}
                onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })}
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Adresse</label>
              <Textarea
                data-testid="input-company-address"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Musterstraße 1&#10;12345 Musterstadt"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Telefon</label>
                <Input
                  data-testid="input-company-phone"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="01234 567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">E-Mail</label>
                <Input
                  data-testid="input-company-email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@tischlerei.de"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Steuernummer</label>
              <Input
                data-testid="input-tax-id"
                value={settings.tax_id}
                onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
                placeholder="123/456/78901"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Bankverbindung</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bank</label>
              <Input
                data-testid="input-bank-name"
                value={settings.bank_name}
                onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                placeholder="Sparkasse Musterstadt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">IBAN</label>
              <Input
                data-testid="input-iban"
                value={settings.iban}
                onChange={(e) => setSettings({ ...settings, iban: e.target.value })}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">BIC</label>
              <Input
                data-testid="input-bic"
                value={settings.bic}
                onChange={(e) => setSettings({ ...settings, bic: e.target.value })}
                placeholder="COBADEFFXXX"
              />
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-8 mb-4">Steuer</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Standard MwSt-Satz</label>
              <select
                data-testid="select-default-vat"
                value={settings.default_vat_rate}
                onChange={(e) => setSettings({ ...settings, default_vat_rate: parseFloat(e.target.value) })}
                className="w-full h-10 rounded-sm border border-input bg-background px-3"
              >
                <option value={19}>19%</option>
                <option value={7}>7%</option>
                <option value={0}>0% (Kleinunternehmer)</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="small-business"
                checked={settings.is_small_business}
                onChange={(e) => setSettings({ ...settings, is_small_business: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="small-business" className="text-sm">
                Kleinunternehmerregelung (§19 UStG)
              </label>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button data-testid="btn-save-settings" onClick={handleSave} disabled={saving}>
          <Save className="w-5 h-5" />
          {saving ? "Speichern..." : "Einstellungen speichern"}
        </Button>
      </div>
    </div>
  );
};

// ==================== MAIN LAYOUT ====================
const MainLayout = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLogout={onLogout} />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
};

// ==================== APP ====================
function App() {
  const { token, login, logout, isAuthenticated } = useAuth();

  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="*" element={<LoginPage onLogin={login} />} />
            </>
          ) : (
            <>
              <Route
                path="/dashboard"
                element={
                  <MainLayout onLogout={logout}>
                    <DashboardPage />
                  </MainLayout>
                }
              />
              <Route
                path="/customers"
                element={
                  <MainLayout onLogout={logout}>
                    <CustomersPage />
                  </MainLayout>
                }
              />
              <Route
                path="/customers/new"
                element={
                  <MainLayout onLogout={logout}>
                    <CustomersPage />
                  </MainLayout>
                }
              />
              <Route
                path="/quotes"
                element={
                  <MainLayout onLogout={logout}>
                    <QuotesPage />
                  </MainLayout>
                }
              />
              <Route
                path="/quotes/new"
                element={
                  <MainLayout onLogout={logout}>
                    <NewQuotePage />
                  </MainLayout>
                }
              />
              <Route
                path="/orders"
                element={
                  <MainLayout onLogout={logout}>
                    <OrdersPage />
                  </MainLayout>
                }
              />
              <Route
                path="/invoices"
                element={
                  <MainLayout onLogout={logout}>
                    <InvoicesPage />
                  </MainLayout>
                }
              />
              <Route
                path="/invoices/new"
                element={
                  <MainLayout onLogout={logout}>
                    <NewInvoicePage />
                  </MainLayout>
                }
              />
              <Route
                path="/articles"
                element={
                  <MainLayout onLogout={logout}>
                    <ArticlesPage />
                  </MainLayout>
                }
              />
              <Route
                path="/services"
                element={
                  <MainLayout onLogout={logout}>
                    <ServicesPage />
                  </MainLayout>
                }
              />
              <Route
                path="/settings"
                element={
                  <MainLayout onLogout={logout}>
                    <SettingsPage />
                  </MainLayout>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
