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

    // ✅ A3 back-compat aliases (older “end” kinds should behave like the canonical kinds)
    calm_end: "calm",
    stop_urge_end: "stop_urge",
    move_forward_end: "move_forward",
  };
  return map[k] || k;
}

function shouldGrantStabilizeCredit(entry) {
  const kind = normalizeKind(entry?.kind);
  // This credit is used as a soft permission (e.g., Today Plan Step 2 availability).
  // Keep conservative but inclusive across starting points.
  if (kind === "calm") return true;
  if (kind === "stop_urge") return true;
  if (kind === "move_forward") return true;
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

// ---------- intent handoff ----------
export function setNextIntent(intent) {
  try {
    localStorage.setItem(KEY_NEXT_INTENT, JSON.stringify({ intent: String(intent || ""), ts: Date.now() }));
  } catch {}
}

export function consumeNextIntent(maxAgeMinutes = 30) {
  try {
    const raw = localStorage.getItem(KEY_NEXT_INTENT);
    if (!raw) return null;

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
    try {
      localStorage.removeItem(KEY_NEXT_INTENT);
    } catch {}
    return null;
  }
}
