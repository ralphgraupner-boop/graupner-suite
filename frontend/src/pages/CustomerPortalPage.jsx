import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Upload, Image, FileText, Lock, CheckCircle, AlertTriangle, Download, MapPin, Phone, Mail, Send, Calendar, MessageSquare, Edit3 } from "lucide-react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const CustomerPortalPage = () => {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [portalInfo, setPortalInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [customerNotes, setCustomerNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("hinweis");
  const [sendingNote, setSendingNote] = useState(false);
  const [noteSent, setNoteSent] = useState(false);

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
      setAuthenticated(true);
    } catch (e) {
      const msg = e.response?.data?.detail || "Zugang fehlgeschlagen";
      setError(msg);
    }
  };

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadSuccess(false);
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
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Tischlerei Graupner</h1>
            <p className="text-xs text-slate-500">Kundenportal</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700">{portalInfo?.customer_name}</p>
            {portalInfo?.description && <p className="text-xs text-slate-500">{portalInfo.description}</p>}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
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
                  <span>{customerData.address}</span>
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

        {/* Mitteilungen & Hinweise */}
        <section className="bg-white rounded-xl shadow-sm p-6" data-testid="portal-notes-section">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Mitteilungen & Hinweise
          </h2>

          {/* Bestehende Notizen */}
          {customerNotes.length > 0 && (
            <div className="space-y-2 mb-4">
              {customerNotes.map(note => {
                const labels = { korrektur: "Korrektur", hinweis: "Hinweis", termin: "Terminvorschlag", zusatz: "Zusatzinfo" };
                const colors = { korrektur: "bg-orange-100 text-orange-700", hinweis: "bg-blue-100 text-blue-700", termin: "bg-green-100 text-green-700", zusatz: "bg-purple-100 text-purple-700" };
                return (
                  <div key={note.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors[note.type] || "bg-gray-100 text-gray-600"}`}>
                        {labels[note.type] || note.type}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleString("de-DE")}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                  </div>
                );
              })}
            </div>
          )}

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
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Bilder hochladen
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
                  <span className="text-xs text-slate-400 mt-1">JPG, PNG, WebP (max. 15MB)</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
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
