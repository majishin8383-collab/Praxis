// js/state/handoff.js  (FULL REPLACEMENT)
import { readLog, appendLog } from "../storage.js";

/**
 * Step A (minimal): shared "handoff" state.
 * Purpose:
 * - Provide a single, stable way to answer: "Has the user stabilized today?"
 * - Keep it log-derived (no locking, no forcing, no UI).
 *
 * "Stabilized" = they did ANY of:
 * - Calm (kind: "calm")
 * - Stop the Urge session (kind: "stop_urge")  // regardless of outcome; they still paused
 * - Move Forward session (kind: "move_forward") // momentum counts
 *
 * Safety is tracked separately via emergency_open.
 */

const BUILD = "HANDOFF-1";

const DAY_MS = 24 * 60 * 60 * 1000;

function nowISO() {
  return new Date().toISOString();
}

function safeReadLog(limit = 200) {
  try {
    const l = readLog();
    return Array.isArray(l) ? l.slice(0, limit) : [];
  } catch {
    return [];
  }
}

function safeAppend(entry) {
  try {
    appendLog(entry);
  } catch {}
}

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toMs(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isToday(iso) {
  const t = toMs(iso);
  return t >= startOfTodayMs();
}

function newestToday(log, kinds) {
  for (const e of log) {
    if (!e || !e.kind || !e.when) continue;
    if (!isToday(e.when)) continue;
    if (kinds.includes(e.kind)) return e;
  }
  return null;
}

/**
 * ✅ REQUIRED EXPORT (fixes your route error):
 * Returns true if user has stabilized at any point today.
 */
export function isStabilizedToday() {
  const log = safeReadLog(250);

  // Any of these counts as "Step 1 done" in an adaptive flow sense.
  const hit = newestToday(log, ["calm", "stop_urge", "move_forward"]);
  return !!hit;
}

/**
 * Returns the most recent stabilization event today (or null).
 * Useful for "why did we skip Step 1?"
 */
export function getStabilizationEventToday() {
  const log = safeReadLog(250);
  return newestToday(log, ["calm", "stop_urge", "move_forward"]);
}

/**
 * Convenience: what *type* of stabilization happened today?
 * Returns: "calm" | "stop_urge" | "move_forward" | null
 */
export function getStabilizationSourceToday() {
  const e = getStabilizationEventToday();
  return e ? e.kind : null;
}

/**
 * Safety flag: did they open Emergency recently today?
 * (We keep it separate from "stabilized", because emergency is a different class of action.)
 */
export function isSafetyActiveToday() {
  const log = safeReadLog(250);
  const e = newestToday(log, ["emergency_open"]);
  return !!e;
}

/**
 * Optional helper: if a screen wants to explicitly mark a handoff moment
 * without changing UI logic, it can call this.
 * (This is NOT required for Step A to work; Step A works log-only.)
 */
export function markHandoff(tag, data = {}) {
  safeAppend({
    kind: "handoff",
    when: nowISO(),
    tag: String(tag || "unknown"),
    build: BUILD,
    ...data,
  });
}

/**
 * Optional helper: some flows may want to consider "stabilized recently"
 * (e.g., within the last N minutes) instead of "today".
 */
export function isStabilizedWithinMinutes(minutes = 120) {
  const log = safeReadLog(250);
  const cutoff = Date.now() - Math.max(1, minutes) * 60 * 1000;

  for (const e of log) {
    if (!e || !e.kind || !e.when) continue;
    if (!["calm", "stop_urge", "move_forward"].includes(e.kind)) continue;
    const t = toMs(e.when);
    if (t && t >= cutoff) return true;
  }
  return false;
}
