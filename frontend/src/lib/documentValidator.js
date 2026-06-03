/**
 * Plausibilitäts-Prüfung für Dokumente (Angebot/Auftrag/Rechnung).
 * Reine clientseitige Faktencheck-Funktion — kein KI-Call.
 *
 * Liefert ein Array von Issues mit:
 *   severity: 'error' | 'warning' | 'info'
 *   field:    Anzeigename des Feldes
 *   message:  Klartext-Hinweis
 */
export const validateDocument = ({ customer, betreff, positions, type, dueDays, anzahlungProzent, abschlag, mwstSatz, lohnanteilLeer }) => {
  const issues = [];

  // Lohnanteil-Pflichtpruefung (nur Rechnung): bei leerem Lohnanteil stoppt die Pruefung hier
  if (type === "invoice" && lohnanteilLeer) {
    return [{ severity: "error", field: "Lohnanteil", message: "Sie haben die Lohnkosten noch nicht eingetragen — bitte eintragen" }];
  }

  // Kunde
  if (!customer || (!customer.name && !customer.nachname)) {
    issues.push({ severity: "error", field: "Kunde", message: "Kein Kunde ausgewählt" });
  } else if (!customer.address) {
    issues.push({ severity: "warning", field: "Kunde", message: "Adresse fehlt" });
  }

  // Betreff
  if (!betreff || !betreff.trim()) {
    issues.push({ severity: "warning", field: "Betreff", message: "Betreff ist leer" });
  }

  // Positionen
  const valid = (positions || []).filter((p) => p && p.type !== "titel");
  if (valid.length === 0) {
    issues.push({ severity: "error", field: "Positionen", message: "Keine Positionen erfasst" });
  }

  let total = 0;
  (positions || []).forEach((p, i) => {
    const nr = i + 1;
    if (!p) return;
    if (p.type === "titel") {
      if (!p.description?.trim()) {
        issues.push({ severity: "warning", field: `Titel ${nr}`, message: "Titel-Text leer" });
      }
      return;
    }
    if (!p.description?.trim()) {
      issues.push({ severity: "error", field: `Position ${nr}`, message: "Beschreibung fehlt" });
    }
    const qty = parseFloat(p.quantity);
    if (!qty || qty <= 0) {
      issues.push({ severity: "warning", field: `Position ${nr}`, message: "Menge ist 0" });
    }
    const price = parseFloat(p.price);
    if (price === 0 || price === undefined || price === null) {
      issues.push({ severity: "warning", field: `Position ${nr}`, message: "Einzelpreis ist 0" });
    }
    if (price < 0) {
      issues.push({ severity: "error", field: `Position ${nr}`, message: "Preis ist negativ" });
    }
    if (!p.unit?.trim()) {
      issues.push({ severity: "info", field: `Position ${nr}`, message: "Einheit fehlt" });
    }
    total += (qty || 0) * (price || 0);
  });

  // Summe
  if (valid.length > 0 && total === 0) {
    issues.push({ severity: "warning", field: "Gesamtsumme", message: "Gesamtsumme ist 0,00 €" });
  }

  // Doppelte Position-Beschreibungen
  const seen = new Map();
  valid.forEach((p, i) => {
    const key = (p.description || "").trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) {
      issues.push({ severity: "info", field: `Position ${i + 1}`, message: `Beschreibung gleich wie Position ${seen.get(key) + 1}` });
    } else {
      seen.set(key, i);
    }
  });

  // Rabatt-Warnung
  const ab = parseFloat(abschlag);
  if (ab > 50) issues.push({ severity: "warning", field: "Abschlag", message: `Abschlag ${ab}% — sehr hoch` });

  // Anzahlung
  const az = parseFloat(anzahlungProzent);
  if (az > 100) issues.push({ severity: "error", field: "Anzahlung", message: "Anzahlung > 100%" });

  // Zahlungsziel
  if (type === "invoice") {
    const dd = parseInt(dueDays, 10);
    if (Number.isFinite(dd)) {
      if (dd < 0) issues.push({ severity: "error", field: "Zahlungsziel", message: "Negativ" });
      if (dd > 365) issues.push({ severity: "warning", field: "Zahlungsziel", message: `${dd} Tage — ungewöhnlich lang` });
    }
  }

  // MwSt
  const mwst = parseFloat(mwstSatz);
  if (!Number.isFinite(mwst) || mwst < 0) {
    issues.push({ severity: "warning", field: "MwSt", message: "MwSt-Satz fehlt oder ungültig" });
  }

  return issues;
};
