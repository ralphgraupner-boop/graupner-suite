import { createContext, useContext, useState, useCallback, useRef } from "react";

const WindowContext = createContext(null);

export const WindowManagerProvider = ({ children }) => {
  const [windows, setWindows] = useState([]); // [{id, title, minimized, zIndex}]
  const zRef = useRef(100);

  const register = useCallback((id, title) => {
    zRef.current += 1;
    const z = zRef.current;
    setWindows((prev) => {
      if (prev.some((w) => w.id === id)) return prev;
      return [...prev, { id, title: title || "Fenster", minimized: false, zIndex: z }];
    });
    return z;
  }, []);

  const unregister = useCallback((id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const bringToFront = useCallback((id) => {
    zRef.current += 1;
    const z = zRef.current;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, zIndex: z, minimized: false } : w)));
    return z;
  }, []);

  const setMinimized = useCallback((id, val) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: !!val } : w)));
  }, []);

  const setTitle = useCallback((id, title) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, title } : w)));
  }, []);

  const value = { windows, register, unregister, bringToFront, setMinimized, setTitle };

  return (
    <WindowContext.Provider value={value}>
      {children}
      <FloatingTaskBar />
    </WindowContext.Provider>
  );
};

export const useWindowManager = () => {
  const ctx = useContext(WindowContext);
  if (!ctx) {
    return {
      windows: [],
      register: () => 100,
      unregister: () => {},
      bringToFront: () => 100,
      setMinimized: () => {},
      setTitle: () => {},
    };
  }
  return ctx;
};

const FloatingTaskBar = () => {
  const ctx = useContext(WindowContext);
  if (!ctx) return null;
  const { windows, setMinimized, bringToFront } = ctx;
  const minimized = windows.filter((w) => w.minimized);
  if (minimized.length === 0) return null;
  return (
    <div
      data-testid="window-taskbar"
      className="hidden md:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-[200] gap-2 items-center bg-card/95 backdrop-blur shadow-2xl ring-1 ring-border rounded-sm px-3 py-2 max-w-[92vw] overflow-x-auto"
    >
      <span className="text-xs font-medium text-muted-foreground pr-2 border-r mr-1 shrink-0">
        Fenster ({minimized.length}):
      </span>
      {minimized.map((w) => (
        <button
          key={w.id}
          data-testid={`taskbar-item-${w.id}`}
          onClick={() => {
            setMinimized(w.id, false);
            bringToFront(w.id);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-primary hover:text-primary-foreground rounded-sm text-sm font-medium transition-colors shrink-0"
          title={w.title}
        >
          <span className="truncate max-w-[220px]">{w.title || "Fenster"}</span>
        </button>
      ))}
    </div>
  );
};
