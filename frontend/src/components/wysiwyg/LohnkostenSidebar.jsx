import { useState, useEffect } from "react";
import { Wrench } from "lucide-react";

const LohnkostenSidebar = ({ positions, vatRate, showLohnanteil, setShowLohnanteil, lohnanteilCustom, setLohnanteilCustom }) => {
  // Nur Positionen mit Beschreibung (keine leeren)
  const activePositions = positions.filter(p => p.description && p.type !== "titel");

  // Lohnkosten pro Position
  const [lohnkosten, setLohnkosten] = useState({});

  // Initialisieren aus positions.labor_cost
  useEffect(() => {
    const init = {};
    activePositions.forEach((p, idx) => {
      const key = `${idx}_${p.description?.substring(0, 20)}`;
      if (!(key in lohnkosten)) {
        init[key] = p.labor_cost || 0;
      } else {
        init[key] = lohnkosten[key];
      }
    });
    setLohnkosten(init);
  }, [positions.length]);

  const keys = activePositions.map((p, idx) => `${idx}_${p.description?.substring(0, 20)}`);
  const totalLohn = keys.reduce((sum, key) => sum + (parseFloat(lohnkosten[key]) || 0), 0);
  const mwst = totalLohn * (vatRate / 100);
  const brutto = totalLohn + mwst;

  const handleApply = () => {
    setLohnanteilCustom(totalLohn.toFixed(2));
    setShowLohnanteil(true);
  };

  if (activePositions.length === 0) return null;

  return (
    <div className="w-72 shrink-0 border-l bg-muted/20 overflow-y-auto hidden xl:block" data-testid="lohnkosten-sidebar">
      <div className="p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Wrench className="w-4 h-4 text-primary" />
          Lohnkosten
        </h3>

        <div className="space-y-2">
          {activePositions.map((pos, idx) => {
            const key = keys[idx];
            const name = pos.description?.split(" - ")[0]?.substring(0, 30) || `Position ${idx + 1}`;
            return (
              <div key={key} className="bg-card rounded-sm border p-2.5">
                <p className="text-xs font-medium truncate mb-1.5" title={pos.description}>{name}</p>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={lohnkosten[key] || ""}
                    onChange={(e) => setLohnkosten({ ...lohnkosten, [key]: e.target.value })}
                    placeholder="0.00"
                    className="flex-1 border rounded px-2 py-1 text-sm text-right font-mono"
                  />
                  <span className="text-xs text-muted-foreground">€</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summe */}
        <div className="mt-4 pt-3 border-t space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Lohnanteil netto</span>
            <span className="font-mono font-semibold">{totalLohn.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>zzgl. {vatRate}% MwSt</span>
            <span className="font-mono">{mwst.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Gesamt-Lohnsumme</span>
            <span className="font-mono">{brutto.toFixed(2)} €</span>
          </div>
        </div>

        {/* Uebernehmen Button */}
        <button
          type="button"
          onClick={handleApply}
          disabled={totalLohn <= 0}
          className="w-full mt-3 px-3 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          data-testid="btn-apply-lohnkosten"
        >
          Uebernehmen
        </button>

        {showLohnanteil && (
          <p className="text-xs text-green-600 text-center mt-2">Wird im Dokument ausgewiesen</p>
        )}
      </div>
    </div>
  );
};

export { LohnkostenSidebar };
