/*!  
 * Praxis  
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/green/todayPlan.js (FULL REPLACEMENT)
import {
  appendLog,
  consumeNextIntent,
  hasStabilizeCreditToday,
  grantStabilizeCreditToday,
  setNextIntent,
} from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-23";

// ✅ Must match Router
const KEY_PRIMARY = "praxis_today_plan_v5";
const KEY_FALLBACK = "praxis_today_plan_v6";

// Move Forward → Step 3 unlock (day stamp)
const KEY_TP3_CREDIT_DAY = "praxis_today_plan_step3_credit_day_v1";

// Uses device-local day stamp.
function localDayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hasStep3CreditToday() {
  try {
    return localStorage.getItem(KEY_TP3_CREDIT_DAY) === localDayStamp();
  } catch {
    return false;
  }
}

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

function sectionLabel(text) {
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
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

/**
 * Templates (Light / Medium / Hard)
 * - Still read-only (no typing)
 * - Act (Step 2) + Move (Step 3) are meant to be overwritten by Move Forward ladder choices
 */
const TEMPLATES = [
  {
    id: "light",
    label: "Light",
    a: "2-min Calm",
    b: "Act: Water + light (3 min)",
    c: "Move: Walk + breathe (5 min)",
  },
  {
    id: "medium",
    label: "Medium",
    a: "2-min Calm",
    b: "Act: Micro-task (2 min)",
    c: "Move: Body reset (5 min)",
  },
  {
    id: "hard",
    label: "Hard",
    a: "2-min Calm",
    b: "Act: Clean 3 things (5 min)",
    c: "Move: Outside reset (7 min)",
  },
];

function getTemplateById(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}

function normalizeState(s) {
  const doneStep = Number(s?.doneStep);
  const template = String(s?.template || "");
  const t = getTemplateById(template) || getTemplateById("medium");

  return {
    template: t?.id || "medium",
    a: String(s?.a || t?.a || "2-min Calm"),
    b: String(s?.b || t?.b || "Act: Micro-task (2 min)"),
    c: String(s?.c || t?.c || "Move: Walk + breathe (5 min)"),
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
  return normalizeState({});
}

function saveState(s) {
  try {
    localStorage.setItem(KEY_PRIMARY, JSON.stringify(s));
  } catch {}
}

/**
 * ✅ FREE-TIER RULES (your current product decision):
 * - No typing/editing the plan (read-only UI).
 * - Move Forward selection MUST overwrite Step 2 or Step 3 every time.
 */
function forcePrefillFromIntent(state, stabilizedToday, intentObj) {
  const payload = intentObj?.payload && typeof intentObj.payload === "object" ? intentObj.payload : null;
  if (!payload) return { state, focusStep: null };

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const target =
    payload.targetStep === 1 || payload.targetStep === 2 || payload.targetStep === 3 ? payload.targetStep : null;
  const focusStep =
    payload.focusStep === 1 || payload.focusStep === 2 || payload.focusStep === 3 ? payload.focusStep : null;

  // ✅ FORCE overwrite every time for targetStep
  if (text && target) {
    const key = target === 1 ? "a" : target === 2 ? "b" : "c";
    state = { ...state, [key]: text };
  }

  // Optional invisible advance marker (only upward)
  const advanceTo = Number(payload.advanceDoneStep || 0);
  if (Number.isFinite(advanceTo) && advanceTo > 0) {
    state = { ...state, doneStep: Math.max(state.doneStep || 0, Math.min(3, advanceTo)) };
  }

  if (focusStep) return { state, focusStep };
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

  // templates panel
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

  const step3CreditToday = hasStep3CreditToday();

  // --- intent parsing (string or object) ---
  let intentName = null;
  let intentPayload = null;

  if (rawIntent && typeof rawIntent === "object" && rawIntent.intent) {
    intentName = String(rawIntent.intent || "");
    intentPayload = rawIntent.payload || null;
  } else if (typeof rawIntent === "string") {
    intentName = rawIntent;
  }

  // ✅ Apply payload-based prefill (FORCED overwrite)
  if (intentName && intentPayload) {
    const { state: nextState, focusStep } = forcePrefillFromIntent(state, stabilizedToday, {
      intent: intentName,
      payload: intentPayload,
    });
    state = nextState;
    saveState(state);
    if (focusStep) activeStep = focusStep;
  }

  // Default focus Step 2 if stabilized or legacy intentStep2
  if ((intentName === "today_plan_step2" || stabilizedToday) && state.doneStep < 1) {
    activeStep = 2;
  }

  safeAppendLog({
    kind: "today_plan_open",
    when: nowISO(),
    build: BUILD,
    intent: intentName || null,
    stabilizedToday,
    step3CreditToday,
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
  // Step 3 allowed if Step 2 advanced OR Move Forward credit today
  function canStartStep(n) {
    if (n === 1) return true;
    if (n === 2) return state.doneStep >= 1 || stabilizedToday;
    if (n === 3) return state.doneStep >= 2 || step3CreditToday;
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
    state.doneStep = Math.max(state.doneStep, activeStep);
    saveState(state);
  }

  function startTimerForStep() {
    const txt = stepText(activeStep);
    if (!txt) return;
    if (!canStartStep(activeStep)) return;

    liveDurationMin = detectMinutes(txt) ?? 10;

    grantToken();
    running = true;
    mode = "running";
    stopElapsedSec = 0;
    startAt = Date.now();
    endAt = Date.now() + liveDurationMin * 60 * 1000;

    safeAppendLog({
      kind: "today_plan_step_start",
      when: nowISO(),
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

        grantToken();
        markStepAdvanced();

        safeAppendLog({
          kind: "today_plan_step_window_end",
          when: nowISO(),
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

    grantToken();
    markStepAdvanced();

    safeAppendLog({
      kind: "today_plan_step_stop",
      when: nowISO(),
      minutesPlanned: liveDurationMin,
      elapsedSec: stopElapsedSec,
      step: activeStep,
      build: BUILD,
    });

    mode = "window_end";
    rerender();
  }

  function applyTemplate(t) {
    state = normalizeState({ template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 });
    saveState(state);
    activeStep = 1;
    showTemplates = false;
    mode = "idle";
    stopTick();
    running = false;
    rerender();
  }

  function resetStepsOnly() {
    state = { ...state, doneStep: 0 };
    saveState(state);
    activeStep = 1;
    mode = "idle";
    stopTick();
    running = false;
    rerender();
  }

  function resetPlan() {
    // Keep templates available; reset to default template
    state = normalizeState({ template: stabilizedToday ? "light" : "medium", doneStep: 0 });
    saveState(state);
    activeStep = 1;
    showTemplates = false;
    mode = "idle";
    stopTick();
    running = false;
    rerender();
  }

  function goPickFromMoveForward(tpStep) {
    // tpStep: 2 => Act, 3 => Move
    try {
      setNextIntent("move_forward_pick", { tpStep });
    } catch {}
    location.hash = "#/green/move";
  }

  function header() {
    const templateLabel = getTemplateById(state.template)?.label || "Template";
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today’s Plan"]),
        el("p", { class: "p" }, ["Three steps only. One window at a time."]),
        el("div", { class: "small" }, [`Plan style: ${templateLabel}`]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
        stabilizedToday && state.doneStep < 1 ? el("div", { class: "small" }, ["Stabilized today ✓ (Step 2 available)"]) : null,
        step3CreditToday && state.doneStep < 2 ? el("div", { class: "small" }, ["Moved forward today ✓ (Step 3 available)"]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  // ✅ Read-only plan UI (templates + move-forward links)
  function planCard() {
    const lock2 = !canStartStep(2);
    const lock3 = !canStartStep(3);

    function planRow(stepNum, value, locked) {
      const label = `Step ${stepNum}`;
      const isAct = stepNum === 2;
      const isMove = stepNum === 3;

      return el("div", { class: "flowShell" }, [
        el("div", { class: "small" }, [label]),
        el(
          "div",
          {
            class: "card",
            style:
              "padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);opacity:" +
              (locked ? "0.65" : "1") +
              ";",
          },
          [value || (locked ? "Locked…" : "—")]
        ),
        isAct
          ? el("div", { class: "btnRow", style: "margin-top:8px" }, [
              el(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onClick: () => goPickFromMoveForward(2),
                  disabled: lock2 ? true : false,
                },
                ["Pick an Act ladder"]
              ),
            ])
          : null,
        isMove
          ? el("div", { class: "btnRow", style: "margin-top:8px" }, [
              el(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onClick: () => goPickFromMoveForward(3),
                  disabled: lock3 ? true : false,
                },
                ["Pick a Move ladder"]
              ),
            ])
          : null,
      ].filter(Boolean));
    }

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Plan"),
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
        el("button", { class: "btn", type: "button", onClick: resetStepsOnly }, ["Reset steps"]),
        el("button", { class: "btn", type: "button", onClick: resetPlan }, ["Reset plan"]),
      ]),
      showTemplates
        ? el("div", { class: "flowShell", style: "margin-top:10px" }, [
            el("p", { class: "small" }, ["Template sets a starting plan. Move Forward ladders can overwrite Step 2 or 3 anytime."]),
            el(
              "div",
              { class: "btnRow" },
              TEMPLATES.map((t) =>
                el("button", { class: "btn", type: "button", onClick: () => applyTemplate(t) }, [t.label])
              )
            ),
          ])
        : null,
      el("div", { style: "height:10px" }, []),
      planRow(1, (state.a || "").trim(), false),
      planRow(2, (state.b || "").trim(), lock2),
      planRow(3, (state.c || "").trim(), lock3),
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

      // ✅ Ladder should lead to the next step: after a step window ends, default CTA is the next step.
      // If next step is 2 or 3, user can also jump to Move Forward to overwrite it.
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
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, [
                "Reset",
              ]),
          nextStep === 2
            ? el("button", { class: "btn", type: "button", onClick: () => goPickFromMoveForward(2) }, ["Pick Act ladder"])
            : null,
          nextStep === 3
            ? el("button", { class: "btn", type: "button", onClick: () => goPickFromMoveForward(3) }, ["Pick Move ladder"])
            : null,
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),
        ].filter(Boolean)),
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Start"),
      stepButtons,
      el("p", { class: "p", style: "margin-top:8px;font-weight:900;" }, [currentText || "—"]),
      el("p", { class: "small", style: "margin-top:8px" }, [`Timer: ${autoMin} min (auto)`]),
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
    wrap.appendChild(planCard());
    wrap.appendChild(actionCard());
    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
