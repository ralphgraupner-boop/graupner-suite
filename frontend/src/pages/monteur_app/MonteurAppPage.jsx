import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  HardHat, MapPin, Phone, Mail, ChevronRight, RefreshCw, Calendar, Wrench, User as UserIcon,
  Briefcase, Clock, AlertTriangle, CheckCircle2, Folder,
} from "lucide-react";
import { useVersionCheck } from "./useVersionCheck";

const STATUS_LABEL = {
  aktiv: "Aktiv",
  in_bearbeitung: "In Bearbeitung",
  abgeschlossen: "Abgeschlossen",
  inaktiv: "Inaktiv",
};

const STATUS_COLOR = {
  aktiv: "bg-amber-100 text-amber-900 border-amber-300",
  in_bearbeitung: "bg-blue-100 text-blue-900 border-blue-300",
  abgeschlossen: "bg-emerald-100 text-emerald-900 border-emerald-300",
  inaktiv: "bg-gray-100 text-gray-700 border-gray-300",
};

const TERMIN_STATUS = {
  wartet_auf_go: { cls: "bg-amber-100 text-amber-900 border-amber-300", label: "Wartet auf GO" },
  bestaetigt: { cls: "bg-blue-100 text-blue-900 border-blue-300", label: "Bestätigt" },
  im_kalender: { cls: "bg-emerald-100 text-emerald-900 border-emerald-300", label: "Im Kalender" },
  abgesagt: { cls: "bg-red-100 text-red-700 border-red-200", label: "Abgesagt" },
};

const AUFGABE_STATUS = {
  offen: { cls: "bg-amber-100 text-amber-900 border-amber-300", label: "Offen", icon: AlertTriangle },
  in_arbeit: { cls: "bg-blue-100 text-blue-900 border-blue-300", label: "In Arbeit", icon: Clock },
  erledigt: { cls: "bg-emerald-100 text-emerald-900 border-emerald-300", label: "Erledigt", icon: CheckCircle2 },
};

const TYP_LABEL = {
  besichtigung: "Besichtigung",
  ausfuehrung: "Ausführung",
  abnahme: "Abnahme",
  intern: "Intern",
  sonstiges: "Sonstiges",
};

const fmtDateTime = (s) => {
  if (!s) return "";
  try { return new Date(s).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
  catch { return s; }
};

const getMyUsername = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return (u && typeof u === "object") ? (u.username || "") : (typeof u === "string" ? u : "");
  } catch { return ""; }
};

/**
 * Monteur-App – Datenmaske über 3 Module:
 *   - einsaetze (Legacy, weiterhin Hauptarbeit)
 *   - module_termine (NEU – Tab "Termine")
 *   - module_aufgaben (NEU – Tab "Aufgaben")
 */
export function MonteurAppPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("einsaetze");
  const [einsaetze, setEinsaetze] = useState([]);
  const [termine, setTermine] = useState([]);
  const [aufgaben, setAufgaben] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("aktiv");
  const [featureEnabled, setFeatureEnabled] = useState(null);
  const { outdated, reload } = useVersionCheck();
  const me = getMyUsername();

  const load = async () => {
    setLoading(true);
    try {
      // Erst Settings prüfen
      const s = await api.get("/monteur/admin/settings");
      setFeatureEnabled(!!s.data.feature_enabled);
      if (!s.data.feature_enabled) {
        setLoading(false);
        return;
      }

      // Einsätze (Filter)
      const e = await api.get("/monteur/einsaetze", { params: filter ? { status: filter } : {} });
      setEinsaetze(Array.isArray(e.data) ? e.data : []);

      // Termine + Aufgaben parallel (tolerant - Module könnten deaktiviert sein)
      const [t, a] = await Promise.all([
        api.get("/module-termine", { params: me ? { monteur_username: me } : {} }).catch(() => ({ data: [] })),
        api.get("/module-aufgaben", { params: me ? { zugewiesen_an: me } : {} }).catch(() => ({ data: [] })),
      ]);
      setTermine(Array.isArray(t.data) ? t.data : []);
      setAufgaben(Array.isArray(a.data) ? a.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);  // eslint-disable-line

  const enableFeature = async () => {
    try {
      await api.put("/monteur/admin/settings", { feature_enabled: true });
      toast.success("Monteur-App aktiviert");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  // ----- Aktionen für Termine -----
  const onTerminGo = async (t) => {
    if (!window.confirm(`"${t.titel}" am ${fmtDateTime(t.start)} bestätigen?`)) return;
    try {
      await api.patch(`/module-termine/${t.id}/go`);
      toast.success("Termin bestätigt – Admin kann jetzt in Kalender übertragen");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "GO fehlgeschlagen");
    }
  };

  // ----- Aktionen für Aufgaben -----
  const setAufgabeStatus = async (a, status) => {
    try {
      await api.patch(`/module-aufgaben/${a.id}/status`, { status });
      toast.success(`Aufgabe: ${AUFGABE_STATUS[status].label}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Statusänderung fehlgeschlagen");
    }
  };

  if (featureEnabled === false) {
    return (
      <div className="max-w-xl mx-auto p-6" data-testid="monteur-app-feature-off">
        <div className="text-center space-y-4 py-10">
          <HardHat className="w-16 h-16 mx-auto text-primary/60" />
          <h1 className="text-2xl font-bold">Monteur-App</h1>
          <p className="text-muted-foreground">
            Die Monteur-App ist noch nicht aktiviert. Als Admin kannst du sie hier einschalten.
          </p>
          <button
            onClick={enableFeature}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
            data-testid="btn-enable-monteur-app"
          >
            Jetzt aktivieren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto" data-testid="monteur-app-page">
      {outdated && (
        <div className="sticky top-0 z-30 bg-amber-500 text-white rounded-xl shadow-lg px-4 py-3 mb-4 flex items-center gap-3" data-testid="update-banner-list">
          <RefreshCw className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Neue Version verfügbar</div>
            <div className="text-xs opacity-90">Jetzt aktualisieren.</div>
          </div>
          <button onClick={reload} className="px-3 py-1.5 bg-white text-amber-700 rounded-lg font-semibold text-sm" data-testid="btn-reload-app-list">
            Aktualisieren
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Monteur-App</h1>
            <p className="text-xs text-muted-foreground">Mein Tag · {me || "Monteur"}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          data-testid="btn-refresh-monteur"
          title="Aktualisieren"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tab-Navigation */}
      <div className="flex gap-1 mb-4 border rounded-lg p-1 bg-muted/40" data-testid="monteur-tabs">
        {[
          { key: "einsaetze", label: "Einsätze", icon: Wrench, count: einsaetze.length },
          { key: "termine", label: "Termine", icon: Calendar, count: termine.length },
          { key: "aufgaben", label: "Aufgaben", icon: Briefcase, count: aufgaben.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`monteur-tab-${t.key}`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Lade…</div>
      ) : tab === "einsaetze" ? (
        <EinsaetzeTab
          einsaetze={einsaetze}
          filter={filter}
          setFilter={setFilter}
          navigate={navigate}
        />
      ) : tab === "termine" ? (
        <TermineTab termine={termine} onGo={onTerminGo} />
      ) : (
        <AufgabenTab aufgaben={aufgaben} onStatus={setAufgabeStatus} />
      )}
    </div>
  );
}

// ==================== Tab: EINSÄTZE (Legacy) ====================

const EinsaetzeTab = ({ einsaetze, filter, setFilter, navigate }) => {
  return (
    <>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { key: "aktiv", label: "Aktuell" },
          { key: "abgeschlossen", label: "Erledigt" },
          { key: "", label: "Alle" },
        ].map(f => (
          <button
            key={f.key || "all"}
            onClick={() => setFilter(f.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"
            }`}
            data-testid={`monteur-filter-${f.key || "all"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {einsaetze.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="monteur-empty">
          <Wrench className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          Keine Einsätze {filter === "aktiv" ? "aktuell" : filter === "abgeschlossen" ? "erledigt" : "vorhanden"}.
        </div>
      ) : (
        <div className="space-y-2">
          {einsaetze.map(e => (
            <button
              key={e.id}
              onClick={() => navigate(`/monteur/einsatz/${e.id}`)}
              className="w-full text-left bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              data-testid={`monteur-einsatz-${e.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[e.status] || STATUS_COLOR.aktiv}`}>
                      {STATUS_LABEL[e.status] || e.status}
                    </span>
                    {e.termin_text && <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{e.termin_text}</span>}
                  </div>
                  <div className="font-semibold text-base truncate flex items-center gap-1">
                    <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    {e.customer_name || "(kein Kunde)"}
                  </div>
                  {e.kunde_adresse && (
                    <div className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{e.kunde_adresse}</span>
                    </div>
                  )}
                  {e.beschreibung && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.beschreibung}</div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground mt-1 shrink-0" />
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t" onClick={ev => ev.stopPropagation()}>
                {e.kunde_adresse && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.kunde_adresse)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
                    onClick={ev => ev.stopPropagation()}
                    data-testid={`monteur-nav-${e.id}`}
                  >
                    <MapPin className="w-4 h-4" /> Navigation
                  </a>
                )}
                {e.kunde_telefon && (
                  <a
                    href={`tel:${e.kunde_telefon}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"
                    onClick={ev => ev.stopPropagation()}
                    data-testid={`monteur-phone-${e.id}`}
                  >
                    <Phone className="w-4 h-4" /> Anrufen
                  </a>
                )}
                {e.kunde_email && (
                  <a
                    href={`mailto:${e.kunde_email}`}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80"
                    onClick={ev => ev.stopPropagation()}
                    data-testid={`monteur-mail-${e.id}`}
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

// ==================== Tab: TERMINE ====================

const TermineTab = ({ termine, onGo }) => {
  if (termine.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="monteur-termine-empty">
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        Keine Termine für dich zugewiesen.
        <p className="text-xs mt-2">Termine erscheinen hier, sobald der Admin dich als Monteur einträgt.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="monteur-termine-list">
      {termine.map(t => {
        const sty = TERMIN_STATUS[t.status] || TERMIN_STATUS.wartet_auf_go;
        return (
          <div
            key={t.id}
            className="bg-card border rounded-xl p-4 shadow-sm"
            data-testid={`monteur-termin-${t.id}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sty.cls}`}>
                    {sty.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{TYP_LABEL[t.typ] || t.typ}</span>
                </div>
                <div className="font-semibold text-base">{t.titel}</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Calendar className="w-3.5 h-3.5" /> {fmtDateTime(t.start)}
                  {t.ende && <> – {fmtDateTime(t.ende)}</>}
                </div>
                {t.ort && (
                  <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{t.ort}</span>
                  </div>
                )}
                {t.beschreibung && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">{t.beschreibung}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {t.ort && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t.ort)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
                  data-testid={`monteur-termin-nav-${t.id}`}
                >
                  <MapPin className="w-4 h-4" /> Navigation
                </a>
              )}
              {t.status === "wartet_auf_go" && (
                <button
                  onClick={() => onGo(t)}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600"
                  data-testid={`monteur-termin-go-${t.id}`}
                >
                  ✓ GO – bestätigen
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==================== Tab: AUFGABEN ====================

const AufgabenTab = ({ aufgaben, onStatus }) => {
  if (aufgaben.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="monteur-aufgaben-empty">
        <Briefcase className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        Keine Aufgaben für dich zugewiesen.
        <p className="text-xs mt-2">Sobald dir der Admin eine interne Aufgabe (z. B. Werkzeugpflege) zuweist, erscheint sie hier.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="monteur-aufgaben-list">
      {aufgaben.map(a => {
        const sty = AUFGABE_STATUS[a.status] || AUFGABE_STATUS.offen;
        const Icon = sty.icon;
        return (
          <div
            key={a.id}
            className={`bg-card border rounded-xl p-4 shadow-sm ${a.status === "erledigt" ? "opacity-70" : ""}`}
            data-testid={`monteur-aufgabe-${a.id}`}
          >
            <div className="flex items-start gap-2">
              <div className={`p-1.5 rounded-md border ${sty.cls}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sty.cls}`}>
                    {sty.label}
                  </span>
                  <span className="text-xs text-muted-foreground">Priorität: {a.prioritaet}</span>
                  {a.wiederholung !== "einmalig" && (
                    <span className="text-xs text-muted-foreground">⟳ {a.wiederholung}</span>
                  )}
                </div>
                <div className={`font-semibold text-base ${a.status === "erledigt" ? "line-through text-muted-foreground" : ""}`}>
                  {a.titel}
                </div>
                {a.beschreibung && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.beschreibung}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> {a.kategorie}</span>
                  {a.faellig_am && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> fällig: {new Date(a.faellig_am).toLocaleDateString("de-DE")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {a.status !== "erledigt" && (
              <div className="flex gap-2 mt-3 pt-3 border-t">
                {a.status === "offen" && (
                  <button
                    onClick={() => onStatus(a, "in_arbeit")}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
                    data-testid={`monteur-aufgabe-start-${a.id}`}
                  >
                    <Clock className="w-4 h-4" /> Anfangen
                  </button>
                )}
                <button
                  onClick={() => onStatus(a, "erledigt")}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600"
                  data-testid={`monteur-aufgabe-done-${a.id}`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Erledigt
                </button>
              </div>
            )}
            {a.status === "erledigt" && a.erledigt_am && (
              <div className="mt-2 pt-2 border-t text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> erledigt am {new Date(a.erledigt_am).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                <button
                  onClick={() => onStatus(a, "offen")}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                  data-testid={`monteur-aufgabe-reopen-${a.id}`}
                >
                  wieder öffnen
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MonteurAppPage;
