import { Circle } from "lucide-react";

/**
 * PortalStatusBadge — kleiner farbiger Status-Badge für das Kundenportal.
 *
 * Wiederverwendbar in Kunden-/Projektliste (Einbindung erst in Auftrag 3).
 *
 * Props:
 *   status: null | "link_erstellt" | "geoeffnet" | "genutzt"
 *   showLabel?: boolean (default true) — Text neben dem Punkt anzeigen
 *
 * Farben:
 *   ⚪ Grau  = kein Portal-Link erstellt (status null/leer)
 *   🔵 Blau  = link_erstellt (verschickt, noch nicht geöffnet)
 *   🟡 Gelb  = geoeffnet (geöffnet, noch nicht genutzt)
 *   🟢 Grün  = genutzt (Nachricht/Fotos eingegangen)
 */
const PORTAL_STATUS = {
  link_erstellt: { label: "Link verschickt", dot: "text-blue-500", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  geoeffnet: { label: "Portal geöffnet", dot: "text-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  genutzt: { label: "Daten eingegangen", dot: "text-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const DEFAULT_STATE = { label: "Kein Portal", dot: "text-slate-400", chip: "bg-slate-50 text-slate-500 border-slate-200" };

const PortalStatusBadge = ({ status, showLabel = true }) => {
  const s = PORTAL_STATUS[status] || DEFAULT_STATE;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${s.chip}`}
      data-testid={`portal-status-badge-${status || "none"}`}
      title={s.label}
    >
      <Circle className={`w-2 h-2 fill-current ${s.dot}`} />
      {showLabel && <span>{s.label}</span>}
    </span>
  );
};

export default PortalStatusBadge;
export { PortalStatusBadge };
