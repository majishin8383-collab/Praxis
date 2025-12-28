// js/state/handoff.js  (FULL REPLACEMENT)

import {
  readLog,
  appendLog,
  hasStabilizeCreditToday,
  grantStabilizeCreditToday,
  setNextIntent,
  consumeNextIntent,
} from "../storage.js";

/**
 * Step A: shared "handoff" state.
 * Purpose:
 * - Provide a stable way to answer: "Has the user stabilized today?"
 * - Keep it log-derived (no locking, no forcing, no UI)
 *
 * "Stabilized" today if they did ANY of:
 * - calm
 * - stop_urge (logged session)
 * - move_forward (logged session)
 *
 * Safety is tracked separately via emergency_open.
 */

const BUILD = "HANDOFF-2";

function nowISO() {
  return new Date().toISOString();
}

function safeReadLog(limit = 250) {
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
 * ✅ REQUIRED EXPORT:
 * True if user has stabilized at any point today (log-derived).
 */
export function isStabilizedToday() {
  const log = safeReadLog(250);
  const hit = newestToday(log, ["calm", "stop_urge", "move_forward"]);
  return !!hit;
}

/**
 * Returns the most recent stabilization event today (or null).
 */
export function getStabilizationEventToday() {
  const log = safeReadLog(250);
  return newestToday(log, ["calm", "stop_urge", "move_forward"]);
}

/**
 * Returns: "calm" | "stop_urge" | "move_forward" | null
 */
export function getStabilizationSourceToday() {
  const e = getStabilizationEventToday();
  return e ? e.kind : null;
}

/**
 * Safety flag: did they open Emergency today?
 */
export function isSafetyActiveToday() {
  const log = safeReadLog(250);
  const e = newestToday(log, ["emergency_open"]);
  return !!e;
}

/**
 * Optional: mark a handoff moment (telemetry only).
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
 * Optional helper: stabilized within last N minutes
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

// ------------------------------------------------------
// ✅ Re-export “credit + intent” helpers from storage.js
// so flows can import consistently from state/handoff.js
// ------------------------------------------------------
export { hasStabilizeCreditToday, grantStabilizeCreditToday, setNextIntent, consumeNextIntent };
