import { useState, useEffect } from "react";
import { X, Wrench, Calendar, User as UserIcon, Folder, HardHat, Link as LinkIcon, Copy, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Heutiges Datum YYYY-MM-DD (lokale Zeit / Hamburg)
const heute = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const kundeLabelOf = (k) =>
  k?.firma || [k?.vorname, k?.nachname].filter(Boolean).join(" ") || k?.name || k?.id || "";

/**
 * EinsatzModal — zentrales, kontextsensitives Planungs-Modal.
 *
 * Kern des künftigen Planungsmoduls (Phase 1: Einsatz + Mitarbeiter-Link).
 * Bewusst erweiterbar gebaut:
 *  - Kontext-Objekt statt Einzel-Props (neue Quellen ohne Signatur-Umbau)
 *  - Pipeline-Save: Phase 2 (Termin/Aufgabe) wird nur angehängt, kein Neubau
 *  - projekt_id als gemeinsame Klammer (Kunde → Projekt → Einsatz)
 *
 * context = {
 *   kundeId,                 // PFLICHT: Kunde aus dem Kontext
 *   projektId, projektTitel, // optionale Vorauswahl (z.B. aus Projekt-Werkbank)
 *   datum, uhrzeit,          // optional, sonst heute
 *   betreff, notizen         // optionaler Vorbelegungs-Text
 * }
 * Adresse, Kundenname und Kundentyp werden LIVE aus dem Kundenstamm geholt
 * (Datenmasken-Prinzip, kein Hardcode, keine Datendoppelung).
 */
export const EinsatzModal = ({ open, onClose, onSaved, context = {} }) => {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [projekte, setProjekte] = useState([]);
  const [kunde, setKunde] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);
  const [phase, setPhase] = useState("form"); // form | ask | link
  const [form, setForm] = useState({});

  const isHausverwaltung = (kunde?.customer_type || "").toLowerCase() === "hausverwaltung";

  useEffect(() => {
    if (!open || !context.kundeId) return;
    setCreatedLink(null);
    setPhase("form");
    setForm({
      typ: "einsatz",
      betreff: context.betreff || "",
      beschreibung: context.notizen || "",
      objekt_strasse: "",
      objekt_plz: "",
      objekt_ort: "",
      termin_datum: context.datum || heute(),
      termin_uhrzeit: context.uhrzeit || "",
      monteur_id: "",
      monteur_name: "",
      projekt_id: context.projektId || "",
      projekt_titel: context.projektTitel || "",
    });
    (async () => {
      setLoadingMeta(true);
      try {
        const [maRes, pRes, kRes] = await Promise.all([
          api.get("/mitarbeiter"),
          api.get("/module-projekte/", { params: { kunde_id: context.kundeId } }),
          api.get("/modules/kunden/data"),
        ]);
        setMitarbeiter((maRes.data || []).filter((m) => m.status === "aktiv"));
        const ps = pRes.data || [];
        setProjekte(ps);
        const k = (kRes.data || []).find((x) => x.id === context.kundeId) || null;
        setKunde(k);
        // Adresse live aus Kundenstamm (Objekt-Adresse hat Vorrang)
        setForm((f) => ({
          ...f,
          objekt_strasse: k?.objekt_strasse || k?.strasse || "",
          objekt_plz: k?.objekt_plz || k?.plz || "",
          objekt_ort: k?.objekt_ort || k?.ort || "",
        }));
        // Projekt-Vorauswahl: Einzelkunde → erstes/einziges Projekt automatisch
        const hv = (k?.customer_type || "").toLowerCase() === "hausverwaltung";
        if (!context.projektId && !hv && ps.length >= 1) {
          setForm((f) => ({ ...f, projekt_id: ps[0].id, projekt_titel: ps[0].titel || "" }));
        }
      } catch {
        toast.error("Mitarbeiter / Projekte / Kunde konnten nicht geladen werden");
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [open, context.kundeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const selectMonteur = (id) => {
    const m = mitarbeiter.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      monteur_id: id,
      monteur_name: m ? `${m.vorname || ""} ${m.nachname || ""}`.trim() : "",
    }));
  };

  const selectProjekt = (id) => {
    const p = projekte.find((x) => x.id === id);
    setForm((f) => ({ ...f, projekt_id: id, projekt_titel: p ? p.titel || "" : "" }));
  };

  // ===== Pipeline-Save (Phase 2 nur anhängen, kein Neubau) =====
  const erzeugeEinsatz = async () => {
    const payload = {
      kunde_id: context.kundeId,
      typ: form.typ,
      projekt_id: form.projekt_id,
      projekt_titel: form.projekt_titel,
      betreff: form.betreff || form.projekt_titel || "Einsatz",
      beschreibung: form.beschreibung,
      objekt_strasse: form.objekt_strasse,
      objekt_plz: form.objekt_plz,
      objekt_ort: form.objekt_ort,
      termin_datum: form.termin_datum,
      termin_uhrzeit: form.termin_uhrzeit,
      monteur_id: form.monteur_id,
      monteur_name: form.monteur_name,
    };
    const res = await api.post("/einsaetze", payload);
    return res.data;
  };

  const erzeugeMitarbeiterLink = async () => {
    try {
      const res = await api.post(`/module-kundenlink/create/${context.kundeId}`, {
        projekt_id: form.projekt_id || undefined,
        einsatz_text: form.beschreibung || undefined,
      });
      return res.data;
    } catch {
      return null; // Link ist optional — Einsatz bleibt gespeichert
    }
  };

  const handleSave = async () => {
    if (!context.kundeId) {
      toast.error("Kein Kunde im Kontext");
      return;
    }
    if (!form.projekt_id) {
      toast.error("Bitte ein Projekt zuordnen (Pflichtfeld)");
      return;
    }
    if (!form.typ) {
      toast.error("Bitte einen Typ wählen");
      return;
    }
    setSaving(true);
    try {
      await erzeugeEinsatz();
      // [Phase 2] hier anhängen: await erzeugeTermin(); await erzeugeAufgabe();
      onSaved?.();
      toast.success("Gespeichert");
      setPhase("ask");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLink = async () => {
    setSaving(true);
    try {
      const link = await erzeugeMitarbeiterLink();
      if (link?.token) {
        setCreatedLink(`${window.location.origin}/m/${link.token}`);
        setPhase("link");
      } else {
        toast.warning("Der Mitarbeiter-Link konnte nicht erzeugt werden.");
        onClose?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(createdLink);
    toast.success("Mitarbeiter-Link kopiert");
  };

  if (!open) return null;

  const keinProjektVorhanden = !loadingMeta && projekte.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="einsatz-modal">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-600" /> Neuer Einsatz
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-sm" data-testid="btn-einsatz-modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === "link" ? (
          // ===== Erfolgs-Ansicht: Mitarbeiter-Link =====
          <div className="p-4 space-y-4" data-testid="einsatz-link-result">
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <LinkIcon className="w-4 h-4" /> Mitarbeiter-Link (30 Tage gültig, kein Login)
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={createdLink}
                className="w-full border rounded-sm p-2 text-sm bg-muted/40"
                data-testid="einsatz-link-value"
              />
              <button
                onClick={copyLink}
                className="p-2 border rounded-sm hover:bg-muted flex-shrink-0"
                title="Link kopieren"
                data-testid="btn-einsatz-link-copy"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { onClose?.(); }}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
                data-testid="btn-einsatz-fertig"
              >
                Fertig
              </button>
            </div>
          </div>
        ) : phase === "ask" ? (
          // ===== Abfrage: Mitarbeiter-Link erstellen? =====
          <div className="p-4 space-y-4" data-testid="einsatz-ask-link">
            <p className="text-sm font-medium">Mitarbeiter-Link erstellen und senden?</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCreateLink}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                data-testid="btn-einsatz-link-ja"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ja — Link erstellen
              </button>
              <button
                onClick={() => onClose?.()}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm border rounded-sm hover:bg-muted disabled:opacity-50"
                data-testid="btn-einsatz-link-nein"
              >
                Nein — nur intern speichern
              </button>
            </div>
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm p-2" data-testid="einsatz-ask-hint">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Ohne Mitarbeiter-Link wird dieser Einsatz nur intern gespeichert und kann in der Planung nicht berücksichtigt werden.
            </div>
          </div>
        ) : (
          // ===== Formular =====
          <div className="p-4 space-y-3">
            {/* Typ — Pflichtfeld */}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">
                Typ <span className="text-red-600">*</span>
              </label>
              <select
                value={form.typ || "einsatz"}
                onChange={(e) => upd("typ", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="einsatz-field-typ"
              >
                <option value="einsatz">Einsatz (Vor-Ort)</option>
                <option value="aufgabe">Aufgabe (intern)</option>
                <option value="termin">Termin</option>
              </select>
            </div>

            {/* Kunde (read-only aus Kontext/Kundenstamm) */}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5" /> Kunde
              </label>
              <div className="border rounded-sm p-2 text-sm bg-muted/40" data-testid="einsatz-kunde-label">
                {loadingMeta ? "Lädt…" : (kundeLabelOf(kunde) || "(unbekannt)")}
                {kunde?.customer_type && (
                  <span className="ml-2 text-xs text-muted-foreground">· {kunde.customer_type}</span>
                )}
              </div>
            </div>

            {/* Projekt — Pflichtfeld */}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                <Folder className="w-3.5 h-3.5" /> Projekt <span className="text-red-600">*</span>
                {!isHausverwaltung && !keinProjektVorhanden && (
                  <span className="text-[11px] text-muted-foreground font-normal">(automatisch vorausgewählt)</span>
                )}
              </label>
              {keinProjektVorhanden ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm p-2" data-testid="einsatz-kein-projekt">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Kein Projekt vorhanden. Bitte zuerst ein Projekt für diesen Kunden anlegen — kein Einsatz ohne Projektzuordnung.
                </div>
              ) : (
                <select
                  value={form.projekt_id || ""}
                  onChange={(e) => selectProjekt(e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="einsatz-field-projekt"
                  disabled={!!context.projektId}
                >
                  <option value="">— Projekt wählen —</option>
                  {projekte.map((p) => (
                    <option key={p.id} value={p.id}>{p.titel || "(ohne Titel)"}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Datum + Uhrzeit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Datum
                </label>
                <input
                  type="date"
                  value={form.termin_datum || ""}
                  onChange={(e) => upd("termin_datum", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="einsatz-field-datum"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Uhrzeit</label>
                <input
                  type="time"
                  value={form.termin_uhrzeit || ""}
                  onChange={(e) => upd("termin_uhrzeit", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  data-testid="einsatz-field-uhrzeit"
                />
              </div>
            </div>

            {/* Mitarbeiter */}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                <HardHat className="w-3.5 h-3.5" /> Mitarbeiter
              </label>
              <select
                value={form.monteur_id || ""}
                onChange={(e) => selectMonteur(e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="einsatz-field-mitarbeiter"
              >
                <option value="">— niemand —</option>
                {mitarbeiter.map((m) => (
                  <option key={m.id} value={m.id}>{`${m.vorname || ""} ${m.nachname || ""}`.trim()}</option>
                ))}
              </select>
            </div>

            {/* Aufgaben / Notizen */}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Aufgaben / Notizen</label>
              <textarea
                value={form.beschreibung || ""}
                onChange={(e) => upd("beschreibung", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm min-h-[80px] resize-y"
                placeholder="Was ist vor Ort zu tun?"
                data-testid="einsatz-field-notizen"
              />
            </div>

            {/* Adresse (aus Kundenstamm, editierbar) */}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Adresse (aus Kundenstamm, editierbar)</label>
              <input
                value={form.objekt_strasse || ""}
                onChange={(e) => upd("objekt_strasse", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm mb-2"
                placeholder="Straße / Nr."
                data-testid="einsatz-field-strasse"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={form.objekt_plz || ""}
                  onChange={(e) => upd("objekt_plz", e.target.value)}
                  className="w-full border rounded-sm p-2 text-sm"
                  placeholder="PLZ"
                  data-testid="einsatz-field-plz"
                />
                <input
                  value={form.objekt_ort || ""}
                  onChange={(e) => upd("objekt_ort", e.target.value)}
                  className="col-span-2 w-full border rounded-sm p-2 text-sm"
                  placeholder="Ort"
                  data-testid="einsatz-field-ort"
                />
              </div>
            </div>
          </div>
        )}

        {phase === "form" && (
          <div className="p-4 border-t flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-sm hover:bg-muted" data-testid="btn-einsatz-abbrechen">
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loadingMeta || keinProjektVorhanden || !form.projekt_id}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
              data-testid="btn-einsatz-speichern"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern + Senden
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EinsatzModal;
