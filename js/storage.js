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

// Uses device-local day stamp. (If the device is set to EST, this matches EST.)
function localDayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeKind(kind) {
  // Light normalization so older logs don’t break newer logic.
  const k = String(kind || "").trim();
  const map = {
    // common aliasing / historical
    stopUrge: "stop_urge",
    stopUrge_open: "stop_urge_open",
    moveForward: "move_forward",
    move_forward_open: "move
