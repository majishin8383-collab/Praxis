// js/zones/green/todayPlan.js  (FULL REPLACEMENT)
import { appendLog, consumeNextIntent, hasStabilizeCreditToday } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-17";

// ✅ Must match Next Step + Move Forward + Router
const KEY_PRIMARY = "praxis_today_plan_v5";
// Back-compat in case older saves exist
const KEY_FALLBACK = "praxis_today_plan_v6";

// Non-visible internal completion marker threshold
const MIN_ENGAGE_SEC = 60;

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

function normalizeState(s) {
  const doneStep = Number(s?.doneStep);
  const progressStep = Number(s?.progressStep);

  return {
    template: s?.template || "",
    a: s?.a || "",
    b: s?.b || "",
    c: s?.c || "",
    // "doneStep" kept for back-compat + reporting, but not used for unlocking anymore
    doneStep: Number.isFinite(doneStep) ? doneStep : 0,
    // NEW: internal non-visible completion marker for unlocking
    progressStep: Number.isFinite(progressStep) ? progressStep : 0,
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
  return { template: "", a: "", b: "", c: "", doneStep: 0, progressStep: 0 };
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

// ✅ FIX: support "2-min Calm" (hyphen shorthand) + existing formats
function detectMinutes(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();

  // 1) Hyphen shorthand: "2-min", "5-min"
  const hyphen = t.match(/(\d+)\s*-\s*(min|mins|minute|minutes)\b/);
  if (hyphen) {
    const n = parseInt(hyphen[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  // 2) Ranges: "10–25 min"
  const range = t.match(/(\d+)\s*[–-]\s*(\d+)\s*(min|mins|minute|minutes)\b/);
  if (range) {
    const n = parseInt(range[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  // 3) Hours
  const hr = t.match(/(\d+)\s*(hour|hours|hr|hrs)\b/);
  if (hr) {
    const n = parseInt(hr[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(180, n * 60);
  }

  // 4) Plain minutes: "2 min", "5 minutes"
  const m = t.match(/(\d+)\s*(min|mins|minute|minutes|m)\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  return null;
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
  let statusMode = "idle"; // idle | running | stopped_early | time_complete | offer_continue | logged
  let lastOutcome = null; // done | not_yet | null
  let stopElapsedSec = 0;

  // plan type panel (collapsed)
  let showTemplates = false;

  // handoff / credit
  const intent = consumeNextIntent();
  const stabilizedToday = hasStabilizeCreditToday();

  // ✅ Always template-based by default unless user already has content
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

  // Step 2 default view if stabilized or intent, without auto-marking Step 1
  if ((intent === "today_plan_step2" || stabilizedToday) && (state.progressStep || 0) < 1) {
    activeStep = 2;
  }

  safeAppendLog({
    kind: "today_plan_open",
    when: nowISO(),
    build: BUILD,
    intent: intent || null,
    stabilizedToday,
    template: state.template || null,
    doneStep: state.doneStep || 0,
    progressStep: state.progressStep || 0,
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

  // ✅ Unlock logic uses progressStep (non-visible internal marker)
  function canStartStep(n) {
    const p = Number(state.progressStep || 0);
    if (n === 1) return true;
    if (n === 2) return p >= 1 || stabilizedToday;
    if (n === 3) return p >= 2;
    return false;
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, liveDurationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (liveDurationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function markProgress(stepN, reason, elapsedSecForLog) {
    const before = Number(state.progressStep || 0);
    const after = Math.max(before, stepN);
    if (after !== before) {
      state.progressStep = after;
      saveState(state);
    }
    safeAppendLog({
      kind: "today_plan_progress",
      when: nowISO(),
      build: BUILD,
      step: stepN,
      reason, // "timer_complete" | "early_stop_threshold"
      elapsedSec: elapsedSecForLog ?? null,
      progressStepBefore: before,
      progressStepAfter: after,
      template: state.template || "custom",
    });
  }

  function startTimerForStep() {
    const txt = stepText(activeStep);
    if (!txt) return;
    if (!canStartStep(activeStep)) return;

    liveDurationMin = detectMinutes(txt) ?? 10;

    running = true;
    lastOutcome = null;
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
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;

        // ✅ Non-visible completion marker: timer finished => progress unlocks
        markProgress(activeStep, "timer_complete", liveDurationMin * 60);

        statusMode = "time_complete";
        rerender();
      } else {
        updateTimerUI();
      }
    }, 250);

    statusMode = "running";
    rerender();
  }

  function continueAfterNotYet(extraMin) {
    liveDurationMin = Math.max(1, extraMin);
    running = true;
    startAt = Date.now();
    endAt = Date.now() + liveDurationMin * 60 * 1000;

    safeAppendLog({
      kind: "today_plan_continue_start",
      when: nowISO(),
      template: state.template || "custom",
      minutes: liveDurationMin,
      step: activeStep,
      stepText: stepText(activeStep),
      build: BUILD,
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;

        // ✅ timer finished => progress unlocks (again harmless)
        markProgress(activeStep, "timer_complete", liveDurationMin * 60);

        statusMode = "time_complete";
        rerender();
      } else {
        updateTimerUI();
      }
    }, 250);

    statusMode = "running";
    rerender();
  }

  function stopEarly() {
    const now = Date.now();
    const elapsedMs = startAt ? clamp(now - startAt, 0, liveDurationMin * 60 * 1000) : 0;

    stopTick();
    running = false;
    stopElapsedSec = Math.max(0, Math.round(elapsedMs / 1000));

    safeAppendLog({
      kind: "today_plan_step_stop",
      when: nowISO(),
      template: state.template || "custom",
      minutesPlanned: liveDurationMin,
      elapsedSec: stopElapsedSec,
      step: activeStep,
      build: BUILD,
    });

    // ✅ Non-visible completion marker: if they engaged meaningfully, unlock next
    if (stopElapsedSec >= MIN_ENGAGE_SEC) {
      markProgress(activeStep, "early_stop_threshold", stopElapsedSec);
    }

    statusMode = "stopped_early";
    rerender();
  }

  function logStep(result) {
    lastOutcome = result;
    safeAppendLog({
      kind: "today_plan_step",
      when: nowISO(),
      template: state.template || "custom",
      step: activeStep,
      stepText: stepText(activeStep),
      minutes: liveDurationMin,
      result, // "done" | "not_yet"
      build: BUILD,
    });
  }

  function applyTemplate(t) {
    // Switching template resets progress (clean mental model)
    state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0, progressStep: 0 };
    saveState(state);
    activeStep = 1;
    statusMode = "idle";
    showTemplates = false;
    rerender();
  }

  function resetPlan() {
    // Reset = re-seed default template (never blank)
    state = { template: "", a: "", b: "", c: "", doneStep: 0, progressStep: 0 };
    const defaultId = pickDefaultTemplateId(stabilizedToday);
    const t = getTemplateById(defaultId);
    if (t) state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0, progressStep: 0 };
    saveState(state);
    activeStep = 1;
    statusMode = "idle";
    rerender();
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today’s Plan"]),
        el("p", { class: "p" }, ["Three steps only. Do one step at a time."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
        stabilizedToday && (state.progressStep || 0) < 1 ? el("div", { class: "small" }, ["Stabilized today ✓ (Step 2 available)"]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function planTypeCard() {
    const currentLabel =
      state.template && state.template !== "custom"
        ? getTemplateById(state.template)?.label || "Template"
        : "Custom";

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Plan type"]),
      el("p", { class: "small" }, [`Current: ${currentLabel}`]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { showTemplates = !showTemplates; rerender(); },
        }, [showTemplates ? "Hide" : "Change template"]),
        el("button", { class: "btn", type: "button", onClick: resetPlan }, ["Reset plan"]),
      ]),
      showTemplates
        ? el("div", { class: "flowShell", style: "margin-top:10px" }, [
            el("div", { class: "badge" }, ["Templates"]),
            el("p", { class: "small" }, ["Switching template resets step progress (clean slate)."]),
            el("div", { class: "btnRow" }, TEMPLATES.map((t) =>
              el("button", { class: "btn", type: "button", onClick: () => applyTemplate(t) }, [t.label])
            )),
          ])
        : null,
    ].filter(Boolean));
  }

  function stepInput(label, key, locked) {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "small" }, [label]),
      el("input", {
        value: state[key],
        placeholder: locked ? "Locked until previous step is unlocked…" : "Small + concrete… (add “10 min” to auto-set timer)",
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

  function planCard() {
    const lock2 = !canStartStep(2);
    const lock3 = !canStartStep(3);
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Your 3 steps"]),
      stepInput("Step 1", "a", false),
      stepInput("Step 2", "b", lock2),
      stepInput("Step 3", "c", lock3),
      el("p", { class: "small" }, ["Rule: if it doesn’t fit in 3 steps, it’s not for today."]),
    ]);
  }

  function primaryActionCard() {
    const currentText = stepText(activeStep);
    const autoMin = detectMinutes(currentText) ?? 10;

    const stepButtons = el("div", { class: "btnRow" }, [
      el("button", {
        class: `btn ${activeStep === 1 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 1; statusMode = "idle"; rerender(); },
      }, ["Step 1"]),
      el("button", {
        class: `btn ${activeStep === 2 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 2; statusMode = "idle"; rerender(); },
        disabled: canStartStep(2) ? false : true,
      }, ["Step 2"]),
      el("button", {
        class: `btn ${activeStep === 3 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 3; statusMode = "idle"; rerender(); },
        disabled: canStartStep(3) ? false : true,
      }, ["Step 3"]),
    ]);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Do this now"]),
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
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
      ]),
    ]);
  }

  function timerCard() {
    if (!running) return null;
    const remaining = clamp(endAt - Date.now(), 0, liveDurationMin * 60 * 1000);
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Step ${activeStep} • ${liveDurationMin} min`]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        el("div", { class: "progressBar" }, [
          el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function statusCard() {
    if (statusMode === "stopped_early") {
      const engagedEnough = stopElapsedSec >= MIN_ENGAGE_SEC;
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [
          engagedEnough
            ? `You engaged for ${stopElapsedSec}s. You can move to the next step.`
            : `You worked for ${stopElapsedSec}s. Change state, then try again.`,
        ]),
        engagedEnough
          ? el("div", { class: "btnRow" }, [
              el("button", {
                class: "btn btnPrimary",
                type: "button",
                onClick: () => {
                  const next = Math.min(3, activeStep + 1);
                  activeStep = next;
                  statusMode = "idle";
                  rerender();
                },
              }, ["Next step"]),
              el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
            ])
          : el("div", { class: "btnRow" }, [
              el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
              el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
              el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),
            ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    if (statusMode === "time_complete") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Time complete"]),
        el("p", { class: "p" }, ["Did you complete the step (or move it forward enough)?"]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => {
              logStep("done");
              // keep doneStep for reporting/back-compat
              state.doneStep = Math.max(state.doneStep || 0, activeStep);
              saveState(state);
              statusMode = "logged";
              rerender();
            },
          }, ["Yes"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              logStep("not_yet");
              statusMode = "offer_continue";
              rerender();
            },
          }, ["Not yet"]),
        ]),
      ]);
    }

    if (statusMode === "offer_continue") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Not yet"]),
        el("p", { class: "p" }, ["Pick one: continue briefly, or change state."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => continueAfterNotYet(5) }, ["Continue 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => continueAfterNotYet(10) }, ["Continue 10 min"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    if (statusMode === "logged") {
      const good = lastOutcome === "done";
      const nextStep = Math.min(3, activeStep + 1);
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [
          good ? (activeStep < 3 ? `Go to Step ${nextStep}.` : "Plan complete. Reset or choose a new direction.") : "Change state, then try again.",
        ]),
        el("div", { class: "btnRow" }, [
          activeStep < 3
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => { activeStep = nextStep; statusMode = "idle"; rerender(); } }, [`Step ${nextStep}`])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    return null;
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(planTypeCard());
    wrap.appendChild(planCard());
    wrap.appendChild(primaryActionCard());

    const t = timerCard();
    if (t) wrap.appendChild(t);

    const s = statusCard();
    if (s) wrap.appendChild(s);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
