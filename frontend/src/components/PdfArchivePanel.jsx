import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ClipboardCheck, Receipt, Search, Eye, Download, Star, Trash2, CheckSquare, Square, ArrowRight, Archive, User, Calendar, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";

const TYPE_META = {
  quote: { label: "Angebot", icon: FileText, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  order: { label: "Auftragsbestätigung", icon: ClipboardCheck, bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  invoice: { label: "Rechnung", icon: Receipt, bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
};

const MAX_VORGEMERKT = 5;

/**
 * PDF-Archiv-Panel
 * - Zeigt alle archivierten PDFs (beim Download/Senden automatisch gespeichert)
 * - Filter: Typ, Suche, Favoriten, Kunde
 * - Vormerken (max 5) + "In Dokument uebernehmen"
 *
 * Props:
 *   variant: "page" | "embedded" (page = mit grossem Titel)
 *   mode: "browse" (Archiv-Ansicht) | "picker" (Dialog zum Uebernehmen in Editor)
 *   onApply: (sources[]) => void  (nur im picker-Modus)
 *   onClose: () => void  (nur im picker-Modus)
 */
export const PdfArchivePanel = ({ variant = "page", mode = "browse", onApply, onClose }) => {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set()); // vormerken
  const [previewEntry, setPreviewEntry] = useState(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/pdf-archive");
      setList(res.data);
    } catch { toast.error("Fehler beim Laden des Archivs"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = list
    .filter(e => typeFilter === "all" || e.doc_type === typeFilter)
    .filter(e => !onlyFavs || e.favorite)
    .filter(e => !e.deleted)
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (e.customer_name || "").toLowerCase().includes(q) ||
             (e.doc_number || "").toLowerCase().includes(q) ||
             (e.betreff || "").toLowerCase().includes(q) ||
             (e.filename || "").toLowerCase().includes(q);
    });

  const toggleFavorite = async (entry) => {
    try {
      await api.put(`/pdf-archive/${entry.id}`, { favorite: !entry.favorite });
      load();
    } catch { toast.error("Fehler"); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); return s; }
      if (s.size >= MAX_VORGEMERKT) { toast.error(`Maximal ${MAX_VORGEMERKT} Dokumente vormerken`); return prev; }
      s.add(id); return s;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDelete = async (entry) => {
    if (!window.confirm(`Eintrag wirklich entfernen?\n\nWichtig: Für Buchhaltung (GoBD) bleiben PDFs 10 Jahre archiviert. Das PDF bleibt in deinem Speicher, nur die Anzeige wird ausgeblendet.`)) return;
    try { await api.delete(`/pdf-archive/${entry.id}`); toast.success("Ausgeblendet"); load(); }
    catch { toast.error("Fehler"); }
  };

  const getPdfUrl = (entry) => `${API}/pdf-archive/${entry.id}/view`;

  const handleApply = async () => {
    if (selectedIds.size === 0) { toast.error("Nichts vorgemerkt"); return; }
    setApplying(true);
    try {
      const res = await api.post("/pdf-archive/apply-to-editor", {
        entry_ids: [...selectedIds],
      });
      if (onApply) {
        onApply(res.data);
      }
      clearSelection();
      if (onClose) onClose();
    } catch { toast.error("Fehler beim Uebernehmen"); }
    finally { setApplying(false); }
  };

  const stats = {
    total: list.length,
    quote: list.filter(e => e.doc_type === "quote").length,
    order: list.filter(e => e.doc_type === "order").length,
    invoice: list.filter(e => e.doc_type === "invoice").length,
  };

  const tabs = [
    { id: "all", label: "Alle", count: stats.total },
    { id: "quote", label: "Angebote", count: stats.quote },
    { id: "order", label: "Aufträge", count: stats.order },
    { id: "invoice", label: "Rechnungen", count: stats.invoice },
  ];

  const isPicker = mode === "picker";

  return (
    <div className={variant === "page" ? "max-w-7xl mx-auto" : ""} data-testid="pdf-archive-panel">
      {variant === "page" && (
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Archive className="w-5 h-5" /> PDF-Archiv</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Alle versendeten und gedruckten Dokumente – GoBD-konform für Buchhaltung und Steuerberater.
          </p>
        </div>
      )}

      {isPicker && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm">
          <strong>Aus PDF-Archiv übernehmen:</strong> Merke bis zu {MAX_VORGEMERKT} Dokumente vor, prüfe sie, und übernimm die Positionen dann ins aktuelle Dokument.
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suche nach Kunde, Nummer, Betreff..."
            className="w-full pl-10 pr-3 py-2 border rounded-sm text-sm"
            data-testid="archive-search"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${typeFilter === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
              data-testid={`archive-filter-${t.id}`}
            >
              {t.label} {t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
          <button
            onClick={() => setOnlyFavs(!onlyFavs)}
            className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors flex items-center gap-1 ${onlyFavs ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-background hover:bg-muted border-border"}`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavs ? "fill-amber-500" : ""}`} /> Favoriten
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Archiv...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div className="font-medium mb-1">{list.length === 0 ? "Archiv ist leer" : "Keine Treffer"}</div>
          <div className="text-sm">
            {list.length === 0
              ? "Sobald du ein Angebot/Rechnung als PDF herunterlädst oder versendest, landet eine Kopie automatisch hier."
              : "Passe Suche oder Filter an."}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const meta = TYPE_META[entry.doc_type] || TYPE_META.quote;
            const Icon = meta.icon;
            const isSelected = selectedIds.has(entry.id);
            return (
              <Card key={entry.id} className={`p-3 hover:shadow-md transition-all ${isSelected ? "ring-2 ring-primary" : ""}`} data-testid={`archive-row-${entry.id}`}>
                <div className="flex items-center gap-3">
                  {isPicker && (
                    <button onClick={() => toggleSelect(entry.id)} className="p-1 hover:bg-muted rounded-sm flex-shrink-0" title={isSelected ? "Vormerken entfernen" : "Vormerken"}>
                      {isSelected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  )}
                  <div className={`p-2 rounded-sm ${meta.bg} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${meta.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{entry.doc_number}</span>
                      <Badge className={`${meta.bg} ${meta.text} text-xs border ${meta.border}`}>{meta.label}</Badge>
                      {entry.favorite && <Star className="w-4 h-4 fill-amber-500 text-amber-500" />}
                      {entry.trigger === "sent" && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Versendet</Badge>}
                      {entry.trigger === "downloaded" && <Badge className="bg-sky-100 text-sky-700 text-xs">Gedruckt/DL</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-1">
                      <span className="flex items-center gap-1 truncate max-w-[200px]"><User className="w-3 h-3" />{entry.customer_name}</span>
                      {entry.betreff && <span className="truncate max-w-[300px]">{entry.betreff}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(entry.created_at).toLocaleDateString("de-DE")}</span>
                      {entry.total_gross > 0 && <span className="font-mono">{entry.total_gross.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>}
                      <span className="text-xs">{entry.positions_count} Pos.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleFavorite(entry)} className="p-2 hover:bg-amber-50 rounded-sm text-muted-foreground hover:text-amber-500" title="Favorit">
                      <Star className={`w-4 h-4 ${entry.favorite ? "fill-amber-500 text-amber-500" : ""}`} />
                    </button>
                    <button onClick={() => setPreviewEntry(entry)} className="p-2 hover:bg-blue-50 rounded-sm text-blue-600 flex items-center gap-1" title="PDF ansehen" data-testid={`archive-view-${entry.id}`}>
                      <Eye className="w-4 h-4" />
                    </button>
                    <a href={`${getPdfUrl(entry)}?download=true`} className="p-2 hover:bg-slate-100 rounded-sm text-slate-600" title="Herunterladen" target="_blank" rel="noreferrer">
                      <Download className="w-4 h-4" />
                    </a>
                    {!isPicker && entry.doc_id && (
                      <button
                        onClick={() => {
                          const paths = { quote: `/quotes/edit/${entry.doc_id}`, order: `/orders/edit/${entry.doc_id}`, invoice: `/invoices/edit/${entry.doc_id}` };
                          navigate(paths[entry.doc_type]);
                        }}
                        className="p-2 hover:bg-primary/10 rounded-sm text-primary"
                        title="Original öffnen"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                    {!isPicker && (
                      <button onClick={() => handleDelete(entry)} className="p-2 hover:bg-red-50 rounded-sm text-red-500" title="Ausblenden">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vorgemerkt-Leiste (nur im Picker-Modus) */}
      {isPicker && (
        <div className="sticky bottom-0 mt-4 p-3 bg-background border-2 border-primary/30 rounded-sm flex flex-wrap items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Bookmark className="w-4 h-4 text-primary" />
            <span><strong>{selectedIds.size}</strong> / {MAX_VORGEMERKT} Dokumente vorgemerkt</span>
            {selectedIds.size > 0 && (
              <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground underline ml-2">
                Alle entfernen
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {onClose && (
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
            )}
            <button
              onClick={handleApply}
              disabled={applying || selectedIds.size === 0}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
              data-testid="archive-apply"
            >
              <ArrowRight className="w-4 h-4" />
              {applying ? "Übernehme..." : `${selectedIds.size} Dokument${selectedIds.size !== 1 ? "e" : ""} übernehmen`}
            </button>
          </div>
        </div>
      )}

      {/* PDF-Preview Modal */}
      {previewEntry && (
        <PdfPreviewModal entry={previewEntry} onClose={() => setPreviewEntry(null)} pdfUrl={getPdfUrl(previewEntry)} />
      )}
    </div>
  );
};


// ===== PDF-Preview Modal =====
const PdfPreviewModal = ({ entry, onClose, pdfUrl }) => {
  return (
    <div className="fixed inset-0 bg-black/75 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{entry.filename}</h3>
            <p className="text-xs text-muted-foreground truncate">{entry.customer_name} · {new Date(entry.created_at).toLocaleString("de-DE")}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`${pdfUrl}?download=true`} className="px-3 py-1.5 text-sm border rounded-sm hover:bg-muted inline-flex items-center gap-1" target="_blank" rel="noreferrer">
              <Download className="w-4 h-4" /> PDF
            </a>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-sm">✕</button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100">
          <iframe src={pdfUrl} title="PDF Vorschau" className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
};

export default PdfArchivePanel;
