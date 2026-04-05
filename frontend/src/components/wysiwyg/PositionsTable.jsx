import { GripVertical, Trash2, Plus, Bookmark, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

const PositionsTable = ({
  positions, numbering, type,
  selectedPositions, togglePositionSelect,
  updatePosition, removePosition, movePosition,
  checkStammChange, stammChangeIdx, setStammChangeIdx, saveToStamm,
  titelTemplates, titelDropdownIdx, setTitelDropdownIdx, saveTitelTemplate,
  dragIndex, setDragIndex, dragOverIndex, setDragOverIndex,
  saveAsArticleIdx, setSaveAsArticleIdx, saveAsType, setSaveAsType,
  handleSavePositionAsArticle,
  addPosition, addTitel,
  blockSaveName, setBlockSaveName, saveAsLeistungsBlock, setSelectedPositions,
  articles, addFromStamm, services,
}) => {
  return (
    <div className="px-4 lg:px-10 py-4 lg:py-8">
      {/* Mobile Positions - Card Layout */}
      <div className="lg:hidden space-y-3">
        {positions.map((pos, idx) => {
          if (pos.type === "titel") {
            return (
              <div key={idx} className="border-2 border-amber-300/60 rounded-sm p-3 bg-amber-50/60" data-testid={`mobile-titel-${idx}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-primary">{numbering[idx]}</span>
                    <span className="text-xs text-amber-600 font-medium">Titel</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pos.description?.trim() && !titelTemplates.some(t => t.content === pos.description.trim()) && (
                      <button type="button" onClick={() => saveTitelTemplate(pos.description)}
                        className="p-1 text-amber-500 hover:text-amber-600 rounded" title="Als Vorlage speichern">
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => removePosition(idx)} className="p-1 hover:bg-destructive/10 rounded-sm">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    value={pos.description}
                    onChange={(e) => updatePosition(idx, "description", e.target.value)}
                    placeholder="Titel eingeben..."
                    className="flex-1 border rounded px-2 py-1.5 text-base font-bold text-primary bg-white"
                  />
                  <div className="relative">
                    <button type="button" onClick={() => setTitelDropdownIdx(titelDropdownIdx === idx ? null : idx)}
                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded border">
                      <ChevronDown className={`w-4 h-4 transition-transform ${titelDropdownIdx === idx ? "rotate-180" : ""}`} />
                    </button>
                    {titelDropdownIdx === idx && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-sm shadow-lg min-w-[200px] max-h-40 overflow-y-auto">
                        {titelTemplates.length > 0 ? titelTemplates.map(t => (
                          <button key={t.id} type="button"
                            onClick={() => { updatePosition(idx, "description", t.content); setTitelDropdownIdx(null); }}
                            className="block w-full text-left px-3 py-2 text-sm font-medium hover:bg-amber-50 border-b last:border-b-0">
                            {t.content}
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-xs text-muted-foreground">Keine Vorlagen</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          return (
          <div key={idx} className="border rounded-sm p-3 bg-white">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  {idx > 0 && <button onClick={() => movePosition(idx, idx - 1)} className="p-0.5 hover:bg-muted rounded text-muted-foreground"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg></button>}
                  {idx < positions.length - 1 && <button onClick={() => movePosition(idx, idx + 1)} className="p-0.5 hover:bg-muted rounded text-muted-foreground"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg></button>}
                </div>
                <span className="text-xs font-mono text-muted-foreground">Pos. {numbering[idx]}</span>
              </div>
              <button onClick={() => removePosition(idx)} className="p-1 hover:bg-destructive/10 rounded-sm">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
            <textarea
              value={pos.description}
              onChange={(e) => updatePosition(idx, "description", e.target.value)}
              placeholder="Beschreibung..."
              rows={1}
              className="w-full border rounded px-2 py-1.5 text-sm mb-2 resize-none overflow-hidden"
              style={{ minHeight: "36px" }}
              onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.max(36, e.target.scrollHeight) + "px"; }}
              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(36, el.scrollHeight) + "px"; } }}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground block">Menge</label>
                <input type="number" step="0.01" value={pos.quantity}
                  onChange={(e) => updatePosition(idx, "quantity", parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-sm text-center font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block">Einheit</label>
                <input value={pos.unit}
                  onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm text-center" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block">Preis</label>
                <input type="number" step="0.01" value={pos.price_net}
                  onChange={(e) => updatePosition(idx, "price_net", parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1.5 text-sm text-right font-mono" />
              </div>
            </div>
            <div className="text-right mt-2 font-mono text-sm font-semibold">
              = {((pos.quantity || 0) * (pos.price_net || 0)).toFixed(2)} €
            </div>
          </div>
          );
        })}
      </div>

      {/* Desktop Positions - Table */}
      <table className="hidden lg:table w-full">
        <thead>
          <tr className="border-b-2 border-primary/30">
            <th className="w-8"></th>
            <th className="text-left py-3 text-sm font-semibold text-primary w-12">Pos</th>
            <th className="text-left py-3 text-sm font-semibold text-primary">Beschreibung</th>
            <th className="text-right py-3 text-sm font-semibold text-primary" style={{ width: "70px" }}>Menge</th>
            <th className="text-left py-3 text-sm font-semibold text-primary pl-2" style={{ width: "70px" }}>Einheit</th>
            <th className="text-right py-3 text-sm font-semibold text-primary" style={{ width: "100px" }}>Einzelpreis</th>
            <th className="text-right py-3 text-sm font-semibold text-primary" style={{ width: "100px" }}>Gesamt</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => {
            if (pos.type === "titel") {
              return (
                <tr key={idx}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => { movePosition(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); }}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  className={`border-b-2 border-amber-300/60 bg-amber-50/60 group ${dragOverIndex === idx ? "bg-primary/5 border-primary/30" : ""} ${dragIndex === idx ? "opacity-40" : ""}`}
                  data-testid={`titel-row-${idx}`}
                >
                  <td className="py-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <input type="checkbox" checked={selectedPositions.has(idx)}
                        onChange={() => togglePositionSelect(idx)}
                        className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-primary cursor-pointer" />
                      <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-base font-bold text-primary">{numbering[idx]}</td>
                  <td className="py-2" colSpan={4}>
                    <div className="flex items-center gap-1">
                      <input
                        value={pos.description}
                        onChange={(e) => updatePosition(idx, "description", e.target.value)}
                        placeholder="Titel eingeben (z.B. Einrüstarbeiten)..."
                        className="flex-1 bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-base font-bold text-primary placeholder:font-normal placeholder:text-muted-foreground/50"
                        data-testid={`titel-input-${idx}`}
                      />
                      {/* Titel-Vorlage Dropdown */}
                      <div className="relative">
                        <button type="button" onClick={() => setTitelDropdownIdx(titelDropdownIdx === idx ? null : idx)}
                          className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                          title="Titel-Vorlage wählen">
                          <ChevronDown className={`w-4 h-4 transition-transform ${titelDropdownIdx === idx ? "rotate-180" : ""}`} />
                        </button>
                        {titelDropdownIdx === idx && (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-sm shadow-lg min-w-[220px] max-h-48 overflow-y-auto">
                            {titelTemplates.length > 0 ? titelTemplates.map(t => (
                              <button key={t.id} type="button"
                                onClick={() => { updatePosition(idx, "description", t.content); setTitelDropdownIdx(null); }}
                                className="block w-full text-left px-3 py-2 text-sm font-medium hover:bg-amber-50 transition-colors border-b last:border-b-0">
                                {t.content}
                              </button>
                            )) : (
                              <p className="px-3 py-2 text-xs text-muted-foreground">Keine Titel-Vorlagen vorhanden</p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Speichern-Button */}
                      {pos.description?.trim() && !titelTemplates.some(t => t.content === pos.description.trim()) && (
                        <button type="button" onClick={() => saveTitelTemplate(pos.description)}
                          className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Als Titel-Vorlage speichern">
                          <Bookmark className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td></td>
                  <td className="py-3">
                    <button onClick={() => removePosition(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            }
            return (
            <tr key={idx}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={() => { movePosition(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); }}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
              className={`border-b border-slate-100 group transition-colors ${dragOverIndex === idx ? "bg-primary/5 border-primary/30" : ""} ${dragIndex === idx ? "opacity-40" : ""}`}
            >
              <td className="py-2 align-bottom">
                <div className="flex flex-col items-center gap-0.5">
                  <input type="checkbox" checked={selectedPositions.has(idx)}
                    onChange={() => togglePositionSelect(idx)}
                    className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-primary cursor-pointer" />
                  <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>
              </td>
              <td className="py-3 text-sm text-muted-foreground align-top">{numbering[idx]}</td>
              <td className="py-2">
                <textarea value={pos.description}
                  onChange={(e) => updatePosition(idx, "description", e.target.value)}
                  onBlur={() => checkStammChange(idx)}
                  placeholder="Beschreibung eingeben..."
                  rows={1}
                  className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm resize-none overflow-hidden [&::first-line]:font-bold"
                  style={{ minHeight: "32px" }}
                  onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.max(32, e.target.scrollHeight) + "px"; }}
                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(32, el.scrollHeight) + "px"; } }}
                />
                {pos.artikel_nr && <span className="text-[10px] text-muted-foreground font-mono px-2">{pos.artikel_nr}</span>}
                {/* Stammdaten-Änderung übernehmen */}
                {stammChangeIdx === idx && (
                  <div className="px-2 mt-1 flex items-center gap-2 animate-in fade-in">
                    <span className="text-[11px] text-blue-600">Änderung in Stammdaten übernehmen?</span>
                    <button onClick={() => saveToStamm(idx)}
                      className="text-[11px] text-green-600 hover:text-green-700 font-medium px-1.5 py-0.5 rounded hover:bg-green-50">Ja</button>
                    <button onClick={() => setStammChangeIdx(null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground px-1">Nein</button>
                  </div>
                )}
                {stammChangeIdx !== idx && pos.description?.trim() && !pos.artikel_nr && !pos.source_article_id && (
                  <div className="px-2 mt-0.5">
                    {saveAsArticleIdx === idx ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in">
                        <select value={saveAsType} onChange={(e) => setSaveAsType(e.target.value)}
                          className="h-6 text-[11px] border rounded px-1 bg-white">
                          <option value="Leistung">Leistung</option>
                          <option value="Artikel">Artikel</option>
                          <option value="Fremdleistung">Fremdleistung</option>
                        </select>
                        <button onClick={() => handleSavePositionAsArticle(idx)}
                          className="text-[11px] text-green-600 hover:text-green-700 font-medium px-1.5 py-0.5 rounded hover:bg-green-50">Speichern</button>
                        <button onClick={() => setSaveAsArticleIdx(null)}
                          className="text-[11px] text-muted-foreground hover:text-foreground px-1">Abbrechen</button>
                      </div>
                    ) : (
                      <button onClick={() => setSaveAsArticleIdx(idx)}
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 transition-opacity">
                        <Bookmark className="w-3 h-3" /> Als Artikel/Leistung speichern
                      </button>
                    )}
                  </div>
                )}
              </td>
              <td className="py-2 align-bottom">
                <input type="number" step="0.01" value={pos.quantity}
                  onChange={(e) => updatePosition(idx, "quantity", parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm text-right font-mono" />
              </td>
              <td className="py-2 align-bottom">
                <input type="text" value={pos.unit}
                  onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                  onBlur={() => checkStammChange(idx)}
                  className="w-full bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm" />
              </td>
              <td className="py-2 align-bottom">
                <div className="flex items-center justify-end">
                  <input type="number" step="0.01" value={pos.price_net}
                    onChange={(e) => updatePosition(idx, "price_net", parseFloat(e.target.value) || 0)}
                    onBlur={() => checkStammChange(idx)}
                    className="w-20 bg-transparent border-0 focus:ring-2 focus:ring-primary/20 rounded px-2 py-1 text-sm text-right font-mono" />
                  <span className="text-sm text-muted-foreground ml-1">€</span>
                </div>
              </td>
              <td className="py-3 text-right font-mono text-sm align-bottom">
                {((pos.quantity || 0) * (pos.price_net || 0)).toFixed(2)} €
              </td>
              <td className="py-3 align-bottom">
                <button onClick={() => removePosition(idx)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>

      {/* Add Position / Titel Buttons */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={addPosition}
          data-testid="btn-add-position"
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Position hinzufügen
        </button>
        <button
          onClick={addTitel}
          data-testid="btn-add-titel"
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Titel hinzufügen
        </button>
      </div>
      {/* Leistungsblock speichern */}
      {selectedPositions.size > 0 && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-sm animate-in fade-in" data-testid="block-save-bar">
          <span className="text-xs text-blue-700 font-medium whitespace-nowrap">{selectedPositions.size} markiert</span>
          <input
            value={blockSaveName}
            onChange={(e) => setBlockSaveName(e.target.value)}
            placeholder="Blockname eingeben..."
            className="flex-1 h-8 text-sm border rounded px-2 bg-white"
            data-testid="block-name-input"
          />
          <button onClick={saveAsLeistungsBlock}
            disabled={!blockSaveName.trim()}
            className="h-8 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
            data-testid="btn-save-block">
            Als Block speichern
          </button>
          <button onClick={() => setSelectedPositions(new Set())}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Side Tools */}
      <div className="mb-3 lg:mb-4 flex gap-2 flex-wrap lg:hidden mt-4">
        <select
          value=""
          onChange={(e) => {
            const allItems = [...(articles || []), ...(services || [])];
            const item = allItems.find(a => a.id === e.target.value);
            if (item) { addFromStamm(item); toast.success(`"${item.name}" hinzugefügt`); }
          }}
          className="h-8 rounded-sm border border-input bg-card px-2 text-xs flex-1 min-w-0"
          data-testid="mobile-add-item"
        >
          <option value="">+ Aus Stammdaten</option>
          <optgroup label="Leistungen">
            {(services || []).map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.price_net}€){a.typ === "Fremdleistung" ? " [Sub]" : ""}</option>
            ))}
          </optgroup>
          <optgroup label="Artikel">
            {(articles || []).map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.price_net}€)</option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
};

export { PositionsTable };
