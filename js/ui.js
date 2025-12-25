import { readLog } from "./storage.js";

const KEY_DONE = "praxis_onboarding_done";
const KEY_SNOOZE_UNTIL = "praxis_suggest_snooze_until";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function onboardingDone() {
  try {
    return localStorage.getItem(KEY_DONE) === "1";
  } catch {
    return false;
  }
}

function getSnoozeUntil() {
  try {
    const v = Number(localStorage.getItem(KEY_SNOOZE_UNTIL) || "0");
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function snooze(hours = 2) {
  try {
    const until = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(KEY_SNOOZE_UNTIL, String(until));
  } catch {
    // ignore
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

function computeSuggestion() {
  // Respect snooze
  if (Date.now() < getSnoozeUntil()) return null;

  let log = [];
  try {
    log = readLog().slice(0, 80); // newest-first in this project
  } catch {
    log = [];
  }
  if (!log.length) {
    return {
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

  // 1) If the last thing they did was Clarify recently, nudge to execute it.
  const lastClarify = log.find(e => e.kind === "clarify" && e.statement);
  if (lastClarify && minutesAgo(lastClarify.when) <= 360) {
    const to = routeForClarifyMove(lastClarify.move);
    return {
      badge: "Lock → Do",
      title: "Do the move you locked",
      text: lastClarify.statement,
      primary: { label: "Do it now", to },
      secondary: { label: "Run Clarify", to: "#/reflect" },
    };
  }

  // 2) If they’re looping Stop the Urge and still present, suggest Calm + extend.
  const recentUrge = log.filter(e => e.kind === "stop_urge" && minutesAgo(e.when) <= 120);
  const lastUrge = recentUrge[0];
  const stillPresentCount = recentUrge.filter(e => e.outcome === "still_present").length;

  if (lastUrge && (lastUrge.outcome === "still_present" || stillPresentCount >= 2)) {
    return {
      badge: "Loop detected",
      title: "Shift the state, then decide",
      text: "Run Calm for 2 minutes, then re-run Stop the Urge. Don’t improvise.",
      primary: { label: "Calm Me Down", to: "#/yellow/calm" },
      secondary: { label: "Stop the Urge", to: "#/yellow/stop" },
    };
  }

  // 3) If Calm is repeated a lot today, suggest moving into action.
  const calmToday = today.filter(e => e.kind === "calm").length;
  if (calmToday >= 2) {
    return {
      badge: "Next phase",
      title: "Convert calm into progress",
      text: "You’ve stabilized. Now use movement to break the loop.",
      primary: { label: "Move Forward", to: "#/green/move" },
      secondary: { label: "Find Next Step", to: "#/green/next" },
    };
  }

  // 4) If nothing today, suggest direction first.
  if (today.length === 0) {
    return {
      badge: "Start here",
      title: "Choose today’s lane",
      text: "Pick one direction for today so your brain stops bargaining.",
      primary: { label: "Today’s Direction", to: "#/green/direction" },
      secondary: { label: "Today’s Plan", to: "#/green/today" },
    };
  }

  // 5) Default: based on last tool, suggest the next logical tool (consistent flow).
  if (last.kind === "direction") {
    return {
      badge: "Next step",
      title: "Turn direction into a plan",
      text: "Pick a simple 3-step plan for today.",
      primary: { label: "Today’s Plan", to: "#/green/today" },
      secondary: { label: "Find Next Step", to: "#/green/next" },
    };
  }

  if (last.kind === "move_forward") {
    return {
      badge: "Lock it",
      title: "Clarify the next move",
      text: "After momentum, lock one move so you don’t drift back into thinking.",
      primary: { label: "Clarify", to: "#/reflect" },
      secondary: { label: "History", to: "#/history" },
    };
  }

  // Fallback
  return {
    badge: "Suggestion",
    title: "Find your next step",
    text: "Tap a move. Don’t negotiate with the moment.",
    primary: { label: "Find Next Step", to: "#/green/next" },
    secondary: { label: "Clarify", to: "#/reflect" },
  };
}

export function setMain(viewNode) {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = "";
  if (viewNode) main.appendChild(viewNode);
}

function baseTiles() {
  return [
    // Yellow zone
    { title: "Calm Me Down", sub: "Drop intensity fast", hint: "2 minutes. Guided.", dot: "dotYellow", to: "#/yellow/calm" },
    { title: "Stop the Urge", sub: "Pause before acting", hint: "Buy time. Add friction.", dot: "dotYellow", to: "#/yellow/stop" },

    // Red zone
    { title: "Emergency", sub: "Immediate support", hint: "Use when safety is at risk.", dot: "dotRed", to: "#/red/emergency" },

    // Green zone
    { title: "Move Forward", sub: "Body first. Then progress.", hint: "Pick a ladder. Do it until the timer ends.", dot: "dotGreen", to: "#/green/move" },
    { title: "Find Your Next Step", sub: "Tap → go", hint: "Choose what’s closest.", dot: "dotGreen", to: "#/green/next" },
    { title: "Choose Today’s Direction", sub: "Pick a lane for today", hint: "Stability / Maintenance / Progress / Recovery.", dot: "dotGreen", to: "#/green/direction" },
    { title: "Today’s Plan", sub: "Three steps only", hint: "Pick a template, then fill 3 moves.", dot: "dotGreen", to: "#/green/today" },
    { title: "Clarify the Next Move", sub: "Lock a move", hint: "Tap quickly. End with one action.", dot: "dotGreen", to: "#/reflect" },

    // History
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

  // First-time users: onboarding goes FIRST
  if (!done) return [onboard, ...tiles];

  // Returning users: onboarding stays near bottom (before History)
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

function suggestionCard() {
  const s = computeSuggestion();
  if (!s) return null;

  return el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, [s.badge || "Suggestion"]),
    el("h2", { class: "h2" }, [s.title]),
    el("p", { class: "p" }, [s.text]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = s.primary.to) }, [s.primary.label]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = s.secondary.to) }, [s.secondary.label]),
      el("button", { class: "btn", type: "button", onClick: () => { snooze(2); location.hash = "#/home"; } }, ["Dismiss"]),
    ])
  ]);
}

export function renderHome() {
  const wrap = el("div", { class: "homeShell" });

  wrap.appendChild(
    el("div", { class: "homeHeader" }, [
      el("h1", { class: "h1" }, ["Reset"]),
      el("p", { class: "p" }, ["Choose the next right action. Praxis will guide the rest."]),
    ])
  );

  const sCard = suggestionCard();
  if (sCard) wrap.appendChild(sCard);

  const TILES = getTiles();
  wrap.appendChild(el("div", { class: "homeGrid" }, TILES.map(tileButton)));

  return wrap;
}
