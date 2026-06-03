import { useState, useMemo } from "react";
import { X, FileCheck2, AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const SEVERITY_META = {
  error: { color: "text-red-700 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-200", icon: <AlertCircle className="w-4 h-4" /> },
  warning: { color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:text-amber-200", icon: <AlertTriangle className="w-4 h-4" /> },
  info: { color: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-200", icon: <Info className="w-4 h-4" /> },
};

const renderDiff = (orig, corr) => {
  // Sehr einfacher Wort-Diff zur Hervorhebung
  if (orig === corr) return <span>{corr}</span>;
  const ow = orig.split(/(\s+)/);
  const cw = corr.split(/(\s+)/);
  const out = [];
  const max = Math.max(ow.length, cw.length);
  for (let i = 0; i < max; i++) {
    const a = ow[i] ?? "";
    const b = cw[i] ?? "";
    if (a === b) out.push(<span key={i}>{b}</span>);
    else out.push(<mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 px-0.5 rounded">{b}</mark>);
  }
  return out;
};

export const DocumentCheckModal = ({ isOpen, onClose, fields, issues, onApply, onApplyAll, kontextInfo, type, lohnanteilEingetragen, onCreateLohnanteilText }) => {
  const [tab, setTab] = useState("rechtschreibung");
  const [results, setResults] = useState(null); // [{id, label, original, corrected, changed}]
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [lohntextAsk, setLohntextAsk] = useState(true);
  const [lohntextLoading, setLohntextLoading] = useState(false);

  const createLohntext = async () => {
    setLohntextLoading(true);
    try {
      const res = await onCreateLohnanteilText?.();
      if (res !== false) setLohntextAsk(false);
    } finally {
      setLohntextLoading(false);
    }
  };

  const changedResults = useMemo(() => (results || []).filter((r) => r.changed), [results]);
  const errorCount = (issues || []).filter((i) => i.severity === "error").length;
  const warningCount = (issues || []).filter((i) => i.severity === "warning").length;

  const runCheck = async () => {
    setLoading(true);
    setErrorMsg("");
    setResults(null);
    setAppliedIds(new Set());
    try {
      const res = await api.post("/module-textkorrektur/check-document", {
        fields: fields.map((f) => ({ id: f.id, label: f.label, text: f.text || "", kontext: f.kontext || "allgemein" })),
        kontext_info: kontextInfo || undefined,
      });
      setResults(res.data?.results || []);
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || "Prüfung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const apply = (r) => {
    onApply?.(r);
    setAppliedIds((s) => new Set([...s, r.id]));
    toast.success(`${r.label}: Übernommen`);
  };
  const applyAll = (close = false) => {
    const stillOpen = changedResults.filter((r) => !appliedIds.has(r.id));
    onApplyAll?.(stillOpen);
    setAppliedIds((s) => new Set([...s, ...stillOpen.map((r) => r.id)]));
    toast.success(`${stillOpen.length} Korrektur(en) übernommen`);
    if (close) onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm" onClick={onClose} data-testid="docchk-overlay">
      <div onClick={(e) => e.stopPropagation()} className="bg-background border shadow-2xl w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col" data-testid="docchk-modal">
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Dokument prüfen</h2>
              <p className="text-xs text-muted-foreground">Rechtschreibung &amp; Plausibilität</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button onClick={() => setTab("rechtschreibung")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 ${tab === "rechtschreibung" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid="docchk-tab-rs"
          >
            <Sparkles className="w-4 h-4 inline mr-1.5" /> Rechtschreibung
            {results && changedResults.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full bg-amber-100 text-amber-700">{changedResults.length}</span>
            )}
          </button>
          <button onClick={() => setTab("plausibilitaet")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 ${tab === "plausibilitaet" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid="docchk-tab-pl"
          >
            <AlertTriangle className="w-4 h-4 inline mr-1.5" /> Plausibilität
            {(errorCount + warningCount) > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full bg-red-100 text-red-700">{errorCount + warningCount}</span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {tab === "rechtschreibung" && (
            <div data-testid="docchk-pane-rs">
              {!results && !loading && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">Alle Textfelder werden mit GPT-5.2 auf Rechtschreibung &amp; Grammatik geprüft.</p>
                  <button onClick={runCheck} className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:opacity-90" data-testid="btn-docchk-run">
                    <Sparkles className="w-4 h-4 inline mr-1.5" /> Prüfung starten
                  </button>
                </div>
              )}
              {loading && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Dokument wird geprüft...</p>
                </div>
              )}
              {errorMsg && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{errorMsg}</div>}
              {results && results.length > 0 && (
                <>
                  {changedResults.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" />
                      <p className="text-sm font-medium">Alles in Ordnung — keine Fehler gefunden.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-sm">{changedResults.length} Vorschlag/-schläge</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => applyAll(false)} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted" data-testid="btn-docchk-apply-all">
                            Alle übernehmen
                          </button>
                          <button onClick={() => applyAll(true)} className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90" data-testid="btn-docchk-apply-all-close">
                            Alle übernehmen &amp; schließen
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {changedResults.map((r) => {
                          const applied = appliedIds.has(r.id);
                          return (
                            <div key={r.id} className="border rounded-lg p-3" data-testid={`docchk-item-${r.id}`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</span>
                                {applied ? (
                                  <span className="text-xs text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Übernommen</span>
                                ) : (
                                  <button onClick={() => apply(r)} className="text-xs px-2 py-1 rounded border hover:bg-primary hover:text-primary-foreground hover:border-primary" data-testid={`btn-apply-${r.id}`}>Übernehmen</button>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground line-through mb-1 whitespace-pre-wrap">{r.original}</div>
                              <div className="text-sm whitespace-pre-wrap">{renderDiff(r.original, r.corrected)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "plausibilitaet" && (
            <div data-testid="docchk-pane-pl">
              {type === "invoice" && lohnanteilEingetragen && lohntextAsk && (
                <div className="border rounded-lg p-3 mb-3 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800" data-testid="lohntext-frage">
                  <p className="text-sm font-medium mb-2">Soll ich den Lohnanteiltext erstellen?</p>
                  <div className="flex items-center gap-2">
                    <button onClick={createLohntext} disabled={lohntextLoading}
                      className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      data-testid="btn-lohntext-ja">
                      {lohntextLoading ? <Loader2 className="w-4 h-4 inline animate-spin" /> : "Ja"}
                    </button>
                    <button onClick={() => setLohntextAsk(false)} disabled={lohntextLoading}
                      className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted"
                      data-testid="btn-lohntext-nein">
                      Nein
                    </button>
                  </div>
                </div>
              )}
              {(issues || []).length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" />
                  <p className="text-sm font-medium">Keine Plausibilitätsprobleme gefunden.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(issues || []).map((iss, i) => {
                    const meta = SEVERITY_META[iss.severity] || SEVERITY_META.info;
                    return (
                      <div key={i} className={`border rounded-lg px-3 py-2 flex items-start gap-2 ${meta.color}`}>
                        <span className="shrink-0 mt-0.5">{meta.icon}</span>
                        <div className="text-sm">
                          <div className="font-medium">{iss.field}</div>
                          <div className="opacity-90">{iss.message}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
