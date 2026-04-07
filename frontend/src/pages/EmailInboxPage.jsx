import { useState, useEffect } from "react";
import { Inbox, RefreshCw, Mail, Paperclip, UserPlus, Users, Trash2, ChevronDown, ChevronUp, Eye, Download, X, Search, MailOpen, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge, Button, Modal } from "@/components/common";
import { api } from "@/lib/api";

const EmailInboxPage = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("alle");
  const [expandedId, setExpandedId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [assignDialog, setAssignDialog] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  useEffect(() => {
    loadInbox();
    loadCustomers();
  }, []);

  const loadInbox = async () => {
    try {
      const res = await api.get("/imap/inbox");
      setEmails(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden des Posteingangs");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get("/customers");
      setCustomers(res.data);
    } catch {}
  };

  const handleFetch = async () => {
    setFetching(true);
    try {
      const res = await api.post("/imap/fetch");
      toast.success(res.data.message);
      await loadInbox();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim E-Mail-Abruf");
    } finally {
      setFetching(false);
    }
  };

  const handleCreateAnfrage = async (emailId) => {
    try {
      await api.post(`/imap/inbox/${emailId}/create-anfrage`);
      toast.success("Anfrage erstellt");
      await loadInbox();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const handleAssignCustomer = async (emailId, customerId) => {
    try {
      await api.post(`/imap/inbox/${emailId}/assign-customer`, { customer_id: customerId });
      toast.success("E-Mail dem Kunden zugeordnet");
      setAssignDialog(null);
      await loadInbox();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const handleArchive = async (emailId) => {
    try {
      await api.delete(`/imap/inbox/${emailId}`);
      toast.success("E-Mail archiviert");
      setEmails(emails.filter(e => e.id !== emailId));
    } catch (err) {
      toast.error("Fehler beim Archivieren");
    }
  };

  const handleMarkRead = async (emailId) => {
    try {
      await api.put(`/imap/inbox/${emailId}/read`);
      setEmails(emails.map(e => e.id === emailId ? { ...e, status: "gelesen" } : e));
    } catch {}
  };

  const handleViewAttachment = async (attId) => {
    try {
      const res = await api.get(`/imap/attachment/${attId}`);
      setAttachmentPreview(res.data);
    } catch {
      toast.error("Anhang konnte nicht geladen werden");
    }
  };

  const downloadAttachment = (att) => {
    const byteChars = atob(att.data_b64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: att.content_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = att.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = emails.filter(e => {
    if (filter === "ungelesen" && e.status !== "ungelesen") return false;
    if (filter === "bekannt" && e.classification !== "bekannt") return false;
    if (filter === "zugeordnet" && e.status !== "zugeordnet") return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.from_name?.toLowerCase().includes(s) ||
      e.from_email?.toLowerCase().includes(s) ||
      e.subject?.toLowerCase().includes(s) ||
      e.body?.toLowerCase().includes(s)
    );
  });

  const unreadCount = emails.filter(e => e.status === "ungelesen").length;

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const s = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div data-testid="email-inbox-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold">Posteingang</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {emails.length} E-Mail{emails.length !== 1 ? "s" : ""}
            {unreadCount > 0 && <span className="text-primary font-medium"> · {unreadCount} ungelesen</span>}
          </p>
        </div>
        <Button
          onClick={handleFetch}
          disabled={fetching}
          data-testid="btn-fetch-emails"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
          {fetching ? "Abrufen..." : "E-Mails abrufen"}
        </Button>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { key: "alle", label: `Alle (${emails.length})` },
          { key: "ungelesen", label: `Ungelesen (${unreadCount})` },
          { key: "bekannt", label: `Bekannt (${emails.filter(e => e.classification === "bekannt").length})` },
          { key: "zugeordnet", label: `Zugeordnet (${emails.filter(e => e.status === "zugeordnet").length})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="E-Mails durchsuchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-inbox"
        />
      </div>

      {/* Email list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Posteingang...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {emails.length === 0 ? "Posteingang leer. Klicken Sie auf \"E-Mails abrufen\" um neue E-Mails zu laden." : "Keine E-Mails gefunden."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(mail => {
            const isExpanded = expandedId === mail.id;
            const isUnread = mail.status === "ungelesen";
            const isAssigned = mail.status === "zugeordnet";
            return (
              <Card
                key={mail.id}
                className={`overflow-hidden transition-all ${isUnread ? "border-primary/30 bg-primary/[0.02]" : ""} ${isAssigned ? "opacity-60" : ""}`}
                data-testid={`inbox-mail-${mail.id}`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : mail.id);
                    if (isUnread) handleMarkRead(mail.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${isUnread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {mail.from_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${isUnread ? "font-bold" : "font-medium"}`}>{mail.from_name}</span>
                          <span className="text-xs text-muted-foreground">{mail.from_email}</span>
                          {mail.classification === "bekannt" && (
                            <Badge className="bg-blue-100 text-blue-700 text-[10px]">bekannt</Badge>
                          )}
                          {mail.matched_customer && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Kunde: {mail.matched_customer.name}</Badge>
                          )}
                          {mail.matched_anfragen?.length > 0 && (
                            <Badge className="bg-amber-100 text-amber-700 text-[10px]">Anfrage: {mail.matched_anfragen[0].name}</Badge>
                          )}
                          {isAssigned && (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">zugeordnet</Badge>
                          )}
                          {mail.attachments?.length > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Paperclip className="w-3 h-3" />{mail.attachments.length}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm truncate ${isUnread ? "font-semibold" : ""}`}>{mail.subject || "(Kein Betreff)"}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{mail.body?.substring(0, 120)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(mail.fetched_at)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(mail.id); }}
                        className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Löschen"
                        data-testid={`btn-delete-${mail.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 bg-muted/10 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Subject + Date */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-sm">{mail.subject || "(Kein Betreff)"}</h3>
                        <p className="text-xs text-muted-foreground">
                          Von: {mail.from_name} &lt;{mail.from_email}&gt; · {formatDate(mail.date || mail.fetched_at)}
                        </p>
                      </div>
                    </div>

                    {/* Match info */}
                    {(mail.matched_customer || mail.matched_anfragen?.length > 0) && (
                      <div className="flex flex-wrap gap-2 mb-3 p-2.5 bg-blue-50 border border-blue-100 rounded-sm">
                        {mail.matched_customer && (
                          <span className="text-xs font-medium text-blue-800 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> Kunde gefunden: <strong>{mail.matched_customer.name}</strong>
                          </span>
                        )}
                        {mail.matched_anfragen?.map((a, i) => (
                          <span key={i} className="text-xs font-medium text-amber-800 flex items-center gap-1">
                            <Inbox className="w-3.5 h-3.5" /> Anfrage: <strong>{a.name}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Body */}
                    <div className="bg-white rounded-sm border p-4 mb-4 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {mail.body || "(Kein Inhalt)"}
                    </div>

                    {/* Attachments */}
                    {mail.attachments?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                          <Paperclip className="w-3.5 h-3.5" /> {mail.attachments.length} Anhang/Anhänge
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {mail.attachments.map(att => (
                            <button
                              key={att.id}
                              onClick={() => handleViewAttachment(att.id)}
                              className="flex items-center gap-2 px-3 py-2 bg-white border rounded-sm hover:bg-muted/50 transition-colors text-sm"
                              data-testid={`btn-attachment-${att.id}`}
                            >
                              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[200px]">{att.filename}</span>
                              <span className="text-xs text-muted-foreground">({formatSize(att.size)})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {!isAssigned && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={() => handleCreateAnfrage(mail.id)}
                          data-testid={`btn-create-anfrage-${mail.id}`}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Als Anfrage anlegen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setAssignDialog(mail); setCustomerSearch(""); }}
                          data-testid={`btn-assign-customer-${mail.id}`}
                        >
                          <Users className="w-3.5 h-3.5 mr-1.5" /> Kunde zuordnen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleArchive(mail.id)}
                          data-testid={`btn-archive-${mail.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Archivieren
                        </Button>
                      </div>
                    )}
                    {isAssigned && (
                      <p className="text-xs text-green-600 font-medium pt-2 border-t flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Zugeordnet: {mail.assigned_type === "anfrage" ? "Neue Anfrage erstellt" : "Kunde zugewiesen"}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign to Customer Dialog */}
      {assignDialog && (
        <Modal isOpen onClose={() => setAssignDialog(null)} title="Kunde zuordnen" size="md">
          <p className="text-sm text-muted-foreground mb-3">
            E-Mail von <strong>{assignDialog.from_name}</strong> ({assignDialog.from_email}) einem Kunden zuordnen:
          </p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Kunde suchen..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-customer-assign"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredCustomers.slice(0, 20).map(c => (
              <button
                key={c.id}
                onClick={() => handleAssignCustomer(assignDialog.id, c.id)}
                className="w-full text-left p-3 rounded-sm hover:bg-primary/5 border transition-colors flex justify-between items-center"
                data-testid={`assign-customer-${c.id}`}
              >
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.email || "Keine E-Mail"}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Kein Kunde gefunden</p>
            )}
          </div>
        </Modal>
      )}

      {/* Attachment Preview */}
      {attachmentPreview && (
        <Modal isOpen onClose={() => setAttachmentPreview(null)} title={attachmentPreview.filename} size="lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {attachmentPreview.content_type} · {formatSize(attachmentPreview.size)}
              </p>
              <Button size="sm" onClick={() => downloadAttachment(attachmentPreview)}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Herunterladen
              </Button>
            </div>
            {attachmentPreview.content_type?.startsWith("image/") ? (
              <img
                src={`data:${attachmentPreview.content_type};base64,${attachmentPreview.data_b64}`}
                alt={attachmentPreview.filename}
                className="max-w-full rounded-sm border"
              />
            ) : attachmentPreview.content_type === "application/pdf" ? (
              <iframe
                src={`data:application/pdf;base64,${attachmentPreview.data_b64}`}
                className="w-full h-96 border rounded-sm"
                title={attachmentPreview.filename}
              />
            ) : (
              <div className="p-8 text-center bg-muted rounded-sm">
                <Paperclip className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Vorschau nicht verfügbar. Bitte herunterladen.</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export { EmailInboxPage };
