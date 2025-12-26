import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "TODAY-V2-1";
const KEY = "praxis_today_v2_state";

/* ---------- tiny DOM helper ---------- */
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

/* ---------- state ---------- */
function defaultState() {
  return {
    lane: "",          // stability | maintenance | progress | recovery | custom
    a: "",
    b: "",
    c: "",
    doneStep: 0,       // 0..3
    pickedAt: "",      // iso
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    return {
      lane: s.lane || "",
      a: s.a || "",
      b: s.b || "",
      c: s.c || "",
      doneStep: Number.isFinite(s.doneStep) ? s.doneStep : 0,
      pickedAt: s.pickedAt || "",
    };
  } catch {
    return defaultState();
  }
}

function saveState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

/* ---------- lanes (Today v2 spine) ---------- */
const LANES = [
  {
    id: "stability",
    title: "Stability Day",
    sub: "Lower intensity and stay steady",
    steps: [
      "2-min Calm",
      "5-min walk / movement",
      "One small maintenance task (10 min)",
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance Day",
    sub: "Keep life from sliding backward",
    steps: [
      "Clean one area (10 min)",
      "Reply to one important thing (5–10 min)",
      "Prep tomorrow (5 min)",
    ],
  },
  {
    id: "progress",
    title: "Progress Day",
    sub: "Do one meaningful thing",
    steps: [
      "Start the hard task (25 min)",
      "Continue or finish (10–25 min)",
      "Quick wrap-up / tidy (5 min)",
    ],
  },
  {
    id: "recovery",
    title: "Recovery Day",
    sub: "Heal + protect the future you",
    steps: [
      "Eat / hydrate (5 min)",
      "Shower or reset body (10 min)",
      "Low stimulation / early night (30–60 min)",
    ],
  },
  {
    id: "custom",
    title: "Custom",
    sub: "Write your own 3 steps",
    steps: ["", "", ""],
  },
];

/* ---------- time detection (fixes 2-min → 2) ---------- */
function detectMinutes(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();

  // 0) "2-min" / "2 - min" / "2-mins" / "2-minutes"
  const hyMin = t.match(/(\d+)\s*-\s*(min|mins|minute|minutes)\b/);
  if (hyMin) {
    const n = parseInt(hyMin[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  // 1) "10–25 min" or "10-25 min" -> take first number
  const range = t.match(/(\d+)\s*[–-]\s*(\d+)\s*(min|mins|minute|minutes)\b/);
  if (range) {
    const n = parseInt(range[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  // 2) "25 min" / "25mins" / "25min"
  const m = t.match(/(\d+)\s*(min|mins|minute|minutes|m)\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(60, n);
  }

  // 3) "1 hour" / "2 hours" -> convert to minutes (cap 3h)
  const hr = t.match(/(\d+)\s*(hour|hours|hr|hrs)\b/);
  if (hr) {
    const n = parseInt(hr[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(180, n * 60);
  }

  return null;
}

/* ---------- main render ---------- */
export function renderTodayPlan() {
  const wrap = el("div", { class: "flowShell" });

  let state = readState();

  // UI state
  let activeStep = 1;         // 1..3
  let showEdit = false;       // optional
  let mode = state.lane ? "plan" : "pick"; // pick | plan
  let statusMode = "idle";    // idle | running | time_complete | offer_continue | stopped_early | logged

  // timer state
  let running = false;
  let liveDurationMin = 10;
  let startAt = 0;
  let endAt = 0;
  let tick = null;
  let stopElapsedSec = 0;
  let lastResult = null;      // done | stuck | null

  safeAppendLog({ kind: "today_v2_open", when: nowISO(), build: BUILD });

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function stepsObj() {
    return {
      a: (state.a || "").trim(),
      b: (state.b || "").trim(),
      c: (state.c || "").trim(),
    };
  }
  function stepText(n) {
    const s = stepsObj();
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

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, liveDurationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (liveDurationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function startStep() {
    const txt = stepText(activeStep);
    if (!txt) return;
    if (!canStartStep(activeStep)) return;

    liveDurationMin = detectMinutes(txt) ?? 10;

    running = true;
    lastResult = null;
    stopElapsedSec = 0;

    startAt = Date.now();
    endAt = Date.now() + liveDurationMin * 60 * 1000;

    safeAppendLog({
      kind: "today_v2_step_start",
      when: nowISO(),
      lane: state.lane || "custom",
      step: activeStep,
      minutes: liveDurationMin,
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

  function stopEarly() {
    const now = Date.now();
    const elapsedMs = startAt ? clamp(now - startAt, 0, liveDurationMin * 60 * 1000) : 0;

    stopTick();
    running = false;
    stopElapsedSec = Math.max(0, Math.round(elapsedMs / 1000));

    safeAppendLog({
      kind: "today_v2_step_stop",
      when: nowISO(),
      lane: state.lane || "custom",
      step: activeStep,
      minutesPlanned: liveDurationMin,
      elapsedSec: stopElapsedSec,
      build: BUILD
    });

    statusMode = "stopped_early";
    rerender();
  }

  function logStep(result) {
    lastResult = result;

    safeAppendLog({
      kind: "today_v2_step",
      when: nowISO(),
      lane: state.lane || "custom",
      step: activeStep,
      stepText: stepText(activeStep),
      minutes: liveDurationMin,
      result,
      build: BUILD
    });
  }

  function continueAfterStuck(extraMin) {
    liveDurationMin = Math.max(1, extraMin);
    running = true;

    startAt = Date.now();
    endAt = Date.now() + liveDurationMin * 60 * 1000;

    safeAppendLog({
      kind: "today_v2_continue",
      when: nowISO(),
      lane: state.lane || "custom",
      step: activeStep,
      minutes: liveDurationMin,
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

  function pickLane(laneId) {
    const lane = LANES.find(l => l.id === laneId) || LANES[0];
    state.lane = lane.id;
    state.a = lane.steps[0] || "";
    state.b = lane.steps[1] || "";
    state.c = lane.steps[2] || "";
    state.doneStep = 0;
    state.pickedAt = nowISO();
    saveState(state);

    safeAppendLog({ kind: "today_v2_pick_lane", when: nowISO(), lane: lane.id, build: BUILD });

    activeStep = 1;
    showEdit = lane.id === "custom"; // custom starts editable
    mode = "plan";
    statusMode = "idle";
    rerender();
  }

  function resetToday() {
    state = defaultState();
    saveState(state);
    running = false;
    stopTick();
    mode = "pick";
    activeStep = 1;
    showEdit = false;
    statusMode = "idle";
    rerender();
  }

  /* ---------- UI ---------- */
  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Today"]),
        el("p", { class: "p" }, ["Pick a lane. Do Step 1. Stop when the timer ends."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function pickCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Pick today’s lane"]),
      el("p", { class: "small" }, ["No optimizing. Just choose what’s true."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, LANES.map(l =>
        el("button", {
          class: "actionTile",
          type: "button",
          onClick: () => pickLane(l.id)
        }, [
          el("div", { class: "tileTop" }, [
            el("div", {}, [
              el("div", { class: "tileTitle" }, [l.title]),
              el("div", { class: "tileSub" }, [l.sub]),
            ]),
            el("div", { class: "zoneDot dotGreen" }, []),
          ]),
          el("p", { class: "tileHint" }, ["Tap to choose"]),
        ])
      )),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
      ]),
    ]);
  }

  function laneBadgeCard() {
    const lane = LANES.find(l => l.id === state.lane);
    const title = lane?.title || "Today";
    const sub = lane?.sub || "3 steps only";

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [title]),
      el("p", { class: "small" }, [sub]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => { mode = "pick"; statusMode = "idle"; rerender(); } }, ["Change lane"]),
        el("button", { class: "btn", type: "button", onClick: resetToday }, ["Clear Today"]),
      ]),
    ]);
  }

  function stepButtonsRow() {
    return el("div", { class: "btnRow" }, [
      el("button", {
        class: `btn ${activeStep === 1 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { activeStep = 1; statusMode = "idle"; rerender(); }
      }, ["Step 1"]),
      el("button", {
        class: `btn ${activeStep === 2 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        disabled: canStartStep(2) ? false : true,
        onClick: () => { activeStep = 2; statusMode = "idle"; rerender(); }
      }, ["Step 2"]),
      el("button", {
        class: `btn ${activeStep === 3 ? "btnPrimary" : ""}`.trim(),
        type: "button",
        disabled: canStartStep(3) ? false : true,
        onClick: () => { activeStep = 3; statusMode = "idle"; rerender(); }
      }, ["Step 3"]),
    ]);
  }

  function planCard() {
    const lock2 = state.doneStep < 1;
    const lock3 = state.doneStep < 2;

    const viewOnly = !showEdit;

    function stepLine(label, value, locked) {
      if (viewOnly) {
        return el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { class: "small" }, [label]),
          el("div", { style: `font-weight:900;opacity:${locked ? "0.6" : "1"};` }, [
            value ? value : (locked ? "Locked…" : "Empty…")
          ]),
        ]);
      }

      return el("div", { class: "flowShell" }, [
        el("div", { class: "small" }, [label]),
        el("input", {
          value,
          disabled: locked ? true : false,
          placeholder: locked ? "Locked until previous step is done…" : "Small + concrete…",
          style:
            "width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);opacity:" +
            (locked ? "0.65" : "1") +
            ";",
          onInput: (e) => {
            if (label.includes("Step 1")) state.a = e.target.value;
            if (label.includes("Step 2")) state.b = e.target.value;
            if (label.includes("Step 3")) state.c = e.target.value;
            saveState(state);
          }
        }, [])
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Your 3 steps"]),
      stepLine("Step 1", state.a, false),
      stepLine("Step 2", state.b, lock2),
      stepLine("Step 3", state.c, lock3),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { showEdit = !showEdit; rerender(); }
        }, [showEdit ? "Hide edits" : "Edit steps (optional)"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Rule: if it doesn’t fit in 3 steps, it’s not for today."]),
    ]);
  }

  function doNowCard() {
    const txt = stepText(activeStep);
    const autoMin = detectMinutes(txt) ?? 10;

    const locked = !canStartStep(activeStep);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Do this now"]),
      stepButtonsRow(),
      el("p", { class: "p", style: "margin-top:10px;font-weight:900;" }, [
        txt ? txt : (showEdit ? "Write this step above." : "This step is empty. Tap “Edit steps (optional)”.")
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, [
        txt ? `Timer: ${autoMin} min (from the step)` : "Timer: 10 min default (add a time to override)."
      ]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          disabled: running || locked || !txt,
          onClick: startStep
        }, ["Start Step"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => (location.hash = "#/green/move")
        }, ["Move Forward"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => (location.hash = "#/home")
        }, ["Done for today"]),
      ]),
      locked ? el("p", { class: "small", style: "margin-top:8px" }, ["Locked until the previous step is marked Done."]) : null,
    ].filter(Boolean));
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
        el("p", { class: "p" }, [`You worked for ${stopElapsedSec}s. Change state, then come back.`]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to Today"]),
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
              state.doneStep = Math.max(state.doneStep, activeStep);
              saveState(state);
              statusMode = "logged";
              rerender();
            }
          }, ["Done"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              logStep("stuck");
              statusMode = "offer_continue";
              rerender();
            }
          }, ["Still stuck"]),
        ]),
      ]);
    }

    if (statusMode === "offer_continue") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Still stuck"]),
        el("p", { class: "p" }, ["Pick one: continue briefly, or change state."]),
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
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to Today"]),
        ]),
      ]);
    }

    if (statusMode === "logged") {
      const good = lastResult === "done";
      const nextStep = Math.min(3, activeStep + 1);

      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [
          good
            ? (activeStep < 3 ? `Go to Step ${nextStep}.` : "You’re done for today. Stop here.")
            : "Change state, then try again."
        ]),
        el("div", { class: "btnRow" }, [
          good && activeStep < 3
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => { activeStep = nextStep; statusMode = "idle"; rerender(); } }, [`Step ${nextStep}`])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Done for today"]),
          el("button", { class: "btn", type: "button", onClick: () => { statusMode = "idle"; rerender(); } }, ["Back to Today"]),
        ]),
      ]);
    }

    return null;
  }

  function recentCard() {
    const log = readLog().filter(e => e.kind === "today_v2_step").slice(0, 4);
    if (!log.length) return null;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Recent Today steps"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [`${(e.lane || "today").toUpperCase()} • Step ${e.step ?? "?"}`]),
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

    if (mode === "pick") {
      wrap.appendChild(pickCard());
      return;
    }

    wrap.appendChild(laneBadgeCard());
    wrap.appendChild(planCard());
    wrap.appendChild(doNowCard());

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
