import { useEffect, useState } from "react";
import { Mail, Loader2, X, ArrowDown, ArrowUp, RefreshCw, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/common";
import { api } from "@/lib/api";

/**
 * MailHistoryModal — zeigt alle Mails (ein-/ausgehend) eines Kunden
 * aus allen aktiven IMAP-Postfächern.
 * Props: { isOpen, onClose, email, kundeName? }
 */
const MailHistoryModal = ({ isOpen, onClose, email, kundeName = "" }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [detail, setDetail] = useState(null);  // expanded mail
  const [detailLoading, setDetailLoading] = useState(false);
  const [maxCount, setMaxCount] = useState(30);

  const load = async (max = maxCount) => {
    if (!email) return;
    setLoading(true);
    setDetail(null);
    try {
      const r = await api.post("/module-mail-inbox/customer-mails", { email, max_count: max });
      setItems(r.data?.items || []);
      setCount(r.data?.count || 0);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Mailverlauf laden fehlgeschlagen");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && email) load(maxCount);
    // eslint-disable-next-line
  }, [isOpen, email, maxCount]);

  const openDetail = async (it) => {
    setDetail({ loading: true, _key: `${it.account_id}/${it.folder}/${it.uid}` });
    setDetailLoading(true);
    try {
      const r = await api.post("/module-mail-inbox/mail-detail", {
        account_id: it.account_id,
        folder: it.folder,
        uid: it.uid,
      });
      setDetail({ ...r.data, _meta: it });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Mail-Detail laden fehlgeschlagen");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mailverlauf · ${kundeName || email}`} size="xl">
      <div className="space-y-3" data-testid="mail-history-modal">
        <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
          <div className="text-muted-foreground">
            {email} · letzte 26 Wochen · max {maxCount} Mails {!loading && `· ${count} gefunden`}
          </div>
          <div className="flex gap-1">
            {[15, 30, 60].map((n) => (
              <button
                key={n}
                onClick={() => setMaxCount(n)}
                className={`px-2.5 py-1 text-xs rounded-sm ${maxCount === n ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}
                data-testid={`btn-history-max-${n}`}
              >
                max {n}
              </button>
            ))}
            <button
              onClick={() => load(maxCount)}
              className="px-2.5 py-1 text-xs rounded-sm border hover:bg-accent flex items-center gap-1"
              title="Neu laden"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> IMAP-Suche läuft (5-15 Sek)…
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Keine Mails von/an {email} in den letzten 26 Wochen gefunden.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 max-h-[60vh]">
            {/* Liste links */}
            <div className="lg:col-span-2 overflow-auto space-y-1 pr-1">
              {items.map((it) => {
                const key = `${it.account_id}/${it.folder}/${it.uid}`;
                const isActive = detail?._key === key || detail?._meta?.uid === it.uid;
                return (
                  <button
                    key={key}
                    onClick={() => openDetail(it)}
                    className={`w-full text-left border rounded p-2 text-xs hover:bg-accent/60 ${isActive ? "border-primary bg-primary/5" : ""}`}
                    data-testid={`history-row-${it.uid}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {it.direction === "ein" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">
                          <ArrowDown className="w-2.5 h-2.5" /> ein
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                          <ArrowUp className="w-2.5 h-2.5" /> aus
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{it.account_label}</span>
                    </div>
                    <div className="font-medium mt-1 truncate">{it.subject || "(kein Betreff)"}</div>
                    <div className="text-muted-foreground truncate">
                      {it.direction === "ein" ? `von ${it.from_email}` : `an ${it.to_email}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {it.date?.slice(0, 16).replace("T", " ")}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail rechts */}
            <div className="lg:col-span-3 border-l lg:pl-3 overflow-auto">
              {!detail ? (
                <div className="text-sm text-muted-foreground py-8 text-center flex flex-col items-center gap-2">
                  <ChevronRight className="w-5 h-5" />
                  Wähle eine Mail aus der Liste links.
                </div>
              ) : detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Lade Mail…
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Betreff</div>
                    <div className="font-semibold break-words">{detail.subject || "(kein Betreff)"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Von</div>
                      <div className="break-all">{detail.from_email || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">An</div>
                      <div className="break-all">{detail.to_email || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Datum</div>
                      <div>{detail.date?.slice(0, 16).replace("T", " ") || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Postfach</div>
                      <div>{detail.account_label || "—"}</div>
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <div className="text-xs text-muted-foreground mb-1">Inhalt</div>
                    <pre className="text-xs whitespace-pre-wrap bg-muted/40 rounded-sm p-3 border max-h-[40vh] overflow-auto break-words">
                      {detail.body || "(leer)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MailHistoryModal;
