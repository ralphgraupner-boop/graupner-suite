/**
 * Intent-Parser-Interface fuer den Assistenten.
 *
 * Heute: einfache Heuristik (Keyword-Matching auf Deutsch).
 * Phase 1: hier wird GPT-5.2 (via Emergent LLM Key) integriert.
 *          Die externe Schnittstelle parseIntent(text, context) bleibt identisch.
 *
 * Rueckgabe:
 *   { action_id: string|null, params: object, confidence: 0..1, raw_text: string }
 *
 * Null als action_id => kein klarer Intent erkannt, Sheet bleibt im
 * Voice-Notiz-Modus (nur Transkript anzeigen).
 */

const HEURISTIK = [
  {
    action_id: "snooze.done",
    confidence: 0.95,
    match: /\b(erledigt|fertig|done|abgehakt|gemacht)\b/i,
    extract: () => ({}),
  },
  {
    action_id: "snooze.later",
    confidence: 0.9,
    match: /\b(später|spaeter|nachher|morgen|gleich|in (\d+) ?(h|stunden?))\b/i,
    extract: (m) => {
      const hourMatch = m[0].match(/(\d+)\s*(h|stunden?)/i);
      if (hourMatch) return { snooze_hours: Math.min(Math.max(parseInt(hourMatch[1], 10), 1), 72) };
      if (/morgen/i.test(m[0])) return { snooze_hours: 24 };
      return { snooze_hours: 4 };
    },
  },
];

/**
 * Versucht einen Intent aus dem Text zu erkennen.
 * @param {string} text  - Transkript oder Texteingabe
 * @param {object} context - z.B. { mode: 'snooze' | 'default', entity_type, entity_id }
 */
export async function parseIntent(text, context = {}) {
  const cleaned = (text || "").trim();
  if (!cleaned) return { action_id: null, params: {}, confidence: 0, raw_text: "" };

  for (const rule of HEURISTIK) {
    const m = cleaned.match(rule.match);
    if (m) {
      return {
        action_id: rule.action_id,
        params: rule.extract(m),
        confidence: rule.confidence,
        raw_text: cleaned,
      };
    }
  }

  return { action_id: null, params: {}, confidence: 0, raw_text: cleaned };
}

/**
 * Hilfs-Mapping: Snooze-spezifische Intents -> snooze.push-Action-Params.
 * Wird vom Sheet aufgerufen, wenn snoozeContext aktiv ist.
 */
export const intentToSnoozeAction = (intent, snoozeContext) => {
  if (!snoozeContext || !intent?.action_id) return null;
  if (intent.action_id === "snooze.done") {
    return {
      action_id: "snooze.push",
      params: {
        push_token: snoozeContext.push_token,
        entity_type: snoozeContext.entity_type,
        entity_id: snoozeContext.entity_id,
        action: "done",
      },
    };
  }
  if (intent.action_id === "snooze.later") {
    return {
      action_id: "snooze.push",
      params: {
        push_token: snoozeContext.push_token,
        entity_type: snoozeContext.entity_type,
        entity_id: snoozeContext.entity_id,
        action: "snooze",
        snooze_hours: intent.params?.snooze_hours || 4,
      },
    };
  }
  return null;
};
