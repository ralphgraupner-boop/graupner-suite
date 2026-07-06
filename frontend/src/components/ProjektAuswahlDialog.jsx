import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/common";
import { api } from "@/lib/api";

const ProjektAuswahlDialog = ({ kunde, entryId, onClose, onPicked, onCreateNew }) => {
  const [projekte, setProjekte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await api.get(`/module-projekte/?kunde_id=${kunde.id}`);
        const list = (r.data || [])
          .slice()
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        if (active) setProjekte(list);
      } catch (e) {
        if (active) setProjekte([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [kunde.id]);

  const zuordnen = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/module-mail-inbox/${entryId}/projekt`, { projekt_id: selected });
      toast.success("Projekt zugeordnet");
      onPicked(selected);
    } catch (e) {
      toast.error("Zuordnen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Projekt zuordnen für ${kunde.name || ""}`} size="md">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Zu welchem Projekt gehört diese Mail?</p>

        {loading && <p className="text-sm">Lade Projekte...</p>}

        {!loading && projekte.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine bestehenden Projekte gefunden.</p>
        )}

        {!loading &&
          projekte.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                selected === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
              }`}
            >
              <div className="font-medium text-sm">{p.titel || "(ohne Titel)"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Angelegt: {p.created_at ? new Date(p.created_at).toLocaleDateString("de-DE") : "-"}
                {p.kategorie ? ` · Kategorie: ${p.kategorie}` : ""}
              </div>
            </div>
          ))}

        <Button variant="outline" className="w-full" onClick={onCreateNew}>
          + Neues Projekt anlegen
        </Button>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!selected || saving} onClick={zuordnen}>
            Zuordnen
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProjektAuswahlDialog;
