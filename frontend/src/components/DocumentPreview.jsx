import { useState, useEffect, useMemo } from "react";
import { Download, Mail, Edit, CheckCircle, X, Send, MailCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Badge } from "@/components/common";
import { api, API } from "@/lib/api";

/* ── A4 page simulation constants ── */
const PAGE_WIDTH = 700;
const PAGE_HEIGHT = Math.round(PAGE_WIDTH * (297 / 210)); // ~990
const PAD_Y = 52;
const PAD_X = 48;
const USABLE = PAGE_HEIGHT - PAD_Y * 2; // ~886

/* height estimates (px) */
const HEADER_H = 340;
const TBL_HEAD_H = 38;
const ROW_BASE = 38;
const ROW_LINE = 17;
const TITEL_H = 42;
const TOTALS_H = 180;
const SCHLUSS_LINE = 22;
const FOOTER_H = 110;
const VALID_H = 28;
const CONT_HEADER_H = 32;

const estPosH = (p) => {
  if (p.type === "titel") return TITEL_H;
  const lines = (p.description || "").split("\n");
  let total = 0;
  lines.forEach((l) => { total += Math.max(1, Math.ceil((l.length || 1) / 55)); });
  return ROW_BASE + Math.max(0, total - 1) * ROW_LINE;
};

/* ── Component ── */
const DocumentPreview = ({ isOpen, onClose, document: doc, type, onDownload, onEdit, onCreateDunning }) => {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ to_email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [emailHistory, setEmailHistory] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (isOpen && doc) {
      api.get(`/email/log/${type}/${doc.id}`).then((r) => setEmailHistory(r.data)).catch(() => {});
      api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    }
  }, [isOpen, doc, type]);

  const titles = { quote: "Angebot", order: "Auftragsbestätigung", invoice: "Rechnung" };
  const numberLabels = { quote: "Angebots-Nr.", order: "Auftrags-Nr.", invoice: "Rechnungs-Nr." };

  /* ── Pagination logic ── */
  const { pages, numbering, totalPages } = useMemo(() => {
    if (!doc) return { pages: [], numbering: [], totalPages: 0 };
    const pos = doc.positions || [];

    // numbering
    const hasTitel = pos.some((p) => p.type === "titel");
    let tN = 0, pT = 0, fN = 0;
    const nums = pos.map((p) => {
      if (p.type === "titel") { tN++; pT = 0; return String(tN); }
      if (hasTitel) { pT++; return tN > 0 ? `${tN}.${pT}` : String(pT); }
      fN++; return String(fN);
    });

    // bottom area height
    const bottomH =
      TOTALS_H + FOOTER_H +
      (doc.schlusstext ? Math.ceil(doc.schlusstext.split("\n").length) * SCHLUSS_LINE + 16 : 0) +
      (doc.valid_until || doc.due_date ? VALID_H : 0);

    const result = [];
    let i = 0, pgNum = 0;

    while (i <= pos.length) {
      const isFirst = pgNum === 0;
      let budget = USABLE;
      if (isFirst) budget -= HEADER_H; else budget -= CONT_HEADER_H;
      budget -= TBL_HEAD_H;

      const start = i;
      while (i < pos.length) {
        const h = estPosH(pos[i]);
        if (budget < h && i > start) break;
        budget -= h;
        i++;
      }

      const isLast = i >= pos.length;
      if (isLast) {
        if (budget < bottomH && i > start) {
          result.push({ s: start, e: i, first: isFirst, last: false });
          result.push({ s: i, e: i, first: false, last: true });
        } else {
          result.push({ s: start, e: i, first: isFirst, last: true });
        }
      } else {
        result.push({ s: start, e: i, first: isFirst, last: false });
      }
      pgNum++;
      if (isLast) break;
    }

    if (!result.length) result.push({ s: 0, e: 0, first: true, last: true });
    return { pages: result, numbering: nums, totalPages: result.length };
  }, [doc]);

  if (!isOpen || !doc) return null;
  const docNumber = doc.quote_number || doc.order_number || doc.invoice_number;

  const handleSendEmail = async () => {
    if (!emailForm.to_email) { toast.error("Bitte E-Mail-Adresse eingeben"); return; }
    setSending(true);
    try {
      await api.post(`/email/document/${type}/${doc.id}`, {
        to_email: emailForm.to_email,
        subject: emailForm.subject || `${titles[type]} ${docNumber}`,
        message: emailForm.message,
      });
      toast.success(`${titles[type]} per E-Mail gesendet`);
      setShowEmailDialog(false);
      setEmailForm({ to_email: "", subject: "", message: "" });
      api.get(`/email/log/${type}/${doc.id}`).then((r) => setEmailHistory(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err?.response?.data?.detail || "E-Mail konnte nicht gesendet werden");
    } finally { setSending(false); }
  };

  /* ── Reusable render helpers ── */
  const renderTableHead = () => (
    <thead>
      <tr className="border-b-2 border-primary/20">
        <th className="text-left py-2.5 text-xs font-semibold text-primary w-10">Pos</th>
        <th className="text-left py-2.5 text-xs font-semibold text-primary">Beschreibung</th>
        <th className="text-right py-2.5 text-xs font-semibold text-primary w-16">Menge</th>
        <th className="text-left py-2.5 text-xs font-semibold text-primary w-16 pl-2">Einheit</th>
        <th className="text-right py-2.5 text-xs font-semibold text-primary w-20">EP</th>
        <th className="text-right py-2.5 text-xs font-semibold text-primary w-20">Gesamt</th>
      </tr>
    </thead>
  );

  const renderRow = (pos, gIdx) => {
    if (pos.type === "titel") {
      return (
        <tr key={gIdx} className="border-b bg-amber-50/60">
          <td className="py-2.5 text-xs font-bold text-primary">{numbering[gIdx]}</td>
          <td className="py-2.5 text-xs font-bold text-primary" colSpan={5}>{pos.description}</td>
        </tr>
      );
    }
    return (
      <tr key={gIdx} className="border-b border-slate-100">
        <td className="py-2.5 text-xs align-top">{numbering[gIdx]}</td>
        <td className="py-2.5 text-xs align-top whitespace-pre-line [&::first-line]:font-bold">{pos.description}</td>
        <td className="py-2.5 text-xs text-right font-mono align-top pr-1">{pos.quantity}</td>
        <td className="py-2.5 text-xs align-top pl-1">{pos.unit}</td>
        <td className="py-2.5 text-xs text-right font-mono align-top">{pos.price_net?.toFixed(2)} €</td>
        <td className="py-2.5 text-xs text-right font-mono align-top">{((pos.quantity || 0) * (pos.price_net || 0)).toFixed(2)} €</td>
      </tr>
    );
  };

  const renderTotals = () => (
    <div className="flex justify-end mt-4 mb-4">
      <div className="w-56 space-y-1.5">
        <div className="flex justify-between py-1.5">
          <span className="text-xs text-muted-foreground">Netto</span>
          <span className="text-xs font-mono">{doc.subtotal_net?.toFixed(2)} €</span>
        </div>
        {doc.discount > 0 && (
          <div className="flex justify-between py-1.5">
            <span className="text-xs text-muted-foreground">
              Rabatt {doc.discount_type === "percent" ? `(${doc.discount}%)` : ""}
            </span>
            <span className="text-xs font-mono text-red-600">
              -{doc.discount_type === "percent" ? (doc.subtotal_net * doc.discount / 100).toFixed(2) : doc.discount.toFixed(2)} €
            </span>
          </div>
        )}
        <div className="flex justify-between py-1.5">
          <span className="text-xs text-muted-foreground">MwSt ({doc.vat_rate}%)</span>
          <span className="text-xs font-mono">{doc.vat_amount?.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between py-2.5 border-t-2 border-primary font-bold text-sm">
          <span>Gesamt</span>
          <span className="font-mono">{doc.total_gross?.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="pt-3 border-t text-[10px] text-muted-foreground grid grid-cols-3 gap-3 mt-auto">
      <div>
        <p className="font-bold">{settings.company_name || "Tischlerei Graupner"}</p>
        {settings.owner_name && <p>Inh. {settings.owner_name}</p>}
        {(settings.address || "").split("\n").map((l, i) => <p key={i}>{l.trim()}</p>)}
      </div>
      <div>
        {settings.phone && <p>Tel: {settings.phone}</p>}
        {settings.email && <p>{settings.email}</p>}
        {settings.website && <p>{settings.website}</p>}
        {settings.tax_id && <p>St.-Nr.: {settings.tax_id}</p>}
      </div>
      <div>
        {settings.bank_name && <p>{settings.bank_name}</p>}
        {settings.iban && <p>IBAN: {settings.iban}</p>}
        {settings.bic && <p>BIC: {settings.bic}</p>}
      </div>
    </div>
  );

  const renderHeader = () => (
    <>
      {/* Briefkopf */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-baseline gap-0.5 mb-0.5">
            <span className="text-xl font-bold tracking-tight" style={{ color: "#1a1a1a" }}>Tischlerei</span>
            <span className="text-xl font-bold tracking-tight" style={{ color: "#003399" }}>Graupner</span>
            <span className="text-[9px] font-semibold ml-1" style={{ color: "#cc0000" }}>seit 1960</span>
          </div>
          <p className="text-[9px] font-medium tracking-wide mb-2" style={{ color: "#003399" }}>
            Mitglied der Handwerkskammer Hamburg
          </p>
          <div className="max-w-[280px]">
            <p className="text-[8px] text-muted-foreground border-b border-muted-foreground/30 pb-0.5 mb-1.5 tracking-wide">
              {settings.company_name || "Tischlerei Graupner"} · {(settings.address || "Erlengrund 129\n22453 Hamburg").split("\n").map((l) => l.trim()).join(" · ")}
            </p>
            <p className="font-semibold text-xs">{doc.customer_name}</p>
            {doc.customer_address && (
              <p className="text-xs whitespace-pre-line leading-snug">
                {doc.customer_address.includes("\n") ? doc.customer_address : doc.customer_address.split(/,\s*/).join("\n")}
              </p>
            )}
          </div>
        </div>
        <div className="text-right text-[10px] font-medium" style={{ color: "#003399" }}>
          <p className="font-bold">{settings.company_name || "Tischlerei Graupner"}</p>
          {(settings.address || "Erlengrund 129\n22453 Hamburg").split("\n").map((l, i) => <p key={i}>{l.trim()}</p>)}
          <p>Tel.: {settings.phone || "040 55567744"}</p>
          <p>{settings.email || "Service24@tischlerei-graupner.de"}</p>
          <p>{settings.website || "www.tischlerei-graupner.de"}</p>
          {settings.tax_id && <p>Steuernummer: {settings.tax_id}</p>}
          <div className="mt-1.5 pt-1.5 border-t border-blue-200 space-y-0.5">
            <p>Kd.-Nr.: {doc.customer_id ? doc.customer_id.substring(0, 8).toUpperCase() : "-"}</p>
            <p>Datum: {new Date(doc.created_at).toLocaleDateString("de-DE")}</p>
            <p>{numberLabels[type]}: {docNumber}</p>
          </div>
        </div>
      </div>

      {/* Doc Nr + Betreff */}
      <p className="text-base font-bold mb-0.5 mt-8" style={{ color: "#003399" }}>
        {numberLabels[type]}: {docNumber}
      </p>
      {doc.betreff && (
        <p className="font-bold text-sm mb-2" style={{ color: "#003399" }}>{doc.betreff}</p>
      )}
      {doc.vortext && <p className="text-xs mb-3 whitespace-pre-line leading-relaxed">{doc.vortext}</p>}
    </>
  );

  const allPos = doc.positions || [];

  /* ── JSX ── */
  return (
    <div className="fixed inset-0 z-50 flex flex-col" data-testid="document-preview-modal">
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-white border-b shadow-sm z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">{titles[type]} {docNumber}</h2>
          <Badge variant={doc.status === "Bezahlt" ? "success" : doc.status === "Offen" ? "warning" : "default"}>
            {doc.status}
          </Badge>
          <span className="text-xs text-muted-foreground">{totalPages} {totalPages === 1 ? "Seite" : "Seiten"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => { onClose(); onEdit(doc); }}>
              <Edit className="w-3.5 h-3.5 mr-1" /> Bearbeiten
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            setEmailForm({ to_email: doc.customer_email || "", subject: `${titles[type]} ${docNumber}`, message: "" });
            setShowEmailDialog(true);
          }} data-testid="btn-email-document">
            <Mail className="w-3.5 h-3.5 mr-1" /> E-Mail
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDownload?.(doc.id, docNumber)}>
            <Download className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
          {onCreateDunning && doc.status === "Überfällig" && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { onClose(); onCreateDunning(doc); }} data-testid="btn-create-dunning-preview">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Mahnung
            </Button>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-sm ml-1" data-testid="btn-close-preview">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Email Dialog ── */}
      {showEmailDialog && (
        <div className="shrink-0 p-4 border-b bg-blue-50" data-testid="email-dialog">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4" /> {titles[type]} per E-Mail senden
          </h3>
          <div className="space-y-2">
            <Input data-testid="input-email-to" placeholder="E-Mail-Adresse" value={emailForm.to_email}
              onChange={(e) => setEmailForm({ ...emailForm, to_email: e.target.value })} type="email" />
            <Input data-testid="input-email-subject" placeholder="Betreff (optional)" value={emailForm.subject}
              onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} />
            <Textarea data-testid="input-email-message" placeholder="Nachricht (optional)" value={emailForm.message}
              onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} rows={2} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(false)}>Abbrechen</Button>
              <Button size="sm" onClick={handleSendEmail} disabled={sending} data-testid="btn-send-email">
                {sending ? "Senden..." : "Senden"} <Send className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pages Area ── */}
      <div className="flex-1 overflow-auto" style={{ background: "#4a4a4f" }}>
        <div className="flex flex-col items-center py-6 px-4 gap-5">
          {pages.map((pg, pgIdx) => (
            <div
              key={pgIdx}
              className="bg-white shadow-xl flex flex-col"
              style={{
                width: PAGE_WIDTH,
                maxWidth: "100%",
                minHeight: PAGE_HEIGHT,
                padding: `${PAD_Y}px ${PAD_X}px`,
                boxSizing: "border-box",
                position: "relative",
              }}
              data-testid={`preview-page-${pgIdx + 1}`}
            >
              {/* ── Page content ── */}
              <div className="flex-1">
                {pg.first && renderHeader()}

                {!pg.first && (
                  <div className="mb-3 pb-1.5 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {titles[type]} {docNumber} — Fortsetzung
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {doc.customer_name}
                    </span>
                  </div>
                )}

                {/* positions table for this page */}
                {pg.e > pg.s && (
                  <table className="w-full mb-3">
                    {renderTableHead()}
                    <tbody>
                      {allPos.slice(pg.s, pg.e).map((pos, li) => renderRow(pos, pg.s + li))}
                    </tbody>
                  </table>
                )}

                {/* Only first page with positions but table continues → show note */}
                {!pg.last && pg.e > pg.s && (
                  <p className="text-[10px] text-muted-foreground text-right italic mt-1">— Fortsetzung nächste Seite —</p>
                )}

                {/* ── Totals + Footer on last page ── */}
                {pg.last && (
                  <>
                    {renderTotals()}
                    {doc.schlusstext && <p className="text-xs whitespace-pre-line mb-3 leading-relaxed">{doc.schlusstext}</p>}
                    {doc.valid_until && (
                      <p className="text-xs font-semibold">Gültig bis: {new Date(doc.valid_until).toLocaleDateString("de-DE")}</p>
                    )}
                    {doc.due_date && (
                      <p className="text-xs font-semibold">Zahlbar bis: {new Date(doc.due_date).toLocaleDateString("de-DE")}</p>
                    )}
                  </>
                )}
              </div>

              {/* ── Page footer area ── */}
              <div className="mt-auto">
                {pg.last && <div className="mt-6">{renderFooter()}</div>}
                <p className="text-center text-[9px] text-muted-foreground mt-3">
                  Seite {pgIdx + 1} von {totalPages}
                </p>
              </div>
            </div>
          ))}

          {/* ── Email History (outside pages) ── */}
          {emailHistory.length > 0 && (
            <div className="w-full rounded-sm p-4 bg-white/90 backdrop-blur" style={{ maxWidth: PAGE_WIDTH }} data-testid="email-history">
              <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <MailCheck className="w-4 h-4" /> Versandhistorie ({emailHistory.length})
              </p>
              <div className="space-y-2">
                {emailHistory.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-xs p-2 bg-muted/30 rounded-sm">
                    <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${log.status === "gesendet" ? "text-green-500" : "text-red-500"}`} />
                    <span className="text-muted-foreground">
                      {new Date(log.sent_at).toLocaleDateString("de-DE")}{" "}
                      {new Date(log.sent_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="truncate">An: {log.to_email}</span>
                    <Badge variant={log.status === "gesendet" ? "success" : "danger"} className="text-xs ml-auto shrink-0">
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { DocumentPreview };
