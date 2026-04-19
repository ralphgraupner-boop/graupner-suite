import { useHelp } from "@/lib/helpContext";
import { HelpCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

/**
 * HelpTip – zeigt einen Hilfetext als Tooltip beim Hover,
 * aber nur wenn der globale Hilfe-Modus aktiviert ist.
 *
 * Props:
 *   id          Schluessel aus /app/frontend/src/lib/helpTexts.js
 *   text        Direkter Text (alternativ zu id)
 *   placement   "top" | "bottom" | "left" | "right" (default: "top")
 *   asChild     Wenn true, kein zusaetzliches Wrapper-Element (default: false)
 *   showBadge   Kleines "?"-Icon anzeigen wenn Hilfe aktiv (default: false)
 */
export const HelpTip = ({ id, text, placement = "top", asChild = false, showBadge = false, block = false, children, className = "" }) => {
  const { enabled, getText } = useHelp();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const content = text || (id ? getText(id) : "");

  // Wenn Hilfe aus oder kein Text → Kinder direkt zurueckgeben
  if (!enabled || !content) {
    return <>{children}</>;
  }

  const posClass = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  }[placement] || "bottom-full mb-2 left-1/2 -translate-x-1/2";

  const Wrapper = block ? "div" : "span";
  const displayClass = block ? "block" : "inline-block";

  return (
    <Wrapper
      ref={wrapperRef}
      className={`relative ${displayClass} ${className} ring-2 ring-amber-300/70 rounded-sm`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {showBadge && (
        <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 pointer-events-none shadow-sm" aria-hidden="true">
          <HelpCircle className="w-3 h-3" />
        </span>
      )}
      {open && (
        <span
          role="tooltip"
          className={`absolute z-[9999] ${posClass} px-3 py-2 bg-slate-900 text-white text-xs rounded-sm shadow-lg max-w-xs whitespace-normal leading-relaxed pointer-events-none`}
          style={{ minWidth: "180px" }}
        >
          {content}
          <span
            className={`absolute w-2 h-2 bg-slate-900 rotate-45 ${
              placement === "top" ? "bottom-[-4px] left-1/2 -translate-x-1/2" :
              placement === "bottom" ? "top-[-4px] left-1/2 -translate-x-1/2" :
              placement === "left" ? "right-[-4px] top-1/2 -translate-y-1/2" :
              "left-[-4px] top-1/2 -translate-y-1/2"
            }`}
          />
        </span>
      )}
    </Wrapper>
  );
};

// Close tooltip when clicking outside (nice on touch devices)
if (typeof document !== "undefined") {
  document.addEventListener("touchstart", () => {}, { passive: true });
}
