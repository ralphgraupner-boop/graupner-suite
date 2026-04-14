import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, ChevronDown, Download, Package, FileText, Send, Check, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";

// ==================== ANGEBOTE LIST PAGE ====================
const AngeboteModulPage = () => {
  const [angebote, setAngebote] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editAngebot, setEditAngebot] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadAngebote(); }, []);

  const loadAngebote = async () => {
    try {
      const res = await api.get("/modules/angebote/data");
      setAngebote(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/modules/angebote/data/${id}`);
      toast.success("Angebot geloescht");
      setConfirmDeleteId(null);
      loadAngebote();
    } catch { toast.error("Fehler"); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/modules/angebote/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `angebote_modul_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Daten exportiert");
    } catch { toast.error("Fehler beim Export"); }
  };

  const filtered = angebote.filter((a) => {
    const matchSearch = !search || (a.kontakt_name || "").toLowerCase().includes(search.toLowerCase()) || (a.angebot_nr || "").toLowerCase().includes(search.toLowerCase()) || (a.betreff || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {
    Entwurf: angebote.filter(a => a.status === "Entwurf").length,
    Gesendet: angebote.filter(a => a.status === "Gesendet").length,
    Angenommen: angebote.filter(a => a.status === "Angenommen").length,
    Abgelehnt: angebote.filter(a => a.status === "Abgelehnt").length,
  };

  const statusColors = { Entwurf: "bg-gray-400", Gesendet: "bg-blue-500", Angenommen: "bg-green-500", Abgelehnt: "bg-red-500", Abgelaufen: "bg-amber-500" };
  const statusIcons = { Entwurf: FileText, Gesendet: Send, Angenommen: Check, Abgelehnt: XCircle };

  const totalBrutto = angebote.reduce((sum, a) => sum + (a.brutto || 0), 0);

  return (
    <div data-testid="angebote-modul-page">
      {!showEditor ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
            <div>
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-primary" />
                <h1 className="text-2xl lg:text-4xl font-bold">Angebots-Modul</h1>
                <Badge variant="default" className="text-xs">Solo</Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm lg:text-base">
                {angebote.length} Angebote - Gesamt: {totalBrutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleExport} data-testid="btn-export-angebote">
                <Download className="w-4 h-4" /> Export
              </Button>
              <Button size="sm" className="lg:h-10 lg:px-4" onClick={() => { setEditAngebot(null); setShowEditor(true); }} data-testid="btn-new-angebot">
                <Plus className="w-4 h-4" /> Neues Angebot
              </Button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { key: "", label: "Alle" },
              { key: "Entwurf", label: `Entwurf (${statusCounts.Entwurf})` },
              { key: "Gesendet", label: `Gesendet (${statusCounts.Gesendet})` },
              { key: "Angenommen", label: `Angenommen (${statusCounts.Angenommen})` },
              { key: "Abgelehnt", label: `Abgelehnt (${statusCounts.Abgelehnt})` },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {f.key && <span className={`w-2 h-2 rounded-full ${statusColors[f.key]}`} />}
                {f.label}
              </button>
            ))}
          </div>

          <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 h-9 lg:h-10" placeholder="Angebote durchsuchen..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-angebote" />
            </div>
          </Card>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Laden...</div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>{search || statusFilter ? "Keine Ergebnisse" : "Noch keine Angebote - Erstellen Sie das erste!"}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((angebot) => {
                const StatusIcon = statusIcons[angebot.status] || FileText;
                return (
                  <Card key={angebot.id} className="overflow-hidden hover:shadow-md transition-all" data-testid={`angebot-${angebot.id}`}>
                    <div className="flex items-center gap-4 p-3 lg:p-4">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${statusColors[angebot.status] || "bg-gray-400"}`} />
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <StatusIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-primary">{angebot.angebot_nr}</span>
                          <span className="font-semibold truncate">{angebot.kontakt_name}</span>
                          <Badge variant={angebot.status === "Angenommen" ? "success" : angebot.status === "Abgelehnt" ? "destructive" : "default"} className="text-xs">{angebot.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          {angebot.betreff && <span className="truncate">{angebot.betreff}</span>}
                          <span>{new Date(angebot.created_at).toLocaleDateString("de-DE")}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg">{(angebot.brutto || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
                        <p className="text-xs text-muted-foreground">Brutto</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditAngebot(angebot); setShowEditor(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(angebot.id)}
                          className={`p-2 rounded-sm transition-colors ${confirmDeleteId === angebot.id ? "bg-red-500 text-white" : "hover:bg-destructive/10"}`}
                          title={confirmDeleteId === angebot.id ? "Nochmal klicken" : "Loeschen"}
                        >
                          {confirmDeleteId === angebot.id ? <span className="text-xs font-bold">?</span> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <AngebotEditor
          angebot={editAngebot}
          onClose={() => { setShowEditor(false); setEditAngebot(null); loadAngebote(); }}
        />
      )}
    </div>
  );
};


// ==================== ANGEBOT EDITOR ====================
const AngebotEditor = ({ angebot, onClose }) => {
  const [kontakte, setKontakte] = useState([]);
  const [selectedKontakt, setSelectedKontakt] = useState(null);
  const [kontaktId, setKontaktId] = useState("");
  const [betreff, setBetreff] = useState("");
  const [vortext, setVortext] = useState("");
  const [schlusstext, setSchlusstext] = useState("");
  const [positions, setPositions] = useState([{ type: "position", pos_nr: 1, description: "", quantity: 1, unit: "Stk.", price_net: 0 }]);
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("percent");
  const [validDays, setValidDays] = useState(30);
  const [status, setStatus] = useState("Entwurf");
  const [saving, setSaving] = useState(false);
  const [angebotNr, setAngebotNr] = useState("");

  useEffect(() => {
    loadKontakte();
    if (angebot) {
      setKontaktId(angebot.kontakt_id || "");
      setBetreff(angebot.betreff || "");
      setVortext(angebot.vortext || "");
      setSchlusstext(angebot.schlusstext || "");
      setPositions(angebot.positions?.length ? angebot.positions : [{ type: "position", pos_nr: 1, description: "", quantity: 1, unit: "Stk.", price_net: 0 }]);
      setNotes(angebot.notes || "");
      setVatRate(angebot.vat_rate || 19);
      setDiscount(angebot.discount || 0);
      setDiscountType(angebot.discount_type || "percent");
      setValidDays(angebot.valid_days || 30);
      setStatus(angebot.status || "Entwurf");
      setAngebotNr(angebot.angebot_nr || "");
    }
  }, [angebot]);

  const loadKontakte = async () => {
    try {
      const res = await api.get("/modules/kontakt/data");
      setKontakte(res.data);
      if (angebot?.kontakt_id) {
        const k = res.data.find(c => c.id === angebot.kontakt_id);
        if (k) setSelectedKontakt(k);
      }
    } catch { /* silent */ }
  };

  const handleKontaktChange = (id) => {
    setKontaktId(id);
    const k = kontakte.find(c => c.id === id) || null;
    setSelectedKontakt(k);
  };

  const addPosition = () => {
    const maxNr = Math.max(0, ...positions.filter(p => p.type === "position").map(p => p.pos_nr || 0));
    setPositions([...positions, { type: "position", pos_nr: maxNr + 1, description: "", quantity: 1, unit: "Stk.", price_net: 0 }]);
  };

  const addTitel = () => {
    setPositions([...positions, { type: "titel", pos_nr: 0, description: "" }]);
  };

  const updatePosition = (index, field, value) => {
    const updated = [...positions];
    updated[index] = { ...updated[index], [field]: value };
    setPositions(updated);
  };

  const removePosition = (index) => {
    setPositions(positions.filter((_, i) => i !== index));
  };

  // Berechnungen
  const netto = positions.filter(p => p.type !== "titel").reduce((sum, p) => sum + (p.quantity || 0) * (p.price_net || 0), 0);
  const discountAmount = discountType === "percent" ? netto * discount / 100 : discount;
  const nettoAfterDiscount = netto - discountAmount;
  const mwstAmount = nettoAfterDiscount * vatRate / 100;
  const brutto = nettoAfterDiscount + mwstAmount;

  const handleSave = async () => {
    if (!kontaktId) { toast.error("Bitte Kontakt auswaehlen"); return; }
    if (!positions.some(p => p.type === "position" && p.description)) { toast.error("Mindestens eine Position erforderlich"); return; }

    setSaving(true);
    try {
      const kontaktName = selectedKontakt ? `${selectedKontakt.vorname || ""} ${selectedKontakt.nachname || ""}`.trim() || selectedKontakt.firma : "";
      const kontaktAddr = selectedKontakt ? `${selectedKontakt.strasse || ""} ${selectedKontakt.hausnummer || ""}, ${selectedKontakt.plz || ""} ${selectedKontakt.ort || ""}`.trim() : "";
      
      const payload = {
        kontakt_id: kontaktId,
        kontakt_name: kontaktName,
        kontakt_address: kontaktAddr,
        kontakt_email: selectedKontakt?.email || "",
        kontakt_firma: selectedKontakt?.firma || "",
        betreff, vortext, schlusstext, positions, notes,
        vat_rate: vatRate, discount, discount_type: discountType,
        valid_days: validDays, status,
      };

      if (angebot) {
        await api.put(`/modules/angebote/data/${angebot.id}`, payload);
        toast.success("Angebot aktualisiert");
      } else {
        await api.post("/modules/angebote/data", payload);
        toast.success("Angebot erstellt");
      }
      onClose();
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setSaving(false); }
  };

  const fmt = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div data-testid="angebot-editor">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>Zurueck</Button>
          <h1 className="text-xl font-bold">{angebot ? `Angebot ${angebotNr}` : "Neues Angebot"}</h1>
          {angebot && <Badge>{status}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {angebot && (
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-sm border border-input bg-background px-3 text-sm" data-testid="select-angebot-status">
              <option value="Entwurf">Entwurf</option>
              <option value="Gesendet">Gesendet</option>
              <option value="Angenommen">Angenommen</option>
              <option value="Abgelehnt">Abgelehnt</option>
            </select>
          )}
          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-angebot">
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hauptbereich */}
        <div className="lg:col-span-2 space-y-4">
          {/* Kontakt aus Modul */}
          <Card className="p-4">
            <label className="block text-sm font-semibold mb-2">Kontakt (aus Kontakt-Modul)</label>
            {!selectedKontakt ? (
              <select value={kontaktId} onChange={(e) => handleKontaktChange(e.target.value)}
                className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm" data-testid="select-angebot-kontakt">
                <option value="">Kontakt auswaehlen...</option>
                {kontakte.map(k => {
                  const name = `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.firma || "Unbekannt";
                  return <option key={k.id} value={k.id}>{name} {k.kontakt_status ? `(${k.kontakt_status})` : ""}</option>;
                })}
              </select>
            ) : (
              <div className="flex items-start justify-between p-3 bg-muted/30 rounded-sm border">
                <div className="text-sm">
                  <p className="font-semibold">{selectedKontakt.vorname} {selectedKontakt.nachname}</p>
                  {selectedKontakt.firma && <p className="text-muted-foreground">{selectedKontakt.firma}</p>}
                  {selectedKontakt.strasse && <p>{selectedKontakt.strasse} {selectedKontakt.hausnummer}</p>}
                  {(selectedKontakt.plz || selectedKontakt.ort) && <p>{selectedKontakt.plz} {selectedKontakt.ort}</p>}
                  {selectedKontakt.email && <p className="text-muted-foreground">{selectedKontakt.email}</p>}
                </div>
                <button onClick={() => { setSelectedKontakt(null); setKontaktId(""); }} className="text-xs text-muted-foreground hover:text-foreground">Aendern</button>
              </div>
            )}
          </Card>

          {/* Betreff */}
          <Card className="p-4">
            <label className="block text-sm font-semibold mb-2">Betreff</label>
            <Input value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="z.B. Angebot Fensterreparatur" data-testid="input-angebot-betreff" />
          </Card>

          {/* Vortext */}
          <Card className="p-4">
            <label className="block text-sm font-semibold mb-2">Vortext</label>
            <Textarea value={vortext} onChange={(e) => setVortext(e.target.value)} placeholder="Einleitungstext..." rows={2} />
          </Card>

          {/* Positionen */}
          <Card className="p-4">
            <label className="block text-sm font-semibold mb-3">Positionen</label>
            <div className="space-y-2">
              {positions.map((pos, idx) => (
                <div key={idx} className={`flex items-start gap-2 p-2 rounded-sm border ${pos.type === "titel" ? "bg-muted/50 border-primary/20" : "bg-background"}`}>
                  {pos.type === "titel" ? (
                    <>
                      <span className="text-xs font-bold text-primary mt-2 shrink-0">TITEL</span>
                      <Input className="flex-1" value={pos.description} onChange={(e) => updatePosition(idx, "description", e.target.value)} placeholder="Titel/Abschnitt..." />
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground mt-2.5 w-6 shrink-0 text-center">{pos.pos_nr}</span>
                      <Input className="flex-[3]" value={pos.description} onChange={(e) => updatePosition(idx, "description", e.target.value)} placeholder="Beschreibung..." />
                      <Input className="w-16" type="number" value={pos.quantity} onChange={(e) => updatePosition(idx, "quantity", parseFloat(e.target.value) || 0)} />
                      <select className="w-20 h-10 rounded-sm border border-input bg-background px-2 text-sm" value={pos.unit} onChange={(e) => updatePosition(idx, "unit", e.target.value)}>
                        {["Stk.", "Std.", "m", "m2", "m3", "kg", "Psch.", "km"].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <div className="relative w-24">
                        <Input type="number" value={pos.price_net} onChange={(e) => updatePosition(idx, "price_net", parseFloat(e.target.value) || 0)} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">EUR</span>
                      </div>
                      <span className="text-sm font-medium mt-2.5 w-20 text-right shrink-0">{fmt((pos.quantity || 0) * (pos.price_net || 0))} EUR</span>
                    </>
                  )}
                  <button onClick={() => removePosition(idx)} className="p-1.5 mt-1.5 hover:bg-destructive/10 rounded-sm shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={addPosition} data-testid="btn-add-position">+ Position</Button>
              <Button variant="outline" size="sm" onClick={addTitel}>+ Titel</Button>
            </div>
          </Card>

          {/* Schlusstext */}
          <Card className="p-4">
            <label className="block text-sm font-semibold mb-2">Schlusstext</label>
            <Textarea value={schlusstext} onChange={(e) => setSchlusstext(e.target.value)} placeholder="Abschlusstext..." rows={2} />
          </Card>

          {/* Notizen */}
          <Card className="p-4">
            <label className="block text-sm font-semibold mb-2">Interne Notizen</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nur intern sichtbar..." rows={2} />
          </Card>
        </div>

        {/* Sidebar - Kalkulation */}
        <div className="space-y-4">
          <Card className="p-4 sticky top-4">
            <h3 className="font-bold mb-4">Kalkulation</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Netto</span>
                <span className="font-medium">{fmt(netto)} EUR</span>
              </div>

              {/* Rabatt */}
              <div className="flex items-center gap-2">
                <span className="text-sm">Rabatt</span>
                <Input className="w-16 h-8 text-sm" type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
                <select className="h-8 rounded-sm border border-input bg-background px-2 text-sm" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="percent">%</option>
                  <option value="amount">EUR</option>
                </select>
                {discountAmount > 0 && <span className="text-sm text-red-500 ml-auto">-{fmt(discountAmount)} EUR</span>}
              </div>

              {nettoAfterDiscount !== netto && (
                <div className="flex justify-between text-sm">
                  <span>Netto nach Rabatt</span>
                  <span className="font-medium">{fmt(nettoAfterDiscount)} EUR</span>
                </div>
              )}

              {/* MwSt */}
              <div className="flex items-center gap-2">
                <span className="text-sm">MwSt</span>
                <Input className="w-16 h-8 text-sm" type="number" value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)} />
                <span className="text-sm">%</span>
                <span className="text-sm ml-auto">{fmt(mwstAmount)} EUR</span>
              </div>

              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold text-lg">Brutto</span>
                <span className="font-bold text-lg">{fmt(brutto)} EUR</span>
              </div>

              {/* Gueltigkeit */}
              <div className="border-t pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Gueltig</span>
                  <Input className="w-16 h-8 text-sm" type="number" value={validDays} onChange={(e) => setValidDays(parseInt(e.target.value) || 30)} />
                  <span className="text-sm">Tage</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export { AngeboteModulPage };
