// js/zones/green/todayPlan.js (FULL REPLACEMENT)
import { appendLog, consumeNextIntent, hasStabilizeCreditToday } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-16";

// Storage key (keep stable)
const KEY_PRIMARY = "praxis_today_plan_v6";
const KEY_FALLBACK = "praxis_today_plan_v5";

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

function sectionLabel(text) {
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
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

// NOTE: removed the word "progress" (governance)
const TEMPLATES = [
  { id: "stability", label: "Stability", a: "2-min Calm", b: "5-min walk / movement", c: "One small maintenance task" },
  { id: "maintenance", label: "Maintenance", a: "Clean one area (10 min)", b: "Reply to one important thing", c: "Prep tomorrow (5 min)" },
  { id: "focus", label: "Focus", a: "Start the hard task (25 min)", b: "Continue (10–25 min)", c: "Quick wrap-up / tidy (5 min)" },
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
  // Subtle bias only; never shown as an achievement.
  return stabilizedToday ? "stability" : "focus";
}

function detectMinutes(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();

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
  // idle | running | stopped_early | time_complete | offer_continue | closed
  let statusMode = "idle";
  let stopElapsedSec = 0;
  let lastResult = null; // "done" | "stuck" | null
  let showTemplates = false;

  // handoff / credit
  const intent = consumeNextIntent();
  const stabilizedToday = hasStabilizeCreditToday();

  // Seed default plan if blank
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

  // Optional view bias: show Step 2 if stabilized or intent (does not mark Step 1 done)
  if ((intent === "today_plan_step2" || stabilizedToday) && state.doneStep < 1) {
    activeStep = 2;
  }

  safeAppendLog({
    kind: "today_plan_open",
    when: nowISO(),
    build: BUILD,
    intent: intent || null,
    stabilizedToday,
    template: state.template || null,
  });

  function stopTick() {
    if (tick) clearInterval(tick);
    tick = null;
  }

  function canStartStep(n) {
    if (n === 1) return true;
    if (n === 2) return state.doneStep >= 1 || stabilizedToday;
    if (n === 3) return state.doneStep >= 2;
    return false;
  }

  function stepText(n) {
    const a = (state.a || "").trim();
    const b = (state.b || "").trim();
    const c = (state.c || "").trim();
    if (n === 1) return a;
    if (n === 2) return b;
    return c;
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, liveDurationMin * 60 * 1000);
    const readout = wrap.querySelector("[data-timer-readout]");
    if (readout) readout.textContent = formatMMSS(remaining);
  }

  function startTimerForStep() {
    const txt = stepText(activeStep);
    if (!txt) return;

    if (!canStartStep(activeStep)) {
      statusMode = "idle";
      lastResult = null;
      rerender("That step opens after the previous step, or after Stabilize.");
      return;
    }

    liveDurationMin = detectMinutes(txt) ?? 10;
    running = true;
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
        statusMode = "time_complete";
        rerender();
      } else {
        updateTimerUI();
      }
    }, 250);

    statusMode = "running";
    rerender();
  }

  function continueAfterStuck(extraMin) {
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
      if (endAt - Date.now() <= 0) {
        stopTick();
        running = false;
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

    statusMode = "stopped_early";
    rerender();
  }

  function logStep(result) {
    lastResult = result;
    safeAppendLog({
      kind: "today_plan_step",
      when: nowISO(),
      template: state.template || "custom",
      step: activeStep,
      stepText: stepText(activeStep),
      minutes: liveDurationMin,
      result,
      build: BUILD,
    });
  }

  function applyTemplate(t) {
    // Switching template resets steps (clean mental model)
    state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };
    saveState(state);
    activeStep = 1;
    statusMode = "idle";
    showTemplates = false;
    rerender();
  }

  function resetPlan() {
    state = { template: "", a: "", b: "", c: "", doneStep: 0 };
    const defaultId = pickDefaultTemplateId(stabilizedToday);
    const t = getTemplateById(defaultId);
    if (t) state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };
    saveState(state);
    activeStep = 1;
    statusMode = "idle";
    rerender();
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today’s Plan"]),
        el("p", { class: "p" }, ["Three steps. One at a time."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
      ]),
    ]);
  }

  function planTypeCard() {
    const currentLabel =
      state.template && state.template !== "custom"
        ? getTemplateById(state.template)?.label || "Template"
        : "Custom";

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Plan type"),
      el("p", { class: "small" }, [`Current: ${currentLabel}`]),
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
          [showTemplates ? "Hide" : "Change template"]
        ),
        el("button", { class: "btn", type: "button", onClick: resetPlan }, ["Reset plan"]),
      ]),
      showTemplates
        ? el("div", { class: "flowShell", style: "margin-top:10px" }, [
            sectionLabel("Templates"),
            el("p", { class: "small" }, ["Switching template resets steps."]),
            el("div", { class: "btnRow" }, TEMPLATES.map((t) => el("button", { class: "btn", type: "button", onClick: () => applyTemplate(t) }, [t.label]))),
          ])
        : null,
    ].filter(Boolean));
  }

  function stepInput(label, key, locked) {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "small" }, [label]),
      el("input", {
        value: state[key],
        placeholder: locked ? "Opens after the previous step…" : "Small + concrete… (add “10 min” to auto-set timer)",
        disabled: false, // do not disable input; just guide
        style:
          "width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);",
        onInput: (e) => {
          // If step is locked, allow typing but it won't be startable until opened.
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
      sectionLabel("Your 3 steps"),
      stepInput("Step 1", "a", false),
      stepInput("Step 2", "b", lock2),
      stepInput("Step 3", "c", lock3),
      el("p", { class: "small" }, ["If it doesn’t fit in 3 steps, it’s not for today."]),
    ]);
  }

  function stepTabs() {
    function tab(n) {
      const locked = !canStartStep(n);
      const active = activeStep === n;
      return el(
        "button",
        {
          class: `btn ${active ? "btnPrimary" : ""}`.trim(),
          type: "button",
          onClick: () => {
            if (locked) {
              rerender(n === 2 ? "Step 2 opens after Step 1, or after Stabilize." : "Step 3 opens after Step 2.");
              return;
            }
            activeStep = n;
            statusMode = "idle";
            rerender();
          },
        },
        [`Step ${n}`]
      );
    }

    return el("div", { class: "btnRow" }, [tab(1), tab(2), tab(3)]);
  }

  function primaryActionCard() {
    const currentText = stepText(activeStep);
    const autoMin = detectMinutes(currentText) ?? 10;

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Current step"),
      stepTabs(),
      el("p", { class: "p", style: "margin-top:8px;font-weight:900;" }, [currentText ? currentText : "Add text to this step above."]),
      currentText
        ? el("p", { class: "small", style: "margin-top:8px" }, [`Timer: ${autoMin} min`])
        : el("p", { class: "small", style: "margin-top:8px" }, ["Timer: 10 min default (add a time to override)."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: startTimerForStep, disabled: !(currentText) || running }, ["Start"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
      ]),
    ]);
  }

  function timerCard() {
    if (!running) return null;
    const remaining = clamp(endAt - Date.now(), 0, liveDurationMin * 60 * 1000);

    return el("div", { class: "card cardPad" }, [
      sectionLabel(`Step ${activeStep} • ${liveDurationMin} min`),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        // progress bars intentionally removed per GOVERNANCE.md
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function statusCard(message) {
    if (message) {
      return el("div", { class: "card cardPad" }, [sectionLabel("Note"), el("p", { class: "p" }, [message])]);
    }

    if (statusMode === "stopped_early") {
      return el("div", { class: "card cardPad" }, [
        sectionLabel("Pause"),
        el("p", { class: "p" }, [`Some time happened (${stopElapsedSec}s).`]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    if (statusMode === "time_complete") {
      return el("div", { class: "card cardPad" }, [
        sectionLabel("Time ended"),
        el("p", { class: "p" }, ["Where did this land?"]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => {
              logStep("done");
              state.doneStep = Math.max(state.doneStep, activeStep);
              saveState(state);
              statusMode = "closed";
              rerender();
            },
          }, ["Enough for now"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              logStep("stuck");
              statusMode = "offer_continue";
              rerender();
            },
          }, ["Still stuck"]),
        ]),
      ]);
    }

    if (statusMode === "offer_continue") {
      return el("div", { class: "card cardPad" }, [
        sectionLabel("Still stuck"),
        el("p", { class: "p" }, ["Continue briefly, or change state."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => continueAfterStuck(5) }, ["Continue 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => continueAfterStuck(10) }, ["Continue 10 min"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    if (statusMode === "closed") {
      const nextStep = Math.min(3, activeStep + 1);
      const canNext = activeStep < 3 && canStartStep(nextStep);

      return el("div", { class: "card cardPad" }, [
        sectionLabel("Closure"),
        el("p", { class: "p" }, [activeStep < 3 ? "Next step is available when you want it." : "The plan can end here."]),
        el("div", { class: "btnRow" }, [
          canNext
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => { activeStep = nextStep; statusMode = "idle"; rerender(); } }, [`Step ${nextStep}`])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    return null;
  }

  function rerender(message) {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(planTypeCard());
    wrap.appendChild(planCard());
    wrap.appendChild(primaryActionCard());

    const t = timerCard();
    if (t) wrap.appendChild(t);

    const s = statusCard(message);
    if (s) wrap.appendChild(s);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
