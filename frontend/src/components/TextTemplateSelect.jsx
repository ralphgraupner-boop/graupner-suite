import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

const PLACEHOLDERS = [
  { alias: "{anrede_brief}", desc: "Sehr geehrter Herr/Frau + Name" },
  { alias: "{kunde_name}", desc: "Kundenname" },
  { alias: "{kunde_adresse}", desc: "Kundenadresse" },
  { alias: "{kunde_email}", desc: "Kunden-E-Mail" },
  { alias: "{kunde_telefon}", desc: "Kundentelefon" },
  { alias: "{firma}", desc: "Firmenname" },
  { alias: "{datum}", desc: "Heutiges Datum" },
  { alias: "{dokument_nr}", desc: "Dokument-Nr." },
];

const getAnredeBrief = (customer) => {
  if (!customer) return "Sehr geehrte Damen und Herren";
  const anrede = customer.anrede || "";
  // Nachname extrahieren: letztes Wort des Namens (ohne Herr/Frau-Prefix)
  const fullName = customer.name || "";
  const cleanName = fullName.replace(/^(Herr|Frau|Divers)\s+/i, "").trim();
  const nameParts = cleanName.split(/\s+/);
  const nachname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : cleanName;

  if (anrede === "Herr" || fullName.startsWith("Herr ")) {
    return `Sehr geehrter Herr ${nachname}`;
  } else if (anrede === "Frau" || fullName.startsWith("Frau ")) {
    return `Sehr geehrte Frau ${nachname}`;
  } else {
    return `Sehr geehrte/r ${cleanName}`;
  }
};

const resolvePlaceholders = (text, customer, settings, docNumber) => {
  if (!text) return "";
  const now = new Date();
  return text
    .replace(/\{anrede_brief\}/g, getAnredeBrief(customer))
    .replace(/\{kunde_name\}/g, customer?.name || "")
    .replace(/\{kunde_adresse\}/g, customer?.address || "")
    .replace(/\{kunde_email\}/g, customer?.email || "")
    .replace(/\{kunde_telefon\}/g, customer?.phone || "")
    .replace(/\{firma\}/g, settings?.company_name || "")
    .replace(/\{datum\}/g, now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }))
    .replace(/\{dokument_nr\}/g, docNumber || "");
};

const TextTemplateSelect = ({ docType, textType, value, onChange, customer, settings, docNumber }) => {
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const textareaRef = useRef(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(56, el.scrollHeight) + "px";
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [docType, textType]);
  useEffect(() => { autoResize(); }, [value, autoResize]);

  const loadTemplates = async () => {
    try {
      const res = await api.get("/text-templates", { params: { doc_type: docType, text_type: textType } });
      setTemplates(res.data);
    } catch (err) {
      // silent
    }
  };

  const handleSelect = (template) => {
    const resolved = resolvePlaceholders(template.content, customer, settings, docNumber);
    onChange(resolved);
    setOpen(false);
  };

  const label = textType === "vortext" ? "Vortext" : "Schlusstext";

  return (
    <div data-testid={`template-select-${textType}-${docType}`}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">{label}</label>
        {templates.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              data-testid={`btn-template-dropdown-${textType}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-sm hover:bg-primary/5 transition-colors"
            >
              Textbaustein <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-sm shadow-lg min-w-[240px] max-h-48 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelect(t)}
                    data-testid={`template-option-${t.id}`}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                  >
                    <span className="font-medium">{t.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5 truncate">{t.content.substring(0, 60)}...</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <textarea
        ref={textareaRef}
        data-testid={`input-${textType}`}
        value={value || ""}
        onChange={(e) => { onChange(e.target.value); autoResize(); }}
        placeholder={`${label} eingeben oder aus Textbausteinen wählen...`}
        rows={2}
        className="flex w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden"
        style={{ minHeight: "56px" }}
      />
      {!value && (
        <div className="flex flex-wrap gap-1 mt-1">
          {PLACEHOLDERS.slice(0, 4).map((p) => (
            <span key={p.alias} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title={p.desc}>{p.alias}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export { TextTemplateSelect, resolvePlaceholders, PLACEHOLDERS };
