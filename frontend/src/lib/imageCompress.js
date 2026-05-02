/**
 * Browser-seitige Bildkompression vor dem Upload.
 * Reduziert ein Foto vom Handy/Kamera auf max. 1920×1920 px und re-encodet
 * als JPEG mit 80% Qualität – passend zum Server-Default.
 *
 * Spart Mobilfunk-Volumen + Upload-Zeit erheblich (z.B. 8 MB → ~500 KB).
 *
 * Bei Fehlern (z.B. unbekanntes Format oder zu kleines Bild) wird die
 * Originaldatei zurückgegeben, der Upload bleibt also funktional.
 */

const MAX_DIM = 1920;
const JPEG_QUALITY = 0.8;

/**
 * Komprimiert eine einzelne Datei. PDFs/Non-Images werden unverändert zurückgegeben.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function compressImageIfNeeded(file) {
  if (!file || typeof file !== "object") return file;
  // Nur Bilder bearbeiten; PDF/etc. unangetastet lassen
  if (!file.type || !file.type.startsWith("image/")) return file;
  // HEIC/HEIF kann der Browser oft nicht lesen → Server macht's
  if (/heic|heif/i.test(file.type)) return file;
  // Sehr kleine Bilder (< 500 KB) bringen wenig Ersparnis
  if (file.size && file.size < 500 * 1024) return file;

  try {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    let { width, height } = img;
    if (width <= MAX_DIM && height <= MAX_DIM) {
      // Größe passt schon, nur re-encode bei großem JPEG (über 2 MB)
      if (file.size < 2 * 1024 * 1024) return file;
    }
    const scale = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    // Wenn das Resultat überraschend größer ist (sehr selten), Original behalten
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.(png|gif|webp|bmp|tiff|jpe?g)$/i, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch (e) {
    // Fallback: Original schicken, Server kann's auch
    console.warn("Bildkompression fehlgeschlagen, sende Original:", e);
    return file;
  }
}

/**
 * Komprimiert eine Liste von Dateien parallel.
 * @param {File[]|FileList} files
 * @returns {Promise<File[]>}
 */
export async function compressImagesIfNeeded(files) {
  const arr = Array.from(files || []);
  return Promise.all(arr.map((f) => compressImageIfNeeded(f)));
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
