import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { HELP_TEXTS } from "./helpTexts";

const HelpContext = createContext({
  enabled: false,
  setEnabled: () => {},
  getText: () => "",
});

const STORAGE_KEY = "graupner_help_enabled";

export const HelpProvider = ({ children }) => {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setEnabledState(true);
    } catch { /* ignore */ }
  }, []);

  const setEnabled = useCallback((val) => {
    setEnabledState(val);
    try {
      localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
    } catch { /* ignore */ }
  }, []);

  const getText = useCallback((key) => {
    return HELP_TEXTS[key] || "";
  }, []);

  return (
    <HelpContext.Provider value={{ enabled, setEnabled, getText }}>
      {children}
    </HelpContext.Provider>
  );
};

export const useHelp = () => useContext(HelpContext);
