import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-6";
const KEY = "praxis_today_plan_v5"; // keep same key so users don't lose their saved plan

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
function safeAppendLog(entry) { try { appendLog(entry); } catch {} }

function readState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return { template: "", a: "", b: "", c: "", doneStep: 0 };
    }
    const s = JSON.parse(raw);
    return {
      template: s.template || "",
      a: s.a || "",
      b: s.b || "",
      c: s.c || "",
      doneStep: Number.isFinite(s.doneStep) ? s.doneStep : 0,
    };
  } catch {
    return { template: "", a: "", b: "", c: "", doneStep: 0 };
  }
}

function saveState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

const TEMPLATES = [
  { id: "stability", label: "Stability", a: "2-min Calm", b: "5-min walk / movement", c: "One small maintenance task" },
  { id: "maintenance", label: "Maintenance", a: "Clean one area (10 min)", b: "Reply to one important thing", c: "Prep tomorrow (5 min)" },
  { id: "progress", label: "Progress", a: "Start the hard task (25 min)", b: "Continue or finish (10–25 min)", c: "Quick wrap-up / tidy (5 min)" },
  { id: "recovery", label: "Recovery", a: "Eat / hydrate", b: "Shower or reset body", c: "Early night / low stimulation" },
];

export function renderTodayPlan() {
  const wrap = el("div", { class: "flowShell" });

  let state = readState();

  // Timer state
  let running = false;
  let timerMode = "step"; // "step" | "plan"
  let activeStep = 1;     // 1..3
  let durationMin = 10;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // UI state
  let showRefine = false;   // collapsed by default
  let statusMode = "idle";  // idle | running | checkout | logged | early_stop
  let stoppedEarly = false;
  let earlyStopElapsedSec = 0;
  let earlyStopReason = null; // safe | bailed | null
  let lastOutcome = null; // done | stuck | set | unclear | null

  safeAppendLog({ kind: "today_plan_open", when: nowISO(), build: BUILD });

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function steps() {
    return {
      a: (state.a || "").trim(),
      b: (state.b || "").trim(),
      c: (state.c || "").trim(),
    };
  }

  function stepText(n) {
    const s = steps();
    if (n === 1) return s.a;
    if (n === 2) return s.b;
    return s.c;
  }

  function canStartStep(n) {
    if (n === 1) return true;
    if (n === 2) return state.doneStep >= 1;
    if (n === 3) return state.doneStep >= 2;
    return false;
  }

  function goalLine() {
    if (activeStep === 1) return "Goal: Step 1 only.";
    if (activeStep === 2) return "Goal: Step 2 only.";
    return "Goal: Step 3 only.";
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function startTimer(mode) {
    const s = steps();
    const any = !!(s.a || s.b || s.c);
    if (!any) return;

    if (mode === "step") {
      const t = stepText(activeStep);
      if (!t) return;
      if (!canStartStep(activeStep)) return;
    }

    running = true;
    timerMode = mode;

    stoppedEarly = false;
    earlyStopElapsedSec = 0;
    earlyStopReason = null;
    lastOutcome = null;

    startAt = Date.now();
    endAt = Date.now() + durationMin * 60 * 1000;

    safeAppendLog({
      kind: mode === "plan" ? "today_plan_plan_start" : "today_plan_step_start",
      when: nowISO(),
      template: state.template || "custom",
      minutes: durationMin,
      step: mode === "step" ? activeStep : null,
      stepText: mode === "step" ? stepText(activeStep) : null,
      build: BUILD
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        statusMode = "checkout";
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
    const elapsedMs = startAt ? clamp(now - startAt, 0, durationMin * 60 * 1000) : 0;
    const remainingMs = clamp(endAt - now, 0, durationMin * 60 * 1000);

    stopTick();
    running = false;

    stoppedEarly = true;
    earlyStopElapsedSec = Math.max(0, Math.round(elapsedMs / 1000));
    earlyStopReason = null;

    safeAppendLog({
      kind: timerMode === "plan" ? "today_plan_plan_stop" : "today_plan_step_stop",
      when: nowISO(),
      template: state.template || "custom",
      minutesPlanned: durationMin,
      elapsedSec: Math.round(elapsedMs / 1000),
      remainingSec: Math.round(remainingMs / 1000),
      step: timerMode === "step" ? activeStep : null,
      build: BUILD
    });

    statusMode = "early_stop";
    rerender();
  }

  function applyTemplate(t) {
    state = { ...state, template: t.id, a: t.a, b: t.b, c: t.c };
    saveState(state);
    statusMode = "idle";
    rerender();
  }

  function clearAll() {
    state = { template: "", a: "", b: "", c: "", doneStep: 0 };
    saveState(state);
    statusMode = "idle";
    rerender();
  }

  function logPlan(outcome) {
    lastOutcome = outcome;
    safeAppendLog({
      kind: "today_plan",
      when: nowISO(),
      template: state.template || "custom",
      steps: { a: state.a, b: state.b, c: state.c },
      outcome,
      build: BUILD
    });
  }

  function logStep(result) {
    lastOutcome = result;
    safeAppendLog({
      kind: "today_plan_step",
      when: nowISO(),
      template: state.template || "custom",
      step: activeStep,
      stepText: stepText(activeStep),
      minutes: durationMin,
      result,
      stoppedEarly,
      earlyStopReason,
      earlyStopElapsedSec,
      build: BUILD
    });
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today’s Plan"]),
        el("p", { class: "p" }, ["Three steps only. Start Step 1."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function templatesCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Templates"]),
      el("p", { class: "small" }, ["Tap to fill. Then keep it small."]),
      el("div", { class: "btnRow" }, TEMPLATES.map(t =>
        el("button", { class: "btn", type: "button", onClick: () => applyTemplate(t) }, [t.label])
      )),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: clearAll }, ["Clear"]),
      ]),
    ]);
  }

  function stepInput(label, key, locked) {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "small" }, [label]),
      el("input", {
        value: state[key],
        placeholder: locked ? "Locked until previous step is done…" : "Small + concrete…",
        disabled: locked ? "true" : null,
        style:
          "width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);opacity:" +
          (locked ? "0.65" : "1") +
          ";",
        onInput: (e) => {
          state[key] = e.target.value;
          saveState(state);
        }
      }, [])
    ]);
  }

  function planCard() {
    const lock2 = state.doneStep < 1;
    const lock3 = state.doneStep < 2;

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

    const stepButtons = el("div", { class: "btnRow" }, [
      el("button", {
        class: `btn ${activeStep === 1 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 1; rerender(); }
      }, ["Step 1"]),
      el("button", {
        class: `btn ${activeStep === 2 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 2; rerender(); },
        disabled: canStartStep(2) ? null : "true"
      }, ["Step 2"]),
      el("button", {
        class: `btn ${activeStep === 3 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 3; rerender(); },
        disabled: canStartStep(3) ? null : "true"
      }, ["Step 3"]),
    ]);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Do this now"]),
      stepButtons,
      el("p", { class: "p", style: "margin-top:8px;font-weight:900;" }, [
        currentText ? currentText : "Add text to this step above."
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 5; rerender(); } }, ["5 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 10; rerender(); } }, ["10 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 25; rerender(); } }, ["25 min"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: () => startTimer("step"),
          disabled: (currentText && canStartStep(activeStep)) ? null : "true"
        }, ["Start Step"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
      ]),
      el("p", { class: "small", style: "margin-top:10px" }, [goalLine()])
    ]);
  }

  function refineCard() {
    const s = steps();
    const any = !!(s.a || s.b || s.c);

    if (!showRefine) {
      return el("div", { class: "card cardPad" }, [
        el("button", { class: "btn", type: "button", onClick: () => { showRefine = true; rerender(); } }, ["Need to refine? (optional)"])
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Refine (optional)"]),
      el("p", { class: "small" }, ["Short sprint to tighten the 3 steps. Then start Step 1."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 3; rerender(); } }, ["3 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 5; rerender(); } }, ["5 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 10; rerender(); } }, ["10 min"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { timerMode = "plan"; startTimer("plan"); },
          disabled: any ? null : "true"
        }, ["Start refine sprint"]),
        el("button", { class: "btn", type: "button", onClick: () => { showRefine = false; rerender(); } }, ["Hide"])
      ])
    ]);
  }

  function timerCard() {
    if (!running) return null;

    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const title = timerMode === "plan" ? "Refine Sprint" : `Step ${activeStep} Sprint`;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`${title} • ${durationMin} min`]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        el("div", { class: "progressBar" }, [
          el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ])
    ]);
  }

  function statusCard() {
    if (statusMode === "early_stop") {
      const label = timerMode === "plan" ? "refining" : "working";
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You were ${label} for ${earlyStopElapsedSec}s. Why are you stopping?`]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { earlyStopReason = "safe"; statusMode = "checkout"; rerender(); }
          }, ["Enough for now"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              earlyStopReason = "bailed";
              if (timerMode === "plan") logPlan("unclear");
              else logStep("stuck");
              statusMode = "logged";
              rerender();
            }
          }, ["Still stuck / avoiding it"]),
        ]),
      ]);
    }

    if (statusMode === "checkout") {
      if (timerMode === "plan") {
        return el("div", { class: "card cardPad" }, [
          el("div", { class: "badge" }, ["Check-out"]),
          el("p", { class: "p" }, ["Is the plan set enough to do Step 1?"]),
          el("div", { class: "btnRow" }, [
            el("button", { class: "btn btnPrimary", type: "button", onClick: () => { logPlan("set"); statusMode = "logged"; rerender(); } }, ["Plan is set"]),
            el("button", { class: "btn", type: "button", onClick: () => { logPlan("unclear"); statusMode = "logged"; rerender(); } }, ["Still unclear"]),
          ]),
        ]);
      }

      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, [`Step ${activeStep} check-out`]),
        el("p", { class: "p" }, ["Did you complete the step (or move it forward enough)?"]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => {
              logStep("done");
              state.doneStep = Math.max(state.doneStep, activeStep);
              saveState(state);
              statusMode = "logged";
              rerender();
            }
          }, ["Done"]),
          el("button", { class: "btn", type: "button", onClick: () => { logStep("stuck"); statusMode = "logged"; rerender(); } }, ["Still stuck"]),
        ]),
      ]);
    }

    if (statusMode === "logged") {
      const wasPlan = timerMode === "plan";
      const good = lastOutcome === "done" || lastOutcome === "set";
      const stuck = lastOutcome === "stuck" || lastOutcome === "unclear";
      const nextStep = Math.min(3, activeStep + 1);

      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [
          good
            ? (wasPlan ? "Start Step 1." : (activeStep < 3 ? `Go to Step ${nextStep}.` : "Plan complete. Reset or choose a new direction."))
            : "Change state. Then try again."
        ]),
        el("div", { class: "btnRow" }, [
          good && !wasPlan && activeStep < 3
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => { activeStep = nextStep; statusMode = "idle"; rerender(); } }, [`Step ${nextStep}`])
            : good && wasPlan
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => { activeStep = 1; statusMode = "idle"; rerender(); } }, ["Step 1"])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),

          stuck
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/next") }, ["Find Next Step"]),

          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    return null;
  }

  function recentCard() {
    const log = readLog().filter(e => e.kind === "today_plan").slice(0, 4);
    if (!log.length) return null;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Recent plans"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [String(e.template || "custom")]),
          el("div", { class: "small" }, [`${new Date(e.when).toLocaleString()} • ${e.outcome === "set" ? "Plan set" : "Still unclear"}`]),
        ])
      )
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    wrap.appendChild(templatesCard());
    wrap.appendChild(planCard());
    wrap.appendChild(primaryActionCard());
    wrap.appendChild(refineCard());

    const t = timerCard();
    if (t) wrap.appendChild(t);

    const s = statusCard();
    if (s) wrap.appendChild(s);

    const r = recentCard();
    if (r) wrap.appendChild(r);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
