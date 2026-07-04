/**
 * Erkennt aktuelle Umgebung anhand des Hostnames und liefert Marken-Styling.
 * Wird in Sidebar, Mobile-Header, Login, Banner verwendet — überall identisch.
 */
export const detectAppEnv = () => {
  if (typeof window === "undefined") return { kind: "unknown", short: "?", color: "slate" };
  const h = window.location.hostname;
  if (h.includes("85.215.145.155")) {
    return { kind: "ionos-test", short: "IONOS TEST", color: "orange" };
  }
  if (h.includes("preview") || h.includes("emergentagent.com")) {
    return { kind: "preview", short: "PREVIEW", color: "blue" };
  }
  if (h.includes("emergent.host") || h.includes("graupner") || h === "localhost") {
    return { kind: "live", short: "LIVE", color: "red" };
  }
  return { kind: "unknown", short: "?", color: "slate" };
};

export const ENV_BADGE_CLASSES = {
  blue: "bg-blue-600 text-white",
  red: "bg-red-600 text-white",
  slate: "bg-slate-500 text-white",
  orange: "bg-orange-500 text-white",
};

export const ENV_TEXT_CLASSES = {
  blue: "text-blue-700",
  red: "text-red-700",
  slate: "text-slate-700",
  orange: "text-orange-700",
};
