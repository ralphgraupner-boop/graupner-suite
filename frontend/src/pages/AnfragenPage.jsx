import { useState, useEffect } from "react";
import { Search, Inbox, UserCheck, Trash2, ChevronDown, Globe, Mail, Phone, Pencil, MessageSquarePlus, Send, Upload, Wrench, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge, Button, Modal, Textarea } from "@/components/common";
import { PortalButtons } from "@/components/PortalButtons";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";

const AnfragenPage = () => {
  const [anfragen, setAnfragen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedAnfrage, setSelectedAnfrage] = useState(null);
  const [editAnfrage, setEditAnfrage] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [quickNoteId, setQuickNoteId] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [quickNoteSaving, setQuickNoteSaving] = useState(false);
  const [vcfUploading, setVcfUploading] = useState(false);
  const [reparaturgruppen, setReparaturgruppen] = useState([]);
  const [emailAnfrage, setEmailAnfrage] = useState(null);

  useEffect(() => {
    loadAnfragen();
    loadConfig();
  }, [activeCategory]);

  const loadConfig = async () => {
    try {
      const res = await api.get("/einsatz-config");
      setReparaturgruppen(res.data.reparaturgruppen || []);
    } catch {}
  };

  const loadAnfragen = async () => {
    try {
      const params = activeCategory ? { category: activeCategory } : {};
      const res = await api.get("/anfragen", { params });
      setAnfragen(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Anfragen");
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (id) => {
    try {
      await api.post(`/anfragen/${id}/convert`);
      toast.success("Anfrage wurde in Kunde umgewandelt");
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Umwandeln");
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      await api.delete(`/anfragen/${id}`);
      toast.success("Anfrage gelöscht");
      setConfirmDeleteId(null);
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const openEdit = (anfrage) => {
    setEditAnfrage(anfrage);
    setEditForm({
      name: anfrage.name || "",
      email: anfrage.email || "",
      phone: anfrage.phone || "",
      address: anfrage.address || "",
      obj_address: anfrage.obj_address || "",
      firma: anfrage.firma || "",
      customer_type: anfrage.customer_type || "Privat",
      nachricht: anfrage.nachricht || "",
      notes: anfrage.notes || "",
      categories: anfrage.categories || [],
      reparaturgruppen: anfrage.reparaturgruppen || (anfrage.reparaturgruppe ? [anfrage.reparaturgruppe] : []),
    });
  };

  const handleSaveEdit = async () => {
    if (!editAnfrage) return;
    setSaving(true);
    try {
      await api.put(`/anfragen/${editAnfrage.id}`, editForm);
      toast.success("Anfrage aktualisiert");
      setEditAnfrage(null);
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (cat) => {
    setEditForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const openQuickNote = (anfrage) => {
    setQuickNoteId(anfrage.id);
    setQuickNoteText("");
  };

  const saveQuickNote = async (anfrage) => {
    if (!quickNoteText.trim()) { setQuickNoteId(null); return; }
    setQuickNoteSaving(true);
    try {
      const timestamp = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const existing = anfrage.notes || "";
      const newNotes = existing
        ? `${existing}\n[${timestamp}] ${quickNoteText.trim()}`
        : `[${timestamp}] ${quickNoteText.trim()}`;
      await api.put(`/anfragen/${anfrage.id}`, { notes: newNotes });
      toast.success("Notiz gespeichert");
      setQuickNoteId(null);
      setQuickNoteText("");
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim Speichern der Notiz");
    } finally {
      setQuickNoteSaving(false);
    }
  };

  const handleVcfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVcfUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/anfragen/import-vcf", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`VCF importiert: ${file.name}`);
      loadAnfragen();
    } catch (err) {
      toast.error("Fehler beim VCF-Import");
    } finally {
      setVcfUploading(false);
      e.target.value = "";
    }
  };

  const parseNotes = (notes) => {
    if (!notes) return {};
    const result = {};
    for (const line of notes.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const val = line.substring(colonIdx + 1).trim();
        if (val) result[key] = val;
      }
    }
    return result;
  };

  const filtered = anfragen.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.nachricht || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="anfragen-page">
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Anfragen</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{anfragen.length} Anfragen gesamt</p>
        </div>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium cursor-pointer transition-colors ${vcfUploading ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`} data-testid="btn-vcf-import">
          <Upload className="w-4 h-4" />
          {vcfUploading ? "Importiere..." : "VCF importieren"}
          <input type="file" accept=".vcf" onChange={handleVcfUpload} className="hidden" disabled={vcfUploading} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mb-4" data-testid="anfragen-category-filter">
        <button
          onClick={() => { setActiveCategory(""); setLoading(true); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            !activeCategory
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          data-testid="filter-all"
        >
          Alle ({anfragen.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setLoading(true); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
          <Input
            data-testid="input-search-anfragen"
            className="pl-9 lg:pl-10 h-9 lg:h-10"
            placeholder="Anfragen durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 lg:p-12 text-center">
          <Inbox className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-semibold">Keine Anfragen vorhanden</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            {search || activeCategory ? "Keine Ergebnisse für diesen Filter" : "Neue Anfragen erscheinen hier automatisch"}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((anfrage) => {
            const isExpanded = expandedId === anfrage.id;
            const parsed = parseNotes(anfrage.notes);
            return (
              <Card
                key={anfrage.id}
                className={`transition-all duration-200 cursor-pointer overflow-hidden ${isExpanded ? 'shadow-lg border-primary/40 ring-1 ring-primary/20' : 'hover:shadow-md hover:border-primary/20'}`}
                data-testid={`anfrage-card-${anfrage.id}`}
              >
                {/* Kompakte Listenzeile */}
                <div
                  className="flex items-center gap-4 p-3 lg:p-4"
                  onClick={() => setSelectedAnfrage(anfrage)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    {anfrage.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{anfrage.name}</span>
                      {anfrage.firma && <Badge variant="info" className="text-xs">{anfrage.firma}</Badge>}
                      {anfrage.source && anfrage.source !== "manual" && (
                        <Badge variant="default" className="text-xs">{anfrage.source}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {anfrage.phone && <span><Phone className="w-3 h-3 inline mr-1" />{anfrage.phone}</span>}
                      {anfrage.email && <span className="truncate hidden sm:inline"><Mail className="w-3 h-3 inline mr-1" />{anfrage.email}</span>}
                      <span className="text-xs">
                        {new Date(anfrage.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  {(anfrage.categories || []).length > 0 && (
                    <div className="hidden lg:flex flex-wrap gap-1">
                      {anfrage.categories.map((cat) => (
                        <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>
                      ))}
                    </div>
                  )}
                  {(anfrage.reparaturgruppen || (anfrage.reparaturgruppe ? [anfrage.reparaturgruppe] : [])).length > 0 && (
                    <div className="hidden lg:flex flex-wrap gap-1">
                      {(anfrage.reparaturgruppen || [anfrage.reparaturgruppe].filter(Boolean)).map((g) => (
                        <span key={g} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                          <Wrench className="w-3 h-3" />{g}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEmailAnfrage(anfrage)}
                      data-testid={`btn-mail-${anfrage.id}`}
                      className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-sm transition-colors"
                      title="E-Mail senden"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openQuickNote(anfrage)}
                      data-testid={`btn-quicknote-${anfrage.id}`}
                      className={`p-2 rounded-sm transition-colors ${quickNoteId === anfrage.id ? 'bg-amber-200 text-amber-800' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'}`}
                      title="Schnellnotiz"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(anfrage)}
                      data-testid={`btn-edit-anfrage-${anfrage.id}`}
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-sm transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleConvert(anfrage.id)}
                      data-testid={`btn-convert-${anfrage.id}`}
                      className="p-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-sm transition-colors"
                      title="Als Kunde übernehmen"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(anfrage.id)}
                      data-testid={`btn-delete-anfrage-${anfrage.id}`}
                      className={`p-2 rounded-sm transition-colors ${confirmDeleteId === anfrage.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                      title={confirmDeleteId === anfrage.id ? "Nochmal klicken" : "Löschen"}
                    >
                      {confirmDeleteId === anfrage.id ? <span className="text-xs font-bold">Löschen?</span> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>

                {/* Schnellnotiz Inline */}
                {quickNoteId === anfrage.id && (
                  <div className="border-t bg-amber-50/60 px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-1 duration-150" data-testid={`quicknote-bar-${anfrage.id}`} onClick={(e) => e.stopPropagation()}>
                    <MessageSquarePlus className="w-4 h-4 text-amber-600 shrink-0" />
                    <input
                      autoFocus
                      data-testid={`quicknote-input-${anfrage.id}`}
                      className="flex-1 bg-white border border-amber-200 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Schnellnotiz eingeben..."
                      value={quickNoteText}
                      onChange={(e) => setQuickNoteText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveQuickNote(anfrage); if (e.key === "Escape") setQuickNoteId(null); }}
                      disabled={quickNoteSaving}
                    />
                    <button
                      onClick={() => saveQuickNote(anfrage)}
                      disabled={quickNoteSaving || !quickNoteText.trim()}
                      data-testid={`quicknote-save-${anfrage.id}`}
                      className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-sm transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setQuickNoteId(null)}
                      data-testid={`quicknote-cancel-${anfrage.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                    >
                      Esc
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail-Modal */}
      {selectedAnfrage && (() => {
        const anfrage = selectedAnfrage;
        const parsed = parseNotes(anfrage.notes);
        const quickNotes = (anfrage.notes || "").split("\n").filter(l => l.match(/^\[[\d.,: ]+\]/));
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" data-testid="anfrage-detail-modal">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedAnfrage(null)} />
            <div className="relative bg-background rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[calc(100vh-6rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-background border-b px-5 py-3 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold shrink-0">
                    {anfrage.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">{anfrage.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {anfrage.source !== "manual" && anfrage.source ? `Quelle: ${anfrage.source} · ` : ""}
                      {new Date(anfrage.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedAnfrage(null)} className="p-1.5 hover:bg-muted rounded-sm transition-colors" data-testid="btn-close-detail">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Kontaktdaten */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kontaktdaten</h4>
                    <div className="bg-muted/30 rounded-md p-3 space-y-1.5">
                      {anfrage.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <a href={`mailto:${anfrage.email}`} className="text-primary hover:underline truncate">{anfrage.email}</a>
                        </div>
                      )}
                      {anfrage.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <a href={`tel:${anfrage.phone}`} className="text-primary hover:underline">{anfrage.phone}</a>
                        </div>
                      )}
                      {anfrage.address && (
                        <div className="flex items-start gap-2 text-sm">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="whitespace-pre-line">{anfrage.address}</p>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(anfrage.address)}`); toast.success("Maps-Link kopiert!"); }}
                              className="text-xs text-primary hover:underline mt-0.5">Karten-Link kopieren</button>
                          </div>
                        </div>
                      )}
                      {anfrage.firma && <p className="text-sm"><span className="font-medium">Firma:</span> {anfrage.firma}</p>}
                      {anfrage.customer_type && <p className="text-sm"><span className="font-medium">Typ:</span> {anfrage.customer_type}</p>}
                    </div>
                  </div>

                  {/* Kategorien */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategorien & Details</h4>
                    {(anfrage.reparaturgruppen || (anfrage.reparaturgruppe ? [anfrage.reparaturgruppe] : [])).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(anfrage.reparaturgruppen || [anfrage.reparaturgruppe].filter(Boolean)).map((g) => (
                          <span key={g} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                            <Wrench className="w-3 h-3" />{g}
                          </span>
                        ))}
                      </div>
                    )}
                    {(anfrage.categories || []).length > 0 ? (
                      <div className="space-y-2">
                        {anfrage.categories.map((cat) => {
                          const descKey = Object.keys(parsed).find(k => k === cat);
                          return (
                            <div key={cat} className="bg-muted/30 rounded-md p-3">
                              <span className="text-sm font-medium text-primary">{cat}</span>
                              {descKey && parsed[descKey] && <p className="text-sm text-muted-foreground mt-0.5">{parsed[descKey]}</p>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Keine Kategorien</p>
                    )}
                    {anfrage.obj_address && (
                      <div className="bg-muted/30 rounded-md p-3">
                        <span className="text-xs font-medium text-muted-foreground">Objektadresse</span>
                        <p className="text-sm mt-0.5">{anfrage.obj_address}</p>
                        <button onClick={() => { navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(anfrage.obj_address)}`); toast.success("Maps-Link kopiert!"); }}
                          className="text-xs text-primary hover:underline mt-0.5">Karten-Link kopieren</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nachricht */}
                {anfrage.nachricht && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nachricht</h4>
                    <div className="bg-muted/30 rounded-md p-3">
                      <p className="text-sm whitespace-pre-line">{anfrage.nachricht}</p>
                    </div>
                  </div>
                )}

                {/* Weitere Infos */}
                {Object.entries(parsed).filter(([key]) => !CATEGORIES.includes(key) && !["Themen","Nachricht","Rolle","Firma"].includes(key)).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Weitere Infos</h4>
                    <div className="bg-muted/30 rounded-md p-3 space-y-1">
                      {Object.entries(parsed).filter(([key]) => !CATEGORIES.includes(key) && !["Themen","Nachricht","Rolle","Firma"].includes(key)).map(([key, val]) => (
                        <p key={key} className="text-sm"><span className="font-medium">{key}:</span> <span className="text-muted-foreground">{val}</span></p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notizen */}
                {quickNotes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <MessageSquarePlus className="w-3.5 h-3.5" /> Notizen ({quickNotes.length})
                    </h4>
                    <div className="space-y-1.5">
                      {quickNotes.map((note, i) => {
                        const tsMatch = note.match(/^\[(.*?)\]\s*(.*)/);
                        return (
                          <div key={i} className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-sm">
                            {tsMatch ? (<><span className="text-xs text-amber-600 font-medium">{tsMatch[1]}</span><p className="text-foreground mt-0.5">{tsMatch[2]}</p></>) : <p>{note}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer-Aktionen */}
              <div className="sticky bottom-0 bg-background border-t px-5 py-3 flex flex-wrap gap-2 rounded-b-lg">
                <PortalButtons email={anfrage.email} anfrageId={anfrage.id} />
                <Button size="sm" variant="outline" onClick={() => { setEmailAnfrage(anfrage); setSelectedAnfrage(null); }} data-testid="modal-btn-mail">
                  <Mail className="w-4 h-4" /> E-Mail
                </Button>
                <Button size="sm" variant="outline" onClick={() => { openQuickNote(anfrage); setSelectedAnfrage(null); }} data-testid="modal-btn-note">
                  <MessageSquarePlus className="w-4 h-4" /> Notiz
                </Button>
                <Button size="sm" variant="outline" onClick={() => { openEdit(anfrage); setSelectedAnfrage(null); }} data-testid="modal-btn-edit">
                  <Pencil className="w-4 h-4" /> Bearbeiten
                </Button>
                <Button size="sm" onClick={() => { handleConvert(anfrage.id); setSelectedAnfrage(null); }} data-testid="modal-btn-convert">
                  <UserCheck className="w-4 h-4" /> Als Kunde
                </Button>
                <div className="ml-auto">
                  <Button size="sm" variant="outline" onClick={() => { handleDelete(anfrage.id); setSelectedAnfrage(null); }} data-testid="modal-btn-delete"
                    className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" /> Ablehnen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Modal */}
      <Modal isOpen={!!editAnfrage} onClose={() => setEditAnfrage(null)} title="Anfrage bearbeiten" size="lg">
        <div className="space-y-4" data-testid="edit-anfrage-modal">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input
                data-testid="edit-anfrage-name"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-Mail</label>
              <Input
                data-testid="edit-anfrage-email"
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="E-Mail"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <Input
                data-testid="edit-anfrage-phone"
                value={editForm.phone || ""}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Telefon"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Firma</label>
              <Input
                data-testid="edit-anfrage-firma"
                value={editForm.firma || ""}
                onChange={(e) => setEditForm({ ...editForm, firma: e.target.value })}
                placeholder="Firma"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <Input
              data-testid="edit-anfrage-address"
              value={editForm.address || ""}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              placeholder="Straße, PLZ Ort"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Objektadresse</label>
            <Input
              data-testid="edit-anfrage-obj-address"
              value={editForm.obj_address || ""}
              onChange={(e) => setEditForm({ ...editForm, obj_address: e.target.value })}
              placeholder="Objektadresse (falls abweichend)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Typ</label>
            <div className="flex gap-2" data-testid="edit-anfrage-type">
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, customer_type: "Privat" })}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-all ${
                  editForm.customer_type === "Privat"
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Privat
              </button>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, customer_type: "Firma" })}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-all ${
                  editForm.customer_type === "Firma"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Firma
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Kategorien</label>
            <div className="flex flex-wrap gap-2" data-testid="edit-anfrage-categories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    (editForm.categories || []).includes(cat)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {reparaturgruppen.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                <Wrench className="w-4 h-4 text-orange-600" /> Reparaturgruppen (mehrfach auswählbar)
              </label>
              <div className="flex flex-wrap gap-2" data-testid="edit-anfrage-reparaturgruppe">
                {reparaturgruppen.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      const cur = editForm.reparaturgruppen || [];
                      setEditForm({
                        ...editForm,
                        reparaturgruppen: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g],
                      });
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      (editForm.reparaturgruppen || []).includes(g)
                        ? "bg-orange-600 text-white shadow-sm"
                        : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {(editForm.reparaturgruppen || []).length > 0 && (
                <p className="text-xs text-orange-600 mt-1">{editForm.reparaturgruppen.length} ausgewählt</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <Textarea
              data-testid="edit-anfrage-nachricht"
              value={editForm.nachricht || ""}
              onChange={(e) => setEditForm({ ...editForm, nachricht: e.target.value })}
              placeholder="Nachricht des Kunden"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notizen</label>
            <Textarea
              data-testid="edit-anfrage-notes"
              value={editForm.notes || ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Interne Notizen"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditAnfrage(null)} data-testid="edit-anfrage-cancel">
              Abbrechen
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.name} data-testid="edit-anfrage-save">
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </Modal>
      {/* E-Mail Dialog */}
      {emailAnfrage && (
        <AnfrageEmailDialog
          anfrage={emailAnfrage}
          onClose={() => setEmailAnfrage(null)}
        />
      )}
    </div>
  );
};


// ==================== ANFRAGE E-MAIL DIALOG ====================
const AnfrageEmailDialog = ({ anfrage, onClose }) => {
  const [toEmail, setToEmail] = useState(anfrage.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [vorlagen, setVorlagen] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    api.get("/email/vorlagen").then(res => setVorlagen(res.data)).catch(() => {});
  }, []);

  const filtered = vorlagen.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.betreff.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const replacePlaceholders = (text) => {
    return text
      .replace(/\{kunde_name\}/g, anfrage.name || "")
      .replace(/\{email\}/g, anfrage.email || "")
      .replace(/\{firma_name\}/g, "Tischlerei Graupner");
  };

  const applyVorlage = (vorlage) => {
    setSubject(replacePlaceholders(vorlage.betreff));
    setMessage(replacePlaceholders(vorlage.text));
    setSearchTerm(vorlage.name);
    setShowResults(false);
  };

  const handleSend = async () => {
    if (!toEmail || !message) { toast.error("E-Mail und Nachricht erforderlich"); return; }
    setSending(true);
    try {
      await api.post(`/email/anfrage/${anfrage.id}`, { to_email: toEmail, subject, message });
      toast.success(`E-Mail an ${toEmail} gesendet`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Senden");
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="anfrage-email-dialog">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5" /> E-Mail an {anfrage.name}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Vorlage + An in einer Zeile */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Vorlage wählen</label>
              <input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                className="w-full border rounded-sm p-2 text-sm pr-8"
                placeholder="Vorlage suchen... z.B. Bilder"
                data-testid="email-vorlage-search"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute right-2.5 top-[34px]" />
              {showResults && (
                <div className="absolute z-10 mt-1 w-full bg-background border rounded-sm shadow-lg max-h-48 overflow-y-auto" data-testid="email-vorlage-results">
                  {filtered.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Keine Vorlagen gefunden</p>
                  ) : (
                    filtered.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => applyVorlage(v)}
                        className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                        data-testid={`vorlage-option-${v.id}`}
                      >
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{v.betreff}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">An</label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                placeholder="kunde@email.de"
                data-testid="email-to"
              />
            </div>
          </div>

          {/* Betreff */}
          <div>
            <label className="block text-sm font-medium mb-1">Betreff</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              placeholder="Betreff..."
              data-testid="email-subject"
            />
          </div>

          {/* Nachricht */}
          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded-sm p-2 text-sm min-h-[250px] resize-y"
              placeholder="Nachricht..."
              data-testid="email-message"
            />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted">Abbrechen</button>
          <button
            onClick={handleSend}
            disabled={sending || !toEmail || !message}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-send-anfrage-email"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sende..." : "E-Mail senden"}
          </button>
        </div>
      </div>
    </div>
  );
};

export { AnfragenPage };
