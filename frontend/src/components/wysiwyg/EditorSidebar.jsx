import { Search, Wrench, Package, Copy, GripVertical, ChevronDown, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EditorSidebar = ({
  sidebarSearch, setSidebarSearch, sidebarTab, setSidebarTab,
  filteredServices, filteredArticles, leistungsBloecke,
  selectedItem, setSelectedItem,
  addFromStamm, deleteLeistungsBlock, insertLeistungsBlock,
  handleDragStart, navigate,
}) => {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto space-y-3 pr-1">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Suchen..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-card text-sm"
            data-testid="sidebar-search"
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-md border border-input overflow-hidden">
          <button
            onClick={() => setSidebarTab("services")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === "services" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            data-testid="tab-services"
          >
            <Wrench className="w-3.5 h-3.5 inline mr-1" />
            Leistungen ({filteredServices.length})
          </button>
          <button
            onClick={() => setSidebarTab("articles")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === "articles" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            data-testid="tab-articles"
          >
            <Package className="w-3.5 h-3.5 inline mr-1" />
            Artikel ({filteredArticles.length})
          </button>
          <button
            onClick={() => setSidebarTab("blocks")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === "blocks" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            data-testid="tab-blocks"
          >
            <Copy className="w-3.5 h-3.5 inline mr-1" />
            Blöcke ({leistungsBloecke.length})
          </button>
        </div>

        {/* Items List */}
        {sidebarTab !== "blocks" ? (
        <div className="space-y-1.5">
          {(sidebarTab === "services" ? filteredServices : filteredArticles).map((item) => (
            <div key={item.id}>
              <div
                draggable="true"
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                className={`group flex items-start gap-2 p-2.5 rounded-md border cursor-grab active:cursor-grabbing transition-all ${selectedItem?.id === item.id ? "border-primary bg-primary/5 shadow-sm" : "border-input bg-card hover:border-primary/40 hover:shadow-sm"}`}
                data-testid={`draggable-item-${item.id}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.typ === "Fremdleistung" && (
                      <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0 rounded font-medium shrink-0">Sub</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  )}
                  {item.subunternehmer && (
                    <p className="text-[10px] text-orange-600 truncate">{item.subunternehmer}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-semibold text-primary">{item.price_net.toFixed(2)} €</span>
                    <span className="text-[10px] text-muted-foreground">/ {item.unit}</span>
                    {item.ek_preis > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono">EK: {item.ek_preis.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5 transition-transform ${selectedItem?.id === item.id ? "rotate-180 text-primary" : ""}`} />
              </div>

              {/* Expanded Detail View */}
              {selectedItem?.id === item.id && (
                <div className="mt-1 rounded-md border border-primary/20 bg-white p-4 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200" data-testid={`detail-view-${item.id}`}>
                  <h4 className="font-semibold text-base mb-1">{item.name}</h4>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{item.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-md p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Preis (Netto)</p>
                      <p className="text-lg font-bold font-mono text-primary">{item.price_net.toFixed(2)} €</p>
                    </div>
                    <div className="bg-slate-50 rounded-md p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Einheit</p>
                      <p className="text-lg font-bold">{item.unit}</p>
                    </div>
                  </div>
                  {item.category && (
                    <p className="text-xs text-muted-foreground mb-3">Kategorie: <span className="font-medium">{item.category}</span></p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); addFromStamm(item); toast.success(`"${item.name}" hinzugefügt`); }}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      data-testid={`btn-add-item-${item.id}`}
                    >
                      <Plus className="w-4 h-4" />
                      Ins Dokument
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/articles`); }}
                      className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
                      data-testid={`btn-edit-item-${item.id}`}
                    >
                      <Edit className="w-4 h-4" />
                      Bearbeiten
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">Oder per Drag & Drop ins Dokument ziehen</p>
                </div>
              )}
            </div>
          ))}
          {(sidebarTab === "services" ? filteredServices : filteredArticles).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              {sidebarSearch ? "Keine Ergebnisse" : `Keine ${sidebarTab === "services" ? "Leistungen" : "Artikel"} vorhanden`}
            </p>
          )}
        </div>
        ) : (
        /* Blöcke Tab */
        <div className="space-y-2">
          {leistungsBloecke.map(block => (
            <div key={block.id} className="border rounded-sm p-3 bg-card hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold">{block.name}</p>
                <button onClick={() => deleteLeistungsBlock(block.id)}
                  className="p-0.5 text-muted-foreground hover:text-destructive rounded transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{block.positions.length} Positionen</p>
              <div className="text-[10px] text-muted-foreground mb-2 space-y-0.5 max-h-20 overflow-y-auto">
                {block.positions.map((p, i) => (
                  <p key={i} className="truncate">{p.type === "titel" ? `Titel: ${p.description}` : `${p.description.split("\n")[0]}`}</p>
                ))}
              </div>
              <button onClick={() => insertLeistungsBlock(block)}
                className="w-full py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm hover:bg-primary/90 transition-colors"
                data-testid={`insert-block-${block.id}`}>
                <Plus className="w-3 h-3 inline mr-1" /> Ins Dokument
              </button>
            </div>
          ))}
          {leistungsBloecke.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Keine Leistungsblöcke vorhanden.<br />
              Positionen im Dokument markieren und als Block speichern.
            </p>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export { EditorSidebar };
