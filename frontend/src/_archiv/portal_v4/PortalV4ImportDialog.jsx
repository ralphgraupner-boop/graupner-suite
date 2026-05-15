import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Search, Check, AlertCircle, Download } from "lucide-react";

/**
 * Portal v4 – Import aus module_kunden
 * Modal mit Kundenliste, Suche, Status-Filter, Bulk-Select.
 */
export function PortalV4ImportDialog({ open, onClose, onImported }) {
  const [loading, setLoading] = useState(false);
  const [kunden, setKunden] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/portal-v4/admin/kunden-quelle", { params });
      setKunden(Array.isArray(res.data) ? res.data : []);
      setSelected(new Set());
    } catch (err) {
      toast.error("Laden fehlgeschlagen: " + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, statusFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return kunden;
    return kunden.filter(k =>
      (k._display || "").toLowerCase().includes(term)
      || (k.email || "").toLowerCase().includes(term)
      || (k.phone || "").toLowerCase().includes(term)
      || (k.firma || "").toLowerCase().includes(term)
    );
  }, [kunden, search]);

  const selectableIds = useMemo(
    () => filtered.filter(k => !k._already_imported && k.email).map(k => k.id),
    [filtered]
  );

  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      selectableIds.forEach(id => next.add(id));
      return next;
    });
  };

  const doImport = async () => {
    if (selected.size === 0) {
      toast.error("Bitte mindestens einen Kunden auswählen");
      return;
    }
    setImporting(true);
    try {
      const res = await api.post("/portal-v4/admin/accounts/import-from-kunden", {
        kunden_ids: Array.from(selected),
        skip_without_email: true,
      });
      const ok = res.data.count_imported || 0;
      const skipped = res.data.count_skipped || 0;
      if (ok > 0) toast.success(`${ok} Account(s) importiert`);
      if (skipped > 0) toast.info(`${skipped} übersprungen (Dublette/ohne E-Mail)`);
      if (ok > 0) {
        onImported?.();
        onClose();
      } else {
        // nur Skip → Liste neu laden für Status-Update
        load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  const statusOptions = [
    { v: "", label: "Alle Status" },
    { v: "Neu", label: "Neu" },
    { v: "Anfrage", label: "Anfrage" },
    { v: "Interessent", label: "Interessent" },
    { v: "Kunde", label: "Kunde" },
    { v: "In Bearbeitung", label: "In Bearbeitung" },
    { v: "Abgeschlossen", label: "Abgeschlossen" },
    { v: "Archiv", label: "Archiv" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="portal-v2-import-dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Aus Kundenkartei importieren</h2>
            <p className="text-xs text-muted-foreground">
              Lesender Zugriff auf <code>module_kunden</code>. Portal-Accounts werden neu angelegt.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted" data-testid="portal-v2-import-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, E-Mail, Firma…"
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              data-testid="portal-v2-import-search"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            data-testid="portal-v2-import-status-filter"
          >
            {statusOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <button
            onClick={toggleAll}
            className="px-3 py-2 border rounded-lg text-sm hover:bg-muted"
            data-testid="portal-v2-import-select-all"
          >
            {allSelected ? "Alle abwählen" : "Alle auswählen"}
          </button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-10 text-center text-sm text-muted-foreground">Lade Kunden…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Keine Kunden gefunden.
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="divide-y">
              {filtered.map(k => {
                const disabled = k._already_imported || !k.email;
                const checked = selected.has(k.id);
                return (
                  <label
                    key={k.id}
                    className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/40"}`}
                    data-testid={`portal-v2-import-row-${k.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => !disabled && toggleOne(k.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {k._display}
                        {k.firma && <span className="text-xs text-muted-foreground ml-2">({k.firma})</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {k.email || <span className="italic">keine E-Mail</span>}
                        {k.phone && <span className="ml-2">· {k.phone}</span>}
                        {k.kontakt_status && <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{k.kontakt_status}</span>}
                      </div>
                    </div>
                    {k._already_imported && (
                      <div className="text-xs flex items-center gap-1 text-green-600">
                        <Check className="w-3 h-3" /> bereits importiert
                      </div>
                    )}
                    {!k.email && !k._already_imported && (
                      <div className="text-xs flex items-center gap-1 text-amber-600">
                        <AlertCircle className="w-3 h-3" /> keine E-Mail
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selected.size} ausgewählt
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg border text-sm hover:bg-muted"
              disabled={importing}
              data-testid="portal-v2-import-cancel"
            >
              Abbrechen
            </button>
            <button
              onClick={doImport}
              disabled={importing || selected.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
              data-testid="portal-v2-import-confirm"
            >
              <Download className="w-4 h-4" />
              {importing ? "Importiere…" : `${selected.size > 0 ? selected.size + " " : ""}importieren`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PortalV4ImportDialog;
