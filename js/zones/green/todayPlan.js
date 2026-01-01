/*! 
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */
// js/zones/green/todayPlan.js  (FULL REPLACEMENT)

import {
  appendLog,
  consumeNextIntent,
  hasStabilizeCreditToday,
  grantStabilizeCreditToday,
} from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-19";

// ✅ Must match Router
const KEY_PRIMARY = "praxis_today_plan_v5";
// Back-compat in case older saves exist
const KEY_FALLBACK = "praxis_today_plan_v6";

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

const nowISO = () => new Date().toISOString();
function safeAppendLog(entry) {
  try {
    appendLog(entry);
  } catch {}
}

// ✅ Token grant should be idempotent (day-stamp). Best-effort only.
function grantToken() {
  try {
    grantStabilizeCreditToday();
  } catch {}
}

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

function readState() {
  try {
    const raw = localStorage.getItem(KEY_PRIMARY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {}
  try {
    const raw2 = localStorage.getItem(KEY_FALLBACK);
    if (raw2) return normalizeState(JSON.parse(raw2));
  } catch {}
  return { template: "", a: "", b: "", c: "", doneStep: 0 };
}

function saveState(s) {
  try {
    localStorage.setItem(KEY_PRIMARY, JSON.stringify(s));
  } catch {}
}

const TEMPLATES = [
  { id: "stability", label: "Stability", a: "2-min Calm", b: "5-min walk / movement", c: "One small maintenance task" },
  { id: "maintenance", label: "Maintenance", a: "Clean one area (10 min)", b: "Reply to one important thing", c: "Prep tomorrow (5 min)" },
  { id: "progress", label: "Progress", a: "Start the hard task (25 min)", b: "Continue or finish (10–25 min)", c: "Quick wrap-up / tidy (5 min)" },
  { id: "recovery", label: "Recovery", a: "Eat / hydrate", b: "Shower or reset body", c: "Early night / low stimulation" },
];

function getTemplateById(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}

function isBlankPlan(state) {
  const a = (state.a || "").trim();
  const b = (state.b || "").trim();
  const c = (state.c || "").trim();
  return !a && !b && !c;
}

function pickDefaultTemplateId(stabilizedToday) {
  return stabilizedToday ? "stability" : "progress";
}

// Supports "2-min" shorthand + ranges + hours + normal minutes
function detectMinutes(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();

  const hyphen = t.match(/(\d+)\s*-\s*(min|mins|minute|minutes)\b/);
  if (hyphen) {
    const n = parseInt(hyphen[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  const range = t.match(/(\d+)\s*[–-]\s*(\d+)\s*(min|mins|minute|minutes)\b/);
  if (range) {
    const n = parseInt(range[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  const hr = t.match(/(\d+)\s*(hour|hours|hr|hrs)\b/);
  if (hr) {
    const n = parseInt(hr[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(180, n * 60);
  }

  const m = t.match(/(\d+)\s*(min|mins|minute|minutes|m)\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  return null;
}

function sectionLabel(text) {
  // Avoid "badge" UI to comply with GOVERNANCE.md
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
}

/**
 * Auto-fill rule:
 * - Never overwrite a non-empty user step.
 * - If source provides a target step, fill that step if empty.
 * - If target step is not available (locked), we still fill text, but the lock rules remain.
 * - Option B routing: prefer opening Step 2 (Act) after Stabilize sources and Move Forward sources.
 */
function prefillFromIntent(state, stabilizedToday, intentObj) {
  const payload = intentObj?.payload && typeof intentObj.payload === "object" ? intentObj.payload : null;
  if (!payload) return { state, focusStep: null };

  const focusStep = payload.focusStep === 1 || payload.focusStep === 2 || payload.focusStep === 3 ? payload.focusStep : null;

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const target = payload.targetStep === 1 || payload.targetStep === 2 || payload.targetStep === 3 ? payload.targetStep : null;

  // Optional: if plan is blank and a template is suggested
  const suggestedTemplateId = typeof payload.templateId === "string" ? payload.templateId : "";
  if (isBlankPlan(state) && suggestedTemplateId) {
    const t = getTemplateById(suggestedTemplateId);
    if (t) {
      state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };
    }
  }

  if (text && target) {
    const key = target === 1 ? "a" : target === 2 ? "b" : "c";
    const current = String(state[key] || "").trim();
    if (!current) {
      state = { ...state, [key]: text, template: state.template && state.template !== "custom" ? "custom" : state.template || "custom" };
    }
  }

  // Optional invisible advance marker (only upward)
  const advanceTo = Number(payload.advanceToStep || 0);
  if (Number.isFinite(advanceTo) && advanceTo > 0) {
    state = { ...state, doneStep: Math.max(state.doneStep || 0, Math.min(3, advanceTo)) };
  }

  // Choose focus
  if (focusStep) return { state, focusStep };

  // Default focus logic (Option B)
  // If coming from stabilize/move sources, prefer Step 2 if available.
  if (payload.defaultToStep === 1 || payload.defaultToStep === 2 || payload.defaultToStep === 3) {
    return { state, focusStep: payload.defaultToStep };
  }

  // If stabilized today, Step 2 is often the right “Act” door
  if (stabilizedToday) return { state, focusStep: 2 };

  return { state, focusStep: null };
}

export function renderTodayPlan() {
  const wrap = el("div", { class: "flowShell" });
  let state = readState();

  // timer state
  let running = false;
  let activeStep = 1; // 1..3
  let liveDurationMin = 10;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // UI state
  // idle | running | window_end
  let mode = "idle";
  let stopElapsedSec = 0;

  // plan type panel (collapsed)
  let showTemplates = false;

  // handoff / credit
  const rawIntent = consumeNextIntent();
  const stabilizedToday = (() => {
    try {
      return hasStabilizeCreditToday();
    } catch {
      return false;
    }
  })();

  // Always template-based by default unless user already has content
  if (isBlankPlan(state)) {
    const defaultId = pickDefaultTemplateId(stabilizedToday);
    const t = getTemplateById(defaultId);
    if (t) {
      state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c };
      saveState(state);
    }
  } else {
    if (!state.template) {
      state = { ...state, template: "custom" };
      saveState(state);
    }
  }

  // --- intent parsing (string or object) ---
  let intentName = null;
  let intentPayload = null;
  if (rawIntent && typeof rawIntent === "object" && rawIntent.intent) {
    intentName = String(rawIntent.intent || "");
    intentPayload = rawIntent.payload || null;
  } else if (typeof rawIntent === "string") {
    intentName = rawIntent;
  }

  // Apply payload-based prefill (if present)
  if (intentName && intentPayload) {
    const { state: nextState, focusStep } = prefillFromIntent(state, stabilizedToday, { intent: intentName, payload: intentPayload });
    state = nextState;
    saveState(state);
    if (focusStep) activeStep = focusStep;
  }

  // Back-compat: Step 2 default view if stabilized or intent, without auto-marking Step 1
  if ((intentName === "today_plan_step2" || stabilizedToday) && state.doneStep < 1) {
    // Option B: Step 2 focus makes the flow feel natural after Stabilize
    activeStep = 2;
  }

  safeAppendLog({
    kind: "today_plan_open",
    when: nowISO(),
    build: BUILD,
    intent: intentName || null,
    stabilizedToday,
    template: state.template || null,
  });

  function stopTick() {
    if (tick) clearInterval(tick);
    tick = null;
  }

  function stepText(n) {
    const a = (state.a || "").trim();
    const b = (state.b || "").trim();
    const c = (state.c || "").trim();
    if (n === 1) return a;
    if (n === 2) return b;
    return c;
  }

  // Step 2 allowed if Step 1 advanced OR stabilizedToday
  function canStartStep(n) {
    if (n === 1) return true;
    if (n === 2) return state.doneStep >= 1 || stabilizedToday;
    if (n === 3) return state.doneStep >= 2;
    return false;
  }

  function remainingMs() {
    return clamp(endAt - Date.now(), 0, liveDurationMin * 60 * 1000);
  }

  function updateTimerUI() {
    const readout = wrap.querySelector("[data-timer-readout]");
    if (readout) readout.textContent = formatMMSS(remainingMs());
  }

  function markStepAdvanced() {
    // invisible marker only
    state.doneStep = Math.max(state.doneStep, activeStep);
    saveState(state);
  }

  function startTimerForStep() {
    const txt = stepText(activeStep);
    if (!txt) return;
    if (!canStartStep(activeStep)) return;

    liveDurationMin = detectMinutes(txt) ?? 10;

    // Token behavior: starting counts
    grantToken();

    running = true;
    mode = "running";
    stopElapsedSec = 0;
    startAt = Date.now();
    endAt = Date.now() + liveDurationMin * 60 * 1000;

    safeAppendLog({
      kind: "today_plan_step_start",
      when: nowISO(),
      template: state.template || "custom",
      minutes: liveDurationMin,
      step: activeStep,
      stepText: txt,
      build: BUILD,
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      if (endAt - Date.now() <= 0) {
        stopTick();
        running = false;

        // Token behavior: window ending counts
        grantToken();
        markStepAdvanced();

        safeAppendLog({
          kind: "today_plan_step_window_end",
          when: nowISO(),
          template: state.template || "custom",
          minutesPlanned: liveDurationMin,
          step: activeStep,
          build: BUILD,
        });

        mode = "window_end";
        rerender();
      } else {
        updateTimerUI();
      }
    }, 250);

    rerender();
  }

  function stopEarly() {
    const now = Date.now();
    const elapsedMs = startAt ? clamp(now - startAt, 0, liveDurationMin * 60 * 1000) : 0;

    stopTick();
    running = false;

    stopElapsedSec = Math.max(0, Math.round(elapsedMs / 1000));

    // Token behavior: early stop counts
    grantToken();
    markStepAdvanced();

    safeAppendLog({
      kind: "today_plan_step_stop",
      when: nowISO(),
      template: state.template || "custom",
      minutesPlanned: liveDurationMin,
      elapsedSec: stopElapsedSec,
      step: activeStep,
      build: BUILD,
    });

    mode = "window_end";
    rerender();
  }

  function applyTemplate(t) {
    // Switching template resets progress (clean mental model)
    state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };
    saveState(state);

    activeStep = 1;
    showTemplates = false;
    mode = "idle";
    stopTick();
    running = false;
    rerender();
  }

  function resetPlan() {
    state = { template: "", a: "", b: "", c: "", doneStep: 0 };

    const defaultId = pickDefaultTemplateId(stabilizedToday);
    const t = getTemplateById(defaultId);
    if (t) state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };

    saveState(state);

    activeStep = 1;
    showTemplates = false;
    mode = "idle";
    stopTick();
    running = false;
    rerender();
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today’s Plan"]),
        el("p", { class: "p" }, ["Three steps only. One window at a time."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
        stabilizedToday && state.doneStep < 1 ? el("div", { class: "small" }, ["Stabilized today ✓ (Step 2 available)"]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function mergedPlanCard() {
    const currentLabel =
      state.template && state.template !== "custom"
        ? getTemplateById(state.template)?.label || "Template"
        : "Custom";

    const lock2 = !canStartStep(2);
    const lock3 = !canStartStep(3);

    function stepInput(label, key, locked) {
      return el("div", { class: "flowShell" }, [
        el("div", { class: "small" }, [label]),
        el("input", {
          value: state[key],
          placeholder: locked ? "Locked…" : "Small + concrete… (add “10 min” to auto-set)",
          disabled: locked ? true : false,
          style:
            "width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);opacity:" +
            (locked ? "0.65" : "1") +
            ";",
          onInput: (e) => {
            state[key] = e.target.value;
            if (state.template && state.template !== "custom") state.template = "custom";
            saveState(state);
          },
        }),
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Plan"),
      el("p", { class: "small" }, [`Type: ${currentLabel}`]),
      el("div", { class: "btnRow" }, [
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              showTemplates = !showTemplates;
              rerender();
            },
          },
          [showTemplates ? "Hide templates" : "Change template"]
        ),
        el("button", { class: "btn", type: "button", onClick: resetPlan }, ["Reset plan"]),
      ]),
      showTemplates
        ? el("div", { class: "flowShell", style: "margin-top:10px" }, [
            el("p", { class: "small" }, ["Switching template resets step progress."]),
            el(
              "div",
              { class: "btnRow" },
              TEMPLATES.map((t) => el("button", { class: "btn", type: "button", onClick: () => applyTemplate(t) }, [t.label]))
            ),
          ])
        : null,
      el("div", { style: "height:10px" }, []),
      stepInput("Step 1", "a", false),
      stepInput("Step 2", "b", lock2),
      stepInput("Step 3", "c", lock3),
      el("p", { class: "small" }, ["Rule: if it doesn’t fit in 3 steps, it’s not for today."]),
    ].filter(Boolean));
  }

  function actionCard() {
    const currentText = stepText(activeStep);
    const autoMin = detectMinutes(currentText) ?? 10;

    const stepButtons = el("div", { class: "btnRow" }, [
      el(
        "button",
        {
          class: `btn ${activeStep === 1 ? "btnPrimary" : ""}`.trim(),
          type: "button",
          onClick: () => {
            activeStep = 1;
            mode = "idle";
            rerender();
          },
        },
        ["Step 1"]
      ),
      el(
        "button",
        {
          class: `btn ${activeStep === 2 ? "btnPrimary" : ""}`.trim(),
          type: "button",
          onClick: () => {
            activeStep = 2;
            mode = "idle";
            rerender();
          },
          disabled: canStartStep(2) ? false : true,
        },
        ["Step 2"]
      ),
      el(
        "button",
        {
          class: `btn ${activeStep === 3 ? "btnPrimary" : ""}`.trim(),
          type: "button",
          onClick: () => {
            activeStep = 3;
            mode = "idle";
            rerender();
          },
          disabled: canStartStep(3) ? false : true,
        },
        ["Step 3"]
      ),
    ]);

    // Card “flips” based on mode (Start -> Active -> Next step)
    if (mode === "running") {
      return el("div", { class: "card cardPad" }, [
        sectionLabel(`Active • Step ${activeStep}`),
        el("div", { class: "timerBox" }, [
          el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remainingMs())]),
          el("div", { class: "btnRow" }, [
            el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
          ]),
        ]),
      ]);
    }

    if (mode === "window_end") {
      const nextStep = Math.min(3, activeStep + 1);
      const hasNext = activeStep < 3;
      const line = stopElapsedSec > 0 ? `Window closed (${stopElapsedSec}s).` : "Window closed.";

      return el("div", { class: "card cardPad" }, [
        sectionLabel("Next step"),
        el("p", { class: "p" }, [line]),
        el("div", { class: "btnRow" }, [
          hasNext
            ? el(
                "button",
                {
                  class: "btn btnPrimary",
                  type: "button",
                  onClick: () => {
                    activeStep = nextStep;
                    mode = "idle";
                    stopElapsedSec = 0;
                    rerender();
                  },
                },
                [`Step ${nextStep}`]
              )
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),
        ]),
      ]);
    }

    // idle
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Start"),
      stepButtons,
      el("p", { class: "p", style: "margin-top:8px;font-weight:900;" }, [currentText ? currentText : "Add text to this step above."]),
      currentText
        ? el("p", { class: "small", style: "margin-top:8px" }, [`Timer: ${autoMin} min (auto)`])
        : el("p", { class: "small", style: "margin-top:8px" }, ["Timer: 10 min default (add a time to override)."]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: startTimerForStep,
          disabled: !(currentText && canStartStep(activeStep)) || running,
        }, ["Start Step"]),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(mergedPlanCard());
    wrap.appendChild(actionCard());
    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
