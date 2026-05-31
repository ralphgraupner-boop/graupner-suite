import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, Download, Upload, Package, FileText, ClipboardCheck, Receipt, Copy, Sparkles, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { RichTextEditor } from "@/components/RichTextEditor";

const DOC_TYPE_LABELS = { angebot: "Angebot", auftrag: "Auftrag", rechnung: "Rechnung", kundenportal: "Kundenportal", einsatz: "Einsatz", termin: "Termin", aufgabe: "Aufgabe", aufgaben_kategorie: "Aufgaben-Kategorie", reparaturgruppe: "Reparaturgruppe", material: "Material", prioritaet: "Priorität", bild_kategorie: "Bild-Kategorie", abschlussgrund: "Abschlussgrund", kunden_status: "Kunden-Status", kunden_kategorie: "Kunden-Kategorie", kunden_typ: "Kunden-Typ", anrede: "Anrede", allgemein: "Allgemein", projekt_status: "Projekt-Status", projekt_kategorie: "Projekt-Kategorie", projekt_bild_kategorie: "Projekt-Bild-Kategorie", projekt_titel: "Projekt-Titel", hilfe_kunden: "Hilfe: Kunden", hilfe_projekte: "Hilfe: Projekte", hilfe_aufgaben: "Hilfe: Aufgaben", hilfe_termine: "Hilfe: Termine", hilfe_einsaetze: "Hilfe: Einsätze" };
const TEXT_TYPE_LABELS = { vortext: "Vortext", schlusstext: "Schlusstext", betreff: "Betreff", bemerkung: "Bemerkung", titel: "Titel", email: "E-Mail", mahnung: "Mahnung", portal_nachricht: "Portal-Nachricht", hilfe: "Hilfe" };
const TEXT_TYPE_COLORS = { vortext: "bg-blue-100 text-blue-800", schlusstext: "bg-green-100 text-green-800", betreff: "bg-purple-100 text-purple-800", bemerkung: "bg-gray-100 text-gray-800", titel: "bg-amber-100 text-amber-800", email: "bg-cyan-100 text-cyan-800", mahnung: "bg-red-100 text-red-800", portal_nachricht: "bg-emerald-100 text-emerald-800" };

const TextvorlagenModulPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTextType, setFilterTextType] = useState("");
  const [filterDocType, setFilterDocType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [placeholders, setPlaceholders] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    loadItems();
    api.get("/modules/textvorlagen/placeholders").then(res => setPlaceholders(res.data)).catch(() => {});
  }, []);

  const loadItems = async () => {
    try {
      const res = await api.get("/modules/textvorlagen/data");
      setItems(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/modules/textvorlagen/data/${id}`);
      toast.success("Geloescht");
      setConfirmDeleteId(null);
      loadItems();
    } catch { toast.error("Fehler"); }
  };

  const handleExport = async () => {
    try {
      // Aktuell aktive Filter mitgeben (nur gefilterte exportieren)
      const params = new URLSearchParams();
      if (filterDocType) params.set("doc_type", filterDocType);
      if (filterTextType) params.set("text_type", filterTextType);
      const qs = params.toString();
      const res = await api.get(`/modules/textvorlagen/export${qs ? `?${qs}` : ""}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filterLabel = filterDocType || filterTextType ? `_${filterDocType || filterTextType}` : "";
      a.href = url;
      a.download = `textvorlagen${filterLabel}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${res.data.count} Vorlagen exportiert`);
    } catch { toast.error("Fehler beim Export"); }
  };

  const handleDuplicate = async (item) => {
    try {
      const copy = {
        title: `${item.title} (Kopie)`,
        content: item.content || "",
        doc_type: item.doc_type,
        text_type: item.text_type,
      };
      await api.post("/modules/textvorlagen/data", copy);
      toast.success("Vorlage dupliziert");
      loadItems();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Duplizieren fehlgeschlagen");
    }
  };

  // ─── Robustes Kopieren mit Fallback ───
  // navigator.clipboard.writeText schlaegt im iframe oder ohne HTTPS lautlos
  // fehl. Daher: erst die moderne API versuchen, sonst auf textarea +
  // document.execCommand ausweichen. HTML-Inhalt wird in plain Text
  // konvertiert (Rich-Text-Editor speichert HTML).
  const htmlToText = (html) => {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    // Zeilenumbrueche bei Block-Elementen erhalten
    tmp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    tmp.querySelectorAll("p, div, li").forEach((el) => el.append("\n"));
    return (tmp.innerText || tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  };

  const copyToClipboard = async (text, successMsg = "Kopiert") => {
    const value = String(text ?? "");
    if (!value) {
      toast.error("Nichts zum Kopieren");
      return false;
    }
    // 1) moderne Async-API
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        toast.success(successMsg);
        return true;
      }
    } catch { /* faellt unten in den Fallback */ }
    // 2) Fallback per textarea
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        toast.success(successMsg);
        return true;
      }
    } catch { /* nichts */ }
    toast.error("Kopieren wurde vom Browser blockiert. Bitte Text manuell markieren und mit Strg+C kopieren.");
    return false;
  };
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);  // {items, summary}
  const [importSelected, setImportSelected] = useState(new Set());
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const handleImportFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const items = Array.isArray(json) ? json : (json.data || json.items || []);
      if (!Array.isArray(items) || items.length === 0) {
        toast.error("Datei enthält keine Vorlagen");
        return;
      }
      const r = await api.post("/modules/textvorlagen/import-preview", { items });
      const preview = r.data;
      setImportPreview(preview);
      // Default-Auswahl: alle "neu" angehakt, "konflikt" und "invalid" abgehakt
      const sel = new Set();
      preview.items.forEach((it) => { if (it.status === "neu") sel.add(it.key); });
      setImportSelected(sel);
    } catch (err) {
      toast.error("Import-Datei ungültig: " + (err?.message || "Unbekannter Fehler"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleImportItem = (key) => {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const setImportSelectionForStatus = (status, on) => {
    setImportSelected((prev) => {
      const next = new Set(prev);
      importPreview?.items?.forEach((it) => {
        if (it.status !== status) return;
        if (on) next.add(it.key); else next.delete(it.key);
      });
      return next;
    });
  };

  const performImport = async () => {
    if (!importPreview) return;
    if (importSelected.size === 0) {
      toast.error("Keine Vorlage zum Import ausgewählt");
      return;
    }
    setImportLoading(true);
    try {
      const r = await api.post("/modules/textvorlagen/import", {
        items: importPreview.items,
        selected_keys: Array.from(importSelected),
        overwrite: importOverwrite,
      });
      toast.success(
        `Import: ${r.data.inserted} neu, ${r.data.updated} überschrieben, ${r.data.skipped} übersprungen`
      );
      setImportPreview(null);
      setImportSelected(new Set());
      setImportOverwrite(false);
      loadItems();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Import");
    } finally {
      setImportLoading(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  const handleSeedPortal = async () => {
    if (!window.confirm("Die 3 Standard-Vorlagen fuer das Kundenportal anlegen?\n\n- Begruessung + Bilder-Anfrage\n- Weitere Bilder benoetigt\n- Rueckfrage / Eigene Frage\n\nVorhandene Vorlagen mit gleichem Titel werden NICHT ueberschrieben.")) return;
    setSeeding(true);
    try {
      const res = await api.post("/modules/textvorlagen/seed-kundenportal");
      const { inserted, skipped } = res.data || {};
      toast.success(`${inserted} neu angelegt, ${skipped} bereits vorhanden`);
      loadItems();
    } catch {
      toast.error("Fehler beim Anlegen");
    } finally {
      setSeeding(false);
    }
  };

  const filtered = items.filter(i => {
    const matchSearch = !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.content.toLowerCase().includes(search.toLowerCase());
    const matchText = !filterTextType || i.text_type === filterTextType;
    const matchDoc = !filterDocType || i.doc_type === filterDocType;
    return matchSearch && matchText && matchDoc;
  });

  const textTypeCounts = {};
  items.forEach(i => { textTypeCounts[i.text_type] = (textTypeCounts[i.text_type] || 0) + 1; });

  return (
    <div data-testid="textvorlagen-modul-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Textvorlagen</h1>
            <Badge variant="default" className="text-xs">Solo</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{items.length} Vorlagen gesamt</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleSeedPortal} disabled={seeding} data-testid="btn-seed-portal-vorlagen" title="Legt die 3 Standard-Vorlagen fuer das Kundenportal an">
            <Sparkles className="w-4 h-4" /> {seeding ? "Lege an..." : "Portal-Vorlagen importieren"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="btn-export-vorlagen" title={filterDocType || filterTextType ? "Aktuell gefilterte Auswahl exportieren" : "Alle Vorlagen exportieren"}>
            <Download className="w-4 h-4" /> Export{(filterDocType || filterTextType) ? " (gefiltert)" : ""}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => handleImportFile(e.target.files?.[0])}
            data-testid="input-import-vorlagen"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="btn-import-vorlagen" title="JSON-Datei einlesen, Vorschau anzeigen">
            <Upload className="w-4 h-4" /> Import
          </Button>
          <Button size="sm" className="lg:h-10 lg:px-4" onClick={() => { setEditItem(null); setShowModal(true); }} data-testid="btn-new-vorlage">
            <Plus className="w-4 h-4" /> Neue Vorlage
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => setFilterTextType("")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!filterTextType ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          Alle ({items.length})
        </button>
        {Object.entries(TEXT_TYPE_LABELS).map(([key, label]) => textTypeCounts[key] ? (
          <button key={key} onClick={() => setFilterTextType(filterTextType === key ? "" : key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${filterTextType === key ? TEXT_TYPE_COLORS[key] + " shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {label} ({textTypeCounts[key]})
          </button>
        ) : null)}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setFilterDocType(filterDocType === key ? "" : key)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${filterDocType === key ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      <Card className="p-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {/* Platzhalter-Info */}
      {placeholders.length > 0 && (
        <Card className="p-3 mb-4 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Verfuegbare Platzhalter (klicken zum Kopieren):</p>
          <div className="flex flex-wrap gap-1">
            {placeholders.map(p => (
              <button key={p.alias} onClick={() => copyToClipboard(p.alias, `${p.alias} kopiert`)}
                className="px-2 py-0.5 bg-background border rounded text-xs font-mono hover:bg-primary/5 hover:border-primary/30 transition-all" title={p.beschreibung}>
                {p.alias}
              </button>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{search || filterTextType ? "Keine Ergebnisse" : "Erstellen Sie Ihre erste Textvorlage"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <Card key={item.id} className="overflow-hidden" data-testid={`vorlage-${item.id}`}>
              <div className="flex items-start gap-3 p-3 lg:p-4">
                <div className="flex-1 min-w-0 group/content" style={{ maxWidth: "680px" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{item.title}</span>
                    <Badge className={`text-xs ${TEXT_TYPE_COLORS[item.text_type] || ""}`}>{TEXT_TYPE_LABELS[item.text_type] || item.text_type}</Badge>
                    <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[item.doc_type] || item.doc_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 group-hover/content:line-clamp-none whitespace-pre-line transition-all">{item.content}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleDuplicate(item)} className="p-2 hover:bg-muted rounded-sm" title="Duplizieren (Kopie anlegen)" data-testid={`btn-duplicate-${item.id}`}>
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditItem(item); setShowModal(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item.id)}
                    className={`p-2 rounded-sm transition-colors ${confirmDeleteId === item.id ? "bg-red-500 text-white" : "hover:bg-destructive/10"}`}>
                    {confirmDeleteId === item.id ? <span className="text-xs font-bold">?</span> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VorlageFormModal isOpen={showModal} onClose={() => setShowModal(false)} item={editItem} onSave={() => { setShowModal(false); loadItems(); }} />

      {importPreview && (
        <ImportPreviewModal
          preview={importPreview}
          selected={importSelected}
          onToggle={toggleImportItem}
          onSelectStatus={setImportSelectionForStatus}
          overwrite={importOverwrite}
          onOverwriteChange={setImportOverwrite}
          onCancel={() => { setImportPreview(null); setImportSelected(new Set()); }}
          onConfirm={performImport}
          loading={importLoading}
        />
      )}
    </div>
  );
};

// ─── Import-Vorschau-Dialog ───
const ImportPreviewModal = ({ preview, selected, onToggle, onSelectStatus, overwrite, onOverwriteChange, onCancel, onConfirm, loading }) => {
  const grouped = { neu: [], konflikt: [], invalid: [] };
  preview.items.forEach((it) => grouped[it.status].push(it));
  const selCount = selected.size;
  const STATUS_BADGE = {
    neu: "bg-emerald-100 text-emerald-800",
    konflikt: "bg-amber-100 text-amber-800",
    invalid: "bg-red-100 text-red-800",
  };

  const renderRow = (it) => {
    const isOn = selected.has(it.key);
    const isInvalid = it.status === "invalid";
    return (
      <div
        key={it.key}
        className={`flex items-start gap-3 p-2 rounded-sm border ${isOn ? "bg-primary/5 border-primary/30" : "bg-background"}`}
        data-testid={`import-row-${it.key}`}
      >
        <input
          type="checkbox"
          className="mt-1"
          checked={isOn}
          disabled={isInvalid}
          onChange={() => onToggle(it.key)}
          data-testid={`import-check-${it.key}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[it.status]}`}>
              {it.status === "neu" ? "neu" : it.status === "konflikt" ? "Konflikt" : "ungültig"}
            </span>
            <span className="font-medium truncate">{it.title}</span>
            <span className="text-xs text-muted-foreground">
              {DOC_TYPE_LABELS[it.doc_type] || it.doc_type} · {TEXT_TYPE_LABELS[it.text_type] || it.text_type}
            </span>
          </div>
          {it.status === "konflikt" && (
            <div className="text-xs text-amber-800 mt-1">
              Eintrag mit gleichem Titel und Typ existiert bereits.
              {overwrite ? " → wird ÜBERSCHRIEBEN" : " → wird übersprungen falls Haken aus"}
            </div>
          )}
          {it.status === "invalid" && (
            <div className="text-xs text-red-700 mt-1">{it.reason}</div>
          )}
          {it.content && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1 whitespace-pre-line">{it.content}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4" data-testid="import-preview-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import-Vorschau ({preview.items.length} Einträge)
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-muted rounded-sm" data-testid="btn-import-cancel">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-auto">
          {/* Summary */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="px-2 py-1 rounded-sm bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {preview.summary.neu} neu
            </span>
            <span className="px-2 py-1 rounded-sm bg-amber-100 text-amber-800 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {preview.summary.konflikt} Konflikt
            </span>
            {preview.summary.invalid > 0 && (
              <span className="px-2 py-1 rounded-sm bg-red-100 text-red-800">
                {preview.summary.invalid} ungültig
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {selCount} ausgewählt
            </span>
          </div>

          {/* Konflikt-Strategie */}
          {preview.summary.konflikt > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-sm p-3">
              <div className="text-sm font-medium mb-2">Bei Konflikten (gleicher Titel + Typ):</div>
              <div className="flex items-center gap-3 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!overwrite}
                    onChange={() => onOverwriteChange(false)}
                    data-testid="radio-skip"
                  />
                  Überspringen (empfohlen)
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={overwrite}
                    onChange={() => onOverwriteChange(true)}
                    data-testid="radio-overwrite"
                  />
                  Überschreiben
                </label>
              </div>
            </div>
          )}

          {/* Listen */}
          {grouped.neu.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-semibold">Neu ({grouped.neu.length})</h3>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => onSelectStatus("neu", true)} className="px-2 py-0.5 hover:bg-muted rounded-sm" data-testid="btn-select-all-neu">Alle</button>
                  <button onClick={() => onSelectStatus("neu", false)} className="px-2 py-0.5 hover:bg-muted rounded-sm">Keine</button>
                </div>
              </div>
              <div className="space-y-1.5">{grouped.neu.map(renderRow)}</div>
            </div>
          )}
          {grouped.konflikt.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-semibold">Konflikte ({grouped.konflikt.length})</h3>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => onSelectStatus("konflikt", true)} className="px-2 py-0.5 hover:bg-muted rounded-sm">Alle</button>
                  <button onClick={() => onSelectStatus("konflikt", false)} className="px-2 py-0.5 hover:bg-muted rounded-sm">Keine</button>
                </div>
              </div>
              <div className="space-y-1.5">{grouped.konflikt.map(renderRow)}</div>
            </div>
          )}
          {grouped.invalid.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1.5">Ungültig ({grouped.invalid.length})</h3>
              <div className="space-y-1.5">{grouped.invalid.map(renderRow)}</div>
            </div>
          )}
        </div>

        <div className="p-3 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Abbrechen</Button>
          <Button onClick={onConfirm} disabled={loading || selCount === 0} data-testid="btn-import-confirm">
            {loading ? "Importiere..." : `${selCount} Vorlage${selCount === 1 ? "" : "n"} importieren`}
          </Button>
        </div>
      </div>
    </div>
  );
};

const VorlageFormModal = ({ isOpen, onClose, item, onSave }) => {
  const [form, setForm] = useState({ title: "", content: "", doc_type: "allgemein", text_type: "vortext", keywords: [] });
  const [loading, setLoading] = useState(false);
  const [kwInput, setKwInput] = useState("");

  useEffect(() => {
    if (item) setForm({
      title: item.title || "",
      content: item.content || "",
      doc_type: item.doc_type || "allgemein",
      text_type: item.text_type || "vortext",
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
    });
    else setForm({ title: "", content: "", doc_type: "allgemein", text_type: "vortext", keywords: [] });
    setKwInput("");
  }, [item]);

  const isSelectionType = [
    "kunden_status", "kunden_kategorie", "kunden_typ", "anrede", "aufgaben_kategorie",
    "abschlussgrund", "reparaturgruppe", "material", "prioritaet",
    "bild_kategorie", "projekt_status", "projekt_kategorie", "projekt_bild_kategorie",
    "projekt_titel",
  ].includes(form.doc_type);

  const addKeyword = () => {
    const v = kwInput.trim();
    if (!v) return;
    if (form.keywords.includes(v)) { setKwInput(""); return; }
    setForm({ ...form, keywords: [...form.keywords, v] });
    setKwInput("");
  };
  const removeKeyword = (kw) => {
    setForm({ ...form, keywords: form.keywords.filter(k => k !== kw) });
  };
  const onKwKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    } else if (e.key === "Backspace" && !kwInput && form.keywords.length) {
      // Mobile-freundlich: Backspace im leeren Input entfernt das letzte Tag
      setForm({ ...form, keywords: form.keywords.slice(0, -1) });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title) { toast.error("Titel erforderlich"); return; }
    if (!isSelectionType && !form.content) { toast.error("Inhalt erforderlich"); return; }
    setLoading(true);
    try {
      if (item) await api.put(`/modules/textvorlagen/data/${item.id}`, form);
      else await api.post("/modules/textvorlagen/data", form);
      toast.success(item ? "Aktualisiert" : "Erstellt");
      onSave();
    } catch { toast.error("Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? "Vorlage bearbeiten" : "Neue Vorlage"} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="vorlage-form">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Textart</label>
            <select value={form.text_type} onChange={(e) => setForm({ ...form, text_type: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
              {Object.entries(TEXT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Dokumenttyp</label>
            <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Titel *</label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="input-vorlage-title" />
        </div>
        {!isSelectionType && (
          <div>
            <label className="block text-sm font-medium mb-2">Inhalt *</label>
            <RichTextEditor value={form.content} onChange={(val) => setForm({ ...form, content: val })} placeholder="Text eingeben... Formatierung mit der Toolbar" />
            <p className="text-xs text-muted-foreground mt-1">Platzhalter wie {"{kunde_name}"}, {"{datum}"} werden automatisch ersetzt</p>
          </div>
        )}
        {isSelectionType && (
          <div>
            <label className="block text-sm font-medium mb-2">Default-Titel-Vorschlag (optional)</label>
            <Input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="z.B. Schiebetür-Reparatur (wird beim Anlegen als Projekttitel vorgeschlagen)" />
          </div>
        )}
        {/* ── Stichwörter (für Auto-Klassifikation) ── */}
        <div>
          <label className="block text-sm font-medium mb-2" data-testid="label-keywords">
            Stichwörter <span className="text-xs font-normal text-muted-foreground">(Auto-Vorschlag bei Anlage; mit Enter oder Komma trennen)</span>
          </label>
          <div className="flex flex-wrap gap-1.5 p-2 border rounded-sm bg-muted/20 min-h-[44px]">
            {form.keywords.map(kw => (
              <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs" data-testid={`keyword-tag-${kw}`}>
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-red-600" aria-label={`Stichwort ${kw} entfernen`}>×</button>
              </span>
            ))}
            <input
              type="text"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={onKwKeyDown}
              onBlur={addKeyword}
              placeholder={form.keywords.length ? "" : "z.B. schiebetür, fliegengitter"}
              className="flex-1 min-w-[140px] bg-transparent border-0 outline-none text-sm py-1"
              data-testid="input-keyword"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Beim Anlegen z. B. eines Projekts wird der Anfrage-Text gegen diese Stichwörter gematcht — die Vorlage mit den meisten Treffern wird als Vorschlag gezeigt.
          </p>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" disabled={loading}>{loading ? "Speichern..." : "Speichern"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export { TextvorlagenModulPage };
