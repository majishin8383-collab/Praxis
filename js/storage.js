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

// Tier (0=free, 1=pro, 2=plus... whatever you decide later)
const KEY_TIER = "praxis_tier_v1";

// ---------- intent constants (prevents typos across files) ----------
export const INTENT_TODAY_PREFILL = "today_plan_prefill";
export const INTENT_TODAY_STEP2 = "today_plan_step2";

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

    // A3 back-compat aliases
    calm_end: "calm",
    stop_urge_end: "stop_urge",
    move_forward_end: "move_forward",
  };
  return map[k] || k;
}

/**
 * Stabilize credit is a day-stamp used as a soft permission (e.g. Today Plan Step 2 availability).
 * Timer parity rule: any meaningful stabilize/act timer interaction should grant credit.
 */
function shouldGrantStabilizeCredit(entry) {
  const kind = normalizeKind(entry?.kind);
  if (!kind) return false;

  // Canonical completions
  if (kind === "calm") return true;
  if (kind === "stop_urge") return true;
  if (kind === "move_forward") return true;

  // Timer interactions
  if (kind.startsWith("stop_urge_")) return true;
  if (kind.startsWith("move_forward_")) return true;

  // Calm tool may log calm_start/calm_stop
  if (kind === "calm_start" || kind === "calm_stop") return true;

  // Today’s Plan parity
  if (kind.startsWith("today_plan_step_")) return true;
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

  e.kind = normalizeKind(e.kind);
  if (!e.when) e.when = nowISO();

  const log = readLog();
  log.unshift(e);

  try {
    localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(0, 300)));
  } catch {}

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

// ---------- tier ----------
export function getTier() {
  try {
    const raw = localStorage.getItem(KEY_TIER);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function isPro() {
  return getTier() >= 1;
}

/**
 * setTier(n)
 * - n: 0=free, 1=pro, 2=plus...
 * - best-effort only (no throws)
 */
export function setTier(n) {
  try {
    const v = Number(n);
    const safe = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    localStorage.setItem(KEY_TIER, String(safe));
  } catch {}
}

// ---------- intent handoff ----------
/**
 * setNextIntent(intent, payload?)
 * - payload is any JSON-safe object.
 */
export function setNextIntent(intent, payload = null) {
  try {
    const safeIntent = String(intent || "");
    const safePayload = payload && typeof payload === "object" ? payload : null;
    localStorage.setItem(
      KEY_NEXT_INTENT,
      JSON.stringify({ intent: safeIntent, payload: safePayload, ts: Date.now() })
    );
  } catch {}
}

/**
 * consumeNextIntent(maxAgeMinutes)
 * Returns:
 * - null if none/expired
 * - string if legacy stored format is encountered
 * - { intent, payload, ts } for new format
 */
export function consumeNextIntent(maxAgeMinutes = 30) {
  try {
    const raw = localStorage.getItem(KEY_NEXT_INTENT);
    if (!raw) return null;

    // one-time read+clear
    localStorage.removeItem(KEY_NEXT_INTENT);

    const parsed = JSON.parse(raw);

    // Legacy string storage
    if (typeof parsed === "string") return parsed;

    const intent = parsed?.intent ? String(parsed.intent) : "";
    const ts = Number(parsed?.ts || 0);
    const payload = parsed?.payload && typeof parsed.payload === "object" ? parsed.payload : null;

    if (!intent) return null;
    if (!Number.isFinite(ts) || ts <= 0) return { intent, payload, ts: 0 };

    const ageMs = Date.now() - ts;
    if (ageMs > maxAgeMinutes * 60 * 1000) return null;

    return { intent, payload, ts };
  } catch {
    try {
      localStorage.removeItem(KEY_NEXT_INTENT);
    } catch {}
    return null;
  }
}
