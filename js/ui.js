// js/ui.js  (FULL REPLACEMENT)
import { readLog } from "./storage.js";

const BUILD_HOME = "UI-HOME-5";

const KEY_DONE = "praxis_onboarding_done";
const KEY_SAFETY_SNOOZE_UNTIL = "praxis_safety_snooze_until";
const KEY_LAST_EMERGENCY = "praxis_last_emergency_ts";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function setMain(viewNode) {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = "";
  if (viewNode) main.appendChild(viewNode);
}

function onboardingDone() {
  try { return localStorage.getItem(KEY_DONE) === "1"; } catch { return false; }
}

function getUntil(key) {
  try {
    const v = Number(localStorage.getItem(key) || "0");
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
function isSnoozedKey(key) {
  return Date.now() < getUntil(key);
}
function snoozeKey(key, hours = 2) {
  try {
    const until = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(key, String(until));
  } catch {}
}
function clearKey(key) {
  try { localStorage.setItem(key, "0"); } catch {}
}

function getLastEmergencyMs() {
  try {
    const v = Number(sessionStorage.getItem(KEY_LAST_EMERGENCY) || "0");
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
function minutesAgo(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (60 * 1000);
}
function hasRecentEmergencyFromSession() {
  const lastEm = getLastEmergencyMs();
  return !!(lastEm && (Date.now() - lastEm) <= 60 * 60 * 1000);
}
function hasRecentEmergencyFromLog(log) {
  const lastEmergency = log.find(e => e.kind === "emergency_open");
  return !!(lastEmergency && minutesAgo(lastEmergency.when) <= 60);
}

function computeSafetySuggestion() {
  let log = [];
  try { log = readLog().slice(0, 120); } catch { log = []; }

  const safetyActive = hasRecentEmergencyFromSession() || hasRecentEmergencyFromLog(log);
  const safetySnoozed = isSnoozedKey(KEY_SAFETY_SNOOZE_UNTIL);

  if (safetyActive && !safetySnoozed) {
    return {
      badge: "Safety",
      title: "Stabilize first",
      text: "If safety is still at risk, use Emergency now. If you’re safe enough, do Calm for 2 minutes.",
      primary: { label: "Calm Me Down", to: "#/yellow/calm" },
      secondary: { label: "Emergency", to: "#/red/emergency" },
    };
  }
  return null;
}

function suggestionCard() {
  const s = computeSafetySuggestion();
  if (!s) return null;

  return el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, [s.badge]),
    el("h2", { class: "h2" }, [s.title]),
    el("p", { class: "p" }, [s.text]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = s.primary.to) }, [s.primary.label]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = s.secondary.to) }, [s.secondary.label]),
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => { snoozeKey(KEY_SAFETY_SNOOZE_UNTIL, 2); location.hash = "#/home"; }
      }, ["Hide (2h)"]),
    ])
  ]);
}

function toolRow({ title, sub, hint, dot, to }) {
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
      hint ? el("p", { class: "tileHint" }, [hint]) : null,
    ].filter(Boolean)
  );
}

const FEELING_OPTIONS = [
  { label: "Overwhelmed / unsafe", hint: "Get real help now.", go: "#/red/emergency", goDot: "dotRed" },
  { label: "Anxious / urge-driven", hint: "Lower intensity first.", go: "#/yellow/calm", goDot: "dotYellow" },
  { label: "Urge to act / message / react", hint: "Pause before acting.", go: "#/yellow/stop", goDot: "dotYellow" },
  { label: "Stuck / frozen", hint: "Body first. Then progress.", go: "#/green/move", goDot: "dotGreen" },
  { label: "I’m okay — I need direction", hint: "Auto-build today’s plan.", go: "#/green/direction", goDot: "dotGreen" },
];

function feelingTile({ label, hint, go, goDot }) {
  return el("button", {
    class: "actionTile",
    type: "button",
    onClick: () => (location.hash = go),
  }, [
    el("div", { class: "tileTop" }, [
      el("div", {}, [
        el("div", { class: "tileTitle" }, [label]),
        el("div", { class: "tileSub" }, [hint]),
      ]),
      el("div", { class: `zoneDot ${goDot}` }, []),
    ]),
    el("p", { class: "tileHint" }, ["Tap"]),
  ]);
}

function toolsModel() {
  const done = onboardingDone();

  const CORE = [
    { title: "Calm Me Down", sub: "Drop intensity fast", hint: "2 minutes. Guided.", dot: "dotYellow", to: "#/yellow/calm" },
    { title: "Stop the Urge", sub: "Pause before acting", hint: "Buy time. Add friction.", dot: "dotYellow", to: "#/yellow/stop" },
    { title: "Move Forward", sub: "Body first. Then progress.", hint: "Pick a ladder. Stop when timer ends.", dot: "dotGreen", to: "#/green/move" },
    { title: "Emergency", sub: "Immediate support", hint: "Use when safety is at risk.", dot: "dotRed", to: "#/red/emergency" },
  ];

  const PLAN = [
    { title: "Choose Today’s Direction", sub: "Auto-build Today’s Plan", hint: "One tap → plan → Step 1.", dot: "dotGreen", to: "#/green/direction" },
    { title: "Edit Today’s Plan", sub: "Three steps only", hint: "Use if you want to customize.", dot: "dotGreen", to: "#/green/today" },
    { title: "Clarify the Next Move", sub: "Lock one action", hint: "Tap quickly. End with one move.", dot: "dotGreen", to: "#/reflect" },
  ];

  const EXTRAS = [
    { title: "History", sub: "See momentum", hint: "Recent sessions + summary.", dot: "dotGreen", to: "#/history" },
    { title: done ? "Quick Start (replay)" : "How Praxis Works", sub: done ? "Replay anytime" : "Start here", hint: "Tap → timer → lock a move → do it.", dot: "dotGreen", to: "#/onboarding" },
    { title: "Find Your Next Step", sub: "Fallback router", hint: "Only if you can’t label your state.", dot: "dotGreen", to: "#/green/next" },
  ];

  return { CORE, PLAN, EXTRAS };
}

export function renderHome() {
  const wrap = el("div", { class: "homeShell" });

  let showTools = false;
  let showPlanTools = false;
  let showExtras = false;

  function header() {
    const safetyActive = hasRecentEmergencyFromSession();
    const safetySnoozed = isSnoozedKey(KEY_SAFETY_SNOOZE_UNTIL);

    const headerButtons = [];
    if (safetyActive && safetySnoozed) {
      headerButtons.push(
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { clearKey(KEY_SAFETY_SNOOZE_UNTIL); rerender(); }
        }, ["Show safety"])
      );
    }

    return el("div", { class: "homeHeader" }, [
      el("h1", { class: "h1" }, ["Reset"]),
      el("p", { class: "p" }, ["Start with your state. One tap."]),
      el("div", { class: "small" }, [`Home ${BUILD_HOME}`]),
      headerButtons.length ? el("div", { class: "btnRow", style: "margin-top:10px" }, headerButtons) : null,
    ].filter(Boolean));
  }

  function startCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Start"]),
      el("h2", { class: "h2" }, ["How are you feeling right now?"]),
      el("p", { class: "small" }, ["Pick the closest match. Praxis routes you."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, FEELING_OPTIONS.map(feelingTile)),
    ]);
  }

  function controlsCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => {
            showTools = !showTools;
            if (showTools) { showPlanTools = false; showExtras = false; }
            rerender();
          }
        }, [showTools ? "Hide tools" : "Show tools"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Core first. Expand only if needed."]),
    ]);
  }

  function toolsSection() {
    const { CORE, PLAN, EXTRAS } = toolsModel();

    return el("div", {}, [
      el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Tools"]),
        el("p", { class: "small" }, ["Core tools first. Add more only if needed."]),
        el("div", { class: "flowShell", style: "margin-top:10px" }, CORE.map(toolRow)),
        el("div", { class: "btnRow", style: "margin-top:12px" }, [
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { showPlanTools = !showPlanTools; rerender(); }
          }, [showPlanTools ? "Hide planning tools" : "Show planning tools"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { showExtras = !showExtras; rerender(); }
          }, [showExtras ? "Hide extras" : "Show extras"]),
        ]),
      ]),

      showPlanTools ? el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Planning tools"]),
        el("p", { class: "small" }, ["Use when you’re stable enough to choose a direction."]),
        el("div", { class: "flowShell", style: "margin-top:10px" }, PLAN.map(toolRow)),
      ]) : null,

      showExtras ? el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Extras"]),
        el("p", { class: "small" }, ["Useful, but not needed most sessions."]),
        el("div", { class: "flowShell", style: "margin-top:10px" }, EXTRAS.map(toolRow)),
      ]) : null,
    ].filter(Boolean));
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    const safety = suggestionCard();
    if (safety) wrap.appendChild(safety);

    wrap.appendChild(startCard());
    wrap.appendChild(controlsCard());

    if (showTools) wrap.appendChild(toolsSection());
  }

  rerender();
  return wrap;
}
