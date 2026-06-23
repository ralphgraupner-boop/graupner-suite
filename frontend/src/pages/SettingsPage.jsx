import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Save, FileText, Building2, Users, Palette, Package, Calculator, BookOpen, HardHat, HelpCircle, Smartphone, FolderTree, Flag, MessageSquare, Wrench } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MitarbeiterModulPage } from "./MitarbeiterModulPage";
import { DocumentTemplatesPanel } from "@/components/DocumentTemplatesPanel";
import { HilfeTab } from "@/components/HilfeTab";
import { HelpTip } from "@/components/HelpTip";
import { useF1Help } from "@/lib/useF1Help";

import { FirmendatenTab } from "./settings/FirmendatenTab";
import { KalkulationTab } from "./settings/KalkulationTab";
import { EmailTab } from "./settings/EmailTab";
import { BenutzerTab } from "./settings/BenutzerTab";
import { DokumentVorlagenTab } from "./settings/DokumentVorlagenTab";
import { DiversesTab } from "./settings/DiversesTab";
import { BackupTab } from "./settings/BackupTab";
import { ModuleTab } from "./settings/ModuleTab";
import { KategorienGruppenTab } from "./settings/KategorienGruppenTab";
import { KeywordPrioritaetenTab } from "./settings/KeywordPrioritaetenTab";
import { BegruessungsvorlagenTab } from "./settings/BegruessungsvorlagenTab";

// ==================== TAB CONFIG ====================
const TABS = [
  { id: "firma", label: "Firmendaten", icon: Building2 },
  { id: "kalkulation", label: "Kalkulation", icon: Calculator },
  { id: "email", label: "E-Mail", icon: Mail },
  { id: "benutzer", label: "Benutzer", icon: Users },
  { id: "mitarbeiter", label: "Mitarbeiter", icon: HardHat },
  { id: "dokumente", label: "Dokument-Vorlagen", icon: Palette },
  { id: "doc-templates", label: "Angebot/Rechnung-Vorlagen", icon: Package },
  { id: "kategorien", label: "Kategorien & Gruppen", icon: FolderTree },
  { id: "keyword-prio", label: "Keyword-Prioritäten", icon: Flag },
  { id: "begruessung", label: "Begrüßungsvorlagen", icon: MessageSquare },
  { id: "diverses", label: "Diverses / Info", icon: BookOpen },
  { id: "backup", label: "Backup", icon: Save },
  { id: "module", label: "Module", icon: Package },
  { id: "wartung", label: "Wartung", icon: Wrench },
  { id: "hilfe", label: "Hilfe", icon: HelpCircle },
];

// ==================== SETTINGS SHORTCUTS ====================
const SETTINGS_SHORTCUTS = [
  { path: "/module/artikel", icon: Package, label: "Artikel & Leistungen", description: "Stundensätze, Materialien, Pauschalen" },
  { path: "/module/textvorlagen", icon: FileText, label: "Textvorlagen", description: "Mailtexte, Beschreibungen" },
  { path: "/module/duplikate", icon: Users, label: "Duplikate", description: "Doppelte Kunden zusammenführen" },
  { path: "/handy-zugang", icon: Smartphone, label: "Handy-Zugang", description: "Mitarbeiter-PIN für Monteur-App" },
  { path: "/wissen", icon: BookOpen, label: "Wissen & Tipps", description: "Hilfe-Artikel und Anleitungen" },
];

const SettingsShortcuts = () => {
  const navigate = useNavigate();
  return (
    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2" data-testid="settings-shortcuts">
      {SETTINGS_SHORTCUTS.map(({ path, icon: Icon, label, description }) => (
        <button
          key={path}
          onClick={() => navigate(path)}
          className="flex items-start gap-3 p-3 border rounded-sm bg-background hover:bg-accent text-left transition-colors group"
          data-testid={`shortcut-${path.split("/").pop()}`}
        >
          <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
          <div className="min-w-0">
            <div className="font-medium text-sm">{label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{description}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

// ==================== MAIN SETTINGS PAGE ====================
const WartungTab = () => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (apply) => {
    if (apply && !window.confirm(
      "Umlaute in Textvorlagen, Leistungen & Materialien reparieren?\n\nVorher wird automatisch ein vollständiger DB-Snapshot der betroffenen Collections erstellt."
    )) return;
    setRunning(true);
    try {
      const res = await api.post(`/wartung/umlaute-reparieren?apply=${apply}`);
      setResult(res.data);
      if (apply) toast.success(`${res.data.total_changed} Feld(er) repariert`);
      else toast.info(`Vorschau: ${res.data.total_changed} Feld(er) würden geändert`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler bei der Reparatur");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4" data-testid="wartung-tab">
      <div className="bg-background border rounded-lg p-5">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" /> Umlaute reparieren
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Repariert kaputte Umlaute (z.&nbsp;B. „Ã¤" → „ä", „â‚¬" → „€") in
          Textvorlagen sowie Leistungen &amp; Materialien. Vor der Reparatur wird
          automatisch ein vollständiger DB-Snapshot der betroffenen Collections
          (<code>module_textvorlagen</code>, <code>module_artikel</code>) gespeichert.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => run(false)}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-sm border border-input bg-background hover:bg-accent disabled:opacity-50"
            data-testid="wartung-umlaute-pruefen-btn"
          >
            {running ? "Prüfe…" : "Nur prüfen (Vorschau)"}
          </button>
          <button
            onClick={() => run(true)}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="wartung-umlaute-btn"
          >
            <Wrench className="w-4 h-4" />
            {running ? "Repariere…" : "Umlaute reparieren"}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-background border rounded-lg p-5" data-testid="wartung-result">
          <p className="text-sm">
            {result.applied ? (
              <><span className="font-semibold">{result.total_changed}</span> Feld(er) korrigiert</>
            ) : (
              <>Vorschau: <span className="font-semibold">{result.total_changed}</span> Feld(er) würden geändert (nichts geschrieben)</>
            )}
            {result.total_changed === 0 && " – alles bereits sauber."}
          </p>
          {result.applied && result.snapshot_dir && (
            <p className="text-xs text-muted-foreground mt-1">Snapshot: <code>{result.snapshot_dir}</code></p>
          )}
          {result.changes?.length > 0 && (
            <div className="mt-3 max-h-80 overflow-y-auto border rounded-sm divide-y">
              {result.changes.map((c, i) => (
                <div key={i} className="p-2 text-xs" data-testid={`wartung-change-${i}`}>
                  <div className="text-muted-foreground">{c.collection} · id={c.id} · feld „{c.field}"</div>
                  <div className="text-red-600 line-through break-words">{c.old}</div>
                  <div className="text-emerald-700 break-words">{c.new}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const SettingsPage = () => {
  useF1Help("hilfe_einstellungen");
  const [activeTab, setActiveTab] = useState("firma");
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setActiveTab(t);
  }, [searchParams]);
  const [settings, setSettings] = useState({
    company_name: "", owner_name: "", address: "", phone: "", email: "",
    tax_id: "", bank_name: "", iban: "", bic: "",
    default_vat_rate: 19, is_small_business: false,
    km_rate: 0.30, hourly_travel_rate: 45.0,
    company_address: "", default_due_days: 14, default_quote_validity_days: 30,
    email_signature: "",
    smtp_server: "", smtp_port: 465, smtp_user: "", smtp_password: "", smtp_from: "",
    portal_bcc_admin: "",
    imap_server: "", imap_port: 993, imap_user: "", imap_password: "", imap_folder: "INBOX", imap_enabled: false,
    pdf_header_text: "", pdf_footer_text: "", pdf_show_logo: true,
    pdf_accent_color: "#1a1a2e", pdf_font_size: "normal", pdf_bemerkung_default: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings((prev) => ({ ...prev, ...res.data }));
    } catch { toast.error("Fehler beim Laden"); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try { await api.put("/settings", settings); toast.success("Einstellungen gespeichert"); }
    catch { toast.error("Fehler beim Speichern"); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div data-testid="settings-page">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-4xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-1 text-sm">Konfiguration der Graupner Suite</p>
      </div>

      {/* Schnellzugriff auf Settings-Untermodule */}
      <SettingsShortcuts />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b flex-wrap pb-px" data-testid="settings-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <HelpTip key={id} id={`settings.tab-${id === "firma" ? "firmendaten" : id === "benutzer" ? "users" : id === "dokumente" ? "briefkopf" : id === "doc-templates" ? "dokument-vorlagen" : id}`} placement="bottom">
          <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
            data-testid={`settings-tab-${id}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
          </HelpTip>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "firma" && <FirmendatenTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "kalkulation" && <KalkulationTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "email" && <EmailTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "benutzer" && <BenutzerTab />}
      {activeTab === "mitarbeiter" && (
        <div className="bg-background -mt-2">
          <MitarbeiterModulPage />
        </div>
      )}
      {activeTab === "dokumente" && <DokumentVorlagenTab settings={settings} setSettings={setSettings} onSave={handleSave} saving={saving} />}
      {activeTab === "doc-templates" && (
        <div className="bg-background -mt-2">
          <DocumentTemplatesPanel variant="embedded" />
        </div>
      )}
      {activeTab === "diverses" && <DiversesTab />}
      {activeTab === "kategorien" && <KategorienGruppenTab />}
      {activeTab === "keyword-prio" && <KeywordPrioritaetenTab />}
      {activeTab === "begruessung" && <BegruessungsvorlagenTab />}
      {activeTab === "backup" && <BackupTab />}
      {activeTab === "module" && <ModuleTab />}
      {activeTab === "wartung" && <WartungTab />}
      {activeTab === "hilfe" && <HilfeTab />}
    </div>
  );
};

export { SettingsPage };
