import { useEffect, useState } from "react";
import {
  Mail, Plus, Pencil, Trash2, TestTube, Loader2, CheckCircle2, XCircle,
  Power, PowerOff, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";

const EMPTY_FORM = {
  label: "",
  server: "secure.emailsrvr.com",
  port: 993,
  username: "",
  password: "",
  active: true,
};

const ImapAccountsCard = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);  // null=new, {id} = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testingForm, setTestingForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/module-mail-inbox/accounts");
      setItems(r.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Konnte Postfächer nicht laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (acc) => {
    setEditing(acc);
    setForm({
      label: acc.label,
      server: acc.server,
      port: acc.port || 993,
      username: acc.username,
      password: "",  // leer = unverändert lassen
      active: acc.active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    if (!form.label.trim() || !form.server.trim() || !form.username.trim()) {
      toast.error("Bitte Beschriftung, Server und Benutzer ausfüllen.");
      return;
    }
    if (!editing && !form.password) {
      toast.error("Beim Anlegen ist ein Passwort Pflicht.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/module-mail-inbox/accounts/${editing.id}`, form);
        toast.success("Postfach aktualisiert");
      } else {
        await api.post("/module-mail-inbox/accounts", form);
        toast.success("Postfach angelegt");
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (acc) => {
    if (!window.confirm(`Postfach "${acc.label}" wirklich entfernen?`)) return;
    try {
      await api.delete(`/module-mail-inbox/accounts/${acc.id}`);
      toast.success("Postfach entfernt");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  const toggleActive = async (acc) => {
    try {
      await api.put(`/module-mail-inbox/accounts/${acc.id}`, {
        label: acc.label,
        server: acc.server,
        port: acc.port || 993,
        username: acc.username,
        password: "",
        active: !acc.active,
      });
      toast.success(acc.active ? "Postfach pausiert" : "Postfach aktiviert");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Status ändern fehlgeschlagen");
    }
  };

  const testSaved = async (acc) => {
    setTestingId(acc.id);
    try {
      const r = await api.post(`/module-mail-inbox/accounts/${acc.id}/test`);
      if (r.data?.ok) {
        toast.success(r.data.message || "Verbindung OK");
      } else {
        toast.error(r.data?.message || "Verbindung fehlgeschlagen");
      }
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Test fehlgeschlagen");
    } finally {
      setTestingId(null);
    }
  };

  const testForm = async () => {
    if (!form.server || !form.username || !form.password) {
      toast.error("Server, Benutzer und Passwort ausfüllen.");
      return;
    }
    setTestingForm(true);
    try {
      const r = await api.post("/module-mail-inbox/accounts/test-credentials", form);
      toast.success(r.data?.message || "Verbindung OK");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Test fehlgeschlagen");
    } finally {
      setTestingForm(false);
    }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="imap-accounts-card">
      <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> IMAP-Postfächer (für Anfragen-Modul)
        </h3>
        <Button
          variant="outline"
          onClick={openNew}
          data-testid="btn-add-imap-account"
        >
          <Plus className="w-4 h-4" />
          Neues Postfach
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Beliebig viele IMAP-Postfächer hinterlegen. Beim "Mails abrufen" werden alle
        aktiven Postfächer gescannt. Lese-Markierungen auf dem Server bleiben unverändert
        (read-only), damit Live und Vorschau parallel arbeiten können.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Postfächer…
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded">
          Noch kein Postfach hinterlegt.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-3 border rounded p-3 flex-wrap"
              data-testid={`imap-account-row-${acc.id}`}
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{acc.label}</span>
                  {acc.active ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      aktiv
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      pausiert
                    </span>
                  )}
                  {acc.last_test_ok === true && (
                    <span className="text-xs flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" /> Test OK
                    </span>
                  )}
                  {acc.last_test_ok === false && (
                    <span className="text-xs flex items-center gap-1 text-red-700">
                      <XCircle className="w-3 h-3" /> Test fehlgeschlagen
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {acc.username} · {acc.server}:{acc.port}
                </div>
                {acc.last_test_message && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 italic">
                    {acc.last_test_message}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testSaved(acc)}
                  disabled={testingId === acc.id}
                  title="Verbindung testen"
                  data-testid={`btn-test-imap-account-${acc.id}`}
                >
                  {testingId === acc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive(acc)}
                  title={acc.active ? "Pausieren" : "Aktivieren"}
                  data-testid={`btn-toggle-imap-account-${acc.id}`}
                >
                  {acc.active ? (
                    <PowerOff className="w-4 h-4" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(acc)}
                  title="Bearbeiten"
                  data-testid={`btn-edit-imap-account-${acc.id}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remove(acc)}
                  title="Löschen"
                  data-testid={`btn-delete-imap-account-${acc.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editing ? "Postfach bearbeiten" : "Neues IMAP-Postfach"}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Beschriftung</label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="z.B. Hauptpostfach, Schiebetür-Test, Jimdo-Backup"
              data-testid="input-imap-form-label"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">IMAP-Server</label>
              <Input
                value={form.server}
                onChange={(e) => setForm({ ...form, server: e.target.value })}
                placeholder="secure.emailsrvr.com"
                data-testid="input-imap-form-server"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 993 })}
                placeholder="993"
                data-testid="input-imap-form-port"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Benutzer / E-Mail</label>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="info@deine-domain.de"
              data-testid="input-imap-form-username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Passwort {editing && <span className="text-xs text-muted-foreground">(leer lassen = unverändert)</span>}
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? "••••••••" : "App-Passwort"}
              data-testid="input-imap-form-password"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-input"
              data-testid="input-imap-form-active"
            />
            Postfach aktiv (wird beim Mail-Abruf gescannt)
          </label>
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="outline"
              onClick={testForm}
              disabled={testingForm}
              data-testid="btn-imap-form-test"
            >
              {testingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              Verbindung testen
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={closeForm}
                disabled={saving}
                data-testid="btn-imap-form-cancel"
              >
                <X className="w-4 h-4" />
                Abbrechen
              </Button>
              <Button
                onClick={submit}
                disabled={saving}
                data-testid="btn-imap-form-save"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editing ? "Speichern" : "Anlegen"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default ImapAccountsCard;
