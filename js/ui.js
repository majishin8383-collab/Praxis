// js/ui.js (FULL REPLACEMENT)
// Home = "How are you feeling?" + optional "Show tools".
// No "Start here / today’s lane / quick start" content on landing.
// Safety suggestion can auto-show ONLY if safety is active.

import { readLog } from "./storage.js";

const BUILD_HOME = "UI-HOME-3";

const KEY_DONE = "praxis_onboarding_done";
const KEY_SNOOZE_UNTIL = "praxis_suggest_snooze_until"; // kept for compatibility
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

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function minutesAgo(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (60 * 1000);
}

function routeForClarifyMove(moveId) {
  const map = {
    pause24: "#/home",
    calm: "#/yellow/calm",
    shield: "#/yellow/stop",
    move: "#/green/move",
    direction: "#/green/direction",
  };
  return map[moveId] || "#/home";
}

function rerenderHomeIfActive() {
  if ((location.hash || "#/home").startsWith("#/home")) {
    setMain(renderHome());
    window.scrollTo(0, 0);
    return true;
  }
  return false;
}

function hasRecentEmergencyFromSession() {
  const lastEm = getLastEmergencyMs();
  return !!(lastEm && (Date.now() - lastEm) <= 60 * 60 * 1000);
}
function hasRecentEmergencyFromLog(log) {
  const lastEmergency = log.find(e => e.kind === "emergency_open");
  return !!(lastEmergency && minutesAgo(lastEmergency.when) <= 60);
}

// Only used for safety auto-suggestion (home landing stays clean otherwise)
function computeSuggestionSafetyOnly() {
  let log = [];
  try { log = readLog().slice(0, 120); } catch { log = []; }

  const safetyActive = hasRecentEmergencyFromSession() || hasRecentEmergencyFromLog(log);
  const safetySnoozed = isSnoozedKey(KEY_SAFETY_SNOOZE_UNTIL);

  if (safetyActive && !safetySnoozed) {
    return {
      type: "safety",
      badge: "Safety",
      title: "Stabilize first",
      text: "If safety is still at risk, use Emergency now. If you’re safe enough, do Calm for 2 minutes.",
      primary: { label: "Calm Me Down", to: "#/yellow/calm" },
      secondary: { label: "Emergency", to: "#/red/emergency" },
    };
  }
  return null;
}

function baseTiles() {
  return [
    { title: "Calm Me Down", sub: "Drop intensity fast", hint: "2 minutes. Guided.", dot: "dotYellow", to: "#/yellow/calm" },
    { title: "Stop the Urge", sub: "Pause before acting", hint: "Buy time. Add friction.", dot: "dotYellow", to: "#/yellow/stop" },
    { title: "Emergency", sub: "Immediate support", hint: "Use when safety is at risk.", dot: "dotRed", to: "#/red/emergency" },
    { title: "Move Forward", sub: "Body first. Then progress.", hint: "Pick a ladder. Do it until the timer ends.", dot: "dotGreen", to: "#/green/move" },
    { title: "Find Your Next Step", sub: "Tap → go", hint: "Choose what’s closest.", dot: "dotGreen", to: "#/green/next" },
    { title: "Choose Today’s Direction", sub: "Pick a lane for today", hint: "Stability / Maintenance / Progress / Recovery.", dot: "dotGreen", to: "#/green/direction" },
    { title: "Today’s Plan", sub: "Three steps only", hint: "Pick a template, then fill 3 moves.", dot: "dotGreen", to: "#/green/today" },
    { title: "Clarify the Next Move", sub: "Lock a move", hint: "Tap quickly. End with one action.", dot: "dotGreen", to: "#/reflect" },
    { title: "History", sub: "See your momentum", hint: "Recent sessions + summary.", dot: "dotGreen", to: "#/history" },
  ];
}

function onboardingTile(done) {
  return {
    title: done ? "Quick Start (replay)" : "How Praxis Works",
    sub: done ? "Replay anytime" : "Start here",
    hint: "Tap → timer → lock a move → do it.",
    dot: "dotGreen",
    to: "#/onboarding",
  };
}

function getTiles() {
  const done = onboardingDone();
  const tiles = baseTiles();
  const onboard = onboardingTile(done);

  // Keep onboarding available, but not dominant.
  // Insert before History if present.
  const historyIndex = tiles.findIndex(t => t.to === "#/history");
  if (historyIndex >= 0) tiles.splice(historyIndex, 0, onboard);
  else tiles.push(onboard);

  return tiles;
}

function tileButton(t) {
  return el(
    "button",
    { class: "actionTile", type: "button", onClick: () => (location.hash = t.to) },
    [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [t.title]),
          el("div", { class: "tileSub" }, [t.sub]),
        ]),
        el("div", { class: `zoneDot ${t.dot}` }, []),
      ]),
      el("p", { class: "tileHint" }, [t.hint]),
    ]
  );
}

function suggestionCardSafetyOnly() {
  const s = computeSuggestionSafetyOnly();
  if (!s) return null;

  const hideKey = KEY_SAFETY_SNOOZE_UNTIL;

  return el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, [s.badge || "Safety"]),
    el("h2", { class: "h2" }, [s.title]),
    el("p", { class: "p" }, [s.text]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = s.primary.to) }, [s.primary.label]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = s.secondary.to) }, [s.secondary.label]),
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => { snoozeKey(hideKey, 2); rerenderHomeIfActive() || (location.hash = "#/home"); }
      }, ["Hide (2h)"]),
    ])
  ]);
}

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

const FEELING_OPTIONS = [
  { label: "Overwhelmed / unsafe", hint: "Get real help now.", go: "#/red/emergency", goDot: "dotRed" },
  { label: "Anxious / urge-driven", hint: "Lower intensity first.", go: "#/yellow/calm", goDot: "dotYellow" },
  { label: "Urge to act / message / react", hint: "Pause before acting.", go: "#/yellow/stop", goDot: "dotYellow" },
  { label: "Stuck / frozen", hint: "Body first. Then progress.", go: "#/green/move", goDot: "dotGreen" },
  { label: "I’m okay — I need direction", hint: "Pick a lane for today.", go: "#/green/direction", goDot: "dotGreen" },
];

export function renderHome() {
  const wrap = el("div", { class: "homeShell" });

  // session-only toggle
  let showTools = false;

  function header() {
    const safetyActive = hasRecentEmergencyFromSession();
    const safetySnoozed = isSnoozedKey(KEY_SAFETY_SNOOZE_UNTIL);

    const headerButtons = [];

    // Only show “Show safety” button if they snoozed it.
    if (safetyActive && safetySnoozed) {
      headerButtons.push(
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { clearKey(KEY_SAFETY_SNOOZE_UNTIL); rerenderHomeIfActive() || (location.hash = "#/home"); }
        }, ["Show safety"])
      );
    }

    return el("div", { class: "homeHeader" }, [
      el("h1", { class: "h1" }, ["Reset"]),
      el("p", { class: "p" }, ["Start with your state. Praxis routes you."]),
      el("div", { class: "small" }, [`Home ${BUILD_HOME}`]),
      headerButtons.length ? el("div", { class: "btnRow", style: "margin-top:10px" }, headerButtons) : null,
    ].filter(Boolean));
  }

  function feelingCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["How are you feeling?"]),
      el("p", { class: "small" }, ["One tap. No thinking."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, FEELING_OPTIONS.map(o => feelingTile(o))),
    ]);
  }

  function toolsToggleCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { showTools = !showTools; rerender(); }
        }, [showTools ? "Hide tools" : "Show tools"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Tools are optional. Default is simple."]),
    ]);
  }

  function toolsSection() {
    const tiles = getTiles();
    return el("div", {}, [
      el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["All tools"]),
        el("p", { class: "small" }, ["Use these if you already know what you need."]),
      ]),
      el("div", { class: "homeGrid" }, tiles.map(tileButton)),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    // Safety card can auto-show, otherwise keep landing clean.
    const safety = suggestionCardSafetyOnly();
    if (safety) wrap.appendChild(safety);

    wrap.appendChild(feelingCard());
    wrap.appendChild(toolsToggleCard());
    if (showTools) wrap.appendChild(toolsSection());
  }

  rerender();
  return wrap;
}
