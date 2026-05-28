import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";

/**
 * Gruppierter Pill-Filter mit Dropdown (Desktop) / Bottom-Sheet (Mobile).
 *
 * Props:
 *   items: Array<{
 *     value: string,             // Filter-Wert
 *     label: string,             // Anzeige
 *     count: number,             // Anzahl-Badge
 *     dotClass?: string,         // optional: kleiner Farb-Dot
 *     children?: same shape[],   // wenn vorhanden → Gruppen-Pill mit Dropdown
 *     accentClass?: string,      // optional: spezielle Hintergrundklasse
 *   }>
 *   value: aktiver Filter-Wert
 *   onChange: (newValue) => void
 *   allLabel: "Alle" Pill links (optional, wenn gesetzt)
 *   allCount: Anzahl für "Alle"
 *   testIdPrefix: für data-testid
 */
export const GroupedFilterBar = ({ items, value, onChange, allLabel, allCount, testIdPrefix = "filter" }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {allLabel && (
        <FilterPill
          label={`${allLabel} (${allCount})`}
          active={!value}
          onClick={() => onChange("")}
          testId={`${testIdPrefix}-alle`}
        />
      )}
      {items.map((it) => {
        if (it.children && it.children.length > 0) {
          return (
            <GroupPill
              key={it.value}
              item={it}
              activeValue={value}
              onChange={onChange}
              testIdPrefix={testIdPrefix}
            />
          );
        }
        return (
          <FilterPill
            key={it.value}
            label={`${it.label} (${it.count || 0})`}
            active={value === it.value}
            dotClass={it.dotClass}
            accentClass={it.accentClass}
            onClick={() => onChange(value === it.value ? "" : it.value)}
            testId={`${testIdPrefix}-${it.value}`}
          />
        );
      })}
    </div>
  );
};

const FilterPill = ({ label, active, onClick, dotClass, accentClass, testId, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[36px] ${
      active
        ? (accentClass || "bg-primary text-primary-foreground") + " shadow-sm"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    }`}
    data-testid={testId}
  >
    {dotClass && <span className={`w-2 h-2 rounded-full ${active ? "bg-white" : dotClass}`} />}
    <span>{label}</span>
    {children}
  </button>
);

const GroupPill = ({ item, activeValue, onChange, testIdPrefix }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open, isMobile]);

  // ist eine der Untergruppen aktiv?
  const childValues = item.children.map((c) => c.value);
  const groupActive = activeValue === item.value || childValues.includes(activeValue);
  const totalCount = item.count != null
    ? item.count
    : item.children.reduce((s, c) => s + (c.count || 0), 0);
  const activeChild = item.children.find((c) => c.value === activeValue);

  const select = (val) => {
    onChange(activeValue === val ? "" : val);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[36px] ${
          groupActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
        data-testid={`${testIdPrefix}-group-${item.value}`}
      >
        {item.dotClass && <span className={`w-2 h-2 rounded-full ${groupActive ? "bg-white" : item.dotClass}`} />}
        <span>{activeChild ? `${item.label}: ${activeChild.label}` : item.label} ({totalCount})</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !isMobile && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-background border shadow-lg rounded-lg min-w-[200px] py-1" data-testid={`${testIdPrefix}-popover-${item.value}`}>
          <button
            onClick={() => select(item.value)}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center justify-between ${activeValue === item.value ? "bg-primary/10 text-primary font-medium" : ""}`}
          >
            <span>Alle {item.label}</span>
            <span className="text-xs text-muted-foreground">{totalCount}</span>
          </button>
          <div className="h-px bg-border my-1" />
          {item.children.map((c) => (
            <button
              key={c.value}
              onClick={() => select(c.value)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center justify-between ${activeValue === c.value ? "bg-primary/10 text-primary font-medium" : ""}`}
              data-testid={`${testIdPrefix}-${c.value}`}
            >
              <span className="flex items-center gap-1.5">
                {activeValue === c.value && <Check className="w-3.5 h-3.5" />}
                {c.label}
              </span>
              <span className="text-xs text-muted-foreground">{c.count || 0}</span>
            </button>
          ))}
        </div>
      )}

      {open && isMobile && (
        <div className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} data-testid={`${testIdPrefix}-sheet-${item.value}`}>
          <div className="bg-background border shadow-2xl w-full rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b">
              <h3 className="font-bold text-base">{item.label}</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-1 max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => select(item.value)}
                className={`w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between border-b ${activeValue === item.value ? "bg-primary/10 text-primary font-medium" : ""}`}
              >
                <span>Alle {item.label}</span>
                <span className="text-sm text-muted-foreground">{totalCount}</span>
              </button>
              {item.children.map((c) => (
                <button
                  key={c.value}
                  onClick={() => select(c.value)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between border-b last:border-b-0 ${activeValue === c.value ? "bg-primary/10 text-primary font-medium" : ""}`}
                  data-testid={`${testIdPrefix}-mobile-${c.value}`}
                >
                  <span className="flex items-center gap-2">
                    {activeValue === c.value && <Check className="w-4 h-4" />}
                    {c.label}
                  </span>
                  <span className="text-sm text-muted-foreground">{c.count || 0}</span>
                </button>
              ))}
            </div>
            <div className="pb-4" />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Hilfsfunktion: Baut die items-Struktur aus einer flachen Kategorienliste
 * mit parent_category aus module_textvorlagen.
 * categories: [{title, parent_category}]
 * counts: { [title]: number }
 */
export const buildGroupedItems = (categories, counts) => {
  const groups = new Map(); // parent_label → children
  const standalone = []; // ohne Eltern

  categories.forEach((cat) => {
    const parent = (cat.parent_category || "").trim();
    if (parent) {
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push({ value: cat.title, label: cat.title, count: counts[cat.title] || 0 });
    } else {
      standalone.push({ value: cat.title, label: cat.title, count: counts[cat.title] || 0 });
    }
  });

  // Gruppen-Pills zuerst, dann Einzel-Pills
  const result = [];
  for (const [parent, children] of groups.entries()) {
    result.push({
      value: `_group_${parent}`,
      label: parent,
      children,
      // Gesamtsumme aller Untergruppen
      count: children.reduce((s, c) => s + c.count, 0),
    });
  }
  result.push(...standalone);
  return result;
};
