import { createContext, useContext, useEffect, useState, useCallback } from "react";

// Modi:
//   "light"      → keine CSS-Klasse (heller Modus)
//   "dark"       → .dark (warmes Neutralgrau)
//   "dark-blue"  → .dark + .dark-blue (warmes Dunkelblau)
//   "dark-green" → .dark-green (helles Schema mit dunkelgrüner Sidebar)
//   "gray"       → .gray (helles Schema mit dunkelgrauer Sidebar)
//   "system"     → folgt prefers-color-scheme (Dunkel = neutralgrau)
const STORAGE_KEY = "graupner_theme";
const VALID = ["light", "dark", "dark-blue", "dark-green", "gray", "system"];

const ThemeContext = createContext({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  cycleTheme: () => {},
});

function readStoredTheme() {
  if (typeof window === "undefined") return "system";
  const t = window.localStorage?.getItem(STORAGE_KEY);
  return VALID.includes(t) ? t : "system";
}

function systemPrefersDark() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Wendet den effektiven Modus auf <html> an
function applyThemeClasses(mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "dark-blue", "dark-green", "gray");
  if (mode === "dark") {
    root.classList.add("dark");
  } else if (mode === "dark-blue") {
    root.classList.add("dark", "dark-blue");
  } else if (mode === "dark-green") {
    root.classList.add("dark-green");
  } else if (mode === "gray") {
    root.classList.add("gray");
  }
}

function resolveMode(theme) {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveMode(readStoredTheme()));

  // Effekt: Theme auf <html> anwenden
  useEffect(() => {
    const effective = resolveMode(theme);
    applyThemeClasses(effective);
    setResolvedTheme(effective);
  }, [theme]);

  // System-Wechsel beobachten, nur wenn "system" aktiv
  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      const next = e.matches ? "dark" : "light";
      applyThemeClasses(next);
      setResolvedTheme(next);
    };
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [theme]);

  const setTheme = useCallback((t) => {
    if (!VALID.includes(t)) return;
    window.localStorage?.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const cycleTheme = useCallback(() => {
    const order = ["light", "dark", "dark-blue", "dark-green", "gray", "system"];
    const idx = order.indexOf(theme);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
