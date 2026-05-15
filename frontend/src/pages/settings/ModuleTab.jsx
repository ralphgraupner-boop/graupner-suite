import { useState, useEffect } from "react";
import { ChevronDown, Download, Link2, Database, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common";
import { api } from "@/lib/api";

const ModuleTab = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const res = await api.get("/modules");
      setModules(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Module");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (slug, currentStatus) => {
    const newStatus = currentStatus === "aktiv" ? "inaktiv" : "aktiv";
    try {
      await api.put(`/modules/${slug}/status`, { status: newStatus });
      loadModules();
      toast.success(`Modul ${newStatus === "aktiv" ? "aktiviert" : "deaktiviert"}`);
    } catch (err) {
      toast.error("Fehler beim Statuswechsel");
    }
  };

  const exportModule = async (slug) => {
    try {
      const res = await api.get(`/modules/${slug}/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modul_${slug}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Modul-Daten exportiert");
    } catch (err) {
      toast.error("Fehler beim Export");
    }
  };

  const statusColors = {
    aktiv: "bg-green-100 text-green-700 border-green-300",
    inaktiv: "bg-gray-100 text-gray-600 border-gray-300",
    entwurf: "bg-amber-100 text-amber-700 border-amber-300",
  };

  const categoryLabels = { daten: "Datensammler", ausgabe: "Ausgabe", integration: "Integration" };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Module werden geladen...</div>;

  return (
    <div data-testid="module-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Modul-Manager</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Eigenstaendige Bausteine - jedes Modul kann solo laufen, Daten aufnehmen und an andere Module uebergeben
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {modules.map((modul) => (
          <div key={modul.slug} className="border rounded-lg overflow-hidden" data-testid={`module-${modul.slug}`}>
            {/* Modul Header */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedModule(selectedModule === modul.slug ? null : modul.slug)}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{modul.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[modul.status]}`}>
                    {modul.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {categoryLabels[modul.category] || modul.category}
                  </span>
                  <span className="text-xs text-muted-foreground">v{modul.version}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{modul.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); exportModule(modul.slug); }}
                  data-testid={`module-export-${modul.slug}`}
                >
                  <Download className="w-4 h-4" /> Export
                </Button>
                <Button
                  variant={modul.status === "aktiv" ? "outline" : "default"}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); toggleStatus(modul.slug, modul.status); }}
                  data-testid={`module-toggle-${modul.slug}`}
                >
                  {modul.status === "aktiv" ? "Deaktivieren" : "Aktivieren"}
                </Button>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${selectedModule === modul.slug ? "rotate-180" : ""}`} />
              </div>
            </div>

            {/* Modul Details */}
            {selectedModule === modul.slug && (
              <div className="border-t bg-muted/20 p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Felder */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Datenfelder ({modul.fields?.length || 0})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {(modul.fields || []).map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded-sm border text-sm">
                        <span className="font-medium">{field.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{field.type}</span>
                        {field.required && <span className="text-xs text-red-500">*</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* API Endpoints */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Link2 className="w-4 h-4" /> API-Schnittstellen ({modul.api_endpoints?.length || 0})
                  </h4>
                  <div className="space-y-1.5">
                    {(modul.api_endpoints || []).map((ep, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-background rounded-sm border text-sm">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          ep.method === "GET" ? "bg-green-100 text-green-700" :
                          ep.method === "POST" ? "bg-blue-100 text-blue-700" :
                          ep.method === "PUT" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>{ep.method}</span>
                        <code className="text-xs font-mono text-muted-foreground">{ep.path}</code>
                        <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">{ep.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>Collection: <code className="bg-muted px-1 py-0.5 rounded">{modul.data_collection}</code></span>
                  <span>Erstellt: {new Date(modul.created_at).toLocaleDateString("de-DE")}</span>
                  <span>Aktualisiert: {new Date(modul.updated_at).toLocaleDateString("de-DE")}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {modules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Noch keine Module vorhanden</p>
        </div>
      )}
    </div>
  );
};

export { ModuleTab };
