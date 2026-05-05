import { useState } from "react";
import { Check, X, Loader2, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/common";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";

const STATUS_OPTIONS = ["Anfrage", "Angebot", "Auftrag", "Erledigt", "Verloren"];
const CUSTOMER_TYPES = ["Privat", "Geschäftlich", "Hausverwaltung", "Architekt", "Gewerbe"];

/**
 * MailAcceptModal
 * Öffnet sich beim Klick auf "Als Kunde übernehmen" einer Mail-Anfrage.
 * Zeigt vorausgefüllte Felder, erlaubt Korrekturen + Bemerkung,
 * speichert und navigiert wahlweise zum neuen Kunden oder zurück zur Mail-Liste.
 */
const MailAcceptModal = ({ entry, onClose, onAccepted }) => {
  const navigate = useNavigate();
  const parsed = entry?.parsed || {};

  const [form, setForm] = useState({
    anrede: parsed.anrede || "",
    vorname: parsed.vorname || "",
    nachname: parsed.nachname || "",
    email: parsed.email || entry?.reply_to || "",
    phone: parsed.telefon || "",
    strasse: parsed.strasse || "",
    plz: parsed.plz || "",
    ort: parsed.ort || "",
    kontakt_status: "Anfrage",
    customer_type: "Privat",
    anliegen: parsed.nachricht || "",
    bemerkung: "",
    categories: [],
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const toggleCat = (cat) => {
    setForm((p) => ({
      ...p,
      categories: p.categories.includes(cat)
        ? p.categories.filter((c) => c !== cat)
        : [...p.categories, cat],
    }));
  };

  const submit = async (gotoKunde) => {
    if (!form.vorname.trim() && !form.nachname.trim()) {
      toast.error("Bitte mindestens Vor- oder Nachname ausfüllen");
      return;
    }
    setSaving(true);
    try {
      const r = await api.post(`/module-mail-inbox/accept/${entry.id}`, form);
      toast.success(`Kunde „${r.data.kunde_name}" angelegt`);
      onAccepted?.(r.data);
      try { window.dispatchEvent(new CustomEvent("graupner:data-changed")); } catch { /* noop */ }
      if (gotoKunde && r.data.kunde_id) {
        navigate(`/module/kunden#${r.data.kunde_id}`);
      } else {
        onClose?.();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Übernahme fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!entry} onClose={onClose} title="Anfrage als Kunde übernehmen" size="xl">
      <div className="space-y-4 text-sm" data-testid="mail-accept-modal">
        {/* Original-Mail Hinweis */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-900">
          <div className="font-medium">Original-Mail</div>
          <div className="text-[11px] mt-0.5 break-words">
            {entry?.subject} · von {entry?.from_email}
            {entry?.received_at && <> · {new Date(entry.received_at).toLocaleString("de-DE")}</>}
          </div>
        </div>

        {/* Persönliche Daten */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1">Anrede</label>
            <select
              value={form.anrede}
              onChange={(e) => set("anrede", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm bg-background"
              data-testid="select-accept-anrede"
            >
              <option value="">–</option>
              <option>Herr</option>
              <option>Frau</option>
              <option>Divers</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Vorname</label>
            <input
              value={form.vorname}
              onChange={(e) => set("vorname", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="input-accept-vorname"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nachname</label>
            <input
              value={form.nachname}
              onChange={(e) => set("nachname", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="input-accept-nachname"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1">E-Mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="input-accept-email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Telefon</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="input-accept-phone"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Straße / Hausnr.</label>
            <input
              value={form.strasse}
              onChange={(e) => set("strasse", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm"
              data-testid="input-accept-strasse"
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="block text-xs font-medium mb-1">PLZ</label>
              <input
                value={form.plz}
                onChange={(e) => set("plz", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="input-accept-plz"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Ort</label>
              <input
                value={form.ort}
                onChange={(e) => set("ort", e.target.value)}
                className="w-full border rounded-sm p-2 text-sm"
                data-testid="input-accept-ort"
              />
            </div>
          </div>
        </div>

        {/* Klassifizierung */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1">Kontakt-Status</label>
            <select
              value={form.kontakt_status}
              onChange={(e) => set("kontakt_status", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm bg-background"
              data-testid="select-accept-status"
            >
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Kunden-Typ</label>
            <select
              value={form.customer_type}
              onChange={(e) => set("customer_type", e.target.value)}
              className="w-full border rounded-sm p-2 text-sm bg-background"
              data-testid="select-accept-type"
            >
              {CUSTOMER_TYPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Kategorien (Mehrfach-Auswahl) */}
        {CATEGORIES && CATEGORIES.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">Kategorien (Auswahl)</label>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className={`px-2.5 py-1 text-xs rounded-full border ${form.categories.includes(cat) ? "bg-primary text-primary-foreground border-transparent" : "bg-background text-muted-foreground hover:bg-accent"}`}
                  data-testid={`btn-cat-${cat}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anliegen + Bemerkung */}
        <div>
          <label className="block text-xs font-medium mb-1">Anliegen (aus Mail)</label>
          <textarea
            value={form.anliegen}
            onChange={(e) => set("anliegen", e.target.value)}
            rows={3}
            className="w-full border rounded-sm p-2 text-sm"
            data-testid="textarea-accept-anliegen"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Bemerkung <span className="text-muted-foreground font-normal">(deine Notiz für später)</span>
          </label>
          <textarea
            value={form.bemerkung}
            onChange={(e) => set("bemerkung", e.target.value)}
            rows={2}
            placeholder="z.B. „Architekt mit 6000 WE in HH – persönlich anrufen"
            className="w-full border rounded-sm p-2 text-sm"
            data-testid="textarea-accept-bemerkung"
          />
        </div>

        {/* Aktionen */}
        <div className="flex justify-between gap-2 flex-wrap pt-2 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-sm hover:bg-muted"
            disabled={saving}
            data-testid="btn-accept-cancel"
          >
            Abbrechen
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => submit(false)}
              disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1"
              data-testid="btn-accept-back-to-mails"
              title="Speichern und zurück zu Mail-Anfragen"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Speichern · zurück zu Mails
            </button>
            <button
              onClick={() => submit(true)}
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
              data-testid="btn-accept-goto-kunde"
              title="Speichern und direkt zum neuen Kunden"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Speichern · zum Kunden
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MailAcceptModal;
