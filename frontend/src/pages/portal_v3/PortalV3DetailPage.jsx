import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, Upload, Image as ImageIcon, FileText, Trash2,
  User, Mail, Download as DownloadIcon, MessageSquare, CheckCircle2
} from "lucide-react";

/**
 * Portal v3 – Admin-Detail: Chat + Uploads für einen Account.
 */
export function PortalV3DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [tab, setTab] = useState("messages");
  const [messages, setMessages] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const loadAccount = async () => {
    try {
      const res = await api.get(`/portal-v3/admin/accounts/${id}`);
      setAccount(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
      navigate("/portal-v3");
    }
  };

  const loadMessages = async () => {
    try {
      const res = await api.get(`/portal-v3/admin/accounts/${id}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      /* ignore */
    }
  };

  const loadUploads = async () => {
    try {
      const res = await api.get(`/portal-v3/admin/accounts/${id}/uploads`);
      setUploads(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadAccount();
    loadMessages();
    loadUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sendMessage = async () => {
    const text = newMsg.trim();
    if (!text) return;
    try {
      await api.post(`/portal-v3/admin/accounts/${id}/messages`, { text });
      setNewMsg("");
      loadMessages();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("description", "");
      await api.post(`/portal-v3/admin/accounts/${id}/uploads`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Hochgeladen");
      loadUploads();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteUpload = async (up) => {
    if (!window.confirm("Datei wirklich löschen?")) return;
    try {
      await api.delete(`/portal-v3/admin/accounts/${id}/uploads/${up.id}`);
      toast.success("Gelöscht");
      loadUploads();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const fileUrl = (up) => up; // kept for compatibility, not used for auth downloads

  const openFile = async (up) => {
    try {
      const res = await api.get(
        `/portal-v3/admin/accounts/${id}/uploads/${up.id}/file`,
        { responseType: "blob" }
      );
      const blobUrl = window.URL.createObjectURL(res.data);
      window.open(blobUrl, "_blank");
    } catch (err) {
      toast.error("Datei konnte nicht geöffnet werden");
    }
  };

  const AdminThumb = ({ upload }) => {
    const [src, setSrc] = useState("");
    useEffect(() => {
      let cancel = false;
      const run = async () => {
        try {
          const res = await api.get(
            `/portal-v3/admin/accounts/${id}/uploads/${upload.id}/file`,
            { responseType: "blob" }
          );
          if (cancel) return;
          setSrc(window.URL.createObjectURL(res.data));
        } catch { /* ignore */ }
      };
      run();
      return () => { cancel = true; };
    }, [upload.id]);
    if (!src) return <ImageIcon className="w-10 h-10 text-gray-300" />;
    return <img src={src} alt="" className="w-full h-full object-cover" />;
  };

  if (!account) {
    return <div className="p-10 text-sm text-muted-foreground">Lade…</div>;
  }

  return (
    <div className="space-y-4" data-testid="portal-v3-detail-page">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/portal-v3")}
          className="p-2 rounded-lg border hover:bg-muted"
          data-testid="portal-v3-detail-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">{account.name}</h1>
            {account.last_login ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> aktiv
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {account.invite_sent_at ? "eingeladen" : "offen"}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3" /> {account.email}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="border-b flex">
          <button
            onClick={() => setTab("messages")}
            className={`flex-1 px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 border-b-2 ${tab === "messages" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-muted/30"}`}
            data-testid="portal-v3-tab-messages"
          >
            <MessageSquare className="w-4 h-4" /> Nachrichten
            {messages.filter(m => m.sender === "customer" && !m.read_by_admin).length > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                {messages.filter(m => m.sender === "customer" && !m.read_by_admin).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("uploads")}
            className={`flex-1 px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 border-b-2 ${tab === "uploads" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-muted/30"}`}
            data-testid="portal-v3-tab-uploads"
          >
            <ImageIcon className="w-4 h-4" /> Uploads
            <span className="text-xs text-muted-foreground">({uploads.length})</span>
          </button>
        </div>

        {/* Messages Tab */}
        {tab === "messages" && (
          <div className="flex flex-col" style={{ height: "60vh" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafaf8]">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-20">
                  Noch keine Nachrichten. Schreibe dem Kunden unten die erste Nachricht.
                </div>
              )}
              {messages.map((m) => {
                const mine = m.sender === "admin";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`portal-v3-msg-${m.id}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-white border"}`}>
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                        {mine && m.read_by_customer && " · gelesen"}
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
                placeholder="Nachricht an Kunde…"
                className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none"
                data-testid="portal-v3-msg-input"
              />
              <button
                onClick={sendMessage}
                disabled={!newMsg.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                data-testid="portal-v3-msg-send"
              >
                <Send className="w-4 h-4" /> Senden
              </button>
            </div>
          </div>
        )}

        {/* Uploads Tab */}
        {tab === "uploads" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => uploadFile(e.target.files?.[0])}
                className="hidden"
                data-testid="portal-v3-upload-input"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted text-sm disabled:opacity-50"
                data-testid="portal-v3-upload-btn"
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Lade hoch…" : "Datei hochladen"}
              </button>
              <div className="text-xs text-muted-foreground">Bild oder PDF, max. 15 MB</div>
            </div>

            {uploads.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-16">
                Noch keine Dateien.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {uploads.map((up) => {
                  const isImg = (up.content_type || "").startsWith("image/");
                  return (
                    <div key={up.id} className="border rounded-lg overflow-hidden bg-white group relative" data-testid={`portal-v3-upload-${up.id}`}>
                      <button
                        onClick={() => openFile(up)}
                        className="block w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden hover:bg-gray-100"
                      >
                        {isImg ? (
                          <AdminThumb upload={up} />
                        ) : (
                          <FileText className="w-12 h-12 text-gray-400" />
                        )}
                      </button>
                      <div className="p-2 text-xs">
                        <div className="truncate font-medium">{up.original_filename}</div>
                        <div className="text-muted-foreground flex items-center justify-between">
                          <span>{up.uploaded_by === "customer" ? "Kunde" : "Admin"}</span>
                          <span>{new Date(up.created_at).toLocaleDateString("de-DE")}</span>
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => openFile(up)}
                          className="p-1 rounded bg-white/90 shadow hover:bg-white"
                          title="Öffnen"
                        >
                          <DownloadIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteUpload(up)}
                          className="p-1 rounded bg-white/90 shadow hover:bg-red-50 text-red-600"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PortalV3DetailPage;
