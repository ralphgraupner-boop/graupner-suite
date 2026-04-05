import { useState, useEffect } from "react";
import { Calculator, Check, X } from "lucide-react";

const KalkulationPanel = ({ item, settings, onApplyPrice, onClose }) => {
  const [ek, setEk] = useState(item.ek_preis || 0);
  const [zeitMeister, setZeitMeister] = useState(0);
  const [zeitGeselle, setZeitGeselle] = useState(0);
  const [zeitAzubi, setZeitAzubi] = useState(0);
  const [zeitHelfer, setZeitHelfer] = useState(0);
  const [materialzuschlag, setMaterialzuschlag] = useState(settings.kalk_materialzuschlag || 10);
  const [gewinnaufschlag, setGewinnaufschlag] = useState(settings.kalk_gewinnaufschlag || 15);
  const [sonstige, setSonstige] = useState([]);

  const meisterRate = settings.kalk_meister || 58;
  const geselleRate = settings.kalk_geselle || 45;
  const azubiRate = settings.kalk_azubi || 18;
  const helferRate = settings.kalk_helfer || 25;

  // Berechnung
  const lohnkosten =
    zeitMeister * meisterRate +
    zeitGeselle * geselleRate +
    zeitAzubi * azubiRate +
    zeitHelfer * helferRate;

  const sonstigeSum = sonstige.reduce((s, p) => s + (p.betrag || 0), 0);
  const zwischensumme = ek + lohnkosten + sonstigeSum;
  const materialBetrag = zwischensumme * (materialzuschlag / 100);
  const nachMaterial = zwischensumme + materialBetrag;
  const gewinnBetrag = nachMaterial * (gewinnaufschlag / 100);
  const vkPreis = nachMaterial + gewinnBetrag;

  const addSonstige = () => setSonstige([...sonstige, { name: "", betrag: 0 }]);
  const updateSonstige = (i, field, val) => {
    const u = [...sonstige]; u[i] = { ...u[i], [field]: val }; setSonstige(u);
  };
  const removeSonstige = (i) => setSonstige(sonstige.filter((_, idx) => idx !== i));

  const gesamtStunden = zeitMeister + zeitGeselle + zeitAzubi + zeitHelfer;

  return (
    <div className="mt-2 rounded-md border border-blue-200 bg-gradient-to-b from-blue-50/80 to-white p-3 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200" data-testid="kalkulation-panel">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" />
          Kalkulation
        </h4>
        <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* EK-Preis */}
      <div className="mb-3">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Einkaufspreis (Material/EK)</label>
        <div className="flex items-center gap-1">
          <input type="number" step="0.01" value={ek || ""} onChange={e => setEk(parseFloat(e.target.value) || 0)}
            placeholder="0.00" className="flex-1 h-8 border rounded px-2 text-sm font-mono text-right bg-white" data-testid="kalk-ek" />
          <span className="text-xs text-muted-foreground">€</span>
        </div>
      </div>

      {/* Zeitanteile */}
      <div className="mb-3">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Zeitanteile (Stunden)</label>
        <div className="space-y-1.5">
          {[
            { label: "Meister", rate: meisterRate, val: zeitMeister, set: setZeitMeister, tid: "meister" },
            { label: "Geselle", rate: geselleRate, val: zeitGeselle, set: setZeitGeselle, tid: "geselle" },
            { label: "Azubi", rate: azubiRate, val: zeitAzubi, set: setZeitAzubi, tid: "azubi" },
            { label: "Helfer", rate: helferRate, val: zeitHelfer, set: setZeitHelfer, tid: "helfer" },
          ].map(z => (
            <div key={z.tid} className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-14 shrink-0">{z.label}</span>
              <input type="number" step="0.25" min="0" value={z.val || ""} onChange={e => z.set(parseFloat(e.target.value) || 0)}
                placeholder="0" className="w-14 h-7 border rounded px-1.5 text-xs font-mono text-right bg-white" data-testid={`kalk-zeit-${z.tid}`} />
              <span className="text-[10px] text-muted-foreground">Std</span>
              <span className="text-[10px] text-muted-foreground/60 ml-auto">× {z.rate.toFixed(0)}€</span>
              <span className="text-xs font-mono w-16 text-right">{(z.val * z.rate).toFixed(2)}€</span>
            </div>
          ))}
          {gesamtStunden > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-blue-100 mt-1">
              <span className="text-[10px] text-blue-700 font-medium">{gesamtStunden.toFixed(2)} Std gesamt</span>
              <span className="text-xs font-mono font-semibold text-blue-700">{lohnkosten.toFixed(2)} €</span>
            </div>
          )}
        </div>
      </div>

      {/* Sonstige Positionen */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sonstige Kosten</label>
          <button onClick={addSonstige} className="text-[10px] text-primary hover:text-primary/80 font-medium" data-testid="kalk-add-sonstige">+ Hinzufügen</button>
        </div>
        {sonstige.map((s, i) => (
          <div key={i} className="flex items-center gap-1 mb-1">
            <input value={s.name} onChange={e => updateSonstige(i, "name", e.target.value)}
              placeholder="Bezeichnung" className="flex-1 h-7 border rounded px-2 text-xs bg-white" />
            <input type="number" step="0.01" value={s.betrag || ""} onChange={e => updateSonstige(i, "betrag", parseFloat(e.target.value) || 0)}
              placeholder="0" className="w-16 h-7 border rounded px-1.5 text-xs font-mono text-right bg-white" />
            <span className="text-xs text-muted-foreground">€</span>
            <button onClick={() => removeSonstige(i)} className="p-0.5 text-muted-foreground hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Zuschläge */}
      <div className="mb-3 space-y-1.5">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Zuschläge</label>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground flex-1">Materialzuschlag</span>
          <input type="number" step="0.5" value={materialzuschlag || ""} onChange={e => setMaterialzuschlag(parseFloat(e.target.value) || 0)}
            className="w-14 h-7 border rounded px-1.5 text-xs font-mono text-right bg-white" data-testid="kalk-material" />
          <span className="text-[10px] text-muted-foreground">%</span>
          <span className="text-xs font-mono w-16 text-right">{materialBetrag.toFixed(2)}€</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground flex-1">Gewinnaufschlag</span>
          <input type="number" step="0.5" value={gewinnaufschlag || ""} onChange={e => setGewinnaufschlag(parseFloat(e.target.value) || 0)}
            className="w-14 h-7 border rounded px-1.5 text-xs font-mono text-right bg-white" data-testid="kalk-gewinn" />
          <span className="text-[10px] text-muted-foreground">%</span>
          <span className="text-xs font-mono w-16 text-right">{gewinnBetrag.toFixed(2)}€</span>
        </div>
      </div>

      {/* Ergebnis */}
      <div className="border-t-2 border-blue-300 pt-2 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Selbstkosten</span>
          <span className="font-mono">{zwischensumme.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-blue-800">
          <span>VK Netto (kalkuliert)</span>
          <span className="font-mono">{vkPreis.toFixed(2)} €</span>
        </div>
        {item.price_net > 0 && Math.abs(item.price_net - vkPreis) > 0.01 && (
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Aktueller VK: {item.price_net.toFixed(2)} €</span>
            <span className={vkPreis > item.price_net ? "text-green-600" : "text-red-600"}>
              {vkPreis > item.price_net ? "+" : ""}{(vkPreis - item.price_net).toFixed(2)} €
            </span>
          </div>
        )}
      </div>

      {/* Übernehmen-Button */}
      <button
        onClick={() => onApplyPrice(item, vkPreis, ek)}
        disabled={vkPreis <= 0}
        className="w-full mt-3 h-8 flex items-center justify-center gap-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        data-testid="kalk-apply-btn"
      >
        <Check className="w-3.5 h-3.5" />
        VK-Preis übernehmen ({vkPreis.toFixed(2)} €)
      </button>
    </div>
  );
};

export { KalkulationPanel };
