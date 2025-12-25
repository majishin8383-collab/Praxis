const KEY = "praxis_v1_log";

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
  localStorage.setItem(KEY, JSON.stringify(log.slice(0, 200)));
}

export function clearLog() {
  localStorage.removeItem(KEY);
}
