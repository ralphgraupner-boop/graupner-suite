"""
Spam-Bewertung für eingehende Kontaktformular-Mails.

Heuristik-basiert (kein LLM, kein Captcha) — funktioniert komplett server-seitig
und beeinträchtigt weder die Webseite noch die Nutzer.

Punkte-System:
  ≥ 4 Punkte → wahrscheinlich Spam (Status "spam_verdacht")
  < 4 Punkte → echte Anfrage (Status "vorschlag")
"""
import re

PUNYCODE_PATTERN = re.compile(r"xn--", re.IGNORECASE)
URL_PATTERN_GLOBAL = re.compile(r"https?://\S+", re.IGNORECASE)
URL_SHORTENERS = ("bit.ly", "t.co", "tinyurl", "goo.gl", "ow.ly", "is.gd")

# Spam-typische Begriffe (englisch + deutsch)
SPAM_KEYWORDS = [
    "seo service", "guest post", "backlink", "back link", "link building",
    "casino", "bitcoin", "crypto", "forex", "loan", "mortgage", "viagra",
    "rolex", "replica", "essay writing", "click here", "make money",
    "weight loss", "credit repair", "best deal", "earn $", "free trial",
]

# Wegwerf-Mail-Domains
TEMP_MAIL_DOMAINS = (
    "mailinator", "tempmail", "guerrilla", "10minutemail", "trashmail",
    "throwaway", "yopmail", "fakeinbox", "spamgourmet", "sharklasers",
)

# Häufige englische Wörter (für Sprach-Check). 4+ Treffer in kurzer Nachricht = englisch
ENGLISH_WORDS = re.compile(
    r"\b(the|and|your|website|please|hello|with|business|contact|service|"
    r"would|need|company|email|interested|provide|offer|client|customer)\b",
    re.IGNORECASE,
)


def evaluate_spam(parsed: dict, body_excerpt: str = "", from_email: str = "") -> dict:
    """Liefert {is_spam: bool, score: int, reasons: [str]}."""
    score = 0
    reasons: list[str] = []

    nachricht = (parsed.get("nachricht") or "")[:5000]
    full_text = f"{nachricht}\n{body_excerpt[:3000]}".lower()
    email = (parsed.get("email") or from_email or "").lower()

    # 1. Punycode-Domain in Email = sehr verdächtig
    if PUNYCODE_PATTERN.search(email):
        score += 5
        reasons.append("Punycode-Domain in E-Mail")

    # 2. Wegwerf-Mail-Domain
    if email and any(d in email for d in TEMP_MAIL_DOMAINS):
        score += 4
        reasons.append("Wegwerf-Mail-Domain")

    # 3. Mehr als 2 URLs in der Nachricht
    urls = URL_PATTERN_GLOBAL.findall(nachricht)
    if len(urls) > 2:
        score += 3
        reasons.append(f"{len(urls)} Links in Nachricht")

    # 4. URL-Verkürzer in der Nachricht
    if any(s in nachricht.lower() for s in URL_SHORTENERS):
        score += 3
        reasons.append("URL-Verkürzer in Nachricht")

    # 5. Spam-Keywords
    matched_kw = [kw for kw in SPAM_KEYWORDS if kw in full_text]
    if matched_kw:
        score += min(2 * len(matched_kw), 5)
        reasons.append(f"Spam-Begriffe: {', '.join(matched_kw[:3])}")

    # 6. Rein englischer Text (Schwellwert: ≥ 4 englische Häufigkeitswörter)
    en_hits = len(ENGLISH_WORDS.findall(nachricht))
    de_hits = len(re.findall(r"\b(und|der|die|das|ich|sie|für|mit|nicht|haben)\b", nachricht, re.I))
    if en_hits >= 4 and de_hits <= 1:
        score += 3
        reasons.append("Nachricht vermutlich englischsprachig")

    # 7. Kein Vor- ODER Nachname extrahiert
    if not parsed.get("vorname") and not parsed.get("nachname"):
        score += 2
        reasons.append("Kein Name erkannt")

    # 8. Telefon fehlt UND keine deutsche Mail
    if not parsed.get("telefon") and email and not email.endswith((".de", ".at", ".ch")):
        score += 1
        reasons.append("Kein Telefon, keine deutsche Mail-Domain")

    # 9. Sehr kurze Nachricht (< 10 Zeichen) ohne Telefon
    if len(nachricht.strip()) < 10 and not parsed.get("telefon"):
        score += 2
        reasons.append("Sehr kurze Nachricht ohne Telefon")

    # 10. "Test"-Anfrage (häufig bei Bot-Tests)
    if re.search(r"\btest(ing|er)?\b", nachricht.lower()) and len(nachricht) < 50:
        score += 2
        reasons.append("Kurzer Test-Eintrag")

    return {
        "is_spam": score >= 4,
        "score": score,
        "reasons": reasons,
    }
