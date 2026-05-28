import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, FolderTree, Tag, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/common";
import { api } from "@/lib/api";
import { GroupedFilterBar, buildGroupedItems } from "@/components/GroupedFilterBar";

/**
 * KategorienGruppenTab
 *
 * Zentrale Verwaltung der Kunden-Kategorien und ihrer Gruppen.
 * - Links: Gruppen anlegen/umbenennen/löschen
 * - Rechts: Kategorien anlegen, Gruppe per Klick zuweisen, löschen
 * - Unten: Live-Vorschau wie die Filter-Leiste auf der Kundenseite aussehen wird
 *
 * Architektur:
 *   Gruppen existieren nicht als eigene DB-Objekte. Eine "Gruppe" ist der String
 *   parent_category eines oder mehrerer Kategorie-Einträge in module_textvorlagen.
 *   Frisch angelegte Gruppen werden bis zur ersten Zuweisung nur im lokalen State
 *   gehalten, damit der Nutzer sie im Dropdown auswählen kann.
 */

const DOC_TYPE = "kunden_kategorie";

const KategorienGruppenTab = () => {
  const [items, setItems] = useState([]); // [{id, title, parent_category}]
  const [pendingGroups, setPendingGroups] = useState([]); // neu angelegte Gruppen ohne Zuweisung
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [editCatId, setEditCatId] = useState("");
  const [editCatTitle, setEditCatTitle] = useState("");
  const [editGroupOld, setEditGroupOld] = useState("");
  const [editGroupNew, setEditGroupNew] = useState("");
  const [busy, setBusy] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/modules/textvorlagen/data?doc_type=${DOC_TYPE}`);
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Alle existierenden Gruppen (aus zugewiesenen Kategorien) + lokale Pending-Groups
  const groups = useMemo(() => {
    const used = new Map(); // name → count
    items.forEach((it) => {
      const p = (it.parent_category || "").trim();
      if (p) used.set(p, (used.get(p) || 0) + 1);
    });
    pendingGroups.forEach((g) => { if (!used.has(g)) used.set(g, 0); });
    return Array.from(used.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, pendingGroups]);

  const ungroupedCount = items.filter((it) => !(it.parent_category || "").trim()).length;

  // === Kategorien ===
  const createCategory = async () => {
    const t = newCategory.trim();
    if (!t) return;
    if (items.some(x => (x.title || "").toLowerCase() === t.toLowerCase())) {
      toast.error("Kategorie existiert bereits");
      return;
    }
    setBusy("create-cat");
    try {
      await api.post("/modules/textvorlagen/data", {
        title: t, content: "", doc_type: DOC_TYPE, text_type: "titel", keywords: [],
      });
      setNewCategory("");
      await reload();
      toast.success("Kategorie hinzugefügt");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Anlegen");
    } finally { setBusy(""); }
  };

  const saveCategory = async () => {
    const t = editCatTitle.trim();
    if (!t) return;
    setBusy(`edit-cat:${editCatId}`);
    try {
      await api.put(`/modules/textvorlagen/data/${editCatId}`, { title: t });
      setEditCatId(""); setEditCatTitle("");
      await reload();
      toast.success("Kategorie gespeichert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Speichern");
    } finally { setBusy(""); }
  };

  const deleteCategory = async (item) => {
    if (!window.confirm(`Kategorie „${item.title}" wirklich löschen?\nBestehende Kunden behalten den Wert — er verschwindet nur aus dem Dropdown.`)) return;
    setBusy(`del-cat:${item.id}`);
    try {
      await api.delete(`/modules/textvorlagen/data/${item.id}`);
      await reload();
      toast.success("Gelöscht");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Löschen");
    } finally { setBusy(""); }
  };

  const assignGroup = async (item, groupName) => {
    setBusy(`assign:${item.id}`);
    try {
      await api.put(`/modules/textvorlagen/data/${item.id}`, { parent_category: groupName || "" });
      // Wenn die Gruppe nun belegt ist, raus aus pendingGroups
      if (groupName) setPendingGroups((p) => p.filter((g) => g !== groupName));
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Zuweisung fehlgeschlagen");
    } finally { setBusy(""); }
  };

  // === Gruppen ===
  const createGroup = () => {
    const t = newGroup.trim();
    if (!t) return;
    if (groups.some((g) => g.name.toLowerCase() === t.toLowerCase())) {
      toast.error("Gruppe existiert bereits");
      return;
    }
    setPendingGroups((p) => [...p, t]);
    setNewGroup("");
    toast.success(`Gruppe „${t}" angelegt — Kategorien rechts zuweisen.`);
  };

  const startRenameGroup = (name) => {
    setEditGroupOld(name);
    setEditGroupNew(name);
  };

  const saveRenameGroup = async () => {
    const oldName = editGroupOld;
    const newName = editGroupNew.trim();
    if (!newName || newName === oldName) { setEditGroupOld(""); setEditGroupNew(""); return; }
    if (groups.some((g) => g.name !== oldName && g.name.toLowerCase() === newName.toLowerCase())) {
      toast.error("Zielname existiert bereits");
      return;
    }
    setBusy(`rename:${oldName}`);
    try {
      const affected = items.filter((it) => (it.parent_category || "") === oldName);
      await Promise.all(affected.map((it) =>
        api.put(`/modules/textvorlagen/data/${it.id}`, { parent_category: newName })
      ));
      // Pending-Group ebenfalls migrieren
      setPendingGroups((p) => p.map((g) => g === oldName ? newName : g));
      setEditGroupOld(""); setEditGroupNew("");
      await reload();
      toast.success(`Gruppe umbenannt (${affected.length} Kategorien aktualisiert)`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Umbenennen fehlgeschlagen");
    } finally { setBusy(""); }
  };

  const deleteGroup = async (group) => {
    const affected = items.filter((it) => (it.parent_category || "") === group.name);
    const isPending = group.count === 0 && pendingGroups.includes(group.name);
    const msg = isPending
      ? `Leere Gruppe „${group.name}" entfernen?`
      : `Gruppe „${group.name}" wirklich löschen?\n${affected.length} Kategorie(n) verlieren ihre Gruppenzuordnung.\nDie Kategorien selbst bleiben erhalten.`;
    if (!window.confirm(msg)) return;
    setBusy(`del-group:${group.name}`);
    try {
      if (!isPending) {
        await Promise.all(affected.map((it) =>
          api.put(`/modules/textvorlagen/data/${it.id}`, { parent_category: "" })
        ));
      }
      setPendingGroups((p) => p.filter((g) => g !== group.name));
      await reload();
      toast.success("Gruppe entfernt");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Löschen fehlgeschlagen");
    } finally { setBusy(""); }
  };

  // === Live-Vorschau ===
  const previewItems = useMemo(() => {
    const flat = items.map((it) => ({ title: it.title, parent_category: it.parent_category || "" }));
    return buildGroupedItems(flat, {});
  }, [items]);

  const [previewValue, setPreviewValue] = useState("");

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4" data-testid="kategorien-gruppen-tab">
      <div className="text-xs text-muted-foreground bg-muted/40 border rounded-sm p-3">
        Verwalte hier zentral die <b>Kunden-Kategorien</b> und ordne sie optional einer <b>Gruppe</b> zu.
        Die Live-Vorschau unten zeigt, wie die Filter-Leiste auf der Kundenseite aussieht.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ============ GRUPPEN ============ */}
        <Card className="p-4" data-testid="card-gruppen">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
            <FolderTree className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">Gruppen ({groups.length})</h2>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createGroup(); } }}
              placeholder="Neue Gruppe …"
              className="flex-1 h-9 rounded-sm border border-input bg-background px-3 text-sm"
              data-testid="input-new-group"
            />
            <button
              onClick={createGroup}
              disabled={!newGroup.trim()}
              className="inline-flex items-center gap-1 px-3 h-9 bg-emerald-600 text-white text-sm rounded-sm hover:bg-emerald-700 disabled:opacity-50"
              data-testid="btn-add-group"
            >
              <Plus className="w-3.5 h-3.5" /> Anlegen
            </button>
          </div>

          <div className="border rounded-sm divide-y max-h-[50vh] overflow-auto">
            {groups.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Noch keine Gruppen. Lege eine an und ordne Kategorien zu.</div>
            ) : groups.map((g) => (
              <div key={g.name} className="px-3 py-2 flex items-center gap-2 text-sm" data-testid={`row-group-${g.name}`}>
                {editGroupOld === g.name ? (
                  <>
                    <input
                      autoFocus
                      value={editGroupNew}
                      onChange={(e) => setEditGroupNew(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveRenameGroup(); } if (e.key === "Escape") { setEditGroupOld(""); setEditGroupNew(""); } }}
                      className="flex-1 h-8 rounded-sm border border-input bg-background px-2 text-sm"
                      data-testid={`input-rename-group-${g.name}`}
                    />
                    <button onClick={saveRenameGroup} disabled={!!busy} className="p-1.5 hover:bg-emerald-50 rounded-sm text-emerald-700" title="Speichern" data-testid={`btn-save-group-${g.name}`}>
                      {busy === `rename:${g.name}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditGroupOld(""); setEditGroupNew(""); }} className="p-1.5 hover:bg-muted rounded-sm" title="Abbrechen">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <FolderTree className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                    <div className="flex-1 truncate font-medium">{g.name}</div>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground" title="Anzahl zugeordneter Kategorien">
                      {g.count}
                    </span>
                    <button onClick={() => startRenameGroup(g.name)} className="p-1.5 hover:bg-muted rounded-sm" title="Umbenennen" data-testid={`btn-rename-group-${g.name}`}>
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                    <button onClick={() => deleteGroup(g)} disabled={!!busy} className="p-1.5 hover:bg-destructive/10 rounded-sm text-red-600" title="Löschen" data-testid={`btn-del-group-${g.name}`}>
                      {busy === `del-group:${g.name}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* ============ KATEGORIEN ============ */}
        <Card className="p-4" data-testid="card-kategorien">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
            <Tag className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">Kategorien ({items.length})</h2>
            {ungroupedCount > 0 && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                {ungroupedCount} ohne Gruppe
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCategory(); } }}
              placeholder="Neue Kategorie …"
              className="flex-1 h-9 rounded-sm border border-input bg-background px-3 text-sm"
              data-testid="input-new-category"
            />
            <button
              onClick={createCategory}
              disabled={!newCategory.trim() || !!busy}
              className="inline-flex items-center gap-1 px-3 h-9 bg-emerald-600 text-white text-sm rounded-sm hover:bg-emerald-700 disabled:opacity-50"
              data-testid="btn-add-category"
            >
              {busy === "create-cat" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Anlegen
            </button>
          </div>

          <div className="border rounded-sm divide-y max-h-[50vh] overflow-auto">
            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Noch keine Kategorien.</div>
            ) : items.map((item) => (
              <div key={item.id} className="px-3 py-2 flex items-center gap-2 text-sm" data-testid={`row-cat-${item.id}`}>
                {editCatId === item.id ? (
                  <>
                    <input
                      autoFocus
                      value={editCatTitle}
                      onChange={(e) => setEditCatTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveCategory(); } if (e.key === "Escape") setEditCatId(""); }}
                      className="flex-1 h-8 rounded-sm border border-input bg-background px-2 text-sm"
                      data-testid={`input-edit-cat-${item.id}`}
                    />
                    <button onClick={saveCategory} disabled={!!busy} className="p-1.5 hover:bg-emerald-50 rounded-sm text-emerald-700" title="Speichern" data-testid={`btn-save-cat-${item.id}`}>
                      {busy === `edit-cat:${item.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditCatId("")} className="p-1.5 hover:bg-muted rounded-sm" title="Abbrechen">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Tag className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                    <div className="flex-1 truncate">{item.title}</div>
                    <select
                      value={item.parent_category || ""}
                      onChange={(e) => assignGroup(item, e.target.value)}
                      disabled={busy === `assign:${item.id}`}
                      className="h-8 max-w-[140px] rounded-sm border border-input bg-background px-2 text-xs"
                      title="Gruppe zuweisen"
                      data-testid={`select-group-${item.id}`}
                    >
                      <option value="">— keine Gruppe —</option>
                      {groups.map((g) => (
                        <option key={g.name} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                    <button onClick={() => { setEditCatId(item.id); setEditCatTitle(item.title); }} className="p-1.5 hover:bg-muted rounded-sm" title="Bearbeiten" data-testid={`btn-edit-cat-${item.id}`}>
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                    <button onClick={() => deleteCategory(item)} disabled={!!busy} className="p-1.5 hover:bg-destructive/10 rounded-sm text-red-600" title="Löschen" data-testid={`btn-del-cat-${item.id}`}>
                      {busy === `del-cat:${item.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ============ LIVE-VORSCHAU ============ */}
      <Card className="p-4" data-testid="card-preview">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
          <Eye className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-sm">Live-Vorschau Filter-Leiste</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">Klick auf eine Pille zum Testen</span>
        </div>
        {previewItems.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Keine Kategorien — nichts anzuzeigen.</div>
        ) : (
          <div className="bg-muted/30 border rounded-sm p-3">
            <GroupedFilterBar
              items={previewItems}
              value={previewValue}
              onChange={setPreviewValue}
              allLabel="Alle"
              allCount={items.length}
              testIdPrefix="preview-filter"
            />
            {previewValue && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Aktiver Filter: <code className="bg-background px-1.5 py-0.5 rounded">{previewValue}</code>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export { KategorienGruppenTab };
export default KategorienGruppenTab;
