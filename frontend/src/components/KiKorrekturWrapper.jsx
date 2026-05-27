import { useState } from "react";
import { Sparkles } from "lucide-react";
import { TextKorrekturModal } from "./wysiwyg/TextKorrekturModal";

/**
 * Wrappt ein Textfeld (Input/Textarea) und blendet rechts unten ein kleines
 * Sparkles-Icon ein, das die KI-Rechtschreibprüfung öffnet.
 *
 * Usage:
 *   <KiKorrekturWrapper value={text} onChange={setText} feldLabel="Betreff" kontext="betreff">
 *     <Input value={text} onChange={(e) => setText(e.target.value)} />
 *   </KiKorrekturWrapper>
 */
export const KiKorrekturWrapper = ({
  children,
  value,
  onChange,
  kontext = "allgemein",
  feldLabel = "Text",
  testId,
  className = "",
  iconPosition = "bottom-right", // "bottom-right" | "top-right"
}) => {
  const [open, setOpen] = useState(false);
  const isEmpty = !(value || "").trim();
  const posClass =
    iconPosition === "top-right"
      ? "top-1.5 right-1.5"
      : "bottom-1.5 right-1.5";

  return (
    <div className={`relative ${className}`}>
      {children}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isEmpty}
        className={`absolute ${posClass} p-1 rounded bg-background/90 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-input shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors z-10`}
        title={isEmpty ? "Text ist leer" : "Rechtschreibung und Grammatik mit KI prüfen"}
        data-testid={testId || "btn-ki-korrektur"}
      >
        <Sparkles className="w-3.5 h-3.5" />
      </button>
      <TextKorrekturModal
        isOpen={open}
        onClose={() => setOpen(false)}
        original={value || ""}
        kontext={kontext}
        feldLabel={feldLabel}
        onAccept={(newText) => onChange(newText)}
      />
    </div>
  );
};
