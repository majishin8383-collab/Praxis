/*! * Praxis * © 2025 Joseph Satmary. All rights reserved. */
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

function errorView(err, hash) {
  const msg = String(err?.message || err || "Unknown error");
  const stack = String(err?.stack || "");
  return el("div", { class: "flowShell" }, [
    el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Route error"]),
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
      el("p", { class: "small", style: "margin-top:10px" }, ["If this keeps happening, a file path or export name is wrong."]),
    ].filter(Boolean)),
  ]);
}

function normalizeHash(raw) {
  let h = String(raw || "").trim();
  if (!h) return "#/home";
  const q = h.indexOf("?");
  if (q >= 0) h = h.slice(0, q);
  if (h[0] !== "#") return "#/home";
  if (!h.startsWith("#/")) return "#/home";
  const alias = { "#/reset": "#/home", "#/start": "#/home" };
  return alias[h] || h;
}

const routes = new Map([
  ["#/home", async () => (await import("./ui.js")).renderHome()],

  // Yellow (stabilize)
  ["#/yellow/calm", async () => (await import("./zones/yellow/calm.js")).renderCalm()],
  ["#/yellow/stop", async () => (await import("./zones/yellow/stopUrge.js")).renderStopUrge()],

  // Red (emergency)
  ["#/red/emergency", async () => (await import("./zones/red/emergency.js")).renderEmergency()],

  // Green (act)
  ["#/green/move", async () => (await import("./zones/green/moveForward.js")).renderMoveForward()],
  ["#/green/today", async () => (await import("./zones/green/todayPlan.js")).renderTodayPlan()],

  // Reflect
  ["#/reflect", async () => (await import("./zones/reflect.js")).renderReflect()],
  ["#/reflect/more", async () => (await import("./zones/reflectMoreClarity.js")).renderReflectMoreClarity()],

  // Pro
  ["#/pro/brain", async () => (await import("./pro/brain.js")).renderProBrain()],
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
