import { readLog } from "./storage.js";

const BUILD_HOME = "HOME-V2-1";

// Suggestion + onboarding keys (kept)
const KEY_DONE = "praxis_onboarding_done";
const KEY_SNOOZE_UNTIL = "praxis_suggest_snooze_until";
const KEY_SAFETY_SNOOZE_UNTIL = "praxis_safety_snooze_until";
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

export function setMain(viewNode) {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = "";
  if (viewNode) main.appendChild(viewNode);
}

/* -----------------------------------------
   Onboarding / snooze helpers
------------------------------------------ */

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

/* -----------------------------------------
   Suggestion engine (kept, but now secondary)
------------------------------------------ */

function computeSuggestion() {
  let log = [];
  try { log = readLog().slice(0, 120); } catch { log = []; }

  const safetyActive = hasRecentEmergencyFromSession() || hasRecentEmergencyFromLog(log);
  const safetySnoozed = isSnoozedKey(KEY_SAFETY_SNOOZE_UNTIL);

  // RULE 0: Safety is highest priority, but can be hidden for 2 hours
  if (safetyActive && !safetySnoozed) {
    return {
      type: "safety",
      badge: "Safety",
      title: "Stabilize first",
      text: "If safety is still at risk, use Emergency now. If you’re safe enough, do Calm for 2 minutes.",
      primary: { label: "Emergency", to: "#/red/emergency" },
      secondary: { label: "Calm Me Down", to: "#/yellow/calm" },
    };
  }

  // Normal suggestions respect normal snooze
  if (isSnoozedKey(KEY_SNOOZE_UNTIL)) return null;

  if (!log.length) {
    return {
      type: "normal",
      badge: "Quick Start",
      title: "Start with Calm",
      text: "If you’re unsure, don’t think—reduce intensity first.",
      primary: { label: "Calm Me Down", to: "#/yellow/calm" },
      secondary: { label: "How it works", to: "#/onboarding" },
    };
  }

  const todayCutoff = startOfTodayMs();
  const today = log.filter(e => e.when && new Date(e.when).getTime() >= todayCutoff);
  const last = log[0];

  const lastClarify = log.find(e => e.kind === "clarify" && e.statement);
  if (lastClarify && minutesAgo(lastClarify.when) <= 360) {
    const to = routeForClarifyMove(lastClarify.move);
    return {
      type: "normal",
      badge: "Lock → Do",
      title: "Do the move you locked",
      text: lastClarify.statement,
      primary: { label: "Do it now", to },
      secondary: { label: "Run Clarify", to: "#/reflect" },
    };
  }

  const recentUrge = log.filter(e => e.kind === "stop_urge" && minutesAgo(e.when) <= 120);
  const lastUrge = recentUrge[0];
  const stillPresentCount = recentUrge.filter(e => e.outcome === "still_present").length;
  if (lastUrge && (lastUrge.outcome === "still_present" || stillPresentCount >= 2)) {
    return {
      type: "normal",
      badge: "Loop detected",
      title: "Shift the state, then decide",
      text: "Run Calm for 2 minutes, then re-run Stop the Urge. Don’t improvise.",
      primary: { label: "Calm Me Down", to: "#/yellow/calm" },
      secondary: { label: "Stop the Urge", to: "#/yellow/stop" },
    };
  }

  const calmToday = today.filter(e => e.kind === "calm").length;
  if (calmToday >= 2) {
    return {
      type: "normal",
      badge: "Next phase",
      title: "Convert calm into progress",
      text: "You’ve stabilized. Now use movement to break the loop.",
      primary: { label: "Move Forward", to: "#/green/move" },
      secondary: { label: "Find Next Step", to: "#/green/next" },
    };
  }

  if (today.length === 0) {
    return {
      type: "normal",
      badge: "Start here",
      title: "Choose today’s lane",
      text: "Pick one direction for today so your brain stops bargaining.",
      primary: { label: "Today’s Direction", to: "#/green/direction" },
      secondary: { label: "Today’s Plan", to: "#/green/today" },
    };
  }

  if (last.kind === "direction") {
    return {
      type: "normal",
      badge: "Next step",
      title: "Turn direction into a plan",
      text: "Pick a simple 3-step plan for today.",
      primary: { label: "Today’s Plan", to: "#/green/today" },
      secondary: { label: "Find Next Step", to: "#/green/next" },
    };
  }

  if (last.kind === "move_forward") {
    return {
      type: "normal",
      badge: "Lock it",
      title: "Clarify the next move",
      text: "After momentum, lock one move so you don’t drift back into thinking.",
      primary: { label: "Clarify", to: "#/reflect" },
      secondary: { label: "History", to: "#/history" },
    };
  }

  return {
    type: "normal",
    badge: "Suggestion",
    title: "Find your next step",
    text: "Tap a move. Don’t negotiate with the moment.",
    primary: { label: "Find Next Step", to: "#/green/next" },
    secondary: { label: "Clarify", to: "#/reflect" },
  };
}

function suggestionCard() {
  const s = computeSuggestion();
  if (!s) return null;

  const hideKey = s.type === "safety" ? KEY_SAFETY_SNOOZE_UNTIL : KEY_SNOOZE_UNTIL;

  return el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, [s.badge || "Suggestion"]),
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

/* -----------------------------------------
   Tiles (kept as “All tools”, not the start)
------------------------------------------ */

function baseTiles() {
  return [
    { title: "Calm Me Down", sub: "Drop intensity fast", hint: "2 minutes. Guided.", dot: "dotYellow", to: "#/yellow/calm" },
    { title: "Stop the Urge", sub: "Pause before acting", hint: "Buy time. Add friction.", dot: "dotYellow", to: "#/yellow/stop" },
    { title: "Emergency", sub: "Immediate support", hint: "Use when safety is at risk.", dot: "dotRed", to: "#/red/emergency" },

    { title: "Move Forward", sub: "Body first. Then progress.", hint: "Pick a ladder. Do it until the timer ends.", dot: "dotGreen", to: "#/green/move" },
    { title: "Choose Today’s Direction", sub: "Pick a lane for today", hint: "Stability / Maintenance / Progress / Recovery.", dot: "dotGreen", to: "#/green/direction" },
    { title: "Today’s Plan", sub: "Three steps only", hint: "Pick a template, then do Step 1.", dot: "dotGreen", to: "#/green/today" },

    { title: "Find Your Next Step", sub: "Tap → go", hint: "Choose what’s closest.", dot: "dotGreen", to: "#/green/next" },
    { title: "Clarify the Next Move", sub: "Lock a move", hint: "Tap quickly. End with one action.", dot: "dotGreen", to: "#/reflect" },
    { title: "History", sub: "See your momentum", hint: "Recent sessions + summary.", dot: "dotGreen", to: "#/history" },
  ];
}

function onboardingTile(done) {
  return {
    title: done ? "How Praxis Works (replay)" : "How Praxis Works",
    sub: done ? "Replay anytime" : "Start here (1 minute)",
    hint: "State → action → log → next move.",
    dot: "dotGreen",
    to: "#/onboarding",
  };
}

function getTiles() {
  const done = onboardingDone();
  const tiles = baseTiles();
  const onboard = onboardingTile(done);

  // If not done, keep onboarding visible near the top of tools list
  if (!done) return [onboard, ...tiles];

  // If done, put onboarding near the bottom (before History)
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

/* -----------------------------------------
   HOME V2 (guided entry)
------------------------------------------ */

function feelingButton(label, hint, to, dot = "dotGreen") {
  return el("button", {
    class: "actionTile",
    type: "button",
    onClick: () => (location.hash = to),
  }, [
    el("div", { class: "tileTop" }, [
      el("div", {}, [
        el("div", { class: "tileTitle" }, [label]),
        el("div", { class: "tileSub" }, [hint]),
      ]),
      el("div", { class: `zoneDot ${dot}` }, []),
    ]),
    el("p", { class: "tileHint" }, ["Tap"]),
  ]);
}

export function renderHome() {
  const wrap = el("div", { class: "homeShell" });

  // Header controls:
  // - If Safety is active but snoozed => show "Show safety"
  // - Else if normal snoozed => show "Show suggestions"
  const normalSnoozed = isSnoozedKey(KEY_SNOOZE_UNTIL);
  const safetyActive = hasRecentEmergencyFromSession();
  const safetySnoozed = isSnoozedKey(KEY_SAFETY_SNOOZE_UNTIL);

  const headerButtons = [];
  if (safetyActive && safetySnoozed) {
    headerButtons.push(
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => { clearKey(KEY_SAFETY_SNOOZE_UNTIL); rerenderHomeIfActive() || (location.hash = "#/home"); }
      }, ["Show safety"])
    );
  } else if (normalSnoozed) {
    headerButtons.push(
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => { clearKey(KEY_SNOOZE_UNTIL); rerenderHomeIfActive() || (location.hash = "#/home"); }
      }, ["Show suggestions"])
    );
  }

  wrap.appendChild(
    el("div", { class: "homeHeader" }, [
      el("h1", { class: "h1" }, ["Reset"]),
      el("p", { class: "p" }, ["Start with your state. Praxis routes you."]),
      el("div", { class: "small" }, [`${BUILD_HOME}`]),
      headerButtons.length ? el("div", { class: "btnRow", style: "margin-top:10px" }, headerButtons) : null,
    ].filter(Boolean))
  );

  // ✅ Home v2 guided start
  wrap.appendChild(el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Start here"]),
    el("h2", { class: "h2" }, ["How are you feeling right now?"]),
    el("p", { class: "small" }, ["One tap. No thinking."]),
    el("div", { class: "flowShell", style: "margin-top:10px" }, [
      feelingButton("Overwhelmed / unsafe", "Go to Emergency now.", "#/red/emergency", "dotRed"),
      feelingButton("Anxious / urge-driven", "Lower intensity first.", "#/yellow/calm", "dotYellow"),
      feelingButton("Okay, but stuck", "Body first. Then progress.", "#/green/move", "dotGreen"),
      feelingButton("Stable and ready", "Pick today’s lane, then plan.", "#/green/direction", "dotGreen"),
    ]),
  ]));

  // ✅ Suggestions remain available but secondary (reduces chaos)
  const sCard = suggestionCard();
  if (sCard) wrap.appendChild(sCard);

  // ✅ All tools live below (optional)
  wrap.appendChild(el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["All tools (optional)"]),
    el("p", { class: "small" }, ["Use these if you know what you need."]),
  ]));

  const TILES = getTiles();
  wrap.appendChild(el("div", { class: "homeGrid" }, TILES.map(tileButton)));

  return wrap;
}
