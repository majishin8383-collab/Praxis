/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

import { initRouter } from "./router.js";

function boot() {
  initRouter();
}

boot();
const KEY = "praxis_log_v1";

export function readLog() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendLog(entry) {
  const log = readLog();
  log.unshift(entry);
  try {
    localStorage.setItem(KEY, JSON.stringify(log.slice(0, 300)));
  } catch {
    // ignore storage failures (private mode / quota)
  }
}
