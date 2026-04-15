const TotalsSection = ({
  hasTitels, titelGroups, subtotal, discount, setDiscount, discountType,
  discountAmt, netAfterDiscount, vatRate, setVatRate, vat, total,
  type, depositAmount, setDepositAmount, finalAmount,
  showLohnanteil, setShowLohnanteil, effectiveLohnanteil, lohnanteilMwst, lohnanteilBrutto, lohnanteilCustom, setLohnanteilCustom, totalLaborCost,
}) => {
  return (
    <div className="px-4 lg:px-10 py-4 lg:py-6 border-t">
      {/* Desktop Totals */}
      <table className="hidden lg:table w-full">
        <tbody>
          {/* Gewerk-/Titelzusammenstellung (nur wenn Titel vorhanden) */}
          {hasTitels && titelGroups.length > 0 && (
            <>
              <tr>
                <td className="w-8"></td>
                <td className="w-12"></td>
                <td colSpan={4} className="py-3 text-sm font-bold text-primary">Gewerk-/Titelzusammenstellung</td>
                <td style={{ width: "100px" }}></td>
                <td className="w-8"></td>
              </tr>
              {titelGroups.map((g, i) => (
                <tr key={`tg-${i}`} className="border-b border-slate-100">
                  <td className="w-8"></td>
                  <td className="w-12"></td>
                  <td colSpan={4} className="py-2 text-sm">
                    <span className="font-semibold mr-2">{g.nr}</span>
                    {g.titel}
                  </td>
                  <td className="text-right py-2 font-mono text-sm" style={{ width: "100px" }}>{g.sum.toFixed(2)} €</td>
                  <td className="w-8"></td>
                </tr>
              ))}
              <tr className="border-t border-slate-300">
                <td className="w-8"></td>
                <td className="w-12"></td>
                <td colSpan={3}></td>
                <td style={{ width: "70px" }}></td>
                <td style={{ width: "70px" }}></td>
                <td className="w-8"></td>
              </tr>
            </>
          )}
          {/* Nettosumme */}
          <tr>
            <td className="w-8"></td>
            <td className="w-12"></td>
            <td></td>
            <td style={{ width: "70px" }}></td>
            <td style={{ width: "70px" }}></td>
            <td className="text-right py-2 text-muted-foreground text-sm" style={{ width: "100px" }}>Nettosumme</td>
            <td className="text-right py-2 font-mono text-sm" style={{ width: "100px" }}>{subtotal.toFixed(2)} €</td>
            <td className="w-8"></td>
          </tr>
          {/* Zu-/Abschlag */}
          <tr>
            <td></td><td></td><td></td><td></td><td></td>
            <td className="text-right py-2 text-sm" style={{ width: "100px" }}>
              <div className="flex items-center justify-end gap-1">
                <span className="text-muted-foreground text-xs">Abschlag</span>
                <input type="number" step="0.1" value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-14 h-6 text-xs border rounded px-1 bg-white text-right font-mono"
                  data-testid="discount-input"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </td>
            <td className="text-right py-2 font-mono text-sm" style={{ width: "100px" }}>
              {discountAmt > 0 ? `-${discountAmt.toFixed(2)} €` : "0,00 €"}
            </td>
            <td></td>
          </tr>
          {/* Nettobetrag nach Abschlag */}
          {discount > 0 && (
            <tr className="border-t border-slate-200">
              <td></td><td></td><td></td><td></td><td></td>
              <td className="text-right py-2 text-sm font-medium" style={{ width: "100px" }}>Nettobetrag</td>
              <td className="text-right py-2 font-mono text-sm font-medium" style={{ width: "100px" }}>{netAfterDiscount.toFixed(2)} €</td>
              <td></td>
            </tr>
          )}
          {/* MwSt */}
          <tr>
            <td></td><td></td><td></td><td></td><td></td>
            <td className="text-right py-2 text-sm" style={{ width: "100px" }}>
              <div className="flex items-center justify-end gap-1">
                <span className="text-muted-foreground">MwSt</span>
                <select value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value))}
                  className="h-6 text-xs border rounded px-1 bg-white">
                  <option value={19}>19%</option>
                  <option value={7}>7%</option>
                  <option value={0}>0%</option>
                </select>
              </div>
            </td>
            <td className="text-right py-2 font-mono text-sm" style={{ width: "100px" }}>{vat.toFixed(2)} €</td>
            <td></td>
          </tr>
          {/* Brutto / Gesamt */}
          <tr className="border-t-2 border-primary">
            <td></td><td></td><td></td><td></td><td></td>
            <td className="text-right py-3 font-bold text-lg">Brutto</td>
            <td className="text-right py-3 font-mono font-bold text-lg">{total.toFixed(2)} €</td>
            <td></td>
          </tr>
          {type === "invoice" && (
            <>
              <tr>
                <td></td><td></td><td></td><td></td><td></td>
                <td className="text-right py-2 text-muted-foreground text-sm">Anzahlung</td>
                <td className="text-right py-2">
                  <div className="flex items-center justify-end">
                    <input type="number" step="0.01" value={depositAmount}
                      onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                      className="w-20 border rounded px-2 py-1 text-sm text-right font-mono" />
                    <span className="ml-1 text-sm">€</span>
                  </div>
                </td>
                <td></td>
              </tr>
              {depositAmount > 0 && (
                <tr>
                  <td></td><td></td><td></td><td></td><td></td>
                  <td className="text-right py-2 text-primary font-semibold text-sm">Restbetrag</td>
                  <td className="text-right py-2 font-mono text-primary font-semibold text-sm">{finalAmount.toFixed(2)} €</td>
                  <td></td>
                </tr>
              )}
            </>
          )}
          {/* Lohnanteil */}
          <tr>
            <td></td><td></td><td></td><td></td><td></td>
            <td colSpan={2} className="pt-4 pb-2">
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Lohnanteil</span>
                  <button type="button" onClick={() => setShowLohnanteil(!showLohnanteil)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${showLohnanteil ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
                    data-testid="btn-toggle-lohnanteil">
                    {showLohnanteil ? "Wird ausgewiesen" : "Nicht ausweisen"}
                  </button>
                </div>
                {(totalLaborCost > 0 || showLohnanteil) && (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lohnanteil (netto)</span>
                      <div className="flex items-center gap-1">
                        <input type="number" step="0.01" value={lohnanteilCustom !== "" ? lohnanteilCustom : totalLaborCost.toFixed(2)}
                          onChange={(e) => setLohnanteilCustom(e.target.value)}
                          className="w-24 border rounded px-2 py-0.5 text-right font-mono text-sm" data-testid="input-lohnanteil" />
                        <span className="text-muted-foreground">€</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>zzgl. {vatRate}% MwSt</span>
                      <span className="font-mono">{lohnanteilMwst.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Gesamt-Lohnsumme</span>
                      <span className="font-mono">{lohnanteilBrutto.toFixed(2)} €</span>
                    </div>
                    {lohnanteilCustom !== "" && parseFloat(lohnanteilCustom) !== totalLaborCost && (
                      <button type="button" onClick={() => setLohnanteilCustom("")} className="text-xs text-primary hover:underline">Auf berechneten Wert zuruecksetzen ({totalLaborCost.toFixed(2)} €)</button>
                    )}
                  </div>
                )}
              </div>
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
      {/* Mobile Totals */}
      <div className="lg:hidden">
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2">
            {/* Mobile Gewerk-Zusammenstellung */}
            {hasTitels && titelGroups.length > 0 && (
              <div className="mb-3 pb-2 border-b">
                <p className="text-xs font-bold text-primary mb-2">Gewerk-/Titelzusammenstellung</p>
                {titelGroups.map((g, i) => (
                  <div key={`mtg-${i}`} className="flex justify-between py-1 text-sm">
                    <span><span className="font-semibold mr-1">{g.nr}</span> {g.titel}</span>
                    <span className="font-mono">{g.sum.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Nettosumme</span>
              <span className="font-mono">{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-2 items-center">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">Abschlag</span>
                <input type="number" step="0.1" value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-12 h-6 text-xs border rounded px-1 bg-white text-right font-mono" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <span className="font-mono">{discountAmt > 0 ? `-${discountAmt.toFixed(2)} €` : "0,00 €"}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-2 border-t font-medium">
                <span>Nettobetrag</span>
                <span className="font-mono">{netAfterDiscount.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between py-2 items-center">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">MwSt</span>
                <select value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value))}
                  className="h-7 text-xs border rounded px-1 bg-white">
                  <option value={19}>19%</option>
                  <option value={7}>7%</option>
                  <option value={0}>0%</option>
                </select>
              </div>
              <span className="font-mono">{vat.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
              <span>Brutto</span>
              <span className="font-mono">{total.toFixed(2)} €</span>
            </div>
            {type === "invoice" && (
              <>
                <div className="flex justify-between py-2 items-center">
                  <span className="text-muted-foreground">Anzahlung</span>
                  <div className="flex items-center">
                    <input type="number" step="0.01" value={depositAmount}
                      onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                      className="w-20 border rounded px-2 py-1 text-sm text-right font-mono" />
                    <span className="ml-1">€</span>
                  </div>
                </div>
                {depositAmount > 0 && (
                  <div className="flex justify-between py-2 text-primary font-semibold">
                    <span>Restbetrag</span>
                    <span className="font-mono">{finalAmount.toFixed(2)} €</span>
                  </div>
                )}
              </>
            )}
            {/* Lohnanteil Mobile */}
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Lohnanteil</span>
                <button type="button" onClick={() => setShowLohnanteil(!showLohnanteil)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${showLohnanteil ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {showLohnanteil ? "Wird ausgewiesen" : "Nicht ausweisen"}
                </button>
              </div>
              {(totalLaborCost > 0 || showLohnanteil) && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lohnanteil (netto)</span>
                    <div className="flex items-center gap-1">
                      <input type="number" step="0.01" value={lohnanteilCustom !== "" ? lohnanteilCustom : totalLaborCost.toFixed(2)}
                        onChange={(e) => setLohnanteilCustom(e.target.value)}
                        className="w-24 border rounded px-2 py-0.5 text-right font-mono text-sm" />
                      <span className="text-muted-foreground">€</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>zzgl. {vatRate}% MwSt</span>
                    <span className="font-mono">{lohnanteilMwst.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Gesamt-Lohnsumme</span>
                    <span className="font-mono">{lohnanteilBrutto.toFixed(2)} €</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { TotalsSection };
