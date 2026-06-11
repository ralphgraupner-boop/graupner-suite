import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Stufen-Definition (Farbpunkt + Label) – analog zu Keyword-Prioritäten.
const STUFEN = [
  { key: "sofort", label: "Sofort", dot: "bg-red-500", box: "border-red-200 bg-red-50" },
  { key: "stufe1", label: "Stufe 1", dot: "bg-green-500", box: "border-green-200 bg-green-50" },
  { key: "stufe2", label: "Stufe 2", dot: "bg-amber-500", box: "border-amber-200 bg-amber-50" },
  { key: "stufe3", label: "Stufe 3 (Standard)", dot: "bg-blue-500", box: "border-blue-200 bg-blue-50" },
];

const LEER = { sofort: "", stufe1: "", stufe2: "", stufe3: "" };

export const BegruessungsvorlagenTab = () => {
  const [data, setData] = useState(LEER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/begruessungsvorlagen");
      setData({ ...LEER, ...(res.data || {}) });
    } catch {
      toast.error("Begrüßungsvorlagen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/begruessungsvorlagen", { vorlagen: data });
      toast.success("Begrüßungsvorlagen gespeichert");
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8" data-testid="begruessung-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Lade…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl" data-testid="begruessung-tab">
      <div>
        <h2 className="text-lg font-semibold">Begrüßungsvorlagen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vorlage je Prioritätsstufe für die automatische Begrüßungsmail in den Mail-Anfragen.
          Die Firmen-Signatur wird automatisch angehängt.
        </p>
      </div>

      {STUFEN.map(({ key, label, dot, box }) => (
        <div key={key} className={`border rounded-sm p-4 ${box}`} data-testid={`begruessung-stufe-${key}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${dot}`} />
            <h3 className="text-sm font-semibold">{label}</h3>
          </div>
          <textarea
            value={data[key] || ""}
            onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
            className="w-full border rounded-sm p-2 text-sm min-h-[120px] resize-y bg-background"
            placeholder="Begrüßungstext…"
            data-testid={`begruessung-input-${key}`}
          />
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          data-testid="begruessung-save"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Speichern
        </button>
      </div>
    </div>
  );
};
