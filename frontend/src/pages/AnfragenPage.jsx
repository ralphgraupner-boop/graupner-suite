import { useState, useEffect } from "react";
import { Search, X, Inbox, UserCheck, Filter, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge } from "@/components/common";
import { api, API } from "@/lib/api";
import { CATEGORIES, CUSTOMER_STATUSES } from "@/lib/constants";

const AnfragenPage = () => {
  const [anfragen, setAnfragen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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

      {/* Category filter pills */}
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
        <div className="space-y-3">
          {filtered.map((anfrage) => (
            <Card key={anfrage.id} className="p-4 lg:p-5" data-testid={`anfrage-card-${anfrage.id}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{anfrage.name}</h3>
                    {anfrage.firma && (
                      <Badge variant="info" className="text-xs">{anfrage.firma}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(anfrage.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Categories */}
                  {(anfrage.categories || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {anfrage.categories.map((cat) => (
                        <span key={cat} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Contact details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {anfrage.email && <span>{anfrage.email}</span>}
                    {anfrage.phone && <span>{anfrage.phone}</span>}
                    {anfrage.address && <span>{anfrage.address}</span>}
                  </div>

                  {/* Message */}
                  {anfrage.nachricht && (
                    <p className="mt-2 text-sm bg-muted/50 p-3 rounded-sm line-clamp-3">{anfrage.nachricht}</p>
                  )}

                  {/* Object address */}
                  {anfrage.obj_address && (
                    <p className="mt-1 text-xs text-muted-foreground">Objektadresse: {anfrage.obj_address}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleConvert(anfrage.id)}
                    data-testid={`btn-convert-${anfrage.id}`}
                    className="p-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-sm transition-colors"
                    title="Als Kunde übernehmen"
                  >
                    <UserCheck className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(anfrage.id)}
                    data-testid={`btn-delete-anfrage-${anfrage.id}`}
                    className={`p-2.5 rounded-sm transition-colors ${confirmDeleteId === anfrage.id ? 'bg-red-500 text-white' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                    title={confirmDeleteId === anfrage.id ? "Nochmal klicken zum Löschen" : "Anfrage löschen"}
                  >
                    {confirmDeleteId === anfrage.id ? <span className="text-xs font-bold px-1">Löschen?</span> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};


export { AnfragenPage };
