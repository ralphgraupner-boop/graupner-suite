/**
 * Baut einen Google-Calendar-"Add-Event"-Link aus einem Termin-Objekt.
 *
 * Spiegelt die Backend-Funktion `make_google_calendar_link` aus
 * `module_kalender_export/invite_service.py`. Eine Stelle pro Plattform,
 * gleiches Format. Aenderungen IMMER an beiden Stellen.
 *
 * Doku: https://calendar.google.com/calendar/render?action=TEMPLATE&...
 */

const _fmt = (iso) => {
  if (!iso) return "";
  let s = String(iso).replace(/[^\dT]/g, "");
  if (!s.includes("T")) s += "T000000";
  const [date, time] = s.split("T");
  let t = time;
  if (t.length === 4) t += "00";
  else if (t.length === 2) t += "0000";
  return `${date}T${t}`;
};

export const makeGoogleCalendarLink = (termin, kunde = null) => {
  if (!termin) return "";
  const titel = (termin.titel || "Termin").trim();
  const start = _fmt(termin.start || "");
  const ende = _fmt(termin.ende || termin.start || "");
  let ort = (termin.ort || "").trim();
  if (!ort && kunde) {
    ort = [
      `${kunde.strasse || ""} ${kunde.hausnummer || ""}`.trim(),
      `${kunde.plz || ""} ${kunde.ort || ""}`.trim(),
    ].filter(Boolean).join(" ").trim();
  }
  let details = (termin.beschreibung || "").trim();
  if (kunde) {
    const kn = [kunde.vorname, kunde.nachname].filter(Boolean).join(" ").trim()
      || kunde.name || kunde.firma || "";
    if (kn || kunde.phone) {
      details = (details ? details + "\n\n" : "")
        + (kn ? `Kunde: ${kn}\n` : "")
        + (kunde.phone ? `Telefon: ${kunde.phone}\n` : "");
      details = details.trimEnd();
    }
  }

  const params = [
    ["action", "TEMPLATE"],
    ["text", titel],
    ["dates", start && ende ? `${start}/${ende}` : ""],
  ];
  if (details) params.push(["details", details]);
  if (ort) params.push(["location", ort]);

  const qs = params
    .filter(([, v]) => !!v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `https://calendar.google.com/calendar/render?${qs}`;
};
