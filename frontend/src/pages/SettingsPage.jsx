import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Save, FileText, Building2, Users, Palette, Package, Calculator, BookOpen, HardHat, HelpCircle, Smartphone, FolderTree, Flag } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MitarbeiterModulPage } from "./MitarbeiterModulPage";
import { DocumentTemplatesPanel } from "@/components/DocumentTemplatesPanel";
import { HilfeTab } from "@/components/HilfeTab";
import { HelpTip } from "@/components/HelpTip";

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
  { id: "diverses", label: "Diverses / Info", icon: BookOpen },
  { id: "backup", label: "Backup", icon: Save },
  { id: "module", label: "Module", icon: Package },
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
const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("firma");
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
      {activeTab === "backup" && <BackupTab />}
      {activeTab === "module" && <ModuleTab />}
      {activeTab === "hilfe" && <HilfeTab />}
    </div>
  );
};

export { SettingsPage };
