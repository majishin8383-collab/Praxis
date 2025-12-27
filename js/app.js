/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

import { initRouter } from "./router.js";

function showDebugOverlay(title, details) {
  try {
    const existing = document.getElementById("praxisDebugOverlay");
    if (existing) existing.remove();

    const box = document.createElement("div");
    box.id = "praxisDebugOverlay";
    box.style.position = "fixed";
    box.style.left = "12px";
    box.style.right = "12px";
    box.style.bottom = "12px";
    box.style.zIndex = "999999";
    box.style.padding = "12px";
    box.style.borderRadius = "12px";
    box.style.border = "1px solid rgba(127,127,127,.35)";
    box.style.background = "rgba(0,0,0,.85)";
    box.style.color = "#fff";
    box.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    box.style.fontSize = "12px";
    box.style.whiteSpace = "pre-wrap";
    box.style.maxHeight = "45vh";
    box.style.overflow = "auto";

    box.textContent = `${title}\n\n${details}`;
    document.body.appendChild(box);
  } catch {
    // If even the overlay fails, do nothing.
  }
}

// Show runtime errors on-screen (temporary debugging)
window.addEventListener("error", (e) => {
  const msg = e?.message || "Unknown error";
  const src = e?.filename ? `${e.filename}:${e.lineno || 0}:${e.colno || 0}` : "";
  showDebugOverlay("Runtime Error", `${msg}\n${src}`);
});

window.addEventListener("unhandledrejection", (e) => {
  const reason = e?.reason?.stack || e?.reason?.message || String(e?.reason || "Unknown rejection");
  showDebugOverlay("Unhandled Promise Rejection", reason);
});

function boot() {
  try {
    initRouter();
  } catch (err) {
    const details = err?.stack || err?.message || String(err);
    showDebugOverlay("Boot Error (initRouter failed)", details);
    throw err;
  }
}

boot();
