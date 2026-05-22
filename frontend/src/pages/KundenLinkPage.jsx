import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Phone, Mail, MapPin, User, Building2, Clock, AlertTriangle, Loader2, FileText, Image as ImageIcon, Send, Camera, Check, Mic, Square, Sparkles } from "lucide-react";
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

  // Mitarbeiter-Beitrag (Notiz + Foto)
  const [author, setAuthor] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savedNoteFlash, setSavedNoteFlash] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedFlash, setUploadedFlash] = useState(false);
  const fileInputRef = useRef(null);

  // ── Sprachaufnahme (Whisper + KI-Strukturierung) ──
  const [recording, setRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const recorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceTimerRef = useRef(null);

  const startRecording = async () => {
    if (!navigator?.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert("Sprachaufnahme wird vom Browser nicht unterstuetzt.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : (MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "");
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      voiceChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      rec.onstop = handleVoiceStop;
      rec.start();
      setRecording(true);
      setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => setVoiceSeconds((s) => s + 1), 1000);
    } catch (err) {
      alert("Mikrofon-Zugriff verweigert: " + (err?.message || ""));
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    voiceStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    clearInterval(voiceTimerRef.current);
    setRecording(false);
  };

  const handleVoiceStop = async () => {
    setVoiceProcessing(true);
    try {
      const type = recorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(voiceChunksRef.current, { type });
      if (blob.size < 1000) {
        alert("Aufnahme zu kurz (< 1 Sekunde).");
        return;
      }
      const ext = type.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `aufnahme.${ext}`);
      fd.append("language", "de");
      const r = await axios.post(`${API}/api/voice-intake/transcribe-public/${token}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const txt = (r.data?.text || "").trim();
      const fields = r.data?.fields || {};
      // Struktur als Klartext anhaengen
      let extra = "";
      const order = ["reparaturgruppe", "material", "hersteller", "alter_jahre", "schaden", "beschreibung"];
      const filled = order.filter((k) => fields[k]);
      if (filled.length > 0) {
        extra = "\n\n— KI-Erkennung —\n" + filled.map((k) => `${k}: ${fields[k]}`).join("\n");
      }
      setNoteText((prev) => (prev ? prev + "\n\n" : "") + txt + extra);
    } catch (err) {
      alert("Transkription fehlgeschlagen: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setVoiceProcessing(false);
    }
  };

  // Cleanup
  useEffect(() => () => {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    voiceStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    clearInterval(voiceTimerRef.current);
  }, []);

  useEffect(() => {
    // Name persistent im Browser pro Mitarbeiter-Handy
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("graupner_link_author") : "";
    if (saved) setAuthor(saved);
  }, []);

  const saveAuthor = (v) => {
    setAuthor(v);
    try { window.localStorage.setItem("graupner_link_author", v || ""); } catch { /* noop */ }
  };

  const reload = async () => {
    try {
      const r = await axios.get(`${API}/api/module-kundenlink/view/${token}`);
      setData(r.data);
    } catch { /* noop */ }
  };

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      await axios.post(`${API}/api/module-kundenlink/view/${token}/note`, { text, author });
      setNoteText("");
      setSavedNoteFlash(true);
      setTimeout(() => setSavedNoteFlash(false), 2500);
      await reload();
    } catch (err) {
      alert(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSavingNote(false);
    }
  };

  const submitPhoto = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("author", author || "");
        await axios.post(`${API}/api/module-kundenlink/view/${token}/photo`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setUploadedFlash(true);
      setTimeout(() => setUploadedFlash(false), 2500);
      await reload();
    } catch (err) {
      alert(err?.response?.data?.detail || "Upload fehlgeschlagen");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
            <p className="text-base whitespace-pre-wrap text-slate-900 font-medium leading-relaxed">{k.nachricht}</p>
          </section>
        )}

        {/* Projekt-Section (nur wenn Link projektbezogen) */}
        {data.projekt && (
          <section className="bg-violet-50 border border-violet-200 rounded-sm p-3 space-y-3" data-testid="kundenlink-projekt">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-violet-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Projekt: {data.projekt.titel}
              </h3>
              <div className="flex items-center gap-1.5">
                {data.projekt.status && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-200 text-violet-900 font-medium">
                    {data.projekt.status}
                  </span>
                )}
                {data.projekt.kategorie && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-violet-200 text-violet-700">
                    {data.projekt.kategorie}
                  </span>
                )}
              </div>
            </div>
            {data.projekt.adresse && (
              <div className="text-xs bg-white border border-violet-200 rounded-sm p-2">
                <span className="font-semibold text-violet-700 uppercase text-[10px]">Adresse abweichend:</span>{" "}
                {data.projekt.adresse}
              </div>
            )}
            {data.projekt.beschreibung && (
              <div>
                <div className="text-[10px] font-semibold text-violet-700 uppercase mb-1">Beschreibung</div>
                <p className="text-sm whitespace-pre-wrap">{data.projekt.beschreibung}</p>
              </div>
            )}
            {data.projekt.notizen && (
              <div>
                <div className="text-[10px] font-semibold text-violet-700 uppercase mb-1">Notizen / Hinweise</div>
                <p className="text-sm whitespace-pre-wrap bg-white p-2 border border-violet-200 rounded-sm">
                  {data.projekt.notizen}
                </p>
              </div>
            )}
            {data.projekt.bilder?.length > 0 && (() => {
              const groups = data.projekt.bilder.reduce((acc, b) => {
                const k = b.kategorie || "sonstiges";
                acc[k] = acc[k] || [];
                acc[k].push(b);
                return acc;
              }, {});
              const order = ["vorher", "schaden", "nachher", "sonstiges"];
              return (
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold text-violet-700 uppercase flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Projekt-Bilder ({data.projekt.bilder.length})
                  </div>
                  {order.filter((kat) => groups[kat]?.length > 0).map((kat) => (
                    <div key={kat}>
                      <div className="text-[11px] font-medium text-violet-800 capitalize mb-1">{kat} ({groups[kat].length})</div>
                      <div className="grid grid-cols-2 gap-2">
                        {groups[kat].map((b, i) => {
                          const src = fullUrl(b.url);
                          return (
                            <a
                              key={b.id || i}
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`kundenlink-projekt-bild-${kat}-${i}`}
                            >
                              <img
                                src={src}
                                alt={b.filename || `Bild ${i + 1}`}
                                loading="lazy"
                                className="w-full h-32 object-cover rounded-sm border bg-white"
                                onError={(e) => { e.target.style.opacity = "0.3"; }}
                              />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
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

        {/* Mitarbeiter-Beitrag (Notiz + Foto) */}
        <section className="bg-amber-50 border border-amber-200 rounded-sm p-3 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-amber-800 uppercase mb-1">Beitrag vom Mitarbeiter</h3>
            <p className="text-[11px] text-amber-700">
              Was du hier einträgst, geht direkt zurück in den Kundendatensatz beim Auftraggeber.
            </p>
          </div>

          {/* Mitarbeiter-Name */}
          <div>
            <label className="block text-[11px] font-medium text-amber-900 mb-1">Dein Name <span className="text-amber-700 font-normal">(einmalig — wird auf diesem Handy gemerkt)</span></label>
            <input
              type="text"
              value={author}
              onChange={(e) => saveAuthor(e.target.value)}
              placeholder="z.B. Thorsten"
              className="w-full px-3 py-2 text-sm border rounded-sm bg-white"
              data-testid="kundenlink-author"
            />
          </div>

          {/* Notiz */}
          <div>
            <label className="block text-[11px] font-medium text-amber-900 mb-1">Notiz / Bemerkung</label>
            {/* Sprachaufnahme – diktieren statt tippen */}
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              {!recording && !voiceProcessing && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-sm bg-violet-600 text-white hover:bg-violet-700"
                  data-testid="kundenlink-voice-start"
                >
                  <Mic className="w-4 h-4" />
                  Sprachnotiz aufnehmen
                </button>
              )}
              {recording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-sm bg-red-600 text-white animate-pulse"
                  data-testid="kundenlink-voice-stop"
                >
                  <Square className="w-4 h-4" />
                  Stop ({Math.floor(voiceSeconds / 60)}:{String(voiceSeconds % 60).padStart(2, "0")})
                </button>
              )}
              {voiceProcessing && (
                <div className="inline-flex items-center gap-2 px-3 py-2 text-sm text-violet-800">
                  <Loader2 className="w-4 h-4 animate-spin" /> Transkribiere…
                </div>
              )}
              <span className="text-[10px] text-amber-700 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Frei sprechen — KI macht Text + erkennt Material/Hersteller
              </span>
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="z.B. Besichtigung erfolgt – Tür ausgehängt, Material für nächste Woche bestellen…"
              className="w-full px-3 py-2 text-sm border rounded-sm bg-white"
              data-testid="kundenlink-note-text"
            />
            <button
              type="button"
              onClick={submitNote}
              disabled={savingNote || !noteText.trim()}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded-sm hover:bg-amber-700 disabled:opacity-50"
              data-testid="kundenlink-note-submit"
            >
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : savedNoteFlash ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {savedNoteFlash ? "Gespeichert" : "Notiz speichern"}
            </button>
          </div>

          {/* Foto-Upload */}
          <div>
            <label className="block text-[11px] font-medium text-amber-900 mb-1">Foto hinzufügen</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => submitPhoto(e.target.files)}
              className="hidden"
              data-testid="kundenlink-photo-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-slate-800 text-white rounded-sm hover:bg-slate-900 disabled:opacity-50"
              data-testid="kundenlink-photo-trigger"
            >
              {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : uploadedFlash ? <Check className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              {uploadingPhoto ? "Lade hoch…" : uploadedFlash ? "Hochgeladen" : "Foto aufnehmen / auswählen"}
            </button>
          </div>
        </section>

        {/* Gültigkeits-Hinweis */}
        <footer className="text-xs text-slate-500 text-center p-2 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> Link gültig bis {exp}
        </footer>
      </div>
    </div>
  );
};

export default KundenLinkPage;
