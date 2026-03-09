/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/brain.js (NEW FILE)

import { appendLog } from "./storage.js";

const BUILD = "BRAIN-01";

const nowISO = () => new Date().toISOString();

function safeAppendLog(entry) {
  try {
    appendLog(entry);
  } catch {}
}

/*
Standard event shape

{
  kind: string,
  tool: string,
  zone: string,
  data: object,
  when: ISO string,
  build: string
}
*/

export function logEvent(kind, tool, zone, data = {}) {
  safeAppendLog({
    kind: String(kind || "unknown"),
    tool: String(tool || "unknown"),
    zone: String(zone || "unknown"),
    data: data && typeof data === "object" ? data : {},
    when: nowISO(),
    build: BUILD,
  });
}
