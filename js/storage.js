/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 *
 * storage.js must be PURE (no router/app boot code).
 */

const KEY_LOG = "praxis_log_v1";
// Stabilize credit (day stamp)
const KEY_STABILIZE_DAY = "praxis_stabilize_credit_day_v1";
// One-time routing hint between tools (intent handoff)
const KEY_NEXT_INTENT = "praxis_next_intent_v1";

// ---------- utils ----------
function nowISO() {
  return new Date().toISOString();
}

// Uses device-local day stamp.
function localDayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeKind(kind) {
  const k = String(kind || "").trim();
  // Broad aliasing for older builds / experiments.
  const map = {
    // Stop Urge
    stopUrge: "stop_urge",
    stopUrge_open: "stop_urge_open",
    stopUrge_start: "stop_urge_start",
    stopUrge_stop: "stop_urge_stop",

    // Move Forward
    moveForward: "move_forward",
    moveForward_open: "move_forward_open",
    moveForward_start: "move_forward_start",
    moveForward_stop: "move_forward_stop",
    moveForward_extend: "move_forward_extend",
    moveForward_end: "move_forward_end",

    // Emergency
    emergency: "emergency_open",
    emergency_open: "emergency_open",

    // A3 back-compat aliases (older “end” kinds behave like the canonical kinds)
    calm_end: "calm",
    stop_urge_end: "stop_urge",
    move_forward_end: "move_forward",
  };
  return map[k] || k;
}

/**
 * Stabilize credit is a day-stamp used as a soft permission (e.g. Today Plan Step 2 availability).
 * Timer parity rule: any meaningful stabilize/act timer interaction should grant credit.
 * Keep this inclusive (but only for relevant tools), and never throw.
 */
function shouldGrantStabilizeCredit(entry) {
  const kind = normalizeKind(entry?.kind);
  if (!kind) return false;

  // Canonical completions (existing behavior)
  if (kind === "calm") return true;
  if (kind === "stop_urge") return true;
  if (kind === "move_forward") return true;

  // Stabilize / Act timers (start/stop/extend/end) should also count.
  if (kind.startsWith("stop_urge_")) return true; // open/start/stop/extend/etc
  if (kind.startsWith("move_forward_")) return true; // open/start/stop/extend/end/etc

  // Calm tool may log calm_start/calm_stop in some builds
  if (kind === "calm_start" || kind === "calm_stop") return true;

  // Today’s Plan parity: any step timer interaction counts
  if (kind.startsWith("today_plan_step_")) return true; // step_start/step_stop/step_window_end/etc
  if (kind === "today_plan_continue_start") return true;
  if (kind === "today_plan_step") return true;

  return false;
}

// ---------- log ----------
export function readLog() {
  try {
    const raw = localStorage.getItem(KEY_LOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendLog(entry) {
  const e = entry && typeof entry === "object" ? { ...entry } : { kind: "unknown" };

  // Normalize / guard
  e.kind = normalizeKind(e.kind);
  if (!e.when) e.when = nowISO();

  // Persist log (cap)
  const log = readLog();
  log.unshift(e);

  try {
    localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(0, 300)));
  } catch {}

  // Grant stabilize credit (best-effort)
  if (shouldGrantStabilizeCredit(e)) {
    try {
      localStorage.setItem(KEY_STABILIZE_DAY, localDayStamp());
    } catch {}
  }
}

// ---------- stabilize credit ----------
export function hasStabilizeCreditToday() {
  try {
    return localStorage.getItem(KEY_STABILIZE_DAY) === localDayStamp();
  } catch {
    return false;
  }
}

export function grantStabilizeCreditToday() {
  try {
    localStorage.setItem(KEY_STABILIZE_DAY, localDayStamp());
  } catch {}
}

export function clearStabilizeCredit() {
  try {
    localStorage.setItem(KEY_STABILIZE_DAY, "");
  } catch {}
}

// ---------- intent handoff ----------
// Back-compat: keep storing {intent, ts} for string intents.
export function setNextIntent(intent) {
  try {
    localStorage.setItem(
      KEY_NEXT_INTENT,
      JSON.stringify({ intent: String(intent || ""), ts: Date.now() })
    );
  } catch {}
}

/**
 * New: set an intent with a payload.
 * - Does NOT break older consumers (they can continue calling consumeNextIntent()).
 * - Payload must be JSON-serializable.
 */
export function setNextIntentData(intent, payload = null) {
  try {
    localStorage.setItem(
      KEY_NEXT_INTENT,
      JSON.stringify({
        intent: String(intent || ""),
        payload: payload === undefined ? null : payload,
        ts: Date.now(),
      })
    );
  } catch {}
}

/**
 * Back-compat: returns ONLY the intent string (or null).
 * If an entry includes a payload, it is ignored here.
 */
export function consumeNextIntent(maxAgeMinutes = 30) {
  try {
    const raw = localStorage.getItem(KEY_NEXT_INTENT);
    if (!raw) return null;

    // one-time read+clear
    localStorage.removeItem(KEY_NEXT_INTENT);

    const parsed = JSON.parse(raw);
    const intent = parsed?.intent ? String(parsed.intent) : "";
    const ts = Number(parsed?.ts || 0);

    if (!intent) return null;
    if (!Number.isFinite(ts) || ts <= 0) return intent;

    const ageMs = Date.now() - ts;
    if (ageMs > maxAgeMinutes * 60 * 1000) return null;

    return intent;
  } catch {
    // If parse fails, clear it so it doesn’t keep breaking.
    try {
      localStorage.removeItem(KEY_NEXT_INTENT);
    } catch {}
    return null;
  }
}

/**
 * New: consumes intent + payload.
 * Returns: { intent: string, payload: any|null } or null.
 */
export function consumeNextIntentData(maxAgeMinutes = 30) {
  try {
    const raw = localStorage.getItem(KEY_NEXT_INTENT);
    if (!raw) return null;

    // one-time read+clear
    localStorage.removeItem(KEY_NEXT_INTENT);

    const parsed = JSON.parse(raw);
    const intent = parsed?.intent ? String(parsed.intent) : "";
    const payload = parsed?.payload ?? null;
    const ts = Number(parsed?.ts || 0);

    if (!intent) return null;
    if (!Number.isFinite(ts) || ts <= 0) return { intent, payload };

    const ageMs = Date.now() - ts;
    if (ageMs > maxAgeMinutes * 60 * 1000) return null;

    return { intent, payload };
  } catch {
    try {
      localStorage.removeItem(KEY_NEXT_INTENT);
    } catch {}
    return null;
  }
}

export function clearNextIntent() {
  try {
    localStorage.removeItem(KEY_NEXT_INTENT);
  } catch {}
}
