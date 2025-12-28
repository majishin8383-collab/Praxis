// js/state/handoff.js  (FULL REPLACEMENT)

import {
  readLog,
  appendLog,
  // credit + intent live in storage.js
  hasStabilizeCreditToday,
  grantStabilizeCreditToday,
  clearStabilizeCredit,
  setNextIntent,
  consumeNextIntent,
} from "../storage.js";

/**
 * state/handoff.js is the stable API that flows import from.
 * storage.js is the data layer. This file re-exports the needed helpers
 * and adds a few log-derived convenience checks.
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
 * ✅ REQUIRED EXPORTS (used by Today Plan / Move Forward)
 * These are implemented in storage.js — we re-export here so flows have one import path.
 */
export {
  hasStabilizeCreditToday,
  grantStabilizeCreditToday,
  clearStabilizeCredit,
  setNextIntent,
  consumeNextIntent,
};

/**
 * Log-derived helpers (optional, but useful)
 */
export function isStabilizedToday() {
  // Prefer the explicit credit if present (fast + stable)
  if (hasStabilizeCreditToday()) return true;

  // Fallback: scan log (covers older logs / edge cases)
  const log = safeReadLog(250);
  const hit = newestToday(log, ["calm", "stop_urge", "move_forward"]);
  return !!hit;
}

export function getStabilizationEventToday() {
  const log = safeReadLog(250);
  return newestToday(log, ["calm", "stop_urge", "move_forward"]);
}

export function getStabilizationSourceToday() {
  const e = getStabilizationEventToday();
  return e ? e.kind : null;
}

export function isSafetyActiveToday() {
  const log = safeReadLog(250);
  const e = newestToday(log, ["emergency_open"]);
  return !!e;
}

export function markHandoff(tag, data = {}) {
  safeAppend({
    kind: "handoff",
    when: nowISO(),
    tag: String(tag || "unknown"),
    build: BUILD,
    ...data,
  });
}

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
