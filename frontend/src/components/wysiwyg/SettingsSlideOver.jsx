import { lazy, Suspense } from "react";
import { ArrowLeft, Wrench, Package, Copy } from "lucide-react";
import { Button } from "@/components/common";
import { api } from "@/lib/api";
import { StammdatenPanel } from "./StammdatenPanel";
import { BloeckePanel } from "./BloeckePanel";
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));

const SettingsSlideOver = ({
  showSettings, setShowSettings, settingsTab, setSettingsTab,
  articles, services, leistungsBloecke,
  deleteLeistungsBlock, insertLeistungsBlock,
  loadData, setLeistungsBloecke,
}) => {
  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex" data-testid="settings-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
      <div className="relative ml-auto w-full max-w-4xl bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              {settingsTab === "settings" ? "Einstellungen" : settingsTab === "stammdaten" ? "Leistungen & Artikel" : "Leistungsblöcke"}
            </h2>
            <Button variant="outline" size="sm" onClick={() => { setShowSettings(false); loadData(); }} data-testid="btn-close-settings">
              <ArrowLeft className="w-4 h-4" /> Zurück zum Dokument
            </Button>
          </div>
          <div className="flex gap-1 border-b -mb-3 px-0">
            {[
              { id: "settings", label: "Einstellungen", icon: Wrench },
              { id: "stammdaten", label: "Leistungen / Artikel", icon: Package },
              { id: "blocks", label: "Blöcke", icon: Copy },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => setSettingsTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${settingsTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          {settingsTab === "settings" && <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Lade Einstellungen...</div>}><SettingsPage /></Suspense>}
          {settingsTab === "stammdaten" && <StammdatenPanel articles={articles} services={services} onRefresh={loadData} />}
          {settingsTab === "blocks" && <BloeckePanel blocks={leistungsBloecke} onDelete={deleteLeistungsBlock} onInsert={insertLeistungsBlock} onCloseSettings={() => setShowSettings(false)} onRefresh={async () => { const res = await api.get("/leistungsbloecke"); setLeistungsBloecke(res.data); }} />}
        </div>
      </div>
    </div>
  );
};

export { SettingsSlideOver };
