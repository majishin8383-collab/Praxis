import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TP-3";
const KEY = "praxis_today_plan_v3";

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

function safeAppendLog(entry) {
  try { appendLog(entry); } catch {}
}

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

function savePlan(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

const TEMPLATES = [
  { id: "stability", label: "Stability", a: "2-min Calm", b: "5-min walk / movement", c: "One small maintenance task" },
  { id: "maintenance", label: "Maintenance", a: "Clean one area (10 min)", b: "Reply to one important thing", c: "Prep tomorrow (5 min)" },
  { id: "progress", label: "Progress", a: "Start the hard task (25 min)", b: "Continue or finish (10–25 min)", c: "Quick wrap-up / tidy (5 min)" },
  { id: "recovery", label: "Recovery", a: "Eat / hydrate", b: "Shower or reset body", c: "Early night / low stimulation" }
];

export function renderTodayPlan() {
  const wrap = el("div", { class: "flowShell" });

  // modes:
  // edit -> template/editor + timer start
  // running -> timer running
  // early_stop -> stopped early fork
  // checkout -> plan set vs still unclear
  // routed -> after logging outcome, show next buttons
  let mode = "edit";

  let plan = readPlan();

  // timer state (Calm-style: appears with Start)
  let running = false;
  let durationMin = 5; // planning sprint
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // early stop + outcome
  let stoppedEarly = false;
  let earlyStopElapsedSec = 0;
  let earlyStopReason = null; // "safe" | "bailed" | null
  let lastOutcome = null; // "set" | "unclear" | null

  safeAppendLog({ kind: "today_plan_open", when: nowISO(), build: BUILD });

  function stopTick() {
    if (tick) clearInterval(tick);
    tick = null;
  }

  function canStart() {
    const a = (plan.a || "").trim();
    const b = (plan.b || "").trim();
    const c = (plan.c || "").trim();
    return a.length > 0 || b.length > 0 || c.length > 0;
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function startTimer() {
    if (!canStart()) return;

    running = true;
    stoppedEarly = false;
    earlyStopElapsedSec = 0;
    earlyStopReason = null;
    lastOutcome = null;

    startAt = Date.now();
    endAt = Date.now() + durationMin * 60 * 1000;

    safeAppendLog({
      kind: "today_plan_start",
      when: nowISO(),
      minutes: durationMin,
      template: plan.template || "custom",
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

    mode = "running";
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
      kind: "today_plan_stop",
      when: nowISO(),
      minutesPlanned: durationMin,
      elapsedSec: Math.round(elapsedMs / 1000),
      remainingSec: Math.round(remainingMs / 1000),
      template: plan.template || "custom",
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

  function logOutcome(outcome) {
    lastOutcome = outcome; // "set" | "unclear"

    safeAppendLog({
      kind: "today_plan",
      when: nowISO(),
      template: plan.template || "custom",
      steps: { a: plan.a, b: plan.b, c: plan.c },
      minutes: durationMin,
      outcome,
      stoppedEarly,
      earlyStopReason,
      earlyStopElapsedSec,
      build: BUILD
    });
  }

  function recentLogs() {
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
      el("p", { class: "small" }, ["Tap one to load. Then edit your 3 steps if needed."]),
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

  function editor() {
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

  function timerCard() {
    if (!running) {
      return el("div", { class: "card cardPad" }, [
        el("h2", { class: "h2" }, ["Timer"]),
        el("div", { class: "badge" }, [`Planning sprint • ${durationMin} min`]),
        el("p", { class: "p" }, ["Press Start. When the timer ends, we lock Step 1."]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { durationMin = 3; rerender(mode); }
          }, ["3 min"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { durationMin = 5; rerender(mode); }
          }, ["5 min"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { durationMin = 10; rerender(mode); }
          }, ["10 min"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: `btn btnPrimary`,
            type: "button",
            onClick: startTimer,
            disabled: canStart() ? null : "true"
          }, ["Start"]),
        ]),
        !canStart()
          ? el("p", { class: "small", style: "margin-top:10px" }, ["Add at least one step before starting."])
          : el("p", { class: "small", style: "margin-top:10px" }, ["Keep it simple. No perfect plan."]),
      ]);
    }

    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Timer"]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "badge" }, [`Active • ${durationMin} min`]),
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

  function statusCard(modeNow) {
    if (modeNow === "early_stop") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You planned for ${earlyStopElapsedSec}s. Why are you stopping?`]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { earlyStopReason = "safe"; mode = "checkout"; rerender(mode); }
          }, ["Plan is basically set"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              earlyStopReason = "bailed";
              // treat as unclear path immediately
              logOutcome("unclear");
              mode = "routed";
              rerender(mode);
            }
          }, ["Still unclear / resisting it"]),
        ]),
        el("p", { class: "small", style: "margin-top:10px" }, ["Honesty keeps Praxis accurate."]),
      ]);
    }

    if (modeNow === "checkout") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Check-out"]),
        el("p", { class: "p" }, ["Is your plan set enough to do Step 1?"]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { logOutcome("set"); mode = "routed"; rerender(mode); }
          }, ["Plan is set"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { logOutcome("unclear"); mode = "routed"; rerender(mode); }
          }, ["Still unclear"]),
        ]),
      ]);
    }

    if (modeNow === "routed") {
      const set = lastOutcome === "set";

      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [
          set
            ? "Good. Do Step 1 now. Not all three."
            : "Okay. Don’t journal. Get clarity, then lock one move."
        ]),
        el("div", { class: "btnRow" }, [
          set
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),

          set
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/next") }, ["Find Next Step"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/next") }, ["Find Next Step"]),

          set
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { mode = "edit"; rerender(mode); }
          }, ["Edit plan"]),
        ]),
      ]);
    }

    // edit/running helper
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Rule"]),
      el("p", { class: "p" }, ["Three steps only. Step 1 is the only thing that matters right now."]),
    ]);
  }

  function rerender(nextMode) {
    mode = nextMode;
    wrap.innerHTML = "";
    wrap.appendChild(header());

    // Always show templates + editor (this is the planning surface)
    wrap.appendChild(templatesPanel());
    wrap.appendChild(editor());
    wrap.appendChild(timerCard());

    // Status changes with mode
    wrap.appendChild(statusCard(mode));

    // Optional: recent plans (light history, only here)
    wrap.appendChild(el("div", { class: "card cardPad" }, [recentLogs()]));

    if (running) updateTimerUI();
  }

  rerender("edit");
  return wrap;
}
