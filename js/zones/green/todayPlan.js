import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-11";
const KEY = "praxis_today_plan_v5";

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
function safeAppendLog(entry) { try { appendLog(entry); } catch {} }

function readState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { template: "", a: "", b: "", c: "", doneStep: 0 };
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

// detect patterns like "2-min", "5-min", "10-mins"
function detectMinutes(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();

  const hyMin = t.match(/(\d+)\s*-\s*(min|mins|minute|minutes)\b/);
  if (hyMin) {
    const n = parseInt(hyMin[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  const hr = t.match(/(\d+)\s*(hour|hours|hr|hrs)\b/);
  if (hr) {
    const n = parseInt(hr[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(180, n * 60);
  }

  const range = t.match(/(\d+)\s*[–-]\s*(\d+)\s*(min|mins|minute|minutes)\b/);
  if (range) {
    const n = parseInt(range[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
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
  let showRefine = false;
  let statusMode = "idle"; // idle | running | time_complete | offer_continue | stopped_early | logged
  let lastOutcome = null;  // done | stuck | null
  let stopElapsedSec = 0;

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
    if (activeStep === 1) return "Rule: Step 1 only.";
    if (activeStep === 2) return "Rule: Step 2 only.";
    return "Rule: Step 3 only.";
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, liveDurationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (liveDurationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
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
      build: BUILD
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
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
      build: BUILD
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
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
      build: BUILD
    });

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
      result,
      build: BUILD
    });
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

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today’s Plan"]),
        el("p", { class: "p" }, ["Pick 3 steps. Then do Step 1."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function templatesCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Quick templates"]),
      el("p", { class: "small" }, ["Tap one to fill. Edit if needed."]),
      el("div", { class: "btnRow" }, TEMPLATES.map(t =>
        el("button", { class: "btn", type: "button", onClick: () => applyTemplate(t) }, [t.label])
      )),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: clearAll }, ["Clear plan"]),
      ]),
    ]);
  }

  function stepInput(label, key, locked) {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "small" }, [label]),
      el("input", {
        value: state[key],
        placeholder: locked ? "Locked until the previous step is done…" : "Small + concrete… (add a time if you want)",
        disabled: locked ? true : false,
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
      el("p", { class: "small" }, ["Keep each step tiny. If it doesn’t fit, it’s not for today."]),
      stepInput("Step 1", "a", false),
      stepInput("Step 2", "b", lock2),
      stepInput("Step 3", "c", lock3),
    ]);
  }

  function primaryActionCard() {
    const currentText = stepText(activeStep);
    const autoMin = detectMinutes(currentText) ?? 10;

    const stepButtons = el("div", { class: "btnRow" }, [
      el("button", {
        class: `btn ${activeStep === 1 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 1; statusMode = "idle"; rerender(); }
      }, ["Step 1"]),
      el("button", {
        class: `btn ${activeStep === 2 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 2; statusMode = "idle"; rerender(); },
        disabled: canStartStep(2) ? false : true
      }, ["Step 2"]),
      el("button", {
        class: `btn ${activeStep === 3 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 3; statusMode = "idle"; rerender(); },
        disabled: canStartStep(3) ? false : true
      }, ["Step 3"]),
    ]);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Do this now"]),
      stepButtons,
      el("p", { class: "p", style: "margin-top:8px;font-weight:900;" }, [
        currentText ? currentText : "Write Step 1 above first."
      ]),
      currentText
        ? el("p", { class: "small", style: "margin-top:8px" }, [`Time: ${autoMin} min (pulled from the step)`])
        : el("p", { class: "small", style: "margin-top:8px" }, ["Time: defaults to 10 min unless you include a time in the step."]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: startTimerForStep,
          disabled: !(currentText && canStartStep(activeStep)) || running
        }, ["Start"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
      ]),
      el("p", { class: "small", style: "margin-top:10px" }, [goalLine()])
    ]);
  }

  function refineCard() {
    if (!showRefine) {
      return el("div", { class: "card cardPad" }, [
        el("p", { class: "small" }, ["Optional: if your step feels vague, use Clarify."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { showRefine = true; rerender(); } }, ["Show options"])
        ])
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Refine (optional)"]),
      el("p", { class: "small" }, ["If your brain is bargaining: lock a move, then do it."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify the Next Move"]),
        el("button", { class: "btn", type: "button", onClick: () => { showRefine = false; rerender(); } }, ["Hide"])
      ])
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
      ])
    ]);
  }

  function statusCard() {
    if (statusMode === "stopped_early") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You did ${stopElapsedSec}s. That still counts.`]),
        el("p", { class: "small" }, ["Change state, then try the step again."]),
        el("div", { class: "btnRow" }, [
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
        el("div", { class: "badge" }, ["Time’s up"]),
        el("p", { class: "p" }, ["Did the step move forward enough?"]),
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
          }, ["Yes"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              logStep("stuck");
              statusMode = "offer_continue";
              rerender();
            }
          }, ["No"]),
        ]),
      ]);
    }

    if (statusMode === "offer_continue") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Still stuck"]),
        el("p", { class: "p" }, ["Choose one: a short continue, or change state."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => continueAfterStuck(5) }, ["Continue 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => continueAfterStuck(10) }, ["Continue 10 min"]),
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
          good
            ? (activeStep < 3 ? `Go to Step ${nextStep}.` : "Plan complete. Reset or pick a new direction.")
            : "Change state, then try again."
        ]),
        el("div", { class: "btnRow" }, [
          good && activeStep < 3
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => { activeStep = nextStep; statusMode = "idle"; rerender(); } }, [`Step ${nextStep}`])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to plan"]),
        ]),
      ]);
    }

    return null;
  }

  function recentCard() {
    const log = readLog().filter(e => e.kind === "today_plan_step").slice(0, 4);
    if (!log.length) return null;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Recent"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [`Step ${e.step ?? "?"}`]),
          el("div", { class: "small" }, [
            `${new Date(e.when).toLocaleString()} • ${e.minutes ?? ""} min • ${e.result === "done" ? "Done" : "Stuck"}`
          ]),
        ])
      )
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    // Keep “do” above “edit” in the user’s mind:
    wrap.appendChild(primaryActionCard());
    const t = timerCard();
    if (t) wrap.appendChild(t);
    const s = statusCard();
    if (s) wrap.appendChild(s);

    wrap.appendChild(templatesCard());
    wrap.appendChild(planCard());
    wrap.appendChild(refineCard());

    const r = recentCard();
    if (r) wrap.appendChild(r);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
