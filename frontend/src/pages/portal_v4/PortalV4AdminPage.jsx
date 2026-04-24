import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Settings as SettingsIcon, Power, Mail, Download, Send, CheckCircle2 } from "lucide-react";
import { PortalV4ImportDialog } from "@/pages/portal_v4/PortalV4ImportDialog";

/**
 * Kundenportal v4 – Admin-Übersicht (Phase 1: Gerüst + CRUD)
 *
 * Strikt isoliert. Keine Abhängigkeit zum alten PortalsPage / portal.py.
 * Backend: /api/portal-v4/admin/*
 */
export function PortalV4AdminPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        api.get("/portal-v4/admin/settings"),
        api.get("/portal-v4/admin/accounts"),
      ]);
      setSettings(sRes.data || {});
      setAccounts(Array.isArray(aRes.data) ? aRes.data : []);
    } catch (err) {
      toast.error("Laden fehlgeschlagen: " + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const toggleFeature = async () => {
    try {
      const res = await api.put("/portal-v4/admin/settings", { feature_enabled: !settings?.feature_enabled });
      setSettings(res.data);
      toast.success(res.data.feature_enabled ? "Modul aktiviert" : "Modul deaktiviert");
    } catch (err) {
      toast.error("Speichern fehlgeschlagen: " + (err?.response?.data?.detail || err.message));
    }
  };

  const openNew = () => {
    setEditAccount(null);
    setForm({ name: "", email: "", notes: "" });
    setShowNew(true);
  };

  const openEdit = (account) => {
    setEditAccount(account);
    setForm({ name: account.name || "", email: account.email || "", notes: account.notes || "" });
    setShowNew(true);
  };

  const save = async () => {
    if (!form.email || !form.name) {
      toast.error("Name und E-Mail sind Pflicht");
      return;
    }
    try {
      if (editAccount) {
        await api.put(`/portal-v4/admin/accounts/${editAccount.id}`, form);
        toast.success("Account aktualisiert");
      } else {
        await api.post("/portal-v4/admin/accounts", form);
        toast.success("Account angelegt");
      }
      setShowNew(false);
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const removeAccount = async (account) => {
    if (!window.confirm(`Account "${account.name}" wirklich löschen?`)) return;
    try {
      await api.delete(`/portal-v4/admin/accounts/${account.id}`);
      toast.success("Gelöscht");
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const sendInvite = async (account) => {
    if (!window.confirm(`Einladung an ${account.email} senden?\n\nDas generiert ein neues Passwort und verschickt den Zugang per Mail.`)) return;
    try {
      const res = await api.post(`/portal-v4/admin/accounts/${account.id}/invite`);
      if (res.data?.sent) {
        toast.success(`Einladung an ${account.email} gesendet`);
      } else {
        toast.warning("Einladung erstellt, aber Mail-Versand hat nicht funktioniert. Link kopieren?");
      }
      if (res.data?.login_url) {
        try {
          await navigator.clipboard.writeText(res.data.login_url);
          toast.info("Login-Link in Zwischenablage kopiert");
        } catch { /* ignore clipboard errors */ }
      }
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  return (
    <div className="space-y-6" data-testid="portal-v2-admin-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Kundenportal v4</h1>
            <p className="text-sm text-muted-foreground">
              Eigenständiges Modul · isoliert vom alten Portal
              {settings && (
                <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${settings.feature_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  <Power className="w-3 h-3" />
                  {settings.feature_enabled ? "Aktiv" : "Inaktiv"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted text-sm"
            data-testid="portal-v2-settings-btn"
          >
            <SettingsIcon className="w-4 h-4" />
            Einstellungen
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted text-sm"
            data-testid="portal-v2-import-btn"
          >
            <Download className="w-4 h-4" />
            Aus Kundenkartei
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm"
            data-testid="portal-v2-new-account-btn"
          >
            <Plus className="w-4 h-4" />
            Neuer Account
          </button>
        </div>
      </div>

      <PortalV4ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadAll}
      />

      {/* Settings-Panel */}
      {showSettings && settings && (
        <div className="p-4 border rounded-xl bg-card space-y-3" data-testid="portal-v2-settings-panel">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Modul-Status</div>
              <div className="text-xs text-muted-foreground">
                Wenn inaktiv, ist das Modul für Endkunden geschlossen. Admin-Ansicht bleibt erreichbar.
              </div>
            </div>
            <button
              onClick={toggleFeature}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${settings.feature_enabled ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"}`}
              data-testid="portal-v2-feature-toggle"
            >
              {settings.feature_enabled ? "Aktiv" : "Inaktiv"}
            </button>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-3">
            <div>Rate-Limit Uploads: {settings.rate_limit_uploads} pro {Math.round((settings.rate_limit_window_sec || 3600) / 60)} Min.</div>
            <div>Weitere Einstellungen folgen in Phase 3 (E-Mail-Templates).</div>
          </div>
        </div>
      )}

      {/* Accounts-Tabelle */}
      <div className="border rounded-xl overflow-hidden bg-card" data-testid="portal-v2-accounts-list">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <div className="text-sm font-medium">
            {loading ? "Lade…" : `${accounts.length} Account${accounts.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {!loading && accounts.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Noch keine Accounts angelegt.
            <br />
            Klicke oben rechts auf <strong>„Neuer Account"</strong> um zu starten.
            <br />
            <span className="text-xs">Import aus Kundenkartei folgt in Phase 2.</span>
          </div>
        )}

        {!loading && accounts.length > 0 && (
          <div className="divide-y">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition cursor-pointer"
                onClick={() => navigate(`/portal-v4/detail/${a.id}`)}
                data-testid={`portal-v2-account-row-${a.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.name || "(ohne Name)"}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3" />
                    {a.email}
                    {!a.active && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">inaktiv</span>}
                  </div>
                  {a.notes && <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.notes}</div>}
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {a.last_login ? (
                    <span className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 mr-1" title={`Letzter Login: ${a.last_login}`}>
                      <CheckCircle2 className="w-3 h-3" /> eingeloggt
                    </span>
                  ) : a.invite_sent_at ? (
                    <span className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 mr-1" title={`Einladung: ${a.invite_sent_at}`}>
                      <Send className="w-3 h-3" /> eingeladen
                    </span>
                  ) : (
                    <span className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 mr-1">
                      offen
                    </span>
                  )}
                  <button
                    onClick={() => sendInvite(a)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    title={a.invite_sent_at ? "Einladung erneut senden (neues Passwort)" : "Einladung senden"}
                    data-testid={`portal-v2-invite-${a.id}`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Bearbeiten"
                    data-testid={`portal-v2-edit-${a.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeAccount(a)}
                    className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                    title="Löschen"
                    data-testid={`portal-v2-delete-${a.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog: Neu / Bearbeiten */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div
            className="bg-card rounded-xl shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            data-testid="portal-v2-account-dialog"
          >
            <div className="font-semibold text-lg">
              {editAccount ? "Account bearbeiten" : "Neuer Account"}
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  data-testid="portal-v2-form-name"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">E-Mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  data-testid="portal-v2-form-email"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Notizen (optional)</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  data-testid="portal-v2-form-notes"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowNew(false)}
                className="px-3 py-2 rounded-lg border text-sm hover:bg-muted"
                data-testid="portal-v2-form-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={save}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90"
                data-testid="portal-v2-form-save"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortalV4AdminPage;
