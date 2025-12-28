/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/state/handoff.js  (FULL REPLACEMENT)

import {
  readLog,
  appendLog,
  hasStabilizeCreditToday as _hasStabilizeCreditToday,
  grantStabilizeCreditToday as _grantStabilizeCreditToday,
  clearStabilizeCredit as _clearStabilizeCredit,
  setNextIntent as _setNextIntent,
  consumeNextIntent as _consumeNextIntent,
} from "../storage.js";

/**
 * Step A (minimal): shared "handoff" state.
 *
 * Purpose:
 * - Provide a single, stable way to answer: "Has the user stabilized today?"
 * - Keep it log-derived (no locking, no forcing, no UI).
 *
 * "Stabilized" (log-derived) = they did ANY of:
 * - Calm (kind: "calm")
 * - Stop the Urge session (kind: "stop_urge") // regardless of outcome; they still paused
 * - Move Forward session (kind: "move_forward") // momentum counts
 *
 * NOTE:
 * We also maintain a lightweight "credit" flag via storage.js (hasStabilizeCreditToday)
 * which can be granted automatically on log append. Both can coexist safely.
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
 * Returns true if user has stabilized at any point today (log-derived).
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
 * Optional helper: log a handoff moment (analytics only).
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
 * Optional helper: stabilized within last N minutes (log-derived).
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

// ---------------------------------------------------------------------------
// ✅ Exports required by newer adaptive flows (delegated to storage.js)
// ---------------------------------------------------------------------------

/**
 * Credit-based: true if stabilize credit was granted today (storage flag).
 * This is "lighter" and faster than scanning logs, and can be granted on appendLog().
 */
export function hasStabilizeCreditToday() {
  try {
    return _hasStabilizeCreditToday();
  } catch {
    return false;
  }
}

export function grantStabilizeCreditToday() {
  try {
    _grantStabilizeCreditToday();
  } catch {}
}

export function clearStabilizeCredit() {
  try {
    _clearStabilizeCredit();
  } catch {}
}

/**
 * One-time routing intent between tools.
 */
export function setNextIntent(intent) {
  try {
    _setNextIntent(intent);
  } catch {}
}

export function consumeNextIntent(maxAgeMinutes = 30) {
  try {
    return _consumeNextIntent(maxAgeMinutes);
  } catch {
    return null;
  }
}
