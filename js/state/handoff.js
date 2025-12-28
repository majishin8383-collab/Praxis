// js/state/handoff.js  (NEW FILE)
// Universal handoff + daily credits (soft guidance only)

const KEY_NEXT_INTENT = "praxis_next_intent_v1";
const KEY_STABILIZE_DAY = "praxis_credit_stabilize_day_v1";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // local device day
}

// ---- One-time intent (session-only) ----
export function setNextIntent(intent) {
  try { sessionStorage.setItem(KEY_NEXT_INTENT, String(intent || "")); } catch {}
}

export function consumeNextIntent() {
  try {
    const v = sessionStorage.getItem(KEY_NEXT_INTENT) || "";
    sessionStorage.removeItem(KEY_NEXT_INTENT);
    return v || null;
  } catch {
    return null;
  }
}

// ---- Daily credits (persist, but only for guidance) ----
export function grantStabilizeCreditToday() {
  try { localStorage.setItem(KEY_STABILIZE_DAY, todayKey()); } catch {}
}

export function hasStabilizeCreditToday() {
  try { return localStorage.getItem(KEY_STABILIZE_DAY) === todayKey(); } catch { return false; }
}

export function clearStabilizeCredit() {
  try { localStorage.removeItem(KEY_STABILIZE_DAY); } catch {}
}
