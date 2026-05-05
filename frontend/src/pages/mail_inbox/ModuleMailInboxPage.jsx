import { useEffect, useState } from "react";
import { Mail, RefreshCw, Loader2, Inbox, Check, X, Phone, MapPin, ExternalLink, Trash2, Search, Download, BarChart3, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Modal } from "@/components/common";
import MailDetailModal from "@/components/MailDetailModal";

const STATUS_LABELS = {
  vorschlag: { label: "Offen", color: "bg-blue-100 text-blue-800" },
  übernommen: { label: "Übernommen", color: "bg-emerald-100 text-emerald-800" },
  ignoriert: { label: "Ignoriert", color: "bg-slate-100 text-slate-600" },
  spam_verdacht: { label: "Spam-Verdacht", color: "bg-red-100 text-red-800" },
};

const ModuleMailInboxPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState("vorschlag");

  // Übersprungene Mails – Vorschau-Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewSummary, setPreviewSummary] = useState([]);
  const [previewMode, setPreviewMode] = useState("skipped"); // skipped|all
  const [importingUid, setImportingUid] = useState("");
  const [previewDetail, setPreviewDetail] = useState(null);  // {body, subject, from, ...}
  const [previewDetailLoading, setPreviewDetailLoading] = useState(false);

  // Detail-Modal: Mail prüfen + entscheiden
  const [detailEntry, setDetailEntry] = useState(null);

  // Statistik
  const [stats, setStats] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsDays, setStatsDays] = useState(30);

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

  const accept = async (entry) => {
    // Direkt übernehmen mit den geparsten Daten und ins Kunden-Modul navigieren.
    // (Bearbeiten passiert dort in der bestehenden Datenmaske – keine Doppelung.)
    try {
      const r = await api.post(`/module-mail-inbox/accept/${entry.id}`);
      toast.success(`Kunde „${r.data.kunde_name}" angelegt`);
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ }
      navigate(`/kunden?edit=${r.data.kunde_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Übernahme fehlgeschlagen");
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
          <p className="text-sm text-muted-foreground mt-1">
            Kontaktformular-Anfragen aus deinem service24-Postfach. Letzte 6 Wochen, max. 30 pro Scan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatsOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border border-input bg-background hover:bg-accent"
            data-testid="btn-mail-stats-toggle"
            title="Statistik nach Postfach anzeigen"
          >
            <BarChart3 className="w-4 h-4" />
            {statsOpen ? "Statistik ausblenden" : "Statistik anzeigen"}
          </button>
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
        {[["vorschlag", "Offen"], ["spam_verdacht", "Spam-Verdacht"], ["übernommen", "Übernommen"], ["ignoriert", "Ignoriert"], ["all", "Alle"]].map(([k, label]) => (
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
          <p className="text-xs mt-1">Klicke auf „Postfach prüfen" oben rechts.</p>
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
                    {e.status === "vorschlag" && (
                      <>
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
                    href={`/kunden?edit=${e.kunde_id}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-xs text-primary hover:underline mt-2 inline-block"
                  >
                    → zum Kundeneintrag
                  </a>
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
    </div>
  );
};

export default ModuleMailInboxPage;
