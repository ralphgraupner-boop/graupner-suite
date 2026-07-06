import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Check, X, ArrowRight, Loader2, Send, FileText, CalendarPlus, Folder } from "lucide-react";
import { Button, Input, Textarea, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { openInPopup } from "@/lib/windowSync";
import NewProjektDialog from "@/components/NewProjektDialog";
import ProjektAuswahlDialog from "@/components/ProjektAuswahlDialog";

const STEP_TITLES = {
  1: "Schritt 1/4 · Mail prüfen",
  2: "Schritt 2/4 · Kundendaten prüfen",
  3: "Schritt 3/4 · Projekt anlegen",
  4: "Schritt 4/4 · Nächste Aktion",
};

// Vorbefüllung aus den geparsten Mail-Daten (entry.parsed)
const prefillFrom = (parsed = {}) => ({
  anrede: parsed.anrede || "",
  vorname: parsed.vorname || "",
  nachname: parsed.nachname || "",
  firma: parsed.firma || "",
  email: parsed.email || "",
  phone: parsed.telefon || parsed.phone || "",
  strasse: parsed.strasse || "",
  hausnummer: parsed.hausnummer || "",
  plz: parsed.plz || "",
  ort: parsed.ort || "",
  customer_type: "Privat",
  status: "Neu",
  categories: "",
  notes: "",
  nachricht: parsed.nachricht || "",
});

/**
 * Geführter 4-Schritt-Workflow nach „Übernehmen" einer Mail-Anfrage.
 * Nutzt ausschliesslich vorhandene Endpoints:
 *  - POST /module-mail-inbox/accept/{id}      (Kunde anlegen)
 *  - POST /module-mail-inbox/reject/{id}      (ablehnen)
 *  - PUT  /modules/kunden/data/{id}           (bearbeitete Daten speichern)
 */
const MailAnfrageUebernehmenModal = ({ entry, onClose, onDone }) => {
  const navigate = useNavigate();
  const parsed = entry?.parsed || {};
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => prefillFrom(parsed));
  const [busy, setBusy] = useState(false);
  const [kunde, setKunde] = useState(null);
  const [projektId, setProjektId] = useState(null);
  const [showNewProjekt, setShowNewProjekt] = useState(false);
  const [dupError, setDupError] = useState(false);
  const [dupKunden, setDupKunden] = useState([]);
  const zuordnenZuBestehendem = async (kundeId) => {
    setBusy(true);
    try {
      const r = await api.post(`/module-mail-inbox/accept-link/${entry.id}`, {
kunde_id: kundeId,
        append_nachricht: true,
      });
      setKunde({ id: r.data.kunde_id, name: r.data.kunde_name });
      toast.success(`Anfrage zu „${r.data.kunde_name}“ hinzugefuegt`);
      setStep(3);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Zuordnen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const reject = async () => {
    setBusy(true);
    try {
      await api.post(`/module-mail-inbox/reject/${entry.id}`);
      toast.success("Anfrage abgelehnt");
      onDone?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Ablehnen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const anlegen = async (forceNew = false) => {
    setBusy(true);
    setDupError(false);
    try {
      const r = await api.post(
        `/module-mail-inbox/accept/${entry.id}`,
        forceNew ? { force_new: true } : {},
      );
      const kundeId = r.data.kunde_id;
      // Bearbeitete Daten direkt speichern (vorhandener Endpoint, kein Backend-Eingriff)
      const payload = {
        anrede: form.anrede,
        vorname: form.vorname,
        nachname: form.nachname,
        firma: form.firma,
        email: form.email,
        phone: form.phone,
        strasse: form.strasse,
        hausnummer: form.hausnummer,
        plz: form.plz,
        ort: form.ort,
        customer_type: form.customer_type,
        status: form.status,
        notes: form.notes,
        nachricht: form.nachricht,
        categories: form.categories.split(",").map((s) => s.trim()).filter(Boolean),
      };
      await api.put(`/modules/kunden/data/${kundeId}`, payload);
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ }
      const displayName = `${form.vorname} ${form.nachname}`.trim() || form.firma || r.data.kunde_name;
      setKunde({ id: kundeId, name: displayName, ...payload });
      toast.success(`Kunde „${displayName}" angelegt`);
      setStep(3);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 409 && detail && detail.code === "duplicate_kunde") {
        setDupError(true);
        setDupKunden(detail.duplicates || []);
        toast.error("Möglicher Doppel-Kunde — du kannst trotzdem neu anlegen.");
      } else {
        toast.error(typeof detail === "string" ? detail : "Anlegen fehlgeschlagen");
      }
    } finally {
      setBusy(false);
    }
  };

  const finish = (to) => {
    onDone?.();
    onClose?.();
    if (to) navigate(to);
  };

  // Schritt 3a: Bestehendes Projekt auswaehlen
  if (step === 3 && kunde && !showNewProjekt) {
    return (
      <ProjektAuswahlDialog
        kunde={kunde}
        entryId={entry.id}
        mailText={`${parsed.nachricht || ""} ${entry?.subject || ""}`}
        onClose={() => setStep(4)}
        onPicked={(gewaehltProjektId) => { setProjektId(gewaehltProjektId); setStep(4); }}
        onCreateNew={() => setShowNewProjekt(true)}
      />
    );
  }

  // Schritt 3b: Neues Projekt anlegen (und mit Mail verknuepfen)
  if (step === 3 && kunde && showNewProjekt) {
    return (
      <NewProjektDialog
        kundeId={kunde.id}
        kunde={kunde}
        onClose={() => setStep(4)}
        onCreated={async (p) => {
          const neueProjektId = p?.id || null;
          setProjektId(neueProjektId);
          if (neueProjektId) {
            try {
              await api.patch(`/module-mail-inbox/${entry.id}/projekt`, { projekt_id: neueProjektId });
            } catch (e) {
              // Verknuepfung fehlgeschlagen - Projekt wurde trotzdem angelegt
            }
          }
          setStep(4);
        }}
      />
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={STEP_TITLES[step]} size="lg">
      <div className="flex items-center gap-1 mb-4" data-testid="uebernehmen-stepper">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4" data-testid="uebernehmen-step1">
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground">{entry.received_at ? new Date(entry.received_at).toLocaleString("de-DE") : ""}</p>
            <h3 className="font-semibold mt-1 flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> {entry.subject || "(kein Betreff)"}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Von: {[parsed.vorname, parsed.nachname].filter(Boolean).join(" ") || entry.from_name || "(unbekannt)"}
              {parsed.email ? ` · ${parsed.email}` : ""}
            </p>
          </div>
          <div className="rounded-lg border p-4 max-h-64 overflow-auto whitespace-pre-line text-sm" data-testid="uebernehmen-mailtext">
            {parsed.nachricht || "(Kein Nachrichtentext erkannt.)"}
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={reject} disabled={busy} data-testid="uebernehmen-ablehnen"><X className="w-4 h-4" /> Ablehnen</Button>
            <Button onClick={() => setStep(2)} data-testid="uebernehmen-annehmen">Annehmen <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4" data-testid="uebernehmen-step2">
          {/* Kopfzeile: Anrede + Typ + Status + Firma kompakt */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Anrede</label>
              <select className="w-full h-9 rounded-sm border border-input bg-background px-2 text-sm" value={form.anrede} onChange={(e) => set("anrede", e.target.value)} data-testid="f-anrede">
                <option value="">—</option>
                <option>Herr</option>
                <option>Frau</option>
                <option>Divers</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Typ</label>
              <select className="w-full h-9 rounded-sm border border-input bg-background px-2 text-sm" value={form.customer_type} onChange={(e) => set("customer_type", e.target.value)} data-testid="f-type">
                <option>Privat</option>
                <option>Gewerbe</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Status</label>
              <select className="w-full h-9 rounded-sm border border-input bg-background px-2 text-sm" value={form.status} onChange={(e) => set("status", e.target.value)} data-testid="f-status">
                <option>Neu</option>
                <option>Anfrage</option>
                <option>Aktiv</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Firma</label>
              <Input className="h-9 text-sm" placeholder="optional" value={form.firma} onChange={(e) => set("firma", e.target.value)} data-testid="f-firma" />
            </div>
          </div>

          {/* Vorname + Nachname */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Vorname</label>
              <Input className="h-9 text-sm" value={form.vorname} onChange={(e) => set("vorname", e.target.value)} data-testid="f-vorname" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Nachname</label>
              <Input className="h-9 text-sm" value={form.nachname} onChange={(e) => set("nachname", e.target.value)} data-testid="f-nachname" />
            </div>
          </div>

          {/* Straße + Nr. */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Straße</label>
              <Input className="h-9 text-sm" value={form.strasse} onChange={(e) => set("strasse", e.target.value)} data-testid="f-strasse" />
            </div>
            <div className="col-span-3">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Nr.</label>
              <Input className="h-9 text-sm" value={form.hausnummer} onChange={(e) => set("hausnummer", e.target.value)} data-testid="f-hausnummer" />
            </div>
          </div>

          {/* PLZ (schmal, max 5) + Ort */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">PLZ</label>
              <Input className="h-9 text-sm" maxLength={5} value={form.plz} onChange={(e) => set("plz", e.target.value.replace(/\D/g, "").slice(0, 5))} data-testid="f-plz" />
            </div>
            <div className="col-span-9">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Ort</label>
              <Input className="h-9 text-sm" value={form.ort} onChange={(e) => set("ort", e.target.value)} data-testid="f-ort" />
            </div>
          </div>

          {/* Telefon + E-Mail */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Telefon</label>
              <Input className="h-9 text-sm" value={form.phone} onChange={(e) => set("phone", e.target.value)} data-testid="f-phone" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">E-Mail</label>
              <Input className="h-9 text-sm" value={form.email} onChange={(e) => set("email", e.target.value)} data-testid="f-email" />
            </div>
          </div>

          {/* Kategorien */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Kategorien</label>
            <Input className="h-9 text-sm" placeholder="Komma-getrennt" value={form.categories} onChange={(e) => set("categories", e.target.value)} data-testid="f-categories" />
          </div>

          {/* Notizen + Nachricht */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Notizen</label>
              <Textarea className="text-sm" placeholder="Interne Notizen" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} data-testid="f-notes" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Nachricht (aus Anfrage)</label>
              <Textarea className="text-sm" rows={3} value={form.nachricht} onChange={(e) => set("nachricht", e.target.value)} data-testid="f-nachricht" />
            </div>
          </div>
          {dupError && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-sm p-2" data-testid="uebernehmen-dup">
              Möglicher Doppel-Kunde erkannt. {`„Trotzdem neu anlegen"`} überspringt die Prüfung.
            </div>
          )}
          {dupError && dupKunden.length > 0 && (
          <>
            <p className="text-sm font-semibold text-green-700 mt-1 flex items-center gap-1">
                <span>⚠️</span> Kunde schon vorhanden – bitte Text anhängen
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
              {dupKunden.map((d) => (
                <>
                <Button
                  key={d.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openInPopup(`/popup/kunde/${d.id}`)}
                  data-testid={`dup-open-${d.id}`}
                >
                  {d.name || d.email || "Kunde"} in neuem Fenster oeffnen
                </Button>
                <Button
                  key={`link-${d.id}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!bg-green-600 !text-white !border-green-700 hover:!bg-green-700 animate-pulse font-semibold"
                  onClick={() => zuordnenZuBestehendem(d.id)}
                  disabled={busy}
                  data-testid={`dup-link-${d.id}`}
                >
                  Diesem Kunden zuordnen (Nachricht anhaengen)
                </Button>
              </>
              ))}
            </div>
          </>
          )}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>Zurück</Button>
            <div className="flex gap-2">
              {dupError && (
                <Button variant="outline" onClick={() => anlegen(true)} disabled={busy} data-testid="uebernehmen-force">Trotzdem neu anlegen</Button>
              )}
              <Button onClick={() => anlegen(false)} disabled={busy} data-testid="uebernehmen-bestaetigen">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Bestätigen & Anlegen
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && kunde && (
        <div className="space-y-4" data-testid="uebernehmen-step4">
          <p className="text-sm text-muted-foreground">
            Kunde <span className="font-semibold text-foreground">{kunde.name}</span> ist angelegt. Wie möchtest du weitermachen?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col"
              onClick={() => { if (kunde.email) window.location.href = `mailto:${kunde.email}`; finish(null); }}
              data-testid="aktion-email"
            >
              <Send className="w-5 h-5" /> E-Mail senden
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => finish(`/quotes/new?customer=${kunde.id}`)} data-testid="aktion-angebot">
              <FileText className="w-5 h-5" /> Angebot erstellen
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => finish(`/module/termine?kunde_id=${kunde.id}`)} data-testid="aktion-termin">
              <CalendarPlus className="w-5 h-5" /> Termin
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col"
              onClick={() => finish(projektId ? `/module/projekte/werkbank/${projektId}` : `/module/kunden?edit=${kunde.id}`)}
              data-testid="aktion-werkbank"
            >
              <Folder className="w-5 h-5" /> Zur Werkbank
            </Button>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => finish(null)} data-testid="uebernehmen-fertig">Fertig</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default MailAnfrageUebernehmenModal;
