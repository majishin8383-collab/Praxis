// js/zones/green/direction.js  (FULL REPLACEMENT)

import { appendLog } from "../../storage.js";

const BUILD = "DIR-5";

const KEY_DIR = "praxis_direction_today_v3";
const KEY_TODAY = "praxis_today_plan_v6"; // ✅ current Today Plan key

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

const TEMPLATES = [
  {
    id: "stability",
    title: "Stability Day",
    sub: "Lower intensity and stay steady",
    a: "2-min Calm",
    b: "5-min walk / movement",
    c: "One small maintenance task (10 min)",
    dot: "dotYellow",
  },
  {
    id: "maintenance",
    title: "Maintenance Day",
    sub: "Keep life from sliding backward",
    a: "Clean one area (10 min)",
    b: "Reply to one important thing (5–10 min)",
    c: "Prep tomorrow (5 min)",
    dot: "dotGreen",
  },
  {
    id: "progress",
    title: "Progress Day",
    sub: "Do one meaningful thing",
    a: "Start the hard task (25 min)",
    b: "Continue or finish (10–25 min)",
    c: "Quick wrap-up / tidy (5 min)",
    dot: "dotGreen",
  },
  {
    id: "recovery",
    title: "Recovery Day",
    sub: "Heal + protect the future you",
    a: "Eat / hydrate (5 min)",
    b: "Shower or reset body (5–10 min)",
    c: "Early night / low stimulation (15 min)",
    dot: "dotGreen",
  },
];

function saveDirection(planId) {
  try { localStorage.setItem(KEY_DIR, String(planId || "")); } catch {}
  try { appendLog({ kind: "direction", when: nowISO(), direction: String(planId || ""), build: BUILD }); } catch {}
}

function writeTodayPlanFromTemplate(t) {
  // Overwrite steps + template, reset progress
  const s = { template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };
  try { localStorage.setItem(KEY_TODAY, JSON.stringify(s)); } catch {}
}

export function renderDirection() {
  const wrap = el("div", { class: "flowShell" });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Choose Today’s Direction"]),
        el("p", { class: "p" }, ["One tap → auto-build your 3-step plan. Then do Step 1."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function planTile(t) {
    return el(
      "button",
      {
        class: "actionTile",
        type: "button",
        onClick: () => {
          saveDirection(t.id);
          writeTodayPlanFromTemplate(t);
          location.hash = "#/green/today";
        },
      },
      [
        el("div", { class: "tileTop" }, [
          el("div", {}, [
            el("div", { class: "tileTitle" }, [t.title]),
            el("div", { class: "tileSub" }, [t.sub]),
          ]),
          el("div", { class: `zoneDot ${t.dot}` }, []),
        ]),
        el("p", { class: "tileHint" }, ["Tap to auto-build Today’s Plan"]),
      ]
    );
  }

  wrap.appendChild(header());

  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Pick a lane"]),
      el("p", { class: "small" }, ["This prevents planning spirals. You can edit steps in Today’s Plan after."]),
    ])
  );

  wrap.appendChild(el("div", { class: "flowShell" }, TEMPLATES.map(planTile)));

  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Rule"]),
      el("p", { class: "p" }, ["Direction → Plan → Step 1. Don’t expand the mission."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/today") }, ["Open Today’s Plan"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"]),
      ]),
    ])
  );

  return wrap;
}
