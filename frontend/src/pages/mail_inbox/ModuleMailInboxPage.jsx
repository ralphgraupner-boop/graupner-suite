import { useEffect, useState, useRef } from "react";
import { Mail, RefreshCw, Loader2, Inbox, Check, X, Phone, MapPin, ExternalLink, Trash2, Search, Download, Upload, BarChart3, Eye, Wrench, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Modal } from "@/components/common";
import MailDetailModal from "@/components/MailDetailModal";
import MailAcceptDuplicateDialog from "@/components/MailAcceptDuplicateDialog";
import MailAnfrageUebernehmenModal from "@/components/MailAnfrageUebernehmenModal";
import { VorlagenPicker } from "@/components/VorlagenPicker";
import { useF1Help } from "@/lib/useF1Help";

const STATUS_LABELS = {
  vorschlag: { label: "Offen", color: "bg-amber-100 text-amber-800" },
  übernommen: { label: "Übernommen", color: "bg-emerald-100 text-emerald-800" },
  ignoriert: { label: "Ignoriert", color: "bg-slate-100 text-slate-600" },
  abgeschlossen: { label: "Abgeschlossen", color: "bg-slate-100 text-slate-700" },
  spam_verdacht: { label: "Spam-Verdacht", color: "bg-red-100 text-red-800" },
};

// Prioritäts-Badge je prioritaet_stufe (Rot/Grün/Gelb/Blau)
const STUFE_BADGE = {
  sofort: { label: "Sofort", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  stufe1: { label: "Stufe 1", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  stufe2: { label: "Stufe 2", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  stufe3: { label: "Stufe 3", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
};

const ModuleMailInboxPage = () => {
  useF1Help("hilfe_mail_anfragen");
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const [reprio, setReprio] = useState(false);
  const [statusFilter, setStatusFilter] = useState("vorschlag");

  // Übersprungene Mails – Vorschau-Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewSummary, setPreviewSummary] = useState([]);
  const [previewMode, setPreviewMode] = useState("skipped"); // skipped|all
  const [importingUid, setImportingUid] = useState("");

  // 409-Konflikt: Duplikatsdialog für Schnell-Übernahme aus der Liste
  const [dupCtx, setDupCtx] = useState(null); // { entry, duplicates }
  const [previewDetail, setPreviewDetail] = useState(null);  // {body, subject, from, ...}
  const [previewDetailLoading, setPreviewDetailLoading] = useState(false);

  // Detail-Modal: Mail prüfen + entscheiden
  const [detailEntry, setDetailEntry] = useState(null);
  const [uebernehmenEntry, setUebernehmenEntry] = useState(null);

  // Statistik
  const [stats, setStats] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsDays, setStatsDays] = useState(30);

  // Export/Import
  const importInputRef = useRef(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exVon, setExVon] = useState("");
  const [exBis, setExBis] = useState("");
  const [exStatus, setExStatus] = useState("alle");
  const [importing, setImporting] = useState(false);

  const doExport = async (format) => {
    try {
      const params = new URLSearchParams({ format, status: exStatus });
      if (exVon) params.append("von", exVon);
      if (exBis) params.append("bis", exBis);
      const res = await api.get(`/module-mail-inbox/export?${params.toString()}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "csv" ? "mail_anfragen.csv" : "mail_anfragen.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Export (${format.toUpperCase()}) erstellt`);
    } catch {
      toast.error("Export fehlgeschlagen");
    } finally {
      setExportOpen(false);
      await load();
    }
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Bitte eine .json-Datei wählen (keine ZIP/anderen Formate)");
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/module-mail-inbox/import", fd);
      const { neu, uebersprungen, gesamt } = res.data;
      toast.success(`Import: ${neu} neu, ${uebersprungen} übersprungen (von ${gesamt})`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Import fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  };

  const loadStats = async (days = statsDays) => {
    try {
      const r = await api.get(`/module-mail-inbox/stats?days=${days}`);
      setStats(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Statistik konnte nicht geladen werden");
    }
  };

  useEffect(() => { loadStats(statsDays); }, [statsDays]);  // eslint-disable-line

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/module-mail-inbox/list?status=${statusFilter}`);
      setItems(r.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);  // eslint-disable-line

  const prioritaetenNeuPruefen = async () => {
    setReprio(true);
    try {
      const res = await api.post("/module-mail-inbox/prioritaeten-neu-pruefen");
      toast.success(`Prioritäten neu geprüft – ${res.data.updated} geändert`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Neu-Prüfen fehlgeschlagen");
    } finally {
      setReprio(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    try {
      const r = await api.post("/module-mail-inbox/scan?weeks=6&max_count=30");
      const d = r.data;
      toast.success(`${d.found} neue Anfragen gefunden, ${d.duplicates_skipped} Duplikate übersprungen`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Scan fehlgeschlagen");
    } finally {
      setScanning(false);
    }
  };

  const accept = (entry) => {
    // Geführter 4-Schritt-Workflow im Modal (statt direkter Anlage + Navigation)
    setUebernehmenEntry(entry);
  };

  // Massen-Übernahme: alle offenen (vorschlag) Anfragen als neue Kunden anlegen.
  // Nutzt den bestehenden accept-Endpunkt je Eintrag; mögliche Doppel-Kunden (HTTP 409)
  // werden übersprungen, statt blind doppelt anzulegen.
  const acceptAll = async () => {
    const targets = items.filter((e) => e.status === "vorschlag");
    if (targets.length === 0) { toast.info("Keine offenen Anfragen zum Übernehmen"); return; }
    if (!window.confirm(
      `${targets.length} offene Anfrage(n) verarbeiten?\n\nNeue Kunden werden angelegt. Eindeutige Doppel-Kunden werden automatisch mit dem bestehenden Kunden verknüpft (leere Felder wie Vorname/Telefon/Adresse werden dabei ergänzt). Uneindeutige Fälle (mehrere mögliche Kunden) werden zur manuellen Prüfung übersprungen.`
    )) return;
    setBulkAccepting(true);
    let angelegt = 0, verknuepft = 0, uebersprungen = 0, fehler = 0;
    for (const e of targets) {
      try {
        await api.post(`/module-mail-inbox/accept/${e.id}`);
        angelegt++;
      } catch (err) {
        if (err?.response?.status === 409) {
          const dups = err?.response?.data?.detail?.duplicates || [];
          if (dups.length === 1) {
            try {
              await api.post(`/module-mail-inbox/accept-link/${e.id}`, { kunde_id: dups[0].id });
              verknuepft++;
            } catch {
              uebersprungen++;
            }
          } else {
            uebersprungen++;
          }
        } else {
          fehler++;
        }
      }
    }
    try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ }
    toast.success(`${angelegt} neu angelegt, ${verknuepft} automatisch verknüpft, ${uebersprungen} zur manuellen Prüfung übersprungen${fehler ? `, ${fehler} Fehler` : ""}`);
    setBulkAccepting(false);
    await load();
  };

  // Begrüßungsmail: öffnet Betterbird (bestehende bbcompose-Integration, type=begruessung).
  // Nach Öffnung manuelle Bestätigung -> Status auf 'übernommen'.
  const openBegruessung = (entry) => {
    const token = localStorage.getItem("token") || "";
    const base = process.env.REACT_APP_BACKEND_URL || "";
    if (!base) { toast.error("Backend-Adresse fehlt"); return; }
    const url = `bbcompose://compose?base=${encodeURIComponent(base)}&type=begruessung&id=${encodeURIComponent(entry.id)}&token=${encodeURIComponent(token)}&text=1`;
    window.location.href = url;
    toast.success("Betterbird wird geöffnet … (lokaler Helfer muss installiert sein)");
    setTimeout(async () => {
      const ok = window.confirm(
        "Wurde die Begrüßungsmail gesendet?\n\nJa → Anfrage wird auf 'Übernommen' gesetzt.\nNein → Status bleibt unverändert."
      );
      if (!ok) return;
      try {
        await api.post(`/module-mail-inbox/begruessung-gesendet/${entry.id}`);
        toast.success("Anfrage als beantwortet markiert");
        await load();
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Status konnte nicht gesetzt werden");
      }
    }, 800);
  };

  const linkToExisting = async (kundeId) => {
    if (!dupCtx) return;
    try {
      const r = await api.post(`/module-mail-inbox/accept-link/${dupCtx.entry.id}`, {
        kunde_id: kundeId,
        append_nachricht: true,
      });
      toast.success(`Anfrage zu „${r.data.kunde_name}" zugeordnet`);
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ }
      setDupCtx(null);
      await load();
      navigate(`/module/kunden?edit=${kundeId}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Zuordnen fehlgeschlagen");
    }
  };

  const reject = async (entry) => {
    if (!window.confirm("Diese Anfrage als ignoriert markieren?")) return;
    try {
      await api.post(`/module-mail-inbox/reject/${entry.id}`);
      toast.success("Anfrage ignoriert");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const rejectAllSpam = async () => {
    if (!window.confirm("Alle Spam-Verdacht-Einträge ignorieren?")) return;
    try {
      const r = await api.post(`/module-mail-inbox/reject-all-spam`);
      toast.success(`${r.data.rejected} Einträge ignoriert`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm("Diesen Eintrag endgültig löschen? Bei späteren Scans wird er nicht erneut importiert.")) return;
    try {
      await api.delete(`/module-mail-inbox/${entry.id}`);
      toast.success("Eintrag gelöscht");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  const deleteAllSpam = async () => {
    if (!window.confirm("Alle Spam-Verdacht-Einträge ENDGÜLTIG löschen? Diese Aktion ist nicht umkehrbar.")) return;
    try {
      const r = await api.post(`/module-mail-inbox/delete-all-spam`);
      toast.success(`${r.data.deleted} Einträge gelöscht`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const openPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const r = await api.post("/module-mail-inbox/scan-preview?weeks=6&max_count=100");
      setPreviewItems(r.data?.items || []);
      setPreviewSummary(r.data?.per_account || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Vorschau fehlgeschlagen");
      setPreviewItems([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const importPreviewItem = async (it) => {
    const key = `${it.account_id}/${it.folder}/${it.uid}`;
    setImportingUid(key);
    try {
      await api.post("/module-mail-inbox/import-mail", {
        account_id: it.account_id,
        folder: it.folder,
        uid: it.uid,
      });
      toast.success(`Importiert: ${it.subject?.slice(0, 60) || it.from_email}`);
      // Lokal als Duplikat markieren, damit Button verschwindet
      setPreviewItems((prev) => prev.map((x) =>
        x.account_id === it.account_id && x.folder === it.folder && x.uid === it.uid
          ? { ...x, is_duplicate: true, duplicate_status: "frisch importiert" }
          : x
      ));
      // Hauptliste neu laden falls Tab "vorschlag" o. "all"
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Import fehlgeschlagen");
    } finally {
      setImportingUid("");
    }
  };

  const deletePreviewItem = async (it) => {
    if (!it.message_id) {
      toast.error("Keine Message-ID vorhanden – Mail kann nicht permanent ignoriert werden.");
      return;
    }
    if (!window.confirm(`„${it.subject?.slice(0, 80) || it.from_email}" endgültig ignorieren?\nWird bei nächsten Scans nicht erneut angezeigt.`)) return;
    const key = `${it.account_id}/${it.folder}/${it.uid}`;
    setImportingUid(key);  // gleiche Spinner-State, blockiert beide Buttons
    try {
      await api.post("/module-mail-inbox/preview-delete", {
        message_id: it.message_id,
        subject: it.subject || "",
        from_email: it.from_email || "",
      });
      toast.success("Mail dauerhaft ignoriert");
      // Lokal aus Liste entfernen
      setPreviewItems((prev) => prev.filter((x) =>
        !(x.account_id === it.account_id && x.folder === it.folder && x.uid === it.uid)
      ));
      // Falls die Mail in der Haupt-DB war, neu laden
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    } finally {
      setImportingUid("");
    }
  };

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const bulkDeleteSkipped = async () => {
    // Nur die in der aktuellen Vorschau angezeigten "übersprungenen" Mails
    // (also: nicht Treffer, nicht schon in DB) auf einmal als Tombstone markieren.
    const targets = previewItems.filter((it) => !it.would_match && !it.is_duplicate && it.message_id);
    if (targets.length === 0) {
      toast.info("Keine übersprungenen Mails mit Message-ID zum Löschen vorhanden.");
      return;
    }
    if (!window.confirm(`${targets.length} übersprungene Mails endgültig ignorieren?\nDiese Mails werden bei zukünftigen Scans nicht erneut angezeigt.`)) return;
    setBulkDeleting(true);
    try {
      const r = await api.post("/module-mail-inbox/preview-bulk-delete", {
        items: targets.map((it) => ({
          message_id: it.message_id,
          subject: it.subject || "",
          from_email: it.from_email || "",
        })),
      });
      toast.success(`${r.data.tombstoned} Mails dauerhaft ignoriert`);
      // Lokal entfernen
      const targetKeys = new Set(targets.map((it) => `${it.account_id}/${it.folder}/${it.uid}`));
      setPreviewItems((prev) => prev.filter((x) => !targetKeys.has(`${x.account_id}/${x.folder}/${x.uid}`)));
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Massen-Löschen fehlgeschlagen");
    } finally {
      setBulkDeleting(false);
    }
  };

  const showPreviewDetail = async (it) => {
    setPreviewDetail({ _meta: it, loading: true });
    setPreviewDetailLoading(true);
    try {
      const r = await api.post("/module-mail-inbox/mail-detail", {
        account_id: it.account_id,
        folder: it.folder,
        uid: it.uid,
      });
      setPreviewDetail({ ...r.data, _meta: it });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Detail-Anzeige fehlgeschlagen");
      setPreviewDetail(null);
    } finally {
      setPreviewDetailLoading(false);
    }
  };


  return (
    <div className="space-y-6" data-testid="module-mail-inbox-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6" /> Mail-Anfragen
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="mail-inbox-subtitle">
            Kontaktformular-Anfragen aus {stats?.by_account?.length
              ? stats.by_account.map((a) => a.label).filter(Boolean).join(", ")
              : "deinem Postfach"}. Letzte 30 Tage, max. 30 pro Scan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onImportFile}
            className="hidden"
            data-testid="mail-import-input"
          />
          {statusFilter === "vorschlag" && items.some((e) => e.status === "vorschlag") && (
            <button
              onClick={acceptAll}
              disabled={bulkAccepting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              data-testid="btn-mail-accept-all"
              title="Alle offenen Anfragen verarbeiten: neue Kunden anlegen, eindeutige Duplikate automatisch verknüpfen"
            >
              {bulkAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Alle übernehmen
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border border-input bg-background hover:bg-accent"
                data-testid="btn-mail-werkzeuge"
              >
                <Wrench className="w-4 h-4" /> Werkzeuge <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Selten gebraucht</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={prioritaetenNeuPruefen} disabled={reprio} data-testid="btn-mail-reprio">
                {reprio ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Neu prüfen <span className="ml-auto text-xs text-muted-foreground">Priorität neu berechnen</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatsOpen((v) => !v)} data-testid="btn-mail-stats-toggle">
                <BarChart3 className="w-4 h-4 mr-2" />
                {statsOpen ? "Statistik ausblenden" : "Statistik anzeigen"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Für Steuerberater/Sicherung</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setExportOpen(true)} data-testid="btn-mail-export">
                <Download className="w-4 h-4 mr-2" /> Export (JSON/CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => importInputRef.current?.click()} disabled={importing} data-testid="btn-mail-import">
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Import (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={openPreview}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border border-input bg-background hover:bg-accent"
            data-testid="btn-mail-preview"
            title="Alle Mails der letzten 6 Wochen anschauen – auch übersprungene"
          >
            <Search className="w-4 h-4" />
            Übersprungene anzeigen
          </button>
          <button
            onClick={scan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-mail-scan"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Postfach prüfen
          </button>
        </div>
      </div>

      {/* Export-Dialog */}
      <Modal isOpen={exportOpen} onClose={() => setExportOpen(false)} title="Anfragen exportieren" size="sm">
        <div className="space-y-3" data-testid="mail-export-dialog">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Von</label>
              <input type="date" value={exVon} onChange={(e) => setExVon(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="export-von" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Bis</label>
              <input type="date" value={exBis} onChange={(e) => setExBis(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="export-bis" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Status</label>
            <select value={exStatus} onChange={(e) => setExStatus(e.target.value)} className="w-full border rounded-sm p-2 text-sm" data-testid="export-status">
              <option value="alle">Alle</option>
              <option value="offen">Nur offen</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Leerer Datumsbereich = alle Einträge. JSON für Re-Import, CSV für Excel/Steuerberater.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => doExport("json")} className="inline-flex items-center gap-1 px-4 py-2 text-sm border rounded-sm hover:bg-accent" data-testid="export-json">
              <Download className="w-4 h-4" /> JSON
            </button>
            <button onClick={() => doExport("csv")} className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90" data-testid="export-csv">
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>
      </Modal>

      {/* Statistik-Karte */}
      {statsOpen && (
        <div className="border rounded p-4 bg-muted/20 space-y-3" data-testid="mail-stats-card">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Anfrage-Statistik nach Postfach
              <span className="text-xs text-muted-foreground font-normal">letzte {statsDays} Tage</span>
            </h3>
            <div className="flex gap-1">
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setStatsDays(d)}
                  className={`px-2.5 py-1 text-xs rounded-sm ${statsDays === d ? "bg-primary text-primary-foreground" : "bg-background border hover:bg-accent"}`}
                  data-testid={`btn-stats-days-${d}`}
                >
                  {d === 365 ? "1 Jahr" : `${d}T`}
                </button>
              ))}
            </div>
          </div>
          {!stats ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Lade Statistik…
            </div>
          ) : stats.total.total === 0 ? (
            <div className="text-sm text-muted-foreground py-3 italic">
              Keine Anfragen im gewählten Zeitraum.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Gesamt-Zusammenfassung */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="bg-background border rounded p-2">
                  <div className="text-muted-foreground">Anfragen gesamt</div>
                  <div className="text-lg font-bold">{stats.total.total}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                  <div className="text-emerald-800">Übernommen</div>
                  <div className="text-lg font-bold text-emerald-900">{stats.total.uebernommen}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                  <div className="text-blue-800">Offen</div>
                  <div className="text-lg font-bold text-blue-900">{stats.total.vorschlag}</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <div className="text-red-800">Spam/Ignoriert</div>
                  <div className="text-lg font-bold text-red-900">{stats.total.spam_verdacht + stats.total.ignoriert}</div>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded p-2">
                  <div className="text-primary">Conversion</div>
                  <div className="text-lg font-bold text-primary">{stats.total.conversion_pct}%</div>
                </div>
              </div>

              {/* Pro Postfach */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground mt-2">Pro Postfach</div>
                {stats.by_account.map((row) => (
                  <div key={row.label} className="flex flex-wrap items-center gap-3 text-xs bg-background border rounded p-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium min-w-[180px]">{row.label}</span>
                    <span>· {row.total} Anfragen</span>
                    <span className="text-emerald-700">· {row.uebernommen} übernommen</span>
                    {row.vorschlag > 0 && <span className="text-blue-700">· {row.vorschlag} offen</span>}
                    {(row.spam_verdacht + row.ignoriert) > 0 && (
                      <span className="text-red-700">· {row.spam_verdacht + row.ignoriert} Spam/Ignoriert</span>
                    )}
                    {row.manuell_importiert > 0 && (
                      <span className="text-amber-700">· {row.manuell_importiert} manuell</span>
                    )}
                    <span className="ml-auto font-semibold text-primary">{row.conversion_pct}% Conversion</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b items-center">
        {[["vorschlag", "Offen"], ["spam_verdacht", "Spam-Verdacht"], ["übernommen", "Übernommen"], ["abgeschlossen", "Archiv"], ["ignoriert", "Ignoriert"], ["all", "Alle"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(k)}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${statusFilter === k ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-${k}`}
          >
            {label}
          </button>
        ))}
        {statusFilter === "spam_verdacht" && items.length > 0 && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={rejectAllSpam}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-600 text-white rounded-sm hover:bg-slate-700"
              data-testid="btn-reject-all-spam"
              title="Alle als ignoriert markieren (bleiben zur Kontrolle in der DB)"
            >
              <X className="w-3.5 h-3.5" /> Alle ignorieren
            </button>
            <button
              onClick={deleteAllSpam}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-sm hover:bg-red-700"
              data-testid="btn-delete-all-spam"
              title="Alle endgültig aus der Datenbank löschen"
            >
              <Trash2 className="w-3.5 h-3.5" /> Alle löschen
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Keine Einträge.</p>
          <p className="text-xs mt-1">{`Klicke auf „Postfach prüfen" oben rechts.`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((e) => {
            const p = e.parsed || {};
            const sb = STATUS_LABELS[e.status] || { label: e.status, color: "bg-slate-100" };
            const fullName = [p.vorname, p.nachname].filter(Boolean).join(" ") || e.from_name || "(ohne Name)";
            return (
              <div
                key={e.id}
                className="border rounded-sm p-4 bg-card hover:bg-accent/30 cursor-pointer transition-colors"
                onClick={() => setDetailEntry(e)}
                data-testid={`mail-entry-${e.id}`}
                title="Anklicken zum Öffnen und Prüfen"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{p.anrede ? `${p.anrede} ` : ""}{fullName}</h3>
                      {e.prioritaet_stufe && (() => {
                        const pb = STUFE_BADGE[e.prioritaet_stufe];
                        return pb ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${pb.color}`} data-testid={`mail-prio-badge-${e.id}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pb.dot}`} />{pb.label}
                          </span>
                        ) : null;
                      })()}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${sb.color}`}>{sb.label}</span>
                      {p.format && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-mono">{p.format}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.received_at ? new Date(e.received_at).toLocaleString("de-DE") : ""} · {e.subject}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
                    <button
                      onClick={() => setDetailEntry(e)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
                      data-testid={`btn-open-${e.id}`}
                      title="Mail öffnen, Inhalt prüfen, dann entscheiden"
                    >
                      <Eye className="w-3.5 h-3.5" /> Öffnen / Prüfen
                    </button>
          <button onClick={() => {
            const em = p.email || e.email || "";
            if (em) {
              const ta = document.createElement("textarea");
              ta.value = em;
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              try {
                document.execCommand("copy");
                toast.success(`E-Mail kopiert: ${em}`);
              } catch (err) {
                toast.error("Kopieren fehlgeschlagen");
              }
              document.body.removeChild(ta);
            }
            window.open("https://webmail.jimdo.com", "_blank");
          }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-sm hover:bg-muted" data-testid={`btn-webmail-${e.id}`} title="Webmail oeffnen, um die E-Mail-Adresse selbst zu pruefen">
            <Mail className="w-3.5 h-3.5" /> Webmail
          </button>
          <VorlagenPicker
            doc_type="mail_antwort"
            label="Antwort-Vorlage"
            compact={true}
          onSelect={({ content, title }) => {
            const kundeName = [p.vorname, p.nachname].filter(Boolean).join(" ") || p.name || e.name || "";
            const anrede = p.anrede === "Frau" ? "Frau" : p.anrede === "Herr" ? "Herr" : "";
            let html = content
              .replace(/Sehr geehrte \{anrede_brief\}/g, anrede === "Herr" ? "Sehr geehrter Herr" : anrede === "Frau" ? "Sehr geehrte Frau" : "Sehr geehrte Damen und Herren,")
              .replace(/\{anrede_brief\}/g, anrede)
              .replace(/\{kunde_name\}/g, kundeName)
              .replace(/\{datum\}/g, new Date().toLocaleDateString("de-DE"))
              .replace(/\{bearbeiter\}/g, "Ihre Tischlerei Graupner")
              .replace(/\{dokument_nr\}/g, "");

    const kundeEmail = p.email || e.email || "";
    const adressBlock = `<div style="margin-bottom:16px;padding:10px 14px;border:1px solid #ccc;border-radius:6px;"><strong>Ihre Adresse</strong><br/>${kundeName}<br/>${kundeEmail}</div><div style="margin-bottom:16px;"><strong>Betreff:</strong> ${title}</div><div style="font-size:11px;color:#666;margin-bottom:16px;">Diese Nachricht ist ausschließlich für ${kundeName} (${kundeEmail}) bestimmt. Sollten Sie nicht der richtige Empfänger sein, informieren Sie bitte den Absender und löschen Sie diese Nachricht.</div>`;
    html = adressBlock + html;
            const div = document.createElement("div");
            div.setAttribute("contenteditable", "true");
            div.style.position = "fixed";
            div.style.top = "0";
            div.style.left = "0";
            div.style.opacity = "0.01";
            div.style.pointerEvents = "none";
            div.innerHTML = html;
            document.body.appendChild(div);
            const range = document.createRange();
            range.selectNodeContents(div);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            try {
              document.execCommand("copy");
              toast.success("Vorlage kopiert (mit Formatierung)");
        window.open("https://webmail.jimdo.com", "_blank");
            } catch (err) {
              toast.error("Kopieren fehlgeschlagen");
            }
            sel.removeAllRanges();
            document.body.removeChild(div);
          }}
        />
          />
                    {e.status === "vorschlag" && (
                      <>
                        {!e.begruessung_gesendet && (
                          <button
                            onClick={() => openBegruessung(e)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-sm hover:bg-blue-700"
                            data-testid={`btn-begruessung-${e.id}`}
                            title="Begrüßungsmail in Betterbird öffnen (Vorlage je Priorität)"
                          >
                            <Mail className="w-3.5 h-3.5" /> Begrüßungsmail senden
                          </button>
                        )}
                        <button
                          onClick={() => accept(e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-sm hover:bg-emerald-700"
                          data-testid={`btn-accept-${e.id}`}
                          title="Direkt als Kunde anlegen und im Kunden-Modul öffnen"
                        >
                          <Check className="w-3.5 h-3.5" /> Übernehmen
                        </button>
                        <button
                          onClick={() => reject(e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-sm hover:bg-muted"
                          data-testid={`btn-reject-${e.id}`}
                          title="Ignorieren (bleibt zur Kontrolle in der DB)"
                        >
                          <X className="w-3.5 h-3.5" /> Ignorieren
                        </button>
                        <button
                          onClick={() => deleteEntry(e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-sm hover:bg-red-50"
                          data-testid={`btn-delete-${e.id}`}
                          title="Endgültig löschen (wird bei neuen Scans nicht erneut importiert)"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Löschen
                        </button>
                      </>
                    )}
                    {e.status !== "vorschlag" && e.status !== "übernommen" && (
                      <button
                        onClick={() => deleteEntry(e)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-sm hover:bg-red-50"
                        data-testid={`btn-delete-${e.id}`}
                        title="Endgültig löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Löschen
                      </button>
                    )}
                  </div>
                </div>

                {e.begruessung_gesendet && (
                  <div className="mb-2 text-xs text-muted-foreground italic" data-testid={`begruessung-done-${e.id}`}>
                    Bereits beantwortet
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm" onClick={(ev) => ev.stopPropagation()}>
                  {p.email && (
                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" /><a href={`mailto:${p.email}`} className="text-primary hover:underline">{p.email}</a></div>
                  )}
                  {p.telefon && (
                    <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /><a href={`tel:${p.telefon.replace(/\s/g, "")}`} className="text-primary hover:underline">{p.telefon}</a></div>
                  )}
                  {p.source_url && (
                    <div className="flex items-center gap-2 sm:col-span-2 truncate">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">{p.source_url}</a>
                    </div>
                  )}
                </div>

                {e.status === "übernommen" && e.kunde_id && (
                  <a
                    href={`/module/kunden?edit=${e.kunde_id}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-xs text-primary hover:underline mt-2 inline-block"
                  >
                    → zum Kundeneintrag
                  </a>
                )}

                {e.status === "abgeschlossen" && e.abschluss_grund && (
                  <div className="mt-2 pt-2 border-t text-xs">
                    <span className="text-slate-600 font-medium">Abschluss-Grund:</span>{" "}
                    <span className="text-slate-700">{e.abschluss_grund}</span>
                    {e.abschluss_at && (
                      <span className="text-muted-foreground ml-2">
                        · {new Date(e.abschluss_at).toLocaleString("de-DE")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preview-Modal: Übersprungene Mails ansehen + manuell importieren */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Mail-Vorschau (auch Übersprungene)"
        size="xl"
      >
        <div className="space-y-3" data-testid="mail-preview-modal">
          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Lade IMAP-Vorschau (kann 10-30 Sek dauern)…
            </div>
          ) : (
            <>
              {/* Zusammenfassung pro Postfach */}
              {previewSummary.length > 0 && (
                <div className="border rounded p-2 bg-muted/30 text-xs space-y-1">
                  {previewSummary.map((s) => (
                    <div key={s.account_id} className="flex flex-wrap gap-3">
                      <span className="font-medium">{s.label}</span>
                      <span>· gefunden: {s.total}</span>
                      <span className="text-emerald-700">· passt: {s.matched}</span>
                      <span className="text-amber-700">· übersprungen: {s.skipped}</span>
                      <span className="text-muted-foreground">· schon importiert: {s.duplicates}</span>
                      {s.error && <span className="text-red-700">· {s.error}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-center text-sm border-b pb-2">
                <button
                  onClick={() => setPreviewMode("skipped")}
                  className={`px-3 py-1 rounded-sm ${previewMode === "skipped" ? "bg-amber-100 text-amber-900 font-semibold" : "hover:bg-accent"}`}
                  data-testid="tab-preview-skipped"
                >
                  Nur Übersprungene
                </button>
                <button
                  onClick={() => setPreviewMode("all")}
                  className={`px-3 py-1 rounded-sm ${previewMode === "all" ? "bg-blue-100 text-blue-900 font-semibold" : "hover:bg-accent"}`}
                  data-testid="tab-preview-all"
                >
                  Alle anzeigen
                </button>
                {previewMode === "skipped" && (
                  <button
                    onClick={bulkDeleteSkipped}
                    disabled={bulkDeleting}
                    className="px-3 py-1 rounded-sm border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1 text-xs"
                    title="Alle aktuell angezeigten übersprungenen Mails dauerhaft ignorieren"
                    data-testid="btn-preview-bulk-delete"
                  >
                    {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Alle Übersprungenen löschen
                  </button>
                )}
                <button
                  onClick={openPreview}
                  className="ml-auto px-3 py-1 rounded-sm border hover:bg-accent flex items-center gap-1"
                  title="Neu laden"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Aktualisieren
                </button>
              </div>

              {(() => {
                const filtered = previewMode === "skipped"
                  ? previewItems.filter((it) => !it.would_match && !it.is_duplicate)
                  : previewItems;
                if (filtered.length === 0) {
                  return (
                    <div className="text-sm text-muted-foreground py-6 text-center">
                      {previewMode === "skipped" ? "Keine übersprungenen Mails." : "Keine Mails gefunden."}
                    </div>
                  );
                }
                // Gruppieren nach Postfach (account_label)
                const groups = {};
                for (const it of filtered) {
                  const k = it.account_label || "(ohne Postfach)";
                  if (!groups[k]) groups[k] = [];
                  groups[k].push(it);
                }
                const groupKeys = Object.keys(groups).sort();
                return (
                  <div className="space-y-4 max-h-[55vh] overflow-auto">
                    {groupKeys.map((label) => (
                      <div key={label} className="space-y-1.5">
                        <div className="sticky top-0 bg-background z-10 py-1 border-b font-semibold text-sm flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {label}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({groups[label].length} Mail{groups[label].length === 1 ? "" : "s"})
                          </span>
                        </div>
                        {groups[label].map((it) => {
                          const key = `${it.account_id}/${it.folder}/${it.uid}`;
                          const isImporting = importingUid === key;
                          return (
                            <div
                              key={key}
                              className="flex items-start gap-2 border rounded p-2 hover:bg-accent/30"
                              data-testid={`preview-row-${it.uid}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {it.is_duplicate ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                      {it.duplicate_status || "Duplikat"}
                                    </span>
                                  ) : it.would_match ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      Filter-Treffer
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                                      übersprungen
                                    </span>
                                  )}
                                  {it.skip_reason && !it.is_duplicate && (
                                    <span className="text-[11px] text-muted-foreground italic">· {it.skip_reason}</span>
                                  )}
                                </div>
                                <div className="font-medium text-sm mt-1 break-words">{it.subject || "(kein Betreff)"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {it.from_email}
                                  {it.date && <> · {it.date.slice(0, 16).replace("T", " ")}</>}
                                </div>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-1">
                                <button
                                  onClick={() => showPreviewDetail(it)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm border hover:bg-accent"
                                  title="Mail-Inhalt anzeigen"
                                  data-testid={`btn-view-${it.uid}`}
                                >
                                  <Search className="w-3.5 h-3.5" />
                                  Anzeigen
                                </button>
                                {!it.is_duplicate ? (
                                  <button
                                    onClick={() => importPreviewItem(it)}
                                    disabled={isImporting}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    data-testid={`btn-import-${it.uid}`}
                                  >
                                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    Importieren
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic px-2">bereits drin</span>
                                )}
                                <button
                                  onClick={() => deletePreviewItem(it)}
                                  disabled={isImporting}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  title="Endgültig ignorieren – wird bei zukünftigen Scans nicht erneut angezeigt"
                                  data-testid={`btn-preview-delete-${it.uid}`}
                                >
                                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  Löschen
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </Modal>

      {/* Mail-Detail-Modal (Vorschau anzeigen) */}
      <Modal
        isOpen={!!previewDetail}
        onClose={() => setPreviewDetail(null)}
        title="Mail-Inhalt"
        size="lg"
      >
        {previewDetailLoading || !previewDetail ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Lade Mail…
          </div>
        ) : (
          <div className="space-y-3 text-sm" data-testid="preview-detail-modal">
            <div>
              <div className="text-xs text-muted-foreground">Betreff</div>
              <div className="font-semibold break-words">{previewDetail.subject || "(kein Betreff)"}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Von</div>
                <div className="break-all">{previewDetail.from_email || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">An</div>
                <div className="break-all">{previewDetail.to_email || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Datum</div>
                <div>{previewDetail.date?.slice(0, 16).replace("T", " ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Postfach</div>
                <div>{previewDetail.account_label || "—"}</div>
              </div>
            </div>
            <div className="border-t pt-2">
              <div className="text-xs text-muted-foreground mb-1">Inhalt</div>
              <pre className="text-xs whitespace-pre-wrap bg-muted/40 rounded-sm p-3 border max-h-[50vh] overflow-auto break-words">
                {previewDetail.body || "(leer)"}
              </pre>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              {previewDetail._meta && (
                <button
                  onClick={async () => {
                    await deletePreviewItem(previewDetail._meta);
                    setPreviewDetail(null);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm border border-red-200 text-red-700 hover:bg-red-50"
                  title="Mail dauerhaft ignorieren"
                  data-testid="btn-preview-delete-from-detail"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Löschen
                </button>
              )}
              {previewDetail._meta && !previewDetail._meta.is_duplicate && (
                <button
                  onClick={async () => {
                    await importPreviewItem(previewDetail._meta);
                    setPreviewDetail(null);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="btn-import-from-detail"
                >
                  <Download className="w-3.5 h-3.5" />
                  Doch importieren
                </button>
              )}
              <button
                onClick={() => setPreviewDetail(null)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm border hover:bg-accent"
              >
                <X className="w-3.5 h-3.5" />
                Schließen
              </button>
            </div>
          </div>
        )}
      </Modal>

      {detailEntry && (
        <MailDetailModal
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onChanged={async () => { await load(); }}
        />
      )}

      <MailAcceptDuplicateDialog
        open={!!dupCtx}
        duplicates={dupCtx?.duplicates || []}
        onLink={linkToExisting}
        onForce={() => dupCtx && accept(dupCtx.entry, true)}
        onClose={() => setDupCtx(null)}
      />

      {uebernehmenEntry && (
        <MailAnfrageUebernehmenModal
          entry={uebernehmenEntry}
          onClose={() => setUebernehmenEntry(null)}
          onDone={async () => { await load(); }}
        />
      )}
    </div>
  );
};

export default ModuleMailInboxPage;
