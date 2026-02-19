/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 *
 * js/memory.js
 * Purpose: aggregated counters only (governance-safe)
 * - No raw text
 * - No names
 * - No message content
 * - No timestamps (only device-local day stamp strings)
 */

const KEY_MEMORY = "praxis_memory_v1";
const BUILD = "MEM-02";

// ---------- utils ----------
function localDayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY_MEMORY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function safeWrite(obj) {
  try {
    localStorage.setItem(KEY_MEMORY, JSON.stringify(obj));
  } catch {}
}

function inc(map, key) {
  if (!map || typeof map !== "object") return;
  const k = String(key || "").trim();
  if (!k) return;
  map[k] = (map[k] || 0) + 1;
}

function pairKey(a, b) {
  const A = String(a || "").trim();
  const B = String(b || "").trim();
  if (!A || !B) return "";
  return `${A}|${B}`;
}

function normalizeMemory(m) {
  const mem = m && typeof m === "object" ? m : {};
  const v = Number(mem.v);

  const reflect = mem.reflect && typeof mem.reflect === "object" ? mem.reflect : {};
  const stop = mem.stop && typeof mem.stop === "object" ? mem.stop : {};

  function normObj(o) {
    return o && typeof o === "object" ? o : {};
  }

  return {
    v: Number.isFinite(v) ? v : 2,
    build: typeof mem.build === "string" ? mem.build : BUILD,
    createdDay: typeof mem.createdDay === "string" ? mem.createdDay : localDayStamp(),
    updatedDay: typeof mem.updatedDay === "string" ? mem.updatedDay : localDayStamp(),

    // Aggregate counters only:
    totals: normObj(mem.totals), // kind -> count
    tools: normObj(mem.tools), // toolName -> count
    daysUsed: normObj(mem.daysUsed), // dayStamp -> count

    // Pro brain aggregates (still safe):
    reflect: {
      loops: normObj(reflect.loops), // loopId -> count
      lenses: normObj(reflect.lenses), // lensId -> count
      asks: normObj(reflect.asks), // spiralAskId -> count
      loopLens: normObj(reflect.loopLens), // "loop|lens" -> count
      loopAsk: normObj(reflect.loopAsk), // "loop|ask" -> count
      lensAsk: normObj(reflect.lensAsk), // "lens|ask" -> count
      moreModes: normObj(reflect.moreModes), // modeId -> count
    },

    stop: {
      outcomes: normObj(stop.outcomes), // passed|still_present -> count
      scriptSets: normObj(stop.scriptSets), // neutral|boundary|logistics|deescalate -> count
    },
  };
}

function newMemory() {
  return normalizeMemory({
    v: 2,
    build: BUILD,
    createdDay: localDayStamp(),
    updatedDay: localDayStamp(),
    totals: {},
    tools: {},
    daysUsed: {},
    reflect: {
      loops: {},
      lenses: {},
      asks: {},
      loopLens: {},
      loopAsk: {},
      lensAsk: {},
      moreModes: {},
    },
    stop: {
      outcomes: {},
      scriptSets: {},
    },
  });
}

// Kind → tool bucket (very small, stable)
function toolFromKind(kind) {
  const k = String(kind || "");

  if (k.startsWith("calm")) return "calm";
  if (k.startsWith("stop_urge")) return "stop";
  if (k.startsWith("move_forward")) return "move";
  if (k.startsWith("today_plan")) return "today";
  if (k.startsWith("reflect")) return "reflect";
  if (k.startsWith("emergency")) return "emergency";

  return "other";
}

// ---------- public API ----------
export function getMemory() {
  const existing = safeRead();
  return existing ? normalizeMemory(existing) : newMemory();
}

export function resetMemory() {
  safeWrite(newMemory());
}

export function ingestLogEntry(entry) {
  // entry must already be normalized by storage.js (kind + when)
  const kind = String(entry?.kind || "").trim();
  if (!kind) return;

  const mem = getMemory();
  const day = localDayStamp();

  // totals by kind
  inc(mem.totals, kind);

  // totals by tool bucket
  const tool = toolFromKind(kind);
  inc(mem.tools, tool);

  // days used (just counts per day stamp)
  inc(mem.daysUsed, day);

  // -------- reflect aggregates (safe ids only) --------
  // Reflect lock carries: loop, lens, spiralAsk
  if (kind === "reflect_lock_v4") {
    const loop = String(entry?.loop || "").trim();
    const lens = String(entry?.lens || "").trim();
    const ask = String(entry?.spiralAsk || "").trim();

    if (loop) inc(mem.reflect.loops, loop);
    if (lens) inc(mem.reflect.lenses, lens);
    if (ask) inc(mem.reflect.asks, ask);

    const ll = pairKey(loop, lens);
    const la = pairKey(loop, ask);
    const xa = pairKey(lens, ask);

    if (ll) inc(mem.reflect.loopLens, ll);
    if (la) inc(mem.reflect.loopAsk, la);
    if (xa) inc(mem.reflect.lensAsk, xa);
  }

  // Reflect clarify ask event carries: ask
  if (kind === "reflect_spiral_ask_v4") {
    const ask = String(entry?.ask || "").trim();
    if (ask) inc(mem.reflect.asks, ask);
  }

  // More clarity pick carries: mode
  if (kind === "reflect_more_pick_v1") {
    const mode = String(entry?.mode || "").trim();
    if (mode) inc(mem.reflect.moreModes, mode);
  }

  // -------- stop aggregates (safe ids only) --------
  if (kind === "stop_urge") {
    const outcome = String(entry?.outcome || "").trim();
    const setId = String(entry?.scriptSetId || "").trim();
    if (outcome) inc(mem.stop.outcomes, outcome);
    if (setId) inc(mem.stop.scriptSets, setId);
  }

  mem.updatedDay = day;
  mem.build = BUILD;

  safeWrite(mem);
}

// Convenience: returns a small snapshot (safe to show in Pro later)
export function getMemorySnapshot() {
  const mem = getMemory();
  return {
    v: mem.v,
    createdDay: mem.createdDay,
    updatedDay: mem.updatedDay,
    tools: { ...mem.tools },
    totals: { ...mem.totals },
    daysUsedCount: Object.keys(mem.daysUsed || {}).length,
    reflect: {
      loops: { ...mem.reflect.loops },
      lenses: { ...mem.reflect.lenses },
      asks: { ...mem.reflect.asks },
      moreModes: { ...mem.reflect.moreModes },
    },
    stop: {
      outcomes: { ...mem.stop.outcomes },
      scriptSets: { ...mem.stop.scriptSets },
    },
  };
}

// -------- Pro Brain: one-line pattern note (governance-safe) --------
function bestPairNote(pairMap, a, b, labelA, labelB, minCount) {
  const k = pairKey(a, b);
  if (!k) return "";
  const n = Number(pairMap?.[k] || 0);
  if (!Number.isFinite(n) || n < minCount) return "";
  // descriptive, no scoring, no prediction, no “should”
  return `Pattern: ${labelA} + ${labelB} has shown up before.`;
}

export function getReflectPatternNote({ loopId, lensId, askId } = {}) {
  const mem = getMemory();

  const loop = String(loopId || "").trim();
  const lens = String(lensId || "").trim();
  const ask = String(askId || "").trim();

  // Require a little history so we don’t hallucinate patterns on day 1
  const MIN = 3;

  // Prefer the most specific pair available
  if (loop && ask) {
    const note = bestPairNote(mem.reflect.loopAsk, loop, ask, "this loop", "this pull", MIN);
    if (note) return note;
  }
  if (loop && lens) {
    const note = bestPairNote(mem.reflect.loopLens, loop, lens, "this loop", "this lens", MIN);
    if (note) return note;
  }
  if (lens && ask) {
    const note = bestPairNote(mem.reflect.lensAsk, lens, ask, "this lens", "this pull", MIN);
    if (note) return note;
  }

  // Fallback: simple “you’ve used this tool before” (still safe)
  const usedReflect = Number(mem.tools?.reflect || 0);
  if (usedReflect >= 5) return "Pattern: you return here when intensity is up.";

  return "";
}
