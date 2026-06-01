/**
 * Action-Registry für den globalen Assistenten.
 *
 * Jede Aktion ist hier zentral definiert. Sheet, Voice-Intent und
 * spaeter Hintergrund-Agent rufen Aktionen ueber dieses Registry auf.
 *
 * Schema einer Aktion:
 *   id:                   eindeutiger String, z.B. "snooze.push"
 *   label:                Menschenlesbar fuer UI
 *   description:          kurze Beschreibung
 *   params:               { name: { type, required } }
 *   requiresConfirmation: bool - falls true, vorher User-Bestaetigung
 *   execute(params, ctx): async Funktion mit Aktions-Logik
 *
 * Erweiterung in Phase 1 (Voice-to-Action):
 *   - Neue Aktion hier eintragen, Intent-Parser matched darauf.
 *   - Sheet bleibt unveraendert.
 */

import { toast } from "sonner";

const REGISTRY = new Map();

export const registerAction = (action) => {
  if (!action?.id || typeof action.execute !== "function") {
    console.warn("registerAction: ungueltige Aktion", action);
    return;
  }
  REGISTRY.set(action.id, action);
};

export const getAction = (id) => REGISTRY.get(id);

export const listActions = () => Array.from(REGISTRY.values());

export const executeAction = async (id, params = {}, ctx = {}) => {
  const action = REGISTRY.get(id);
  if (!action) {
    toast.error(`Unbekannte Aktion: ${id}`);
    return { ok: false, error: "unknown_action" };
  }
  try {
    const result = await action.execute(params, ctx);
    // Audit-Log (no-op falls Backend ohne Audit)
    try {
      await fetch("/api/module-assistent/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_id: id,
          params,
          user_confirmed: !action.requiresConfirmation || params.__confirmed === true,
          result_ok: result?.ok !== false,
        }),
      });
    } catch { /* audit darf nicht blocken */ }
    return result;
  } catch (e) {
    toast.error(e?.message || "Aktion fehlgeschlagen");
    return { ok: false, error: e?.message };
  }
};

// ==================== Default-Aktionen ====================
// Heute: nur Push-Snooze (umzog vom Sheet ins Registry).

registerAction({
  id: "snooze.push",
  label: "Push-Erinnerung verschieben",
  description: "Push-Erinnerung als erledigt markieren oder verschieben (1h/4h/24h).",
  params: {
    push_token: { type: "string", required: true },
    entity_type: { type: "string", required: true },
    entity_id: { type: "string", required: true },
    action: { type: "string", required: true }, // done | snooze
    snooze_hours: { type: "number", required: false },
  },
  requiresConfirmation: false,
  execute: async (p) => {
    const body = {
      push_token: p.push_token,
      entity_type: p.entity_type,
      entity_id: p.entity_id,
      action: p.action,
    };
    if (p.action === "snooze") body.snooze_hours = p.snooze_hours;
    const res = await fetch("/api/push/quick-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Aktion fehlgeschlagen");
    return { ok: true, ...data };
  },
});

// ==================== Phase-1-Vorbereitung ====================
// Hier werden spaeter Voice-Aktionen registriert, z.B.:
//
// registerAction({
//   id: "aufgabe.anlegen",
//   label: "Aufgabe anlegen",
//   requiresConfirmation: true,
//   params: { titel: {type:"string", required:true}, kunde_id: {type:"string"} },
//   execute: async (p) => { ... POST /api/module-aufgaben ... }
// });
