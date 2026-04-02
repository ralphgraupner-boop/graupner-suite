import { useState, useEffect } from "react";
import { Search, Inbox, UserCheck, Trash2, ChevronDown, Globe, Mail, Phone, MapPin, FileText } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge, Button } from "@/components/common";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";

const AnfragenPage = () => {
  const [anfragen, setAnfragen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadAnfragen();
  }, [activeCategory]);

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
                  onClick={() => setExpandedId(isExpanded ? null : anfrage.id)}
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
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Aufgeklappte Detail-Ansicht */}
                {isExpanded && (
                  <div className="border-t bg-muted/30 p-4 lg:p-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Kontaktdaten */}
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Kontaktdaten</h4>
                        <div className="space-y-2">
                          <p className="text-sm"><span className="font-medium">Name:</span> {anfrage.name}</p>
                          {anfrage.email && (
                            <p className="text-sm"><span className="font-medium">E-Mail:</span> <a href={`mailto:${anfrage.email}`} className="text-primary hover:underline">{anfrage.email}</a></p>
                          )}
                          {anfrage.phone && (
                            <p className="text-sm"><span className="font-medium">Telefon:</span> <a href={`tel:${anfrage.phone}`} className="text-primary hover:underline">{anfrage.phone}</a></p>
                          )}
                          {anfrage.address && (
                            <div>
                              <span className="text-sm font-medium">Adresse:</span>
                              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{anfrage.address}</p>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(anfrage.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                              >
                                <Globe className="w-3 h-3" /> Auf Karte zeigen
                              </a>
                            </div>
                          )}
                          {anfrage.firma && <p className="text-sm"><span className="font-medium">Firma:</span> {anfrage.firma}</p>}
                          {anfrage.customer_type && <p className="text-sm"><span className="font-medium">Typ:</span> {anfrage.customer_type}</p>}
                        </div>
                      </div>

                      {/* Kategorien & Beschreibungen */}
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Kategorien & Details</h4>
                        {(anfrage.categories || []).length > 0 ? (
                          <div className="space-y-3">
                            {anfrage.categories.map((cat) => {
                              const descKey = Object.keys(parsed).find(k => k === cat);
                              return (
                                <div key={cat} className="bg-background rounded-sm p-3 border">
                                  <span className="text-sm font-medium text-primary">{cat}</span>
                                  {descKey && parsed[descKey] && (
                                    <p className="text-sm text-muted-foreground mt-1">{parsed[descKey]}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Keine Kategorien ausgewählt</p>
                        )}
                        {anfrage.obj_address && (
                          <div className="mt-3">
                            <span className="text-sm font-medium">Objektadresse:</span>
                            <p className="text-sm text-muted-foreground mt-0.5">{anfrage.obj_address}</p>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(anfrage.obj_address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                            >
                              <Globe className="w-3 h-3" /> Auf Karte zeigen
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Nachricht & Notizen */}
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Nachricht</h4>
                        {anfrage.nachricht ? (
                          <div className="bg-background rounded-sm p-3 border">
                            <p className="text-sm whitespace-pre-line">{anfrage.nachricht}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Keine Nachricht</p>
                        )}
                        {/* Parsed notes - show remaining entries not matching categories */}
                        {Object.entries(parsed).filter(([key]) => 
                          !CATEGORIES.includes(key) && 
                          key !== "Themen" && 
                          key !== "Nachricht" &&
                          key !== "Rolle" &&
                          key !== "Firma"
                        ).length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-sm font-medium">Weitere Infos:</span>
                            {Object.entries(parsed)
                              .filter(([key]) => !CATEGORIES.includes(key) && key !== "Themen" && key !== "Nachricht" && key !== "Rolle" && key !== "Firma")
                              .map(([key, val]) => (
                                <p key={key} className="text-sm text-muted-foreground"><span className="font-medium">{key}:</span> {val}</p>
                              ))
                            }
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-3">
                          Quelle: {anfrage.source || "manuell"} | Erstellt: {new Date(anfrage.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    {/* Aktionen */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                      <Button size="sm" onClick={() => handleConvert(anfrage.id)} data-testid={`btn-convert-expanded-${anfrage.id}`}>
                        <UserCheck className="w-4 h-4" /> Als Kunde übernehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(anfrage.id)}
                        className={confirmDeleteId === anfrage.id ? 'bg-red-500 text-white border-red-500' : ''}
                      >
                        <Trash2 className="w-4 h-4" /> {confirmDeleteId === anfrage.id ? "Nochmal klicken!" : "Ablehnen"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { AnfragenPage };
