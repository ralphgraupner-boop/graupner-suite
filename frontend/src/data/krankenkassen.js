// Deutsche Krankenkassen (gesetzlich + bekannte private)
export const KRANKENKASSEN = [
  // Gesetzlich - Ersatzkassen
  { name: "Techniker Krankenkasse (TK)", art: "gesetzlich" },
  { name: "BARMER", art: "gesetzlich" },
  { name: "DAK-Gesundheit", art: "gesetzlich" },
  { name: "KKH Kaufmännische Krankenkasse", art: "gesetzlich" },
  { name: "HEK - Hanseatische Krankenkasse", art: "gesetzlich" },
  { name: "hkk Krankenkasse", art: "gesetzlich" },
  // AOKs
  { name: "AOK Baden-Württemberg", art: "gesetzlich" },
  { name: "AOK Bayern", art: "gesetzlich" },
  { name: "AOK Bremen/Bremerhaven", art: "gesetzlich" },
  { name: "AOK Hessen", art: "gesetzlich" },
  { name: "AOK Niedersachsen", art: "gesetzlich" },
  { name: "AOK NordWest", art: "gesetzlich" },
  { name: "AOK Nordost", art: "gesetzlich" },
  { name: "AOK PLUS (Sachsen/Thüringen)", art: "gesetzlich" },
  { name: "AOK Rheinland/Hamburg", art: "gesetzlich" },
  { name: "AOK Rheinland-Pfalz/Saarland", art: "gesetzlich" },
  { name: "AOK Sachsen-Anhalt", art: "gesetzlich" },
  // Betriebskrankenkassen (BKK) - wichtigste
  { name: "BKK VBU", art: "gesetzlich" },
  { name: "BKK Mobil Oil", art: "gesetzlich" },
  { name: "Audi BKK", art: "gesetzlich" },
  { name: "BKK firmus", art: "gesetzlich" },
  { name: "BKK ProVita", art: "gesetzlich" },
  { name: "BKK GILDEMEISTER SEIDENSTICKER", art: "gesetzlich" },
  { name: "SBK - Siemens-Betriebskrankenkasse", art: "gesetzlich" },
  { name: "mhplus Betriebskrankenkasse", art: "gesetzlich" },
  { name: "Pronova BKK", art: "gesetzlich" },
  { name: "Continentale BKK", art: "gesetzlich" },
  { name: "Salus BKK", art: "gesetzlich" },
  { name: "Novitas BKK", art: "gesetzlich" },
  { name: "Viactiv Krankenkasse", art: "gesetzlich" },
  { name: "energie-BKK", art: "gesetzlich" },
  { name: "BKK Linde", art: "gesetzlich" },
  { name: "BKK Akzo Nobel Bayern", art: "gesetzlich" },
  // IKK
  { name: "IKK classic", art: "gesetzlich" },
  { name: "IKK - Die Innovationskasse", art: "gesetzlich" },
  { name: "IKK gesund plus", art: "gesetzlich" },
  { name: "IKK Südwest", art: "gesetzlich" },
  { name: "BIG direkt gesund", art: "gesetzlich" },
  // Andere
  { name: "Knappschaft", art: "gesetzlich" },
  { name: "Sozialversicherung für Landwirtschaft, Forsten und Gartenbau (SVLFG)", art: "gesetzlich" },
  // Private (Auswahl)
  { name: "Debeka Krankenversicherung (privat)", art: "privat" },
  { name: "DKV Deutsche Krankenversicherung (privat)", art: "privat" },
  { name: "AXA Krankenversicherung (privat)", art: "privat" },
  { name: "Allianz Private Krankenversicherung (privat)", art: "privat" },
  { name: "Continentale Krankenversicherung (privat)", art: "privat" },
  { name: "HUK-COBURG Krankenversicherung (privat)", art: "privat" },
  { name: "SIGNAL IDUNA (privat)", art: "privat" },
  { name: "Gothaer Krankenversicherung (privat)", art: "privat" },
  { name: "HanseMerkur Krankenversicherung (privat)", art: "privat" },
  { name: "Barmenia Krankenversicherung (privat)", art: "privat" },
  { name: "Central Krankenversicherung (privat)", art: "privat" },
  { name: "LVM Krankenversicherung (privat)", art: "privat" },
  { name: "Sonstige / Andere", art: "sonstige" },
];

export const STEUERKLASSEN = [
  { value: "I", label: "I - Ledig/geschieden/verwitwet" },
  { value: "II", label: "II - Alleinerziehend" },
  { value: "III", label: "III - Verheiratet (Hauptverdiener)" },
  { value: "IV", label: "IV - Verheiratet (beide verdienen gleich)" },
  { value: "V", label: "V - Verheiratet (Zweitverdiener)" },
  { value: "VI", label: "VI - Nebenverdienst" },
];

export const KONFESSIONEN = [
  "keine", "römisch-katholisch (rk)", "evangelisch (ev)",
  "jüdisch (jd)", "altkatholisch (ak)", "freireligiös", "sonstige",
];

export const BESCHAEFTIGUNGSARTEN = [
  "Vollzeit", "Teilzeit", "Minijob (520€)", "Midijob", "Azubi",
  "Werkstudent", "Aushilfe", "Praktikant", "Freier Mitarbeiter",
];

export const DOKUMENT_KATEGORIEN = [
  { value: "arbeitsvertrag", label: "Arbeitsvertrag" },
  { value: "zeugnis", label: "Zeugnis" },
  { value: "abmahnung", label: "Abmahnung" },
  { value: "kuendigung", label: "Kündigung" },
  { value: "lohnabrechnung", label: "Lohnabrechnung" },
  { value: "bescheinigung", label: "Bescheinigung" },
  { value: "fortbildung", label: "Fortbildungsnachweis" },
  { value: "fuehrerschein", label: "Führerschein-Kopie" },
  { value: "ausweis", label: "Ausweis-Kopie" },
  { value: "sonstiges", label: "Sonstiges" },
];
