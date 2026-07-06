import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { useF1Help } from "@/lib/useF1Help";

// Kleine Stoppwort-Liste, damit haeufige, wenig aussagekraeftige Woerter
// nicht faelschlich als Uebereinstimmung gezaehlt werden.
const STOPWOERTER = new Set([
  "aber", "alle", "allen", "auch", "auf", "aus", "bei", "bin", "bis",
  "bitte", "dank", "dann", "das", "dass", "dem", "den", "der", "des",
  "die", "dies", "diese", "dieser", "dieses", "doch", "dort", "durch",
  "eine", "einem", "einen", "einer", "eines", "einmal", "ein", "euch",
  "fuer", "gerne", "gruss", "guten", "hallo", "haben", "hatte", "heute",
  "herr", "herzlich", "herzlichen", "hier", "hin", "ich", "ihr", "ihre",
  "ihrem", "ihren", "ihrer", "ist", "jetzt", "kann", "koennen", "koennte",
  "liebe", "lieben", "mail", "mein", "meine", "meinem", "meiner", "mich",
  "mir", "mit", "muss", "nach", "nicht", "noch", "nur", "oder", "sehr",
  "sein", "seine", "sich", "sie", "sind", "sonst", "soll", "sollte",
  "tag", "tagen", "und", "uns", "unser", "vielen", "von", "vor", "wann",
  "war", "waere", "wenn", "werden", "wie", "wird", "wurde", "zum", "zur",
  "zwei",
]);

const zuStichwoertern = (text) =>
  (text || "")
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWOERTER.has(w));

// Zaehlt, wie viele (eindeutige) Stichwoerter aus dem Mailtext auch im
// Projekttitel bzw. der Kategorie vorkommen.
const berechneUebereinstimmung = (mailStichwoerter, projekt) => {
  if (mailStichwoerter.length === 0) return 0;
  const projektText = `${projekt.titel || ""} ${projekt.kategorie || ""}`;
  const projektStichwoerter = new Set(zuStichwoertern(projektText));
  let treffer = 0;
  for (const wort of new Set(mailStichwoerter)) {
    if (projektStichwoerter.has(wort)) treffer += 1;
  }
  return treffer;
};

const ProjektAuswahlDialog = ({ kunde, entryId, mailText, onClose, onPicked, onCreateNew }) => {
  useF1Help("hilfe_projekt_zuordnen");
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

  // Bestes Projekt ermitteln: Stichwort-Treffer zaehlt am meisten, bei
  // Gleichstand (auch bei 0 Treffern) gewinnt automatisch das neueste
  // Projekt, da die Liste bereits chronologisch (neuestes zuerst) sortiert ist.
  const { sortierteProjekte, bestId } = useMemo(() => {
    if (projekte.length === 0) return { sortierteProjekte: [], bestId: null };

    const mailStichwoerter = zuStichwoertern(mailText);
    const mitScore = projekte.map((p, index) => ({
      ...p,
      _score: berechneUebereinstimmung(mailStichwoerter, p),
      _index: index,
    }));

    const bestes = mitScore.reduce((a, b) => {
      if (b._score > a._score) return b;
      if (b._score === a._score && b._index < a._index) return b;
      return a;
    });

    // Bestes Projekt nach vorne, Rest bleibt chronologisch (neuestes zuerst)
    const rest = mitScore.filter((p) => p.id !== bestes.id);
    return { sortierteProjekte: [bestes, ...rest], bestId: bestes.id };
  }, [projekte, mailText]);

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

        {!loading && sortierteProjekte.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine bestehenden Projekte gefunden.</p>
        )}

        {!loading &&
          sortierteProjekte.map((p) => {
            const istBest = p.id === bestId && sortierteProjekte.length > 1;
            const istAusgewaehlt = selected === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                  istAusgewaehlt
                    ? "border-primary bg-primary/5"
                    : istBest
                    ? "border-green-500 bg-green-50 hover:bg-green-100"
                    : "hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">{p.titel || "(ohne Titel)"}</div>
                  {istBest && (
                    <span className="text-[11px] font-semibold text-green-700 bg-green-100 border border-green-300 rounded-full px-2 py-0.5">
                      bester Vorschlag
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Angelegt: {p.created_at ? new Date(p.created_at).toLocaleDateString("de-DE") : "-"}
                  {p.kategorie ? ` · Kategorie: ${p.kategorie}` : ""}
                </div>
              </div>
            );
          })}

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
