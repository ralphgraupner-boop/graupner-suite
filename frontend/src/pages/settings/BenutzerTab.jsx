import { useState, useEffect } from "react";
import { Mail, Save, Plus, Pencil, Trash2, Users, Key, User, Eye, EyeOff, RefreshCw, Copy, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";

const BenutzerTab = () => {
  const [users, setUsers] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", email: "", role: "mitarbeiter" });
  const [editUser, setEditUser] = useState(null);
  const [editData, setEditData] = useState({ email: "", role: "" });
  const [changePassword, setChangePassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portals, setPortals] = useState([]);
  const [portalsLoading, setPortalsLoading] = useState(true);
  const [editPerms, setEditPerms] = useState(null);
  const [perms, setPerms] = useState({});
  const [notifPrefs, setNotifPrefs] = useState({ popup_papierkorb: false, popup_kundenlink_expiry: false });
  const [permsSaving, setPermsSaving] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(null); // {action: "perms"|"password"|"delete"|"edit", username: "..."}
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const PERM_LABELS_MITARBEITER = {
    mitarbeiter_stammdaten: "Stammdaten bearbeiten",
    mitarbeiter_lohn: "Lohn & Gehalt",
    mitarbeiter_urlaub: "Urlaub verwalten",
    mitarbeiter_krankmeldungen: "Krankmeldungen",
    mitarbeiter_dokumente: "Dokumente verwalten",
    mitarbeiter_fortbildungen: "Fortbildungen",
    mitarbeiter_anlegen_loeschen: "Mitarbeiter anlegen/löschen",
  };
  const PERM_LABELS_MODULE = {
    modul_mail_anfragen: "Mail-Anfragen",
    modul_kunden: "Kunden",
    modul_projekte: "Projekte",
    modul_aufgaben: "Aufgaben",
    modul_termine: "Termine",
    modul_einsaetze: "Einsätze",
    modul_dokumente: "Dokumente",
    modul_kundenportale: "Kundenportale",
    modul_monteur_app: "Monteur-App",
    modul_buchhaltung: "Buchhaltung",
    modul_einstellungen: "Einstellungen",
  };
  const PERM_LABELS_BENACHRICHTIGUNGEN = {
    popup_papierkorb: "Papierkorb-Hinweis beim Login",
    popup_kundenlink_expiry: "Kunden-Link Ablauf-Hinweis beim Login",
  };
  const PERM_LABELS = { ...PERM_LABELS_MITARBEITER, ...PERM_LABELS_MODULE };

  useEffect(() => { loadUsers(); loadPortals(); }, []);

  const loadPortals = async () => {
    try { const res = await api.get("/portals"); setPortals(res.data); } catch {} finally { setPortalsLoading(false); }
  };

  const loadUsers = async () => {
    try { const res = await api.get("/users"); setUsers(res.data); } catch { toast.error("Fehler beim Laden"); }
  };

  const loadPerms = async (username) => {
    try {
      const [permsRes, notifRes] = await Promise.all([
        api.get(`/users/${username}/berechtigungen`),
        api.get(`/module-benachrichtigungen/${username}`).catch(() => ({ data: { prefs: {} } })),
      ]);
      setPerms(permsRes.data);
      setNotifPrefs({
        popup_papierkorb: !!notifRes.data?.prefs?.popup_papierkorb,
        popup_kundenlink_expiry: !!notifRes.data?.prefs?.popup_kundenlink_expiry,
      });
      setEditPerms(username);
    } catch { toast.error("Fehler beim Laden der Berechtigungen"); }
  };

  const currentUsername = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      return u?.username || "";
    } catch { return ""; }
  })();

  const verifyAdminPassword = async () => {
    try {
      const res = await api.post("/auth/login", { username: currentUsername, password: authPassword });
      if (res.data.token) {
        const { action, username } = authPrompt;
        setAuthPrompt(null);
        setAuthPassword("");
        setAuthError("");
        if (action === "perms") loadPerms(username);
        else if (action === "password") { setChangePassword(username); setNewPassword(""); }
        else if (action === "delete") {
          try {
            await api.delete(`/users/${username}`);
            toast.success("Benutzer gelöscht");
            loadUsers();
          } catch (err) {
            toast.error(err.response?.data?.detail || "Löschen fehlgeschlagen");
          }
        }
        else if (action === "edit") {
          const user = users.find(u => u.username === username);
          if (user) {
            setEditData({ email: user.email || "", role: user.role || "mitarbeiter" });
            setEditUser(username);
          }
        }
      }
    } catch {
      setAuthError("Falsches Passwort");
    }
  };

  const savePerms = async () => {
    setPermsSaving(true);
    try {
      await Promise.all([
        api.put(`/users/${editPerms}/berechtigungen`, perms),
        api.put(`/module-benachrichtigungen/${editPerms}`, { prefs: notifPrefs }),
      ]);
      toast.success("Berechtigungen gespeichert");
      setEditPerms(null);
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
    finally { setPermsSaving(false); }
  };

  const handleCreate = async () => {
    if (!newUser.username || !newUser.password) { toast.error("Benutzername und Passwort erforderlich"); return; }
    setSaving(true);
    try {
      await api.post("/users", newUser);
      toast.success("Benutzer erstellt");
      setShowNew(false);
      setNewUser({ username: "", password: "", email: "", role: "mitarbeiter" });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler");
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${editUser}`, editData);
      toast.success("Benutzer aktualisiert");
      setEditUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler");
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error("Mindestens 4 Zeichen"); return; }
    try {
      await api.put(`/users/${changePassword}/password`, { password: newPassword });
      toast.success("Passwort geändert");
    } catch (err) { toast.error(err.response?.data?.detail || "Fehler"); }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const special = "!@#$%&*";
    let pw = "";
    for (let i = 0; i < 10; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    pw += special.charAt(Math.floor(Math.random() * special.length));
    setNewPassword(pw);
    setShowPassword(true);
  };

  const copyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    toast.success("Passwort kopiert");
  };

  const sendCredentialsEmail = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error("Erst Passwort setzen/generieren"); return; }
    const targetUser = users.find(u => u.username === changePassword);
    if (!targetUser?.email) { toast.error("Keine E-Mail-Adresse beim Benutzer hinterlegt"); return; }
    setSendingEmail(true);
    try {
      await api.put(`/users/${changePassword}/password`, { password: newPassword });
      await api.post(`/users/${changePassword}/send-credentials`, { password: newPassword });
      toast.success(`Zugangsdaten an ${targetUser.email} gesendet`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Senden");
    } finally { setSendingEmail(false); }
  };

  return (
    <Card className="p-4 lg:p-6" data-testid="user-management">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Benutzer-Verwaltung</h3>
          <p className="text-sm text-muted-foreground mt-1">Verwalten Sie die Zugänge zur Graupner Suite.</p>
        </div>
        <Button onClick={() => setShowNew(true)} data-testid="btn-add-user"><Plus className="w-4 h-4" /> Neuer Benutzer</Button>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.username} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border" data-testid={`user-${u.username}`}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {u.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{u.username}</p>
              <p className="text-xs text-muted-foreground">{u.email || "Keine E-Mail"} &middot; {u.role || "admin"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAuthPrompt({ action: "edit", username: u.username }); setAuthPassword(""); setAuthError(""); }} data-testid={`btn-edit-${u.username}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setAuthPrompt({ action: "perms", username: u.username }); setAuthPassword(""); setAuthError(""); }} data-testid={`btn-perms-${u.username}`}>
                <Shield className="w-3.5 h-3.5" /> Rechte
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setAuthPrompt({ action: "password", username: u.username }); setAuthPassword(""); setAuthError(""); }} data-testid={`btn-pw-${u.username}`}>
                <Key className="w-3.5 h-3.5" /> Passwort
              </Button>
              <button
                onClick={() => { setAuthPrompt({ action: "delete", username: u.username }); setAuthPassword(""); setAuthError(""); }}
                className="p-2 rounded-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                data-testid={`btn-delete-${u.username}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Keine Benutzer gefunden</p>}
      </div>


      {/* Passwort-Bestätigung des aktuell eingeloggten Users */}
      <Modal isOpen={!!authPrompt} onClose={() => setAuthPrompt(null)} title="Passwort bestätigen">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bitte geben Sie das Passwort von <strong>{currentUsername}</strong> ein um fortzufahren.
          </p>
          <div>
            <Input
              type="password"
              value={authPassword}
              onChange={(e) => { setAuthPassword(e.target.value); setAuthError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && authPassword) verifyAdminPassword(); }}
              placeholder={`Passwort von ${currentUsername}`}
              autoFocus
              data-testid="input-auth-password"
            />
            {authError && <p className="text-xs text-red-500 mt-1">{authError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAuthPrompt(null)}>Abbrechen</Button>
            <Button onClick={verifyAdminPassword} disabled={!authPassword} data-testid="btn-auth-confirm">
              Bestätigen
            </Button>
          </div>
        </div>
      </Modal>


      {/* New User Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Neuer Benutzer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Benutzername</label>
            <Input data-testid="input-new-username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="z.B. mueller" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Passwort</label>
            <Input data-testid="input-new-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mindestens 4 Zeichen" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-Mail (optional)</label>
            <Input data-testid="input-new-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="benutzer@firma.de" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rolle</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3" data-testid="select-new-role">
              <option value="admin">Admin</option>
              <option value="buchhaltung">Buchhaltung</option>
              <option value="mitarbeiter">Mitarbeiter</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={saving} data-testid="btn-create-user">{saving ? "..." : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>

      {/* Benutzer bearbeiten Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Benutzer bearbeiten: ${editUser}`}>
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <strong>Hinweis:</strong> Der Benutzername kann nicht geändert werden.
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-Mail</label>
            <Input 
              type="email" 
              value={editData.email} 
              onChange={(e) => setEditData({ ...editData, email: e.target.value })} 
              placeholder="benutzer@firma.de" 
              data-testid="input-edit-email" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rolle</label>
            <select 
              value={editData.role} 
              onChange={(e) => setEditData({ ...editData, role: e.target.value })} 
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
              data-testid="select-edit-role"
            >
              <option value="admin">Admin</option>
              <option value="buchhaltung">Buchhaltung</option>
              <option value="mitarbeiter">Mitarbeiter</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditUser(null)}>Abbrechen</Button>
            <Button onClick={handleEdit} disabled={saving} data-testid="btn-save-edit-user">
              {saving ? "..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>


      {/* Change Password Modal */}
      <Modal isOpen={!!changePassword} onClose={() => { setChangePassword(null); setNewPassword(""); setShowPassword(false); }} title={`Passwort ändern: ${changePassword}`}>
        <div className="space-y-4">
          {(() => { const targetUser = users.find(u => u.username === changePassword); return targetUser?.email ? (
            <p className="text-sm text-muted-foreground">E-Mail: <strong>{targetUser.email}</strong></p>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 rounded p-2">Keine E-Mail hinterlegt – E-Mail-Versand nicht möglich.</p>
          ); })()}
          <div>
            <label className="block text-sm font-medium mb-1">Neues Passwort</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input data-testid="input-change-password" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mindestens 4 Zeichen" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1" data-testid="btn-toggle-pw-visibility">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={generatePassword} data-testid="btn-generate-pw" title="Zufallspasswort generieren">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={copyPassword} disabled={!newPassword} data-testid="btn-copy-pw" title="Passwort kopieren">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {newPassword && showPassword && (
            <div className="bg-muted/50 border rounded p-3 font-mono text-sm tracking-wider text-center select-all" data-testid="pw-display">
              {newPassword}
            </div>
          )}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => { setChangePassword(null); setNewPassword(""); setShowPassword(false); }}>Abbrechen</Button>
              <Button onClick={handlePasswordChange} disabled={!newPassword || newPassword.length < 4} data-testid="btn-change-password">Passwort speichern</Button>
            </div>
            {(() => { const targetUser = users.find(u => u.username === changePassword); return targetUser?.email ? (
              <Button variant="secondary" className="w-full" onClick={sendCredentialsEmail} disabled={sendingEmail || !newPassword || newPassword.length < 4} data-testid="btn-send-credentials">
                <Mail className="w-4 h-4 mr-2" />
                {sendingEmail ? "Wird gesendet..." : `Zugangsdaten an ${targetUser.email} senden`}
              </Button>
            ) : null; })()}
          </div>
        </div>
      </Modal>

      {/* Berechtigungen Modal */}
      <Modal isOpen={!!editPerms} onClose={() => setEditPerms(null)} title={`Berechtigungen: ${editPerms}`}>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground mb-4">Welche Rechte hat <strong>{editPerms}</strong>?</p>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2 mb-1">Mitarbeiter-Bereiche</h4>
          {Object.entries(PERM_LABELS_MITARBEITER).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors" data-testid={`perm-${key}`}>
              <input
                type="checkbox"
                checked={perms[key] || false}
                onChange={(e) => setPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                className="rounded w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}

          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">Modul-Zugriffsrechte</h4>
          {Object.entries(PERM_LABELS_MODULE).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors" data-testid={`perm-${key}`}>
              <input
                type="checkbox"
                checked={perms[key] || false}
                onChange={(e) => setPerms(prev => ({ ...prev, [key]: e.target.checked }))}
                className="rounded w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}

          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">Benachrichtigungen &amp; Meldungen</h4>
          {Object.entries(PERM_LABELS_BENACHRICHTIGUNGEN).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors" data-testid={`notif-${key}`}>
              <input
                type="checkbox"
                checked={notifPrefs[key] || false}
                onChange={(e) => setNotifPrefs(prev => ({ ...prev, [key]: e.target.checked }))}
                className="rounded w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}

          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <button onClick={() => { const all = {}; Object.keys(PERM_LABELS).forEach(k => all[k] = true); setPerms(all); }} className="text-xs text-primary hover:underline" data-testid="btn-select-all-perms">Alle auswählen</button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditPerms(null)}>Abbrechen</Button>
              <Button onClick={savePerms} disabled={permsSaving} data-testid="btn-save-perms">
                <Save className="w-4 h-4 mr-1" /> {permsSaving ? "..." : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Portal-Passwörter */}
      <Card className="p-4 lg:p-6 mt-6" data-testid="portal-passwords-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Kundenportal-Passwörter
          </h3>
          <Button
            variant="outline"
            size="sm"
            disabled={portals.length === 0}
            onClick={() => {
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
            }}
            data-testid="btn-download-passwords-settings"
          >
            <Save className="w-4 h-4" /> Als Datei speichern
          </Button>
        </div>
        {portalsLoading ? (
          <div className="flex items-center justify-center h-16"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>
        ) : portals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Kundenportale vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Kunde</th>
                  <th className="pb-2 font-medium">E-Mail</th>
                  <th className="pb-2 font-medium">Passwort</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Gültig bis</th>
                </tr>
              </thead>
              <tbody>
                {portals.map(p => (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="py-2 pr-3">{p.customer_name || "-"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.customer_email || "-"}</td>
                    <td className="py-2 pr-3 font-mono text-xs bg-muted/50 px-2 rounded">{p.password_plain || "?"}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {p.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{p.expires_at ? new Date(p.expires_at).toLocaleDateString("de-DE") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Card>
  );
};



export { BenutzerTab };
