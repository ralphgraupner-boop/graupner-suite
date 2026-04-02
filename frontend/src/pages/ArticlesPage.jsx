import { useState, useEffect } from "react";
import { Package, Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api, API } from "@/lib/api";

const ArticlesPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editArticle, setEditArticle] = useState(null);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const res = await api.get("/articles");
      setArticles(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Artikel");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Artikel wirklich löschen?")) return;
    try {
      await api.delete(`/articles/${id}`);
      toast.success("Artikel gelöscht");
      loadArticles();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <div data-testid="articles-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Artikelstamm</h1>
          <p className="text-muted-foreground mt-2">Verwalten Sie Ihre Materialien und Produkte</p>
        </div>
        <Button
          data-testid="btn-new-article"
          onClick={() => {
            setEditArticle(null);
            setShowModal(true);
          }}
        >
          <Plus className="w-5 h-5" />
          Neuer Artikel
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : articles.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Keine Artikel vorhanden</h3>
          <p className="text-muted-foreground mt-2">
            Erstellen Sie Artikelvorlagen für schnellere Angebotserstellung
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <Card key={article.id} className="p-6 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{article.name}</h3>
                  {article.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {article.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditArticle(article);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-muted rounded-sm"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{article.unit}</span>
                <div className="text-right">
                  <span className="text-lg font-mono font-semibold">
                    {article.price_net.toFixed(2)} €
                  </span>
                  {article.purchase_price > 0 && (
                    <span className="block text-xs text-muted-foreground font-mono">
                      EK: {article.purchase_price.toFixed(2)} € ({((1 - article.purchase_price / article.price_net) * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ArticleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        article={editArticle}
        onSave={() => {
          setShowModal(false);
          loadArticles();
        }}
      />
    </div>
  );
};

const ArticleModal = ({ isOpen, onClose, article, onSave }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit: "Stück",
    price_net: 0,
    purchase_price: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (article) {
      setForm({
        name: article.name || "",
        description: article.description || "",
        unit: article.unit || "Stück",
        price_net: article.price_net || 0,
        purchase_price: article.purchase_price || 0
      });
    } else {
      setForm({ name: "", description: "", unit: "Stück", price_net: 0, purchase_price: 0 });
    }
  }, [article]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (article) {
        await api.put(`/articles/${article.id}`, form);
        toast.success("Artikel aktualisiert");
      } else {
        await api.post("/articles", form);
        toast.success("Artikel erstellt");
      }
      onSave();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={article ? "Artikel bearbeiten" : "Neuer Artikel"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Bezeichnung *</label>
          <Input
            data-testid="input-article-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Türreparatur"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Beschreibung</label>
          <Textarea
            data-testid="input-article-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optionale Beschreibung..."
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Einheit</label>
            <select
              data-testid="select-article-unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="Stück">Stück</option>
              <option value="Stunde">Stunde</option>
              <option value="m²">m²</option>
              <option value="lfm">lfm</option>
              <option value="Pauschal">Pauschal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">VK-Preis (Netto €)</label>
            <Input
              data-testid="input-article-price"
              type="number"
              step="0.01"
              value={form.price_net}
              onChange={(e) => setForm({ ...form, price_net: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">EK-Preis (Netto €)</label>
            <Input
              data-testid="input-article-purchase-price"
              type="number"
              step="0.01"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Marge</label>
            <div className="h-10 flex items-center px-3 rounded-sm border border-input bg-muted/50 font-mono text-sm">
              {form.price_net > 0 && form.purchase_price > 0
                ? `${((1 - form.purchase_price / form.price_net) * 100).toFixed(1)}%`
                : "—"}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" data-testid="btn-save-article" disabled={loading}>
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};


export { ArticlesPage };
