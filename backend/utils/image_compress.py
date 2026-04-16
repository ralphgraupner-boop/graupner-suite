from PIL import Image
from io import BytesIO
import logging

logger = logging.getLogger("database")

MAX_DIMENSION = 1920
JPEG_QUALITY = 80


def compress_image(content: bytes, content_type: str, filename: str) -> tuple:
    """Komprimiert ein Bild auf max 1920px und JPEG-Qualitaet 80.
    Returns: (compressed_bytes, new_content_type, new_filename)
    """
    if not content_type or not content_type.startswith("image/"):
        return content, content_type, filename

    # SVG nicht komprimieren
    if "svg" in content_type.lower() or (filename and filename.lower().endswith(".svg")):
        return content, content_type, filename

    try:
        img = Image.open(BytesIO(content))

        # EXIF Rotation anwenden
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        original_size = len(content)
        w, h = img.size

        # Nur verkleinern wenn groesser als MAX_DIMENSION
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            ratio = min(MAX_DIMENSION / w, MAX_DIMENSION / h)
            new_w = int(w * ratio)
            new_h = int(h * ratio)
            img = img.resize((new_w, new_h), Image.LANCZOS)

        # In JPEG konvertieren (ausser PNG mit Transparenz)
        output = BytesIO()
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            # PNG mit Transparenz beibehalten
            img.save(output, format="PNG", optimize=True)
            new_content_type = "image/png"
            new_filename = filename.rsplit(".", 1)[0] + ".png" if filename else "image.png"
        else:
            # Alles andere als JPEG
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            new_content_type = "image/jpeg"
            new_filename = filename.rsplit(".", 1)[0] + ".jpg" if filename else "image.jpg"

        compressed = output.getvalue()
        new_size = len(compressed)

        if new_size < original_size:
            savings = ((original_size - new_size) / original_size) * 100
            logger.info(f"Bild komprimiert: {filename} {original_size // 1024}KB -> {new_size // 1024}KB (-{savings:.0f}%)")
            return compressed, new_content_type, new_filename
        else:
            # Original war kleiner, behalten
            return content, content_type, filename

    except Exception as e:
        logger.warning(f"Bild-Komprimierung fehlgeschlagen fuer {filename}: {e}")
        return content, content_type, filename
