import { useState, useEffect, useRef } from "react";
import { X, TrendingUp } from "lucide-react";

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

export const StatCard = ({ title, value, subtitle, icon: Icon, trend }) => (
  <Card className="p-3 lg:p-6 card-hover hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
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

export const Modal = ({ isOpen, onClose, title, children, size = "md", blocking = false }) => {
  const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };
  const storageKey = `modal-pos:${_slugifyModalKey(typeof title === "string" ? title : "")}`;

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  // Track desktop breakpoint live
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Restore persisted position when (re)opening a draggable modal
  useEffect(() => {
    if (!isOpen || blocking || !isDesktop) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPos({ x: parsed.x, y: parsed.y });
          return;
        }
      }
    } catch { /* ignore */ }
    setPos({ x: 0, y: 0 });
  }, [isOpen, storageKey, blocking, isDesktop]);

  // Global mouse listeners while dragging
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const handleUp = () => {
      setDragging(false);
      setPos((p) => {
        try { window.localStorage.setItem(storageKey, JSON.stringify(p)); } catch { /* ignore */ }
        return p;
      });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, storageKey]);

  if (!isOpen) return null;

  const draggable = !blocking && isDesktop;

  const startDrag = (e) => {
    if (!draggable) return;
    if (e.target.closest?.("[data-modal-close]")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    setDragging(true);
    e.preventDefault();
  };

  const wrapperClass = blocking
    ? "fixed inset-0 z-50 flex items-center justify-center"
    : "fixed inset-0 z-50 flex items-center justify-center md:pointer-events-none";
  const backdropClass = blocking
    ? "absolute inset-0 bg-black/50"
    : "absolute inset-0 bg-black/50 md:hidden";

  const boxStyle = draggable ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined;
  const boxExtra = blocking
    ? ""
    : "md:pointer-events-auto md:shadow-2xl md:ring-1 md:ring-border";
  const headerExtra = draggable ? "md:cursor-grab md:active:cursor-grabbing md:select-none" : "";

  return (
    <div className={wrapperClass} data-testid="modal-root">
      <div className={backdropClass} onClick={onClose} data-testid="modal-backdrop" />
      <div
        className={`relative bg-card rounded-sm shadow-lg w-full ${sizes[size]} max-h-[90vh] overflow-auto m-4 ${boxExtra}`}
        style={boxStyle}
        data-testid="modal-box"
      >
        <div
          onMouseDown={startDrag}
          className={`flex items-center justify-between p-6 border-b ${headerExtra}`}
          data-testid="modal-header"
        >
          <h2 className="text-xl font-semibold">{title}</h2>
          <button data-modal-close data-testid="modal-close-btn" onClick={onClose} className="p-2 hover:bg-muted rounded-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
