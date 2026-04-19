import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ClipboardCheck, Receipt, Star, Trash2, Pencil, Play, Search, Package, Clock, User, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";

// Wiederverwendbare Komponente fuer Dokument-Vorlagen (Angebot / Auftragsbestaetigung / Rechnung)
// Wird sowohl in Einstellungen als Tab als auch im Dokumente-Modul eingebunden.

const TYPE_META = {
  quote: { label: "Angebot", icon: FileText, color: "blue", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  order: { label: "Auftragsbestätigung", icon: ClipboardCheck, color: "purple", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  invoice: { label: "Rechnung", icon: Receipt, color: "green", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
};

export const DocumentTemplatesPanel = ({ variant = "page" }) => {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [editTpl, setEditTpl] = useState(null);
  const [useTpl, setUseTpl] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/document-templates");
      setList(res.data);
    } catch { toast.error("Fehler beim Laden der Vorlagen"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = list
    .filter(t => typeFilter === "all" || t.doc_type === typeFilter)
    .filter(t => !onlyFavorites || t.favorite)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.name || "").toLowerCase().includes(q) ||
             JSON.stringify(t.snapshot?.positions || []).toLowerCase().includes(q);
    });

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Vorlage "${tpl.name}" wirklich löschen?`)) return;
    try { await api.delete(`/document-templates/${tpl.id}`); toast.success("Gelöscht"); load(); }
    catch { toast.error("Fehler"); }
  };

  const toggleFavorite = async (tpl) => {
    try {
      await api.put(`/document-templates/${tpl.id}`, { favorite: !tpl.favorite });
      load();
    } catch { toast.error("Fehler"); }
  };

  const handleUse = async (tpl) => {
    // Dokument direkt aus Vorlage anlegen (ohne Kunde) – User kann im Editor Kunde zuweisen
    try {
      const res = await api.post(`/document-templates/${tpl.id}/create-document`, {});
      toast.success(`${TYPE_META[tpl.doc_type].label} aus Vorlage erstellt`);
      navigate(res.data.edit_url);
    } catch { toast.error("Fehler beim Anlegen"); }
  };

  const stats = {
    total: list.length,
    quote: list.filter(t => t.doc_type === "quote").length,
    order: list.filter(t => t.doc_type === "order").length,
    invoice: list.filter(t => t.doc_type === "invoice").length,
    favorites: list.filter(t => t.favorite).length,
  };

  const container = variant === "page" ? "max-w-7xl mx-auto" : "";

  return (
    <div className={container} data-testid="doc-templates-panel">
      {variant === "page" && (
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5" /> Dokument-Vorlagen</h2>
          <p className="text-sm text-muted-foreground mt-1">Wiederverwendbare Angebote, Auftragsbestätigungen und Rechnungen.</p>
        </div>
      )}

      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Vorlage suchen..."
            className="w-full pl-10 pr-3 py-2 border rounded-sm text-sm"
            data-testid="tpl-search"
          />
        </div>
        <div className="flex gap-1">
          {[
            { id: "all", label: "Alle", count: stats.total },
            { id: "quote", label: "Angebote", count: stats.quote },
            { id: "order", label: "Aufträge", count: stats.order },
            { id: "invoice", label: "Rechnungen", count: stats.invoice },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${typeFilter === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
              data-testid={`tpl-filter-${t.id}`}
            >
              {t.label} {t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors flex items-center gap-1 ${onlyFavorites ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-background hover:bg-muted border-border"}`}
          data-testid="tpl-favorite-toggle"
        >
          <Star className={`w-3.5 h-3.5 ${onlyFavorites ? "fill-amber-500" : ""}`} /> Nur Favoriten
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div className="font-medium mb-1">{list.length === 0 ? "Noch keine Vorlagen" : "Keine passenden Vorlagen"}</div>
          <div className="text-sm">
            {list.length === 0
              ? "Öffne ein Angebot/Rechnung im Editor und klicke auf 'Als Vorlage speichern' um eine zu erstellen."
              : "Passe Filter oder Suche an."}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(tpl => {
            const meta = TYPE_META[tpl.doc_type] || TYPE_META.quote;
            const Icon = meta.icon;
            const positions = tpl.snapshot?.positions?.length || 0;
            const total = tpl.snapshot?.total_gross || 0;
            return (
              <Card key={tpl.id} className="p-3 hover:shadow-md transition-shadow" data-testid={`tpl-row-${tpl.id}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-sm ${meta.bg} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${meta.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{tpl.name}</h3>
                      <Badge className={`${meta.bg} ${meta.text} text-xs border ${meta.border}`}>{meta.label}</Badge>
                      {tpl.favorite && <Star className="w-4 h-4 fill-amber-500 text-amber-500" />}
                      {tpl.anonymized && <Badge className="bg-slate-100 text-slate-600 text-xs">Mustermann</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-1">
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" />{positions} Position{positions !== 1 ? "en" : ""}</span>
                      {total > 0 && <span className="font-mono">{total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>}
                      {tpl.usage_count > 0 && <span>{tpl.usage_count}× genutzt</span>}
                      {tpl.last_used_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(tpl.last_used_at).toLocaleDateString("de-DE")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleFavorite(tpl)}
                      className="p-2 hover:bg-amber-50 rounded-sm text-muted-foreground hover:text-amber-500 transition-colors"
                      title={tpl.favorite ? "Favorit entfernen" : "Als Favorit markieren"}
                      data-testid={`tpl-star-${tpl.id}`}
                    >
                      <Star className={`w-4 h-4 ${tpl.favorite ? "fill-amber-500 text-amber-500" : ""}`} />
                    </button>
                    <button
                      onClick={() => setUseTpl(tpl)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-xs font-medium hover:bg-primary/90"
                      data-testid={`tpl-use-${tpl.id}`}
                    >
                      <Play className="w-3.5 h-3.5" /> Verwenden
                    </button>
                    <button
                      onClick={() => setEditTpl(tpl)}
                      className="p-2 hover:bg-blue-50 rounded-sm text-blue-600 transition-colors"
                      title="Umbenennen"
                      data-testid={`tpl-rename-${tpl.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl)}
                      className="p-2 hover:bg-red-50 rounded-sm text-red-500 transition-colors"
                      title="Löschen"
                      data-testid={`tpl-delete-${tpl.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editTpl && <RenameTemplateModal tpl={editTpl} onClose={() => setEditTpl(null)} onSaved={() => { setEditTpl(null); load(); }} />}
      {useTpl && <UseTemplateModal tpl={useTpl} onClose={() => setUseTpl(null)} onStarted={() => { setUseTpl(null); load(); }} />}
    </div>
  );
};


// ===== Rename Dialog =====
const RenameTemplateModal = ({ tpl, onClose, onSaved }) => {
  const [name, setName] = useState(tpl.name);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { toast.error("Name erforderlich"); return; }
    setSaving(true);
    try { await api.put(`/document-templates/${tpl.id}`, { name }); toast.success("Umbenannt"); onSaved(); }
    catch { toast.error("Fehler"); }
    finally { setSaving(false); }
  };
  return (
    <Modal isOpen={true} onClose={onClose} title="Vorlage umbenennen" size="sm">
      <div className="space-y-3">
        <label className="block text-sm font-medium">Bezeichnung</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-sm p-2 text-sm" autoFocus data-testid="tpl-rename-input" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50" data-testid="tpl-rename-save">
            {saving ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>
    </Modal>
  );
};


// ===== Verwenden-Dialog (Kunde auswaehlen) =====
const UseTemplateModal = ({ tpl, onClose, onStarted }) => {
  const navigate = useNavigate();
  const [kunden, setKunden] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedKunde, setSelectedKunde] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get("/modules/kunden/data")
      .then(r => setKunden(r.data))
      .catch(() => toast.error("Fehler beim Laden der Kunden"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = kunden.filter(k => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (k.vorname || "").toLowerCase().includes(q) ||
           (k.nachname || "").toLowerCase().includes(q) ||
           (k.email || "").toLowerCase().includes(q);
  }).slice(0, 30);

  const create = async (withCustomer) => {
    setCreating(true);
    try {
      const body = withCustomer && selectedKunde ? { customer_id: selectedKunde.id } : {};
      const res = await api.post(`/document-templates/${tpl.id}/create-document`, body);
      toast.success(`${TYPE_META[tpl.doc_type].label} aus Vorlage erstellt`);
      onStarted();
      navigate(res.data.edit_url);
    } catch { toast.error("Fehler beim Anlegen"); setCreating(false); }
  };

  const meta = TYPE_META[tpl.doc_type] || TYPE_META.quote;

  return (
    <Modal isOpen={true} onClose={onClose} title={`Vorlage "${tpl.name}" verwenden`} size="md">
      <div className="space-y-4">
        <div className={`p-3 ${meta.bg} rounded-sm text-sm`}>
          Es wird ein neues <strong>{meta.label}</strong> mit allen Positionen und Texten aus dieser Vorlage erstellt.
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Für welchen Kunden?</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kunde suchen..."
              className="w-full pl-10 pr-3 py-2 border rounded-sm text-sm"
              data-testid="tpl-use-search"
            />
          </div>
          <div className="border rounded-sm max-h-64 overflow-y-auto">
            {loading ? <div className="p-3 text-sm text-muted-foreground">Lade...</div>
              : filtered.length === 0 ? <div className="p-3 text-sm text-muted-foreground">Keine Kunden gefunden.</div>
              : filtered.map(k => (
                <button
                  key={k.id}
                  onClick={() => setSelectedKunde(k)}
                  className={`w-full text-left p-2 border-b last:border-0 text-sm flex items-center gap-2 hover:bg-muted/50 ${selectedKunde?.id === k.id ? "bg-primary/5" : ""}`}
                  data-testid={`tpl-use-kunde-${k.id}`}
                >
                  {selectedKunde?.id === k.id ? <Check className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
                  <span className="flex-1 truncate">{k.vorname} {k.nachname}</span>
                  <span className="text-xs text-muted-foreground truncate">{k.email}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={() => create(false)}
            disabled={creating}
            className="px-4 py-2 text-sm border rounded-sm hover:bg-muted disabled:opacity-50 flex items-center gap-1 justify-center"
            data-testid="tpl-use-without-customer"
          >
            <X className="w-4 h-4" /> Ohne Kunde (Mustermann)
          </button>
          <button
            onClick={() => create(true)}
            disabled={creating || !selectedKunde}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 justify-center"
            data-testid="tpl-use-with-customer"
          >
            <Check className="w-4 h-4" /> {creating ? "Erstelle..." : "Mit Kunde verwenden"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DocumentTemplatesPanel;
