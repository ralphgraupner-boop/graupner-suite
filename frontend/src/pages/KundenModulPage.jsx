import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, Plus, Trash2, Edit, Search, Globe, ChevronDown, Upload, File, Image as ImageIcon, Download, Package, FileText, ArrowDownToLine, Wrench, Receipt, ClipboardCheck, Eye, Folder, Mail, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { TextareaWithAI } from "@/components/TextareaWithAI";
import { api } from "@/lib/api";
import { useF1Help } from "@/lib/useF1Help";
// (CATEGORIES wurde entfernt — Kategorien kommen jetzt aus module_textvorlagen
// mit doc_type=kunden_kategorie. Siehe useTextvorlagen-Hook unten.)
import { AufgabenPanel } from "@/components/AufgabenPanel";
import { TerminePanel } from "@/components/TerminePanel";
import { KundeExportButton } from "@/components/KundeExportButton";
import { CustomerDocumentsPanel } from "@/components/CustomerDocumentsPanel";import { GroupedFilterBar, buildGroupedItems } from "@/components/GroupedFilterBar";
import { KundeImportButton } from "@/components/KundeImportButton";
import { KundenMultiExportButton } from "@/components/KundenMultiExportButton";
import { KundeDeleteDialog } from "@/components/KundeDeleteDialog";
import MailHistoryModal from "@/components/MailHistoryModal";
import { MailLink } from "@/components/MailLink";
import AbschlussDialog from "@/components/AbschlussDialog";
import KundenLinkDialog from "@/components/KundenLinkDialog";
import PortalStatusBadge from "@/components/module_portal_wizard/PortalStatusBadge";
import NewProjektDialog from "@/components/NewProjektDialog";
import EinsatzModal from "@/components/EinsatzModal";
import TextvorlagenInlineManager from "@/components/TextvorlagenInlineManager";
import { broadcast, useBroadcast, openInPopup } from "@/lib/windowSync";

// Hartcodierte Liste = Fallback wenn das Textvorlagen-Modul gerade nicht
// antwortet. Pflege erfolgt im UI: Einstellungen → Textvorlagen → "Kunden-Status".
// (Pflicht-Regel seit 06.05.2026, siehe VISION.md / AGENT_BRIEFING.md)
// Default-Listen kommen aus module_textvorlagen — werden überschrieben sobald die API antwortet.
const KUNDEN_STATUSES_FALLBACK = ["Anfrage", "Neu", "Interessent", "Kunde", "In Bearbeitung", "Aufmaß", "Angebot", "Auftrag", "Abgeschlossen", "Archiv"];
const ANREDEN_FALLBACK = ["Herr", "Frau", "Divers"];
const CUSTOMER_TYPES_FALLBACK = ["Privat", "Firma", "Vermieter", "Mieter", "Gewerblich", "Hausverwaltung"];
const KUNDEN_KATEGORIEN_FALLBACK = ["Schiebetür", "Fenster", "Innentür", "Eingangstür", "Sonstige Reparaturen"];

// useTextvorlagen-Hook — lädt Werte live aus module_textvorlagen
// und fällt bei Fehler/Leerantwort auf Default-Liste zurück.
// Lauscht auf window-Event 'textvorlagen-changed' und lädt automatisch neu,
// wenn der TextvorlagenInlineManager etwas geändert hat.
const useTextvorlagen = (docType, fallback) => {
  const [items, setItems] = useState(fallback);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChanged = (e) => {
      if (!e?.detail?.docType || e.detail.docType === docType) setTick(t => t + 1);
    };
    window.addEventListener("textvorlagen-changed", onChanged);
    return () => window.removeEventListener("textvorlagen-changed", onChanged);
  }, [docType]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/modules/textvorlagen/data?doc_type=${docType}`);
        const titles = (r.data || [])
          .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || (a.title || "").localeCompare(b.title || ""))
          .map((t) => t.title)
          .filter(Boolean);
        if (!cancelled) setItems(titles.length > 0 ? titles : fallback);
      } catch {
        // Fallback bleibt aktiv
      }
    })();
    return () => { cancelled = true; };
  }, [docType, tick]);  // eslint-disable-line react-hooks/exhaustive-deps
  return items;
};

const useTextvorlagenRaw = (docType) => {
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChanged = (e) => {
      if (!e?.detail?.docType || e.detail.docType === docType) setTick(t => t + 1);
    };
    window.addEventListener("textvorlagen-changed", onChanged);
    return () => window.removeEventListener("textvorlagen-changed", onChanged);
  }, [docType]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/modules/textvorlagen/data?doc_type=${docType}`);
        const sorted = (r.data || []).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || (a.title || "").localeCompare(b.title || ""));
        if (!cancelled) setItems(sorted);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [docType, tick]);
  return items;
};

const STATUS_COLORS = {
  Anfrage: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700", border: "border-l-blue-500" },
  Neu: { dot: "bg-red-500 animate-pulse", badge: "bg-red-100 text-red-700", border: "border-l-red-500" },
  Interessent: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700", border: "border-l-amber-500" },
  Kunde: { dot: "bg-green-500", badge: "bg-green-100 text-green-700", border: "border-l-green-500" },
  "In Bearbeitung": { dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700", border: "border-l-yellow-500" },
  Abgeschlossen: { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600", border: "" },
  Archiv: { dot: "bg-gray-300", badge: "bg-gray-100 text-gray-500", border: "" },
};

const KundenModulPage = () => {
  useF1Help("hilfe_kunden");
  const [kunden, setKunden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("aktiv");
  const [sortMode, setSortMode] = useState("updated_at");
  const [openEdits, setOpenEdits] = useState([]); // mehrere "Kunde bearbeiten"-Fenster parallel
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Nach Öffnen eines Datensatzes diesen oben in den sichtbaren Bereich scrollen
  useEffect(() => {
    if (!expandedId) return;
    requestAnimationFrame(() => {
      document.querySelector(`[data-testid="kunden-modul-${expandedId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [expandedId]);
  const [editingId, setEditingId] = useState(null);  // Inline-Bearbeiten: welcher Kunde gerade im Edit-Modus ist
  const [vcfUploading, setVcfUploading] = useState(false);
  const [vcfDuplicateDialog, setVcfDuplicateDialog] = useState(null);
  const [showKontaktImport, setShowKontaktImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteKunde, setDeleteKunde] = useState(null);
  const [mailHistoryFor, setMailHistoryFor] = useState(null);  // {email, name}
  const [linkDialogKunde, setLinkDialogKunde] = useState(null);  // Kunde-Objekt für Link-Dialog
  const [linkCounts, setLinkCounts] = useState({});  // {kunde_id: count_aktiver_links}
  const [portalStatuses, setPortalStatuses] = useState({});  // {kunde_id: portal_status}
  const [portalLinkKunde, setPortalLinkKunde] = useState(null);  // Kunde für Portal-Link-Dialog
  const [portalLinkText, setPortalLinkText] = useState("");
  const [portalLinkResult, setPortalLinkResult] = useState("");
  const [portalLinkBusy, setPortalLinkBusy] = useState(false);
  const [projektCounts, setProjektCounts] = useState({});  // {kunde_id: count_projekte}
  const [neuesProjektFuer, setNeuesProjektFuer] = useState(null);  // Kunde-Objekt für Schnell-Projekt-Dialog
  const [einsatzCtx, setEinsatzCtx] = useState(null);  // {kundeId} — öffnet zentrales EinsatzModal
  const KUNDEN_KATEGORIEN_PAGE = useTextvorlagen("kunden_kategorie", KUNDEN_KATEGORIEN_FALLBACK);
  const KUNDEN_KATEGORIEN_RAW = useTextvorlagenRaw("kunden_kategorie");
  const KUNDEN_STATUSES = useTextvorlagen("kunden_status", KUNDEN_STATUSES_FALLBACK);
  const navigate = useNavigate();
  const location = useLocation();
  // Lock gegen StrictMode-Doppel-Trigger: gleiche editId nicht zweimal verarbeiten.
  const handledEditRef = useRef(null);

  // URL-Parameter ?filter=anfragen|aktiv|archiv -> Status-Filter aktivieren
  // URL-Parameter ?filter=anfragen|aktiv|archiv -> Status-Filter aktivieren
  // URL-Parameter ?edit={kundeId} -> Datenmaske für diesen Kunden direkt öffnen
  //   (wird z.B. von der Mail-Inbox nach "Als Kunde übernehmen" genutzt,
  //    und von der Projekt-Suche nach Klick auf einen Kunden-Treffer)
  // URL-Parameter ?returnTo={pfad} -> nach Schliessen der Datenmaske dorthin zurueckkehren
  //   (z.B. ProjektWerkbank: "Kunde bearbeiten" -> nach Speichern/Abbrechen zurueck zur Werkbank)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const f = params.get("filter");
    if (f) setStatusFilter(f);
    const editId = params.get("edit");
    const returnTo = params.get("returnTo");
    if (editId && kunden.length > 0 && handledEditRef.current !== editId) {
      handledEditRef.current = editId;
      const k = kunden.find((x) => x.id === editId);
      if (k) {
        // Status auf "alle" stellen, damit der neue Kunde sicher sichtbar ist
        // ("" = alle inkl. Archiv; "alle" war KEIN gültiger Filterwert -> Liste leer)
        setStatusFilter("");
        const popupOpened = openEditFor(k, returnTo);
        // edit-Param aus URL entfernen, damit Refresh nicht erneut öffnet
        const cleaned = new URLSearchParams(location.search);
        cleaned.delete("edit");
        cleaned.delete("returnTo");
        navigate(`${location.pathname}${cleaned.toString() ? "?" + cleaned.toString() : ""}`, { replace: true });
        // Wenn Popup-Fenster geoeffnet wurde (eigenes Browser-Window), kann der User
        // gleich zurueck zur Werkbank navigieren — er bearbeitet im Popup weiter.
        if (popupOpened && returnTo) {
          navigate(returnTo, { replace: true });
        }
      }
    }
  }, [location.search, kunden]);  // eslint-disable-line

  useEffect(() => { loadKunden(); loadLinkCounts(); loadPortalStatuses(); }, []);

  // Live-Sync mit Pop-Out-Fenstern: nach Speichern dort Liste hier neu laden
  useBroadcast("kunden-changed", () => { loadKunden(); loadLinkCounts(); });

  // Multi-Window Helper: öffnet weiteres "Kunde bearbeiten"-Fenster.
  // Bevorzugt direkten Browser-Popup (User-Pref `ui_direct_popout`, default an).
  // Fallback bei Popup-Blocker oder deaktivierter Pref: In-App-Modal (Dedupe per kunde.id).
  // Rueckgabewert: true wenn echtes Popup-Fenster aufgegangen ist, false wenn In-App-Modal.
  // `returnTo`: wenn gesetzt, wird beim Schliessen des In-App-Modals dorthin navigiert.
  const openEditFor = (kunde, returnTo) => {
    const url = kunde?.id ? `/popup/kunde/${kunde.id}` : "/popup/kunde/new";
    if (openInPopup(url)) return true;
    setOpenEdits((prev) => {
      if (kunde && kunde.id && prev.some((k) => k && k.id === kunde.id)) return prev;
      const entry = kunde ? { ...kunde, __returnTo: returnTo || undefined } : { __new: true, __key: `_new_${Date.now()}_${Math.random()}`, __returnTo: returnTo || undefined };
      return [...prev, entry];
    });
    return false;
  };
  const closeEditFor = (target) => {
    const returnTo = target?.__returnTo;
    setOpenEdits((prev) =>
      prev.filter((k) => {
        if (target?.id) return k?.id !== target.id;
        if (target?.__key) return k?.__key !== target.__key;
        return false;
      })
    );
    if (returnTo) navigate(returnTo, { replace: true });
  };

  const loadKunden = async () => {
    try {
      const res = await api.get("/modules/kunden/data");
      setKunden(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const loadLinkCounts = async () => {
    try {
      const r = await api.get("/module-kundenlink/counts");
      setLinkCounts(r.data || {});
    } catch { /* still ignore */ }
  };

  const loadPortalStatuses = async () => {
    try {
      const r = await api.get("/kundenportal/status-alle");
      setPortalStatuses(r.data?.statuses || {});
    } catch { /* still ignore */ }
  };

  const loadProjektCounts = async () => {
    try {
      const r = await api.get("/module-projekte/counts-by-kunde");
      setProjektCounts(r.data || {});
    } catch { /* still ignore */ }
  };

  // Wenn der Link-Dialog geschlossen wird → Counts neu laden
  useEffect(() => {
    if (!linkDialogKunde) loadLinkCounts();
  }, [linkDialogKunde]);

  // Initial Projekt-Counts laden + nach Schnell-Anlage neu laden
  useEffect(() => {
    if (!neuesProjektFuer) loadProjektCounts();
  }, [neuesProjektFuer]);

  const handleDelete = (kunde) => {
    setDeleteKunde(kunde);
  };

  const handleDeleteFile = async (kundeId, fileIndex, fileName) => {
    if (!window.confirm(`"${fileName}" wirklich unwiderruflich löschen?`)) return;
    try {
      await api.delete(`/modules/kunden/data/${kundeId}/files/${fileIndex}`);
      toast.success("Datei gelöscht");
      loadKunden();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  const handleVcfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await _uploadVcf(file, false);
  };

  const _uploadVcf = async (file, force) => {
    setVcfUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = force ? "/modules/kunden/import-vcf?force=true" : "/modules/kunden/import-vcf";
      await api.post(url, formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`VCF importiert: ${file.name}`);
      setVcfDuplicateDialog(null);
      loadKunden();
    } catch (err) {
      if (err?.response?.status === 409) {
        const detail = err.response.data?.detail || {};
        setVcfDuplicateDialog({
          filename: file.name,
          duplicates: detail.duplicates || [],
          retry: () => _uploadVcf(file, true),
        });
      } else {
        toast.error("Fehler beim VCF-Import");
      }
    }
    finally { setVcfUploading(false); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/modules/kunden/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `kunden_modul_${new Date().toISOString().split("T")[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportiert");
    } catch { toast.error("Fehler"); }
  };

  const statusOrder = { "Neu": 0, "Anfrage": 1, "Interessent": 2, "Kunde": 3, "In Bearbeitung": 4, "Abgeschlossen": 5, "Archiv": 6 };

  // kontakt_status hat Vorrang (konsistent mit Dashboard-Backend)
  const effStatus = (c) => c.kontakt_status || c.status || "Anfrage";
  const ANFRAGE_STATES = ["Anfrage", "Neu", "In Bearbeitung", "in_bearbeitung"];
  const ARCHIV_STATES = ["Abgeschlossen", "Archiv"];

  const filtered = kunden.filter(c => {
    const s = effStatus(c);
    const searchMatch = (((c.vorname || c.nachname) ? `${c.vorname || ''} ${c.nachname || ''}`.trim() : (c.name || '')).toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.firma || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.nachricht || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.anliegen || "").toLowerCase().includes(search.toLowerCase()));
    const catMatch = !categoryFilter || (c.categories || []).includes(categoryFilter);
    // Filter-Logik mit zwei Sonderkategorien:
    //   "aktiv"  -> alle AUSSER Abgeschlossen/Archiv (neuer Standard)
    //   "anfragen" -> nur Anfrage/Neu/In Bearbeitung
    //   "archiv" -> nur Abgeschlossen/Archiv (explizit sichtbar machen)
    //   ""       -> ALLES (inkl. Archiv), nur sinnvoll mit Suchfeld
    //   sonst    -> exakter Status-Match
    const statusMatch = (() => {
      if (!statusFilter) return true;
      if (statusFilter === "aktiv") return !ARCHIV_STATES.includes(s);
      if (statusFilter === "anfragen") return ANFRAGE_STATES.includes(s);
      if (statusFilter === "archiv") return ARCHIV_STATES.includes(s);
      return s === statusFilter;
    })();
    // Wenn explizit gesucht wird, ist das Archiv immer mit drin
    const searchActive = search.trim().length > 0;
    const finalStatusMatch = searchActive ? true : statusMatch;
    return searchMatch && catMatch && finalStatusMatch;
  }).sort((a, b) => {
    // Primär nach Anlage-Datum (neueste zuerst) — User-Wunsch 12.05.2026
    const field = sortMode === "updated_at" ? "updated_at" : "created_at";
    return (b[field] || "").localeCompare(a[field] || "");
  });

  const statusCounts = {};
  KUNDEN_STATUSES.forEach(s => { statusCounts[s] = kunden.filter(k => effStatus(k) === s).length; });
  const anfragenCount = kunden.filter(k => ANFRAGE_STATES.includes(effStatus(k))).length;
  const aktivCount = kunden.filter(k => !ARCHIV_STATES.includes(effStatus(k))).length;
  const archivCount = kunden.filter(k => ARCHIV_STATES.includes(effStatus(k))).length;

  // Counter pro Kategorie — gegen die volle Kundenliste (unabhängig vom Status-Filter).
  const kategorieCounts = {};
  KUNDEN_KATEGORIEN_PAGE.forEach(cat => {
    kategorieCounts[cat] = kunden.filter(k => (k.categories || []).includes(cat)).length;
  });

  return (
    <div data-testid="kunden-modul-page">
      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-start lg:justify-between gap-3 mb-4 lg:mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <h1 className="text-2xl lg:text-4xl font-bold text-emerald-700">Kunden</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            {kunden.length} Kunden gesamt · <span className="text-primary font-medium">{aktivCount} aktiv</span> · {archivCount} archiviert
          </p>
        </div>
        {/* Aktionen — Mobile: eigene Zeile, horizontal scrollbar, "Neuer Kunde" prominent */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap lg:flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport} className="flex-shrink-0">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
          </Button>
          <KundeImportButton onImported={loadKunden} />
          <KundenMultiExportButton selectedIds={Array.from(selectedIds)} totalCount={kunden.length} />
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium cursor-pointer transition-colors flex-shrink-0 ${vcfUploading ? 'bg-muted text-muted-foreground' : 'bg-muted text-foreground hover:bg-muted/80 border border-border'}`} data-testid="btn-vcf-import-kunden-modul">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{vcfUploading ? "Importiere..." : "VCF"}</span>
            <input type="file" accept=".vcf" onChange={handleVcfUpload} className="hidden" disabled={vcfUploading} />
          </label>
          <Button
            size="sm"
            className="lg:h-10 lg:px-4 ml-auto lg:ml-0 flex-shrink-0"
            onClick={() => openEditFor(null)}
            data-testid="btn-new-kunden-modul"
          >
            <Plus className="w-4 h-4" /> Neuer Kunde
          </Button>
        </div>
      </div>

      {/* Sortierung */}
      <div className="flex gap-2 mb-2">
        <Button
          variant="outline" className={sortMode === "created_at" ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white font-bold" : ""}
          size="sm"
          onClick={() => setSortMode("created_at")}
        >
          Anlegedatum
        </Button>
        <Button
          variant="outline" className={sortMode === "updated_at" ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white font-bold" : ""}
          size="sm"
          onClick={() => setSortMode("updated_at")}
        >
          Zuletzt bearbeitet
        </Button>
      </div>

      {/* Suche */}
      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 lg:h-10" placeholder="Kunden suchen..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-kunden-modul" />
        </div>
      </Card>

      {/* Kategorie Filter - gruppiert */}
      <div className="mb-2">
        <GroupedFilterBar
          items={buildGroupedItems(KUNDEN_KATEGORIEN_RAW, kategorieCounts)}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v.startsWith("_group_") ? v.slice(7) : v)}
          allLabel="Alle"
          allCount={kunden.length}
          testIdPrefix="kategorie-filter"
        />
      </div>

      {/* Status Filter - "Aktiv" als Gruppe (alle Live-Stati zusammengefasst) */}
      <div className="flex flex-wrap gap-2 mb-4">
        <GroupedFilterBar
          items={[
            {
              value: "aktiv",
              label: "Aktiv",
              dotClass: "bg-primary",
              count: aktivCount,
              children: KUNDEN_STATUSES.filter(st => !ARCHIV_STATES.includes(st)).map(st => ({
                value: st,
                label: st,
                count: statusCounts[st] || 0,
                dotClass: STATUS_COLORS[st]?.dot?.replace(" animate-pulse", "") || "bg-gray-400",
              })),
            },
            {
              value: "archiv",
              label: "Archiv",
              dotClass: "bg-gray-500",
              count: archivCount,
              accentClass: "bg-gray-600 text-white",
            },
          ]}
          value={statusFilter === "aktiv" ? "" : statusFilter}
          onChange={(v) => setStatusFilter(v || "aktiv")}
          testIdPrefix="status-filter"
        />
      </div>
      {search.trim() && statusFilter && (
        <div className="text-xs text-muted-foreground -mt-2 mb-3">
          ℹ️ Suche aktiv – auch archivierte Kunden werden durchsucht.
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center"><Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-40" /><p className="text-muted-foreground">{search ? "Keine Ergebnisse" : "Erstellen Sie Ihren ersten Kunden"}</p></Card>
      ) : (
        <>
          {/* Auswahl-Leiste */}
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(k => selectedIds.has(k.id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(filtered.map(k => k.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="w-4 h-4 cursor-pointer"
                  data-testid="chk-export-select-all"
                />
                <span>{selectedIds.size > 0 ? `${selectedIds.size} ausgewählt` : "Alle markieren"}</span>
              </label>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Auswahl löschen
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
          {filtered.map(kunde => {
            const isExpanded = expandedId === kunde.id;
            const displayName = (kunde.vorname || kunde.nachname) ? `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() : kunde.name;
            return (
              <Card key={kunde.id} className={`transition-all cursor-pointer overflow-hidden border-l-4 ${STATUS_COLORS[kunde.status || kunde.kontakt_status || "Anfrage"]?.border || ""} ${isExpanded ? 'shadow-lg border-primary/40 ring-1 ring-primary/20' : 'hover:shadow-md'}`} data-testid={`kunden-modul-${kunde.id}`}>
                <div className="flex items-center gap-2 sm:gap-4 p-3 lg:p-4" onClick={() => setExpandedId(isExpanded ? null : kunde.id)}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(kunde.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(kunde.id)) next.delete(kunde.id); else next.add(kunde.id);
                        return next;
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 cursor-pointer flex-shrink-0 hidden sm:inline-block"
                    title="Für Sammel-Export markieren"
                    data-testid={`chk-export-${kunde.id}`}
                  />
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLORS[kunde.status || kunde.kontakt_status || "Anfrage"]?.dot || "bg-gray-400"}`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    {kunde.vorname?.charAt(0)?.toUpperCase() || kunde.nachname?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{displayName}</span>
                      {kunde.firma && <Badge variant="info" className="text-xs hidden sm:inline-flex">{kunde.firma}</Badge>}
                      {kunde.customer_type && kunde.customer_type !== "Privat" && <Badge variant="default" className="text-xs hidden sm:inline-flex">{kunde.customer_type}</Badge>}
                      {(kunde.status || kunde.kontakt_status) && <Badge className={`text-xs ${STATUS_COLORS[kunde.status || kunde.kontakt_status]?.badge || "bg-gray-100 text-gray-600"}`}>{kunde.status || kunde.kontakt_status}</Badge>}
                      <PortalStatusBadge status={portalStatuses[kunde.id] || null} showLabel={false} />
                      {search.trim() && (() => {
                        const q = search.trim().toLowerCase();
                        const nameLabel = (((kunde.vorname || kunde.nachname) ? `${kunde.vorname||''} ${kunde.nachname||''}`.trim() : kunde.name) || '').toLowerCase();
                        const inName = nameLabel.includes(q) || (kunde.email||'').toLowerCase().includes(q) || (kunde.firma||'').toLowerCase().includes(q);
                        if (inName) return null;
                        if ((kunde.anliegen||'').toLowerCase().includes(q)) return <Badge variant="outline" className="text-xs italic" data-testid={`hit-anliegen-${kunde.id}`}>gefunden in: Anliegen</Badge>;
                        if ((kunde.nachricht||'').toLowerCase().includes(q)) return <Badge variant="outline" className="text-xs italic" data-testid={`hit-nachricht-${kunde.id}`}>gefunden in: Nachricht</Badge>;
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-0.5 text-xs sm:text-sm text-muted-foreground flex-wrap">
                      {kunde.phone && <span>{kunde.phone}</span>}
                      {kunde.mobile && <span>{kunde.mobile}</span>}
                      {kunde.email && <MailLink email={kunde.email} className="truncate" />}
                      {kunde.photos?.length > 0 && <span className="text-primary flex items-center gap-1"><File className="w-3 h-3" />{kunde.photos.length}</span>}
                      {(linkCounts[kunde.id] || 0) > 0 && (
                        <span
                          className="text-violet-700 flex items-center gap-1 font-medium"
                          title={`${linkCounts[kunde.id]} aktive(r) Mitarbeiter-Link(s)`}
                          data-testid={`link-badge-${kunde.id}`}
                        >
                          <LinkIcon className="w-3 h-3" />{linkCounts[kunde.id]}
                        </span>
                      )}
                    </div>
                    {(kunde.notes || kunde.nachricht) && (
                      <p className="text-sm text-foreground mt-1 line-clamp-2" data-testid={`kunde-vorschau-${kunde.id}`}>{kunde.notes || kunde.nachricht}</p>
                    )}
                  </div>
                  {(kunde.categories || []).length > 0 && (
                    <div className="hidden lg:flex flex-wrap gap-1">
                      {kunde.categories.map(cat => <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>)}
                    </div>
                  )}
                  <div className="hidden sm:flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        const url = `/popup/projekt/new?kunde_id=${kunde.id}`;
                        if (!openInPopup(url)) setNeuesProjektFuer(kunde);
                      }}
                      className="p-2 hover:bg-emerald-50 rounded-sm text-emerald-700"
                      title="Neues Projekt für diesen Kunden anlegen"
                      data-testid={`btn-quick-projekt-${kunde.id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => navigate(`/module/projekte/werkbank/${kunde.id}`)} className="p-2 hover:bg-emerald-50 rounded-sm text-emerald-700 relative" title="Projekt-Werkbank öffnen" data-testid={`btn-projekte-${kunde.id}`}>
                      <Folder className="w-4 h-4" />
                      {(projektCounts[kunde.id] || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 text-[9px] bg-emerald-600 text-white rounded-full px-1 leading-tight min-w-[16px] text-center">{projektCounts[kunde.id]}</span>
                      )}
                    </button>
                    <button onClick={() => { setExpandedId(kunde.id); setEditingId(kunde.id); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten" data-testid={`btn-edit-inline-${kunde.id}`}><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(kunde)} className="p-2 rounded-sm hover:bg-destructive/10 text-red-600" title="Kunde sicher löschen (mit Vorab-Backup)" data-testid={`btn-kunde-delete-${kunde.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Detail */}
                {isExpanded && (
                  <div className="border-t bg-muted/30 p-4 lg:p-6 animate-in slide-in-from-top-2 duration-200">
                    {editingId === kunde.id ? (
                      <KundeInlineEdit
                        kunde={kunde}
                        onSaved={() => { setEditingId(null); loadKunden(); }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Kontaktdaten</h4>
                        <div className="space-y-2">
                          {kunde.anrede && <p className="text-sm"><span className="font-medium">Anrede:</span> {kunde.anrede}</p>}
                          {kunde.firma && <p className="text-sm"><span className="font-medium">Firma:</span> {kunde.firma}</p>}
                          {kunde.vorname && <p className="text-sm"><span className="font-medium">Vorname:</span> {kunde.vorname}</p>}
                          {kunde.nachname && <p className="text-sm"><span className="font-medium">Nachname:</span> {kunde.nachname}</p>}
                          {kunde.email && <p className="text-sm flex items-center gap-2"><span className="font-medium">E-Mail:</span> <MailLink email={kunde.email} /></p>}
                          {kunde.phone && <p className="text-sm"><span className="font-medium">Telefon:</span> {kunde.phone}</p>}
                          {kunde.mobile && <p className="text-sm"><span className="font-medium">Mobil:</span> {kunde.mobile}</p>}
                          {(kunde.strasse || kunde.address) && (
                            <div>
                              <span className="text-sm font-medium">Adresse:</span>
                              <p className="text-sm text-muted-foreground">{kunde.strasse} {kunde.hausnummer}{kunde.plz || kunde.ort ? `, ${kunde.plz} ${kunde.ort}` : ""}</p>
                              <button onClick={() => { const addr = kunde.address || `${kunde.strasse} ${kunde.hausnummer}, ${kunde.plz} ${kunde.ort}`; navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`); toast.success("Maps-Link kopiert!"); }}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"><Globe className="w-3 h-3" /> Karten-Link kopieren</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Details</h4>
                        <div className="space-y-2">
                          <p className="text-sm"><span className="font-medium">Typ:</span> {kunde.customer_type || "Privat"}</p>
                          <p className="text-sm"><span className="font-medium">Status:</span> {kunde.status || "Neu"}</p>
                          {(kunde.categories || []).length > 0 && (
                            <div><span className="text-sm font-medium">Kategorien:</span>
                              <div className="flex flex-wrap gap-1 mt-1">{kunde.categories.map(cat => <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Notizen</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{kunde.notes || "Keine Notizen"}</p>
                        {kunde.nachricht && (
                          <div className="mt-3 pt-3 border-t">
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Nachricht (Anfrage)</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{kunde.nachricht}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bilder */}
                    {(() => {
                      const isImage = (f) => { const ct = typeof f === 'string' ? '' : f.content_type || ''; const nm = typeof f === 'string' ? f : f.filename || ''; return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(nm); };
                      const images = (kunde.photos || []).map((file, origIdx) => ({ file, origIdx })).filter(x => isImage(x.file));
                      if (images.length === 0) return null;
                      return (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Bilder ({images.length})</h4>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {images.map(({ file, origIdx }) => {
                              const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
                              const rawUrl = typeof file === 'string' ? file : file.url;
                              const fileUrl = rawUrl?.startsWith('http') ? rawUrl : `${backendUrl}/api/storage/${rawUrl}`;
                              const fileName = typeof file === 'string' ? file.split('/').pop() : (file.filename || `Bild ${origIdx + 1}`);
                              return (
                                <div key={origIdx} className="relative aspect-square rounded-lg overflow-hidden border hover:border-primary hover:shadow-lg transition-all group" data-testid={`kunde-bild-${kunde.id}-${origIdx}`}>
                                  <img src={fileUrl} alt={fileName} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 cursor-pointer" onClick={() => window.open(fileUrl, '_blank')} onError={e => { e.target.style.display = 'none'; }} />
                                  <button
                                    type="button"
                                    onClick={(ev) => { ev.stopPropagation(); handleDeleteFile(kunde.id, origIdx, fileName); }}
                                    className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                                    title="Bild löschen"
                                    data-testid={`btn-delete-bild-${kunde.id}-${origIdx}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Dokumente */}
                    {(() => {
                      const isImage = (f) => { const ct = typeof f === 'string' ? '' : f.content_type || ''; const nm = typeof f === 'string' ? f : f.filename || ''; return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(nm); };
                      const docs = (kunde.photos || []).map((file, origIdx) => ({ file, origIdx })).filter(x => !isImage(x.file));
                      if (docs.length === 0) return null;
                      return (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2"><File className="w-4 h-4" /> Dokumente ({docs.length})</h4>
                          <div className="space-y-2">
                            {docs.map(({ file, origIdx }) => {
                              const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
                              const fileName = typeof file === 'string' ? file.split('/').pop() : file.filename || `Datei ${origIdx + 1}`;
                              const rawUrl = typeof file === 'string' ? file : file.url;
                              const fileUrl = rawUrl?.startsWith('http') ? rawUrl : `${backendUrl}/api/storage/${rawUrl}`;
                              return (
                                <div key={origIdx} className="flex items-center gap-3 p-2 rounded-sm border hover:border-primary/50 hover:bg-primary/5 transition-all group" data-testid={`kunde-doc-${kunde.id}-${origIdx}`}>
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                                    <File className="w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0" />
                                    <span className="text-sm truncate flex-1">{fileName}</span>
                                    <Download className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(kunde.id, origIdx, fileName)}
                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Dokument löschen"
                                    data-testid={`btn-delete-doc-${kunde.id}-${origIdx}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Aufgaben (Datenmaske aus module_aufgaben gefiltert auf diesen Kunden) */}
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <AufgabenPanel kunde_id={kunde.id} title="Aufgaben für diesen Kunden" />
                      <TerminePanel kunde_id={kunde.id} title="Termine für diesen Kunden" />
                    </div>

                    {/* Aktionen */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                      <Button size="sm" onClick={() => setEditingId(kunde.id)} data-testid={`btn-detail-edit-inline-${kunde.id}`}><Edit className="w-4 h-4" /> Bearbeiten</Button>
                <Button size="sm" variant="outline" onClick={() => openEditFor(kunde)} data-testid={`btn-detail-files-${kunde.id}`}><Upload className="w-4 h-4" /> Dateien</Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                        const url = `/popup/projekt/new?kunde_id=${kunde.id}`;
                        if (!openInPopup(url)) setNeuesProjektFuer(kunde);
                      }}
                        data-testid={`btn-detail-quick-projekt-${kunde.id}`}
                      >
                        <Plus className="w-4 h-4" /> Neues Projekt
                      </Button>
                      <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => navigate(`/module/projekte/werkbank/${kunde.id}`)} data-testid={`btn-detail-projekte-${kunde.id}`}>
                        <Folder className="w-4 h-4" /> Werkbank{(projektCounts[kunde.id] || 0) > 0 ? ` (${projektCounts[kunde.id]})` : ""}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/quotes/new?customer=${kunde.id}`)}><FileText className="w-4 h-4" /> Angebot erstellen</Button>
                      <KundeExportButton kunde_id={kunde.id} kunde_name={kunde.name || `${kunde.vorname || ""} ${kunde.nachname || ""}`.trim()} />
                      {kunde.email && (
                        <button
                          onClick={() => setMailHistoryFor({
                            email: kunde.email,
                            name: kunde.name || `${kunde.vorname || ""} ${kunde.nachname || ""}`.trim() || kunde.email,
                          })}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors"
                          data-testid={`btn-mail-history-${kunde.id}`}
                          title="Alle Mails von/an diesen Kunden aus IMAP anzeigen"
                        >
                          <Mail className="w-4 h-4" />
                          Mailverlauf
                        </button>
                      )}
                      <button
                        onClick={() => setLinkDialogKunde(kunde)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors"
                        data-testid={`btn-kunde-link-${kunde.id}`}
                        title="Temporären Link für Mitarbeiter / Monteur erzeugen"
                      >
                        <Mail className="w-4 h-4" />
                        Link für Mitarbeiter
                        {(linkCounts[kunde.id] || 0) > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-violet-600 text-white rounded-full">
                            {linkCounts[kunde.id]}
                          </span>
                        )}
                      </button>
                      {/* Altes Portal ausgeblendet (Ralph 21.06.2026) — nicht gelöscht.
                          Neuer Weg ist "🔗 Portal-Link erstellen" (module_portal_wizard). */}
                      {false && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.get(`/portals/for-customer/${kunde.id}`);
                            if (res.data?.exists && res.data?.portal?.id) {
                              navigate(`/portals?portal=${res.data.portal.id}`);
                            } else {
                              if (!kunde.email) { toast.error("Kunde hat keine E-Mail – erst ergänzen"); return; }
                              if (!window.confirm(`Neues Kundenportal für ${kunde.vorname || ""} ${kunde.nachname || ""}${kunde.firma ? ` (${kunde.firma})` : ""} anlegen?`)) return;
                              const created = await api.post(`/portals/from-customer/${kunde.id}`, {});
                              const newId = created.data?.id;
                              toast.success("Portal erstellt");
                              if (newId) {
                                navigate(`/portals?portal=${newId}`);
                              } else {
                                navigate(`/portals`);
                              }
                            }
                          } catch (err) {
                            toast.error(err?.response?.data?.detail || "Fehler");
                          }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                        data-testid={`btn-portal-${kunde.id}`}
                      >
                        <Globe className="w-4 h-4" />
                        Kundenportal öffnen / anlegen
                      </button>
                      )}
                      <button
                        onClick={() => { setPortalLinkKunde(kunde); setPortalLinkText(""); setPortalLinkResult(""); }}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        data-testid={`btn-portal-link-erstellen-${kunde.id}`}
                        title="Einmaligen Portal-Link für den Kunden erzeugen"
                      >
                        <LinkIcon className="w-4 h-4" />
                        🔗 Portal-Link erstellen
                      </button>
                      <button
                        onClick={() => setEinsatzCtx({ kundeId: kunde.id })}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors"
                        data-testid={`btn-to-einsatz-${kunde.id}`}
                      >
                        <Wrench className="w-4 h-4" />
                        Neuer Einsatz
                      </button>
                    </div>

                    {/* Dokumenten-Hub für diesen Kunden */}
                    <CustomerDocumentsPanel customerId={kunde.id} />
                    </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {openEdits.map((k) => (
        <KundenFormModal
          key={k?.id || k?.__key}
          isOpen={true}
          kunde={k && !k.__new ? k : null}
          onClose={() => closeEditFor(k)}
          onSave={() => { closeEditFor(k); loadKunden(); }}
        />
      ))}

      {/* Kontakt-Import Modal */}
      <KontaktImportModal isOpen={showKontaktImport} onClose={() => setShowKontaktImport(false)} onImported={() => { setShowKontaktImport(false); loadKunden(); }} />

      {/* VCF-Duplikat-Dialog */}
      {vcfDuplicateDialog && (
        <DuplicateDialog
          title={`Kunde aus "${vcfDuplicateDialog.filename}" koennte bereits existieren`}
          duplicates={vcfDuplicateDialog.duplicates}
          onCancel={() => setVcfDuplicateDialog(null)}
          onOpen={(id) => { setVcfDuplicateDialog(null); const k = kunden.find(x => x.id === id); if (k) openEditFor(k); }}
          onForce={vcfDuplicateDialog.retry}
          loading={vcfUploading}
        />
      )}

      {deleteKunde && (
        <KundeDeleteDialog
          kunde_id={deleteKunde.id}
          kunde_name={deleteKunde.name || `${deleteKunde.vorname || ""} ${deleteKunde.nachname || ""}`.trim() || deleteKunde.email}
          onClose={() => setDeleteKunde(null)}
          onDeleted={() => { setDeleteKunde(null); loadKunden(); }}
        />
      )}

      <MailHistoryModal
        isOpen={!!mailHistoryFor}
        onClose={() => setMailHistoryFor(null)}
        email={mailHistoryFor?.email || ""}
        kundeName={mailHistoryFor?.name || ""}
      />

      <KundenLinkDialog
        isOpen={!!linkDialogKunde}
        onClose={() => setLinkDialogKunde(null)}
        kunde={linkDialogKunde}
      />

      <Modal isOpen={!!portalLinkKunde} onClose={() => setPortalLinkKunde(null)} title="🔗 Portal-Link erstellen" size="sm">
        <div className="p-4 space-y-4" data-testid="portal-link-dialog">
          {!portalLinkResult ? (
            <>
              <p className="text-sm text-muted-foreground">
                Erstellt einen einmaligen Link für{" "}
                <strong>{portalLinkKunde?.vorname || ""} {portalLinkKunde?.nachname || ""}{portalLinkKunde?.firma ? ` (${portalLinkKunde.firma})` : ""}</strong>.
                Der Kunde kann darüber Nachricht und Fotos schicken.
              </p>
              <div>
                <label className="text-sm font-medium block mb-1">Auftrag-Text (was soll der Kunde tun?)</label>
                <Textarea
                  value={portalLinkText}
                  onChange={(e) => setPortalLinkText(e.target.value)}
                  rows={3}
                  placeholder="z.B. Bitte schicken Sie Fotos vom Schaden"
                  data-testid="portal-link-text-input"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPortalLinkKunde(null)}>Abbrechen</Button>
                <Button
                  disabled={portalLinkBusy}
                  data-testid="portal-link-erstellen-submit"
                  onClick={async () => {
                    setPortalLinkBusy(true);
                    try {
                      const res = await api.post("/kundenportal/link-erstellen", {
                        kunde_id: portalLinkKunde.id,
                        auftrag_text: portalLinkText.trim(),
                      });
                      const full = `${window.location.origin}/kundenportal/${res.data.portal_token}`;
                      setPortalLinkResult(full);
                      loadPortalStatuses();
                      toast.success("Portal-Link erstellt");
                    } catch (err) {
                      toast.error(err?.response?.data?.detail || "Fehler beim Erstellen");
                    } finally {
                      setPortalLinkBusy(false);
                    }
                  }}
                >
                  {portalLinkBusy ? "Erstelle…" : "Link erstellen"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3" data-testid="portal-link-result">
              <p className="text-sm font-medium text-emerald-700">✅ Link erstellt — kopieren und per Mail an den Kunden schicken:</p>
              <div className="flex items-center gap-2">
                <Input value={portalLinkResult} readOnly className="text-sm" data-testid="portal-link-result-input" />
                <Button
                  variant="outline"
                  data-testid="portal-link-copy"
                  onClick={() => { navigator.clipboard.writeText(portalLinkResult); toast.success("Link kopiert"); }}
                >
                  Kopieren
                </Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setPortalLinkKunde(null)}>Fertig</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {neuesProjektFuer && (
        <NewProjektDialog
          kundeId={neuesProjektFuer.id}
          kunde={neuesProjektFuer}
          isFirstProjekt={(projektCounts[neuesProjektFuer.id] || 0) === 0}
          onClose={() => setNeuesProjektFuer(null)}
          onCreated={() => { setNeuesProjektFuer(null); loadProjektCounts(); }}
        />
      )}

      <EinsatzModal
        open={!!einsatzCtx}
        context={einsatzCtx || {}}
        onClose={() => setEinsatzCtx(null)}
        onSaved={() => loadLinkCounts()}
      />
    </div>
  );
};


// ==================== DUPLICATE DIALOG ====================
const DuplicateDialog = ({ title, duplicates, onCancel, onOpen, onForce, loading }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="duplicate-dialog">
    <div className="bg-card rounded-lg shadow-xl max-w-lg w-full p-6">
      <h3 className="text-lg font-semibold text-amber-700 mb-2">{title || "Kunde koennte bereits existieren"}</h3>
      <p className="text-sm text-muted-foreground mb-4">Folgende Kunden wurden gefunden:</p>
      <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
        {duplicates.map((d) => (
          <div key={d.id} className="border rounded p-3 hover:bg-muted">
            <div className="font-medium">{d.name || "(ohne Name)"}</div>
            {d.email && <div className="text-sm text-muted-foreground">{d.email}</div>}
            {d.phone && <div className="text-sm text-muted-foreground">{d.phone}</div>}
            {d.address && <div className="text-sm text-muted-foreground">{d.address}</div>}
            {onOpen && (
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline mt-1"
                onClick={() => onOpen(d.id)}
                data-testid={`btn-open-existing-${d.id}`}
              >
                Bestehenden oeffnen →
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 border rounded hover:bg-slate-50" data-testid="btn-duplicate-cancel">
          Abbrechen
        </button>
        <button type="button" onClick={onForce} disabled={loading} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50" data-testid="btn-duplicate-force">
          {loading ? "Lege an..." : "Trotzdem anlegen"}
        </button>
      </div>
    </div>
  </div>
);


// ==================== KUNDE INLINE EDIT ====================
// Bearbeiten direkt in der aufgeklappten Kundenkarte (kein separates Fenster).
const KundeInlineEdit = ({ kunde, onSaved, onCancel }) => {
  const [form, setForm] = useState({
    anrede: kunde.anrede || "", vorname: kunde.vorname || "", nachname: kunde.nachname || "",
    firma: kunde.firma || "", email: kunde.email || "", phone: kunde.phone || "", mobile: kunde.mobile || "",
    strasse: kunde.strasse || "", hausnummer: kunde.hausnummer || "", plz: kunde.plz || "", ort: kunde.ort || "",
    customer_type: kunde.customer_type || "Privat", status: kunde.status || kunde.kontakt_status || "Anfrage",
    categories: kunde.categories || [], notes: kunde.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const KUNDEN_STATUSES = useTextvorlagen("kunden_status", KUNDEN_STATUSES_FALLBACK);
  const KUNDEN_KATEGORIEN = useTextvorlagen("kunden_kategorie", KUNDEN_KATEGORIEN_FALLBACK);
  const ANREDEN = useTextvorlagen("anrede", ANREDEN_FALLBACK);
  const CUSTOMER_TYPES = useTextvorlagen("kunden_typ", CUSTOMER_TYPES_FALLBACK);

  const toggleCat = (cat) => setForm(f => ({
    ...f,
    categories: (f.categories || []).includes(cat) ? f.categories.filter(c => c !== cat) : [...(f.categories || []), cat],
  }));

  const save = async () => {
    if (!form.vorname && !form.nachname && !form.firma) { toast.error("Vorname, Nachname oder Firma erforderlich"); return; }
    setSaving(true);
    try {
      await api.put(`/modules/kunden/data/${kunde.id}`, form);
      toast.success("Kunde aktualisiert");
      broadcast("kunden-changed", { kundeId: kunde.id });
      onSaved();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" && detail ? detail : "Fehler beim Speichern");
    } finally { setSaving(false); }
  };

  const inputCls = "h-9 text-sm";
  const selectCls = "w-full h-9 rounded-sm border border-input bg-background px-2 text-sm";
  const lblCls = "block text-[11px] font-medium text-muted-foreground mb-0.5";
  return (
    <div className="space-y-4" data-testid={`kunde-inline-edit-${kunde.id}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        {/* Spalte 1 — Kontakt */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide flex items-center gap-1"><Edit className="w-3.5 h-3.5" /> Kontakt</h4>
          <div>
            <label className={lblCls}>Anrede</label>
            <select value={form.anrede} onChange={e => setForm({ ...form, anrede: e.target.value })} className={selectCls} data-testid={`edit-anrede-${kunde.id}`}>
              <option value="">Bitte wählen</option>{ANREDEN.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div><label className={lblCls}>Vorname</label><Input className={inputCls} value={form.vorname} onChange={e => setForm({ ...form, vorname: e.target.value })} data-testid={`edit-vorname-${kunde.id}`} /></div>
          <div><label className={lblCls}>Nachname</label><Input className={inputCls} value={form.nachname} onChange={e => setForm({ ...form, nachname: e.target.value })} data-testid={`edit-nachname-${kunde.id}`} /></div>
          <div><label className={lblCls}>Firma</label><Input className={inputCls} value={form.firma} onChange={e => setForm({ ...form, firma: e.target.value })} data-testid={`edit-firma-${kunde.id}`} /></div>
          <div><label className={lblCls}>E-Mail</label><Input className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid={`edit-email-${kunde.id}`} /></div>
          <div><label className={lblCls}>Telefon</label><Input className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid={`edit-phone-${kunde.id}`} /></div>
          <div><label className={lblCls}>Mobil / Handy</label><Input className={inputCls} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} data-testid={`edit-mobile-${kunde.id}`} /></div>
        </div>

        {/* Spalte 2 — Details & Adresse */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Details &amp; Adresse</h4>
          <div>
            <label className={lblCls}>Kundentyp</label>
            <select value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })} className={selectCls} data-testid={`edit-typ-${kunde.id}`}>
              {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selectCls} data-testid={`edit-status-${kunde.id}`}>
              {KUNDEN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Straße / Nr.</label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8"><Input className={inputCls} placeholder="Straße" value={form.strasse} onChange={e => setForm({ ...form, strasse: e.target.value })} data-testid={`edit-strasse-${kunde.id}`} /></div>
              <div className="col-span-4"><Input className={inputCls} placeholder="Nr." value={form.hausnummer} onChange={e => setForm({ ...form, hausnummer: e.target.value })} data-testid={`edit-nr-${kunde.id}`} /></div>
            </div>
          </div>
          <div>
            <label className={lblCls}>PLZ / Ort</label>
            <div className="grid grid-cols-4 gap-2">
              <div><Input className={inputCls} placeholder="PLZ" value={form.plz} onChange={e => setForm({ ...form, plz: e.target.value })} data-testid={`edit-plz-${kunde.id}`} /></div>
              <div className="col-span-3"><Input className={inputCls} placeholder="Ort" value={form.ort} onChange={e => setForm({ ...form, ort: e.target.value })} data-testid={`edit-ort-${kunde.id}`} /></div>
            </div>
          </div>
        </div>

        {/* Spalte 3 — Kategorien & Notizen */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Kategorien &amp; Notizen</h4>
          <div className="flex flex-wrap gap-1.5">
            {KUNDEN_KATEGORIEN.map(cat => (
              <button key={cat} type="button" onClick={() => toggleCat(cat)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${(form.categories || []).includes(cat) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input hover:border-primary/50"}`}>{cat}</button>
            ))}
          </div>
          <div><label className={lblCls}>Notizen</label><Textarea className="text-sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={5} data-testid={`edit-notes-${kunde.id}`} /></div>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t">
        <Button size="sm" onClick={save} disabled={saving} data-testid={`edit-save-${kunde.id}`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />} Speichern
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving} data-testid={`edit-cancel-${kunde.id}`}>Abbrechen</Button>
      </div>
    </div>
  );
};


// ==================== KUNDEN FORM MODAL ====================
const ABSCHLUSS_STATES = ["Abgeschlossen", "Archiv"];

const KundenFormModal = ({ isOpen, onClose, kunde, onSave, popoutEnabled = true }) => {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [pendingAbschluss, setPendingAbschluss] = useState(null);  // {newStatus} oder null
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const KUNDEN_STATUSES = useTextvorlagen("kunden_status", KUNDEN_STATUSES_FALLBACK);
  const KUNDEN_KATEGORIEN = useTextvorlagen("kunden_kategorie", KUNDEN_KATEGORIEN_FALLBACK);
  const ANREDEN = useTextvorlagen("anrede", ANREDEN_FALLBACK);
  const CUSTOMER_TYPES = useTextvorlagen("kunden_typ", CUSTOMER_TYPES_FALLBACK);

  useEffect(() => {
    if (kunde) {
      setForm({ anrede: kunde.anrede || "", vorname: kunde.vorname || "", nachname: kunde.nachname || "", firma: kunde.firma || "", email: kunde.email || "", phone: kunde.phone || "", mobile: kunde.mobile || "", strasse: kunde.strasse || "", hausnummer: kunde.hausnummer || "", plz: kunde.plz || "", ort: kunde.ort || "", objekt_strasse: kunde.objekt_strasse || "", objekt_plz: kunde.objekt_plz || "", objekt_ort: kunde.objekt_ort || "", customer_type: kunde.customer_type || "Privat", status: kunde.status || kunde.kontakt_status || "Anfrage", categories: kunde.categories || [], notes: kunde.notes || "", nachricht: kunde.nachricht || "", abschluss_grund: kunde.abschluss_grund || "", abschluss_at: kunde.abschluss_at || "" });
    } else {
      setForm({ anrede: "", vorname: "", nachname: "", firma: "", email: "", phone: "", mobile: "", strasse: "", hausnummer: "", plz: "", ort: "", objekt_strasse: "", objekt_plz: "", objekt_ort: "", customer_type: "Privat", status: "Anfrage", categories: [], notes: "", nachricht: "" });
    }
    setSelectedFiles([]);
  }, [kunde]);

  const lookupPlz = async (plz, ortField) => {
    if (!plz || plz.length !== 5 || !/^\d{5}$/.test(plz)) return;
    try {
      const res = await fetch(`https://api.zippopotam.us/de/${plz}`);
      if (res.ok) {
        const data = await res.json();
        const ort = data.places?.[0]?.["place name"] || "";
        if (ort) setForm(f => ({ ...f, [ortField]: ort }));
      }
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await _doSubmit(false);
  };

  const _doSubmit = async (force) => {
    if (!form.vorname && !form.nachname && !form.firma) { toast.error("Vorname, Nachname oder Firma erforderlich"); return; }
    setLoading(true);
    setUploadPhase("saving");
    setUploadPct(0);
    try {
      let kundeId = kunde?.id;
      if (kunde) {
        await api.put(`/modules/kunden/data/${kunde.id}`, form);
      } else {
        const payload = force ? { ...form, force: true } : form;
        const res = await api.post("/modules/kunden/data", payload);
        kundeId = res.data.id;
      }
      if (selectedFiles.length > 0 && kundeId) {
        setUploadPhase("uploading");
        setUploadPct(0);
        const formData = new FormData();
        selectedFiles.forEach(f => formData.append('files', f));
        await api.post(`/modules/kunden/data/${kundeId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => {
            if (ev.total) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
          },
        });
      }
      toast.success(kunde ? "Kunde aktualisiert" : "Kunde erstellt");
      setDuplicateDialog(null);
      broadcast("kunden-changed", { kundeId });
      onSave();
    } catch (err) {
      // Duplikat-Konflikt (nur bei Neu-Anlegen)
      if (err?.response?.status === 409 && !kunde) {
        const detail = err.response.data?.detail || {};
        setDuplicateDialog({
          duplicates: detail.duplicates || [],
          retry: () => _doSubmit(true),
        });
      } else {
        const detail = err?.response?.data?.detail;
        toast.error(typeof detail === "string" && detail ? detail : (err?.message || "Fehler beim Speichern"));
      }
    }
    finally { setLoading(false); setUploadPhase(null); setUploadPct(0); }
  };

  const [duplicateDialog, setDuplicateDialog] = useState(null);
  const [uploadPhase, setUploadPhase] = useState(null); // null | "saving" | "uploading"
  const [uploadPct, setUploadPct] = useState(0);

  const MAX_FILES_TOTAL = 40;
  const bestehendeAnzahl = (kunde?.photos || []).length;
  const verbleibendeSlots = Math.max(0, MAX_FILES_TOTAL - bestehendeAnzahl - selectedFiles.length);
  const [isDraggingOverForm, setIsDraggingOverForm] = useState(false);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.some(f => f.size > 10 * 1024 * 1024)) { toast.error("Eine Datei ist groesser als 10 MB. Bitte komprimieren oder kleinere Datei waehlen."); return; }
    const gesamtgroesse_neu = files.reduce((sum, f) => sum + f.size, 0);
    const gesamtgroesse_bestehend = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    if (gesamtgroesse_neu + gesamtgroesse_bestehend > 45 * 1024 * 1024) { toast.error("Die ausgewaehlten Dateien sind zusammen zu gross (max. 45 MB gesamt). Bitte weniger Dateien auf einmal hochladen."); return; }
    const noch_moeglich = Math.max(0, MAX_FILES_TOTAL - bestehendeAnzahl - selectedFiles.length);
    if (noch_moeglich === 0) {
      toast.error(`Maximum von ${MAX_FILES_TOTAL} Dateien erreicht. Bitte zuerst Dateien loeschen.`);
      return;
    }
    if (files.length > noch_moeglich) {
      toast.error(`Sie koennen nur noch ${noch_moeglich} Datei(en) hinzufuegen (Maximum ${MAX_FILES_TOTAL}). ${files.length - noch_moeglich} Datei(en) wurden ignoriert.`);
    }
    const akzeptiert = files.slice(0, noch_moeglich);
    setSelectedFiles(prev => [...prev, ...akzeptiert]);
  };

  const popoutUrl = popoutEnabled && kunde?.id ? `/popup/kunde/${kunde.id}` : (popoutEnabled && !kunde ? "/popup/kunde/new" : null);

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={kunde ? "Kunde bearbeiten" : "Neuer Kunde"} size="lg" popoutUrl={popoutUrl}>
      {duplicateDialog && (
        <DuplicateDialog
          duplicates={duplicateDialog.duplicates}
          onCancel={() => setDuplicateDialog(null)}
          onForce={duplicateDialog.retry}
          loading={loading}
        />
      )}
      <form
        onSubmit={handleSubmit}
        className={`space-y-4 relative rounded-sm transition-all ${isDraggingOverForm ? "ring-4 ring-primary/60 ring-offset-2 bg-primary/5" : ""}`}
        data-testid="kunden-modul-form"
        onDragEnter={e => { e.preventDefault(); if (e.dataTransfer?.types?.includes("Files") && verbleibendeSlots > 0) setIsDraggingOverForm(true); }}
        onDragOver={e => { e.preventDefault(); if (e.dataTransfer?.types?.includes("Files") && verbleibendeSlots > 0) setIsDraggingOverForm(true); }}
        onDragLeave={e => { if (e.currentTarget === e.target) setIsDraggingOverForm(false); }}
        onDrop={e => { e.preventDefault(); setIsDraggingOverForm(false); if (e.dataTransfer?.files?.length) handleFileSelect({ target: { files: e.dataTransfer.files } }); }}
      >
        {isDraggingOverForm && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm" data-testid="kunden-fullform-dropoverlay">
            <div className="bg-card border-2 border-dashed border-primary rounded-lg px-8 py-6 text-center shadow-2xl">
              <Upload className="w-16 h-16 text-primary mx-auto mb-3" />
              <p className="text-lg font-semibold">Hier loslassen — Dateien hinzufuegen</p>
              <p className="text-sm text-muted-foreground mt-1">{verbleibendeSlots} Datei(en) moeglich</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Anrede</label>
              <TextvorlagenInlineManager
                docType="anrede"
                label="Anreden"
                onChanged={() => window.dispatchEvent(new CustomEvent("textvorlagen-changed", { detail: { docType: "anrede" } }))}
              />
            </div>
            <select value={form.anrede || ""} onChange={e => setForm({ ...form, anrede: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
              <option value="">Bitte waehlen</option>
              {ANREDEN.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Kundentyp</label>
              <TextvorlagenInlineManager
                docType="kunden_typ"
                label="Kundentypen"
                onChanged={() => window.dispatchEvent(new CustomEvent("textvorlagen-changed", { detail: { docType: "kunden_typ" } }))}
              />
            </div>
            <select value={form.customer_type || "Privat"} onChange={e => setForm({ ...form, customer_type: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
              {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {(form.customer_type === "Firma" || form.customer_type === "Gewerblich" || form.firma) && (
          <div><label className="block text-sm font-medium mb-2">Firmenname</label><Input value={form.firma || ""} onChange={e => setForm({ ...form, firma: e.target.value })} placeholder="Firma GmbH" /></div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-2">Vorname *</label><Input value={form.vorname || ""} onChange={e => setForm({ ...form, vorname: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-2">Nachname *</label><Input value={form.nachname || ""} onChange={e => setForm({ ...form, nachname: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-2">E-Mail</label><Input type="text" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-2">Telefon</label><Input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-2">Mobil / Handy</label><Input value={form.mobile || ""} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Kategorien</label>
            <TextvorlagenInlineManager
              docType="kunden_kategorie"
              label="Kunden-Kategorien"
              onChanged={() => window.dispatchEvent(new CustomEvent("textvorlagen-changed", { detail: { docType: "kunden_kategorie" } }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {KUNDEN_KATEGORIEN.map(cat => (<button key={cat} type="button" onClick={() => { const cats = (form.categories || []).includes(cat) ? form.categories.filter(c => c !== cat) : [...(form.categories || []), cat]; setForm({ ...form, categories: cats }); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${(form.categories || []).includes(cat) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input"}`}>{cat}</button>))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Status</label>
            <TextvorlagenInlineManager
              docType="kunden_status"
              label="Kunden-Status"
              onChanged={() => window.dispatchEvent(new CustomEvent("textvorlagen-changed", { detail: { docType: "kunden_status" } }))}
            />
          </div>
          <select
            value={form.status || "Neu"}
            onChange={e => {
              const newStatus = e.target.value;
              const oldStatus = form.status || "Neu";
              if (ABSCHLUSS_STATES.includes(newStatus) && !ABSCHLUSS_STATES.includes(oldStatus)) {
                // Abschluss-Dialog erzwingen
                setPendingAbschluss({ newStatus });
              } else {
                setForm({ ...form, status: newStatus });
              }
            }}
            className="w-full h-10 rounded-sm border border-input bg-background px-3"
            data-testid="kunden-form-status"
          >
            {KUNDEN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {form.abschluss_grund && (
            <div className="mt-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-sm p-2">
              <span className="font-semibold">Abschluss-Grund:</span> {form.abschluss_grund}
              {form.abschluss_at && (
                <span className="text-muted-foreground ml-1">· {new Date(form.abschluss_at).toLocaleString("de-DE")}</span>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Adresse</label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8"><Input placeholder="Strasse" value={form.strasse || ""} onChange={e => setForm({ ...form, strasse: e.target.value })} /></div>
            <div className="col-span-4"><Input placeholder="Nr." value={form.hausnummer || ""} onChange={e => setForm({ ...form, hausnummer: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div><Input placeholder="PLZ" value={form.plz || ""} onChange={e => { setForm({ ...form, plz: e.target.value }); lookupPlz(e.target.value, "ort"); }} /></div>
            <div className="col-span-3"><Input placeholder="Ort" value={form.ort || ""} onChange={e => setForm({ ...form, ort: e.target.value })} /></div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Objektadresse <span className="text-xs text-muted-foreground">(falls abweichend)</span></label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8"><Input placeholder="Objekt Strasse" value={form.objekt_strasse || ""} onChange={e => setForm({ ...form, objekt_strasse: e.target.value })} /></div>
            <div className="col-span-2"><Input placeholder="PLZ" value={form.objekt_plz || ""} onChange={e => { setForm({ ...form, objekt_plz: e.target.value }); lookupPlz(e.target.value, "objekt_ort"); }} /></div>
            <div className="col-span-2"><Input placeholder="Ort" value={form.objekt_ort || ""} onChange={e => setForm({ ...form, objekt_ort: e.target.value })} /></div>
          </div>
        </div>
        <div><label className="block text-sm font-medium mb-2">Nachricht / Anliegen</label><TextareaWithAI value={form.nachricht || ""} onChange={e => setForm({ ...form, nachricht: e.target.value })} rows={3} placeholder="Was wird benoetigt? Beschreibung des Anliegens..." feldLabel="Anliegen" kontext="kunden_anliegen" testId="kunde-anliegen" /></div>
        <div><label className="block text-sm font-medium mb-2">Notizen <span className="text-xs text-muted-foreground">(intern)</span></label><TextareaWithAI value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Interne Bemerkungen..." feldLabel="Notizen" kontext="kunden_notizen" testId="kunde-notizen" /></div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Dateien <span className="text-xs text-muted-foreground">(max {MAX_FILES_TOTAL} insgesamt, je 10 MB)</span></label>
            <span className={`text-xs font-medium ${verbleibendeSlots === 0 ? "text-red-600" : verbleibendeSlots <= 5 ? "text-amber-600" : "text-muted-foreground"}`} data-testid="kunden-dateien-counter">
              {bestehendeAnzahl + selectedFiles.length} / {MAX_FILES_TOTAL} &middot; noch {verbleibendeSlots} moeglich
            </span>
          </div>
          {selectedFiles.length > 0 && (
            <div className="mb-2 space-y-1">{selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-green-50 rounded-sm border border-green-200 text-sm">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 text-xs">X</button>
              </div>
            ))}</div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => { if (verbleibendeSlots === 0) { toast.error(`Maximum von ${MAX_FILES_TOTAL} Dateien erreicht. Bitte zuerst Dateien loeschen.`); return; } document.getElementById('kunden-modul-file-upload').click(); }}
            disabled={verbleibendeSlots === 0}
            className="w-full mb-2 py-3 text-base"
            data-testid="btn-dateien-waehlen"
          >
            <Upload className="w-5 h-5 mr-2" /> Dateien vom Computer waehlen
          </Button>
          <div onDrop={e => { e.preventDefault(); handleFileSelect({ target: { files: e.dataTransfer.files } }); }} onDragOver={e => e.preventDefault()}
            className={`border-2 border-dashed rounded-sm p-10 text-center transition-all ${verbleibendeSlots === 0 ? "border-red-300 bg-red-50/30 cursor-not-allowed opacity-60" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 cursor-pointer"}`}
            onClick={() => { if (verbleibendeSlots === 0) { toast.error(`Maximum von ${MAX_FILES_TOTAL} Dateien erreicht. Bitte zuerst Dateien loeschen.`); return; } document.getElementById('kunden-modul-file-upload').click(); }}>
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-medium">{verbleibendeSlots === 0 ? "Maximum erreicht — keine weiteren Dateien moeglich" : "Bilder oder Dateien hier hineinziehen"}</p>
            <p className="text-xs text-muted-foreground mt-1">oder oben den Button benutzen &middot; Sie koennen Dateien auch ins ganze Fenster fallen lassen</p>
            <input id="kunden-modul-file-upload" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx" onChange={handleFileSelect} className="hidden" disabled={verbleibendeSlots === 0} />
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-4 flex-wrap">
          {kunde && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLinkDialog(true)}
              data-testid="btn-kunde-link"
              className="mr-auto"
            >
              <Mail className="w-4 h-4" /> Link für Mitarbeiter
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} data-testid="btn-abbrechen-kunde">Abbrechen</Button>
          <Button type="submit" disabled={loading} data-testid="btn-save-kunde">
            {uploadPhase === "uploading" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {`Lade ${selectedFiles.length} Datei(en) hoch… ${uploadPct}%`}
              </span>
            ) : uploadPhase === "saving" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {selectedFiles.length > 0 ? "Speichere Daten…" : "Speichere…"}
              </span>
            ) : loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Speichern…
              </span>
            ) : "Speichern"}
          </Button>
        </div>
      </form>

      <AbschlussDialog
        isOpen={!!pendingAbschluss}
        onClose={() => setPendingAbschluss(null)}
        onConfirm={async ({ grund }) => {
          const newStatus = pendingAbschluss?.newStatus || "Abgeschlossen";
          const now = new Date().toISOString();
          const datedNote = `[${new Date().toLocaleDateString("de-DE")} Abschluss] ${grund}`;
          setForm((f) => ({
            ...f,
            status: newStatus,
            abschluss_grund: grund,
            abschluss_at: now,
            notes: f.notes ? `${f.notes}\n\n${datedNote}` : datedNote,
          }));
          setPendingAbschluss(null);
        }}
        titleLabel={`Kunde abschließen → "${pendingAbschluss?.newStatus || ""}"`}
        subjectLabel={`${form.vorname || ""} ${form.nachname || ""}${form.firma ? " (" + form.firma + ")" : ""}`.trim() || "Kunde"}
      />

      <KundenLinkDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        kunde={kunde}
      />
    </Modal>
  );
};


// ==================== KONTAKT IMPORT MODAL ====================
const KontaktImportModal = ({ isOpen, onClose, onImported }) => {
  const [kontakte, setKontakte] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(null);

  useEffect(() => {
    if (isOpen) loadKontakte();
  }, [isOpen]);

  const loadKontakte = async () => {
    setLoading(true);
    try {
      const res = await api.get("/modules/kontakt/data");
      setKontakte(res.data || []);
    } catch { toast.error("Fehler beim Laden der Kontakte"); }
    finally { setLoading(false); }
  };

  const handleImport = async (kontaktId, name) => {
    setImporting(kontaktId);
    try {
      const res = await api.post(`/modules/kunden/from-kontakt/${kontaktId}`);
      if (res.data.already_exists) {
        toast.info(`${name} ist bereits als Kunde vorhanden`);
      } else {
        toast.success(`${name} als Kunde uebernommen!`);
        onImported();
      }
    } catch { toast.error("Fehler beim Importieren"); }
    finally { setImporting(null); }
  };

  const filtered = kontakte.filter(k => {
    if (!search) return true;
    const name = `${k.vorname || ""} ${k.nachname || ""}`.trim().toLowerCase();
    return name.includes(search.toLowerCase()) || (k.email || "").toLowerCase().includes(search.toLowerCase()) || (k.firma || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kontakt als Kunde importieren" size="lg">
      <div className="space-y-4" data-testid="kontakt-import-modal">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kontakte durchsuchen..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{search ? "Keine Ergebnisse" : "Keine Kontakte vorhanden"}</div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {filtered.map(k => {
              const displayName = `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.firma || k.name || "Unbekannt";
              return (
                <div key={k.id} className="flex items-center justify-between p-3 rounded-sm border hover:border-primary/40 transition-colors" data-testid={`kontakt-import-${k.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {k.vorname?.charAt(0)?.toUpperCase() || k.nachname?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[k.email, k.phone, k.firma].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleImport(k.id, displayName)} disabled={importing === k.id} data-testid={`btn-import-${k.id}`}>
                    {importing === k.id ? "..." : "Importieren"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Schliessen</Button>
        </div>
      </div>
    </Modal>
  );
};

export { KundenModulPage, KundenFormModal };

