import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Trash2, Edit, Search, Globe, ChevronDown, Upload, File, Image as ImageIcon, Download, Package, FileText, ArrowDownToLine, Wrench, Receipt, ClipboardCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";

const KUNDEN_STATUSES = ["Anfrage", "Neu", "Interessent", "Kunde", "In Bearbeitung", "Abgeschlossen", "Archiv"];

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
  const [kunden, setKunden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editKunde, setEditKunde] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [vcfUploading, setVcfUploading] = useState(false);
  const [showKontaktImport, setShowKontaktImport] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadKunden(); }, []);

  const loadKunden = async () => {
    try {
      const res = await api.get("/modules/kunden/data");
      setKunden(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/modules/kunden/data/${id}`);
      toast.success("Kunde geloescht");
      setConfirmDeleteId(null);
      loadKunden();
    } catch { toast.error("Fehler"); }
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
    setVcfUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/modules/kunden/import-vcf", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`VCF importiert: ${file.name}`);
      loadKunden();
    } catch { toast.error("Fehler beim VCF-Import"); }
    finally { setVcfUploading(false); e.target.value = ""; }
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

  const filtered = kunden.filter(c =>
    (((c.vorname || c.nachname) ? `${c.vorname || ''} ${c.nachname || ''}`.trim() : (c.name || '')).toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.firma || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.nachricht || "").toLowerCase().includes(search.toLowerCase())) &&
    (!categoryFilter || (c.categories || []).includes(categoryFilter)) &&
    (!statusFilter || (c.status || c.kontakt_status || "Anfrage") === statusFilter)
  ).sort((a, b) => {
    const sa = statusOrder[a.status || a.kontakt_status || "Anfrage"] ?? 9;
    const sb = statusOrder[b.status || b.kontakt_status || "Anfrage"] ?? 9;
    if (sa !== sb) return sa - sb;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  const statusCounts = {};
  KUNDEN_STATUSES.forEach(s => { statusCounts[s] = kunden.filter(k => (k.status || k.kontakt_status || "Anfrage") === s).length; });

  return (
    <div data-testid="kunden-modul-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Kunden</h1>
            <Badge variant="default" className="text-xs">Solo</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{kunden.length} Kunden gesamt</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4" /> Export</Button>
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-medium cursor-pointer transition-colors ${vcfUploading ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`} data-testid="btn-vcf-import-kunden-modul">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{vcfUploading ? "Importiere..." : "VCF importieren"}</span>
            <input type="file" accept=".vcf" onChange={handleVcfUpload} className="hidden" disabled={vcfUploading} />
          </label>
          <Button size="sm" className="lg:h-10 lg:px-4" onClick={() => { setEditKunde(null); setShowModal(true); }} data-testid="btn-new-kunden-modul">
            <Plus className="w-4 h-4" /> Neuer Kunde
          </Button>
        </div>
      </div>

      {/* Suche */}
      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 lg:h-10" placeholder="Kunden suchen..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-kunden-modul" />
        </div>
      </Card>

      {/* Kategorie Filter */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => setCategoryFilter("")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!categoryFilter ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>Alle</button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${categoryFilter === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{cat}</button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setStatusFilter("")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!statusFilter ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>Alle Status</button>
        {KUNDEN_STATUSES.map(st => (
          <button key={st} onClick={() => setStatusFilter(statusFilter === st ? "" : st)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === st ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[st]?.dot?.replace(" animate-pulse", "") || "bg-gray-400"}`} />
            {st} ({statusCounts[st] || 0})
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center"><Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-40" /><p className="text-muted-foreground">{search ? "Keine Ergebnisse" : "Erstellen Sie Ihren ersten Kunden"}</p></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(kunde => {
            const isExpanded = expandedId === kunde.id;
            const displayName = (kunde.vorname || kunde.nachname) ? `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() : kunde.name;
            return (
              <Card key={kunde.id} className={`transition-all cursor-pointer overflow-hidden border-l-4 ${STATUS_COLORS[kunde.status || kunde.kontakt_status || "Anfrage"]?.border || ""} ${isExpanded ? 'shadow-lg border-primary/40 ring-1 ring-primary/20' : 'hover:shadow-md'}`} data-testid={`kunden-modul-${kunde.id}`}>
                <div className="flex items-center gap-4 p-3 lg:p-4" onClick={() => setExpandedId(isExpanded ? null : kunde.id)}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLORS[kunde.status || kunde.kontakt_status || "Anfrage"]?.dot || "bg-gray-400"}`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    {kunde.vorname?.charAt(0)?.toUpperCase() || kunde.nachname?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{displayName}</span>
                      {kunde.firma && <Badge variant="info" className="text-xs">{kunde.firma}</Badge>}
                      {kunde.customer_type && kunde.customer_type !== "Privat" && <Badge variant="default" className="text-xs">{kunde.customer_type}</Badge>}
                      {(kunde.status || kunde.kontakt_status) && <Badge className={`text-xs ${STATUS_COLORS[kunde.status || kunde.kontakt_status]?.badge || "bg-gray-100 text-gray-600"}`}>{kunde.status || kunde.kontakt_status}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {kunde.phone && <span>{kunde.phone}</span>}
                      {kunde.email && <span className="truncate hidden sm:inline">{kunde.email}</span>}
                      {kunde.photos?.length > 0 && <span className="text-primary flex items-center gap-1"><File className="w-3 h-3" />{kunde.photos.length}</span>}
                    </div>
                  </div>
                  {(kunde.categories || []).length > 0 && (
                    <div className="hidden lg:flex flex-wrap gap-1">
                      {kunde.categories.map(cat => <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{cat}</span>)}
                    </div>
                  )}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditKunde(kunde); setShowModal(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(kunde.id)} className={`p-2 rounded-sm transition-colors ${confirmDeleteId === kunde.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10'}`}>
                      {confirmDeleteId === kunde.id ? <span className="text-xs font-bold">?</span> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Detail */}
                {isExpanded && (
                  <div className="border-t bg-muted/30 p-4 lg:p-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Kontaktdaten</h4>
                        <div className="space-y-2">
                          {kunde.anrede && <p className="text-sm"><span className="font-medium">Anrede:</span> {kunde.anrede}</p>}
                          {kunde.firma && <p className="text-sm"><span className="font-medium">Firma:</span> {kunde.firma}</p>}
                          {kunde.vorname && <p className="text-sm"><span className="font-medium">Vorname:</span> {kunde.vorname}</p>}
                          {kunde.nachname && <p className="text-sm"><span className="font-medium">Nachname:</span> {kunde.nachname}</p>}
                          {kunde.email && <p className="text-sm"><span className="font-medium">E-Mail:</span> {kunde.email}</p>}
                          {kunde.phone && <p className="text-sm"><span className="font-medium">Telefon:</span> {kunde.phone}</p>}
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

                    {/* Aktionen */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                      <Button size="sm" onClick={() => { setEditKunde(kunde); setShowModal(true); }}><Edit className="w-4 h-4" /> Bearbeiten</Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/quotes/new?customer=${kunde.id}`)}><FileText className="w-4 h-4" /> Angebot erstellen</Button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.get(`/portals/for-customer/${kunde.id}`);
                            if (res.data?.exists) {
                              navigate(`/portals`);
                              toast.info("Portal geöffnet");
                            } else {
                              if (!kunde.email) { toast.error("Kunde hat keine E-Mail – erst ergänzen"); return; }
                              if (!window.confirm(`Neues Kundenportal für ${kunde.vorname} ${kunde.nachname} anlegen?`)) return;
                              await api.post(`/portals/from-customer/${kunde.id}`, {});
                              toast.success("Portal erstellt – öffne jetzt die Portal-Übersicht");
                              navigate("/portals");
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
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/einsaetze/from-kunde/${kunde.id}`);
                            toast.success("Einsatz erstellt");
                            window.location.href = "/einsaetze";
                          } catch (err) {
                            toast.error(err?.response?.data?.detail || "Fehler beim Erstellen");
                          }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors"
                        data-testid={`btn-to-einsatz-${kunde.id}`}
                      >
                        <Wrench className="w-4 h-4" />
                        Einsatz erstellen
                      </button>
                    </div>

                    {/* Dokumenten-Hub für diesen Kunden */}
                    <CustomerDocumentsPanel customerId={kunde.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <KundenFormModal isOpen={showModal} onClose={() => setShowModal(false)} kunde={editKunde} onSave={() => { setShowModal(false); setEditKunde(null); loadKunden(); }} />

      {/* Kontakt-Import Modal */}
      <KontaktImportModal isOpen={showKontaktImport} onClose={() => setShowKontaktImport(false)} onImported={() => { setShowKontaktImport(false); loadKunden(); }} />
    </div>
  );
};


// ==================== KUNDEN FORM MODAL ====================
const KundenFormModal = ({ isOpen, onClose, kunde, onSave }) => {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    if (kunde) {
      setForm({ anrede: kunde.anrede || "", vorname: kunde.vorname || "", nachname: kunde.nachname || "", firma: kunde.firma || "", email: kunde.email || "", phone: kunde.phone || "", strasse: kunde.strasse || "", hausnummer: kunde.hausnummer || "", plz: kunde.plz || "", ort: kunde.ort || "", objekt_strasse: kunde.objekt_strasse || "", objekt_plz: kunde.objekt_plz || "", objekt_ort: kunde.objekt_ort || "", customer_type: kunde.customer_type || "Privat", status: kunde.status || kunde.kontakt_status || "Anfrage", categories: kunde.categories || [], notes: kunde.notes || "", nachricht: kunde.nachricht || "" });
    } else {
      setForm({ anrede: "", vorname: "", nachname: "", firma: "", email: "", phone: "", strasse: "", hausnummer: "", plz: "", ort: "", objekt_strasse: "", objekt_plz: "", objekt_ort: "", customer_type: "Privat", status: "Anfrage", categories: [], notes: "", nachricht: "" });
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
    if (!form.vorname && !form.nachname && !form.firma) { toast.error("Vorname, Nachname oder Firma erforderlich"); return; }
    setLoading(true);
    try {
      let kundeId = kunde?.id;
      if (kunde) {
        await api.put(`/modules/kunden/data/${kunde.id}`, form);
        toast.success("Kunde aktualisiert");
      } else {
        const res = await api.post("/modules/kunden/data", form);
        kundeId = res.data.id;
        toast.success("Kunde erstellt");
      }
      if (selectedFiles.length > 0 && kundeId) {
        const formData = new FormData();
        selectedFiles.forEach(f => formData.append('files', f));
        await api.post(`/modules/kunden/data/${kundeId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      onSave();
    } catch { toast.error("Fehler"); }
    finally { setLoading(false); }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.some(f => f.size > 10 * 1024 * 1024)) { toast.error("Max 10 MB pro Datei"); return; }
    setSelectedFiles(prev => [...prev, ...files].slice(0, 10));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={kunde ? "Kunde bearbeiten" : "Neuer Kunde"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="kunden-modul-form">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Anrede</label>
            <select value={form.anrede || ""} onChange={e => setForm({ ...form, anrede: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
              <option value="">Bitte waehlen</option><option value="Herr">Herr</option><option value="Frau">Frau</option><option value="Divers">Divers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Kundentyp</label>
            <select value={form.customer_type || "Privat"} onChange={e => setForm({ ...form, customer_type: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
              <option value="Privat">Privat</option><option value="Firma">Firma</option><option value="Vermieter">Vermieter</option><option value="Mieter">Mieter</option><option value="Gewerblich">Gewerblich</option><option value="Hausverwaltung">Hausverwaltung</option>
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
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Kategorien</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (<button key={cat} type="button" onClick={() => { const cats = (form.categories || []).includes(cat) ? form.categories.filter(c => c !== cat) : [...(form.categories || []), cat]; setForm({ ...form, categories: cats }); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${(form.categories || []).includes(cat) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input"}`}>{cat}</button>))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select value={form.status || "Neu"} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
            {KUNDEN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
        <div><label className="block text-sm font-medium mb-2">Nachricht / Anliegen</label><Textarea value={form.nachricht || ""} onChange={e => setForm({ ...form, nachricht: e.target.value })} rows={3} placeholder="Was wird benoetigt? Beschreibung des Anliegens..." /></div>
        <div><label className="block text-sm font-medium mb-2">Notizen <span className="text-xs text-muted-foreground">(intern)</span></label><Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Interne Bemerkungen..." /></div>
        <div>
          <label className="block text-sm font-medium mb-2">Dateien <span className="text-xs text-muted-foreground">(max 10, je 10 MB)</span></label>
          {selectedFiles.length > 0 && (
            <div className="mb-2 space-y-1">{selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-green-50 rounded-sm border border-green-200 text-sm">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 text-xs">X</button>
              </div>
            ))}</div>
          )}
          <div onDrop={e => { e.preventDefault(); handleFileSelect({ target: { files: e.dataTransfer.files } }); }} onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-muted-foreground/25 rounded-sm p-6 text-center hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
            onClick={() => document.getElementById('kunden-modul-file-upload').click()}>
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Dateien ablegen oder klicken</p>
            <input id="kunden-modul-file-upload" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx" onChange={handleFileSelect} className="hidden" />
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" disabled={loading}>{loading ? "Speichern..." : "Speichern"}</Button>
        </div>
      </form>
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
              const displayName = `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.firma || "Unbekannt";
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

export { KundenModulPage };


// ==================== CUSTOMER DOCUMENTS PANEL ====================
// Zeigt alle Angebote, Auftragsbestätigungen, Rechnungen für einen Kunden.
// Ermöglicht Öffnen/Bearbeiten/Neu-Erstellen direkt aus dem Kundenmodul.
const CustomerDocumentsPanel = ({ customerId }) => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState({ quotes: [], orders: [], invoices: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        const [q, o, i] = await Promise.all([
          api.get("/quotes").then(r => r.data.filter(x => x.customer_id === customerId)).catch(() => []),
          api.get("/orders").then(r => r.data.filter(x => x.customer_id === customerId)).catch(() => []),
          api.get("/invoices").then(r => r.data.filter(x => x.customer_id === customerId)).catch(() => []),
        ]);
        setDocs({ quotes: q, orders: o, invoices: i });
      } finally { setLoading(false); }
    };
    load();
  }, [customerId]);

  const newQuote = () => navigate(`/quotes/new?customer=${customerId}`);
  const newInvoice = () => navigate(`/invoices/new?customer=${customerId}`);
  const orderFromQuote = async (quoteId) => {
    try {
      const res = await api.post(`/orders/from-quote/${quoteId}`);
      toast.success("Auftragsbestätigung erstellt");
      navigate(`/orders/edit/${res.data.id}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Fehler"); }
  };
  const invoiceFromOrder = async (orderId) => {
    try {
      const res = await api.post(`/invoices/from-order/${orderId}`);
      toast.success("Rechnung erstellt");
      navigate(`/invoices/edit/${res.data.id}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Fehler"); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "—";
  const fmtEur = (n) => (n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  const statusColor = (status) => ({
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    open: "bg-amber-100 text-amber-700",
    cancelled: "bg-gray-100 text-gray-500",
  }[status] || "bg-gray-100 text-gray-700");

  const total = docs.quotes.length + docs.orders.length + docs.invoices.length;

  const tabs = [
    { id: "all", label: "Alle", icon: FileText, count: total },
    { id: "quotes", label: "Angebote", icon: FileText, count: docs.quotes.length, color: "blue" },
    { id: "orders", label: "Aufträge", icon: ClipboardCheck, count: docs.orders.length, color: "purple" },
    { id: "invoices", label: "Rechnungen", icon: Receipt, count: docs.invoices.length, color: "green" },
  ];

  const renderDocRow = (doc, type) => {
    const isQuote = type === "quote", isOrder = type === "order", isInvoice = type === "invoice";
    const number = doc.quote_number || doc.order_number || doc.invoice_number || doc.id?.slice(0, 8);
    const editUrl = isQuote ? `/quotes/edit/${doc.id}` : isOrder ? `/orders/edit/${doc.id}` : `/invoices/edit/${doc.id}`;
    const Icon = isQuote ? FileText : isOrder ? ClipboardCheck : Receipt;
    const typeColor = isQuote ? "text-blue-600" : isOrder ? "text-purple-600" : "text-green-600";
    return (
      <div key={doc.id} className="flex items-center gap-3 p-2.5 border rounded-sm hover:bg-muted/30 transition-colors group" data-testid={`doc-row-${doc.id}`}>
        <Icon className={`w-5 h-5 flex-shrink-0 ${typeColor}`} />
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-2 items-center">
          <div className="font-mono text-sm font-medium truncate">{number}</div>
          <div className="text-xs text-muted-foreground">{fmtDate(doc.created_at || doc.date)}</div>
          <Badge className={`${statusColor(doc.status)} text-xs w-fit`}>{doc.status || "—"}</Badge>
          <div className="text-sm font-mono text-right">{fmtEur(doc.total || doc.brutto || 0)}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => navigate(editUrl)}
            className="p-1.5 hover:bg-primary/10 text-primary rounded-sm transition-colors"
            title="Öffnen / Bearbeiten"
            data-testid={`btn-open-${doc.id}`}
          >
            <Eye className="w-4 h-4" />
          </button>
          {isQuote && (
            <button
              onClick={() => orderFromQuote(doc.id)}
              className="p-1.5 hover:bg-purple-50 text-purple-600 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
              title="Auftragsbestätigung daraus erstellen"
              data-testid={`btn-to-order-${doc.id}`}
            >
              <ClipboardCheck className="w-4 h-4" />
            </button>
          )}
          {isOrder && (
            <button
              onClick={() => invoiceFromOrder(doc.id)}
              className="p-1.5 hover:bg-green-50 text-green-600 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
              title="Rechnung daraus erstellen"
              data-testid={`btn-to-invoice-${doc.id}`}
            >
              <Receipt className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 pt-4 border-t" data-testid={`customer-docs-${customerId}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <FileText className="w-4 h-4" /> Dokumente &amp; Vorgänge {total > 0 && <Badge className="bg-slate-100 text-slate-700">{total}</Badge>}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={newQuote} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200" data-testid={`btn-new-quote-${customerId}`}>
            <Plus className="w-3 h-3" /> Angebot
          </button>
          <button onClick={newInvoice} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-sm bg-green-50 text-green-700 hover:bg-green-100 border border-green-200" data-testid={`btn-new-invoice-${customerId}`}>
            <Plus className="w-3 h-3" /> Rechnung
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-3">Lade Dokumente...</div>
      ) : total === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded-sm text-sm text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Noch keine Dokumente für diesen Kunden.
          <div className="text-xs mt-1">Klicke oben auf &quot;Angebot&quot; oder &quot;Rechnung&quot; um zu beginnen.</div>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-3 border-b">
            {tabs.map(t => {
              const T = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  data-testid={`tab-${t.id}-${customerId}`}
                >
                  <T className="w-3.5 h-3.5" /> {t.label} {t.count > 0 && <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-600">{t.count}</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            {(tab === "all" || tab === "quotes") && docs.quotes.map(d => renderDocRow(d, "quote"))}
            {(tab === "all" || tab === "orders") && docs.orders.map(d => renderDocRow(d, "order"))}
            {(tab === "all" || tab === "invoices") && docs.invoices.map(d => renderDocRow(d, "invoice"))}
          </div>
        </>
      )}
    </div>
  );
};
