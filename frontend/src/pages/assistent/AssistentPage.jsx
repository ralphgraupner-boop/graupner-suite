import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, CheckCircle, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, Button, Badge } from "@/components/common";
import { KiChatPanel } from "@/components/KiChatPanel";
import { useF1Help } from "@/lib/useF1Help";

const PRIORITAET_CONFIG = {
  kritisch: { label: "Kritisch", farbe: "bg-red-100 text-red-800 border-red-200" },
  hoch: { label: "Wichtig", farbe: "bg-orange-100 text-orange-800 border-orange-200" },
  hinweis: { label: "Hinweis", farbe: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  info: { label: "Info", farbe: "bg-blue-100 text-blue-800 border-blue-200" },
};

const HinweisKarte = ({ hinweis, onLesen, onIgnorieren, onOeffnen }) => {
  const cfg = PRIORITAET_CONFIG[hinweis.prioritaet] || PRIORITAET_CONFIG.info;
  const istUngelesen = hinweis.status === "ungelesen";
  return (
    <Card
      className={`p-4 ${istUngelesen ? "border-l-4 border-l-primary" : "opacity-75"}`}
      data-testid={`hinweis-${hinweis.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full border ${cfg.farbe}`}
              data-testid={`hinweis-prio-${hinweis.prioritaet}`}
            >
              {cfg.label}
            </span>
            {istUngelesen && (
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                neu
              </span>
            )}
          </div>
          <h3 className="font-semibold text-base mb-1" data-testid={`hinweis-titel-${hinweis.id}`}>
            {hinweis.titel}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">{hinweis.nachricht}</p>
          <div className="flex flex-wrap gap-2">
            {(hinweis.aktionen || []).map((aktion, i) =>
              aktion.link ? (
                <Button
                  key={i}
                  size="sm"
                  variant="primary"
                  data-testid={`hinweis-aktion-${hinweis.id}-${i}`}
                  onClick={() => onOeffnen(hinweis.id, aktion.link)}
                >
                  {aktion.label}
                </Button>
              ) : (
                <Button
                  key={i}
                  size="sm"
                  variant="secondary"
                  data-testid={`hinweis-aktion-${hinweis.id}-${i}`}
                  onClick={() => onIgnorieren(hinweis.id)}
                >
                  {aktion.label}
                </Button>
              )
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {istUngelesen && (
            <button
              onClick={() => onLesen(hinweis.id)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Als gelesen markieren"
              data-testid={`hinweis-lesen-${hinweis.id}`}
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onIgnorieren(hinweis.id)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Ignorieren"
            data-testid={`hinweis-ignorieren-${hinweis.id}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};

export const AssistentPage = () => {
  useF1Help("hilfe_assistent");
  const navigate = useNavigate();
  const [hinweise, setHinweise] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [zeigeIgnoriert, setZeigeIgnoriert] = useState(false);
  const [ignorierteListe, setIgnorierteListe] = useState([]);

  const laden = async () => {
    try {
      const res = await api.get("/module-assistent/hinweise");
      setHinweise(res.data);
    } catch {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    laden();
  }, []);

  const handleLesen = async (id) => {
    await api.post(`/module-assistent/hinweise/${id}/lesen`).catch(() => {});
    setHinweise((prev) => prev.map((h) => (h.id === id ? { ...h, status: "gelesen" } : h)));
  };

  const handleIgnorieren = async (id) => {
    await api.post(`/module-assistent/hinweise/${id}/ignorieren`).catch(() => {});
    setHinweise((prev) => prev.filter((h) => h.id !== id));
    toast.success("Hinweis ignoriert");
  };

  const handleAlleGelesen = async () => {
    await api.post("/module-assistent/hinweise/alle-lesen").catch(() => {});
    setHinweise((prev) => prev.map((h) => ({ ...h, status: "gelesen" })));
    toast.success("Alle als gelesen markiert");
  };

  const handleOeffnen = (id, link) => {
    handleLesen(id);
    navigate(link);
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.post("/module-assistent/run");
      toast.success(`Check abgeschlossen – ${res.data.hinweise_neu} neue Hinweise`);
      await laden();
    } catch {
      toast.error("Fehler beim Check");
    } finally {
      setRunning(false);
    }
  };

  const ladeIgnoriert = async () => {
    if (!zeigeIgnoriert) {
      const res = await api
        .get("/module-assistent/hinweise?status=ignoriert")
        .catch(() => ({ data: [] }));
      setIgnorierteListe(res.data);
    }
    setZeigeIgnoriert((v) => !v);
  };

  const ungelesen = hinweise.filter((h) => h.status === "ungelesen");
  const gelesen = hinweise.filter((h) => h.status === "gelesen");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="assistent-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div data-testid="assistent-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold">Mein Assistent</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Beobachtet still – meldet nur was wirklich wichtig ist
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ungelesen.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAlleGelesen}
              data-testid="assistent-alle-gelesen-btn"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Alle gelesen
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleRun}
            disabled={running}
            data-testid="assistent-run-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Läuft..." : "Jetzt prüfen"}
          </Button>
        </div>
      </div>

      {/* KI-Chat (Voice-to-Action) */}
      <Card className="p-4 mb-6" data-testid="assistent-ki-chat-card">
        <KiChatPanel showHistory />
      </Card>

      {/* Hinweise-Bereich */}
      {hinweise.length === 0 ? (
        <Card className="p-10 text-center" data-testid="assistent-empty">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <CheckCircle className="w-6 h-6 text-green-700" />
          </div>
          <p className="font-medium">Alles in Ordnung – keine offenen Hinweise.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nächster automatischer Check täglich um 08:00 Uhr.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {ungelesen.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold">
                  Ungelesen
                </h2>
                <Badge variant="primary" data-testid="assistent-ungelesen-count">
                  {ungelesen.length}
                </Badge>
              </div>
              <div className="space-y-3" data-testid="assistent-ungelesen-list">
                {ungelesen.map((h) => (
                  <HinweisKarte
                    key={h.id}
                    hinweis={h}
                    onLesen={handleLesen}
                    onIgnorieren={handleIgnorieren}
                    onOeffnen={handleOeffnen}
                  />
                ))}
              </div>
            </div>
          )}
          {gelesen.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold text-muted-foreground">
                  Gelesen ({gelesen.length})
                </h2>
              </div>
              <div className="space-y-3" data-testid="assistent-gelesen-list">
                {gelesen.map((h) => (
                  <HinweisKarte
                    key={h.id}
                    hinweis={h}
                    onLesen={handleLesen}
                    onIgnorieren={handleIgnorieren}
                    onOeffnen={handleOeffnen}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ignorierte Hinweise – Toggle */}
      <div className="mt-8">
        <button
          onClick={ladeIgnoriert}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="assistent-toggle-ignoriert"
        >
          {zeigeIgnoriert ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          Ignorierte Hinweise {zeigeIgnoriert ? "ausblenden" : "anzeigen"}
        </button>
        {zeigeIgnoriert && (
          <div className="mt-3 space-y-3" data-testid="assistent-ignoriert-list">
            {ignorierteListe.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Keine ignorierten Hinweise vorhanden.
              </p>
            ) : (
              ignorierteListe.map((h) => (
                <HinweisKarte
                  key={h.id}
                  hinweis={h}
                  onLesen={() => {}}
                  onIgnorieren={() => {}}
                  onOeffnen={handleOeffnen}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistentPage;
