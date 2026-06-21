import { useEffect, useMemo, useState } from "react";
import { Share2, Search, RefreshCw, Link as LinkIcon, ChevronDown, MessageSquare, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";
import PortalStatusBadge from "@/components/module_portal_wizard/PortalStatusBadge";

/**
 * PortalWizardAdminPage — Zentraler Arbeitsplatz für das neue Kundenportal
 * (module_portal_wizard). Übersicht aller Kunden mit Portal-Status, Link erstellen,
 * eingegangene Nachrichten/Fotos lesen.
 */
const PortalWizardAdminPage = () => {
  const [kunden, setKunden] = useState([]);
  const [eintraege, setEintraege] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const [linkKunde, setLinkKunde] = useState(null);
  const [linkText, setLinkText] = useState("");
  const [linkResult, setLinkResult] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [kRes, eRes] = await Promise.all([
        api.get("/modules/kunden/data"),
        api.get("/kundenportal/admin/liste"),
      ]);
      setKunden(kRes.data || []);
      setEintraege(eRes.data?.eintraege || []);
    } catch (e) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Neuester Eintrag pro Kunde (Liste ist erstellt_am DESC sortiert)
  const latestByKunde = useMemo(() => {
    const m = {};
    eintraege.forEach((e) => { if (!m[e.kunde_id]) m[e.kunde_id] = e; });
    return m;
  }, [eintraege]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (kunden || [])
      .map((k) => {
        const name = k.firma || `${k.vorname || ""} ${k.nachname || ""}`.trim() || "(ohne Name)";
        return { ...k, _name: name, _entry: latestByKunde[k.id] || null };
      })
      .filter((k) => !q || k._name.toLowerCase().includes(q) || (k.email || "").toLowerCase().includes(q))
      .sort((a, b) => {
        // Kunden mit Eingang/Portal zuerst, dann alphabetisch
        const sa = a._entry ? 0 : 1, sb = b._entry ? 0 : 1;
        return sa - sb || a._name.localeCompare(b._name);
      });
  }, [kunden, latestByKunde, search]);

  const createLink = async () => {
    setLinkBusy(true);
    try {
      const res = await api.post("/kundenportal/link-erstellen", {
        kunde_id: linkKunde.id,
        auftrag_text: linkText.trim(),
      });
      const full = `${window.location.origin}/kundenportal/${res.data.portal_token}`;
      setLinkResult(full);
      toast.success(res.data.mail_sent ? "Link erstellt + Mail an Kunde gesendet" : "Link erstellt (keine Kunden-E-Mail hinterlegt)");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler beim Erstellen");
    } finally {
      setLinkBusy(false);
    }
  };

  const withPortal = rows.filter((r) => r._entry).length;

  return (
    <div className="pb-12" data-testid="portal-wizard-admin-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Kundenportal</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            {loading ? "Lade…" : `${withPortal} mit Portal · ${rows.length} Kunden insgesamt`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="portal-admin-refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kunde suchen…" className="pl-9" data-testid="portal-admin-search" />
      </div>

      {loading ? (
        <Card className="p-6 text-center text-muted-foreground">Lade…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Keine Kunden gefunden.</Card>
      ) : (
        <div className="grid gap-2">
          {rows.map((k) => {
            const e = k._entry;
            const open = expandedId === k.id;
            return (
              <Card key={k.id} className="overflow-hidden" data-testid={`portal-admin-row-${k.id}`}>
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{k._name}</span>
                      <PortalStatusBadge status={e?.status || null} />
                    </div>
                    {k.email && <div className="text-xs text-muted-foreground truncate">{k.email}</div>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => { setLinkKunde(k); setLinkText(""); setLinkResult(""); }}
                    data-testid={`portal-admin-create-${k.id}`}
                  >
                    <LinkIcon className="w-4 h-4" /> Link erstellen
                  </Button>
                  {e && (
                    <button
                      onClick={() => setExpandedId(open ? null : k.id)}
                      className="p-1.5 rounded-sm hover:bg-muted"
                      data-testid={`portal-admin-expand-${k.id}`}
                      title="Eingänge anzeigen"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>

                {e && open && (
                  <div className="border-t bg-muted/30 p-3 space-y-2 text-sm" data-testid={`portal-admin-detail-${k.id}`}>
                    {e.auftrag_text && <div><span className="text-muted-foreground">Auftrag:</span> {e.auftrag_text}</div>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {e.erstellt_am && <span>Erstellt: {e.erstellt_am.slice(0, 16).replace("T", " ")}</span>}
                      {e.geoeffnet_am && <span>Geöffnet: {e.geoeffnet_am.slice(0, 16).replace("T", " ")}</span>}
                      {e.genutzt_am && <span>Genutzt: {e.genutzt_am.slice(0, 16).replace("T", " ")}</span>}
                    </div>
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <span>{e.nachricht || <span className="text-muted-foreground italic">keine Nachricht</span>}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Camera className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <span>
                        {e.fotos && e.fotos.length > 0
                          ? `${e.fotos.length} Foto(s): ${e.fotos.join(", ")}`
                          : <span className="text-muted-foreground italic">keine Fotos</span>}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!linkKunde} onClose={() => setLinkKunde(null)} title="🔗 Portal-Link erstellen" size="sm">
        <div className="p-4 space-y-4" data-testid="portal-admin-link-dialog">
          {!linkResult ? (
            <>
              <p className="text-sm text-muted-foreground">
                Für <strong>{linkKunde?.firma || `${linkKunde?.vorname || ""} ${linkKunde?.nachname || ""}`}</strong>.
                Der Kunde bekommt automatisch eine Mail mit dem Link{linkKunde?.email ? ` an ${linkKunde.email}` : " (keine E-Mail hinterlegt)"}.
              </p>
              <div>
                <label className="text-sm font-medium block mb-1">Auftrag-Text</label>
                <Textarea value={linkText} onChange={(e) => setLinkText(e.target.value)} rows={3} placeholder="z.B. Bitte schicken Sie Fotos vom Schaden" data-testid="portal-admin-link-text" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setLinkKunde(null)}>Abbrechen</Button>
                <Button disabled={linkBusy} onClick={createLink} data-testid="portal-admin-link-submit">
                  {linkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link erstellen"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3" data-testid="portal-admin-link-result">
              <p className="text-sm font-medium text-emerald-700">✅ Link erstellt:</p>
              <div className="flex items-center gap-2">
                <Input value={linkResult} readOnly className="text-sm" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkResult); toast.success("Link kopiert"); }}>Kopieren</Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setLinkKunde(null)}>Fertig</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PortalWizardAdminPage;
export { PortalWizardAdminPage };
