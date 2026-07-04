import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, Download, Upload, Database, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { Button, Card } from "@/components/common";
import { api } from "@/lib/api";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PortalV2BackupPanel } from "@/components/PortalV2BackupPanel";
import { BackupStatusCard } from "@/components/BackupStatusCard";

const BackupTab = () => {
  const [collections, setCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState("merge");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadCollections();
    loadStats();
  }, []);

  const loadCollections = async () => {
    try {
      const res = await api.get("/backup/collections");
      setCollections(res.data);
      // Alle standardmäßig auswählen
      setSelectedCollections(new Set(res.data.map(c => c.id)));
    } catch (error) {
      toast.error("Fehler beim Laden der Collections");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get("/backup/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Stats loading failed", error);
    }
  };

  const toggleCollection = (id) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCollections(newSelected);
  };

  const toggleAll = () => {
    if (selectedCollections.size === collections.length) {
      setSelectedCollections(new Set());
    } else {
      setSelectedCollections(new Set(collections.map(c => c.id)));
    }
  };

  const handleExport = async () => {
    if (selectedCollections.size === 0) {
      toast.error("Bitte mindestens eine Collection auswählen");
      return;
    }

    setExporting(true);
    try {
      const collectionsList = Array.from(selectedCollections).join(',');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/backup/export?collections=${collectionsList}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) throw new Error('Export fehlgeschlagen');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'backup.zip';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Backup erfolgreich heruntergeladen");
    } catch (error) {
      toast.error("Fehler beim Export: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Nur ZIP-Dateien erlaubt");
      return;
    }

    const confirmed = window.confirm(
      importMode === "replace" 
        ? "ACHTUNG: Alle bestehenden Daten werden GELÖSCHT und durch das Backup ersetzt! Fortfahren?" 
        : "Die Daten aus dem Backup werden mit den bestehenden Daten zusammengeführt. Fortfahren?"
    );

    if (!confirmed) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', importMode);

      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/import?mode=${importMode}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Import fehlgeschlagen');
      }

      const result = await res.json();
      toast.success(`Backup erfolgreich importiert: ${result.total_documents} Einträge in ${result.collections.length} Collections`);
      
      // Reload stats and collections
      loadCollections();
      loadStats();
    } catch (error) {
      toast.error("Fehler beim Import: " + error.message);
    } finally {
      setImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Datensicherungs-Status (Ampel + Aktionen) — von Dashboard hierher verschoben */}
      <BackupStatusCard />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Portal v2 Sicherungen (eigenes Modul) */}
      <PortalV2BackupPanel />

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <div className="flex gap-4">
          <Database className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Backup & Wiederherstellung</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Sichern Sie alle wichtigen Daten der Graupner Suite auf Ihren Rechner.
              Bei Bedarf können Sie die Daten jederzeit wiederherstellen.
            </p>
            {stats && (
              <div className="flex gap-4 text-sm mt-3">
                <span className="font-medium">📊 {stats.total_documents} Einträge gesamt</span>
                <span className="text-muted-foreground">≈ {stats.estimated_size_mb} MB</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Export Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Backup erstellen</h3>
          </div>
          <Button
            onClick={toggleAll}
            variant="outline"
            size="sm"
          >
            {selectedCollections.size === collections.length ? "Alle abwählen" : "Alle auswählen"}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Wählen Sie aus, welche Daten gesichert werden sollen:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {collections.map((coll) => (
            <label
              key={coll.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedCollections.has(coll.id)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedCollections.has(coll.id)}
                onChange={() => toggleCollection(coll.id)}
                className="w-4 h-4 rounded accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{coll.icon}</span>
                  <span className="font-medium text-sm truncate">{coll.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{coll.count} Einträge</span>
              </div>
            </label>
          ))}
        </div>

        <Button
          onClick={handleExport}
          disabled={exporting || selectedCollections.size === 0}
          className="w-full"
          size="lg"
        >
          {exporting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Backup wird erstellt...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Backup herunterladen ({selectedCollections.size} ausgewählt)
            </>
          )}
        </Button>
      </Card>

      {/* Import Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Backup wiederherstellen</h3>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Wichtiger Hinweis</p>
              <p className="text-amber-800 dark:text-amber-200">
                Beim Import im <strong>"Ersetzen"</strong>-Modus werden alle bestehenden Daten gelöscht!
                Im <strong>"Zusammenführen"</strong>-Modus werden Daten ergänzt.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Import-Modus</label>
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              importMode === "merge" ? "border-primary bg-primary/5" : "border-border"
            }`}>
              <input
                type="radio"
                name="importMode"
                value="merge"
                checked={importMode === "merge"}
                onChange={(e) => setImportMode(e.target.value)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <div className="font-medium text-sm">Zusammenführen</div>
                <div className="text-xs text-muted-foreground">Daten ergänzen</div>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              importMode === "replace" ? "border-destructive bg-destructive/5" : "border-border"
            }`}>
              <input
                type="radio"
                name="importMode"
                value="replace"
                checked={importMode === "replace"}
                onChange={(e) => setImportMode(e.target.value)}
                className="w-4 h-4 accent-destructive"
              />
              <div>
                <div className="font-medium text-sm text-destructive">Ersetzen</div>
                <div className="text-xs text-muted-foreground">Alles löschen</div>
              </div>
            </label>
          </div>
        </div>

        <input
          type="file"
          accept=".zip"
          onChange={handleImport}
          disabled={importing}
          className="hidden"
          id="backup-upload"
        />
        <Button
          type="button"
          variant="outline"
          disabled={importing}
          className="w-full cursor-pointer"
          size="lg"
          onClick={() => document.getElementById('backup-upload').click()}
        >
          {importing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Wird importiert...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Backup-Datei auswählen (.zip)
            </>
          )}
        </Button>
      </Card>

      {/* Future: Auto-Backup */}
      <Card className="p-6 opacity-60">
        <div className="flex items-center gap-3 mb-3">
          <HardDrive className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-muted-foreground">Automatisches Backup (Demnächst)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Automatische Backups auf Ihren eigenen Server werden in einer zukünftigen Version verfügbar sein.
        </p>
      </Card>
    </div>
  );
};

export { BackupTab };
