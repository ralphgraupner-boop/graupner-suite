import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link, useParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, Users, FileText, ClipboardCheck, Receipt, Package,
  Settings, LogOut, Plus, Mic, MicOff, Download, Mail, Trash2, Edit,
  ChevronRight, Euro, TrendingUp, Clock, CheckCircle, Search, X, Save,
  Wrench, Printer, Eye, ArrowLeft, Menu, Bell, BellOff, Copy, ExternalLink,
  Code, Globe, Send
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

// ==================== PUSH NOTIFICATION HELPER ====================
let VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function ensureVapidKey() {
  if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try {
    const res = await api.get('/push/vapid-key');
    VAPID_PUBLIC_KEY = res.data.vapid_public_key || "";
  } catch (e) {}
  return VAPID_PUBLIC_KEY;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const vapidKey = await ensureVapidKey();
  if (!vapidKey) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Already subscribed - just make sure backend knows
      const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
      const auth = arrayBufferToBase64Url(subscription.getKey('auth'));
      await api.post('/push/subscribe', {
        endpoint: subscription.endpoint,
        keys: { p256dh, auth }
      });
      return subscription;
    }
    
    // New subscription needed
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    if (!p256dhKey || !authKey) return null;
    
    await api.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64Url(p256dhKey),
        auth: arrayBufferToBase64Url(authKey)
      }
    });
    return subscription;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      try {
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
      } catch (e) {}
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}

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
  <Card className="p-3 lg:p-6 card-hover">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">{title}</p>
        <p className="text-xl lg:text-3xl font-bold mt-1 lg:mt-2 font-mono">{value}</p>
        {subtitle && <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 lg:mt-1 hidden sm:block">{subtitle}</p>}
      </div>
      {Icon && (
        <div className="p-2 lg:p-3 bg-primary/10 rounded-sm shrink-0">
          <Icon className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
        </div>
      )}
    </div>
    {trend && (
      <div className="flex items-center gap-1 mt-2 lg:mt-3 text-xs lg:text-sm text-green-600">
        <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
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

// ==================== DOCUMENT PREVIEW ====================
const DocumentPreview = ({ isOpen, onClose, document, type, onDownload, onEdit }) => {
  if (!isOpen || !document) return null;

  const titles = {
    quote: "Angebot",
    order: "Auftragsbestätigung", 
    invoice: "Rechnung"
  };

  const numberLabels = {
    quote: "Angebots-Nr.",
    order: "Auftrags-Nr.",
    invoice: "Rechnungs-Nr."
  };

  const docNumber = document.quote_number || document.order_number || document.invoice_number;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-sm shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 sticky top-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">{titles[type]} {docNumber}</h2>
            <Badge variant={document.status === "Bezahlt" ? "success" : document.status === "Offen" ? "warning" : "default"}>
              {document.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => { onClose(); onEdit(document); }}>
                <Edit className="w-4 h-4" />
                Bearbeiten
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onDownload(document.id, docNumber)}>
              <Download className="w-4 h-4" />
              PDF
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-sm">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Content */}
        <div className="p-8 bg-white">
          {/* Document Header */}
          <div className="flex justify-between mb-8 pb-6 border-b">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">{titles[type].toUpperCase()}</h1>
              <p className="text-muted-foreground">{numberLabels[type]} {docNumber}</p>
              <p className="text-muted-foreground">
                Datum: {new Date(document.created_at).toLocaleDateString("de-DE")}
              </p>
              {document.valid_until && (
                <p className="text-muted-foreground">
                  Gültig bis: {new Date(document.valid_until).toLocaleDateString("de-DE")}
                </p>
              )}
              {document.due_date && (
                <p className="text-muted-foreground">
                  Fällig: {new Date(document.due_date).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">{document.customer_name}</p>
              {document.customer_address && (
                <p className="text-muted-foreground whitespace-pre-line text-sm">
                  {document.customer_address}
                </p>
              )}
            </div>
          </div>

          {/* Positions Table */}
          <table className="w-full mb-6">
            <thead>
              <tr className="border-b-2 border-primary/20">
                <th className="text-left py-3 text-sm font-semibold text-primary">Pos</th>
                <th className="text-left py-3 text-sm font-semibold text-primary">Beschreibung</th>
                <th className="text-right py-3 text-sm font-semibold text-primary">Menge</th>
                <th className="text-left py-3 text-sm font-semibold text-primary">Einheit</th>
                <th className="text-right py-3 text-sm font-semibold text-primary">Einzelpreis</th>
                <th className="text-right py-3 text-sm font-semibold text-primary">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {document.positions?.map((pos, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-3 text-sm">{pos.pos_nr}</td>
                  <td className="py-3 text-sm">{pos.description}</td>
                  <td className="py-3 text-sm text-right font-mono">{pos.quantity}</td>
                  <td className="py-3 text-sm">{pos.unit}</td>
                  <td className="py-3 text-sm text-right font-mono">{pos.price_net?.toFixed(2)} €</td>
                  <td className="py-3 text-sm text-right font-mono">{(pos.quantity * pos.price_net)?.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-2">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono">{document.subtotal_net?.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">MwSt ({document.vat_rate}%)</span>
                <span className="font-mono">{document.vat_amount?.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
                <span>Gesamt</span>
                <span className="font-mono">{document.total_gross?.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {document.notes && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Anmerkungen:</p>
              <p className="text-sm whitespace-pre-line">{document.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== EDIT DOCUMENT MODAL (Universal für Quote/Order/Invoice) ====================
const EditDocumentModal = ({ isOpen, onClose, document, type, onSave }) => {
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [status, setStatus] = useState("");
  const [customTotal, setCustomTotal] = useState("");
  const [depositAmount, setDepositAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);

  const titles = { quote: "Angebot", order: "Auftrag", invoice: "Rechnung" };
  const statusOptions = {
    quote: ["Entwurf", "Gesendet", "Beauftragt", "Abgelehnt"],
    order: ["Offen", "In Arbeit", "Abgeschlossen", "Abgerechnet"],
    invoice: ["Offen", "Gesendet", "Bezahlt", "Überfällig"]
  };

  useEffect(() => {
    if (document) {
      setPositions(document.positions || []);
      setNotes(document.notes || "");
      setVatRate(document.vat_rate || 19);
      setStatus(document.status || "");
      setCustomTotal("");
      setDepositAmount(document.deposit_amount || 0);
    }
    loadStammdaten();
  }, [document]);

  const loadStammdaten = async () => {
    try {
      const [articlesRes, servicesRes] = await Promise.all([
        api.get("/articles"),
        api.get("/services")
      ]);
      setArticles(articlesRes.data);
      setServices(servicesRes.data);
    } catch (err) {
      console.error("Fehler beim Laden der Stammdaten");
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
    const final = total - depositAmount;
    return { subtotal, vat, total, final };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (positions.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setLoading(true);
    try {
      const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
      const docId = document.id;
      
      const payload = {
        positions,
        notes,
        vat_rate: vatRate,
        status: status || undefined,
        custom_total: customTotal ? parseFloat(customTotal) : undefined
      };

      if (type === "invoice") {
        payload.deposit_amount = depositAmount;
      }

      await api.put(`/${endpoint}/${docId}`, payload);
      toast.success(`${titles[type]} aktualisiert!`);
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vat, total, final } = calculateTotals();
  const docNumber = document?.quote_number || document?.order_number || document?.invoice_number;

  if (!document) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${titles[type]} ${docNumber} bearbeiten`} size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-sm">
          <p className="text-sm text-muted-foreground">Kunde: <strong>{document.customer_name}</strong></p>
          <p className="text-sm text-muted-foreground">Erstellt: {new Date(document.created_at).toLocaleDateString("de-DE")}</p>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full h-10 rounded-sm border border-input bg-background px-3"
          >
            {statusOptions[type].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Positions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium">Positionen</label>
            <div className="flex gap-2 flex-wrap">
              {services.length > 0 && (
                <select
                  onChange={(e) => {
                    const service = services.find((s) => s.id === e.target.value);
                    if (service) addService(service);
                    e.target.value = "";
                  }}
                  className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
                >
                  <option value="">+ Leistung</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
                  className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
                >
                  <option value="">+ Artikel</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addPosition}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {positions.map((pos, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-muted/30 rounded-sm">
                <div className="col-span-5">
                  <Input
                    value={pos.description}
                    onChange={(e) => updatePosition(index, "description", e.target.value)}
                    placeholder="Beschreibung"
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={pos.quantity}
                    onChange={(e) => updatePosition(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    value={pos.unit}
                    onChange={(e) => updatePosition(index, "unit", e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={pos.price_net}
                    onChange={(e) => updatePosition(index, "price_net", parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removePosition(index)}
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">Anmerkungen</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* VAT, Custom Total & Deposit */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">MwSt-Satz</label>
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
            <label className="block text-sm font-medium mb-2">Gesamtsumme ändern (Brutto)</label>
            <Input
              type="number"
              step="0.01"
              value={customTotal}
              onChange={(e) => setCustomTotal(e.target.value)}
              placeholder={`${total.toFixed(2)} €`}
            />
            <p className="text-xs text-muted-foreground mt-1">Positionen werden proportional angepasst</p>
          </div>
          {type === "invoice" && (
            <div>
              <label className="block text-sm font-medium mb-2">Anzahlung (€)</label>
              <Input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <div className="space-y-1 text-right">
            <p className="text-sm text-muted-foreground">Netto: <span className="font-mono">{subtotal.toFixed(2)} €</span></p>
            <p className="text-sm text-muted-foreground">MwSt: <span className="font-mono">{vat.toFixed(2)} €</span></p>
            <p className="font-bold">Gesamt: <span className="font-mono">{total.toFixed(2)} €</span></p>
            {type === "invoice" && depositAmount > 0 && (
              <p className="text-primary font-semibold">Restbetrag: <span className="font-mono">{final.toFixed(2)} €</span></p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Speichern..." : "Änderungen speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ==================== WYSIWYG DOCUMENT EDITOR ====================
const WysiwygDocumentEditor = ({ type = "quote" }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isNew = !id || id === "new";
  
  const [customers, setCustomers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Document state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customer, setCustomer] = useState(null);
  const [positions, setPositions] = useState([
    { pos_nr: 1, description: "", quantity: 1, unit: "Stück", price_net: 0 }
  ]);
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [status, setStatus] = useState(type === "quote" ? "Entwurf" : type === "order" ? "Offen" : "Offen");
  const [depositAmount, setDepositAmount] = useState(0);
  const [docNumber, setDocNumber] = useState("");
  const [createdAt, setCreatedAt] = useState(new Date().toISOString());
  
  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const titles = { quote: "Angebot", order: "Auftragsbestätigung", invoice: "Rechnung" };
  const listPaths = { quote: "/quotes", order: "/orders", invoice: "/invoices" };

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [customersRes, articlesRes, servicesRes, settingsRes] = await Promise.all([
        api.get("/customers"),
        api.get("/articles"),
        api.get("/services"),
        api.get("/settings")
      ]);
      setCustomers(customersRes.data);
      setArticles(articlesRes.data);
      setServices(servicesRes.data);
      setSettings(settingsRes.data);

      // Load existing document if editing
      if (!isNew) {
        const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
        const res = await api.get(`/${endpoint}/${id}`);
        const doc = res.data;
        setSelectedCustomerId(doc.customer_id);
        setCustomer({ name: doc.customer_name, address: doc.customer_address });
        setPositions(doc.positions || []);
        setNotes(doc.notes || "");
        setVatRate(doc.vat_rate || 19);
        setStatus(doc.status || "");
        setDepositAmount(doc.deposit_amount || 0);
        setDocNumber(doc.quote_number || doc.order_number || doc.invoice_number);
        setCreatedAt(doc.created_at);
      } else {
        // Pre-select customer from query param
        const params = new URLSearchParams(location.search);
        const preselectedCustomerId = params.get("customer");
        if (preselectedCustomerId) {
          const cust = customersRes.data.find(c => c.id === preselectedCustomerId);
          if (cust) {
            setSelectedCustomerId(preselectedCustomerId);
            setCustomer(cust);
          }
        }
      }
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find(c => c.id === customerId);
    setCustomer(cust || null);
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
    if (positions.length <= 1) return;
    const updated = positions.filter((_, i) => i !== index);
    updated.forEach((p, i) => (p.pos_nr = i + 1));
    setPositions(updated);
  };

  const addFromStamm = (item, isService = false) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: item.name + (item.description ? ` - ${item.description}` : ""),
        quantity: 1,
        unit: item.unit,
        price_net: item.price_net
      }
    ]);
  };

  const calculateTotals = () => {
    const subtotal = positions.reduce((sum, p) => sum + (p.quantity || 0) * (p.price_net || 0), 0);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    const final = total - depositAmount;
    return { subtotal, vat, total, final };
  };

  // Voice recording functions
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
    if (!selectedCustomerId) {
      toast.error("Bitte wählen Sie zuerst einen Kunden aus");
      return;
    }

    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const sttRes = await axios.post(`${API}/speech-to-text`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const text = sttRes.data.text;

      const aiRes = await api.post("/ai/generate-quote", {
        customer_id: selectedCustomerId,
        transcribed_text: text,
        vat_rate: vatRate
      });

      if (aiRes.data.positions && aiRes.data.positions.length > 0) {
        setPositions(aiRes.data.positions);
        if (aiRes.data.notes) setNotes(aiRes.data.notes);
        toast.success("KI hat das Dokument erstellt!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Fehler bei der Sprachverarbeitung");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCustomerId) {
      toast.error("Bitte wählen Sie einen Kunden aus");
      return;
    }
    if (positions.length === 0 || !positions[0].description) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setSaving(true);
    try {
      const endpoint = type === "quote" ? "quotes" : type === "order" ? "orders" : "invoices";
      
      if (isNew) {
        const payload = {
          customer_id: selectedCustomerId,
          positions: positions.filter(p => p.description),
          notes,
          vat_rate: vatRate,
          ...(type === "quote" && { valid_days: 30 }),
          ...(type === "invoice" && { due_days: 14, deposit_amount: depositAmount })
        };
        await api.post(`/${endpoint}`, payload);
        toast.success(`${titles[type]} erstellt!`);
      } else {
        const payload = {
          positions: positions.filter(p => p.description),
          notes,
          vat_rate: vatRate,
          status,
          ...(type === "invoice" && { deposit_amount: depositAmount })
        };
        await api.put(`/${endpoint}/${id}`, payload);
        toast.success(`${titles[type]} aktualisiert!`);
      }
      navigate(listPaths[type]);
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (isNew) {
      toast.error("Bitte speichern Sie zuerst das Dokument");
      return;
    }
    try {
      const endpoint = type === "quote" ? "quote" : type === "order" ? "order" : "invoice";
      const res = await axios.get(`${API}/pdf/${endpoint}/${id}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${titles[type]}_${docNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim PDF-Download");
    }
  };

  const { subtotal, vat, total, final } = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toolbar */}
      <div className="fixed top-0 left-0 right-0 bg-card border-b z-40 shadow-sm">
        <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-3">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(listPaths[type])}>
              <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">Zurück</span>
            </Button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <h1 className="text-sm lg:text-xl font-bold text-primary truncate">
              {isNew ? `${titles[type]}` : `${titles[type]} ${docNumber}`}
            </h1>
            {!isNew && (
              <Badge variant={status === "Bezahlt" || status === "Beauftragt" ? "success" : "warning"}>
                {status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 lg:gap-3 shrink-0">
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={aiLoading}
              data-testid="btn-voice-input"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="hidden sm:inline">{isRecording ? "Stop" : "Spracheingabe"}</span>
            </Button>
            {aiLoading && (
              <span className="text-xs text-muted-foreground animate-pulse hidden sm:inline">KI verarbeitet...</span>
            )}
            {!isNew && (
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving} data-testid="btn-save-document">
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{saving ? "..." : "Speichern"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Document Area */}
      <div className="pt-14 lg:pt-20 pb-4 lg:pb-8 px-2 lg:px-8 flex justify-center">
        <div className="w-full max-w-4xl">
          {/* Side Tools */}
          <div className="mb-3 lg:mb-4 flex gap-2 flex-wrap">
            <select
              value=""
              onChange={(e) => {
                const service = services.find(s => s.id === e.target.value);
                if (service) addFromStamm(service, true);
              }}
              className="h-8 lg:h-9 rounded-sm border border-input bg-card px-2 lg:px-3 text-xs lg:text-sm flex-1 min-w-0 lg:flex-none"
            >
              <option value="">+ Leistung</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.price_net}€)</option>
              ))}
            </select>
            <select
              value=""
              onChange={(e) => {
                const article = articles.find(a => a.id === e.target.value);
                if (article) addFromStamm(article, false);
              }}
              className="h-8 lg:h-9 rounded-sm border border-input bg-card px-2 lg:px-3 text-xs lg:text-sm flex-1 min-w-0 lg:flex-none"
            >
              <option value="">+ Artikel</option>
              {articles.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.price_net}€)</option>
              ))}
            </select>
            {!isNew && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-sm border border-input bg-card px-3 text-sm"
              >
                {type === "quote" && (
                  <>
                    <option value="Entwurf">Status: Entwurf</option>
                    <option value="Gesendet">Status: Gesendet</option>
                    <option value="Beauftragt">Status: Beauftragt</option>
                    <option value="Abgelehnt">Status: Abgelehnt</option>
                  </>
                )}
                {type === "order" && (
                  <>
                    <option value="Offen">Status: Offen</option>
                    <option value="In Arbeit">Status: In Arbeit</option>
                    <option value="Abgeschlossen">Status: Abgeschlossen</option>
                  </>
                )}
                {type === "invoice" && (
                  <>
                    <option value="Offen">Status: Offen</option>
                    <option value="Gesendet">Status: Gesendet</option>
                    <option value="Bezahlt">Status: Bezahlt</option>
                    <option value="Überfällig">Status: Überfällig</option>
                  </>
                )}
              </select>
            )}
          </div>

          {/* Paper Document */}
          <div className="bg-white shadow-xl rounded-sm border" style={{ minHeight: "600px" }}>
            {/* Document Header */}
            <div className="p-4 lg:p-10 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                {/* Left: Document Title & Info */}
                <div>
                  <h2 className="text-2xl lg:text-4xl font-bold text-primary tracking-tight mb-2 lg:mb-4">
                    {titles[type].toUpperCase()}
                  </h2>
                  <div className="space-y-0.5 text-xs lg:text-sm text-muted-foreground">
                    <p>{type === "quote" ? "Angebots-Nr." : type === "order" ? "Auftrags-Nr." : "Rechnungs-Nr."}: {docNumber || "(wird beim Speichern vergeben)"}</p>
                    <p>Datum: {new Date(createdAt).toLocaleDateString("de-DE")}</p>
                  </div>
                </div>
                {/* Right: Company Info */}
                <div className="sm:text-right">
                  <p className="font-bold text-base lg:text-lg">{settings.company_name || "Ihr Firmenname"}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground whitespace-pre-line">
                    {settings.address || "Ihre Adresse"}
                  </p>
                  {settings.phone && <p className="text-xs lg:text-sm text-muted-foreground">Tel: {settings.phone}</p>}
                  {settings.email && <p className="text-xs lg:text-sm text-muted-foreground">{settings.email}</p>}
                </div>
              </div>
            </div>

            {/* Customer Selection / Address */}
            <div className="px-4 lg:px-10 py-4 lg:py-6 border-b bg-slate-50/50">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">Kunde:</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full max-w-md h-10 rounded-sm border border-input bg-white px-3"
                  data-testid="wysiwyg-customer-select"
                >
                  <option value="">Kunde auswählen...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.customer_type !== "Privat" ? `(${c.customer_type})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {customer && (
                <div className="mt-3">
                  <p className="font-semibold text-lg">{customer.name}</p>
                  {customer.address && (
                    <p className="text-muted-foreground whitespace-pre-line">{customer.address}</p>
                  )}
                </div>
              )}
            </div>

            {/* Positions Table - Editable */}
            <div className="px-4 lg:px-10 py-4 lg:py-8">
              {/* Mobile Positions - Card Layout */}
              <div className="lg:hidden space-y-3">
                {positions.map((pos, idx) => (
                  <div key={idx} className="border rounded-sm p-3 bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-muted-foreground">Pos. {pos.pos_nr}</span>
                      <button onClick={() => removePosition(idx)} className="p-1 hover:bg-destructive/10 rounded-sm">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={pos.description}
                      onChange={(e) => updatePosition(idx, "description", e.target.value)}
                      placeholder="Beschreibung..."
                      className="w-full border rounded px-2 py-1.5 text-sm mb-2"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Menge</label>
                        <input type="number" step="0.01" value={pos.quantity}
                          onChange={(e) => updatePosition(idx, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1.5 text-sm text-center font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Einheit</label>
                        <input value={pos.unit}
                          onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-sm text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Preis (€)</label>
                        <input type="number" step="0.01" value={pos.price_net}
                          onChange={(e) => updatePosition(idx, "price_net", parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1.5 text-sm text-right font-mono" />
                      </div>
                    </div>
                    <div className="text-right mt-2 font-mono text-sm font-semibold">
                      = {((pos.quantity || 0) * (pos.price_net || 0)).toFixed(2)} €
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Positions - Table */}
              <table className="hidden lg:table w-full">
                <thead>
                  <tr className="border-b-2 border-primary/30">
                    <th className="text-left py-3 text-sm font-semibold text-primary w-12">Pos</th>
                    <th className="text-left py-3 text-sm font-semibold text-primary">Beschreibung</th>
                    <th className="text-right py-3 text-sm font-semibold text-primary w-24">Menge</th>
                    <th className="text-left py-3 text-sm font-semibold text-primary w-24">Einheit</th>
                    <th className="text-right py-3 text-sm font-semibold text-primary w-28">Einzelpreis</th>
                    <th className="text-right py-3 text-sm font-semibold text-primary w-28">Gesamt</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, idx) => (
                    <tr key={idx} className="border-b border-slate-100 group">
                      <td className="py-3 text-sm text-muted-foreground">{pos.pos_nr}</td>
                      <td className="py-2">
                        <input type="text" value={pos.description}
                          onChange={(e) => updatePosition(idx, "description", e.target.value)}
                          placeholder="Beschreibung eingeben..."
                          className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="py-2">
                        <input type="number" step="0.01" value={pos.quantity}
                          onChange={(e) => updatePosition(idx, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm text-right font-mono" />
                      </td>
                      <td className="py-2">
                        <input type="text" value={pos.unit}
                          onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end">
                          <input type="number" step="0.01" value={pos.price_net}
                            onChange={(e) => updatePosition(idx, "price_net", parseFloat(e.target.value) || 0)}
                            className="w-20 bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm text-right font-mono" />
                          <span className="text-sm text-muted-foreground ml-1">€</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-sm">
                        {((pos.quantity || 0) * (pos.price_net || 0)).toFixed(2)} €
                      </td>
                      <td className="py-3">
                        <button onClick={() => removePosition(idx)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add Position Button */}
              <button
                onClick={addPosition}
                data-testid="btn-add-position"
                className="mt-4 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Position hinzufügen
              </button>
            </div>

            {/* Totals */}
            <div className="px-4 lg:px-10 py-4 lg:py-6 border-t">
              <div className="flex justify-end">
                <div className="w-full sm:w-72 space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Netto</span>
                    <span className="font-mono">{subtotal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between py-2 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">MwSt</span>
                      <select
                        value={vatRate}
                        onChange={(e) => setVatRate(parseFloat(e.target.value))}
                        className="h-7 text-xs border rounded px-1 bg-white"
                      >
                        <option value={19}>19%</option>
                        <option value={7}>7%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                    <span className="font-mono">{vat.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
                    <span>Gesamt</span>
                    <span className="font-mono">{total.toFixed(2)} €</span>
                  </div>
                  {type === "invoice" && (
                    <>
                      <div className="flex justify-between py-2 items-center">
                        <span className="text-muted-foreground">Anzahlung</span>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="0.01"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                            className="w-20 border rounded px-2 py-1 text-sm text-right font-mono"
                          />
                          <span className="ml-1">€</span>
                        </div>
                      </div>
                      {depositAmount > 0 && (
                        <div className="flex justify-between py-2 text-primary font-semibold">
                          <span>Restbetrag</span>
                          <span className="font-mono">{final.toFixed(2)} €</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="px-4 lg:px-10 py-4 lg:py-6 border-t">
              <label className="text-sm font-medium text-muted-foreground block mb-2">Anmerkungen:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Anmerkungen..."
                className="w-full bg-slate-50 border rounded-sm px-3 lg:px-4 py-2 lg:py-3 text-sm min-h-[60px] lg:min-h-[80px] focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Footer */}
            {type === "invoice" && settings.iban && (
              <div className="px-4 lg:px-10 py-4 lg:py-6 border-t bg-slate-50/50 text-xs lg:text-sm text-muted-foreground">
                <p className="font-medium mb-1">Bankverbindung:</p>
                <p className="break-all">{settings.bank_name} | IBAN: {settings.iban} | BIC: {settings.bic}</p>
                {settings.tax_id && <p className="mt-2">Steuernummer: {settings.tax_id}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== NAVIGATION ====================
const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/customers", icon: Users, label: "Kunden" },
  { path: "/quotes", icon: FileText, label: "Angebote" },
  { path: "/orders", icon: ClipboardCheck, label: "Aufträge" },
  { path: "/invoices", icon: Receipt, label: "Rechnungen" },
  { path: "/articles", icon: Package, label: "Artikel" },
  { path: "/services", icon: Wrench, label: "Leistungen" },
  { path: "/webhook", icon: Globe, label: "Website-Integration" },
  { path: "/settings", icon: Settings, label: "Einstellungen" }
];

const mobileTabItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { path: "/customers", icon: Users, label: "Kunden" },
  { path: "/quotes", icon: FileText, label: "Angebote" },
  { path: "/invoices", icon: Receipt, label: "Rechnungen" },
];

const Sidebar = ({ onLogout }) => {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-card border-r flex-col z-30">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-primary">Graupner Suite</h1>
        <p className="text-sm text-muted-foreground mt-1">Tischlerei-Software</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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

const MobileNav = ({ onLogout }) => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = navItems.filter(i => !mobileTabItems.find(t => t.path === i.path));

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b flex items-center justify-between px-4 z-30">
        <h1 className="text-lg font-bold text-primary">Graupner Suite</h1>
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="p-2 hover:bg-muted rounded-sm"
          data-testid="btn-mobile-menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-around items-center z-30 safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileTabItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            data-testid={`mobile-nav-${path.slice(1)}`}
            className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] ${
              location.pathname.startsWith(path)
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          data-testid="mobile-nav-more"
          className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] ${
            moreOpen ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mehr</span>
        </button>
      </nav>

      {/* More Menu Overlay */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-16 left-0 right-0 bg-card rounded-t-xl shadow-xl border-t p-4 space-y-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }} onClick={e => e.stopPropagation()}>
            {moreItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMoreOpen(false)}
                data-testid={`mobile-more-${path.slice(1)}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-sm ${
                  location.pathname.startsWith(path)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{label}</span>
              </Link>
            ))}
            <button
              onClick={() => { setMoreOpen(false); onLogout(); }}
              className="flex items-center gap-3 px-4 py-3 w-full text-destructive rounded-sm mt-2 border-t pt-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Abmelden</span>
            </button>
          </div>
        </div>
      )}
    </>
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
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base">Übersicht Ihrer Geschäftstätigkeit</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
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
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <Link to="/quotes/new" data-testid="quick-new-quote">
              <Button variant="outline" className="w-full h-16 lg:h-24 flex-col text-xs lg:text-sm">
                <FileText className="w-5 h-5 lg:w-6 lg:h-6 mb-1 lg:mb-2" />
                Neues Angebot
              </Button>
            </Link>
            <Link to="/customers/new" data-testid="quick-new-customer">
              <Button variant="outline" className="w-full h-16 lg:h-24 flex-col text-xs lg:text-sm">
                <Users className="w-5 h-5 lg:w-6 lg:h-6 mb-1 lg:mb-2" />
                Neuer Kunde
              </Button>
            </Link>
            <Link to="/invoices/new" data-testid="quick-new-invoice">
              <Button variant="outline" className="w-full h-16 lg:h-24 flex-col text-xs lg:text-sm">
                <Receipt className="w-5 h-5 lg:w-6 lg:h-6 mb-1 lg:mb-2" />
                Neue Rechnung
              </Button>
            </Link>
            <Link to="/articles" data-testid="quick-articles">
              <Button variant="outline" className="w-full h-16 lg:h-24 flex-col text-xs lg:text-sm">
                <Package className="w-5 h-5 lg:w-6 lg:h-6 mb-1 lg:mb-2" />
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
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Kunden</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{customers.length} Kunden gesamt</p>
        </div>
        <Button
          data-testid="btn-new-customer"
          size="sm"
          className="lg:h-10 lg:px-4"
          onClick={() => {
            setEditCustomer(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Neuer Kunde</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
          <Input
            data-testid="input-search-customers"
            className="pl-9 lg:pl-10 h-9 lg:h-10"
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
        <Card className="p-8 lg:p-12 text-center">
          <Users className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Kunden gefunden</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {search ? "Versuchen Sie eine andere Suche" : "Erstellen Sie Ihren ersten Kunden"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {filtered.map((customer) => (
            <Card key={customer.id} className="p-4 lg:p-6 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{customer.name}</h3>
                    {customer.customer_type && customer.customer_type !== "Privat" && (
                      <Badge variant="default" className="text-xs">{customer.customer_type}</Badge>
                    )}
                  </div>
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
    notes: "",
    customer_type: "Privat"
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        notes: customer.notes || "",
        customer_type: customer.customer_type || "Privat"
      });
    } else {
      setForm({ name: "", email: "", phone: "", address: "", notes: "", customer_type: "Privat" });
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name *</label>
            <Input
              data-testid="input-customer-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Kundentyp</label>
            <select
              data-testid="select-customer-type"
              value={form.customer_type}
              onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="Privat">Privat</option>
              <option value="Vermieter">Vermieter</option>
              <option value="Mieter">Mieter</option>
              <option value="Gewerblich">Gewerblich</option>
              <option value="Hausverwaltung">Hausverwaltung</option>
              <option value="Wohnungsbaugesellschaft">Wohnungsbaugesellschaft</option>
            </select>
          </div>
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
  const [previewQuote, setPreviewQuote] = useState(null);
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

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm("Angebot wirklich löschen?")) return;
    try {
      await api.delete(`/quotes/${id}`);
      toast.success("Angebot gelöscht");
      loadQuotes();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleDownloadPDF = async (id, number, e) => {
    e?.stopPropagation();
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

  const handleCreateOrder = async (quoteId, e) => {
    e?.stopPropagation();
    try {
      await api.post(`/orders/from-quote/${quoteId}`);
      toast.success("Auftrag erstellt");
      loadQuotes();
    } catch (err) {
      toast.error("Fehler beim Erstellen des Auftrags");
    }
  };

  const handleEdit = (quote, e) => {
    e?.stopPropagation();
    navigate(`/quotes/edit/${quote.id}`);
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
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Angebote</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{quotes.length} Angebote gesamt</p>
        </div>
        <Button data-testid="btn-new-quote" onClick={() => navigate("/quotes/new")} size="sm" className="lg:h-10 lg:px-4">
          <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Neues Angebot</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : quotes.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <FileText className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Angebote vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">Erstellen Sie Ihr erstes Angebot</p>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {quotes.map((quote) => (
              <Card key={quote.id} className="p-4" onClick={() => setPreviewQuote(quote)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-muted-foreground">{quote.quote_number}</p>
                    <p className="font-semibold truncate">{quote.customer_name}</p>
                  </div>
                  {getStatusBadge(quote.status)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-muted-foreground">
                    {new Date(quote.created_at).toLocaleDateString("de-DE")}
                  </div>
                  <div className="font-mono font-semibold">
                    {quote.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                  <button data-testid={`btn-edit-quote-${quote.id}`} onClick={(e) => handleEdit(quote, e)} className="p-2 hover:bg-muted rounded-sm"><Edit className="w-4 h-4" /></button>
                  <button data-testid={`btn-download-quote-m-${quote.id}`} onClick={(e) => handleDownloadPDF(quote.id, quote.quote_number, e)} className="p-2 hover:bg-muted rounded-sm"><Download className="w-4 h-4" /></button>
                  {quote.status === "Entwurf" && (
                    <button onClick={(e) => handleCreateOrder(quote.id, e)} className="p-2 hover:bg-primary/10 text-primary rounded-sm"><CheckCircle className="w-4 h-4" /></button>
                  )}
                  <button onClick={(e) => handleDelete(quote.id, e)} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden lg:block">
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
                  <tr 
                    key={quote.id} 
                    className="border-b table-row-hover cursor-pointer"
                    onClick={() => setPreviewQuote(quote)}
                  >
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
                          data-testid={`btn-edit-quote-${quote.id}`}
                          onClick={(e) => handleEdit(quote, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-download-quote-${quote.id}`}
                          onClick={(e) => handleDownloadPDF(quote.id, quote.quote_number, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {quote.status === "Entwurf" && (
                          <button
                            data-testid={`btn-create-order-${quote.id}`}
                            onClick={(e) => handleCreateOrder(quote.id, e)}
                            className="p-2 hover:bg-primary/10 text-primary rounded-sm"
                            title="Auftrag erstellen"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-delete-quote-${quote.id}`}
                          onClick={(e) => handleDelete(quote.id, e)}
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
        </>
      )}

      <DocumentPreview
        isOpen={!!previewQuote}
        onClose={() => setPreviewQuote(null)}
        document={previewQuote}
        type="quote"
        onDownload={(id, num) => handleDownloadPDF(id, num)}
        onEdit={(q) => handleEdit(q)}
      />
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
  const [previewOrder, setPreviewOrder] = useState(null);
  const navigate = useNavigate();

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

  const handleCreateInvoice = async (orderId, e) => {
    e?.stopPropagation();
    try {
      await api.post(`/invoices/from-order/${orderId}`, { due_days: 14 });
      toast.success("Rechnung erstellt");
      loadOrders();
    } catch (err) {
      toast.error("Fehler beim Erstellen der Rechnung");
    }
  };

  const handleDownloadPDF = async (id, number, e) => {
    e?.stopPropagation();
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

  const handleEdit = (order, e) => {
    e?.stopPropagation();
    navigate(`/orders/edit/${order.id}`);
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
      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Aufträge</h1>
        <p className="text-muted-foreground mt-1 text-sm lg:text-base">{orders.length} Aufträge gesamt</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <ClipboardCheck className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Aufträge vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">Erstellen Sie Aufträge aus Angeboten</p>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {orders.map((order) => (
              <Card key={order.id} className="p-4" onClick={() => setPreviewOrder(order)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-muted-foreground">{order.order_number}</p>
                    <p className="font-semibold truncate">{order.customer_name}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("de-DE")}
                  </div>
                  <div className="font-mono font-semibold">
                    {order.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                  <button data-testid={`btn-edit-order-${order.id}`} onClick={(e) => handleEdit(order, e)} className="p-2 hover:bg-muted rounded-sm"><Edit className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDownloadPDF(order.id, order.order_number, e)} className="p-2 hover:bg-muted rounded-sm"><Download className="w-4 h-4" /></button>
                  {order.status !== "Abgerechnet" && (
                    <button onClick={(e) => handleCreateInvoice(order.id, e)} className="p-2 hover:bg-primary/10 text-primary rounded-sm"><Receipt className="w-4 h-4" /></button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden lg:block">
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
                  <tr 
                    key={order.id} 
                    className="border-b table-row-hover cursor-pointer"
                    onClick={() => setPreviewOrder(order)}
                  >
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
                          data-testid={`btn-edit-order-${order.id}`}
                          onClick={(e) => handleEdit(order, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-download-order-${order.id}`}
                          onClick={(e) => handleDownloadPDF(order.id, order.order_number, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {order.status !== "Abgerechnet" && (
                          <button
                            data-testid={`btn-create-invoice-${order.id}`}
                            onClick={(e) => handleCreateInvoice(order.id, e)}
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
        </>
      )}

      <DocumentPreview
        isOpen={!!previewOrder}
        onClose={() => setPreviewOrder(null)}
        document={previewOrder}
        type="order"
        onDownload={(id, num) => handleDownloadPDF(id, num)}
        onEdit={(o) => handleEdit(o)}
      />
    </div>
  );
};

// ==================== INVOICES ====================
const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewInvoice, setPreviewInvoice] = useState(null);
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

  const handleMarkPaid = async (id, e) => {
    e?.stopPropagation();
    try {
      await api.put(`/invoices/${id}/status`, { status: "Bezahlt" });
      toast.success("Rechnung als bezahlt markiert");
      loadInvoices();
    } catch (err) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const handleDownloadPDF = async (id, number, e) => {
    e?.stopPropagation();
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

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm("Rechnung wirklich löschen?")) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success("Rechnung gelöscht");
      loadInvoices();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleEdit = (invoice, e) => {
    e?.stopPropagation();
    navigate(`/invoices/edit/${invoice.id}`);
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
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Rechnungen</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{invoices.length} Rechnungen gesamt</p>
        </div>
        <Button data-testid="btn-new-invoice" onClick={() => navigate("/invoices/new")} size="sm" className="lg:h-10 lg:px-4">
          <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Neue Rechnung</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : invoices.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <Receipt className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Rechnungen vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">Erstellen Sie Ihre erste Rechnung</p>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="p-4" onClick={() => setPreviewInvoice(invoice)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-muted-foreground">{invoice.invoice_number}</p>
                    <p className="font-semibold truncate">{invoice.customer_name}</p>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString("de-DE")}
                    {invoice.due_date && <span className="ml-2">Fällig: {new Date(invoice.due_date).toLocaleDateString("de-DE")}</span>}
                  </div>
                  <div className="font-mono font-semibold">
                    {invoice.total_gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                  <button data-testid={`btn-edit-invoice-${invoice.id}`} onClick={(e) => handleEdit(invoice, e)} className="p-2 hover:bg-muted rounded-sm"><Edit className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDownloadPDF(invoice.id, invoice.invoice_number, e)} className="p-2 hover:bg-muted rounded-sm"><Download className="w-4 h-4" /></button>
                  {invoice.status === "Offen" && (
                    <button onClick={(e) => handleMarkPaid(invoice.id, e)} className="p-2 hover:bg-green-100 text-green-700 rounded-sm"><CheckCircle className="w-4 h-4" /></button>
                  )}
                  <button onClick={(e) => handleDelete(invoice.id, e)} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"><Trash2 className="w-4 h-4" /></button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden lg:block">
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
                  <tr 
                    key={invoice.id} 
                    className="border-b table-row-hover cursor-pointer"
                    onClick={() => setPreviewInvoice(invoice)}
                  >
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
                          data-testid={`btn-edit-invoice-${invoice.id}`}
                          onClick={(e) => handleEdit(invoice, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-download-invoice-${invoice.id}`}
                          onClick={(e) => handleDownloadPDF(invoice.id, invoice.invoice_number, e)}
                          className="p-2 hover:bg-muted rounded-sm"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {invoice.status === "Offen" && (
                          <button
                            data-testid={`btn-mark-paid-${invoice.id}`}
                            onClick={(e) => handleMarkPaid(invoice.id, e)}
                            className="p-2 hover:bg-green-100 text-green-700 rounded-sm"
                            title="Als bezahlt markieren"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-delete-invoice-${invoice.id}`}
                          onClick={(e) => handleDelete(invoice.id, e)}
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
        </>
      )}

      <DocumentPreview
        isOpen={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        document={previewInvoice}
        type="invoice"
        onDownload={(id, num) => handleDownloadPDF(id, num)}
        onEdit={(inv) => handleEdit(inv)}
      />
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
// ==================== PUSH NOTIFICATION SETTINGS ====================
const PushNotificationSettings = () => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    const hasBrowserSupport = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!hasBrowserSupport) {
      setPushSupported(false);
      setLoading(false);
      return;
    }
    const vapidKey = await ensureVapidKey();
    setPushSupported(!!vapidKey);
    if (vapidKey) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      } catch (e) {}
    }
    setLoading(false);
  };

  const togglePush = async () => {
    setLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast.success("Push-Benachrichtigungen deaktiviert");
      } else {
        const sub = await subscribeToPush();
        if (sub) {
          setPushEnabled(true);
          toast.success("Push-Benachrichtigungen aktiviert!");
        } else {
          toast.error("Bitte erlauben Sie Benachrichtigungen in Ihren Browser-Einstellungen.");
        }
      }
    } catch (err) {
      toast.error("Fehler: " + (err.message || "Unbekannter Fehler"));
    } finally {
      setLoading(false);
    }
  };

  const sendTestPush = async () => {
    try {
      const res = await api.post("/push/test");
      if (res.data.success) {
        toast.success(`Push gesendet an ${res.data.subscribers} Gerät(e). Warten Sie 5 Sekunden...`);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error("Fehler: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <Card className="p-4 lg:p-6 mt-6">
      <h3 className="text-base lg:text-lg font-semibold mb-4 flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        Push-Benachrichtigungen
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Erhalten Sie sofort eine Benachrichtigung auf Ihr Gerät, wenn eine neue Kundenanfrage über das Kontaktformular eingeht.
      </p>
      {!pushSupported ? (
        <div className="space-y-3">
          <p className="text-sm text-amber-600 font-medium">
            Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm space-y-2">
            <p className="font-medium text-amber-800">So aktivieren Sie Push-Benachrichtigungen:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-amber-700">
              <li>Öffnen Sie <strong>Google Chrome</strong> auf Ihrem Handy</li>
              <li>Gehen Sie zu dieser Seite: <code className="bg-amber-100 px-1 rounded text-xs break-all">{window.location.origin}</code></li>
              <li>Tippen Sie auf das <strong>3-Punkte-Menü</strong> (oben rechts)</li>
              <li>Wählen Sie <strong>"Zum Startbildschirm hinzufügen"</strong> oder <strong>"App installieren"</strong></li>
              <li>Öffnen Sie die App über das neue Icon auf Ihrem Homescreen</li>
              <li>Gehen Sie zu Einstellungen → Push-Benachrichtigungen → <strong>Aktivieren</strong></li>
            </ol>
            <p className="text-xs text-amber-600 mt-2">Hinweis: Samsung Internet unterstützt keine Web Push. Google Chrome ist empfohlen.</p>
          </div>
        </div>
      ) : (
        <div key="push-controls">
          <div className="flex items-center gap-3 flex-wrap">
            {pushEnabled ? (
              <div className="flex items-center gap-3 flex-wrap" key="enabled">
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Aktiv
                </span>
                <Button variant="outline" size="sm" onClick={sendTestPush} data-testid="btn-test-push">
                  Test senden
                </Button>
                <Button variant="outline" size="sm" onClick={togglePush} disabled={loading} data-testid="btn-toggle-push">
                  <BellOff className="w-4 h-4" />
                  {loading ? "..." : "Aus"}
                </Button>
              </div>
            ) : (
              <div key="disabled">
                <Button onClick={togglePush} disabled={loading} data-testid="btn-toggle-push">
                  <Bell className="w-4 h-4" />
                  {loading ? "..." : "Aktivieren"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

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
      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-1 text-sm lg:text-base">Firmendaten und Konfiguration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="p-4 lg:p-6">
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

      {/* Push Notifications Section */}
      <PushNotificationSettings />
    </div>
  );
};

// ==================== WEBHOOK DOCUMENTATION ====================
const WebhookDocPage = () => {
  const webhookUrl = `${BACKEND_URL}/api/webhook/contact`;
  const [testName, setTestName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState("");

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("In Zwischenablage kopiert!");
    setTimeout(() => setCopied(""), 2000);
  };

  const sendTestWebhook = async () => {
    if (!testName) { toast.error("Bitte Name eingeben"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API}/webhook/contact`, {
        name: testName, email: testEmail, phone: testPhone, message: testMessage
      });
      setTestResult({ success: true, data: res.data });
      toast.success("Test-Anfrage erfolgreich gesendet! Push-Benachrichtigung sollte erscheinen.");
    } catch (err) {
      setTestResult({ success: false, error: err.response?.data?.detail || err.message });
      toast.error("Fehler beim Senden");
    } finally {
      setTesting(false);
    }
  };

  const htmlSnippet = `<!-- Graupner Suite Kontaktformular -->
<form id="kontaktformular" onsubmit="sendToGraupner(event)">
  <input type="text" name="name" placeholder="Ihr Name" required />
  <input type="email" name="email" placeholder="E-Mail" />
  <input type="tel" name="phone" placeholder="Telefon" />
  <textarea name="message" placeholder="Ihre Nachricht"></textarea>
  <button type="submit">Anfrage senden</button>
</form>

<script>
async function sendToGraupner(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value,
    email: form.email.value,
    phone: form.phone.value,
    message: form.message.value
  };
  try {
    const res = await fetch("${webhookUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      alert("Anfrage erfolgreich gesendet!");
      form.reset();
    } else {
      alert("Fehler beim Senden. Bitte versuchen Sie es erneut.");
    }
  } catch (err) {
    alert("Verbindungsfehler. Bitte versuchen Sie es später erneut.");
  }
}
</script>`;

  const phpSnippet = `<?php
// === Graupner Suite Webhook ===
// Diesen Code in Ihre response.php einfügen
// (oder am Anfang Ihrer bestehenden response.php hinzufügen)

// Formulardaten sammeln
$topics = isset($_POST["topic"]) ? $_POST["topic"] : [];
$data = [
    "rolle"      => isset($_POST["rolle"]) ? $_POST["rolle"] : "",
    "anrede"     => isset($_POST["anrede"]) ? $_POST["anrede"] : "",
    "vorname"    => isset($_POST["vorname"]) ? $_POST["vorname"] : "",
    "nachname"   => isset($_POST["nachname"]) ? $_POST["nachname"] : "",
    "firma"      => isset($_POST["firma"]) ? $_POST["firma"] : "",
    "email"      => isset($_POST["email"]) ? $_POST["email"] : "",
    "telefon"    => isset($_POST["telefon"]) ? $_POST["telefon"] : "",
    "website"    => isset($_POST["website"]) ? $_POST["website"] : "",
    "strasse"    => isset($_POST["strasse"]) ? $_POST["strasse"] : "",
    "plz"        => isset($_POST["plz"]) ? $_POST["plz"] : "",
    "stadt"      => isset($_POST["stadt"]) ? $_POST["stadt"] : "",
    "topics"     => is_array($topics) ? $topics : [$topics],
    "nachricht"  => isset($_POST["nachricht"]) ? $_POST["nachricht"] : "",
    // Objektadresse (falls vorhanden)
    "objanrede"    => isset($_POST["objanrede"]) ? $_POST["objanrede"] : "",
    "objvorname"   => isset($_POST["objvorname"]) ? $_POST["objvorname"] : "",
    "objnachname"  => isset($_POST["objnachname"]) ? $_POST["objnachname"] : "",
    "objtelefon"   => isset($_POST["objtelefon"]) ? $_POST["objtelefon"] : "",
    "objemail"     => isset($_POST["objemail"]) ? $_POST["objemail"] : "",
    "objstrasse"   => isset($_POST["objstrasse"]) ? $_POST["objstrasse"] : "",
    "objplz"       => isset($_POST["objplz"]) ? $_POST["objplz"] : "",
    "objstadt"     => isset($_POST["objstadt"]) ? $_POST["objstadt"] : "",
    "objprojektnr" => isset($_POST["objprojektnr"]) ? $_POST["objprojektnr"] : ""
];

// An Graupner Suite senden
$ch = curl_init("${webhookUrl}");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Optional: Ergebnis loggen
// error_log("Graupner Suite Webhook: " . $httpCode . " - " . $response);

// Ihre bestehende response.php Logik hier weiter...
?>`;

  const phpSnippetSimple = `<?php
// Einfache Version - nur die wichtigsten Felder
$data = [
    "name"    => $_POST["vorname"] . " " . $_POST["nachname"],
    "email"   => $_POST["email"],
    "phone"   => $_POST["telefon"],
    "address" => $_POST["strasse"] . ", " . $_POST["plz"] . " " . $_POST["stadt"],
    "message" => $_POST["nachricht"]
];

$ch = curl_init("${webhookUrl}");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_exec($ch);
curl_close($ch);
?>`;

  return (
    <div data-testid="webhook-doc-page">
      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Website-Integration</h1>
        <p className="text-muted-foreground mt-1 text-sm lg:text-base">Verbinden Sie Ihr Kontaktformular mit der Graupner Suite</p>
      </div>

      {/* Webhook URL */}
      <Card className="p-4 lg:p-6 mb-4 lg:mb-6 border-primary/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-sm shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base lg:text-lg">Ihre Webhook-URL</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Diese URL empfängt Anfragen von Ihrem Website-Kontaktformular und erstellt automatisch einen neuen Kunden.
            </p>
            <div className="flex items-center gap-2 bg-slate-100 rounded-sm p-3 overflow-x-auto">
              <code className="text-sm font-mono text-primary break-all flex-1" data-testid="webhook-url">{webhookUrl}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl, "url")}
                className="shrink-0"
                data-testid="btn-copy-url"
              >
                <Copy className="w-4 h-4" />
                {copied === "url" ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Left: Code Snippets */}
        <div className="space-y-4 lg:space-y-6">
          {/* JSON Format */}
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              Datenformat (JSON)
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Ihr Kontaktformular muss die Daten als JSON im folgenden Format senden:
            </p>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 rounded-sm p-4 text-xs lg:text-sm overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "name": "Max Mustermann",     // Pflichtfeld
  "email": "max@example.de",    // Optional
  "phone": "0171 1234567",      // Optional
  "address": "Musterstr. 1",    // Optional
  "message": "Ich brauche..."   // Optional
}`}
              </pre>
              <button
                onClick={() => copyToClipboard(`{\n  "name": "Max Mustermann",\n  "email": "max@example.de",\n  "phone": "0171 1234567",\n  "message": "Anfrage..."\n}`, "json")}
                className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* HTML Snippet */}
          <Card className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Code className="w-5 h-5 text-orange-500" />
                HTML / JavaScript
              </h3>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(htmlSnippet, "html")}>
                <Copy className="w-4 h-4" />
                {copied === "html" ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Kopieren Sie diesen Code in Ihre Website. Das Formular sendet Anfragen direkt an die Graupner Suite.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-sm p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {htmlSnippet}
            </pre>
          </Card>

          {/* PHP Snippet */}
          <Card className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-500" />
                Ihre response.php anpassen
              </h3>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(phpSnippet, "php")}>
                <Copy className="w-4 h-4" />
                {copied === "php" ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Fügen Sie diesen Code <strong>am Anfang</strong> Ihrer bestehenden <code className="bg-slate-100 px-1 rounded">response.php</code> ein. 
              Er leitet alle Formularfelder (Rolle, Name, Adresse, Themen, Nachricht, Objektdaten) an die Graupner Suite weiter.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-sm p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {phpSnippet}
            </pre>
          </Card>
        </div>

        {/* Right: Test Form */}
        <div className="space-y-4 lg:space-y-6">
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Test-Formular
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Testen Sie hier, ob der Webhook funktioniert. Die Anfrage wird als neuer Kunde gespeichert und Sie erhalten eine Push-Benachrichtigung.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <Input
                  data-testid="input-test-name"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">E-Mail</label>
                <Input
                  data-testid="input-test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="max@example.de"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <Input
                  data-testid="input-test-phone"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="0171 1234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nachricht</label>
                <Textarea
                  data-testid="input-test-message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Ich brauche eine neue Küche..."
                  rows={3}
                />
              </div>
              <Button
                data-testid="btn-send-test-webhook"
                onClick={sendTestWebhook}
                disabled={testing}
                className="w-full"
              >
                <Send className="w-4 h-4" />
                {testing ? "Sende..." : "Test-Anfrage senden"}
              </Button>
            </div>

            {testResult && (
              <div className={`mt-4 p-3 rounded-sm text-sm ${testResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                {testResult.success ? (
                  <>
                    <p className="font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Erfolgreich!</p>
                    <p className="mt-1">Neuer Kunde wurde angelegt. Prüfen Sie Ihre Push-Benachrichtigungen und die Kundenliste.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Fehler</p>
                    <p className="mt-1">{testResult.error}</p>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* How it works */}
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold mb-3">So funktioniert es</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">1</div>
                <div>
                  <p className="font-medium text-sm">Besucher füllt Kontaktformular aus</p>
                  <p className="text-xs text-muted-foreground">Auf Ihrer Website (z.B. graupner-tischlerei.de)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">2</div>
                <div>
                  <p className="font-medium text-sm">Daten werden an Webhook gesendet</p>
                  <p className="text-xs text-muted-foreground">Automatisch per JavaScript oder PHP</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">3</div>
                <div>
                  <p className="font-medium text-sm">Neuer Kunde wird angelegt</p>
                  <p className="text-xs text-muted-foreground">Automatisch in der Graupner Suite gespeichert</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">4</div>
                <div>
                  <p className="font-medium text-sm">Push-Benachrichtigung</p>
                  <p className="text-xs text-muted-foreground">Sie werden sofort auf Ihrem Handy/PC benachrichtigt</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN LAYOUT ====================
const MainLayout = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLogout={onLogout} />
      <MobileNav onLogout={onLogout} />
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 px-4 lg:px-8 py-4 lg:py-8">{children}</main>
    </div>
  );
};

// ==================== APP ====================
function App() {
  const { token, login, logout, isAuthenticated } = useAuth();

  // Auto-subscribe to push notifications when authenticated
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
                element={<WysiwygDocumentEditor type="quote" />}
              />
              <Route
                path="/quotes/edit/:id"
                element={<WysiwygDocumentEditor type="quote" />}
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
                path="/orders/edit/:id"
                element={<WysiwygDocumentEditor type="order" />}
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
                element={<WysiwygDocumentEditor type="invoice" />}
              />
              <Route
                path="/invoices/edit/:id"
                element={<WysiwygDocumentEditor type="invoice" />}
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
              <Route
                path="/webhook"
                element={
                  <MainLayout onLogout={logout}>
                    <WebhookDocPage />
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
