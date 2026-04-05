import { useState } from "react";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const StammdatenPanel = ({ articles: arts, services: svcs, onRefresh }) => {
  const [editItem, setEditItem] = useState(null);
  const [tab, setTab] = useState("leistungen");
  const [search, setSearch] = useState("");
  const allItems = (tab === "leistungen" ? svcs : arts).filter(i =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()) || i.article_number?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!window.confirm("Wirklich löschen?")) return;
    try {
      await api.delete(`/articles/${id}`);
      toast.success("Gelöscht");
      onRefresh();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  const handleSave = async (item) => {
    try {
      if (item.id) {
        const { id, created_at, ...data } = item;
        await api.put(`/articles/${id}`, data);
      } else {
        await api.post("/articles", item);
      }
      toast.success("Gespeichert");
      setEditItem(null);
      onRefresh();
    } catch { toast.error("Fehler beim Speichern"); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("leistungen")}
          className={`px-4 py-2 text-sm font-medium rounded-sm ${tab === "leistungen" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          Leistungen ({svcs.length})
        </button>
        <button onClick={() => setTab("artikel")}
          className={`px-4 py-2 text-sm font-medium rounded-sm ${tab === "artikel" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          Artikel ({arts.length})
        </button>
        <button onClick={() => setEditItem({ name: "", description: "", unit: "Stück", price_net: 0, typ: tab === "leistungen" ? "Leistung" : "Artikel" })}
          className="ml-auto px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">
          <Plus className="w-4 h-4 inline mr-1" /> Neu
        </button>
      </div>
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Suchen nach Name, Beschreibung, Nummer..."
          className="w-full border rounded-sm pl-9 pr-3 py-2 text-sm" />
      </div>
      {editItem && (
        <div className="border rounded-sm p-4 mb-4 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Name</label>
              <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Typ</label>
              <select value={editItem.typ} onChange={(e) => setEditItem({ ...editItem, typ: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm">
                <option>Leistung</option><option>Artikel</option><option>Fremdleistung</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Beschreibung</label>
            <textarea value={editItem.description || ""} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm" rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Einheit</label>
              <input value={editItem.unit} onChange={(e) => setEditItem({ ...editItem, unit: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">VK Netto</label>
              <input type="number" step="0.01" value={editItem.price_net} onChange={(e) => setEditItem({ ...editItem, price_net: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">EK Netto</label>
              <input type="number" step="0.01" value={editItem.ek_preis || 0} onChange={(e) => setEditItem({ ...editItem, ek_preis: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSave(editItem)} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm">Speichern</button>
            <button onClick={() => setEditItem(null)} className="px-4 py-2 text-sm text-muted-foreground">Abbrechen</button>
          </div>
        </div>
      )}
      <div className="space-y-1">
        {allItems.map(item => (
          <div key={item.id} className="flex items-center justify-between border rounded-sm px-4 py-3 bg-card hover:border-primary/20">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{item.name}</p>
              {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
              <p className="text-xs text-muted-foreground">{item.article_number} · {item.price_net?.toFixed(2)} € / {item.unit}</p>
            </div>
            <div className="flex gap-1 ml-2">
              <button onClick={() => setEditItem({ ...item })} className="p-1.5 text-muted-foreground hover:text-primary rounded"><Edit className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export { StammdatenPanel };
