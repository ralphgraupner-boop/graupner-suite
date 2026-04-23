import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, Hash,
  User, FileDown, AlertCircle, Search, GitBranch, ExternalLink,
} from "lucide-react";

const TYPE_LABEL = {
  angebot: "Angebot",
  auftrag: "Auftragsbestätigung",
  rechnung: "Rechnung",
  gutschrift: "Gutschrift",
};
const TYPE_STRICT = { rechnung: true, gutschrift: true };
const MWST_PRESETS = [19, 7, 0];
const EINHEITEN = ["Stk", "Std", "m", "m²", "m³", "kg", "pauschal"];

// State-Machine: erlaubte Umwandlungen
const ALLOWED_CONVERT = {
  angebot: ["auftrag", "rechnung"],
  auftrag: ["rechnung"],
  rechnung: ["gutschrift"],
  gutschrift: [],
};

const fmtEur = (v) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(v || 0));

const emptyPos = () => ({
  id: crypto.randomUUID(),
  position_nr: "",
  beschreibung: "",
  menge: 1,
  einheit: "Stk",
  einzelpreis: 0,
  rabatt_prozent: 0,
  mwst_satz: 19,
  lohn_anteil: 0,
});

export function DokumenteV2DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dok, setDok] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kundenSuche, setKundenSuche] = useState(false);
  const [kundenList, setKundenList] = useState([]);
  const [kundenQ, setKundenQ] = useState("");
  const [chain, setChain] = useState({ parent: null, children: [] });
  const [convertMenuOpen, setConvertMenuOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dokumente-v2/admin/dokumente/${id}`);
      setDok(res.data);
      setDirty(false);
      // Kette parallel laden (Vorgänger + Nachfolger)
      try {
        const c = await api.get(`/dokumente-v2/admin/dokumente/${id}/chain`);
        setChain(c.data || { parent: null, children: [] });
      } catch { /* nicht kritisch */ }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
      navigate("/dokumente-v2");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const isReadOnly = !!dok && (
    dok.status === "storniert"
    || (TYPE_STRICT[dok.type] && dok.status === "erstellt")
  );

  const patch = (changes) => {
    setDok(d => ({ ...d, ...changes }));
    setDirty(true);
  };

  const patchPos = (idx, changes) => {
    setDok(d => {
      const positions = [...(d.positions || [])];
      positions[idx] = { ...positions[idx], ...changes };
      return { ...d, positions };
    });
    setDirty(true);
  };

  const addPos = () => {
    setDok(d => ({ ...d, positions: [...(d.positions || []), emptyPos()] }));
    setDirty(true);
  };

  const removePos = (idx) => {
    setDok(d => {
      const positions = [...(d.positions || [])];
      positions.splice(idx, 1);
      return { ...d, positions };
    });
    setDirty(true);
  };

  const movePos = (idx, dir) => {
    setDok(d => {
      const positions = [...(d.positions || [])];
      const j = idx + dir;
      if (j < 0 || j >= positions.length) return d;
      [positions[idx], positions[j]] = [positions[j], positions[idx]];
      return { ...d, positions };
    });
    setDirty(true);
  };

  const totals = useMemo(() => {
    let netto = 0, mwst = 0, lohn = 0;
    const groups = {};
    for (const p of dok?.positions || []) {
      const m = Number(p.menge) || 0;
      const ep = Number(p.einzelpreis) || 0;
      const rab = Number(p.rabatt_prozent) || 0;
      const mws = Number(p.mwst_satz) || 0;
      const zNetto = m * ep * (1 - rab / 100);
      const zMwst = zNetto * mws / 100;
      netto += zNetto;
      mwst += zMwst;
      groups[mws] = (groups[mws] || 0) + zMwst;
      lohn += zNetto * (Number(p.lohn_anteil) || 0) / 100;
    }
    return { netto, mwst, groups, brutto: netto + mwst, lohn };
  }, [dok]);

  const save = async () => {
    if (!dok || isReadOnly) return;
    setSaving(true);
    try {
      const body = {
        kunde_id: dok.kunde_id || null,
        kunde_name: dok.kunde_name || "",
        kunde_adresse: dok.kunde_adresse || "",
        kunde_email: dok.kunde_email || "",
        betreff: dok.betreff || "",
        vortext: dok.vortext || "",
        schlusstext: dok.schlusstext || "",
        positions: dok.positions || [],
      };
      const res = await api.put(`/dokumente-v2/admin/dokumente/${id}`, body);
      setDok(res.data);
      setDirty(false);
      toast.success("Gespeichert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const issueDoc = async () => {
    if (dirty && !window.confirm("Es gibt ungespeicherte Änderungen. Erst speichern, dann Nummer vergeben?")) return;
    if (dirty) await save();
    if (!window.confirm(`${TYPE_LABEL[dok.type]} verbindlich erstellen und Nummer vergeben?\n\n${TYPE_STRICT[dok.type] ? "Rechnung/Gutschrift ist danach NICHT mehr änderbar (GoBD)." : "Kann weiterhin bearbeitet werden."}`)) return;
    try {
      const res = await api.post(`/dokumente-v2/admin/dokumente/${id}/issue`);
      toast.success(`Nummer vergeben: ${res.data.nummer}`);
      setDok(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const openPdf = async () => {
    try {
      const res = await api.get(`/dokumente-v2/admin/dokumente/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch (err) {
      toast.error("PDF konnte nicht erzeugt werden");
    }
  };

  const convertTo = async (targetType) => {
    setConvertMenuOpen(false);
    if (dirty && !window.confirm("Es gibt ungespeicherte Änderungen. Erst speichern, dann umwandeln?")) return;
    if (dirty) await save();
    if (!window.confirm(`Neues ${TYPE_LABEL[targetType]} aus diesem ${TYPE_LABEL[dok.type]} erstellen?\n\nPositionen und Kundendaten werden kopiert. Das neue Dokument startet als Entwurf.`)) return;
    try {
      const res = await api.post(`/dokumente-v2/admin/dokumente/${id}/convert`, { target_type: targetType });
      toast.success(`${TYPE_LABEL[targetType]} als Entwurf angelegt`);
      navigate(`/dokumente-v2/${res.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const searchKunden = async () => {
    try {
      const res = await api.get("/dokumente-v2/admin/kunden-suche", { params: { q: kundenQ } });
      setKundenList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const pickKunde = (k) => {
    const name = `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.name || k.firma || "";
    const adresse = [k.strasse, k.hausnummer].filter(Boolean).join(" ");
    const plzort = [k.plz, k.ort].filter(Boolean).join(" ");
    const full = [adresse, plzort].filter(Boolean).join("\n");
    patch({
      kunde_id: k.id,
      kunde_name: name,
      kunde_adresse: full,
      kunde_email: k.email || "",
    });
    setKundenSuche(false);
    setKundenQ("");
    setKundenList([]);
  };

  if (loading || !dok) return <div className="p-10 text-sm text-muted-foreground">Lade…</div>;

  return (
    <div className="space-y-4" data-testid="dokumente-v2-detail">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate("/dokumente-v2")} className="p-2 rounded-lg border hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{TYPE_LABEL[dok.type]}</h1>
            <span className="font-mono text-sm px-2 py-0.5 rounded bg-muted">
              {dok.nummer || "(Entwurf)"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              dok.status === "erstellt" ? "bg-green-100 text-green-700"
              : dok.status === "storniert" ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-700"
            }`}>{dok.status}</span>
            {isReadOnly && (
              <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3 h-3" /> schreibgeschützt
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isReadOnly && (
            <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted text-sm disabled:opacity-50" data-testid="dok-v2-save">
              <Save className="w-4 h-4" /> {saving ? "Speichert…" : dirty ? "Speichern" : "Gespeichert"}
            </button>
          )}
          {dok.status === "entwurf" && (
            <button onClick={issueDoc} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm" data-testid="dok-v2-issue">
              <Hash className="w-4 h-4" /> Erstellen + Nummer
            </button>
          )}
          <button onClick={openPdf} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted text-sm" data-testid="dok-v2-pdf">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {(ALLOWED_CONVERT[dok.type] || []).length > 0 && dok.status !== "storniert" && (
            <div className="relative">
              <button onClick={() => setConvertMenuOpen(v => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-sm" data-testid="dok-v2-convert-btn">
                <GitBranch className="w-4 h-4" /> Umwandeln in…
              </button>
              {convertMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white border rounded-lg shadow-lg z-20" data-testid="dok-v2-convert-menu" onMouseLeave={() => setConvertMenuOpen(false)}>
                  {ALLOWED_CONVERT[dok.type].map(t => (
                    <button
                      key={t}
                      onClick={() => convertTo(t)}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 text-sm border-b last:border-b-0 flex items-center gap-2"
                      data-testid={`dok-v2-convert-to-${t}`}
                    >
                      <GitBranch className="w-4 h-4 text-emerald-600" />
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dokumenten-Kette (Vorgaenger + Nachfolger) */}
      {(chain.parent || (chain.children || []).length > 0) && (
        <div className="border rounded-xl bg-gradient-to-r from-emerald-50/60 to-white p-3 flex flex-wrap items-center gap-2 text-sm" data-testid="dok-v2-chain">
          {chain.parent && (
            <>
              <span className="text-xs text-muted-foreground">Vorgänger:</span>
              <button
                onClick={() => navigate(`/dokumente-v2/${chain.parent.id}`)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border hover:bg-muted font-mono text-xs"
                data-testid={`dok-v2-chain-parent-${chain.parent.id}`}
              >
                <ExternalLink className="w-3 h-3" />
                {TYPE_LABEL[chain.parent.type]} · {chain.parent.nummer || "(Entwurf)"}
              </button>
            </>
          )}
          {chain.parent && (chain.children || []).length > 0 && (
            <span className="text-muted-foreground mx-1">·</span>
          )}
          {(chain.children || []).length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">Nachfolger:</span>
              {chain.children.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/dokumente-v2/${c.id}`)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border hover:bg-muted font-mono text-xs"
                  data-testid={`dok-v2-chain-child-${c.id}`}
                >
                  <ExternalLink className="w-3 h-3" />
                  {TYPE_LABEL[c.type]} · {c.nummer || "(Entwurf)"}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Kunde */}
      <div className="border rounded-xl bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Kunde</div>
          {!isReadOnly && (
            <button onClick={() => { setKundenSuche(v => !v); setKundenList([]); setKundenQ(""); }} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <User className="w-3 h-3" /> Aus Kundenkartei
            </button>
          )}
        </div>
        {kundenSuche && (
          <div className="border rounded-lg p-3 bg-muted/30 space-y-2" data-testid="dok-v2-kunde-search">
            <div className="flex gap-2">
              <input type="text" value={kundenQ} onChange={e => setKundenQ(e.target.value)} placeholder="Name, Firma, Email…" className="flex-1 px-3 py-2 border rounded-lg text-sm" onKeyDown={e => e.key === "Enter" && searchKunden()} />
              <button onClick={searchKunden} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm inline-flex items-center gap-1">
                <Search className="w-4 h-4" /> Suchen
              </button>
            </div>
            {kundenList.length > 0 && (
              <div className="max-h-64 overflow-y-auto divide-y border rounded-lg bg-white">
                {kundenList.map(k => (
                  <button key={k.id} onClick={() => pickKunde(k)} className="w-full text-left px-3 py-2 hover:bg-muted text-sm">
                    <div className="font-medium">{[k.vorname, k.nachname].filter(Boolean).join(" ") || k.name || k.firma}</div>
                    <div className="text-xs text-muted-foreground">{k.email} · {[k.strasse, k.hausnummer, k.plz, k.ort].filter(Boolean).join(" ")}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Name</span>
            <input disabled={isReadOnly} type="text" value={dok.kunde_name || ""} onChange={e => patch({ kunde_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">E-Mail</span>
            <input disabled={isReadOnly} type="email" value={dok.kunde_email || ""} onChange={e => patch({ kunde_email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs text-muted-foreground">Adresse (mehrzeilig)</span>
            <textarea disabled={isReadOnly} rows={2} value={dok.kunde_adresse || ""} onChange={e => patch({ kunde_adresse: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
        </div>
      </div>

      {/* Betreff + Vortext */}
      <div className="border rounded-xl bg-card p-4 space-y-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Betreff</span>
          <input disabled={isReadOnly} type="text" value={dok.betreff || ""} onChange={e => patch({ betreff: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Einleitender Text</span>
          <textarea disabled={isReadOnly} rows={2} value={dok.vortext || ""} onChange={e => patch({ vortext: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </label>
      </div>

      {/* Positionen */}
      <div className="border rounded-xl bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Positionen</div>
          {!isReadOnly && (
            <button onClick={addPos} className="text-sm text-primary hover:underline inline-flex items-center gap-1" data-testid="dok-v2-pos-add">
              <Plus className="w-3 h-3" /> Position hinzufügen
            </button>
          )}
        </div>

        {(dok.positions || []).length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">Noch keine Positionen.</div>
        )}

        <div className="space-y-2">
          {(dok.positions || []).map((p, i) => {
            const zNetto = (Number(p.menge) || 0) * (Number(p.einzelpreis) || 0) * (1 - (Number(p.rabatt_prozent) || 0) / 100);
            return (
              <div key={p.id || i} className="border rounded-lg p-3 bg-muted/20 space-y-2" data-testid={`dok-v2-pos-${i}`}>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground w-12">Pos. {i + 1}</div>
                  <input disabled={isReadOnly} type="text" placeholder="z.B. 01" value={p.position_nr || ""} onChange={e => patchPos(i, { position_nr: e.target.value })} className="w-20 px-2 py-1 border rounded text-sm" />
                  {!isReadOnly && (
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => movePos(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => movePos(i, +1)} disabled={i === dok.positions.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                      <button onClick={() => removePos(i)} className="p-1 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                <textarea disabled={isReadOnly} rows={2} placeholder="Beschreibung…" value={p.beschreibung || ""} onChange={e => patchPos(i, { beschreibung: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <label className="block">
                    <span className="text-[10px] text-muted-foreground uppercase">Menge</span>
                    <input disabled={isReadOnly} type="number" step="0.01" value={p.menge} onChange={e => patchPos(i, { menge: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-muted-foreground uppercase">Einheit</span>
                    <select disabled={isReadOnly} value={p.einheit || "Stk"} onChange={e => patchPos(i, { einheit: e.target.value })} className="w-full px-2 py-1 border rounded text-sm">
                      {EINHEITEN.map(e => <option key={e}>{e}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-muted-foreground uppercase">Einzelpreis</span>
                    <input disabled={isReadOnly} type="number" step="0.01" value={p.einzelpreis} onChange={e => patchPos(i, { einzelpreis: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-muted-foreground uppercase">Rabatt %</span>
                    <input disabled={isReadOnly} type="number" step="0.01" value={p.rabatt_prozent} onChange={e => patchPos(i, { rabatt_prozent: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-muted-foreground uppercase">MwSt %</span>
                    <select disabled={isReadOnly} value={p.mwst_satz} onChange={e => patchPos(i, { mwst_satz: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm">
                      {MWST_PRESETS.map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                  </label>
                  <label className="block" title="Lohnanteil für §35a EStG (z.B. 100% = reine Arbeitsleistung)">
                    <span className="text-[10px] text-muted-foreground uppercase">Lohnanteil %</span>
                    <input disabled={isReadOnly} type="number" step="1" value={p.lohn_anteil} onChange={e => patchPos(i, { lohn_anteil: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" />
                  </label>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  Zeilennetto: <strong className="text-foreground">{fmtEur(zNetto)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summen */}
      <div className="border rounded-xl bg-card p-4">
        <div className="max-w-xs ml-auto space-y-1 text-sm">
          <div className="flex justify-between"><span>Netto</span><span className="font-mono">{fmtEur(totals.netto)}</span></div>
          {Object.entries(totals.groups).map(([k, v]) => (
            <div key={k} className="flex justify-between text-muted-foreground"><span>zzgl. {k}% MwSt.</span><span className="font-mono">{fmtEur(v)}</span></div>
          ))}
          <div className="flex justify-between pt-2 border-t font-bold text-base"><span>Gesamt brutto</span><span className="font-mono">{fmtEur(totals.brutto)}</span></div>
          {totals.lohn > 0 && dok.type === "rechnung" && (
            <div className="text-xs text-muted-foreground pt-1">
              Davon Lohnanteil (§35a): <span className="font-mono">{fmtEur(totals.lohn)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Schlusstext */}
      <div className="border rounded-xl bg-card p-4">
        <label className="block">
          <span className="text-xs text-muted-foreground">Schlusstext</span>
          <textarea disabled={isReadOnly} rows={3} value={dok.schlusstext || ""} onChange={e => patch({ schlusstext: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </label>
      </div>
    </div>
  );
}

export default DokumenteV2DetailPage;
