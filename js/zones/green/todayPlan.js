import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-4";
const KEY = "praxis_today_plan_v4";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
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

function readPlan() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { a: "", b: "", c: "", template: "" };
    const p = JSON.parse(raw);
    return { a: p.a || "", b: p.b || "", c: p.c || "", template: p.template || "" };
  } catch {
    return { a: "", b: "", c: "", template: "" };
  }
}
function savePlan(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }

const TEMPLATES = [
  { id: "stability", label: "Stability", a: "2-min Calm", b: "5-min walk / movement", c: "One small maintenance task" },
  { id: "maintenance", label: "Maintenance", a: "Clean one area (10 min)", b: "Reply to one important thing", c: "Prep tomorrow (5 min)" },
  { id: "progress", label: "Progress", a: "Start the hard task (25 min)", b: "Continue or finish (10–25 min)", c: "Quick wrap-up / tidy (5 min)" },
  { id: "recovery", label: "Recovery", a: "Eat / hydrate", b: "Shower or reset body", c: "Early night / low stimulation" }
];

export function renderTodayPlan() {
  const wrap = el("div", { class: "flowShell" });

  // view modes
  // edit: templates + editor + start buttons
  // running_plan: planning sprint timer running
  // running_step: execution sprint timer running (Step 1/2/3)
  // early_stop: stopped early fork
  // checkout: end-of-sprint outcome (set / unclear or step done / still stuck)
  // routed: next move buttons
  let mode = "edit";

  let plan = readPlan();

  // timer state
  let running = false;
  let timerKind = "plan"; // "plan" | "step"
  let durationMin = 5;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // step sprint state
  let activeStep = 1; // 1..3
  let stepMinutes = 10; // default execution sprint length per step
  let lastStepResult = null; // "done" | "stuck" | null

  // early stop state
  let stoppedEarly = false;
  let earlyStopElapsedSec = 0;
  let earlyStopReason = null; // "safe" | "bailed" | null

  // plan outcome (at end of plan sprint)
  let planOutcome = null; // "set" | "unclear" | null

  safeAppendLog({ kind: "today_plan_open", when: nowISO(), build: BUILD });

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function nonEmptySteps() {
    const a = (plan.a || "").trim();
    const b = (plan.b || "").trim();
    const c = (plan.c || "").trim();
    return { a, b, c, any: !!(a || b || c) };
  }

  function getStepText(n) {
    if (n === 1) return (plan.a || "").trim();
    if (n === 2) return (plan.b || "").trim();
    return (plan.c || "").trim();
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function startTimer(kind) {
    const s = nonEmptySteps();
    if (!s.any) return;

    running = true;
    timerKind = kind;

    stoppedEarly = false;
    earlyStopElapsedSec = 0;
    earlyStopReason = null;

    startAt = Date.now();
    endAt = Date.now() + durationMin * 60 * 1000;

    safeAppendLog({
      kind: kind === "plan" ? "today_plan_sprint_start" : "today_plan_step_start",
      when: nowISO(),
      minutes: durationMin,
      template: plan.template || "custom",
      step: kind === "step" ? activeStep : null,
      stepText: kind === "step" ? getStepText(activeStep) : null,
      build: BUILD
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        mode = "checkout";
        rerender(mode);
      } else {
        updateTimerUI();
      }
    }, 250);

    mode = kind === "plan" ? "running_plan" : "running_step";
    rerender(mode);
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
      kind: timerKind === "plan" ? "today_plan_sprint_stop" : "today_plan_step_stop",
      when: nowISO(),
      minutesPlanned: durationMin,
      elapsedSec: Math.round(elapsedMs / 1000),
      remainingSec: Math.round(remainingMs / 1000),
      template: plan.template || "custom",
      step: timerKind === "step" ? activeStep : null,
      build: BUILD
    });

    mode = "early_stop";
    rerender(mode);
  }

  function applyTemplate(t) {
    plan = { ...plan, template: t.id, a: t.a, b: t.b, c: t.c };
    savePlan(plan);
    mode = "edit";
    rerender(mode);
  }

  function clearPlan() {
    plan = { a: "", b: "", c: "", template: "" };
    savePlan(plan);
    mode = "edit";
    rerender(mode);
  }

  function logPlanSave(outcome) {
    planOutcome = outcome; // "set" | "unclear"
    safeAppendLog({
      kind: "today_plan",
      when: nowISO(),
      template: plan.template || "custom",
      steps: { a: plan.a, b: plan.b, c: plan.c },
      planningMinutes: timerKind === "plan" ? durationMin : null,
      outcome,
      stoppedEarly,
      earlyStopReason,
      earlyStopElapsedSec,
      build: BUILD
    });
  }

  function logStepResult(result) {
    lastStepResult = result; // "done" | "stuck"
    safeAppendLog({
      kind: "today_plan_step",
      when: nowISO(),
      template: plan.template || "custom",
      step: activeStep,
      stepText: getStepText(activeStep),
      minutes: durationMin,
      result,
      stoppedEarly,
      earlyStopReason,
      earlyStopElapsedSec,
      build: BUILD
    });
  }

  function recentPlans() {
    const log = readLog().filter(e => e.kind === "today_plan").slice(0, 5);
    if (!log.length) {
      return el("div", {}, [
        el("h2", { class: "h2" }, ["Recent plans"]),
        el("p", { class: "p" }, ["No saved plans yet. Create one and it will show here."]),
      ]);
    }
    return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent plans"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [e.template ? `Plan • ${String(e.template)}` : "Plan"]),
          el("div", { class: "small" }, [
            `${new Date(e.when).toLocaleString()} • ${e.outcome === "set" ? "Plan set" : "Still unclear"}${e.stoppedEarly ? " • stopped early" : ""}`
          ]),
        ])
      )
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today’s Plan"]),
        el("p", { class: "p" }, ["Three steps only. Then do Step 1."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function templatesPanel() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Templates (tap to fill)"]),
      el("p", { class: "small" }, ["Tap one to load. Then tweak the 3 steps if needed."]),
      el("div", { class: "btnRow" }, TEMPLATES.map(t =>
        el("button", { class: "btn", type: "button", onClick: () => applyTemplate(t) }, [t.label])
      )),
      plan.template
        ? el("p", { class: "small", style: "margin-top:8px" }, [`Selected: ${plan.template}`])
        : el("p", { class: "small", style: "margin-top:8px" }, ["Selected: none (custom)"]),
    ]);
  }

  function inputRow(label, key) {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "small" }, [label]),
      el("input", {
        value: plan[key],
        placeholder: "Small + concrete…",
        style:
          "width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);",
        onInput: (e) => {
          plan[key] = e.target.value;
          savePlan(plan);
        }
      }, [])
    ]);
  }

  function editorCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Three steps. Nothing else."]),
      inputRow("Step 1", "a"),
      inputRow("Step 2", "b"),
      inputRow("Step 3", "c"),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: clearPlan }, ["Clear"]),
      ]),
      el("p", { class: "small" }, ["Rule: if it doesn’t fit in 3 steps, it’s not for today."]),
    ]);
  }

  function stepSprintCard() {
    const s = nonEmptySteps();
    const stepText = getStepText(activeStep);
    const stepLabel = `Step ${activeStep}`;

    return el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Step Sprint"]),
      el("div", { class: "badge" }, [stepLabel]),
      el("p", { class: "p" }, [stepText || "Step is empty. Add text above first."]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { activeStep = 1; rerender(mode); }
        }, ["Step 1"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { activeStep = 2; rerender(mode); }
        }, ["Step 2"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { activeStep = 3; rerender(mode); }
        }, ["Step 3"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => { stepMinutes = 5; durationMin = 5; rerender(mode); } }, ["5 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { stepMinutes = 10; durationMin = 10; rerender(mode); } }, ["10 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { stepMinutes = 25; durationMin = 25; rerender(mode); } }, ["25 min"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: () => {
            if (!s.any) return;
            if (!getStepText(activeStep)) return;
            durationMin = stepMinutes;
            startTimer("step");
          }
        }, ["Start Step"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => (location.hash = "#/green/move")
        }, ["Move Forward"]),
      ]),
      !getStepText(activeStep)
        ? el("p", { class: "small", style: "margin-top:10px" }, ["That step is empty. Add text above, then start."])
        : el("p", { class: "small", style: "margin-top:10px" }, ["Do the step until the timer ends. No optimizing."]),
    ]);
  }

  function planSprintCard() {
    const s = nonEmptySteps();
    return el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Plan Sprint (optional)"]),
      el("div", { class: "badge" }, ["Tighten your 3 steps"]),
      el("p", { class: "p" }, ["Use this if you’re still fuzzy. Otherwise, start Step 1."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 3; rerender(mode); } }, ["3 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 5; rerender(mode); } }, ["5 min"]),
        el("button", { class: "btn", type: "button", onClick: () => { durationMin = 10; rerender(mode); } }, ["10 min"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => startTimer("plan"),
          disabled: s.any ? null : "true"
        }, ["Start plan sprint"]),
      ]),
      !s.any
        ? el("p", { class: "small", style: "margin-top:10px" }, ["Add at least one step first."])
        : el("p", { class: "small", style: "margin-top:10px" }, ["If it’s good enough: skip this and start Step 1."]),
    ]);
  }

  function timerRunningCard() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const title = timerKind === "plan" ? "Planning Sprint" : `Step ${activeStep} Sprint`;
    const subtitle = timerKind === "step" ? (getStepText(activeStep) || "") : "";

    return el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Timer"]),
      el("div", { class: "badge" }, [`${title} • ${durationMin} min`]),
      subtitle ? el("p", { class: "p" }, [subtitle]) : null,
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
    if (mode === "early_stop") {
      const label = timerKind === "plan" ? "planning" : "working";
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You were ${label} for ${earlyStopElapsedSec}s. Why are you stopping?`]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { earlyStopReason = "safe"; mode = "checkout"; rerender(mode); }
          }, ["I’m good / enough for now"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              earlyStopReason = "bailed";
              if (timerKind === "plan") {
                logPlanSave("unclear");
                mode = "routed";
              } else {
                logStepResult("stuck");
                mode = "routed";
              }
              rerender(mode);
            }
          }, ["Still stuck / avoiding it"]),
        ]),
      ]);
    }

    if (mode === "checkout") {
      // If we just finished planning sprint -> ask plan set?
      if (timerKind === "plan") {
        return el("div", { class: "card cardPad" }, [
          el("div", { class: "badge" }, ["Check-out"]),
          el("p", { class: "p" }, ["Is this plan set enough to do Step 1?"]),
          el("div", { class: "btnRow" }, [
            el("button", {
              class: "btn btnPrimary",
              type: "button",
              onClick: () => { logPlanSave("set"); mode = "routed"; rerender(mode); }
            }, ["Plan is set"]),
            el("button", {
              class: "btn",
              type: "button",
              onClick: () => { logPlanSave("unclear"); mode = "routed"; rerender(mode); }
            }, ["Still unclear"]),
          ]),
        ]);
      }

      // finished a step sprint -> ask if step done?
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, [`Step ${activeStep} check-out`]),
        el("p", { class: "p" }, ["Did you complete the step (or move it forward enough)?"]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { logStepResult("done"); mode = "routed"; rerender(mode); }
          }, ["Yes, done"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { logStepResult("stuck"); mode = "routed"; rerender(mode); }
          }, ["Still stuck"]),
        ]),
      ]);
    }

    if (mode === "routed") {
      // Routing differs depending on what we just did
      const fromPlan = timerKind === "plan";
      const set = fromPlan ? planOutcome === "set" : lastStepResult === "done";
      const stuck = fromPlan ? planOutcome === "unclear" : lastStepResult === "stuck";

      const nextStep = Math.min(3, activeStep + 1);

      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [
          fromPlan
            ? (set ? "Good. Start Step 1 now." : "Okay. Get clarity, then lock one move.")
            : (set ? `Good. Move to Step ${nextStep}.` : "Okay. Change state, then try again.")
        ]),
        el("div", { class: "btnRow" }, [
          // Primary button
          set && !fromPlan
            ? el("button", {
                class: "btn btnPrimary",
                type: "button",
                onClick: () => { activeStep = nextStep; mode = "edit"; rerender(mode); }
              }, [`Go to Step ${nextStep}`])
            : set && fromPlan
            ? el("button", {
                class: "btn btnPrimary",
                type: "button",
                onClick: () => { activeStep = 1; mode = "edit"; rerender(mode); }
              }, ["Start Step 1"])
            : el("button", {
                class: "btn btnPrimary",
                type: "button",
                onClick: () => (location.hash = "#/reflect")
              }, ["Clarify"]),

          // Secondary
          stuck
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/next") }, ["Find Next Step"]),

          // Tertiary
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { mode = "edit"; rerender(mode); } }, ["Back to plan"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
        ]),
      ]);
    }

    // default helper
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Rule"]),
      el("p", { class: "p" }, ["Three steps only. Step 1 is the only thing that matters right now."]),
    ]);
  }

  function rerender(nextMode) {
    mode = nextMode;
    wrap.innerHTML = "";
    wrap.appendChild(header());

    // planning surface
    wrap.appendChild(templatesPanel());
    wrap.appendChild(editorCard());

    // action surface
    if (mode === "running_plan" || mode === "running_step") {
      wrap.appendChild(timerRunningCard());
    } else {
      wrap.appendChild(stepSprintCard()); // ✅ primary action: do Step 1
      wrap.appendChild(planSprintCard()); // optional
    }

    wrap.appendChild(statusCard());
    wrap.appendChild(el("div", { class: "card cardPad" }, [recentPlans()]));

    if (running) updateTimerUI();
  }

  rerender("edit");
  return wrap;
}
