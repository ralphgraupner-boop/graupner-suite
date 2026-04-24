import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  HardHat, MapPin, Phone, Mail, ChevronRight, RefreshCw, Calendar, Wrench, User as UserIcon,
} from "lucide-react";

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

/**
 * Monteur-App – Einsatz-Liste (mobile-first, Module-First)
 * Zeigt alle Einsätze des eingeloggten Monteurs (Admin sieht alle).
 */
export function MonteurAppPage() {
  const navigate = useNavigate();
  const [einsaetze, setEinsaetze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("aktiv");
  const [featureEnabled, setFeatureEnabled] = useState(null);

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
      const res = await api.get("/monteur/einsaetze", { params: filter ? { status: filter } : {} });
      setEinsaetze(Array.isArray(res.data) ? res.data : []);
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Monteur-App</h1>
            <p className="text-xs text-muted-foreground">Einsätze mobil – dein Tag im Überblick</p>
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

      {/* Filter */}
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

      {/* Liste */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Lade…</div>
      ) : einsaetze.length === 0 ? (
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

              {/* Schnell-Aktionen */}
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
    </div>
  );
}

export default MonteurAppPage;
