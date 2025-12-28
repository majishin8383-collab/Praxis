/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// ✅ storage.js must be PURE. No router/app boot code in here.

const KEY_LOG = "praxis_log_v1";

// Stabilize credit (day stamp)
const KEY_STABILIZE_DAY = "praxis_stabilize_credit_day_v1";

// One-time routing hint between tools (intent handoff)
const KEY_NEXT_INTENT = "praxis_next_intent_v1";

// ---------- utils ----------
function nowISO() {
  return new Date().toISOString();
}

// Use local day stamp (device timezone). User wants EST; their device should be set accordingly.
function localDayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeKind(kind) {
  // Light normalization so older logs don’t break newer logic.
  // Add more mappings only when we see them in real logs.
  const k = String(kind || "").trim();

  const map = {
    // common aliasing
    stopUrge: "stop_urge",
    stopUrge_open: "stop_urge_open",
    moveForward: "move_forward",
    move_forward_open: "move_forward_open",
    emergency: "emergency_open",
  };

  return map[k] || k;
}

function shouldGrantStabilizeCredit(entry) {
  const kind = normalizeKind(entry?.kind);

  // Calm always counts as stabilize
  if (kind === "calm") return true;

  // Stop the Urge counts as stabilize once it’s logged (not just opened)
  if (kind === "stop_urge") return true;

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

  const log = readLog();
  log.unshift(e);

  // Persist log (cap)
  try {
    localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(0, 300)));
  } catch {
    // ignore storage failures (private mode / quota)
  }

  // Grant stabilize credit (best-effort, never throws)
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
    localStorage.setItem(
      KEY_NEXT_INTENT,
      JSON.stringify({ intent: String(intent || ""), ts: Date.now() })
    );
  } catch {}
}

// One-time read+clear. Optional max age so stale intents don’t misroute users.
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
    // If parse fails, clear it so it doesn’t keep breaking.
    try { localStorage.removeItem(KEY_NEXT_INTENT); } catch {}
    return null;
  }
}
