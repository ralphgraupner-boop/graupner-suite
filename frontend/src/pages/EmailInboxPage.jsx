import { useState, useEffect } from "react";
import { Inbox, RefreshCw, Mail, Paperclip, UserPlus, Users, Trash2, ChevronDown, ChevronUp, Eye, Download, X, Search, MailOpen, ArrowRight, Settings2, Plus, FileText, UserCheck, AlertCircle, Reply, Send } from "lucide-react";
import { toast } from "sonner";
import { Input, Card, Badge, Button, Modal, Textarea } from "@/components/common";
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
  const [keywords, setKeywords] = useState([]);
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [kwDraft, setKwDraft] = useState([]);
  const [newKw, setNewKw] = useState("");
  const [kwSaving, setKwSaving] = useState(false);
  const [vcfPreview, setVcfPreview] = useState(null);
  const [vcfLoading, setVcfLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyForm, setReplyForm] = useState({ subject: "", message: "" });
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    loadInbox();
    loadCustomers();
    loadKeywords();
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
      const [kundenRes, kontaktRes] = await Promise.all([
        api.get("/modules/kunden/data").catch(() => ({ data: [] })),
        api.get("/modules/kontakt/data").catch(() => ({ data: [] }))
      ]);
      const kunden = (kundenRes.data || []).map(k => ({
        ...k,
        name: `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.firma || "Unbekannt",
        _source: "kunden-modul"
      }));
      const kontakte = (kontaktRes.data || []).map(k => ({
        ...k,
        name: `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.firma || "Unbekannt",
        _source: "kontakt-modul"
      }));
      const seenEmails = new Set();
      const all = [...kunden, ...kontakte].filter(c => {
        if (!c.email) return true;
        const lower = c.email.toLowerCase();
        if (seenEmails.has(lower)) return false;
        seenEmails.add(lower);
        return true;
      });
      setCustomers(all);
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
      toast.success("Kontakt im Kontakt-Modul angelegt");
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
      toast.success("E-Mail aus Liste entfernt");
      setEmails(emails.filter(e => e.id !== emailId));
    } catch (err) {
      toast.error("Fehler beim Entfernen");
    }
  };

  const handlePermanentDelete = async (emailId) => {
    try {
      await api.delete(`/imap/inbox/${emailId}/permanent`);
      toast.success("E-Mail komplett gelöscht (auch vom Server)");
      setEmails(emails.filter(e => e.id !== emailId));
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const openReply = (email) => {
    const fromAddr = email.from_email || email.from || "";
    const subj = email.subject || "";
    const reSubject = subj.startsWith("Re:") ? subj : `Re: ${subj}`;
    setReplyTo({ ...email, reply_to: fromAddr });
    setReplyForm({ subject: reSubject, message: "" });
  };

  const handleSendReply = async () => {
    if (!replyForm.message.trim()) {
      toast.error("Bitte Nachricht eingeben");
      return;
    }
    setReplySending(true);
    try {
      await api.post("/email/resend", {
        to_email: replyTo.reply_to,
        subject: replyForm.subject,
        message: replyForm.message,
      });
      toast.success(`Antwort an ${replyTo.reply_to} gesendet`);
      setReplyTo(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Senden");
    } finally {
      setReplySending(false);
    }
  };



  const loadKeywords = async () => {
    try {
      const res = await api.get("/imap/keywords");
      setKeywords(res.data);
    } catch {}
  };

  const saveKeywords = async () => {
    setKwSaving(true);
    try {
      await api.put("/imap/keywords", { keywords: kwDraft.filter(k => k.trim()) });
      setKeywords(kwDraft.filter(k => k.trim()));
      setEditingKeywords(false);
      toast.success("Schlüsselwörter gespeichert");
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setKwSaving(false); }
  };

  const handleParseVcf = async (attId) => {
    setVcfLoading(true);
    try {
      const res = await api.post(`/imap/parse-vcf/${attId}`);
      setVcfPreview(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "VCF konnte nicht gelesen werden");
    } finally { setVcfLoading(false); }
  };

  const handleCreateContactFromVcf = async () => {
    if (!vcfPreview?.contact) return;
    const c = vcfPreview.contact;
    try {
      await api.post("/modules/kontakt/data", {
        vorname: (c.name || "").split(" ")[0] || "",
        nachname: (c.name || "").split(" ").slice(1).join(" ") || "",
        email: c.email || "",
        phone: c.phone || "",
        firma: c.firma || "",
        kontakt_status: "Anfrage",
        customer_type: "Privat",
        notes: c.rolle ? `Rolle: ${c.rolle}` : "",
      });
      toast.success(`Kontakt "${c.name}" im Kontakt-Modul angelegt`);
      setVcfPreview(null);
      loadCustomers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Anlegen");
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
    if (filter === "anfrage" && e.classification !== "anfrage") return false;
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
          { key: "anfrage", label: `Anfrage (${emails.filter(e => e.classification === "anfrage").length})` },
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
        <button
          onClick={() => { setKwDraft([...keywords]); setNewKw(""); setEditingKeywords(true); }}
          className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Schlüsselwörter verwalten"
          data-testid="btn-edit-keywords"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Keyword Editor */}
      {editingKeywords && (
        <Card className="p-4 mb-4 border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-200" data-testid="keyword-editor">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Settings2 className="w-4 h-4" /> Schlüsselwörter für Anfrage-Erkennung
            </h3>
            <button onClick={() => setEditingKeywords(false)} className="p-1 hover:bg-muted rounded-sm"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">E-Mails mit diesen Wörtern im Betreff/Text werden automatisch als "Anfrage" markiert.</p>
          <div className="space-y-1.5 mb-3">
            {kwDraft.map((kw, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={kw}
                  onChange={(e) => { const u = [...kwDraft]; u[idx] = e.target.value; setKwDraft(u); }}
                  className="flex-1 h-8 border rounded-sm px-3 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  data-testid={`kw-input-${idx}`}
                />
                <button onClick={() => setKwDraft(kwDraft.filter((_, i) => i !== idx))} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newKw.trim()) { setKwDraft([...kwDraft, newKw.trim()]); setNewKw(""); } }}
              placeholder="Neues Schlüsselwort..."
              className="flex-1 h-8 border border-dashed border-primary/40 rounded-sm px-3 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none"
              data-testid="kw-new-input"
            />
            <button onClick={() => { if (newKw.trim()) { setKwDraft([...kwDraft, newKw.trim()]); setNewKw(""); } }} disabled={!newKw.trim()} className="h-8 px-3 text-xs font-medium bg-primary/10 text-primary rounded-sm hover:bg-primary/20 disabled:opacity-40 flex items-center gap-1" data-testid="kw-add-btn"><Plus className="w-3.5 h-3.5" /> Hinzufügen</button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingKeywords(false)}>Abbrechen</Button>
            <Button size="sm" onClick={saveKeywords} disabled={kwSaving} data-testid="kw-save-btn">{kwSaving ? "Speichern..." : "Speichern"}</Button>
          </div>
        </Card>
      )}

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
                          {mail.classification === "anfrage" && !mail.matched_customer && !mail.matched_anfragen?.length && (
                            <Badge className="bg-purple-100 text-purple-700 text-[10px]">Anfrage erkannt</Badge>
                          )}
                          {mail.has_vcf && (
                            <Badge className="bg-teal-100 text-teal-700 text-[10px]">VCF</Badge>
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
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-line">{mail.body?.substring(0, 300)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(mail.fetched_at)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openReply(mail); }}
                        className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Antworten"
                        data-testid={`btn-reply-${mail.id}`}
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(mail.id); }}
                        className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        title="Hier löschen"
                        data-testid={`btn-hide-${mail.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePermanentDelete(mail.id); }}
                        className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Komplett löschen"
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
                            <div key={att.id} className="flex items-center gap-1">
                              <button
                                onClick={() => handleViewAttachment(att.id)}
                                className="flex items-center gap-2 px-3 py-2 bg-white border rounded-sm hover:bg-muted/50 transition-colors text-sm"
                                data-testid={`btn-attachment-${att.id}`}
                              >
                                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="truncate max-w-[200px]">{att.filename}</span>
                                <span className="text-xs text-muted-foreground">({formatSize(att.size)})</span>
                              </button>
                              {att.filename.toLowerCase().endsWith(".vcf") && (
                                <button
                                  onClick={() => handleParseVcf(att.id)}
                                  className="px-2 py-2 bg-teal-50 border border-teal-200 rounded-sm hover:bg-teal-100 transition-colors text-xs font-medium text-teal-700"
                                  data-testid={`btn-vcf-${att.id}`}
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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
                          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Im Kontakt-Modul anlegen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setAssignDialog(mail); setCustomerSearch(""); }}
                          data-testid={`btn-assign-customer-${mail.id}`}
                        >
                          <Users className="w-3.5 h-3.5 mr-1.5" /> Kunde zuordnen
                        </Button>
                        <div className="ml-auto flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-primary hover:bg-primary/10"
                            onClick={() => openReply(mail)}
                            data-testid={`btn-reply-open-${mail.id}`}
                          >
                            <Reply className="w-3.5 h-3.5 mr-1.5" /> Antworten
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:bg-orange-50"
                            onClick={() => handleArchive(mail.id)}
                            data-testid={`btn-hide-open-${mail.id}`}
                          >
                            <X className="w-3.5 h-3.5 mr-1.5" /> Hier löschen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handlePermanentDelete(mail.id)}
                            data-testid={`btn-perm-delete-${mail.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Komplett löschen
                          </Button>
                        </div>
                      </div>
                    )}
                    {isAssigned && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5" />
                          Zugeordnet: {mail.assigned_type === "kontakt" ? "Kontakt-Modul" : mail.assigned_type === "anfrage" ? "Kontakt-Modul" : "Kunde zugewiesen"}
                        </p>
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" className="text-primary hover:bg-primary/10" onClick={() => openReply(mail)} data-testid={`btn-reply-assigned-${mail.id}`}>
                            <Reply className="w-3.5 h-3.5 mr-1.5" /> Antworten
                          </Button>
                          <Button variant="outline" size="sm" className="text-orange-600 hover:bg-orange-50" onClick={() => handleArchive(mail.id)}>
                            <X className="w-3.5 h-3.5 mr-1.5" /> Hier löschen
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handlePermanentDelete(mail.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Komplett löschen
                          </Button>
                        </div>
                      </div>
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
      {/* VCF Contact Preview */}
      {vcfPreview && (
        <Modal isOpen onClose={() => setVcfPreview(null)} title="Kontakt aus VCF" size="md">
          <div className="space-y-4">
            {vcfPreview.already_exists && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Kontakt bereits vorhanden!</p>
                  {vcfPreview.existing_customer && <p className="text-xs text-amber-700">Kunde: {vcfPreview.existing_customer.name} ({vcfPreview.existing_customer.email})</p>}
                  {vcfPreview.existing_anfrage && <p className="text-xs text-amber-700">Anfrage: {vcfPreview.existing_anfrage.name} ({vcfPreview.existing_anfrage.email})</p>}
                </div>
              </div>
            )}
            <div className="bg-muted/30 rounded-sm p-4 space-y-2">
              {vcfPreview.contact.name && <div className="flex gap-2"><span className="text-xs font-medium text-muted-foreground w-16">Name:</span><span className="text-sm font-semibold">{vcfPreview.contact.name}</span></div>}
              {vcfPreview.contact.email && <div className="flex gap-2"><span className="text-xs font-medium text-muted-foreground w-16">E-Mail:</span><span className="text-sm">{vcfPreview.contact.email}</span></div>}
              {vcfPreview.contact.phone && <div className="flex gap-2"><span className="text-xs font-medium text-muted-foreground w-16">Telefon:</span><span className="text-sm">{vcfPreview.contact.phone}</span></div>}
              {vcfPreview.contact.address && <div className="flex gap-2"><span className="text-xs font-medium text-muted-foreground w-16">Adresse:</span><span className="text-sm">{vcfPreview.contact.address}</span></div>}
              {vcfPreview.contact.firma && <div className="flex gap-2"><span className="text-xs font-medium text-muted-foreground w-16">Firma:</span><span className="text-sm">{vcfPreview.contact.firma}</span></div>}
              {vcfPreview.contact.rolle && <div className="flex gap-2"><span className="text-xs font-medium text-muted-foreground w-16">Rolle:</span><span className="text-sm">{vcfPreview.contact.rolle}</span></div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setVcfPreview(null)}>Schließen</Button>
              {!vcfPreview.already_exists && (
                <Button size="sm" onClick={handleCreateContactFromVcf} data-testid="btn-create-vcf-contact">
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Kontakt anlegen
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Reply Modal */}
      {replyTo && (
        <Modal isOpen onClose={() => setReplyTo(null)} title="Antworten" size="lg">
          <div className="space-y-4" data-testid="reply-modal">
            <div className="bg-muted/30 rounded-sm p-3">
              <p className="text-xs text-muted-foreground">Antwort an:</p>
              <p className="text-sm font-medium">{replyTo.reply_to}</p>
              {replyTo.subject && <p className="text-xs text-muted-foreground mt-1">Betreff: {replyTo.subject}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Betreff</label>
              <Input
                value={replyForm.subject}
                onChange={(e) => setReplyForm({ ...replyForm, subject: e.target.value })}
                data-testid="reply-subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nachricht</label>
              <Textarea
                value={replyForm.message}
                onChange={(e) => setReplyForm({ ...replyForm, message: e.target.value })}
                placeholder="Ihre Antwort..."
                rows={8}
                data-testid="reply-message"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setReplyTo(null)}>Abbrechen</Button>
              <Button onClick={handleSendReply} disabled={replySending || !replyForm.message.trim()} data-testid="btn-send-reply">
                <Send className="w-4 h-4 mr-1.5" />
                {replySending ? "Sende..." : "Antwort senden"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export { EmailInboxPage };
