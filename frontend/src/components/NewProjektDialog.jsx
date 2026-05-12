import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Modal } from "@/components/common";
import { api } from "@/lib/api";
import TitleInputWithVorlagen from "@/components/TitleInputWithVorlagen";

/**
 * Lädt Auswahl-Titel aus module_textvorlagen (live, keine Hardcoding-Listen).
 * Liefert das Roh-Array mit {id, title, content, keywords, ...}.
 */
export const useTextvorlagen = (docType) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/modules/textvorlagen/data?doc_type=${encodeURIComponent(docType)}`);
        if (alive) setItems(Array.isArray(r.data) ? r.data : []);
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => { alive = false; };
  }, [docType]);
  return items;
};

/**
 * NewProjektDialog – wiederverwendbar.
 *
 * Props:
 *   kundeId          → Pflicht
 *   kunde            → Kunden-Datenmaske (für Pre-fill aus Adresse, nachricht, photos)
 *   isFirstProjekt   → boolean (steuert Bilder-Übernahme-Default)
 *   onClose()        → Dialog schließen
 *   onCreated(p)     → callback nach erfolgreicher Anlage; bekommt das angelegte Projekt
 *
 * Wird sowohl aus der Werkbank als auch aus der Kunden-Karte aufgerufen.
 */
const NewProjektDialog = ({ kundeId, kunde, isFirstProjekt = true, onClose, onCreated }) => {
  const kategorieVorlagen = useTextvorlagen("projekt_kategorie");
  const titelVorlagen = useTextvorlagen("projekt_titel");
  const kategorieList = kategorieVorlagen.map(k => k.title).filter(Boolean);
  const titelList = titelVorlagen.map(t => t.title).filter(Boolean);

  const adresseFromKunde = (() => {
    if (kunde?.address) return kunde.address;
    const parts = [`${kunde?.strasse || ""} ${kunde?.hausnummer || ""}`.trim(),
                   `${kunde?.plz || ""} ${kunde?.ort || ""}`.trim()].filter(Boolean);
    return parts.join(", ");
  })();
  const hasKundenPhotos = (kunde?.photos || []).length > 0;

  const [titel, setTitel] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [adresse, setAdresse] = useState(adresseFromKunde);
  const [beschreibung, setBeschreibung] = useState((kunde?.nachricht || "").trim());
  const [bilderUebernehmen, setBilderUebernehmen] = useState(isFirstProjekt && hasKundenPhotos);
  const [match, setMatch] = useState(null);
  const [titelMatch, setTitelMatch] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!kategorie && kategorieList.length > 0) {
      setKategorie(kategorieList.includes("Sonstiges") ? "Sonstiges" : kategorieList[0]);
    }
  }, [kategorieList, kategorie]);

  useEffect(() => {
    const text = (kunde?.nachricht || "").trim();
    if (!text) return;
    let alive = true;
    (async () => {
      try {
        const [katR, titR] = await Promise.all([
          api.post("/modules/textvorlagen/match", { text, doc_type: "projekt_kategorie" }),
          api.post("/modules/textvorlagen/match", { text, doc_type: "projekt_titel" }).catch(() => null),
        ]);
        if (!alive) return;
        setMatch(katR.data || null);
        const best = katR.data?.best;
        if (best?.title) {
          setKategorie(best.title);
          if (!titel && best.content) setTitel(best.content);
        }
        const titBest = titR?.data?.best;
        if (titR?.data) setTitelMatch(titR.data);
        if (titBest?.title && !titel) setTitel(titBest.title);
      } catch {
        if (alive) setMatch(null);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunde?.nachricht]);

  const learnTitelIfNew = async (rawTitel) => {
    const t = (rawTitel || "").trim();
    if (t.length < 3) return null;
    const exists = titelList.some(x => x.toLowerCase() === t.toLowerCase());
    if (exists) return null;
    try {
      const r = await api.post("/modules/textvorlagen/data", {
        title: t, content: "", doc_type: "projekt_titel", text_type: "titel", keywords: [],
      });
      return r.data?.id || null;
    } catch {
      return null;
    }
  };

  const submit = async () => {
    if (!titel.trim()) return toast.error("Bitte Titel angeben");
    setSaving(true);
    try {
      const r = await api.post("/module-projekte/", {
        kunde_id: kundeId,
        titel: titel.trim(),
        beschreibung,
        kategorie,
        adresse,
        bilder_uebernehmen: bilderUebernehmen,
      });
      const bilderHinweis = r.data?.bilder?.length ? ` (${r.data.bilder.length} Bild(er) übernommen)` : "";
      const newTitelVorlageId = await learnTitelIfNew(titel);
      if (newTitelVorlageId) {
        toast.success(`Projekt angelegt${bilderHinweis} · Titel zur Vorlagenliste hinzugefügt`, {
          duration: 5000,
          action: {
            label: "Rückgängig",
            onClick: async () => {
              try {
                await api.delete(`/modules/textvorlagen/data/${newTitelVorlageId}`);
                toast.success("Titel-Vorlage wieder entfernt");
              } catch {
                toast.error("Konnte Titel-Vorlage nicht entfernen");
              }
            },
          },
        });
      } else {
        toast.success(`Projekt angelegt${bilderHinweis}`);
      }
      onCreated?.(r.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const kundeName = kunde?.name || `${kunde?.vorname || ""} ${kunde?.nachname || ""}`.trim() || "Kunde";

  return (
    <Modal isOpen={true} onClose={onClose} title={`Neues Projekt für ${kundeName}`} size="md">
      <div className="p-4 space-y-3">
        {match?.best && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm" data-testid="match-suggestion">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-emerald-900">
                  Vorschlag: <span className="font-semibold">{match.best.title}</span>
                  <span className="ml-2 text-xs text-emerald-700">({match.best.hits} Treffer)</span>
                </div>
                <div className="text-xs text-emerald-800 mt-0.5">
                  Erkannte Begriffe: {(match.best.matched_terms || []).map(t => `„${t}"`).join(", ")}
                </div>
              </div>
            </div>
          </div>
        )}
        {match?.tied && (match.candidates || []).length >= 2 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs" data-testid="match-tied">
            <div className="font-medium text-amber-900 mb-1">Mehrere Kategorien passen gleich gut:</div>
            <div className="flex flex-wrap gap-2">
              {match.candidates.slice(0, 3).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setKategorie(c.title); if (!titel && c.content) setTitel(c.content); }}
                  className="px-2 py-1 border border-amber-300 rounded bg-white hover:bg-amber-100"
                  data-testid={`btn-pick-cat-${c.id}`}
                >
                  {c.title} <span className="text-amber-700">({c.hits})</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {titelMatch?.best && (
          <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm" data-testid="match-titel-suggestion">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-sky-700 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sky-900">
                  Vorschlag Titel: <span className="font-semibold">{titelMatch.best.title}</span>
                  <button
                    onClick={() => setTitel(titelMatch.best.title)}
                    className="ml-2 text-xs underline text-sky-700 hover:text-sky-900"
                    data-testid="btn-pick-titel"
                  >
                    übernehmen
                  </button>
                </div>
                <div className="text-xs text-sky-800 mt-0.5">
                  Erkannte Begriffe: {(titelMatch.best.matched_terms || []).map(t => `„${t}"`).join(", ")}
                </div>
              </div>
            </div>
          </div>
        )}

        <TitleInputWithVorlagen
          value={titel}
          onChange={setTitel}
          docType="projekt_titel"
          label="Titel"
          required
          placeholder="z.B. Schiebetür Terrasse"
          testId="input-projekt-titel"
        />
        <div>
          <label className="text-sm font-medium block mb-1">Kategorie</label>
          <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} className="w-full border rounded px-2 py-2 text-sm" data-testid="select-projekt-kategorie">
            {kategorieList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Adresse (überschreibt Kunde)</label>
          <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} data-testid="input-projekt-adresse" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Beschreibung / Anliegen</label>
          <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={4} data-testid="textarea-projekt-beschreibung" />
          <div className="text-[11px] text-muted-foreground mt-1">Vorausgefüllt aus Kundendaten – kann angepasst werden.</div>
        </div>
        {hasKundenPhotos && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={bilderUebernehmen}
              onChange={(e) => setBilderUebernehmen(e.target.checked)}
              data-testid="checkbox-bilder-uebernehmen"
            />
            <span>Bilder vom Kunden ins Projekt übernehmen ({(kunde?.photos || []).length})
              {!isFirstProjekt && <span className="text-amber-700 ml-1">— nur beim ersten Projekt möglich</span>}
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving} data-testid="btn-projekt-anlegen">{saving ? "Speichere…" : "Anlegen"}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default NewProjektDialog;
export { NewProjektDialog };
