import { createContext, useContext, useEffect, useState, useCallback } from "react";

// Drei Modi: "light" (immer hell), "dark" (immer dunkel), "system" (folgt OS)
const STORAGE_KEY = "graupner_theme";
const VALID = ["light", "dark", "system"];

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

function applyDarkClass(isDark) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const t = readStoredTheme();
    return t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
  });

  // Effekt: Theme auf <html> anwenden
  useEffect(() => {
    const effective = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    applyDarkClass(effective === "dark");
    setResolvedTheme(effective);
  }, [theme]);

  // System-Wechsel beobachten, nur wenn "system" aktiv
  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      applyDarkClass(e.matches);
      setResolvedTheme(e.matches ? "dark" : "light");
    };
    // Modern + Legacy Safari
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
    const order = ["light", "dark", "system"];
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
