// Cross-Window communication via BroadcastChannel
// Used to sync state between main app window and pop-out child windows.

const CHANNEL_NAME = "graupner-suite";
const _supported = typeof BroadcastChannel !== "undefined";
const PREF_KEY = "ui_direct_popout";

/**
 * Send an event to all open windows (main + popups) of the same origin.
 * @param {string} event - z.B. "kunden-changed", "projekte-changed"
 * @param {any}    payload
 */
export const broadcast = (event, payload = null) => {
  if (!_supported) return;
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ event, payload, ts: Date.now() });
    // Browser puffert, daher kurzer Delay vor close
    setTimeout(() => ch.close(), 100);
  } catch { /* ignore */ }
};

import { useEffect } from "react";

/**
 * React-Hook: hört auf ein Broadcast-Event und ruft handler auf.
 */
export const useBroadcast = (event, handler) => {
  useEffect(() => {
    if (!_supported) return undefined;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    const fn = (msg) => {
      if (msg?.data?.event === event) {
        try { handler(msg.data.payload); } catch { /* ignore */ }
      }
    };
    ch.addEventListener("message", fn);
    return () => {
      ch.removeEventListener("message", fn);
      ch.close();
    };
  }, [event, handler]);
};

/**
 * Direct-Pop-Out: öffnet eine Popup-Route in einem neuen Browser-Fenster.
 * Respektiert User-Pref `ui_direct_popout` (default: true).
 * @returns {boolean} true wenn Popup geöffnet, false wenn Pref aus oder Popup blockiert (Caller soll auf In-App-Modal fallbacken).
 */
export const openInPopup = (url, opts = {}) => {
  if (typeof window === "undefined") return false;
  // Pref check
  try {
    const pref = window.localStorage.getItem(PREF_KEY);
    if (pref === "false") return false;
  } catch { /* ignore */ }
  const w = opts.w || 980;
  const h = opts.h || 800;
  const left = (window.screenX || 0) + Math.max(0, (window.outerWidth - w) / 2);
  const top = (window.screenY || 0) + Math.max(0, (window.outerHeight - h) / 2);
  const features = `popup=yes,width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`;
  // _blank gives a fresh window per call → multi-instance möglich (Kunde A und Kunde B parallel)
  const popup = window.open(url, "_blank", features);
  return !!popup;
};

/**
 * Liest die aktuelle Direct-Popout-Einstellung. Default = true.
 */
export const isDirectPopoutEnabled = () => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PREF_KEY) !== "false";
  } catch {
    return true;
  }
};

/**
 * Setzt die Direct-Popout-Einstellung.
 */
export const setDirectPopoutEnabled = (enabled) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, enabled ? "true" : "false");
  } catch { /* ignore */ }
};

