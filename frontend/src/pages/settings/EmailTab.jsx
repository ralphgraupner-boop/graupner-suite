import { useState, useEffect } from "react";
import { Mail, Save, Bell, BellOff, Plus, Pencil, Trash2, FileText, CheckCircle, Send, TestTube, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { subscribeToPush, unsubscribeFromPush, ensureVapidKey } from "@/lib/push";
import ImapAccountsCard from "@/components/ImapAccountsCard";

const SignaturVorschau = () => {
  const [signatur, setSignatur] = useState("");
  const [open, setOpen] = useState(false);

  const loadSignatur = async () => {
    try {
      const res = await api.get("/email/signatur-vorschau");
      setSignatur(res.data.email_signatur);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (open && !signatur) loadSignatur(); }, [open]);

  return (
    <Card className="p-4 lg:p-6" data-testid="signatur-vorschau-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> E-Mail-Signatur & DSGVO-Fußzeile
        </h3>
        <span className="text-xs text-muted-foreground">{open ? "Schließen" : "Vorschau anzeigen"}</span>
      </button>
      {open && signatur && (
        <div className="mt-4 border rounded-sm p-4 bg-white" data-testid="signatur-vorschau-html" dangerouslySetInnerHTML={{ __html: signatur }} />
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Diese Signatur wird automatisch an alle ausgehenden E-Mails angehängt (inkl. Dokumente, Mahnungen, Antworten).
        Datei: <code className="text-primary">utils/email_signatur.py</code>
      </p>
    </Card>
  );
};


// ==================== EMAIL TAB ====================
// ==================== E-MAIL VORLAGEN MANAGER ====================
const EmailVorlagenManager = () => {
  const [vorlagen, setVorlagen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", betreff: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const res = await api.get("/email/vorlagen");
      setVorlagen(res.data);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = vorlagen.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.betreff.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditItem("new"); setForm({ name: "", betreff: "", text: "" }); };
  const openEdit = (v) => { setEditItem(v.id); setForm({ name: v.name, betreff: v.betreff, text: v.text }); };

  const handleSave = async () => {
    if (!form.name) { toast.error("Name erforderlich"); return; }
    setSaving(true);
    try {
      if (editItem === "new") {
        await api.post("/email/vorlagen", form);
        toast.success("Vorlage erstellt");
      } else {
        await api.put(`/email/vorlagen/${editItem}`, form);
        toast.success("Vorlage aktualisiert");
      }
      setEditItem(null);
      load();
    } catch { toast.error("Fehler beim Speichern"); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/email/vorlagen/${id}`);
      toast.success("Vorlage gelöscht");
      load();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="email-vorlagen-settings">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> E-Mail-Vorlagen
        </h3>
        <Button size="sm" onClick={openNew} data-testid="btn-new-vorlage">
          <Plus className="w-4 h-4" /> Neue Vorlage
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Vorlagen für schnellen E-Mail-Versand aus Anfragen und anderen Modulen.
      </p>

      {vorlagen.length > 3 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Vorlagen durchsuchen..."
          className="mb-3"
          data-testid="search-vorlagen"
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-16"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Noch keine Vorlagen. Erstellen Sie die erste!</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {filtered.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3 border rounded-sm hover:bg-muted/30 transition-colors" data-testid={`vorlage-row-${v.id}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground truncate">{v.betreff}</p>
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button onClick={() => openEdit(v)} className="p-1.5 hover:bg-muted rounded-sm" title="Bearbeiten">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(v.id)} className="p-1.5 hover:bg-red-50 rounded-sm text-red-500" title="Löschen">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title={editItem === "new" ? "Neue E-Mail-Vorlage" : "Vorlage bearbeiten"}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name (zum Suchen)</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Bilder anfordern" data-testid="vorlage-name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Betreff</label>
            <Input value={form.betreff} onChange={(e) => setForm({ ...form, betreff: e.target.value })} placeholder="z.B. Bitte um Zusendung von Fotos" data-testid="vorlage-betreff" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <Textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder={"Sehr geehrte/r {kunde_name},\n\nbitte senden Sie uns Fotos des Schadens...\n\nMit freundlichen Grüßen\nTischlerei Graupner"}
              rows={6}
              data-testid="vorlage-text"
            />
            <p className="text-xs text-muted-foreground mt-1">Platzhalter: {"{kunde_name}"}, {"{email}"}, {"{firma_name}"}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-vorlage">
              {saving ? "Speichere..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

const EmailTab = ({ settings, setSettings, onSave, saving }) => {
  const [testing, setTesting] = useState(false);
  const [imapTesting, setImapTesting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [imapFolders, setImapFolders] = useState([]);

  const handleTestSmtp = async () => {
    setTesting(true);
    try {
      const res = await api.post("/settings/smtp-test", {
        smtp_server: settings.smtp_server,
        smtp_port: settings.smtp_port,
        smtp_user: settings.smtp_user,
        smtp_password: settings.smtp_password,
        smtp_from: settings.smtp_from || settings.smtp_user,
      });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.detail || "SMTP-Test fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  };

  const handleTestImap = async () => {
    setImapTesting(true);
    try {
      const res = await api.post("/imap/test", {
        imap_server: settings.imap_server,
        imap_port: settings.imap_port,
        imap_user: settings.imap_user,
        imap_password: settings.imap_password,
      });
      toast.success(res.data.message);
      setImapFolders(res.data.folders || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "IMAP-Test fehlgeschlagen");
    } finally {
      setImapTesting(false);
    }
  };

  const handleFetchEmails = async () => {
    setFetching(true);
    try {
      const res = await api.post("/imap/fetch");
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.detail || "E-Mail-Abruf fehlgeschlagen");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 lg:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> SMTP E-Mail-Einstellungen
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Konfigurieren Sie den E-Mail-Versand für Angebote, Rechnungen und Mahnungen.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">SMTP-Server</label>
              <Input data-testid="input-smtp-server" value={settings.smtp_server} onChange={(e) => setSettings({ ...settings, smtp_server: e.target.value })} placeholder="z.B. secure.emailsrvr.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <Input data-testid="input-smtp-port" type="number" value={settings.smtp_port} onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 465 })} placeholder="465" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Benutzername / E-Mail</label>
              <Input data-testid="input-smtp-user" value={settings.smtp_user} onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })} placeholder="service24@tischlerei-graupner.de" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Passwort</label>
              <Input data-testid="input-smtp-password" type="password" value={settings.smtp_password} onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })} placeholder="********" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Absender-Adresse (falls abweichend)</label>
            <Input data-testid="input-smtp-from" value={settings.smtp_from} onChange={(e) => setSettings({ ...settings, smtp_from: e.target.value })} placeholder="Gleich wie Benutzername, wenn leer" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Portal-Kontroll-Kopie (BCC) <span className="text-xs text-muted-foreground font-normal">· empfängt automatisch alle Kundenportal-Mails zur Kontrolle/Analyse</span></label>
            <Input data-testid="input-portal-bcc-admin" value={settings.portal_bcc_admin || ""} onChange={(e) => setSettings({ ...settings, portal_bcc_admin: e.target.value })} placeholder="z.B. info@tischlerei-graupner.de — leer = aus" />
            <p className="text-xs text-muted-foreground mt-1">
              Wenn gesetzt: jede Portal-Chat-Nachricht (Admin ↔ Kunde) und die Portal-Einladung werden als Kopie an diese Adresse zugestellt.
              Der Kunde sieht diese Adresse NICHT (BCC).
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="btn-test-smtp" variant="outline" onClick={handleTestSmtp} disabled={testing}>
            <TestTube className="w-4 h-4" />
            {testing ? "Teste..." : "Verbindung testen"}
          </Button>
          <Button data-testid="btn-save-email" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "..." : "Speichern"}
          </Button>
        </div>
      </Card>

      <WiedervorlageSettings settings={settings} setSettings={setSettings} onSave={onSave} saving={saving} />

      {/* E-Mail-Signatur Vorschau */}
      <SignaturVorschau />

      {/* E-Mail-Vorlagen */}
      <EmailVorlagenManager />

      {/* IMAP Einstellungen */}
      <Card className="p-4 lg:p-6" data-testid="imap-settings">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> IMAP E-Mail-Empfang
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          E-Mails automatisch abrufen und als Anfragen importieren.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">IMAP-Server</label>
              <Input data-testid="input-imap-server" value={settings.imap_server || ""} onChange={(e) => setSettings({ ...settings, imap_server: e.target.value })} placeholder="z.B. imap.emailsrvr.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <Input data-testid="input-imap-port" type="number" value={settings.imap_port || 993} onChange={(e) => setSettings({ ...settings, imap_port: parseInt(e.target.value) || 993 })} placeholder="993" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Benutzername / E-Mail</label>
              <Input data-testid="input-imap-user" value={settings.imap_user || ""} onChange={(e) => setSettings({ ...settings, imap_user: e.target.value })} placeholder="service24@tischlerei-graupner.de" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Passwort</label>
              <Input data-testid="input-imap-password" type="password" value={settings.imap_password || ""} onChange={(e) => setSettings({ ...settings, imap_password: e.target.value })} placeholder="********" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ordner</label>
              {imapFolders.length > 0 ? (
                <select data-testid="select-imap-folder" value={settings.imap_folder || "INBOX"} onChange={(e) => setSettings({ ...settings, imap_folder: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
                  {imapFolders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <Input data-testid="input-imap-folder" value={settings.imap_folder || "INBOX"} onChange={(e) => setSettings({ ...settings, imap_folder: e.target.value })} placeholder="INBOX" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rueckblick-Zeitraum (Tage)</label>
              <Input
                type="number"
                min="1"
                max="365"
                data-testid="input-imap-lookback-days"
                value={settings.imap_lookback_days ?? 30}
                onChange={(e) => setSettings({ ...settings, imap_lookback_days: parseInt(e.target.value) || 30 })}
                placeholder="30"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Graupner Suite holt alle Mails der letzten X Tage (auch schon gelesene). Duplikate werden automatisch vermieden.<br/>
                <strong>30 Tage</strong> = Standard. Erhöhen z.B. auf 90 wenn Sie viele alte Anfragen importieren wollen.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Auto-Abruf Intervall (Minuten)</label>
                <Input
                  type="number"
                  min="5"
                  max="1440"
                  data-testid="input-imap-interval"
                  value={settings.imap_polling_interval || 30}
                  onChange={(e) => setSettings({ ...settings, imap_polling_interval: parseInt(e.target.value) || 30 })}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  E-Mails werden automatisch alle X Minuten abgerufen (5-1440 Min)
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer h-10">
                <input type="checkbox" checked={settings.imap_enabled || false} onChange={(e) => setSettings({ ...settings, imap_enabled: e.target.checked })} className="h-4 w-4 rounded border-input" />
                <span className="text-sm font-medium">IMAP aktiv</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button data-testid="btn-test-imap" variant="outline" onClick={handleTestImap} disabled={imapTesting}>
            <TestTube className="w-4 h-4" />
            {imapTesting ? "Teste..." : "Verbindung testen"}
          </Button>
          <Button data-testid="btn-fetch-imap" variant="outline" onClick={handleFetchEmails} disabled={fetching}>
            <Mail className="w-4 h-4" />
            {fetching ? "Abrufe..." : "Jetzt abrufen"}
          </Button>
          <Button data-testid="btn-save-imap" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "..." : "Speichern"}
          </Button>
        </div>
      </Card>

      <EmailIgnoreListCard />

      <ImapAccountsCard />

      <PushNotificationSettings />
    </div>
  );
};


const EmailIgnoreListCard = () => {
  const [patterns, setPatterns] = useState([]);
  const [newPattern, setNewPattern] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/imap/ignore-list");
        setPatterns(res.data.patterns || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const persist = async (next) => {
    setSaving(true);
    try {
      await api.put("/imap/ignore-list", { patterns: next });
      setPatterns(next);
      toast.success("Filter-Liste gespeichert");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally { setSaving(false); }
  };

  const addPattern = async () => {
    const v = newPattern.trim().toLowerCase();
    if (!v) return;
    if (patterns.includes(v)) { toast.info("Muster existiert bereits"); return; }
    await persist([...patterns, v]);
    setNewPattern("");
  };

  const removePattern = async (p) => {
    await persist(patterns.filter((x) => x !== p));
  };

  const cleanupExisting = async () => {
    setCleaning(true);
    try {
      const res = await api.post("/imap/ignore-list/cleanup");
      toast.success(`${res.data.deleted} bereits vorhandene Mails entfernt`);
    } catch (err) {
      toast.error("Cleanup fehlgeschlagen");
    } finally { setCleaning(false); }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="card-email-ignore-list">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Mail className="w-5 h-5 text-primary" /> E-Mail-Filter (Ignore-Liste)
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Absender oder Domains die hier stehen werden <strong>nicht</strong> in die Graupner Suite importiert (bleiben nur in Ihrem Mailprogramm wie Betterbird).
        <br />Tipp: Als Muster einfach die Domain eintragen (z.B. <code className="bg-muted px-1 rounded-sm">paypal.com</code>) oder ein Teil des Absenders (z.B. <code className="bg-muted px-1 rounded-sm">newsletter</code>).
      </p>

      <div className="flex gap-2 mb-4">
        <Input
          data-testid="input-new-ignore-pattern"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPattern(); } }}
          placeholder="z.B. paypal.com oder newsletter@"
          className="flex-1"
        />
        <Button data-testid="btn-add-ignore-pattern" onClick={addPattern} disabled={saving || !newPattern.trim()}>
          <Plus className="w-4 h-4" /> Hinzufügen
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Lade...</div>
      ) : patterns.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Noch keine Filter definiert.</div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {patterns.map((p) => (
            <span key={p} className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-full text-xs font-mono" data-testid={`pattern-chip-${p}`}>
              {p}
              <button
                onClick={() => removePattern(p)}
                className="hover:text-destructive transition-colors"
                title="Entfernen"
                data-testid={`btn-remove-${p}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-3 border-t">
        <Button
          data-testid="btn-cleanup-inbox"
          variant="outline"
          onClick={cleanupExisting}
          disabled={cleaning || patterns.length === 0}
        >
          {cleaning ? "Bereinige..." : "Bereits importierte Mails entfernen"}
        </Button>
        <span className="text-xs text-muted-foreground">Entfernt alle Einträge in der Inbox, die zur aktuellen Filter-Liste passen.</span>
      </div>
    </Card>
  );
};


const WiedervorlageSettings = ({ settings, setSettings, onSave, saving }) => {
  return (
    <Card className="p-4 lg:p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" /> Wiedervorlage-Einstellungen
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Automatische Erinnerung bei Angeboten die nicht beantwortet wurden.
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Wiedervorlage nach (Tagen)</label>
            <Input
              data-testid="input-followup-days"
              type="number"
              min={1}
              value={settings.followup_days || 7}
              onChange={(e) => setSettings({ ...settings, followup_days: parseInt(e.target.value) || 7 })}
              placeholder="7"
            />
            <p className="text-xs text-muted-foreground mt-1">Angebote werden nach dieser Anzahl Tage zur Wiedervorlage vorgeschlagen.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Automatische Push-Benachrichtigung</label>
            <select
              data-testid="select-followup-push"
              className="w-full border rounded px-3 py-2 text-sm"
              value={settings.followup_push_enabled === false ? "false" : "true"}
              onChange={(e) => setSettings({ ...settings, followup_push_enabled: e.target.value === "true" })}
            >
              <option value="true">Aktiviert</option>
              <option value="false">Deaktiviert</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Push-Nachricht wenn Angebote zur Wiedervorlage fällig sind.</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button data-testid="btn-save-followup" onClick={onSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "..." : "Speichern"}
        </Button>
      </div>
    </Card>
  );
};


const PushNotificationSettings = () => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkPushStatus(); }, []);

  const checkPushStatus = async () => {
    const hasBrowserSupport = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!hasBrowserSupport) { setPushSupported(false); setLoading(false); return; }
    const vapidKey = await ensureVapidKey();
    setPushSupported(!!vapidKey);
    if (vapidKey) {
      try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); setPushEnabled(!!sub); } catch {}
    }
    setLoading(false);
  };

  const togglePush = async () => {
    setLoading(true);
    try {
      if (pushEnabled) { await unsubscribeFromPush(); setPushEnabled(false); toast.success("Push deaktiviert"); }
      else { const sub = await subscribeToPush(); if (sub) { setPushEnabled(true); toast.success("Push aktiviert!"); } else { toast.error("Bitte Benachrichtigungen im Browser erlauben."); } }
    } catch (err) { toast.error("Fehler: " + (err.message || "")); } finally { setLoading(false); }
  };

  return (
    <Card className="p-4 lg:p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Push-Benachrichtigungen</h3>
      <p className="text-sm text-muted-foreground mb-4">Benachrichtigung bei neuen Kundenanfragen.</p>
      {!pushSupported ? (
        <p className="text-sm text-amber-600">Push wird in diesem Browser nicht unterstützt. Nutzen Sie Chrome und installieren Sie die App.</p>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          {pushEnabled ? (
            <>
              <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Aktiv</span>
              <Button variant="outline" size="sm" onClick={async () => { try { await api.post("/push/test"); toast.success("Test-Push gesendet"); } catch {} }} data-testid="btn-test-push">Test senden</Button>
              <Button variant="outline" size="sm" onClick={togglePush} disabled={loading} data-testid="btn-toggle-push"><BellOff className="w-4 h-4" /> Aus</Button>
            </>
          ) : (
            <Button onClick={togglePush} disabled={loading} data-testid="btn-toggle-push"><Bell className="w-4 h-4" /> {loading ? "..." : "Aktivieren"}</Button>
          )}
        </div>
      )}
    </Card>
  );
};



export { EmailTab };
