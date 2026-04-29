/**
 * Browser-Download-Helfer mit nativem "Speichern unter..."-Dialog (File System Access API).
 * Fällt automatisch auf den klassischen Download-Anker zurück, wenn der Browser die API
 * nicht unterstützt (Safari, Firefox).
 */
export async function saveBlobWithPicker(blob, suggestedName) {
  // Chrome/Edge: nativer Save-Dialog
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "ZIP-Archiv",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, picked: true };
    } catch (err) {
      // User hat Abbrechen gedrückt
      if (err && err.name === "AbortError") return { ok: false, aborted: true };
      // Andere Fehler → Fallback
      console.warn("showSaveFilePicker fehlgeschlagen, falle zurück:", err);
    }
  }
  // Fallback: klassischer Download (Browser entscheidet Pfad nach Browser-Einstellung)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, picked: false };
}
