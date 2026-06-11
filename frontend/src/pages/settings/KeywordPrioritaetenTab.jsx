import { useEffect, useState } from "react";
import { Plus, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Stufen-Definition (Farbpunkt + Label). Reihenfolge = Dringlichkeit.
const STUFEN = [
  { key: "sofort", label: "Sofort", dot: "bg-red-500", box: "border-red-200 bg-red-50" },
  { key: "stufe1", label: "Stufe 1", dot: "bg-green-500", box: "border-green-200 bg-green-50" },
  { key: "stufe2", label: "Stufe 2", dot: "bg-amber-500", box: "border-amber-200 bg-amber-50" },
  { key: "stufe3", label: "Stufe 3 (Standard)", dot: "bg-blue-500", box: "border-blue-200 bg-blue-50" },
];

const LEER = { sofort: [], stufe1: [], stufe2: [], stufe3: [] };

export const KeywordPrioritaetenTab = () => {
  const [data, setData] = useState(LEER);
  const [neu, setNeu] = useState({ sofort: "", stufe1: "", stufe2: "", stufe3: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/keyword-prioritaeten");
      setData({ ...LEER, ...(res.data || {}) });
    } catch {
      toast.error("Keyword-Prioritäten konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addKeyword = (stufe) => {
    const kw = (neu[stufe] || "").trim();
    if (!kw) return;
    if ((data[stufe] || []).some((x) => x.toLowerCase() === kw.toLowerCase())) {
      toast.info("Keyword existiert bereits in dieser Stufe");
      return;
    }
    setData((d) => ({ ...d, [stufe]: [...(d[stufe] || []), kw] }));
    setNeu((n) => ({ ...n, [stufe]: "" }));
  };

  const removeKeyword = (stufe, kw) => {
    setData((d) => ({ ...d, [stufe]: (d[stufe] || []).filter((x) => x !== kw) }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/keyword-prioritaeten", { stufen: data });
      toast.success("Keyword-Prioritäten gespeichert");
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8" data-testid="keyword-prio-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Lade…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl" data-testid="keyword-prio-tab">
      <div>
        <h2 className="text-lg font-semibold">Keyword-Prioritäten</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Eingehende Anfragen werden anhand dieser Keywords automatisch einer Stufe zugeordnet
          (umlaut-tolerant). Reihenfolge: Sofort vor Stufe 1 vor Stufe 2 vor Stufe 3.
        </p>
      </div>

      {STUFEN.map(({ key, label, dot, box }) => (
        <div key={key} className={`border rounded-sm p-4 ${box}`} data-testid={`keyword-prio-stufe-${key}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-3 h-3 rounded-full ${dot}`} />
            <h3 className="text-sm font-semibold">{label}</h3>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {(data[key] || []).length === 0 && (
              <span className="text-xs text-muted-foreground italic">Noch keine Keywords</span>
            )}
            {(data[key] || []).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-background border rounded-full"
                data-testid={`keyword-chip-${key}-${kw}`}
              >
                {kw}
                <button
                  onClick={() => removeKeyword(key, kw)}
                  className="text-muted-foreground hover:text-red-600"
                  title="Keyword entfernen"
                  data-testid={`keyword-remove-${key}-${kw}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={neu[key]}
              onChange={(e) => setNeu((n) => ({ ...n, [key]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(key); } }}
              placeholder="Neues Keyword…"
              className="flex-1 border rounded-sm p-2 text-sm bg-background"
              data-testid={`keyword-input-${key}`}
            />
            <button
              onClick={() => addKeyword(key)}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-sm bg-background hover:bg-accent"
              data-testid={`keyword-add-${key}`}
            >
              <Plus className="w-4 h-4" /> Hinzufügen
            </button>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50"
          data-testid="keyword-prio-save"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Speichern
        </button>
      </div>
    </div>
  );
};
