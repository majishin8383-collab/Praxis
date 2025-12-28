// js/state/handoff.js  (FULL REPLACEMENT)
//
// Purpose:
// - Provide a tiny cross-screen "handoff" intent (e.g., route into Today Plan at Step 2)
// - Provide simple "today" flags so flows can coordinate (stabilized / acted)
// - Export names that other modules may import (prevents route-load crashes)

const KEY_INTENT = "praxis_next_intent_v1";
const KEY_STABILIZED_DAY = "praxis_stabilized_day_v1";
const KEY_ACTED_DAY = "praxis_acted_day_v1";

function todayStamp() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return String(d.getTime());
}

// ---------- Intent (one-shot) ----------
export function setNextIntent(intent) {
  try {
    localStorage.setItem(KEY_INTENT, String(intent || ""));
  } catch {}
}

export function peekNextIntent() {
  try {
    return localStorage.getItem(KEY_INTENT) || "";
  } catch {
    return "";
  }
}

export function consumeNextIntent() {
  try {
    const v = localStorage.getItem(KEY_INTENT) || "";
    localStorage.setItem(KEY_INTENT, "");
    return v;
  } catch {
    return "";
  }
}

export function clearNextIntent() {
  try {
    localStorage.setItem(KEY_INTENT, "");
  } catch {}
}

// ---------- Today flags ----------
export function markStabilizedToday() {
  try {
    localStorage.setItem(KEY_STABILIZED_DAY, todayStamp());
  } catch {}
}

export function isStabilizedToday() {
  try {
    return localStorage.getItem(KEY_STABILIZED_DAY) === todayStamp();
  } catch {
    return false;
  }
}

export function markActedToday() {
  try {
    localStorage.setItem(KEY_ACTED_DAY, todayStamp());
  } catch {}
}

export function hasActedToday() {
  try {
    return localStorage.getItem(KEY_ACTED_DAY) === todayStamp();
  } catch {
    return false;
  }
}

// Back-compat aliases (in case older files used different names)
export const getNextIntent = peekNextIntent;
export const popNextIntent = consumeNextIntent;
