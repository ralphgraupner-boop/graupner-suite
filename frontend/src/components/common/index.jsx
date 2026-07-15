import { useState, useEffect, useRef } from "react";
import { X, TrendingUp, Minus, ExternalLink } from "lucide-react";
import { useWindowManager } from "@/components/windows/WindowManager";

export const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-[#14532D] text-[#F0FDF4] hover:bg-[#14532D]/90",
    secondary: "bg-[#F97316] text-white hover:bg-[#F97316]/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
  };
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 py-2",
    lg: "h-12 px-6 text-lg"
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ className = "", ...props }) => (
  <input
    className={`flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

export const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`flex min-h-[80px] w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

export const Card = ({ children, className = "", ...props }) => (
  <div className={`bg-card text-card-foreground rounded-sm border shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

export const StatCard = ({ title, value, subtitle, icon: Icon, trend, className = "" }) => (
  <Card className={`p-3 lg:p-6 card-hover hover:shadow-md hover:border-primary/30 transition-all cursor-pointer ${className}`}>
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">{title}</p>
        <p className="text-xl lg:text-3xl font-bold mt-1 lg:mt-2 font-mono">{value}</p>
        {subtitle && <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 lg:mt-1 hidden sm:block">{subtitle}</p>}
      </div>
      {Icon && (
        <div className="p-2 lg:p-3 bg-primary/10 rounded-sm shrink-0">
          <Icon className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
        </div>
      )}
    </div>
    {trend && (
      <div className="flex items-center gap-1 mt-2 lg:mt-3 text-xs lg:text-sm text-green-600">
        <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
        {trend}
      </div>
    )}
  </Card>
);

export const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-muted text-muted-foreground",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800"
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const _slugifyModalKey = (s) =>
  String(s || "modal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

let _modalInstanceCounter = 0;
const MIN_W = 320;
const MIN_H = 200;
const EDGE_THRESHOLD = 8;       // px from viewport edge
const SIDEBAR_W_LG = 256;       // matches lg:ml-64
const SIZE_PRESETS = {
  sm: { w: 480, max: "max-w-md" },
  md: { w: 720, max: "max-w-2xl" },
  lg: { w: 960, max: "max-w-4xl" },
  xl: { w: 1200, max: "max-w-6xl" },
};

// Returns the offset where the work area starts horizontally (0 unless desktop with sidebar)
const _sidebarOffset = () => {
  if (typeof window === "undefined") return 0;
  return window.innerWidth >= 1024 ? SIDEBAR_W_LG : 0;
};

// Compute target rect for snap mode ('max' | 'left' | 'right')
const _snapRect = (mode) => {
  if (typeof window === "undefined") return null;
  const sx = _sidebarOffset();
  const W = window.innerWidth - sx;
  const H = window.innerHeight;
  if (mode === "max") return { x: sx, y: 0, w: W, h: H };
  if (mode === "left") return { x: sx, y: 0, w: Math.floor(W / 2), h: H };
  if (mode === "right") return { x: sx + Math.ceil(W / 2), y: 0, w: Math.floor(W / 2), h: H };
  return null;
};

// Determine snap hint from cursor position
const _detectSnap = (clientX, clientY) => {
  if (typeof window === "undefined") return null;
  const sx = _sidebarOffset();
  if (clientY <= EDGE_THRESHOLD) return "max";
  if (clientX <= sx + EDGE_THRESHOLD) return "left";
  if (clientX >= window.innerWidth - EDGE_THRESHOLD) return "right";
  return null;
};

export const Modal = ({ isOpen, onClose, title, children, size = "md", blocking = false, popoutUrl = null, initialHeight = null }) => {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.md;
  const wm = useWindowManager();

  // Stable instance id per Modal element
  const instanceIdRef = useRef(null);
  if (!instanceIdRef.current) {
    _modalInstanceCounter += 1;
    instanceIdRef.current = `wnd-${_modalInstanceCounter}`;
  }
  const id = instanceIdRef.current;
  const storageKey = `modal-pos:${_slugifyModalKey(typeof title === "string" ? title : "")}`;

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );

  // Initial size & position (centered on screen)
  const computeInitial = () => {
    if (typeof window === "undefined") return { pos: { x: 0, y: 0 }, box: { w: preset.w, h: 600 } };
    const w = Math.min(preset.w, window.innerWidth - 80);
    const h = initialHeight != null
      ? Math.min(initialHeight, Math.max(MIN_H, window.innerHeight - 100))
      : Math.min(700, Math.max(MIN_H, window.innerHeight - 100));
    return {
      pos: { x: Math.max(20, (window.innerWidth - w) / 2), y: Math.max(20, (window.innerHeight - h) / 2) },
      box: { w, h },
    };
  };

  const [pos, setPos] = useState(() => computeInitial().pos);
  const [box, setBox] = useState(() => computeInitial().box);
  const [dragMode, setDragMode] = useState(null); // 'move' | 'resize-<dir>'
  const [snapHint, setSnapHint] = useState(null); // 'left' | 'right' | 'max' | null (during drag)
  const dragRef = useRef({});
  const preSnapRef = useRef(null); // {pos, box} saved before snap, for restore on drag-away

  // Track desktop breakpoint live
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const h = (e) => setIsDesktop(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  // Register / unregister with WindowManager (only desktop, non-blocking)
  useEffect(() => {
    if (!isOpen || blocking || !isDesktop) return;
    const titleStr = typeof title === "string" ? title : "Fenster";
    wm.register(id, titleStr);

    // Restore persisted pos+size, with viewport clamping
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.box?.w && parsed?.box?.h) {
          const cw = Math.min(parsed.box.w, window.innerWidth - 40);
          if (initialHeight != null) {
            // Modals mit fester Wunschhoehe (initialHeight gesetzt): nur die
            // gespeicherte Breite uebernehmen, gespeicherte Hoehe bewusst
            // ignorieren (sonst ueberschreibt eine alte, per Hand gezogene
            // Groesse dauerhaft die gewuenschte feste Hoehe).
            setBox((prev) => ({ w: Math.max(MIN_W, cw), h: prev.h }));
          } else {
            const ch = Math.min(parsed.box.h, window.innerHeight - 40);
            setBox({ w: Math.max(MIN_W, cw), h: Math.max(MIN_H, ch) });
          }
        }
        if (parsed?.pos && typeof parsed.pos.x === "number") {
          const cx = Math.min(Math.max(0, parsed.pos.x), window.innerWidth - 200);
          const cy = Math.min(Math.max(0, parsed.pos.y), window.innerHeight - 100);
          setPos({ x: cx, y: cy });
        }
      }
    } catch { /* ignore */ }

    return () => wm.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, blocking, isDesktop]);

  // Keep title in sync inside WindowManager (taskbar label)
  useEffect(() => {
    if (isOpen && !blocking && isDesktop) {
      wm.setTitle(id, typeof title === "string" ? title : "Fenster");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, isOpen, blocking, isDesktop]);

  // Find my live state in WindowManager
  const myW = wm.windows.find((w) => w.id === id);
  const minimized = !!myW?.minimized;
  const zIndex = myW?.zIndex ?? 100;

  // Global mouse listeners while dragging or resizing
  useEffect(() => {
    if (!dragMode) return;
    const handleMove = (e) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (dragMode === "move") {
        setPos({ x: dragRef.current.origPosX + dx, y: dragRef.current.origPosY + dy });
        setSnapHint(_detectSnap(e.clientX, e.clientY));
        return;
      }
      if (dragMode.startsWith("resize-")) {
        const dir = dragMode.slice("resize-".length);
        let nx = dragRef.current.origPosX;
        let ny = dragRef.current.origPosY;
        let nw = dragRef.current.origW;
        let nh = dragRef.current.origH;
        if (dir.includes("e")) nw = Math.max(MIN_W, dragRef.current.origW + dx);
        if (dir.includes("s")) nh = Math.max(MIN_H, dragRef.current.origH + dy);
        if (dir.includes("w")) {
          const newW = dragRef.current.origW - dx;
          if (newW >= MIN_W) {
            nw = newW;
            nx = dragRef.current.origPosX + dx;
          } else {
            nw = MIN_W;
            nx = dragRef.current.origPosX + (dragRef.current.origW - MIN_W);
          }
        }
        if (dir.includes("n")) {
          const newH = dragRef.current.origH - dy;
          if (newH >= MIN_H) {
            nh = newH;
            ny = dragRef.current.origPosY + dy;
          } else {
            nh = MIN_H;
            ny = dragRef.current.origPosY + (dragRef.current.origH - MIN_H);
          }
        }
        setBox({ w: nw, h: nh });
        setPos({ x: nx, y: ny });
      }
    };
    const handleUp = () => {
      // Snap-to-edge on drop?
      if (dragMode === "move" && snapHint) {
        const target = _snapRect(snapHint);
        if (target) {
          // Remember pre-snap state to restore on next drag-away
          if (!preSnapRef.current) {
            preSnapRef.current = { pos: { x: dragRef.current.origPosX, y: dragRef.current.origPosY }, box: { w: box.w, h: box.h } };
          }
          setPos({ x: target.x, y: target.y });
          setBox({ w: target.w, h: target.h });
        }
      } else if (dragMode === "move") {
        // Manual drop away from edges → forget snapped state
        preSnapRef.current = null;
      }
      setSnapHint(null);
      setDragMode(null);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ pos, box }));
      } catch { /* ignore */ }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragMode, storageKey, pos, box, snapHint]);

  if (!isOpen) return null;

  // === Inside a /popup/* browser window → fill the entire window ===
  const isInPopupWindow = typeof window !== "undefined" && window.location?.pathname?.startsWith("/popup/");
  if (isInPopupWindow) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-card" data-testid="modal-root">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button data-modal-close data-testid="modal-close-btn" onClick={onClose} className="p-2 hover:bg-muted rounded-sm" title="Fenster schließen">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6" data-testid="modal-box">{children}</div>
      </div>
    );
  }

  // === Mobile or explicit blocking → classic full-screen modal ===
  if (!isDesktop || blocking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="modal-root">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} data-testid="modal-backdrop" />
        <div
          className={`relative bg-card rounded-sm shadow-lg w-full ${preset.max} max-h-[90vh] overflow-auto m-4`}
          data-testid="modal-box"
        >
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button data-modal-close data-testid="modal-close-btn" onClick={onClose} className="p-2 hover:bg-muted rounded-sm">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    );
  }

  // === Desktop floating window ===
  const startMove = (e) => {
    if (e.target.closest?.("[data-modal-control]")) return;
    let originPosX = pos.x;
    let originPosY = pos.y;
    // If currently snapped, restore original size and place window under cursor
    if (preSnapRef.current) {
      const restored = preSnapRef.current;
      setBox({ w: restored.box.w, h: restored.box.h });
      // Position so the cursor lands proportionally inside the header (~80px from left, ~20px from top)
      const newX = Math.max(0, e.clientX - 80);
      const newY = Math.max(0, e.clientY - 20);
      setPos({ x: newX, y: newY });
      originPosX = newX;
      originPosY = newY;
      preSnapRef.current = null;
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, origPosX: originPosX, origPosY: originPosY };
    setDragMode("move");
    wm.bringToFront(id);
    e.preventDefault();
  };

  const startResize = (dir) => (e) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPosX: pos.x,
      origPosY: pos.y,
      origW: box.w,
      origH: box.h,
    };
    setDragMode(`resize-${dir}`);
    wm.bringToFront(id);
    e.preventDefault();
    e.stopPropagation();
  };

  const snapPreview = snapHint ? _snapRect(snapHint) : null;

  const handlePopout = () => {
    if (!popoutUrl || typeof window === "undefined") return;
    const w = 980;
    const h = 800;
    // Open at center of CURRENT screen (multi-monitor friendly via screenX/screenY)
    const left = (window.screenX || 0) + Math.max(0, (window.outerWidth - w) / 2);
    const top = (window.screenY || 0) + Math.max(0, (window.outerHeight - h) / 2);
    const features = `popup=yes,width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`;
    const popup = window.open(popoutUrl, `_graupner_popup_${id}`, features);
    if (popup) {
      // Close current in-app modal once popup is open
      onClose?.();
    } else {
      // Popup-Blocker
      try { window.alert("Bitte Popup-Blocker für diese Seite erlauben."); } catch { /* ignore */ }
    }
  };

  return (
    <>
    {snapPreview && (
      <div
        data-testid="snap-preview"
        className="fixed bg-primary/20 ring-2 ring-primary/80 pointer-events-none transition-all duration-100"
        style={{
          left: snapPreview.x,
          top: snapPreview.y,
          width: snapPreview.w,
          height: snapPreview.h,
          zIndex: 9998,
        }}
      />
    )}
    <div
      onMouseDown={() => wm.bringToFront(id)}
      className="fixed bg-card rounded-sm shadow-2xl ring-1 ring-border flex flex-col overflow-hidden"
      style={{
        left: pos.x,
        top: pos.y,
        width: box.w,
        height: box.h,
        zIndex,
        display: minimized ? "none" : "flex",
      }}
      data-testid="modal-box"
      data-modal-id={id}
    >
      {/* Header */}
      <div
        onMouseDown={startMove}
        onDoubleClick={() => wm.setMinimized(id, true)}
        className="flex items-center justify-between px-4 py-3 border-b cursor-grab active:cursor-grabbing select-none bg-card shrink-0"
        data-testid="modal-header"
      >
        <h2 className="text-lg font-semibold truncate pr-4">{title}</h2>
        <div className="flex items-center gap-1 shrink-0" data-modal-control>
          {popoutUrl && (
            <button
              data-testid="modal-popout-btn"
              onClick={handlePopout}
              className="p-2 hover:bg-muted rounded-sm"
              title="Auf eigenes Fenster (anderer Monitor)"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          <button
            data-testid="modal-minimize-btn"
            onClick={() => wm.setMinimized(id, true)}
            className="p-2 hover:bg-muted rounded-sm"
            title="Minimieren"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            data-modal-close
            data-testid="modal-close-btn"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-sm"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-auto p-6">{children}</div>

      {/* Resize handles (edges + corners) */}
      <div data-testid="resize-n" onMouseDown={startResize("n")} className="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize" />
      <div data-testid="resize-s" onMouseDown={startResize("s")} className="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize" />
      <div data-testid="resize-w" onMouseDown={startResize("w")} className="absolute top-2 bottom-2 left-0 w-1.5 cursor-w-resize" />
      <div data-testid="resize-e" onMouseDown={startResize("e")} className="absolute top-2 bottom-2 right-0 w-1.5 cursor-e-resize" />
      <div data-testid="resize-nw" onMouseDown={startResize("nw")} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" />
      <div data-testid="resize-ne" onMouseDown={startResize("ne")} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" />
      <div data-testid="resize-sw" onMouseDown={startResize("sw")} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" />
      <div data-testid="resize-se" onMouseDown={startResize("se")} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" />
    </div>
    </>
  );
};
