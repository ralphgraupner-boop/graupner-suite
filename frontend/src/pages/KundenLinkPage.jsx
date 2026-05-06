import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Phone, Mail, MapPin, User, Building2, Clock, AlertTriangle, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import axios from "axios";

/**
 * Öffentliche Kunden-Besichtigungs-Ansicht.
 * Route: /m/:token (= "Mitarbeiter")
 * Keine Anmeldung nötig – Token 30 Tage gültig.
 * Zeigt: Name, Adresse (Maps-Link), Kontakt (Anruf/Mail-Button),
 * Kategorien, Anliegen, Bilder + Dateien.
 */
const API = process.env.REACT_APP_BACKEND_URL;

const KundenLinkPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await axios.get(`${API}/api/module-kundenlink/view/${token}`);
        if (!cancelled) setData(r.data);
      } catch (err) {
        if (!cancelled) {
          const code = err?.response?.status;
          if (code === 403) setError("Dieser Link wurde widerrufen.");
          else if (code === 410) setError("Dieser Link ist abgelaufen.");
          else if (code === 404) setError("Dieser Link ist ungültig.");
          else setError("Der Link konnte nicht geladen werden.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" /> Lade Besichtigungs-Daten…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full border rounded-sm bg-white p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-slate-800">{error}</h2>
          <p className="text-sm text-slate-500 mt-2">
            Bitte wenden Sie sich an den Auftraggeber, er kann einen neuen Link erzeugen.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const k = data.kunde;
  const exp = new Date(data.expires_at).toLocaleDateString("de-DE");
  const fullUrl = (u) => {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return `${API}${u.startsWith("/") ? u : "/" + u}`;
  };
  const mapsUrl = k.objekt_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k.objekt_address)}`
    : k.address_plain
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k.address_plain)}`
    : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto p-4 space-y-4" data-testid="kundenlink-page">
        {/* Kopf */}
        <header className="bg-primary text-primary-foreground rounded-sm p-4">
          <div className="text-xs opacity-80">Tischlerei R. Graupner – Besichtigung</div>
          <h1 className="text-xl font-bold mt-1 flex items-center gap-2">
            <User className="w-5 h-5" />
            {k.anrede ? `${k.anrede} ` : ""}{k.name}
          </h1>
          {k.firma && (
            <div className="text-sm opacity-90 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3.5 h-3.5" /> {k.firma}
            </div>
          )}
          {k.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {k.categories.map((c, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-medium">{c}</span>
              ))}
            </div>
          )}
        </header>

        {/* Kontakt */}
        {(k.phone || k.email) && (
          <section className="bg-white border rounded-sm p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Kontakt</h3>
            <div className="space-y-2">
              {k.phone && (
                <a
                  href={`tel:${k.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 p-2.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium"
                  data-testid="kundenlink-phone"
                >
                  <Phone className="w-4 h-4" /> {k.phone}
                </a>
              )}
              {k.email && (
                <a
                  href={`mailto:${k.email}`}
                  className="flex items-center gap-2 p-2.5 rounded-sm bg-blue-50 border border-blue-200 text-blue-800 font-medium"
                  data-testid="kundenlink-email"
                >
                  <Mail className="w-4 h-4" /> {k.email}
                </a>
              )}
            </div>
          </section>
        )}

        {/* Adresse */}
        {(k.address_lines?.length > 0 || k.objekt_address) && (
          <section className="bg-white border rounded-sm p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Adresse</h3>
            {k.address_lines?.length > 0 && (
              <div className="text-sm">
                {k.address_lines.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
            {k.objekt_address && (
              <div className="mt-2 text-sm bg-amber-50 border border-amber-200 rounded-sm p-2">
                <div className="text-[10px] uppercase text-amber-700 font-semibold mb-0.5">Objekt (abweichend)</div>
                {k.objekt_address}
              </div>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 p-2.5 rounded-sm bg-slate-800 text-white font-medium text-sm"
                data-testid="kundenlink-maps"
              >
                <MapPin className="w-4 h-4" /> In Google Maps öffnen
              </a>
            )}
          </section>
        )}

        {/* Anliegen */}
        {k.nachricht && (
          <section className="bg-white border rounded-sm p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Anliegen</h3>
            <p className="text-sm whitespace-pre-wrap">{k.nachricht}</p>
          </section>
        )}

        {/* Bilder */}
        {k.photos?.length > 0 && (
          <section className="bg-white border rounded-sm p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> Bilder ({k.photos.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {k.photos.map((p, i) => {
                const src = fullUrl(p.url);
                return (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                    data-testid={`kundenlink-photo-${i}`}
                  >
                    <img
                      src={src}
                      alt={p.filename || `Bild ${i + 1}`}
                      loading="lazy"
                      className="w-full h-32 object-cover rounded-sm border bg-slate-100"
                      onError={(e) => { e.target.style.opacity = "0.3"; }}
                    />
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Dateien (PDFs etc.) */}
        {k.files?.length > 0 && (
          <section className="bg-white border rounded-sm p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Dateien
            </h3>
            <ul className="space-y-1">
              {k.files.map((f, i) => (
                <li key={i}>
                  <a
                    href={fullUrl(f.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-sm border bg-slate-50 text-sm"
                    data-testid={`kundenlink-file-${i}`}
                  >
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">{f.name || "Datei"}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Gültigkeits-Hinweis */}
        <footer className="text-xs text-slate-500 text-center p-2 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> Link gültig bis {exp}
        </footer>
      </div>
    </div>
  );
};

export default KundenLinkPage;
