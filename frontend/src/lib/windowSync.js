// Cross-Window communication via BroadcastChannel
// Used to sync state between main app window and pop-out child windows.

const CHANNEL_NAME = "graupner-suite";
const _supported = typeof BroadcastChannel !== "undefined";

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
