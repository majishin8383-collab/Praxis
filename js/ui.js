/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/ui.js (FULL REPLACEMENT)
import { readLog } from "./storage.js";

const BUILD_HOME = "UI-HOME-7";

// Emergency session marker (set by emergency screen)
const KEY_LAST_EMERGENCY = "praxis_last_emergency_ts";

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

/**
 * Render the current view into the main container.
 * Supports both layouts (#main) and fallback (#app).
 */
export function setMain(viewNode) {
  const host = document.getElementById("main") || document.getElementById("app");
  if (!host) return;
  host.innerHTML = "";
  if (viewNode) host.appendChild(viewNode);
}

// ----- minimal safety helpers (non-blocking) -----
function minutesAgo(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (60 * 1000);
}

function getLastEmergencyMs() {
  try {
    const v = Number(sessionStorage.getItem(KEY_LAST_EMERGENCY) || "0");
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function hasRecentEmergencyFromSession() {
  const lastEm = getLastEmergencyMs();
  return !!(lastEm && Date.now() - lastEm <= 60 * 60 * 1000);
}

function hasRecentEmergencyFromLog() {
  try {
    const log = readLog().slice(0, 120);
    const lastEmergency = log.find((e) => e.kind === "emergency_open");
    return !!(lastEmergency && minutesAgo(lastEmergency.when) <= 60);
  } catch {
    return false;
  }
}

function safetyBanner() {
  // Keep this subtle: only appears if Emergency was opened recently.
  const show = hasRecentEmergencyFromSession() || hasRecentEmergencyFromLog();
  if (!show) return null;

  return el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Safety check"]),
    el("p", { class: "p" }, [
      "If safety is still at risk, use Emergency now. If you’re safe enough, start with Calm for 2 minutes.",
    ]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, [
        "Calm Me Down",
      ]),
      el("button", { class: "btn btnDanger", type: "button", onClick: () => (location.hash = "#/red/emergency") }, [
        "Emergency",
      ]),
    ]),
  ]);
}

// ----- Home routing tiles -----
function feelingTile({ label, hint, go, goDot }) {
  return el(
    "button",
    { class: "actionTile", type: "button", onClick: () => (location.hash = go) },
    [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [label]),
          el("div", { class: "tileSub" }, [hint]),
        ]),
        el("div", { class: `zoneDot ${goDot}` }, []),
      ]),
      el("p", { class: "tileHint" }, ["Tap"]),
    ]
  );
}

const FEELING_OPTIONS = [
  { label: "I’m not safe / risk is high", hint: "Immediate support.", go: "#/red/emergency", goDot: "dotRed" },
  { label: "Overwhelmed / anxious", hint: "Lower intensity first.", go: "#/yellow/calm", goDot: "dotYellow" },
  { label: "Urge to act / message / react", hint: "Pause before acting.", go: "#/yellow/stop", goDot: "dotYellow" },
  { label: "Stuck / frozen / restless", hint: "Body first. Then progress.", go: "#/green/move", goDot: "dotGreen" },
  { label: "I’m okay — I need a plan", hint: "Three steps only.", go: "#/green/today", goDot: "dotGreen" },
];

// ----- Tools (minimal, no redundancy) -----
function toolTile({ title, sub, hint, dot, to }) {
  return el(
    "button",
    { class: "actionTile", type: "button", onClick: () => (location.hash = to) },
    [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [title]),
          el("div", { class: "tileSub" }, [sub]),
        ]),
        el("div", { class: `zoneDot ${dot}` }, []),
      ]),
      el("p", { class: "tileHint" }, [hint]),
    ]
  );
}

function toolsSection() {
  const stabilizeTiles = [
    toolTile({
      title: "Calm Me Down",
      sub: "Drop intensity fast",
      hint: "2 minutes. Guided.",
      dot: "dotYellow",
      to: "#/yellow/calm",
    }),
    toolTile({
      title: "Stop the Urge",
      sub: "Pause before acting",
      hint: "Buy time. Add friction.",
      dot: "dotYellow",
      to: "#/yellow/stop",
    }),
    toolTile({
      title: "Emergency",
      sub: "Immediate support",
      hint: "Use when safety is at risk.",
      dot: "dotRed",
      to: "#/red/emergency",
    }),
  ];

  const actTiles = [
    toolTile({
      title: "Move Forward",
      sub: "Body first. Then progress.",
      hint: "Pick a ladder. Do it until the timer ends.",
      dot: "dotGreen",
      to: "#/green/move",
    }),
    toolTile({
      title: "Today’s Plan",
      sub: "Three steps only",
      hint: "Pick a template, then do Step 1.",
      dot: "dotGreen",
      to: "#/green/today",
    }),
  ];

  return el("div", {}, [
    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Tools"]),
      el("p", { class: "small" }, ["Only what you need. No duplicates."]),
    ]),

    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Stabilize"]),
      el("p", { class: "small" }, ["Lower intensity first."]),
      el("div", { class: "homeGrid" }, stabilizeTiles),
    ]),

    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Act"]),
      el("p", { class: "small" }, ["Body first. Then progress."]),
      el("div", { class: "homeGrid" }, actTiles),
    ]),
  ]);
}

export function renderHome() {
  const wrap = el("div", { class: "homeShell" });

  // session-only UI toggle
  let showTools = false;

  function header() {
    return el("div", { class: "homeHeader" }, [
      el("h1", { class: "h1" }, ["PRAXIS"]),
      el("p", { class: "p" }, ["Start with your state. One tap."]),
      el("div", { class: "small" }, [`Home ${BUILD_HOME}`]),
    ]);
  }

  function startCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Start here"]),
      el("h2", { class: "h2" }, ["How are you feeling right now?"]),
      el("p", { class: "small" }, ["One tap. No thinking."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, FEELING_OPTIONS.map((o) => feelingTile(o))),
    ]);
  }

  function controlsCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "btnRow" }, [
        el(
          "button",
          {
            class: showTools ? "btn btnPrimary" : "btn",
            type: "button",
            onClick: () => {
              showTools = !showTools;
              rerender();
            },
          },
          [showTools ? "Hide tools" : "Show tools"]
        ),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Default is simple. Tools are optional."]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    const sb = safetyBanner();
    if (sb) wrap.appendChild(sb);

    wrap.appendChild(startCard());
    wrap.appendChild(controlsCard());

    if (showTools) wrap.appendChild(toolsSection());
  }

  rerender();
  return wrap;
}
