// js/zones/green/nextStep.js  (FULL REPLACEMENT)

import { appendLog, hasStabilizeCreditToday } from "../../storage.js";
import { getTemplateById } from "../../state/templates.js";

const BUILD = "NS-4";

// Must match Today Plan + Direction
const KEY_TODAY = "praxis_today_plan_v5";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

const nowISO = () => new Date().toISOString();
function safeAppendLog(entry) { try { appendLog(entry); } catch {} }

function normalizeState(s) {
  const doneStep = Number(s?.doneStep);
  return {
    template: s?.template || "",
    a: s?.a || "",
    b: s?.b || "",
    c: s?.c || "",
    doneStep: Number.isFinite(doneStep) ? doneStep : 0,
  };
}

function readTodayState() {
  try {
    const raw = localStorage.getItem(KEY_TODAY);
    if (!raw) return { template: "", a: "", b: "", c: "", doneStep: 0 };
    return normalizeState(JSON.parse(raw));
  } catch {
    return { template: "", a: "", b: "", c: "", doneStep: 0 };
  }
}

function saveTodayState(state) {
  try { localStorage.setItem(KEY_TODAY, JSON.stringify(state)); } catch {}
}

function isBlankPlan(state) {
  const a = (state.a || "").trim();
  const b = (state.b || "").trim();
  const c = (state.c || "").trim();
  return !a && !b && !c;
}

/**
 * Seed Today Plan only if blank (never overwrite user plan).
 * If user already has a plan, we keep it as-is.
 */
function seedPlanIfBlank(templateId) {
  const state = readTodayState();

  if (!isBlankPlan(state)) {
    // Ensure template marker exists for UX clarity, but don't change steps
    if (!state.template) saveTodayState({ ...state, template: "custom" });
    return;
  }

  const t = getTemplateById(templateId, "progress");
  saveTodayState({ template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 });
}

export function renderNextStep() {
  const wrap = el("div", { class: "flowShell" });

  const stabilized = hasStabilizeCreditToday();
  safeAppendLog({ kind: "next_step_open", when: nowISO(), build: BUILD, stabilizedToday: stabilized });

  function go(label, route, seedTemplateId) {
    safeAppendLog({
      kind: "next_step_choice",
      when: nowISO(),
      build: BUILD,
      label,
      route,
      seedTemplateId: seedTemplateId || null,
      stabilizedToday: stabilized
    });

    if (seedTemplateId) seedPlanIfBlank(seedTemplateId);
    location.hash = route;
  }

  const OPTIONS = [
    { label: "Overwhelmed / anxious", hint: "Reduce intensity first.", action: () => go("Overwhelmed / anxious", "#/yellow/calm", "stability") },
    { label: "Urge to act / message / react", hint: "Pause before you do anything.", action: () => go("Urge to act / message / react", "#/yellow/stop", "stability") },
    { label: "Stuck / frozen", hint: "Move your body first.", action: () => go("Stuck / frozen", "#/green/move", "progress") },
    { label: "Restless / distracted", hint: "Discharge energy, then choose a step.", action: () => go("Restless / distracted", "#/green/move", "progress") },
    { label: "I’m okay — I need direction", hint: "Auto-build a plan. Start Step 1.", action: () => go("I’m okay — I need direction", "#/green/today", "progress") },
    { label: "I don’t know", hint: "Start moving. Clarity follows.", action: () => go("I don’t know", "#/green/move", "stability") },
  ];

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Find Your Next Step"]),
        el("p", { class: "p" }, ["One tap → Praxis routes you and keeps Today’s Plan ready."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
        stabilized ? el("div", { class: "small" }, ["Stabilized today ✓ (Today’s Plan Step 2 available)"]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function tile(o) {
    return el("button", { class: "actionTile", type: "button", onClick: o.action }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [o.label]),
          el("div", { class: "tileSub" }, ["Tap to go"]),
        ]),
        el("div", { class: "zoneDot dotGreen" }, []),
      ]),
      el("p", { class: "tileHint" }, [o.hint]),
    ]);
  }

  wrap.appendChild(header());

  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Don’t overthink"]),
      el("p", { class: "p" }, ["Choose what fits right now. Praxis keeps the plan ready behind you."]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => go("Open Today’s Plan", "#/green/today", "progress") }, ["Open Today’s Plan"]),
      ]),
    ])
  );

  wrap.appendChild(el("div", { class: "flowShell" }, OPTIONS.map(tile)));

  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("p", { class: "small" }, ["If safety is at risk:"]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnDanger", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"]),
      ]),
    ])
  );

  return wrap;
}
