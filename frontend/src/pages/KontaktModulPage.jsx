import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, ChevronDown, Download, Upload, X, File, Image as ImageIcon, Globe, Package, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea, Card, Badge, Modal } from "@/components/common";
import { api } from "@/lib/api";

const KontaktModulPage = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    try {
      const res = await api.get("/modules/kontakt/data");
      setContacts(res.data);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return; }
    try {
      await api.delete(`/modules/kontakt/data/${id}`);
      toast.success("Kontakt geloescht");
      setConfirmDeleteId(null);
      loadContacts();
    } catch { toast.error("Fehler beim Loeschen"); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/modules/kontakt/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kontakt_modul_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Daten exportiert");
    } catch { toast.error("Fehler beim Export"); }
  };

  const filtered = contacts.filter((c) => {
    const name = `${c.vorname || ""} ${c.nachname || ""}`.trim().toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase()) || (c.firma || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || (c.kontakt_status || "Anfrage") === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {
    Anfrage: contacts.filter(c => (c.kontakt_status || "Anfrage") === "Anfrage").length,
    Kunde: contacts.filter(c => c.kontakt_status === "Kunde").length,
    Interessent: contacts.filter(c => c.kontakt_status === "Interessent").length,
    Archiv: contacts.filter(c => c.kontakt_status === "Archiv").length,
  };

  const statusColors = {
    Anfrage: "bg-blue-500",
    Kunde: "bg-green-500",
    Interessent: "bg-amber-500",
    Archiv: "bg-gray-400",
  };

  return (
    <div data-testid="kontakt-modul-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl lg:text-4xl font-bold">Kontakte</h1>
            <Badge variant="default" className="text-xs">Solo</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">{contacts.length} Kontakte gesamt - Eigenstaendiger Datensammler</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="btn-export-kontakt">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button size="sm" className="lg:h-10 lg:px-4" onClick={() => { setEditContact(null); setShowModal(true); }} data-testid="btn-new-kontakt">
            <Plus className="w-4 h-4" /> Neuer Kontakt
          </Button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { key: "", label: "Alle", color: "" },
          { key: "Anfrage", label: `Anfrage (${statusCounts.Anfrage})`, color: "bg-blue-500" },
          { key: "Kunde", label: `Kunde (${statusCounts.Kunde})`, color: "bg-green-500" },
          { key: "Interessent", label: `Interessent (${statusCounts.Interessent})`, color: "bg-amber-500" },
          { key: "Archiv", label: `Archiv (${statusCounts.Archiv})`, color: "bg-gray-400" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`status-filter-${f.key || "alle"}`}
          >
            {f.color && <span className={`w-2 h-2 rounded-full ${f.color}`} />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <Card className="p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 lg:h-10" placeholder="Kontakte durchsuchen..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-kontakt" />
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{search || statusFilter ? "Keine Ergebnisse" : "Noch keine Kontakte - Erstellen Sie den ersten!"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => {
            const isExpanded = expandedId === contact.id;
            const displayName = `${contact.vorname || ""} ${contact.nachname || ""}`.trim() || contact.firma || "Unbekannt";
            const status = contact.kontakt_status || "Anfrage";

            return (
              <Card key={contact.id} className={`overflow-hidden transition-all ${isExpanded ? "ring-1 ring-primary/30" : ""}`} data-testid={`kontakt-${contact.id}`}>
                <div className="flex items-center gap-4 p-3 lg:p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : contact.id)}>
                  <span className={`w-3 h-3 rounded-full shrink-0 ${statusColors[status]}`} title={status} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${isExpanded ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
                    {contact.vorname?.charAt(0)?.toUpperCase() || contact.nachname?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{displayName}</span>
                      {contact.firma && <Badge variant="info" className="text-xs">{contact.firma}</Badge>}
                      <Badge variant={status === "Kunde" ? "success" : status === "Anfrage" ? "default" : "warning"} className="text-xs">{status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {contact.phone && <span>{contact.phone}</span>}
                      {contact.email && <span className="truncate hidden sm:inline">{contact.email}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditContact(contact); setShowModal(true); }} className="p-2 hover:bg-muted rounded-sm" title="Bearbeiten">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className={`p-2 rounded-sm transition-colors ${confirmDeleteId === contact.id ? "bg-red-500 text-white" : "hover:bg-destructive/10 hover:text-destructive"}`}
                      title={confirmDeleteId === contact.id ? "Nochmal klicken" : "Loeschen"}
                    >
                      {confirmDeleteId === contact.id ? <span className="text-xs font-bold">Loeschen?</span> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/30 p-4 lg:p-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Kontaktdaten</h4>
                        <div className="space-y-2">
                          {contact.anrede && <p className="text-sm"><span className="font-medium">Anrede:</span> {contact.anrede}</p>}
                          {contact.vorname && <p className="text-sm"><span className="font-medium">Vorname:</span> {contact.vorname}</p>}
                          {contact.nachname && <p className="text-sm"><span className="font-medium">Nachname:</span> {contact.nachname}</p>}
                          {contact.firma && <p className="text-sm"><span className="font-medium">Firma:</span> {contact.firma}</p>}
                          {contact.email && <p className="text-sm"><span className="font-medium">E-Mail:</span> {contact.email}</p>}
                          {contact.phone && <p className="text-sm"><span className="font-medium">Telefon:</span> {contact.phone}</p>}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Adresse</h4>
                        <div className="space-y-2">
                          {contact.strasse && <p className="text-sm">{contact.strasse} {contact.hausnummer}</p>}
                          {(contact.plz || contact.ort) && <p className="text-sm">{contact.plz} {contact.ort}</p>}
                          {(contact.strasse || contact.plz) && (
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${contact.strasse} ${contact.hausnummer}, ${contact.plz} ${contact.ort}`)}`); toast.success("Maps-Link kopiert!"); }}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <Globe className="w-3 h-3" /> Karten-Link kopieren
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Status & Info</h4>
                        <div className="space-y-2">
                          <p className="text-sm"><span className="font-medium">Status:</span> {status}</p>
                          <p className="text-sm"><span className="font-medium">Kundentyp:</span> {contact.customer_type || "Privat"}</p>
                          {contact.notes && <p className="text-sm"><span className="font-medium">Notizen:</span> {contact.notes}</p>}
                          <p className="text-xs text-muted-foreground">Erstellt: {new Date(contact.created_at).toLocaleDateString("de-DE")}</p>
                        </div>
                      </div>
                    </div>
                    {/* Modul-Verknuepfungen */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.post(`/modules/kunden/from-kontakt/${contact.id}`);
                            if (res.data.already_exists) {
                              toast.info("Kontakt ist bereits als Kunde vorhanden");
                            } else {
                              toast.success(`${contact.vorname || ""} ${contact.nachname || ""} als Kunde uebernommen!`);
                            }
                          } catch { toast.error("Fehler beim Uebernehmen"); }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                        data-testid={`btn-to-kunde-${contact.id}`}
                      >
                        <Users className="w-4 h-4" />
                        Als Kunde uebernehmen
                      </button>
                      <button
                        onClick={() => { setEditContact(contact); setShowModal(true); }}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm bg-primary/5 text-primary hover:bg-primary/10 border border-primary/20 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Bearbeiten
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <KontaktFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        contact={editContact}
        onSave={() => { setShowModal(false); loadContacts(); }}
      />
    </div>
  );
};


// ==================== KONTAKT FORM MODAL ====================
const KontaktFormModal = ({ isOpen, onClose, contact, onSave }) => {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contact) {
      setForm({ ...contact });
    } else {
      setForm({ anrede: "", vorname: "", nachname: "", firma: "", email: "", phone: "", strasse: "", hausnummer: "", plz: "", ort: "", customer_type: "Privat", kontakt_status: "Anfrage", categories: [], notes: "" });
    }
  }, [contact]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vorname && !form.nachname && !form.firma) {
      toast.error("Vorname, Nachname oder Firma erforderlich");
      return;
    }
    setLoading(true);
    try {
      if (contact) {
        await api.put(`/modules/kontakt/data/${contact.id}`, form);
        toast.success("Kontakt aktualisiert");
      } else {
        await api.post("/modules/kontakt/data", form);
        toast.success("Kontakt erstellt");
      }
      onSave();
    } catch { toast.error("Fehler beim Speichern"); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={contact ? "Kontakt bearbeiten" : "Neuer Kontakt"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="kontakt-form-modal">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Anrede</label>
            <select value={form.anrede || ""} onChange={(e) => setForm({ ...form, anrede: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
              <option value="">Bitte waehlen</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
              <option value="Divers">Divers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select value={form.kontakt_status || "Anfrage"} onChange={(e) => setForm({ ...form, kontakt_status: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3" data-testid="select-kontakt-status">
              <option value="Anfrage">Anfrage</option>
              <option value="Kunde">Kunde</option>
              <option value="Interessent">Interessent</option>
              <option value="Archiv">Archiv</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Kundentyp</label>
            <select value={form.customer_type || "Privat"} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} className="w-full h-10 rounded-sm border border-input bg-background px-3">
              <option value="Privat">Privat</option>
              <option value="Firma">Firma</option>
              <option value="Vermieter">Vermieter</option>
              <option value="Mieter">Mieter</option>
              <option value="Gewerblich">Gewerblich</option>
              <option value="Hausverwaltung">Hausverwaltung</option>
              <option value="Wohnungsbaugesellschaft">Wohnungsbaugesellschaft</option>
            </select>
          </div>
          {(form.customer_type === "Firma" || form.customer_type === "Gewerblich" || form.firma) && (
            <div>
              <label className="block text-sm font-medium mb-2">Firmenname</label>
              <Input value={form.firma || ""} onChange={(e) => setForm({ ...form, firma: e.target.value })} placeholder="Firma GmbH" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Vorname *</label>
            <Input value={form.vorname || ""} onChange={(e) => setForm({ ...form, vorname: e.target.value })} required={!form.firma} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nachname *</label>
            <Input value={form.nachname || ""} onChange={(e) => setForm({ ...form, nachname: e.target.value })} required={!form.firma} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">E-Mail</label>
            <Input type="text" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Adresse</label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <Input placeholder="Strasse" value={form.strasse || ""} onChange={(e) => setForm({ ...form, strasse: e.target.value })} />
            </div>
            <div className="col-span-4">
              <Input placeholder="Nr." value={form.hausnummer || ""} onChange={(e) => setForm({ ...form, hausnummer: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div>
              <Input placeholder="PLZ" value={form.plz || ""} onChange={(e) => setForm({ ...form, plz: e.target.value })} />
            </div>
            <div className="col-span-3">
              <Input placeholder="Ort" value={form.ort || ""} onChange={(e) => setForm({ ...form, ort: e.target.value })} />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notizen</label>
          <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" disabled={loading} data-testid="btn-save-kontakt">
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export { KontaktModulPage };
