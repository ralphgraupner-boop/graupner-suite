import React from "react";

/**
 * GraupnerBriefkopf — Einheitlicher, gebrandeter Briefkopf für offizielle Ausgaben.
 *
 * Farben (Corporate): Königsblau #003399 (Name/Website), Rot #cc0000 (seit 1960/E-Mail),
 * Grün #1a6e3c (Balken/Trennlinien/HWK), Grau #444444 (Telefon/Text). Schrift: Georgia.
 * Kontaktdaten stammen aus der zentralen Signatur (keine Hardcode-Duplikate erfinden).
 */

const BLUE = "#003399";
const RED = "#cc0000";
const GREEN = "#1a6e3c";
const GRAY = "#444444";

export const GraupnerBriefkopf = ({ className = "" }) => (
  <div
    data-testid="graupner-briefkopf"
    className={`bg-white w-full pt-4 ${className}`}
    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
  >
    <div className="mx-auto max-w-xl px-4">
      <div className="text-2xl font-bold leading-tight" style={{ color: BLUE }}>
        Tischlerei R. Graupner
      </div>
      <div className="text-xs font-bold tracking-widest mt-0.5" style={{ color: RED }}>
        SEIT 1960 · HAMBURG
      </div>
    </div>
    <div className="h-1 w-full my-2" style={{ backgroundColor: GREEN }} />
    <div className="mx-auto max-w-xl px-4 pb-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: GRAY }}>
        <span>
          Telefon:{" "}
          <a href="tel:+4915157437305" style={{ color: GRAY, textDecoration: "none" }}>
            01515 7437 305
          </a>
        </span>
        <span>
          E-Mail:{" "}
          <a href="mailto:service24@tischlerei-graupner.de" style={{ color: RED, textDecoration: "none" }}>
            service24@tischlerei-graupner.de
          </a>
        </span>
        <span>
          Web:{" "}
          <a href="https://www.tischlerei-graupner.de" style={{ color: BLUE, textDecoration: "none" }}>
            www.tischlerei-graupner.de
          </a>
        </span>
      </div>
      <div className="text-xs mt-1" style={{ color: GREEN }}>
        Mitglied der Handwerkskammer Hamburg
      </div>
    </div>
  </div>
);

export default GraupnerBriefkopf;
