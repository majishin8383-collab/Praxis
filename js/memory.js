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
const BUILD = "MEM-01";

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

function normalizeMemory(m) {
  const mem = m && typeof m === "object" ? m : {};
  const v = Number(mem.v);
  return {
    v: Number.isFinite(v) ? v : 1,
    build: typeof mem.build === "string" ? mem.build : BUILD,
    createdDay: typeof mem.createdDay === "string" ? mem.createdDay : localDayStamp(),
    updatedDay: typeof mem.updatedDay === "string" ? mem.updatedDay : localDayStamp(),

    // Aggregate counters only:
    totals: mem.totals && typeof mem.totals === "object" ? mem.totals : {}, // kind -> count
    tools: mem.tools && typeof mem.tools === "object" ? mem.tools : {}, // toolName -> count
    daysUsed: mem.daysUsed && typeof mem.daysUsed === "object" ? mem.daysUsed : {}, // dayStamp -> count
  };
}

function newMemory() {
  return normalizeMemory({
    v: 1,
    build: BUILD,
    createdDay: localDayStamp(),
    updatedDay: localDayStamp(),
    totals: {},
    tools: {},
    daysUsed: {},
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
  mem.totals[kind] = (mem.totals[kind] || 0) + 1;

  // totals by tool bucket
  const tool = toolFromKind(kind);
  mem.tools[tool] = (mem.tools[tool] || 0) + 1;

  // days used (just counts per day stamp)
  mem.daysUsed[day] = (mem.daysUsed[day] || 0) + 1;

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
  };
}
