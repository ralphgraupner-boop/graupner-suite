import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, User, MessageSquare, Image as ImageIcon, Send, Upload,
  FileText, Download as DownloadIcon,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/portal-v2-klon`;

/**
 * Portal (Klon) – Kunden-Ansicht (Phase 4+5)
 * Tabs: Nachrichten | Meine Dateien
 */
export function PortalV2KlonCustomerPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("messages");
  const [messages, setMessages] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const session = () => localStorage.getItem("portal_v2_session");

  const apiGet = async (path) => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${session()}` } });
    if (res.status === 401) {
      localStorage.removeItem("portal_v2_session");
      navigate("/portal-v2-klon/login");
      throw new Error("unauthorized");
    }
    return res.json();
  };

  const apiPostJson = async (path, body) => {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || "Fehler");
    return d;
  };

  const loadMe = async () => {
    try {
      const data = await apiGet("/me");
      setAccount(data);
    } catch {
      navigate("/portal-v2-klon/login");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await apiGet("/messages");
      setMessages(Array.isArray(data) ? data : []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { /* ignore */ }
  };

  const loadUploads = async () => {
    try {
      const data = await apiGet("/uploads");
      setUploads(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!session()) { navigate("/portal-v2-klon/login"); return; }
    loadMe();
    loadMessages();
    loadUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    localStorage.removeItem("portal_v2_session");
    localStorage.removeItem("portal_v2_account");
    navigate("/portal-v2-klon/login");
  };

  const sendMessage = async () => {
    const text = newMsg.trim();
    if (!text) return;
    try {
      await apiPostJson("/messages", { text });
      setNewMsg("");
      loadMessages();
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(""), 3000);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("description", "");
      const res = await fetch(`${API}/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session()}` },
        body: fd,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || "Upload fehlgeschlagen");
      loadUploads();
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(""), 4000);
    } finally {
      setUploadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openFile = async (up) => {
    try {
      const res = await fetch(`${API}/uploads/${up.id}`, { headers: { Authorization: `Bearer ${session()}` } });
      if (!res.ok) throw new Error("Nicht verfügbar");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(""), 3000);
    }
  };

  const anredeBrief = (name) => {
    const clean = (name || "").trim();
    if (!clean) return "Herzlich willkommen";
    const parts = clean.split(/\s+/);
    const last = parts[parts.length - 1];
    if (clean.startsWith("Herr ")) return `Sehr geehrter Herr ${last}`;
    if (clean.startsWith("Frau ")) return `Sehr geehrte Frau ${last}`;
    return `Hallo ${clean}`;
  };

  if (loading || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="text-sm text-muted-foreground">Lade…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]" data-testid="portal-v2-customer-page">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-lg text-[#14532D]">Kundenportal</h1>
            <p className="text-xs text-muted-foreground">Tischlerei R.Graupner</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm hidden sm:block">
              <div className="font-medium">{account.name}</div>
              <div className="text-xs text-muted-foreground">{account.email}</div>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
              data-testid="portal-v2-logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border p-5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#14532D]/10 text-[#14532D]">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{anredeBrief(account.name)}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Hier können Sie uns direkt erreichen und Dateien übermitteln.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2" data-testid="portal-v2-error">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="border-b flex">
            <button
              onClick={() => setTab("messages")}
              className={`flex-1 px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 border-b-2 ${tab === "messages" ? "border-[#14532D] text-[#14532D]" : "border-transparent text-muted-foreground"}`}
              data-testid="portal-v2-cust-tab-messages"
            >
              <MessageSquare className="w-4 h-4" /> Nachrichten
            </button>
            <button
              onClick={() => setTab("uploads")}
              className={`flex-1 px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 border-b-2 ${tab === "uploads" ? "border-[#14532D] text-[#14532D]" : "border-transparent text-muted-foreground"}`}
              data-testid="portal-v2-cust-tab-uploads"
            >
              <ImageIcon className="w-4 h-4" /> Meine Dateien
            </button>
          </div>

          {tab === "messages" && (
            <div className="flex flex-col" style={{ height: "65vh" }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafaf8]">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-20">
                    Noch keine Nachrichten. Schreiben Sie uns gerne unten!
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.sender === "customer";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-[#14532D] text-white" : "bg-white border"}`}>
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t bg-white flex gap-2">
                <textarea
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  rows={2}
                  placeholder="Ihre Nachricht…"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none"
                  data-testid="portal-v2-cust-msg-input"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMsg.trim()}
                  className="px-4 py-2 rounded-lg bg-[#14532D] text-white text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                  data-testid="portal-v2-cust-msg-send"
                >
                  <Send className="w-4 h-4" /> Senden
                </button>
              </div>
            </div>
          )}

          {tab === "uploads" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => upload(e.target.files?.[0])}
                  className="hidden"
                  data-testid="portal-v2-cust-upload-input"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingFile}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14532D] text-white text-sm hover:opacity-90 disabled:opacity-50"
                  data-testid="portal-v2-cust-upload-btn"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingFile ? "Lade hoch…" : "Foto oder PDF hochladen"}
                </button>
                <span className="text-xs text-muted-foreground">max. 15 MB</span>
              </div>

              {uploads.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-16">
                  Noch keine Dateien hochgeladen.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {uploads.map((up) => {
                    const isImg = (up.content_type || "").startsWith("image/");
                    return (
                      <button
                        key={up.id}
                        onClick={() => openFile(up)}
                        className="border rounded-lg overflow-hidden bg-white hover:shadow text-left"
                        data-testid={`portal-v2-cust-upload-${up.id}`}
                      >
                        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                          {isImg ? (
                            <FileThumb id={up.id} session={session()} />
                          ) : (
                            <FileText className="w-12 h-12 text-gray-400" />
                          )}
                        </div>
                        <div className="p-2 text-xs">
                          <div className="truncate font-medium">{up.original_filename}</div>
                          <div className="text-muted-foreground flex items-center justify-between">
                            <span>{up.uploaded_by === "customer" ? "von Ihnen" : "Tischlerei"}</span>
                            <DownloadIcon className="w-3 h-3" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Thumbnail für Kunden-Upload – lädt Bild authentifiziert als Blob. */
function FileThumb({ id, session }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/uploads/${id}`, { headers: { Authorization: `Bearer ${session}` } });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancel) return;
        setSrc(window.URL.createObjectURL(blob));
      } catch { /* ignore */ }
    };
    load();
    return () => { cancel = true; };
  }, [id, session]);
  if (!src) return <ImageIcon className="w-10 h-10 text-gray-300" />;
  return <img src={src} alt="" className="w-full h-full object-cover" />;
}

export default PortalV2KlonCustomerPage;
