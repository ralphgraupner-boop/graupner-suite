import { useEffect, useState, useCallback } from "react";
import { Card, Button } from "@/components/common";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Eye, FileCheck, Printer, Trash2, CheckCircle, ExternalLink } from "lucide-react";

const fmtEUR = (v) => `${Number(v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("de-DE") : "";

const StatusBadge = ({ status }) => {
  const styles = {
    "Offen": "bg-amber-100 text-amber-800",
    "Bezahlt": "bg-green-100 text-green-800",
    "Überfällig": "bg-red-100 text-red-800",
    "Storniert": "bg-gray-100 text-gray-600",
  };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-muted"}`}>{status}</span>;
};

export const RechnungenV2Page = () => {
  const [rechnungen, setRechnungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, oRes] = await Promise.all([
        api.get("/v2/rechnungen"),
        api.get("/orders"),
      ]);
      setRechnungen(rRes.data || []);
      setOrders(oRes.data || []);
    } catch {
      toast.error("Fehler beim Laden");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createFromOrder = async (orderId, mode) => {
    try {
      const res = await api.post(`/v2/rechnungen/from-order/${orderId}?mode=${mode}`);
      toast.success(`Rechnung ${res.data.invoice_number} erstellt`);
      setShowCreateDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen");
    }
  };

  const openPDF = async (rid) => {
    try {
      const tk = localStorage.getItem("token");
      const url = `${api.defaults.baseURL}/v2/rechnungen/${rid}/pdf?t=${Date.now()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch {
      toast.error("PDF konnte nicht geöffnet werden");
    }
  };

  const togglePrinted = async (r) => {
    const next = !r.is_printed;
    const msg = r.is_printed
      ? "Gedruckt-Markierung entfernen? Die Rechnung wird dann wieder bearbeitbar."
      : "Als 'Gedruckt' markieren?\n\nDanach ist die Rechnung aus GoBD-Sicht verbindlich und wird nicht mehr änderbar.";
    if (!window.confirm(msg)) return;
    try {
      await api.put(`/v2/rechnungen/${r.id}/print-status`, { is_printed: next });
      toast.success(next ? "Als gedruckt markiert" : "Markierung entfernt");
      load();
    } catch (err) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const markPaid = async (rid) => {
    try {
      await api.put(`/v2/rechnungen/${rid}/status`, { status: "Bezahlt" });
      toast.success("Als bezahlt markiert");
      load();
    } catch { toast.error("Fehler"); }
  };

  const del = async (r) => {
    if (!window.confirm(`Rechnung ${r.invoice_number} löschen?`)) return;
    try {
      await api.delete(`/v2/rechnungen/${r.id}`);
      toast.success("Gelöscht");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler");
    }
  };

  return (
    <div data-testid="rechnungen-v2-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl lg:text-4xl font-bold">Rechnungen (Neu)</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400 text-amber-950 rounded-full">BETA</span>
          </div>
          <p className="text-sm text-muted-foreground">GoBD-konforme Rechnungen mit Verweis auf Angebot/Auftragsbestätigung. Parallel zum alten Rechnungs-Modul.</p>
        </div>
        <Button data-testid="btn-new-rv2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" /> Rechnung erstellen
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Lade...</div>
      ) : rechnungen.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">Noch keine Rechnungen in diesem Modul.</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4" /> Erste Rechnung aus Auftragsbestätigung erstellen
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {rechnungen.map((r) => (
            <Card key={r.id} className="p-4" data-testid={`rv2-row-${r.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{r.invoice_number}</span>
                    <StatusBadge status={r.status} />
                    {r.is_printed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full">
                        <FileCheck className="w-3 h-3" /> Gedruckt
                      </span>
                    )}
                    {r.mode === "kurz" && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded-full">
                        Kurz-Rechnung
                      </span>
                    )}
                    {r.kleinbetrag && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium rounded-full">
                        Kleinbetrag &lt; 250 €
                      </span>
                    )}
                  </div>
                  <p className="font-semibold mt-1">{r.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{r.betreff}</p>
                  {r.verweis_text && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{r.verweis_text}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Rechnungsdatum: {fmtDate(r.invoice_date)}</span>
                    <span>Leistungsdatum: {r.leistungsdatum}</span>
                    <span className="font-semibold text-foreground">Brutto: {fmtEUR(r.brutto)}</span>
                    {r.deposit_amount > 0 && <span>Anzahlung: {fmtEUR(r.deposit_amount)}</span>}
                    {r.deposit_amount > 0 && <span className="font-semibold text-foreground">Rest: {fmtEUR(r.final_amount)}</span>}
                  </div>
                </div>

                <div className="flex gap-1">
                  <button onClick={() => openPDF(r.id)} className="p-2 hover:bg-muted rounded-sm" title="PDF öffnen" data-testid={`btn-pdf-${r.id}`}>
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => togglePrinted(r)} className={`p-2 rounded-sm ${r.is_printed ? "bg-blue-100 text-blue-700" : "hover:bg-muted"}`} title={r.is_printed ? "Gedruckt-Markierung entfernen" : "Als gedruckt markieren"} data-testid={`btn-printed-${r.id}`}>
                    {r.is_printed ? <FileCheck className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
                  </button>
                  {r.status === "Offen" && (
                    <button onClick={() => markPaid(r.id)} className="p-2 hover:bg-green-100 text-green-700 rounded-sm" title="Als bezahlt markieren">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {!r.is_printed && (
                    <button onClick={() => del(r)} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm" title="Löschen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateDialog
          orders={orders}
          onClose={() => setShowCreateDialog(false)}
          onCreate={createFromOrder}
        />
      )}
    </div>
  );
};

const CreateDialog = ({ orders, onClose, onCreate }) => {
  const [orderId, setOrderId] = useState("");
  const [mode, setMode] = useState("kurz");
  const selectedOrder = orders.find(o => o.id === orderId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-2xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-1">Rechnung aus Auftragsbestätigung</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Wählen Sie eine bestehende Auftragsbestätigung. Die Rechnung wird mit passenden Verweisen auf AB + Angebot vorausgefüllt.
        </p>

        <label className="block text-sm font-medium mb-1">Auftragsbestätigung</label>
        <select
          data-testid="select-order"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="w-full h-10 rounded-sm border border-input bg-background px-3 mb-4"
        >
          <option value="">-- bitte wählen --</option>
          {orders.map(o => (
            <option key={o.id} value={o.id}>
              {o.order_number} · {o.customer_name} · {o.betreff} · {fmtEUR(o.total_net || 0)} netto
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium mb-2">Rechnungs-Variante</label>
        <div className="space-y-2 mb-6">
          <label className={`flex items-start gap-3 p-3 border rounded-sm cursor-pointer ${mode === "kurz" ? "border-primary bg-primary/5" : "border-input"}`}>
            <input type="radio" name="mode" value="kurz" checked={mode === "kurz"} onChange={() => setMode("kurz")} className="mt-1" data-testid="radio-mode-kurz" />
            <div>
              <p className="font-medium">Kurz-Rechnung mit Verweis</p>
              <p className="text-xs text-muted-foreground">Eine Zeile „Leistung laut AB Nr. XY vom …". Gesamtbetrag + MwSt + Anzahlungs-Abzug. Spart Zeit, ideal für Stammkunden.</p>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-3 border rounded-sm cursor-pointer ${mode === "voll" ? "border-primary bg-primary/5" : "border-input"}`}>
            <input type="radio" name="mode" value="voll" checked={mode === "voll"} onChange={() => setMode("voll")} className="mt-1" data-testid="radio-mode-voll" />
            <div>
              <p className="font-medium">Vollrechnung mit allen Positionen</p>
              <p className="text-xs text-muted-foreground">Komplette Positions-Tabelle wie in der AB. Für Kunden die Details wollen.</p>
            </div>
          </label>
        </div>

        {selectedOrder && (
          <div className="bg-muted/30 p-3 rounded-sm text-xs mb-4">
            <p><strong>Kunde:</strong> {selectedOrder.customer_name}</p>
            <p><strong>Positionen:</strong> {(selectedOrder.positions || []).length}</p>
            <p><strong>Netto:</strong> {fmtEUR(selectedOrder.total_net || 0)}</p>
            {selectedOrder.deposit_amount > 0 && <p><strong>Anzahlung:</strong> {fmtEUR(selectedOrder.deposit_amount)} (wird automatisch abgezogen)</p>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onCreate(orderId, mode)} disabled={!orderId} data-testid="btn-confirm-create">
            Rechnung erstellen
          </Button>
        </div>
      </div>
    </div>
  );
};
