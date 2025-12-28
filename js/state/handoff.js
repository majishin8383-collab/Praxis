// js/state/handoff.js (FULL REPLACEMENT)
import {
  readLog,
  appendLog,
  hasStabilizeCreditToday,
  grantStabilizeCreditToday,
  clearStabilizeCredit,
  setNextIntent,
  consumeNextIntent,
} from "../storage.js";

/**
 * Shared "handoff" façade:
 * - "Has the user stabilized today?" (log + credit)
 * - Optional helpers for intent routing between tools
 *
 * This file exists so flows can import ONE stable module:
 *   ../../state/handoff.js
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
 * ✅ Used by flows that want a simple boolean.
 * Note: We treat "stabilized today" as:
 * - credit stamp OR
 * - evidence in log of calm/stop_urge/move_forward today
 */
export function isStabilizedToday() {
  if (hasStabilizeCreditToday()) return true;
  const log = safeReadLog(250);
  const hit = newestToday(log, ["calm", "stop_urge", "move_forward"]);
  return !!hit;
}

export function getStabilizationEventToday() {
  const log = safeReadLog(250);
  if (hasStabilizeCreditToday()) {
    // If credit exists but no log hit found (rare), still return a soft marker
    const hit = newestToday(log, ["calm", "stop_urge", "move_forward"]);
    return hit || { kind: "credit", when: nowISO() };
  }
  return newestToday(log, ["calm", "stop_urge", "move_forward"]);
}

export function isSafetyActiveToday() {
  const log = safeReadLog(250);
  const e = newestToday(log, ["emergency_open"]);
  return !!e;
}

/**
 * Optional marker (never required)
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
 * ✅ Re-export the stable functions that flows already import from handoff.js
 * (Keeps your existing todayPlan.js import working as-is.)
 */
export {
  hasStabilizeCreditToday,
  grantStabilizeCreditToday,
  clearStabilizeCredit,
  setNextIntent,
  consumeNextIntent,
};
