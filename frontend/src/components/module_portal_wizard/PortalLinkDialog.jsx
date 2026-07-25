import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { htmlToPlainText } from "@/lib/utils";
import { TextTemplateSelect } from "@/components/TextTemplateSelect";

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
  const [linkText, setLinkText] = useState("");
  const [linkResult, setLinkResult] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const handleTemplateChange = (value) => {
    setLinkText(htmlToPlainText(value || ""));
  };

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
            </div>
            <TextTemplateSelect
              docType="kundenportal"
              textType="portal_nachricht"
              value={linkText}
              onChange={handleTemplateChange}
              customer={kunde}
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
