import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Share2, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Upload, Image, FileText, X, Eye, Calendar, Lock, User, Search, Send, MessageSquare, Download, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";

const PortalsPage = () => {
  const location = useLocation();
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [portalFiles, setPortalFiles] = useState([]);
  const [customers, setCustomers] = useState([]);

  const loadPortals = useCallback(async () => {
    try {
      const res = await api.get("/portals");
      setPortals(res.data);
    } catch (e) {
      toast.error("Fehler beim Laden der Portale");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortals();
    api.get("/modules/kunden/data").then(r => setCustomers(r.data)).catch(() => {});
  }, [loadPortals]);

  // Query-Parameter ?portal=<id> -> Portal direkt oeffnen
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const portalId = params.get("portal");
    if (!portalId || portals.length === 0) return;
    const target = portals.find(p => p.id === portalId);
    if (target) {
      setSelectedPortal(target);
      loadFiles(target.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, portals]);

  const loadFiles = async (portalId) => {
    try {
      const res = await api.get(`/portals/${portalId}/files`);
      setPortalFiles(res.data);
    } catch (e) {
      toast.error("Fehler beim Laden der Dateien");
    }
  };

  const openPortal = (portal) => {
    setSelectedPortal(portal);
    loadFiles(portal.id);
  };

  const downloadPasswortDatei = () => {
    const lines = ["KUNDENPORTAL - PASSWORTLISTE", "=============================", `Erstellt: ${new Date().toLocaleDateString("de-DE")}`, ""];
    portals.forEach(p => {
      lines.push(`Kunde:    ${p.customer_name || "-"}`);
      lines.push(`E-Mail:   ${p.customer_email || "-"}`);
      lines.push(`Passwort: ${p.password_plain || "?"}`);
      lines.push(`Status:   ${p.active ? "Aktiv" : "Deaktiviert"}`);
      lines.push(`Gültig:   ${p.expires_at ? new Date(p.expires_at).toLocaleDateString("de-DE") : "-"}`);
      lines.push(`Link:     ${window.location.origin}/portal/${p.token}`);
      lines.push("-----------------------------");
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Kundenportal_Passwoerter_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Passwort-Datei heruntergeladen");
  };

  const toggleActive = async (portal) => {
    try {
      await api.put(`/portals/${portal.id}`, { active: !portal.active });
      toast.success(portal.active ? "Portal deaktiviert" : "Portal aktiviert");
      loadPortals();
      if (selectedPortal?.id === portal.id) {
        setSelectedPortal(p => ({ ...p, active: !p.active }));
      }
    } catch (e) {
      toast.error("Fehler");
    }
  };

  const deletePortal = async (portalId) => {
    if (!window.confirm("Portal wirklich löschen?")) return;
    try {
      await api.delete(`/portals/${portalId}`);
      toast.success("Portal gelöscht");
      if (selectedPortal?.id === portalId) setSelectedPortal(null);
      loadPortals();
    } catch (e) {
      toast.error("Fehler beim Löschen");
    }
  };

  const copyLink = (portal) => {
    const url = `${window.location.origin}/portal/${portal.token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Link kopiert!");
  };

  const copyPassword = (portal) => {
    if (portal.password_plain) {
      navigator.clipboard.writeText(portal.password_plain).catch(() => {});
      toast.success("Passwort kopiert!");
    }
  };

  const uploadBusinessFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", file.name);
    try {
      await api.post(`/portals/${selectedPortal.id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Datei hochgeladen");
      loadFiles(selectedPortal.id);
    } catch (e) {
      toast.error("Upload fehlgeschlagen");
    }
    e.target.value = "";
  };

  const deleteFile = async (fileId) => {
    try {
      await api.delete(`/portals/files/${fileId}`);
      toast.success("Datei gelöscht");
      loadFiles(selectedPortal.id);
    } catch (e) {
      toast.error("Fehler");
    }
  };

  const isExpired = (portal) => new Date(portal.expires_at) < new Date();

  const getPortalUrl = (portal) => `${window.location.origin}/portal/${portal.token}`;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Kundenportale</h1>
          <p className="text-muted-foreground mt-1 text-sm">{portals.length} Portale</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPasswortDatei}
            className="flex items-center gap-2 border px-4 py-2 rounded-sm text-sm font-medium hover:bg-muted"
            data-testid="btn-download-passwords"
            title="Passwort-Datei herunterladen"
          >
            <Download className="w-4 h-4" />
            Passwort-Datei
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium hover:bg-primary/90"
            data-testid="btn-create-portal"
          >
            <Plus className="w-4 h-4" />
            Neues Portal
          </button>
        </div>
      </div>

      {showCreate && (
        <CreatePortalDialog
          customers={customers}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadPortals(); }}
        />
      )}

      {selectedPortal ? (
        <PortalDetail
          portal={selectedPortal}
          files={portalFiles}
          onBack={() => setSelectedPortal(null)}
          onUpload={uploadBusinessFile}
          onDeleteFile={deleteFile}
          onToggle={() => toggleActive(selectedPortal)}
          onCopyLink={() => copyLink(selectedPortal)}
          getPortalUrl={getPortalUrl}
        />
      ) : (
        <div className="grid gap-4">
          {portals.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              Noch keine Kundenportale erstellt. Erstellen Sie ein Portal, um Dateien mit Kunden auszutauschen.
            </Card>
          )}
          {portals.map((portal) => (
            <Card
              key={portal.id}
              className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${!portal.active || isExpired(portal) ? "opacity-60" : ""}`}
              onClick={() => openPortal(portal)}
              data-testid={`portal-card-${portal.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold truncate">{portal.customer_name}</h3>
                    {portal.customer_has_new_content && (
                      <Badge className="bg-red-500 text-white animate-pulse" data-testid={`badge-new-${portal.id}`}>● NEU</Badge>
                    )}
                    {portal.locked_reason === "rate_limit" && (
                      <Badge className="bg-red-100 text-red-700" title="Automatisch gesperrt wegen Rate-Limit">🔒 Gesperrt</Badge>
                    )}
                    {!portal.active ? (
                      <Badge className="bg-red-100 text-red-700">Deaktiviert</Badge>
                    ) : isExpired(portal) ? (
                      <Badge className="bg-amber-100 text-amber-700">Abgelaufen</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700">Aktiv</Badge>
                    )}
                  </div>
                  {portal.description && <p className="text-sm text-muted-foreground mb-1">{portal.description}</p>}
                  {portal.customer_email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Mail className="w-3 h-3" />
                      <span>{portal.customer_email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Erstellt: {new Date(portal.created_at).toLocaleDateString("de-DE")}
                    </span>
                    <span>Gültig bis: {new Date(portal.expires_at).toLocaleDateString("de-DE")}</span>
                    {portal.password_plain && (
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        PW: {portal.password_plain}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyLink(portal); }}
                    className="p-2 hover:bg-muted rounded-sm"
                    title="Link kopieren"
                    data-testid={`btn-copy-link-${portal.id}`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleActive(portal); }}
                    className="p-2 hover:bg-muted rounded-sm"
                    title={portal.active ? "Deaktivieren" : "Aktivieren"}
                  >
                    {portal.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePortal(portal.id); }}
                    className="p-2 hover:bg-red-50 rounded-sm text-red-500"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};


const CreatePortalDialog = ({ customers, onClose, onCreated }) => {
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [weeks, setWeeks] = useState(8);
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCustomerSelect = (e) => {
    const id = e.target.value;
    setCustomerId(id);
    const c = customers.find(c => c.id === id);
    if (c) {
      const displayName = c.vorname || c.nachname ? `${c.vorname || ""} ${c.nachname || ""}`.trim() : (c.name || "");
      setCustomerName(displayName);
      setCustomerEmail(c.email || "");
    }
  };

  const handleCreate = async () => {
    if (!customerName.trim()) { toast.error("Kundenname erforderlich"); return; }
    if (!password.trim()) { toast.error("Passwort erforderlich"); return; }
    if (sendEmail && !customerEmail.trim()) { toast.error("E-Mail-Adresse erforderlich für den Versand"); return; }
    setSaving(true);
    try {
      const res = await api.post("/portals", {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        description,
        password,
        weeks
      });
      const portalUrl = `${window.location.origin}/portal/${res.data.token}`;
      navigator.clipboard.writeText(portalUrl).catch(() => {});

      if (sendEmail && customerEmail) {
        try {
          await api.post(`/portals/${res.data.id}/send-email`, { portal_url: portalUrl });
          toast.success("Portal erstellt! E-Mail mit Zugangsdaten an Kunden gesendet.");
        } catch (emailErr) {
          toast.success("Portal erstellt! E-Mail konnte nicht gesendet werden – Link wurde kopiert.");
        }
      } else {
        toast.success("Portal erstellt! Link wurde kopiert.");
      }
      onCreated();
    } catch (e) {
      toast.error("Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="create-portal-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Neues Kundenportal</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kunde auswählen</label>
            <select
              value={customerId}
              onChange={handleCustomerSelect}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="select-customer"
            >
              <option value="">-- Kunde wählen oder Name eingeben --</option>
              {customers.map(c => {
                const displayName = c.vorname || c.nachname ? `${c.vorname || ""} ${c.nachname || ""}`.trim() : (c.name || "Unbenannt");
                return <option key={c.id} value={c.id}>{displayName}{c.firma ? ` (${c.firma})` : ""}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kundenname</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="Name des Kunden"
              data-testid="input-customer-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-Mail des Kunden</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="kunde@example.de"
              data-testid="input-customer-email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung (Projekt)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="z.B. Dachsanierung Hauptstraße 12"
              data-testid="input-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Passwort</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                placeholder="Zugangspasswort"
                data-testid="input-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gültig (Wochen)</label>
              <input
                type="number"
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
                min={1}
                max={52}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="input-weeks"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-send-email">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Portal-Link per E-Mail an Kunden senden</span>
          </label>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-save-portal"
          >
            {saving ? "Erstelle..." : "Portal erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
};


const PortalDetail = ({ portal, files, onBack, onUpload, onDeleteFile, onToggle, onCopyLink, getPortalUrl }) => {
  const customerFiles = files.filter(f => f.uploaded_by === "customer");
  const businessFiles = files.filter(f => f.uploaded_by === "business");
  const [notes, setNotes] = useState([]);
  const [adminNotes, setAdminNotes] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [vorlagen, setVorlagen] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    api.get(`/portals/${portal.id}/files`).catch(() => {});
    api.get("/portals").then(res => {
      const p = res.data.find(x => x.id === portal.id);
      if (p?.customer_notes) setNotes(p.customer_notes);
      if (p?.admin_notes) setAdminNotes(p.admin_notes);
    }).catch(() => {});
    api.get("/modules/textvorlagen/data?doc_type=kundenportal").then(res => setVorlagen(res.data)).catch(() => {});
    // Mark as read when opening the portal detail
    api.post(`/portals/${portal.id}/mark-read`, {}).catch(() => {});
  }, [portal.id]);

  const filtered = vorlagen.filter(v =>
    (v.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.content || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const applyVorlage = (vorlage) => {
    let text = vorlage.content || "";
    // Strip HTML tags, die ggf. aus Rich-Text-Editor stammen
    text = text.replace(/<br\s*\/?>(?!\n)/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]*>/g, "");
    // Anrede aus Kundennamen ableiten: "Herr Mueller" / "Frau Schmidt" / sonst "Damen und Herren"
    const fullName = (portal.customer_name || "").trim();
    let anredeBrief = "Sehr geehrte Damen und Herren";
    const cleanName = fullName.replace(/^(Herr|Frau|Divers)\s+/i, "").trim();
    const parts = cleanName.split(/\s+/);
    const nachname = parts.length > 1 ? parts[parts.length - 1] : cleanName;
    if (/^Herr\s+/i.test(fullName)) anredeBrief = `Sehr geehrter Herr ${nachname}`;
    else if (/^Frau\s+/i.test(fullName)) anredeBrief = `Sehr geehrte Frau ${nachname}`;
    else if (nachname) anredeBrief = `Sehr geehrte/r ${cleanName}`;

    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    text = text
      .replace(/\{anrede_brief\}/g, anredeBrief)
      .replace(/\{kunde_name\}/g, fullName)
      .replace(/\{kunde_email\}/g, portal.customer_email || "")
      .replace(/\{kunde_telefon\}/g, portal.customer_phone || "")
      .replace(/\{firma\}/g, "Tischlerei Graupner")
      .replace(/\{firma_name\}/g, "Tischlerei Graupner")
      .replace(/\{datum\}/g, today);
    setMsgText(text);
    setSearchTerm(vorlage.title || "");
    setShowResults(false);
  };

  const [showPreview, setShowPreview] = useState(false);

  const sendAdminNote = async () => {
    if (!msgText.trim()) { toast.error("Nachricht darf nicht leer sein"); return; }
    setSending(true);
    try {
      const note = await api.post(`/portals/${portal.id}/admin-notes`, { text: msgText });
      setAdminNotes(prev => [...prev, note.data]);
      setMsgText("");
      setSearchTerm("");
      setShowPreview(false);
      toast.success("Nachricht an Kunden gesendet");
    } catch { toast.error("Fehler beim Senden"); }
    finally { setSending(false); }
  };

  const noteTypeLabels = { korrektur: "Korrektur", hinweis: "Hinweis", termin: "Terminvorschlag", zusatz: "Zusatzinfo", admin: "Ihre Nachricht" };
  const noteTypeColors = { korrektur: "text-orange-700 bg-orange-50", hinweis: "text-blue-700 bg-blue-50", termin: "text-green-700 bg-green-50", zusatz: "text-purple-700 bg-purple-50", admin: "text-emerald-700 bg-emerald-50" };

  return (
    <div data-testid="portal-detail">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        &larr; Zurück zur Übersicht
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{portal.customer_name}</h2>
          {portal.description && <p className="text-muted-foreground text-sm">{portal.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>Gültig bis: {new Date(portal.expires_at).toLocaleDateString("de-DE")}</span>
            <span>PW: <code className="bg-muted px-1 rounded">{portal.password_plain || "***"}</code></span>
            {portal.active ? (
              <Badge className="bg-green-100 text-green-700">Aktiv</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700">Deaktiviert</Badge>
            )}
          </div>
          {portal.customer_email && (
            <div className="flex items-center gap-4 mt-3 text-sm">
              <a href={`mailto:${portal.customer_email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="w-3.5 h-3.5" /> {portal.customer_email}
              </a>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onCopyLink} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted" data-testid="btn-copy-portal-link">
            <Copy className="w-3.5 h-3.5" /> Link kopieren
          </button>
          <button onClick={onToggle} className="flex items-center gap-1 px-3 py-1.5 border rounded-sm text-sm hover:bg-muted">
            {portal.active ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            {portal.active ? "Deaktivieren" : "Aktivieren"}
          </button>
        </div>
      </div>

      <div className="border rounded-sm p-2 mb-6 flex items-center gap-2 text-sm bg-muted/50">
        <Share2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <code className="text-xs truncate flex-1">{getPortalUrl(portal)}</code>
        <button onClick={onCopyLink} className="text-xs text-primary hover:underline flex-shrink-0">Kopieren</button>
      </div>

      {/* Kundenmitteilungen */}
      {notes.length > 0 && (
        <div className="mb-6" data-testid="portal-customer-notes">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Kundenmitteilungen ({notes.length})
          </h3>
          <div className="space-y-2">
            {notes.map(note => (
              <div key={note.id} className="border rounded-sm p-3 bg-background">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${noteTypeColors[note.type] || "text-gray-700 bg-gray-50"}`}>
                    {noteTypeLabels[note.type] || note.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString("de-DE")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ihre Nachrichten an den Kunden */}
      {adminNotes.length > 0 && (
        <div className="mb-6" data-testid="portal-admin-notes">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            Ihre Nachrichten ({adminNotes.length})
          </h3>
          <div className="space-y-2">
            {adminNotes.map(note => (
              <div key={note.id} className="border border-emerald-200 rounded-sm p-3 bg-emerald-50/50">
                <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString("de-DE")}</span>
                <p className="text-sm whitespace-pre-wrap mt-1">{note.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nachricht verfassen mit Textbausteinen */}
      <Card className="p-4 mb-6" data-testid="portal-message-composer">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          Nachricht an Kunden senden
        </h3>
        <div className="space-y-3">
          <div className="relative">
            <label className="block text-sm font-medium mb-1">Textbaustein wählen</label>
            <div className="relative">
              <input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                className="w-full border rounded-sm p-2 text-sm pr-8"
                placeholder="Vorlage suchen... z.B. Bilder"
                data-testid="portal-vorlage-search"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute right-2.5 top-2.5" />
            </div>
            {showResults && (
              <div className="absolute z-10 mt-1 w-full bg-background border rounded-sm shadow-lg max-h-48 overflow-y-auto" data-testid="portal-vorlage-results">
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Keine Vorlagen gefunden</p>
                ) : (
                  filtered.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => applyVorlage(v)}
                      className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                      data-testid={`portal-vorlage-${v.id}`}
                    >
                      <p className="text-sm font-medium">{v.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{(v.content || "").replace(/<[^>]*>/g, "").slice(0, 80)}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <textarea
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            className="w-full border rounded-sm p-2 text-sm min-h-[120px] resize-y"
            placeholder="Nachricht an den Kunden..."
            data-testid="portal-message-text"
          />
          <div className="flex justify-end">
            <button
              onClick={() => setShowPreview(true)}
              disabled={sending || !msgText.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
              data-testid="btn-send-portal-message"
            >
              <Send className="w-4 h-4" />
              Vorschau &amp; Senden
            </button>
          </div>
        </div>
      </Card>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="admin-send-preview">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Nachricht an Kunden – Vorschau</h3>
              <p className="text-xs text-muted-foreground mt-1">Prüfen Sie die Nachricht, bevor sie im Kundenportal sichtbar wird.</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-muted-foreground">An: <span className="font-medium text-foreground">{portal.customer_name}</span> &middot; {portal.customer_email}</div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm text-sm whitespace-pre-wrap">{msgText}</div>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <strong>Hinweis:</strong> Diese Nachricht erscheint sofort im Kundenportal und der Kunde erhält eine Benachrichtigung.
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Zurück</button>
              <button onClick={sendAdminNote} disabled={sending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2" data-testid="btn-confirm-send">
                <Send className="w-4 h-4" /> {sending ? "Sende..." : "Verbindlich senden"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Kundenbilder */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Image className="w-4 h-4" />
            Kundenbilder ({customerFiles.length})
          </h3>
          {customerFiles.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Noch keine Bilder vom Kunden hochgeladen
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {customerFiles.map(f => (
                <FileCard key={f.id} file={f} onDelete={onDeleteFile} />
              ))}
            </div>
          )}
        </div>

        {/* Geschäftsdokumente */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Ihre Dokumente ({businessFiles.length})
          </h3>
          <label
            className="flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-sm cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground mb-3"
            data-testid="btn-upload-business-file"
          >
            <Upload className="w-4 h-4" />
            Dokument hochladen (PDF, Bild)
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onUpload} />
          </label>
          {businessFiles.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Noch keine Dokumente hochgeladen
            </Card>
          ) : (
            <div className="space-y-2">
              {businessFiles.map(f => (
                <FileCard key={f.id} file={f} onDelete={onDeleteFile} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


const FileCard = ({ file, onDelete }) => {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (file.content_type?.startsWith("image/")) {
      api.get(`/portal/file/${file.id}`, { responseType: "blob" })
        .then(res => setPreviewUrl(URL.createObjectURL(res.data)))
        .catch(() => {});
    }
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [file.id, file.content_type]);

  const openFile = () => {
    const url = `${API}/portal/file/${file.id}`;
    window.open(url, "_blank");
  };

  return (
    <div className="border rounded-sm overflow-hidden bg-background">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={file.original_filename}
          className="w-full h-32 object-cover cursor-pointer"
          onClick={openFile}
        />
      ) : (
        <div className="w-full h-32 bg-muted flex items-center justify-center cursor-pointer" onClick={openFile}>
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="p-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs truncate">{file.original_filename}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(file.created_at).toLocaleDateString("de-DE")} · {file.uploaded_by === "customer" ? "Kunde" : "Geschäft"}
          </p>
        </div>
        <button onClick={() => onDelete(file.id)} className="p-1 text-red-400 hover:text-red-600" title="Löschen">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export { PortalsPage };
