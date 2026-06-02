import { Mail, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Zeigt eine Mailadresse als anklickbaren mailto-Link plus Kopier-Button.
 * - Klick auf die Adresse  → Default-Mailprogramm oeffnet mit leerer Mail
 * - Klick auf das 📋-Icon → Adresse in Zwischenablage, Toast-Bestaetigung
 *
 * Verwendung: <MailLink email={kunde.email} />
 * Mit Icon:   <MailLink email={kunde.email} showIcon />
 */
export const MailLink = ({ email, showIcon = false, className = "" }) => {
  const [copied, setCopied] = useState(false);
  const value = (email || "").trim();
  if (!value) return null;

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("E-Mail kopiert");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} data-testid="mail-link">
      {showIcon && <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      <a
        href={`mailto:${value}`}
        className="text-primary hover:underline truncate"
        onClick={(e) => e.stopPropagation()}
        data-testid="mail-link-mailto"
      >
        {value}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        title="E-Mail in Zwischenablage kopieren"
        data-testid="mail-link-copy"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
};

export default MailLink;
