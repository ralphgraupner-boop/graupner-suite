import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { htmlToPlainText } from "@/lib/utils";

/**
 * PortalLinkDialog — Einheitlicher Portal-Link-Dialog fuer die ganze Suite.
 * Wird von Kundenportal-Uebersicht, Kunden-Modul und Projekte-Werkbank
 * gleichermassen genutzt, damit es nur noch EINE Version dieses Fensters gibt
 * (vorher: drei unabhaengige Kopien mit unterschiedlichem Funktionsumfang).
 *
 * Props:
 *  - kunde: Kunden-Objekt oder null (null = Dialog geschlossen)
 *  - onClose: wird beim Schliessen aufgerufen
 *  - onCreated: optional, wird nach erfolgreichem Erstellen aufgerufen
 *               (z.B. damit die aufrufende Seite ihre eigene Liste neu laedt)
 */
const PortalLinkDialog = ({ kunde, onClose, onCreated }) => {
  const [vorlagen, setVorlagen] = useState([]);
  const [linkText, setLinkText] = useState("");
  const [linkResult, setLinkResult] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  // Bei jedem neuen Kunden: Textfeld und Ergebnis zuruecksetzen
  useEffect(() => {
    if (kunde) {
      setLinkText("");
      setLinkResult("");
    }
  }, [kunde]);

  // Vorlagen einmalig laden
  useEffect(() => {
    api.get("/modules/textvorlagen/data?doc_type=kundenportal&text_type=portal_nachricht")
      .then((r) => setVorlagen(r.data || []))
      .catch(() => {});
  }, []);

  const createLink = async () => {
    setLinkBusy(true);
    try {
      const res = await api.post("/kundenportal/link-erstellen", {
        kunde_id: kunde.id,
        auftrag_text: linkText.trim(),
      });
      setLinkResult(`${window.location.origin}/kundenportal/${res.data.portal_token}`);
      toast.success(res.data.mail_sent ? "Link erstellt + Mail an Kunde gesendet" : "Link erstellt (keine Kunden-E-Mail hinterlegt)");
      onCreated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler beim Erstellen");
    } finally {
      setLinkBusy(false);
    }
  };

  const name = kunde?.firma || `${kunde?.vorname || ""} ${kunde?.nachname || ""}`.trim();

  return (
    <Modal isOpen={!!kunde} onClose={onClose} title="🔗 Portal-Link erstellen" size="sm">
      <div className="p-4 h-full flex flex-col" data-testid="portal-link-dialog">
        {!linkResult ? (
          <>
            <div className="shrink-0 space-y-3 mb-3">
              <p className="text-sm text-muted-foreground">
                Für <strong>{name}</strong>. Der Kunde bekommt automatisch eine Mail mit dem Link
                {kunde?.email ? ` an ${kunde.email}` : " (keine E-Mail hinterlegt)"}.
              </p>
              <div>
                <label className="text-sm font-medium block mb-1">Auftrag-Text (was soll der Kunde tun?)</label>
                {vorlagen.length > 0 && (
                  <select
                    className="w-full mb-2 border rounded-sm px-2 py-2 text-sm bg-background"
                    data-testid="portal-link-vorlage-select"
                    defaultValue=""
                    onChange={(e) => {
                      const v = vorlagen.find((x) => x.id === e.target.value);
                      if (v) setLinkText(htmlToPlainText(v.content || ""));
                    }}
                  >
                    <option value="">— Vorhandene Vorlage wählen —</option>
                    {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                )}
              </div>
            </div>
            <Textarea
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="flex-1 min-h-0 resize-none"
              placeholder="z.B. Bitte schicken Sie Fotos vom Schaden"
              data-testid="portal-link-text-input"
            />
            <div className="shrink-0 flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button disabled={linkBusy} onClick={createLink} data-testid="portal-link-submit">
                {linkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link erstellen"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3" data-testid="portal-link-result">
            <p className="text-sm font-medium text-emerald-700">✅ Link erstellt:</p>
            <div className="flex items-center gap-2">
              <Input value={linkResult} readOnly className="text-sm" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkResult); toast.success("Link kopiert"); }}>Kopieren</Button>
            </div>
            <div className="flex justify-end"><Button onClick={onClose}>Fertig</Button></div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PortalLinkDialog;
