import { useEffect, useMemo, useState } from "react";
import { Share2, Search, RefreshCw, Link as LinkIcon, ChevronDown, MessageSquare, Camera, Loader2, Download, Send, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Modal } from "@/components/common";
import { api } from "@/lib/api";
import { useF1Help } from "@/lib/useF1Help";
import PortalStatusBadge from "@/components/module_portal_wizard/PortalStatusBadge";

/**
 * PortalWizardAdminPage — Zentraler Arbeitsplatz für das neue Kundenportal.
 * Übersicht aller Kunden mit Portal-Status, Link erstellen, eingegangene
 * Nachrichten/Fotos lesen, Status setzen und dem Kunden antworten.
 */

const ADMIN_STATUS = {
  neu: { label: "Neu", chip: "bg-red-50 text-red-700 border-red-200" },
  gesehen: { label: "Gesehen", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  in_bearbeitung: { label: "In Bearbeitung", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  erledigt: { label: "Erledigt", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const AdminStatusBadge = ({ status }) => {
  const s = ADMIN_STATUS[status];
  if (!s) return null;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.chip}`} data-testid={`admin-status-badge-${status}`}>{s.label}</span>;
};

const fmt = (s) => (s ? s.slice(0, 16).replace("T", " ") : "");

const PortalWizardAdminPage = () => {
  useF1Help("hilfe_kundenportal");
  const [kunden, setKunden] = useState([]);
  const [eintraege, setEintraege] = useState([]);
  const [vorlagen, setVorlagen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [fotosById, setFotosById] = useState({});   // {eintrag_id: {fotos, fotos_data}}
  const [fotosBusy, setFotosBusy] = useState(null);

  const [linkKunde, setLinkKunde] = useState(null);
  const [linkText, setLinkText] = useState("");
  const [linkResult, setLinkResult] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const [antwortEintrag, setAntwortEintrag] = useState(null);
  const [antwortText, setAntwortText] = useState("");
  const [antwortBusy, setAntwortBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [kRes, eRes] = await Promise.all([
        api.get("/modules/kunden/data"),
        api.get("/kundenportal/admin/liste"),
      ]);
      setKunden(kRes.data || []);
      setEintraege(eRes.data?.eintraege || []);
      api.get("/modules/textvorlagen/data?doc_type=kundenportal&text_type=portal_nachricht")
        .then(r => setVorlagen(r.data || [])).catch(() => {});
    } catch (e) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
        // Ungelesene Eingänge zuerst, dann Einträge mit Portal, dann alphabetisch
        const ua = a._entry?.admin_status === "neu" ? 0 : 1;
        const ub = b._entry?.admin_status === "neu" ? 0 : 1;
        const pa = a._entry ? 0 : 1, pb = b._entry ? 0 : 1;
        return ua - ub || pa - pb || a._name.localeCompare(b._name);
      });
  }, [kunden, latestByKunde, search]);

  const patchEntry = (id, patch) =>
    setEintraege((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const setStatus = async (id, admin_status) => {
    try {
      await api.patch(`/kundenportal/admin/${id}/status`, { admin_status });
      patchEntry(id, { admin_status });
    } catch {
      toast.error("Status konnte nicht gesetzt werden");
    }
  };

  const loadFotos = async (id) => {
    if (fotosById[id]) return;
    setFotosBusy(id);
    try {
      const r = await api.get(`/kundenportal/admin/${id}/fotos`);
      setFotosById((prev) => ({ ...prev, [id]: r.data }));
    } catch {
      toast.error("Fotos konnten nicht geladen werden");
    } finally {
      setFotosBusy(null);
    }
  };

  const toggleExpand = (k) => {
    const entry = k._entry;
    if (!entry) return;
    const opening = expandedId !== k.id;
    setExpandedId(opening ? k.id : null);
    if (opening) {
      if ((entry.fotos_count || 0) > 0) loadFotos(entry.id);
      if (entry.admin_status === "neu") setStatus(entry.id, "gesehen"); // automatisch als gesehen
    }
  };

  const downloadFoto = (dataUrl, name) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name || "foto.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sendAntwort = async () => {
    if (!antwortText.trim()) { toast.error("Bitte Text eingeben"); return; }
    setAntwortBusy(true);
    try {
      const r = await api.post(`/kundenportal/admin/${antwortEintrag.id}/antwort`, { text: antwortText.trim() });
      patchEntry(antwortEintrag.id, {
        admin_status: "in_bearbeitung",
        antworten: [...(antwortEintrag.antworten || []), r.data.antwort],
      });
      toast.success(r.data.mail_sent ? "Antwort an Kunde gesendet" : "Antwort gespeichert (keine Kunden-E-Mail)");
      setAntwortEintrag(null);
      setAntwortText("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Antwort fehlgeschlagen");
    } finally {
      setAntwortBusy(false);
    }
  };

  const createLink = async () => {
    setLinkBusy(true);
    try {
      const res = await api.post("/kundenportal/link-erstellen", { kunde_id: linkKunde.id, auftrag_text: linkText.trim() });
      setLinkResult(`${window.location.origin}/kundenportal/${res.data.portal_token}`);
      toast.success(res.data.mail_sent ? "Link erstellt + Mail an Kunde gesendet" : "Link erstellt (keine Kunden-E-Mail hinterlegt)");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler beim Erstellen");
    } finally {
      setLinkBusy(false);
    }
  };

  const withPortal = rows.filter((r) => r._entry).length;
  const neuCount = rows.filter((r) => r._entry?.admin_status === "neu").length;

  return (
    <div className="pb-12" data-testid="portal-wizard-admin-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Kundenportal</h1>
            {neuCount > 0 && <span className="rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5" data-testid="portal-admin-neu-count">{neuCount} neu</span>}
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{loading ? "Lade…" : `${withPortal} mit Portal · ${rows.length} Kunden insgesamt`}</p>
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
            const fotos = e ? (fotosById[e.id]?.fotos_data || []) : [];
            const hasReply = e?.status === "genutzt"; // Kunde hat geantwortet
            return (
              <Card key={k.id} className={`overflow-hidden ${e?.admin_status === "neu" ? "border-red-300" : ""}`} data-testid={`portal-admin-row-${k.id}`}>
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{k._name}</span>
                      <PortalStatusBadge status={e?.status || null} />
                      <AdminStatusBadge status={e?.admin_status} />
                    </div>
                    {k.email && <div className="text-xs text-muted-foreground truncate">{k.email}</div>}
                  </div>
                  <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => { setLinkKunde(k); setLinkText(""); setLinkResult(""); }} data-testid={`portal-admin-create-${k.id}`}>
                    <LinkIcon className="w-4 h-4" /> Link erstellen
                  </Button>
                  {e && (
                    <button onClick={() => toggleExpand(k)} className="p-1.5 rounded-sm hover:bg-muted" data-testid={`portal-admin-expand-${k.id}`} title="Eingänge anzeigen">
                      <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>

                {e && open && (
                  <div className="border-t bg-muted/30 p-3 space-y-3 text-sm" data-testid={`portal-admin-detail-${k.id}`}>
                    {e.auftrag_text && <div><span className="text-muted-foreground">Auftrag:</span> {e.auftrag_text}</div>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {e.erstellt_am && <span>Erstellt: {fmt(e.erstellt_am)}</span>}
                      {e.geoeffnet_am && <span>Geöffnet: {fmt(e.geoeffnet_am)}</span>}
                      {e.genutzt_am && <span>Genutzt: {fmt(e.genutzt_am)}</span>}
                    </div>

                    {/* ① Nachricht */}
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="whitespace-pre-wrap">{e.nachricht || <span className="text-muted-foreground italic">keine Nachricht</span>}</span>
                    </div>

                    {/* ② Fotos */}
                    <div className="flex items-start gap-2">
                      <Camera className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        {(e.fotos_count || 0) === 0 ? (
                          <span className="text-muted-foreground italic">keine Fotos</span>
                        ) : fotosBusy === e.id ? (
                          <span className="text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /> Fotos werden geladen…</span>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid={`portal-admin-fotos-${k.id}`}>
                            {fotos.map((d, i) => (
                              <div key={i} className="relative group">
                                <img src={d} alt={`Foto ${i + 1}`} className="h-24 w-full rounded-lg object-cover border" />
                                <button onClick={() => downloadFoto(d, fotosById[e.id]?.fotos?.[i] || `foto_${i + 1}.jpg`)} className="absolute bottom-1 right-1 bg-black/60 text-white rounded p-1" data-testid={`portal-admin-foto-download-${k.id}-${i}`} title="Herunterladen">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Antwort-Verlauf */}
                    {(e.antworten || []).length > 0 && (
                      <div className="rounded-lg border bg-background p-2 space-y-1" data-testid={`portal-admin-antworten-${k.id}`}>
                        <div className="text-xs font-medium text-muted-foreground">Ihre Antworten ({e.antworten.length})</div>
                        {e.antworten.map((a, i) => (
                          <div key={i} className="text-xs border-l-2 border-emerald-300 pl-2">
                            <span className="text-muted-foreground">{fmt(a.gesendet_am)}{a.mail_sent ? " · per Mail" : " · nicht gesendet"}:</span> <span className="whitespace-pre-wrap">{a.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ③ Status + ① als gelesen + ④ Antworten */}
                    {hasReply && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="text-xs text-muted-foreground">Status:</label>
                        <select value={e.admin_status || "neu"} onChange={(ev) => setStatus(e.id, ev.target.value)} className="border rounded-sm px-2 py-1 text-sm bg-background" data-testid={`portal-admin-status-select-${k.id}`}>
                          {Object.entries(ADMIN_STATUS).map(([val, s]) => <option key={val} value={val}>{s.label}</option>)}
                        </select>
                        {e.admin_status === "neu" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(e.id, "gesehen")} data-testid={`portal-admin-mark-read-${k.id}`}>
                            <CheckCheck className="w-4 h-4" /> Als gelesen
                          </Button>
                        )}
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setAntwortEintrag(e); setAntwortText(""); }} data-testid={`portal-admin-antwort-${k.id}`}>
                          <Send className="w-4 h-4" /> Antwort schicken
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Portal-Link erstellen */}
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
                {vorlagen.length > 0 && (
                  <select className="w-full mb-2 border rounded-sm px-2 py-2 text-sm bg-background" data-testid="portal-admin-vorlage-select" defaultValue="" onChange={(e) => { const v = vorlagen.find((x) => x.id === e.target.value); if (v) setLinkText(v.content || ""); }}>
                    <option value="">— Vorhandene Vorlage wählen —</option>
                    {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                )}
                <Textarea value={linkText} onChange={(e) => setLinkText(e.target.value)} rows={3} placeholder="z.B. Bitte schicken Sie Fotos vom Schaden" data-testid="portal-admin-link-text" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setLinkKunde(null)}>Abbrechen</Button>
                <Button disabled={linkBusy} onClick={createLink} data-testid="portal-admin-link-submit">{linkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link erstellen"}</Button>
              </div>
            </>
          ) : (
            <div className="space-y-3" data-testid="portal-admin-link-result">
              <p className="text-sm font-medium text-emerald-700">✅ Link erstellt:</p>
              <div className="flex items-center gap-2">
                <Input value={linkResult} readOnly className="text-sm" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkResult); toast.success("Link kopiert"); }}>Kopieren</Button>
              </div>
              <div className="flex justify-end"><Button onClick={() => setLinkKunde(null)}>Fertig</Button></div>
            </div>
          )}
        </div>
      </Modal>

      {/* ④ Antwort schicken */}
      <Modal isOpen={!!antwortEintrag} onClose={() => setAntwortEintrag(null)} title="Antwort an Kunden" size="sm">
        <div className="p-4 space-y-4" data-testid="portal-admin-antwort-dialog">
          <p className="text-sm text-muted-foreground">
            Antwort an <strong>{antwortEintrag?.kunde_name}</strong>{antwortEintrag?.kunde_email ? ` (${antwortEintrag.kunde_email})` : " — keine E-Mail hinterlegt"}.
          </p>
          {vorlagen.length > 0 && (
            <select className="w-full border rounded-sm px-2 py-2 text-sm bg-background" data-testid="portal-admin-antwort-vorlage" defaultValue="" onChange={(e) => { const v = vorlagen.find((x) => x.id === e.target.value); if (v) setAntwortText(v.content || ""); }}>
              <option value="">— Textbaustein wählen —</option>
              {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          )}
          <Textarea value={antwortText} onChange={(e) => setAntwortText(e.target.value)} rows={5} placeholder="Ihre Nachricht an den Kunden…" data-testid="portal-admin-antwort-text" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAntwortEintrag(null)}>Abbrechen</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={antwortBusy} onClick={sendAntwort} data-testid="portal-admin-antwort-submit">
              {antwortBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Senden</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PortalWizardAdminPage;
export { PortalWizardAdminPage };
