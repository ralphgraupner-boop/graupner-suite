import { Bookmark, BookmarkCheck, FileSearch, Calculator, ChevronDown, Copy, TrendingUp } from "lucide-react";
import { KalkulationPanel } from "./KalkulationPanel";

const RightSidebar = ({
  showVorlagen, activeKalkItem, settings, onApplyKalkPrice, onCloseKalk,
  onSaveToStamm, onCreateNewArticle,
  templateDocs, similarDocs, expandedDoc, setExpandedDoc,
  copyPositionsFromDoc, toggleDocTemplate,
  titles, type, positions,
  subtotal, vatRate, vat, total,
  costPrices, updateCostPrice, calculateKalkulation,
  customer,
}) => {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto space-y-3 pl-1">

        {/* Aktive Positions-Kalkulation (klick-basiert, bleibt offen) */}
        {activeKalkItem && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200" data-testid="active-kalkulation-panel">
            <KalkulationPanel
              key={`kalk-pos-${activeKalkItem._posIdx}-${activeKalkItem.id || 'new'}`}
              item={activeKalkItem}
              settings={settings}
              onApplyPrice={onApplyKalkPrice}
              onClose={onCloseKalk}
              onSaveToStamm={onSaveToStamm}
              onCreateNewArticle={onCreateNewArticle}
            />
          </div>
        )}

        {/* Vorlagen Section (toggled from toolbar) */}
        {showVorlagen && !activeKalkItem && (
          <div className="space-y-3 animate-in fade-in duration-200" data-testid="vorlagen-section">
            <div className="rounded-md border border-input bg-card overflow-hidden">
              <div className="p-2.5 border-b bg-amber-50/50">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />
                  Vorlagen
                </p>
              </div>
              <div className="p-2 space-y-1.5 max-h-[240px] overflow-y-auto">
                {templateDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Noch keine Vorlagen. Markieren Sie ein bestehendes {titles[type]} als Vorlage.
                  </p>
                )}
                {templateDocs.map(doc => (
                  <div key={doc.id} className="rounded-md border border-input hover:border-primary/30 transition-all">
                    <button
                      onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                      className="w-full flex items-center justify-between p-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{doc.quote_number || doc.order_number || doc.invoice_number}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{doc.customer_name} · {doc.total_gross?.toFixed(0)}€</p>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${expandedDoc === doc.id ? "rotate-180" : ""}`} />
                    </button>
                    {expandedDoc === doc.id && (
                      <div className="border-t p-2 bg-slate-50/50 space-y-1">
                        {(doc.positions || []).map((p, i) => (
                          <p key={i} className="text-[10px] text-muted-foreground">
                            {p.pos_nr}. {p.description} — {p.quantity}x {p.price_net?.toFixed(2)}€
                          </p>
                        ))}
                        <button
                          onClick={() => copyPositionsFromDoc(doc)}
                          className="w-full mt-1.5 flex items-center justify-center gap-1 h-7 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                          data-testid={`btn-copy-positions-${doc.id}`}
                        >
                          <Copy className="w-3 h-3" />
                          Positionen übernehmen
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-input bg-card overflow-hidden">
              <div className="p-2.5 border-b bg-blue-50/50">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <FileSearch className="w-3.5 h-3.5 text-blue-600" />
                  Ähnliche {titles[type]}
                </p>
              </div>
              <div className="p-2 space-y-1.5 max-h-[240px] overflow-y-auto">
                {similarDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Keine ähnlichen {titles[type]} gefunden
                  </p>
                )}
                {similarDocs.map(doc => (
                  <div key={doc.id} className="rounded-md border border-input hover:border-blue-300 transition-all">
                    <div className="flex items-center justify-between p-2">
                      <button
                        onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                        className="min-w-0 text-left flex-1"
                      >
                        <p className="text-xs font-medium truncate">{doc.quote_number || doc.order_number || doc.invoice_number}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{doc.customer_name} · {doc.total_gross?.toFixed(0)}€</p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleDocTemplate(doc.id)}
                          className="p-1 hover:bg-amber-100 rounded transition-colors" title="Als Vorlage markieren">
                          <Bookmark className="w-3 h-3 text-muted-foreground hover:text-amber-600" />
                        </button>
                        <button onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} className="p-1">
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedDoc === doc.id ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>
                    {expandedDoc === doc.id && (
                      <div className="border-t p-2 bg-slate-50/50 space-y-1">
                        {(doc.positions || []).map((p, i) => (
                          <p key={i} className="text-[10px] text-muted-foreground">
                            {p.pos_nr}. {p.description} — {p.quantity}x {p.price_net?.toFixed(2)}€
                          </p>
                        ))}
                        <div className="flex gap-1 mt-1.5">
                          <button onClick={() => copyPositionsFromDoc(doc)}
                            className="flex-1 flex items-center justify-center gap-1 h-7 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                            data-testid={`btn-copy-positions-${doc.id}`}>
                            <Copy className="w-3 h-3" /> Übernehmen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dokument-Kalkulation (wenn kein Panel aktiv und keine Vorlagen) */}
        {!activeKalkItem && !showVorlagen && (() => {
          const kalk = calculateKalkulation();
          return (
            <div className="rounded-md border border-input bg-card p-3 space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Calculator className="w-3 h-3" /> Dokument-Kalkulation
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Netto</span>
                  <span className="font-mono font-medium">{subtotal.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">MwSt ({vatRate}%)</span>
                  <span className="font-mono">{vat.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1.5">
                  <span>Brutto</span>
                  <span className="font-mono">{total.toFixed(2)} €</span>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Kosten pro Position</p>
                <p className="text-[10px] text-muted-foreground">EK-Preise eingeben für Margenberechnung</p>
                {positions.map((pos, idx) => pos.description && pos.type !== "titel" && (
                  <div key={idx} className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground w-5 shrink-0">{pos.pos_nr}.</span>
                    <span className="truncate flex-1" title={pos.description}>
                      {pos.description.substring(0, 20)}{pos.description.length > 20 ? "…" : ""}
                    </span>
                    <div className="flex items-center shrink-0">
                      <input type="number" step="0.01" min="0" placeholder="EK"
                        value={costPrices[idx] || ""}
                        onChange={(e) => updateCostPrice(idx, e.target.value)}
                        className="w-16 h-6 border rounded px-1.5 text-xs text-right font-mono bg-slate-50 focus:ring-1 focus:ring-primary/30"
                        data-testid={`cost-price-${idx}`} />
                      <span className="text-muted-foreground ml-0.5">€</span>
                    </div>
                  </div>
                ))}
              </div>

              {kalk.hasCosts && (
                <>
                  <div className="h-px bg-border" />
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ergebnis</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Erlöse (Netto)</span>
                      <span className="font-mono">{kalk.revenue.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Kosten</span>
                      <span className="font-mono text-red-600">-{kalk.costs.toFixed(2)} €</span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold border-t pt-1.5 ${kalk.margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Marge</span>
                      <span className="font-mono">{kalk.margin.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Marge in %</span>
                      <span className={`font-mono font-semibold ${kalk.marginPercent >= 20 ? "text-emerald-600" : kalk.marginPercent >= 0 ? "text-amber-600" : "text-red-600"}`}>
                        {kalk.marginPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${kalk.marginPercent >= 20 ? "bg-emerald-500" : kalk.marginPercent >= 0 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(Math.max(kalk.marginPercent, 0), 100)}%` }} />
                    </div>
                  </div>
                </>
              )}

              {!kalk.hasCosts && (
                <div className="text-xs text-muted-foreground bg-slate-50 rounded-md p-2.5 text-center">
                  Tragen Sie EK-Preise ein, um die Marge zu berechnen
                </div>
              )}
            </div>
          );
        })()}

        {/* Quick Info (always visible) */}
        <div className="rounded-md border border-input bg-card p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Übersicht</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-md p-2 text-center">
              <p className="text-lg font-bold font-mono text-primary">{positions.filter(p => p.description && p.type !== "titel").length}</p>
              <p className="text-[10px] text-muted-foreground">Positionen</p>
            </div>
            <div className="bg-slate-50 rounded-md p-2 text-center">
              <p className="text-lg font-bold font-mono text-primary">{total.toFixed(0)}€</p>
              <p className="text-[10px] text-muted-foreground">Brutto</p>
            </div>
          </div>
          {customer && (
            <div className="bg-slate-50 rounded-md p-2">
              <p className="text-[10px] text-muted-foreground">Kunde</p>
              <p className="text-sm font-medium truncate">{customer.name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { RightSidebar };
