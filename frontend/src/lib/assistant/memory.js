/**
 * Memory-Wrapper fuer den Assistenten (Phase-3-Vorbereitung).
 *
 * Heute: no-op Wrapper. Funktionen sind aufrufbar, Backend speichert
 *        Eintraege ohne Embeddings (reine JSON-Daten).
 * Phase 3: Embeddings + semantische Suche werden hier ergaenzt.
 *
 * Schema eines Memory-Eintrags:
 *   {
 *     kontext:        "kunde" | "projekt" | "angebot" | "termin" | ...
 *     kontext_id:     "<uuid>"
 *     frage:          string  - was wollte der User
 *     antwort:        string  - was hat KI vorgeschlagen
 *     korrektur:      string|null - was hat User stattdessen gemacht
 *     wurde_bestaetigt: bool
 *   }
 */

import { api } from "@/lib/api";

export async function addMemory(entry) {
  try {
    const res = await api.post("/module-assistent/memory", entry);
    return res?.data;
  } catch {
    return null;
  }
}

export async function searchMemory(query, limit = 5) {
  try {
    const res = await api.get("/module-assistent/memory", { params: { q: query, limit } });
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
}
