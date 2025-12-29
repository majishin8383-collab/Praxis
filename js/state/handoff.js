// js/state/handoff.js  (FULL REPLACEMENT)

// Compatibility layer.
// Some older modules import stabilize + intent helpers from this path.
// The source of truth is now storage.js (pure storage + handoff).

export {
  grantStabilizeCreditToday,
  hasStabilizeCreditToday,
  clearStabilizeCredit,
  setNextIntent,
  consumeNextIntent,
} from "../storage.js";
