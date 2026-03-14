/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

import { readLog, readDailyPraxisState } from "./storage.js";

const BUILD_HOME = "UI-HOME-12";

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

function sectionLabel(text) {
  return el("div", { class: "small", style: "opacity:.85;font-weight:700;letter-spacing:.02em;" }, [text]);
}

function safetyBanner() {
  const show = hasRecentEmergencyFromSession() || hasRecentEmergencyFromLog();
  if (!show) return null;

  return el("div", { class: "card cardPad" }, [
    sectionLabel("Safety check"),
    el("p", { class: "p" }, [
      "If safety is still at risk, use Emergency now. If you’re safe enough, Calm is available for 2 minutes.",
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

function feelingTile({ label, hint, go, goDot }) {
  return el("button", { class: "actionTile", type: "button", onClick: () => (location.hash = go) }, [
    el("div", { class: "tileTop" }, [
      el("div", {}, [el("div", { class: "tileTitle" }, [label]), el("div", { class: "tileSub" }, [hint])]),
      el("div", { class: `zoneDot ${goDot}` }, []),
    ]),
    el("p", { class: "tileHint" }, ["Tap"]),
  ]);
}

const FEELING_OPTIONS = [
  { label: "I’m not safe / risk is high", hint: "Immediate support.", go: "#/red/emergency", goDot: "dotRed" },
  { label: "Overwhelmed / anxious", hint: "Lower intensity first.", go: "#/yellow/calm", goDot: "dotYellow" },
  { label: "Strong urge to act", hint: "Pause before acting.", go: "#/yellow/stop", goDot: "dotYellow" },
  { label: "Stuck / frozen / restless", hint: "Body first. Then momentum.", go: "#/green/move", goDot: "dotGreen" },
  { label: "I’m okay — I need a plan", hint: "Three steps only.", go: "#/green/today", goDot: "dotGreen" },
];

function toolTile({ title, sub, hint, dot, to }) {
  return el("button", { class: "actionTile", type: "button", onClick: () => (location.hash = to) }, [
    el("div", { class: "tileTop" }, [
      el("div", {}, [el("div", { class: "tileTitle" }, [title]), el("div", { class: "tileSub" }, [sub])]),
      el("div", { class: `zoneDot ${dot}` }, []),
    ]),
    el("p", { class: "tileHint" }, [hint]),
  ]);
}

function toolsSection() {
  const stabilizeTiles = [
    toolTile({
      title: "Calm Me Down",
      sub: "Lower intensity fast",
      hint: "2 minutes. Guided.",
      dot: "dotYellow",
      to: "#/yellow/calm",
    }),
    toolTile({
      title: "Stop the Urge",
      sub: "Pause before acting",
      hint: "Interrupt the impulse.",
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
      sub: "Body first. Then momentum.",
      hint: "Pick a ladder. Let the timer hold the step.",
      dot: "dotGreen",
      to: "#/green/move",
    }),
    toolTile({
      title: "Today’s Plan",
      sub: "Three steps only",
      hint: "Pick a template. Start with Step 1 when ready.",
      dot: "dotGreen",
      to: "#/green/today",
    }),
  ];

  return el("div", {}, [
    el("div", { class: "card cardPad" }, [
      sectionLabel("Tools"),
      el("p", { class: "small" }, ["Optional support tools."]),
    ]),

    el("div", { class: "card cardPad" }, [
      sectionLabel("Stabilize"),
      el("p", { class: "small" }, ["Lower intensity first."]),
      el("div", { class: "homeGrid" }, stabilizeTiles),
    ]),

    el("div", { class: "card cardPad" }, [
      sectionLabel("Act"),
      el("p", { class: "small" }, ["Movement is optional."]),
      el("div", { class: "homeGrid" }, actTiles),
    ]),
  ]);
}

function dailyStepTile({ done, label, hint, go, dot }) {
  const stateText = done ? "Done" : "Start";
  const stateClass = done ? "btn btnPrimary" : "btn";

  return el("div", { class: "card cardPad" }, [
    sectionLabel("Today"),
    el("h3", { class: "h2", style: "margin-top:4px" }, [label]),
    el("p", { class: "small" }, [hint]),
    el("div", { class: "btnRow", style: "margin-top:10px" }, [
      el("button", { class: stateClass, type: "button", onClick: () => (location.hash = go) }, [stateText]),
      el("div", { class: `zoneDot ${dot}`, style: "align-self:center;" }, []),
    ]),
  ]);
}

function dailyPraxisCard() {
  const state = readDailyPraxisState();
  const doneCount = [state.stabilize, state.act, state.plan].filter(Boolean).length;
  const complete = !!state.completedAt;

  return el("div", { class: "card cardPad" }, [
    sectionLabel("Today"),
    el("h2", { class: "h2" }, ["Today’s Praxis"]),
    el("p", { class: "small" }, [
      complete ? "3 of 3 complete." : `${doneCount} of 3 complete.`,
    ]),
    el("div", { class: "flowShell", style: "margin-top:10px" }, [
      dailyStepTile({
        done: state.stabilize,
        label: "Stabilize",
        hint: "Lower intensity first.",
        go: "#/yellow/calm",
        dot: "dotYellow",
      }),
      dailyStepTile({
        done: state.act,
        label: "Act",
        hint: "Move Forward.",
        go: "#/green/move",
        dot: "dotGreen",
      }),
      dailyStepTile({
        done: state.plan,
        label: "Plan",
        hint: "Today’s Plan.",
        go: "#/green/today",
        dot: "dotGreen",
      }),
    ]),
  ]);
}

export function renderHome() {
  const wrap = el("div", { class: "homeShell" });

  let showTools = false;

  const DEBUG = typeof location !== "undefined" && String(location.search || "").includes("debug=1");

  function header() {
    return el("div", { class: "homeHeader" }, [
      el("h1", { class: "h1" }, ["PRAXIS"]),
      el("p", { class: "p" }, ["Start with your state. One tap."]),
      DEBUG ? el("div", { class: "small" }, [`Home ${BUILD_HOME}`]) : null,
    ].filter(Boolean));
  }

  function startCard() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Start here"),
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
          [showTools ? "Hide advanced tools" : "Advanced tools"]
        ),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Default is simple. Advanced tools are optional."]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    const sb = safetyBanner();
    if (sb) wrap.appendChild(sb);

    wrap.appendChild(startCard());
    wrap.appendChild(dailyPraxisCard());
    wrap.appendChild(controlsCard());

    if (showTools) wrap.appendChild(toolsSection());
  }

  rerender();
  return wrap;
      }
