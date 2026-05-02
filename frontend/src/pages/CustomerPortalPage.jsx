import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Upload, Image, FileText, Lock, CheckCircle, AlertTriangle, Download, MapPin, Phone, Mail, Send, Calendar, MessageSquare, Edit3, Wrench, Clock, User, LogOut, Eye } from "lucide-react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const MAX_IMAGES_PER_UPLOAD = 5;
const MAX_IMAGES_PER_PORTAL = 30;

const CustomerPortalPage = () => {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [portalInfo, setPortalInfo] = useState(null);
  const [settings, setSettings] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [customerNotes, setCustomerNotes] = useState([]);
  const [adminNotes, setAdminNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("hinweis");
  const [sendingNote, setSendingNote] = useState(false);
  const [noteSent, setNoteSent] = useState(false);
  const [showAbsendenDialog, setShowAbsendenDialog] = useState(false);
  const [absendenText, setAbsendenText] = useState("");
  const [absending, setAbsending] = useState(false);
  const [absendenDone, setAbsendenDone] = useState(false);

  useEffect(() => {
    // Settings can be loaded without auth
    axios.get(`${API}/portal-settings`).then(r => setSettings(r.data)).catch(() => setSettings(null));
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const res = await axios.post(`${API}/portal/${token}/files`, { password });
      setFiles(res.data);
    } catch (e) {
      console.error("Files load error:", e);
    }
  }, [token, password]);

  useEffect(() => {
    if (authenticated) loadFiles();
  }, [authenticated, loadFiles]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post(`${API}/portal/verify/${token}`, { password });
      setPortalInfo(res.data);
      setCustomerNotes(res.data.customer_notes || []);
      setAdminNotes(res.data.admin_notes || []);
      setAuthenticated(true);
    } catch (e) {
      const msg = e.response?.data?.detail || "Zugang fehlgeschlagen";
      setError(msg);
    }
  };

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length > MAX_IMAGES_PER_UPLOAD) {
      setError(`Maximal ${MAX_IMAGES_PER_UPLOAD} Bilder pro Upload erlaubt. Bitte wählen Sie nicht mehr als ${MAX_IMAGES_PER_UPLOAD} Bilder auf einmal.`);
      e.target.value = "";
      return;
    }
    const customerCount = files.filter(f => f.uploaded_by === "customer").length;
    if (customerCount + selectedFiles.length > MAX_IMAGES_PER_PORTAL) {
      setError(`Pro Portal sind maximal ${MAX_IMAGES_PER_PORTAL} Bilder erlaubt. Aktuell: ${customerCount}. Bitte wählen Sie weniger oder wenden Sie sich an uns.`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    setUploadSuccess(false);
    setError("");
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("password", password);
        formData.append("description", description || file.name);
        await axios.post(`${API}/portal/${token}/upload`, formData);
      }
      setUploadSuccess(true);
      setDescription("");
      loadFiles();
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (e) {
      const msg = e.response?.data?.detail || "Upload fehlgeschlagen";
      setError(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAbsenden = async () => {
    setAbsending(true);
    try {
      await axios.post(`${API}/portal/${token}/absenden`, { password, text: absendenText });
      setAbsendenDone(true);
      setShowAbsendenDialog(false);
    } catch (e) {
      setError(e.response?.data?.detail || "Fehler beim Absenden");
    } finally {
      setAbsending(false);
    }
  };

  const handleBeenden = () => {
    setAuthenticated(false);
    setPassword("");
    setFiles([]);
    setCustomerNotes([]);
    setAdminNotes([]);
  };

  const customerFiles = files.filter(f => f.uploaded_by === "customer");
  const businessFiles = files.filter(f => f.uploaded_by === "business");

  const handleSendNote = async () => {
    if (!noteText.trim()) return;
    setSendingNote(true);
    setNoteSent(false);
    try {
      const res = await axios.post(`${API}/portal/${token}/notes`, {
        password, type: noteType, text: noteText
      });
      setCustomerNotes(prev => [...prev, res.data]);
      setNoteText("");
      setNoteSent(true);
      setTimeout(() => setNoteSent(false), 3000);
    } catch (e) {
      setError("Nachricht konnte nicht gesendet werden");
    } finally {
      setSendingNote(false);
    }
  };

  const customerData = portalInfo?.customer_data;
  const einsatzData = portalInfo?.einsatz_data;

  // Login Screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Kundenportal</h1>
            <p className="text-slate-500 mt-1 text-sm">Tischlerei Graupner</p>
          </div>
          <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zugangspasswort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Passwort eingeben"
                autoFocus
                data-testid="portal-password-input"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3" data-testid="portal-error">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              data-testid="portal-login-btn"
            >
              Zugang
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-4">Tischlerei Graupner &middot; seit 1960</p>
        </div>
      </div>
    );
  }

  // Authenticated Portal View
  const customerCount = files.filter(f => f.uploaded_by === "customer").length;
  // Sortierung: neueste Nachricht oben (reverse chronological)
  const dialogChronological = [
    ...customerNotes.map(n => ({ ...n, side: "customer" })),
    ...adminNotes.map(n => ({ ...n, side: "admin" })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header with Logo */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
            ) : null}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800 truncate">Tischlerei Graupner</h1>
              <p className="text-xs text-slate-500">Kundenportal</p>
            </div>
          </div>
          <div className="text-right min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{portalInfo?.customer_name}</p>
            {portalInfo?.description && <p className="text-xs text-slate-500 truncate">{portalInfo.description}</p>}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Begrüßung / Hinweise */}
        {(settings?.begruessung || settings?.hinweise) && (
          <section className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-primary" data-testid="portal-greeting">
            {settings?.begruessung && (
              <div className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed mb-3">
                {settings.begruessung}
              </div>
            )}
            {settings?.hinweise && (
              <div className="whitespace-pre-wrap text-slate-600 text-sm leading-relaxed bg-slate-50 rounded-lg p-3">
                {settings.hinweise}
              </div>
            )}
          </section>
        )}
        {/* Ihre Daten */}
        {customerData && (
          <section className="bg-white rounded-xl shadow-sm p-6" data-testid="portal-customer-data">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-slate-500" />
              Ihre Daten
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {customerData.name && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-medium w-16 shrink-0">Name:</span>
                  <span>{customerData.anrede ? `${customerData.anrede} ` : ""}{customerData.name}</span>
                </div>
              )}
              {customerData.firma && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-medium w-16 shrink-0">Firma:</span>
                  <span>{customerData.firma}</span>
                </div>
              )}
              {customerData.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span>{customerData.address}</span>
                    {customerData.object_address && (
                      <div className="mt-1 text-xs text-slate-500">
                        Objektadresse: <span className="text-slate-700">{customerData.object_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!customerData.address && customerData.object_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span>{customerData.object_address}</span>
                    <div className="text-xs text-slate-500">Objektadresse</div>
                  </div>
                </div>
              )}
              {customerData.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{customerData.phone}</span>
                </div>
              )}
              {customerData.email && (
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{customerData.email}</span>
                </div>
              )}
            </div>
            {customerData.notes && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
                <p className="text-xs font-medium text-slate-500 mb-1">Ihre Anfrage:</p>
                <p className="whitespace-pre-wrap text-slate-700">{customerData.notes}</p>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">Stimmt etwas nicht? Nutzen Sie das Nachrichtenfeld unten, um Korrekturen oder Ergänzungen mitzuteilen.</p>
          </section>
        )}

        {/* Termin-Information */}
        {einsatzData && einsatzData.termin && (
          <section className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500" data-testid="portal-termin-section">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Ihr Termin
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {new Date(einsatzData.termin).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                  <p className="text-sm text-blue-700">
                    {new Date(einsatzData.termin).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                  </p>
                </div>
              </div>
              {((Array.isArray(einsatzData.reparaturgruppen) ? einsatzData.reparaturgruppen : [einsatzData.reparaturgruppen]).filter(Boolean)).length > 0 && (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Wrench className="w-4 h-4 text-slate-400 shrink-0" />
                  {(Array.isArray(einsatzData.reparaturgruppen) ? einsatzData.reparaturgruppen : [einsatzData.reparaturgruppen]).filter(Boolean).map((g) => (
                    <span key={g} className="text-slate-600">{g}</span>
                  ))}
                </div>
              )}
              {einsatzData.monteur_1 && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Monteur: {einsatzData.monteur_1}</span>
                </div>
              )}
              {einsatzData.termin_text && (
                <div className="p-3 bg-slate-50 rounded-lg text-sm whitespace-pre-wrap text-slate-700">
                  {einsatzData.termin_text}
                </div>
              )}
              {einsatzData.beschreibung && !einsatzData.termin_text && (
                <div className="p-3 bg-slate-50 rounded-lg text-sm whitespace-pre-wrap text-slate-700">
                  {einsatzData.beschreibung}
                </div>
              )}
              <p className="text-xs text-slate-400">
                Bitte teilen Sie uns per Nachricht mit, falls Sie am Termin verhindert sind oder Fragen haben.
              </p>
            </div>
          </section>
        )}

        {/* Dialog-Historie (chronologisch, bidirektional) */}
        {dialogChronological.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm p-6" data-testid="portal-dialog-history">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Schriftwechsel / Verlauf
            </h2>
            <div className="space-y-3">
              {dialogChronological.map(note => {
                const isAdmin = note.side === "admin";
                const labels = { korrektur: "Korrektur", hinweis: "Hinweis", termin: "Terminvorschlag", zusatz: "Zusatzinfo", absenden: "Abgesendet", admin: "Tischlerei Graupner" };
                return (
                  <div key={note.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] p-3 rounded-lg ${isAdmin ? "bg-emerald-50 border border-emerald-100" : "bg-blue-50 border border-blue-100"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${isAdmin ? "text-emerald-700" : "text-blue-700"}`}>
                          {isAdmin ? "Tischlerei Graupner" : "Sie"} · {labels[note.type] || note.type}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}


        {/* Mitteilungen & Hinweise */}
        <section className="bg-white rounded-xl shadow-sm p-6" data-testid="portal-notes-section">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Neue Mitteilung senden
          </h2>

          {/* Neue Nachricht */}
          <div className="space-y-3">
            <div className="flex gap-2">
              {[
                { value: "korrektur", label: "Korrektur", icon: Edit3 },
                { value: "hinweis", label: "Hinweis", icon: MessageSquare },
                { value: "termin", label: "Termin", icon: Calendar },
                { value: "zusatz", label: "Zusatzinfo", icon: FileText },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNoteType(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    noteType === opt.value 
                      ? "bg-blue-600 text-white" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-testid={`note-type-${opt.value}`}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={
                noteType === "korrektur" ? "z.B. Die Adresse ist falsch, richtig ist: Musterstr. 5, 22453 Hamburg" :
                noteType === "termin" ? "z.B. Besichtigung möglich: Mo-Fr 9-16 Uhr, am besten Dienstag oder Donnerstag" :
                noteType === "zusatz" ? "z.B. Objekt befindet sich im Hinterhaus, Zufahrt über den Innenhof" :
                "Ihr Hinweis an die Tischlerei..."
              }
              className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              data-testid="portal-note-input"
            />
            <button
              onClick={handleSendNote}
              disabled={sendingNote || !noteText.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              data-testid="portal-send-note-btn"
            >
              <Send className="w-4 h-4" />
              {sendingNote ? "Wird gesendet..." : "Nachricht senden"}
            </button>
            {noteSent && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3">
                <CheckCircle className="w-4 h-4" />
                Nachricht erfolgreich gesendet!
              </div>
            )}
          </div>
        </section>
        {/* Upload Section */}
        <section className="bg-white rounded-xl shadow-sm p-6" data-testid="portal-upload-section">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Upload className="w-5 h-5 text-blue-600" />Bilder hochladen</span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${customerCount >= MAX_IMAGES_PER_PORTAL ? "bg-red-100 text-red-700" : customerCount > MAX_IMAGES_PER_PORTAL * 0.8 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
              {customerCount} / {MAX_IMAGES_PER_PORTAL}
            </span>
          </h2>
          <div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Beschreibung (optional)"
              data-testid="portal-upload-description"
            />
            <label
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors ${
                uploading ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
              }`}
              data-testid="portal-upload-area"
            >
              {uploading ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm font-medium">Wird hochgeladen...</span>
                </div>
              ) : (
                <>
                  <Image className="w-10 h-10 text-slate-300 mb-2" />
                  <span className="text-sm text-slate-500">Tippen um Bilder auszuwählen</span>
                  <span className="text-xs text-slate-400 mt-1">Max. {MAX_IMAGES_PER_UPLOAD} pro Upload · JPG, PNG, WebP, HEIC · Wird automatisch komprimiert</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*,image/heic,image/heif,.heic,.heif"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                data-testid="portal-file-input"
              />
            </label>
          </div>
          {uploadSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3 mt-3" data-testid="upload-success">
              <CheckCircle className="w-4 h-4" />
              Bilder erfolgreich hochgeladen!
            </div>
          )}
        </section>

        {/* Customer's uploaded images */}
        {customerFiles.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm p-6" data-testid="portal-customer-files">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Image className="w-5 h-5 text-slate-500" />
              Ihre hochgeladenen Bilder ({customerFiles.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {customerFiles.map(f => (
                <PortalFilePreview key={f.id} file={f} />
              ))}
            </div>
          </section>
        )}

        {/* Business documents */}
        {businessFiles.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm p-6" data-testid="portal-business-files">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Dokumente von Tischlerei Graupner ({businessFiles.length})
            </h2>
            <div className="space-y-2">
              {businessFiles.map(f => (
                <a
                  key={f.id}
                  href={`${API}/portal/file/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                  data-testid={`business-file-${f.id}`}
                >
                  {f.content_type?.startsWith("image/") ? (
                    <Image className="w-5 h-5 text-blue-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-red-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.original_filename}</p>
                    <p className="text-xs text-slate-400">{new Date(f.created_at).toLocaleDateString("de-DE")}</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Error Display (global) */}
        {error && authenticated && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" data-testid="portal-global-error">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 font-bold">×</button>
          </div>
        )}

        {/* Absende & Beenden Buttons */}
        {!absendenDone ? (
          <section className="bg-gradient-to-r from-primary/10 to-blue-50 rounded-xl shadow-sm p-6" data-testid="portal-actions">
            <h2 className="text-base font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Fertig?
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Wenn Sie alles eingetragen haben, senden Sie Ihre Eingaben jetzt an uns oder speichern Sie einfach und kehren später zurück.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowAbsendenDialog(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90"
                data-testid="btn-absenden"
              >
                <Send className="w-4 h-4" /> {settings?.absende_text || "Ich habe alles eingetragen und sende es jetzt ab"}
              </button>
              <button
                onClick={handleBeenden}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50"
                data-testid="btn-beenden"
              >
                <LogOut className="w-4 h-4" /> Speichern & Beenden
              </button>
            </div>
          </section>
        ) : (
          <section className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center" data-testid="portal-absenden-done">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
            <h2 className="text-lg font-semibold text-green-900 mb-2">Abgesendet!</h2>
            <p className="text-sm text-green-800 whitespace-pre-wrap">{settings?.fertig_text || "Vielen Dank! Wir haben Ihre Nachricht erhalten und melden uns zeitnah bei Ihnen."}</p>
          </section>
        )}

        {/* Absenden-Dialog mit Vorschau */}
        {showAbsendenDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="absenden-dialog">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" /> Vorschau vor dem Absenden
                </h3>
                <p className="text-xs text-slate-500 mt-1">Bitte prüfen Sie Ihre Eingaben</p>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Hochgeladene Bilder</div>
                  <div className="font-semibold">{customerCount} Bild{customerCount !== 1 ? "er" : ""}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Gesendete Mitteilungen</div>
                  <div className="font-semibold">{customerNotes.length} Nachricht{customerNotes.length !== 1 ? "en" : ""}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Abschließende Nachricht (optional)</label>
                  <textarea
                    value={absendenText}
                    onChange={(e) => setAbsendenText(e.target.value)}
                    placeholder='z.B. "Das wars von meiner Seite, bitte melden Sie sich" (optional)'
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    data-testid="absenden-text"
                  />
                </div>
              </div>
              <div className="p-5 border-t flex justify-end gap-2">
                <button
                  onClick={() => setShowAbsendenDialog(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Zurück
                </button>
                <button
                  onClick={handleAbsenden}
                  disabled={absending}
                  className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  data-testid="btn-absenden-confirm"
                >
                  <Send className="w-4 h-4" /> {absending ? "Sende ab..." : "Jetzt verbindlich absenden"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 py-4">
          Gültig bis {portalInfo?.expires_at ? new Date(portalInfo.expires_at).toLocaleDateString("de-DE") : "-"} &middot; Tischlerei Graupner
        </footer>
      </div>
    </div>
  );
};


const PortalFilePreview = ({ file }) => {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (file.content_type?.startsWith("image/")) {
      fetch(`${API}/portal/file/${file.id}`)
        .then(r => r.blob())
        .then(b => setBlobUrl(URL.createObjectURL(b)))
        .catch(() => {});
    }
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [file.id, file.content_type]);

  return (
    <div className="rounded-lg overflow-hidden border">
      {blobUrl ? (
        <img src={blobUrl} alt={file.original_filename} className="w-full h-28 object-cover" />
      ) : (
        <div className="w-full h-28 bg-slate-100 flex items-center justify-center">
          <Image className="w-6 h-6 text-slate-300" />
        </div>
      )}
      <div className="p-2">
        <p className="text-xs truncate text-slate-600">{file.description || file.original_filename}</p>
        <p className="text-[10px] text-slate-400">{new Date(file.created_at).toLocaleDateString("de-DE")}</p>
      </div>
    </div>
  );
};

export default CustomerPortalPage;
