// js/zones/green/direction.js  (FULL REPLACEMENT)
import { appendLog } from "../../storage.js";

const BUILD = "DIR-4";

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

const nowISO = () => new Date().toISOString();

const KEY_DIR = "praxis_direction_today_v2";

// ✅ Today Plan integration (auto-create plan, then route)
const KEY_TODAY = "praxis_today_plan_v5";
const KEY_TODAY_AUTOLAUNCH = "praxis_today_plan_autolaunch_v1";

const TEMPLATES = [
  {
    id: "stability",
    title: "Stability Day",
    sub: "Lower intensity and stay steady",
    a: "2-min Calm",
    b: "5-min walk / movement",
    c: "One small maintenance task (10 min)",
    primaryTo: "#/yellow/calm",
    primaryLabel: "Start Calm",
  },
  {
    id: "maintenance",
    title: "Maintenance Day",
    sub: "Keep life from sliding backward",
    a: "Clean one area (10 min)",
    b: "Reply to one important thing (5–10 min)",
    c: "Prep tomorrow (5 min)",
    primaryTo: "#/green/today",
    primaryLabel: "Open plan",
  },
  {
    id: "progress",
    title: "Progress Day",
    sub: "Do one meaningful thing",
    a: "Start the hard task (25 min)",
    b: "Continue or finish (10–25 min)",
    c: "Quick wrap-up / tidy (5 min)",
    primaryTo: "#/green/today",
    primaryLabel: "Open plan",
  },
  {
    id: "recovery",
    title: "Recovery Day",
    sub: "Heal + protect the future you",
    a: "Eat / hydrate (5 min)",
    b: "Shower or reset body (5–10 min)",
    c: "Early night / low stimulation (15 min)",
    primaryTo: "#/green/today",
    primaryLabel: "Open plan",
  },
];

function saveDirection(planId) {
  try { localStorage.setItem(KEY_DIR, planId); } catch {}
  try { appendLog({ kind: "direction", when: nowISO(), direction: planId, build: BUILD }); } catch {}
}

function writeTodayPlanFromTemplate(t) {
  // Keep it simple: overwrite steps + template, reset progress
  const s = { template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };
  try { localStorage.setItem(KEY_TODAY, JSON.stringify(s)); } catch {}

  // Tell Today Plan to open focused on Step 1 (session-only)
  try {
    sessionStorage.setItem(KEY_TODAY_AUTOLAUNCH, JSON.stringify({ step: 1, mode: "focus" }));
  } catch {}
}

function header() {
  return el("div", { class: "flowHeader" }, [
    el("div", {}, [
      el("h1", { class: "h1" }, ["Choose Today’s Direction"]),
      el("p", { class: "p" }, ["One tap → Praxis auto-builds Today’s Plan. Then you start Step 1."]),
      el("div", { class: "small" }, [`Build ${BUILD}`]),
    ]),
    el("div", { class: "flowMeta" }, [
      el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
    ])
  ]);
}

function planTile(t) {
  return el("button", {
    class: "actionTile",
    type: "button",
    onClick: () => {
      saveDirection(t.id);
      writeTodayPlanFromTemplate(t);
      location.hash = "#/green/today"; // ✅ auto-built plan lives there
    }
  }, [
    el("div", { class: "tileTop" }, [
      el("div", {}, [
        el("div", { class: "tileTitle" }, [t.title]),
        el("div", { class: "tileSub" }, [t.sub]),
      ]),
      el("div", { class: "zoneDot dotGreen" }, []),
    ]),
    el("p", { class: "tileHint" }, ["Tap to auto-build Today’s Plan"]),
  ]);
}

export function renderDirection() {
  const wrap = el("div", { class: "flowShell" });

  wrap.appendChild(header());

  wrap.appendChild(el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Pick a lane"]),
    el("p", { class: "small" }, ["This replaces manual planning. No extra steps."]),
  ]));

  wrap.appendChild(el("div", { class: "flowShell" }, TEMPLATES.map(planTile)));

  wrap.appendChild(el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Rule"]),
    el("p", { class: "p" }, ["Direction → Plan → Step 1. Don’t expand the mission."]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/today") }, ["Edit Today’s Plan"]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"]),
    ])
  ]));

  return wrap;
}
