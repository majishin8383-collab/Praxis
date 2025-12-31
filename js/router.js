/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 */

import { setMain } from "./ui.js";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function label(text) {
  // Governance-safe: no badges.
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
}

function errorView(err, hash) {
  const msg = String(err?.message || err || "Unknown error");
  const stack = String(err?.stack || "");

  return el("div", { class: "flowShell" }, [
    el("div", { class: "card cardPad" }, [
      label("Route error"),
      el("h2", { class: "h2" }, ["Something failed to load"]),
      el("p", { class: "p" }, [`Route: ${hash || "(none)"}`]),
      el("p", { class: "small" }, [msg]),
      stack
        ? el(
            "pre",
            {
              style:
                "white-space:pre-wrap;word-break:break-word;margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.04);font-size:12px;opacity:.9;",
            },
            [stack]
          )
        : null,
      el("div", { class: "btnRow", style: "margin-top:12px" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Go Home"]),
        el("button", { class: "btn", type: "button", onClick: () => location.reload() }, ["Reload"]),
      ]),
      el("p", { class: "small", style: "margin-top:10px" }, [
        "If this keeps happening, a file path or export name is wrong. This screen proves the app is running — one module is failing.",
      ]),
    ].filter(Boolean)),
  ]);
}

/**
 * Normalizes hashes so tiny variations don't break routing.
 * - Forces "#/home" default
 * - Strips any querystring after the hash (rare but possible)
 * - Collapses common aliases
 */
function normalizeHash(raw) {
  let h = String(raw || "").trim();
  if (!h) return "#/home";

  const q = h.indexOf("?");
  if (q >= 0) h = h.slice(0, q);

  if (h[0] !== "#") return "#/home";
  if (!h.startsWith("#/")) return "#/home";

  const alias = {
    "#/reset": "#/home",
    "#/start": "#/home",
  };

  return alias[h] || h;
}

/**
 * ROUTES
 * Public routes = home + the 5 tiles.
 * Internal/legacy routes may exist for development, but must not be linked from Home.
 */
const routes = new Map([
  // ----- PUBLIC -----
  ["#/home", async () => (await import("./ui.js")).renderHome()],
  ["#/yellow/calm", async () => (await import("./zones/yellow/calm.js")).renderCalm()],
  ["#/yellow/stop", async () => (await import("./zones/yellow/stopUrge.js")).renderStopUrge()],
  ["#/red/emergency", async () => (await import("./zones/red/emergency.js")).renderEmergency()],
  ["#/green/move", async () => (await import("./zones/green/moveForward.js")).renderMoveForward()],
  ["#/green/today", async () => (await import("./zones/green/todayPlan.js")).renderTodayPlan()],

  // ----- INTERNAL / LEGACY (not linked from Home) -----
  ["#/green/direction", async () => (await import("./zones/green/direction.js")).renderDirection()],
  ["#/green/next", async () => (await import("./zones/green/nextStep.js")).renderNextStep()],
  ["#/green/focus", async () => (await import("./zones/green/focusSprint.js")).renderFocusSprint()],
  ["#/reflect", async () => (await import("./zones/reflect.js")).renderReflect()],
  ["#/history", async () => (await import("./history.js")).renderHistory()],
  ["#/onboarding", async () => (await import("./onboarding.js")).renderOnboarding()],
]);

function getHash() {
  return normalizeHash(location.hash || "#/home");
}

async function onRouteChange() {
  const hash = getHash();
  const handler = routes.get(hash) || routes.get("#/home");

  try {
    const view = await handler();
    setMain(view);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error("ROUTE FAIL:", hash, err);
    setMain(errorView(err, hash));
    window.scrollTo(0, 0);
  }
}

export function initRouter() {
  const homeBtn = document.getElementById("navHome");
  homeBtn?.addEventListener("click", () => (location.hash = "#/home"));

  if (!location.hash) location.hash = "#/home";
  window.addEventListener("hashchange", onRouteChange);
  onRouteChange();
}
