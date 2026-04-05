import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const BloeckePanel = ({ blocks, onDelete, onRefresh, onInsert, onCloseSettings }) => {
  const [editBlock, setEditBlock] = useState(null);

  const handleSaveBlock = async () => {
    if (!editBlock?.name?.trim()) return;
    try {
      await api.delete(`/leistungsbloecke/${editBlock.id}`);
      await api.post("/leistungsbloecke", { name: editBlock.name, positions: editBlock.positions });
      toast.success("Block aktualisiert!");
      setEditBlock(null);
      onRefresh();
    } catch { toast.error("Fehler beim Speichern"); }
  };

  const updateBlockPos = (posIdx, field, value) => {
    const updated = { ...editBlock, positions: editBlock.positions.map((p, i) => i === posIdx ? { ...p, [field]: value } : p) };
    setEditBlock(updated);
  };

  const removeBlockPos = (posIdx) => {
    setEditBlock({ ...editBlock, positions: editBlock.positions.filter((_, i) => i !== posIdx) });
  };

  return (
    <div>
      {blocks.length === 0 && !editBlock && (
        <p className="text-center text-muted-foreground py-8">Keine Leistungsblöcke vorhanden. Markieren Sie Positionen im Dokument und speichern Sie diese als Block.</p>
      )}
      {editBlock && (
        <div className="border rounded-sm p-4 mb-4 bg-muted/30 space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">Blockname</label>
            <input value={editBlock.name} onChange={(e) => setEditBlock({ ...editBlock, name: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm font-semibold" />
          </div>
          <p className="text-xs font-medium">Positionen:</p>
          <div className="space-y-2">
            {editBlock.positions.map((p, i) => (
              <div key={i} className="flex items-start gap-2 border rounded-sm p-2 bg-card">
                {p.type === "titel" ? (
                  <input value={p.description} onChange={(e) => updateBlockPos(i, "description", e.target.value)}
                    className="flex-1 border rounded px-2 py-1 text-sm font-bold" placeholder="Titel..." />
                ) : (
                  <>
                    <textarea value={p.description} onChange={(e) => updateBlockPos(i, "description", e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm resize-none" rows={2} />
                    <input type="number" step="0.01" value={p.quantity} onChange={(e) => updateBlockPos(i, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-16 border rounded px-2 py-1 text-sm text-right" />
                    <input value={p.unit} onChange={(e) => updateBlockPos(i, "unit", e.target.value)}
                      className="w-16 border rounded px-2 py-1 text-sm text-center" />
                    <input type="number" step="0.01" value={p.price_net} onChange={(e) => updateBlockPos(i, "price_net", parseFloat(e.target.value) || 0)}
                      className="w-20 border rounded px-2 py-1 text-sm text-right" />
                  </>
                )}
                <button onClick={() => removeBlockPos(i)} className="p-1 text-muted-foreground hover:text-destructive rounded mt-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveBlock} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-sm">Speichern</button>
            <button onClick={() => setEditBlock(null)} className="px-4 py-2 text-sm text-muted-foreground">Abbrechen</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {blocks.map(block => (
          <div key={block.id} className="border rounded-sm p-4 bg-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{block.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => setEditBlock({ ...block, positions: block.positions.map(p => ({ ...p })) })}
                  className="p-1 text-muted-foreground hover:text-primary rounded"><Edit className="w-4 h-4" /></button>
                <button onClick={() => { if (window.confirm("Block löschen?")) onDelete(block.id); }}
                  className="p-1 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{block.positions.length} Positionen</p>
            <div className="space-y-1 text-sm border-t pt-2">
              {block.positions.map((p, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span className="truncate flex-1 mr-2">{p.type === "titel" ? <b>Titel: {p.description}</b> : p.description?.split("\n")[0]}</span>
                  {p.type !== "titel" && <span className="text-muted-foreground font-mono whitespace-nowrap">{(p.quantity * p.price_net).toFixed(2)} €</span>}
                </div>
              ))}
            </div>
            <button onClick={() => { onInsert(block); if (onCloseSettings) onCloseSettings(); }}
              className="w-full mt-3 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:bg-primary/90">
              <Plus className="w-4 h-4 inline mr-1" /> Ins Dokument einfügen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export { BloeckePanel };
