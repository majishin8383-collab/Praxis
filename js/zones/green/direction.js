import { appendLog } from "../../storage.js";

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

const KEY = "praxis_direction_today_v2";

const PLANS = [
  {
    id: "stability",
    title: "Stability Day",
    sub: "Lower intensity. Stay steady.",
    steps: [
      "Calm Me Down (2 min)",
      "Move Forward: reset your body (2 min)",
      "One small maintenance task (10 min)"
    ],
    primary: { label: "Start Calm", to: "#/yellow/calm" },
    secondary: { label: "Move Forward", to: "#/green/move" }
  },
  {
    id: "maintenance",
    title: "Maintenance Day",
    sub: "Keep things from sliding backward.",
    steps: [
      "Move Forward: make one area better (10 min)",
      "Today’s Plan: write 3 steps",
      "Do the easiest step first"
    ],
    primary: { label: "Open Today’s Plan", to: "#/green/today" },
    secondary: { label: "Move Forward", to: "#/green/move" }
  },
  {
    id: "progress",
    title: "Progress Day",
    sub: "Do one meaningful thing.",
    steps: [
      "Move Forward: one useful task (25 min)",
      "Repeat once if energy is there",
      "Stop when the timer ends"
    ],
    primary: { label: "Start 25 min", to: "#/green/move" },
    secondary: { label: "Focus", to: "#/green/focus" }
  },
  {
    id: "recovery",
    title: "Recovery Day",
    sub: "Recover and protect tomorrow.",
    steps: [
      "Calm Me Down (2 min)",
      "Short movement (5 min)",
      "Write one sentence in Clarify"
    ],
    primary: { label: "Start Calm", to: "#/yellow/calm" },
    secondary: { label: "Clarify", to: "#/reflect" }
  }
];

export function renderDirection() {
  const wrap = el("div", { class: "flowShell" });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Choose Today’s Direction"]),
        el("p", { class: "p" }, ["Tap one. Get a simple plan now."]),
      ]),
      // Reset button hidden by CSS; safe to keep
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function saveChoice(planId) {
    try { localStorage.setItem(KEY, planId); } catch {}
    appendLog({ kind: "direction", when: nowISO(), direction: planId });
  }

  function planCard(p) {
    return el("button", {
      class: "actionTile",
      type: "button",
      onClick: () => { saveChoice(p.id); showPlan(p); }
    }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [p.title]),
          el("div", { class: "tileSub" }, [p.sub]),
        ]),
        el("div", { class: "zoneDot dotGreen" }, []),
      ]),
      el("p", { class: "tileHint" }, ["Tap to choose"]),
    ]);
  }

  function showPlan(p) {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    wrap.appendChild(el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Selected: ${p.title}`]),
      el("p", { class: "p" }, [p.sub]),
      el("div", { class: "hr" }, []),
      el("h2", { class: "h2" }, ["Today’s simple plan"]),
      ...p.steps.map(s => el("div", { class: "p", style: "margin-top:6px" }, ["• " + s])),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = p.primary.to) }, [p.primary.label]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = p.secondary.to) }, [p.secondary.label]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => rerenderList() }, ["Pick a different direction"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Rule: stop when the timer ends. Keep it small."]),
    ]));
  }

  function rerenderList() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    wrap.appendChild(el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Pick a lane"]),
      el("p", { class: "small" }, ["This is a direction, not a schedule."]),
    ]));

    wrap.appendChild(el("div", { class: "flowShell" }, PLANS.map(planCard)));
  }

  rerenderList();
  return wrap;
}
