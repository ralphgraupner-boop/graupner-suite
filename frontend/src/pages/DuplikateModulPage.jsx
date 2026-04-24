import { useState, useEffect } from "react";
import { Copy, RefreshCw, ArrowLeft, ShieldCheck, Eye, AlertTriangle, FileText, Wrench, Camera, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";

/**
 * Duplikate-Modul – Übersicht, Vergleich, Merge & Audit-Log
 * Module-First: spricht ausschließlich /api/module-duplikate/*
 */
const DuplikateModulPage = () => {
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState({ pair_count: 0, pairs: [], total_kunden_scanned: 0, ignored_count: 0 });
  const [selectedPair, setSelectedPair] = useState(null); // {a_id, b_id}
  const [showLog, setShowLog] = useState(false);

  const loadScan = async () => {
    setLoading(true);
    try {
      const res = await api.get("/module-duplikate/scan");
      setScan(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadScan(); }, []);

  const handleIgnore = async (a_id, b_id) => {
    if (!window.confirm("Dieses Paar als 'kein Duplikat' markieren? Es taucht in der Liste nicht mehr auf.")) return;
    try {
      await api.post("/module-duplikate/ignore", { a_id, b_id });
      toast.success("Paar markiert");
      loadScan();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  return (
    <div data-testid="duplikate-modul-page" className="pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Copy className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Duplikate bereinigen</h1>
            <Badge className="bg-amber-100 text-amber-700 border-amber-300">NEU</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            {loading ? "Scanne…" : (
              <>
                {scan.pair_count} potentielle Duplikat-Paare · {scan.total_kunden_scanned} Kunden gescannt · {scan.ignored_count} ignoriert
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowLog(true)} data-testid="btn-show-merge-log">
            <FileText className="w-4 h-4" /> Merge-Log
          </Button>
          <Button size="sm" onClick={loadScan} disabled={loading} data-testid="btn-rescan">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Neu scannen
          </Button>
        </div>
      </div>

      <Card className="p-3 lg:p-4 mb-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">Sicher arbeiten</div>
            <div className="text-amber-800 mt-1">
              Kunden werden beim Verschmelzen <strong>nicht gelöscht</strong>, sondern archiviert
              (wiederherstellbar). Du entscheidest pro Feld manuell, welcher Wert gewinnt.
              Dokumente, Einsätze, Fotos &amp; Notizen bleiben beim ursprünglichen Datensatz –
              du siehst im Vergleich, wie viele dranhängen, und triffst die Entscheidung.
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 text-center text-muted-foreground">Lade Paare…</Card>
      ) : scan.pairs.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state">
          <ShieldCheck className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <div className="text-lg font-semibold">Keine Duplikate gefunden</div>
          <div className="text-sm text-muted-foreground mt-1">
            Alle aktiven Kunden sind eindeutig.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {scan.pairs.map((pair) => (
            <PairRow
              key={pair.pair_key}
              pair={pair}
              onOpen={() => setSelectedPair({ a_id: pair.a.id, b_id: pair.b.id })}
              onIgnore={() => handleIgnore(pair.a.id, pair.b.id)}
            />
          ))}
        </div>
      )}

      {selectedPair && (
        <MergeModal
          aId={selectedPair.a_id}
          bId={selectedPair.b_id}
          onClose={() => setSelectedPair(null)}
          onDone={() => { setSelectedPair(null); loadScan(); }}
        />
      )}

      {showLog && <MergeLogModal onClose={() => setShowLog(false)} />}
    </div>
  );
};

// ==================== Paar-Zeile ====================
const REASON_LABELS = {
  email: "Gleiche E-Mail",
  name_plz: "Name + PLZ",
  name_phone: "Name + Telefon",
};

const PairRow = ({ pair, onOpen, onIgnore }) => (
  <Card className="p-3 lg:p-4 hover:shadow-md transition-shadow" data-testid={`pair-row-${pair.pair_key}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {pair.reasons.map((r) => (
          <Badge key={r} className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
            {REASON_LABELS[r] || r}
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onIgnore} data-testid={`btn-ignore-${pair.pair_key}`}>
          Kein Duplikat
        </Button>
        <Button size="sm" onClick={onOpen} data-testid={`btn-open-${pair.pair_key}`}>
          <Eye className="w-4 h-4" /> Vergleichen &amp; Zusammenführen
        </Button>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      <KundenCard k={pair.a} label="A" />
      <KundenCard k={pair.b} label="B" />
    </div>
  </Card>
);

const KundenCard = ({ k, label }) => (
  <div className="border rounded-md p-3 bg-slate-50">
    <div className="flex items-center justify-between mb-1">
      <div className="font-semibold text-slate-900">{k.name}</div>
      <Badge variant="outline" className="text-xs">{label}</Badge>
    </div>
    <div className="text-xs text-slate-600 space-y-0.5">
      {k.email && <div>📧 {k.email}</div>}
      {k.phone && <div>📱 {k.phone}</div>}
      {(k.plz || k.ort) && <div>📍 {k.plz} {k.ort}</div>}
      {k.firma && <div>🏢 {k.firma}</div>}
      {k.source && <div>🔖 Quelle: {k.source}</div>}
      {k.kontakt_status && <div>🏷️ {k.kontakt_status}</div>}
      {k.created_at && <div>🕒 {k.created_at.slice(0, 10)}</div>}
    </div>
  </div>
);

// ==================== Merge-Modal (Feld-für-Feld) ====================
// Felder, die im Vergleich angezeigt werden (in dieser Reihenfolge)
const COMPARE_FIELDS = [
  { key: "anrede", label: "Anrede" },
  { key: "vorname", label: "Vorname" },
  { key: "nachname", label: "Nachname" },
  { key: "firma", label: "Firma" },
  { key: "email", label: "E-Mail" },
  { key: "phone", label: "Telefon" },
  { key: "mobile", label: "Mobil" },
  { key: "strasse", label: "Straße" },
  { key: "hausnummer", label: "Hausnr." },
  { key: "plz", label: "PLZ" },
  { key: "ort", label: "Ort" },
  { key: "land", label: "Land" },
  { key: "kontakt_status", label: "Status" },
  { key: "kategorie", label: "Kategorie" },
  { key: "notes", label: "Notizen", multiline: true },
];

const MergeModal = ({ aId, bId, onClose, onDone }) => {
  const [data, setData] = useState(null); // {a, b, stats}
  const [winner, setWinner] = useState(null); // "a" oder "b"
  const [choices, setChoices] = useState({}); // {field: "a" | "b" | "custom"}
  const [customValues, setCustomValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/module-duplikate/pair?a_id=${aId}&b_id=${bId}`);
        setData(res.data);
      } catch (err) {
        toast.error(err?.response?.data?.detail || err.message);
        onClose();
      }
    })();
  }, [aId, bId]);

  if (!data) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Duplikate zusammenführen" size="xl">
        <div className="p-6 text-center text-muted-foreground">Lade Daten…</div>
      </Modal>
    );
  }

  const { a, b, stats } = data;

  const getValue = (field) => {
    const choice = choices[field];
    if (choice === "custom") return customValues[field] ?? "";
    if (choice === "b") return b[field] ?? "";
    if (choice === "a") return a[field] ?? "";
    return undefined; // nicht entschieden
  };

  // Vorauswahl: wenn Winner gewählt ist, setze alle Felder standardmäßig auf den Winner,
  // aber wenn das Winner-Feld leer ist und der Verlierer einen Wert hat, nimm den Verlierer.
  const selectWinner = (w) => {
    setWinner(w);
    const preset = {};
    const other = w === "a" ? "b" : "a";
    const winnerDoc = w === "a" ? a : b;
    const loserDoc = w === "a" ? b : a;
    COMPARE_FIELDS.forEach(({ key }) => {
      const wv = winnerDoc[key];
      const lv = loserDoc[key];
      if ((wv === undefined || wv === null || wv === "") && (lv !== undefined && lv !== null && lv !== "")) {
        preset[key] = other;
      } else {
        preset[key] = w;
      }
    });
    setChoices(preset);
  };

  const handleMerge = async () => {
    if (!winner) {
      toast.error("Bitte wähle zuerst den Sieger (A oder B).");
      return;
    }
    const winner_id = winner === "a" ? a.id : b.id;
    const loser_id = winner === "a" ? b.id : a.id;
    const merged_fields = {};
    COMPARE_FIELDS.forEach(({ key }) => {
      const v = getValue(key);
      if (v !== undefined) merged_fields[key] = v;
    });
    setSaving(true);
    try {
      await api.post("/module-duplikate/merge", { winner_id, loser_id, merged_fields });
      toast.success("Duplikate erfolgreich zusammengeführt");
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Duplikate zusammenführen – Feld für Feld entscheiden" size="xl">
      <div className="p-4 space-y-4">
        {/* Sieger-Auswahl */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <WinnerCard
            kunde={a}
            label="A"
            isWinner={winner === "a"}
            stats={stats[a.id]}
            onSelect={() => selectWinner("a")}
          />
          <WinnerCard
            kunde={b}
            label="B"
            isWinner={winner === "b"}
            stats={stats[b.id]}
            onSelect={() => selectWinner("b")}
          />
        </div>

        {!winner && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
            ℹ️ Wähle oben, welcher Datensatz der Sieger ist. Der Verlierer wird nach dem Merge archiviert
            (nicht gelöscht) und erhält einen Verweis auf den Sieger.
          </div>
        )}

        {winner && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700 mt-2">Felder abgleichen:</div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm" data-testid="merge-field-table">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left p-2">Feld</th>
                    <th className="text-left p-2">A</th>
                    <th className="text-left p-2">B</th>
                    <th className="text-left p-2 w-40">Übernehmen</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_FIELDS.map(({ key, label, multiline }) => {
                    const va = a[key] ?? "";
                    const vb = b[key] ?? "";
                    const equal = String(va) === String(vb);
                    const choice = choices[key];
                    return (
                      <tr key={key} className={`border-t ${equal ? "bg-slate-50" : ""}`} data-testid={`field-row-${key}`}>
                        <td className="p-2 font-medium text-slate-600">{label}</td>
                        <td className="p-2">
                          <CellValue value={va} multiline={multiline} selected={choice === "a"} />
                        </td>
                        <td className="p-2">
                          <CellValue value={vb} multiline={multiline} selected={choice === "b"} />
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <ChoiceButton active={choice === "a"} onClick={() => setChoices({ ...choices, [key]: "a" })}>A</ChoiceButton>
                            <ChoiceButton active={choice === "b"} onClick={() => setChoices({ ...choices, [key]: "b" })}>B</ChoiceButton>
                            <ChoiceButton
                              active={choice === "custom"}
                              onClick={() => {
                                setChoices({ ...choices, [key]: "custom" });
                                if (customValues[key] === undefined) {
                                  setCustomValues({ ...customValues, [key]: va || vb || "" });
                                }
                              }}
                            >
                              Eigen
                            </ChoiceButton>
                          </div>
                          {choice === "custom" && (
                            multiline ? (
                              <textarea
                                className="mt-1 w-full text-xs border rounded px-2 py-1"
                                value={customValues[key] ?? ""}
                                onChange={(e) => setCustomValues({ ...customValues, [key]: e.target.value })}
                                rows={2}
                                data-testid={`custom-${key}`}
                              />
                            ) : (
                              <input
                                className="mt-1 w-full text-xs border rounded px-2 py-1"
                                value={customValues[key] ?? ""}
                                onChange={(e) => setCustomValues({ ...customValues, [key]: e.target.value })}
                                data-testid={`custom-${key}`}
                              />
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="btn-cancel-merge">
            <ArrowLeft className="w-4 h-4" /> Abbrechen
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!winner || saving}
            data-testid="btn-confirm-merge"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving ? "Verschmelze…" : "Jetzt verschmelzen"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const WinnerCard = ({ kunde, label, isWinner, stats, onSelect }) => (
  <button
    onClick={onSelect}
    data-testid={`btn-winner-${label.toLowerCase()}`}
    className={`text-left border-2 rounded-md p-3 transition-all ${isWinner ? "border-green-500 bg-green-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
  >
    <div className="flex items-center justify-between mb-1">
      <div className="font-semibold">Datensatz {label}</div>
      {isWinner && <Badge className="bg-green-600 text-white">Sieger</Badge>}
    </div>
    <div className="text-sm font-semibold">{kunde.name || `${kunde.vorname || ""} ${kunde.nachname || ""}`.trim() || "(ohne Name)"}</div>
    <div className="text-xs text-slate-600 mt-1">
      {kunde.email && <div>{kunde.email}</div>}
      {kunde.phone && <div>{kunde.phone}</div>}
      {(kunde.plz || kunde.ort) && <div>{kunde.plz} {kunde.ort}</div>}
    </div>
    {stats && (
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1 text-slate-700"><FileText className="w-3 h-3" />{stats.dokumente_v2} Dok.</span>
        <span className="flex items-center gap-1 text-slate-700"><Wrench className="w-3 h-3" />{stats.einsaetze} Einsätze</span>
        <span className="flex items-center gap-1 text-slate-700"><Camera className="w-3 h-3" />{stats.monteur_fotos} Fotos</span>
        <span className="flex items-center gap-1 text-slate-700"><StickyNote className="w-3 h-3" />{stats.monteur_notizen} Notizen</span>
      </div>
    )}
  </button>
);

const CellValue = ({ value, multiline, selected }) => {
  const v = value === null || value === undefined ? "" : String(value);
  const display = v === "" ? <span className="italic text-slate-400">leer</span> : (
    multiline ? <span className="whitespace-pre-wrap break-words">{v}</span> : v
  );
  return (
    <div className={`${selected ? "font-semibold text-green-800" : "text-slate-700"} text-xs break-words`}>
      {display}
    </div>
  );
};

const ChoiceButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-2 py-0.5 text-xs rounded border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
  >
    {children}
  </button>
);

// ==================== Log-Modal ====================
const MergeLogModal = ({ onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/module-duplikate/log");
        setItems(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return (
    <Modal isOpen={true} onClose={onClose} title="Merge-Log (Audit-Trail)" size="lg">
      <div className="p-4">
        {loading ? (
          <div className="text-muted-foreground">Lade…</div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground">Noch keine Verschmelzungen durchgeführt.</div>
        ) : (
          <div className="space-y-2" data-testid="merge-log-list">
            {items.map((it) => (
              <div key={it.id} className="border rounded p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{it.winner_name}</span>
                    <span className="text-slate-500"> ← </span>
                    <span className="line-through text-slate-500">{it.loser_name}</span>
                  </div>
                  <div className="text-xs text-slate-500">{it.timestamp?.slice(0, 16).replace("T", " ")}</div>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {it.merged_field_keys?.length || 0} Felder übernommen · von {it.executed_by}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DuplikateModulPage;
export { DuplikateModulPage };
