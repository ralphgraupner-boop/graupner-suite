import { useState, useEffect, useMemo, useRef } from "react";
import { Lightbulb, Settings } from "lucide-react";
import { api } from "@/lib/api";
import TextvorlagenInlineManager from "@/components/TextvorlagenInlineManager";

/**
 * TitleInputWithVorlagen
 *
 * Eingabefeld für Titel/Betreff mit Live-Vorschlägen aus `module_textvorlagen`.
 * Datenmasken-konform: zieht Vorschläge per docType, ohne diese im Ziel-Datensatz zu duplizieren.
 *
 * Props:
 *   value, onChange  — kontrollierter Input
 *   docType          — z. B. "projekt_titel", "aufgabe_titel", "termin_titel", "einsatz_betreff"
 *   fallbackDocTypes — optional, z.B. ["aufgabe"] um Legacy-Vorlagen mitzuladen
 *   placeholder      — optional
 *   label            — optional, Label oberhalb des Inputs
 *   showManager      — default true: Zahnrad-Icon zum Inline-Pflegen
 *   testId           — optional, data-testid des Inputs
 *   required         — optional, Pflichtfeld
 *   autoFocus        — optional
 */
export default function TitleInputWithVorlagen({
  value,
  onChange,
  docType,
  fallbackDocTypes = [],
  placeholder = "Titel eingeben oder aus Vorschlägen wählen …",
  label = "Titel",
  showManager = true,
  testId = "input-titel",
  required = false,
  autoFocus = false,
}) {
  const [vorlagen, setVorlagen] = useState([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const load = async () => {
    try {
      const allTypes = [docType, ...fallbackDocTypes].filter(Boolean);
      const results = await Promise.all(
        allTypes.map(dt => api.get(`/modules/textvorlagen/data?doc_type=${encodeURIComponent(dt)}`).catch(() => ({ data: [] })))
      );
      // Merge + dedupe nach title (case-insensitive trim)
      const seen = new Set();
      const merged = [];
      results.forEach((r, idx) => {
        (Array.isArray(r.data) ? r.data : []).forEach(v => {
          const key = (v.title || "").trim().toLowerCase();
          if (!key || seen.has(key)) return;
          seen.add(key);
          merged.push({ ...v, _source_doc_type: allTypes[idx] });
        });
      });
      // Sort alphabetisch
      merged.sort((a, b) => (a.title || "").localeCompare(b.title || "", "de"));
      setVorlagen(merged);
    } catch {
      setVorlagen([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [docType, fallbackDocTypes.join("|")]);

  const suggestions = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    if (q.length < 1) return vorlagen.slice(0, 8);
    return vorlagen
      .filter(v => (v.title || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, vorlagen]);

  const showDropdown = focused && suggestions.length > 0;

  return (
    <div className="relative">
      {label && (
        <label className="flex items-center justify-between text-sm font-medium mb-1">
          <span>{label}{required && <span className="text-red-600 ml-0.5">*</span>}</span>
          {showManager && (
            <TextvorlagenInlineManager
              docType={docType}
              label={`${label} - Vorlagen`}
              onChanged={load}
            />
          )}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          className="w-full border rounded-sm p-2 text-sm"
          data-testid={testId}
          required={required}
          autoFocus={autoFocus}
        />
        {showDropdown && (
          <div
            className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-30 max-h-72 overflow-auto"
            data-testid={`${testId}-suggestions`}
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Vorschläge aus Textvorlagen ({suggestions.length})
            </div>
            {suggestions.map(s => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.title || "");
                  inputRef.current?.blur();
                }}
                className="w-full text-left text-sm px-3 py-2 hover:bg-muted border-b last:border-b-0"
                data-testid={`${testId}-suggestion-${s.id}`}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
