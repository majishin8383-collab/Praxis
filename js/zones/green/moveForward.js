import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";
import { setNextIntent } from "../../state/handoff.js";

const BUILD = "MF-2A";

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
  try { appendLog(entry); } catch {}
}

const LADDERS = [
  {
    id: "reset",
    title: "Reset Your Body",
    sub: "Body first",
    hint: "Change state fast so the brain can follow.",
    minutes: 2,
    steps: [
      "Stand up (or sit feet on floor).",
      "Exhale longer than inhale x6.",
      "Drink water (or splash face).",
      "Do 20–60 seconds of movement."
    ]
  },
  {
    id: "discharge",
    title: "Discharge Energy",
    sub: "Move now",
    hint: "Short burst to break the loop.",
    minutes: 5,
    steps: [
      "Walk briskly (or march in place).",
      "Shoulder rolls + jaw unclench.",
      "Shake out hands/arms for 20 seconds.",
      "Stop when timer ends."
    ]
  },
  {
    id: "one_area",
    title: "Make One Area Better",
    sub: "Small win",
    hint: "Pick one tiny zone. Improve it.",
    minutes: 10,
    steps: [
      "Pick ONE area (desk / sink / floor / inbox).",
      "Do only obvious actions.",
      "Stop when timer ends.",
      "No expanding the mission."
    ]
  },
  {
    id: "useful",
    title: "One Useful Task",
    sub: "Progress sprint",
    hint: "One meaningful thing. Timer ends = stop.",
    minutes: 25,
    steps: [
      "Pick the smallest useful task.",
      "Start the first 2 minutes even if messy.",
      "Keep going until timer ends.",
      "Stop. Do not renegotiate."
    ]
  }
];

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  // session state
  let active = LADDERS[0];
  let mode = "idle"; // idle | running | done | logged
  let running = false;

  // timer state
  let durationMin = active.minutes;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  safeAppendLog({ kind: "move_forward_open", when: nowISO(), build: BUILD });

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function startTimer() {
    durationMin = active.minutes;
    running = true;
    mode = "running";

    startAt = Date.now();
    endAt = Date.now() + durationMin * 60 * 1000;

    safeAppendLog({
      kind: "move_forward_start",
      when: nowISO(),
      ladderId: active.id,
      ladderTitle: active.title,
      minutes: durationMin,
      build: BUILD
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        mode = "done";
        rerender();
      } else updateTimerUI();
    }, 250);

    rerender();
  }

  function stopEarly() {
    const elapsedMs = startAt ? clamp(Date.now() - startAt, 0, durationMin * 60 * 1000) : 0;
    stopTick();
    running = false;

    safeAppendLog({
      kind: "move_forward_stop",
      when: nowISO(),
      ladderId: active.id,
      minutesPlanned: durationMin,
      elapsedSec: Math.round(elapsedMs / 1000),
      build: BUILD
    });

    mode = "idle";
    rerender();
  }

  function logResult(result) {
    safeAppendLog({
      kind: "move_forward",
      when: nowISO(),
      ladderId: active.id,
      ladderTitle: active.title,
      minutes: durationMin,
      result, // "done" | "stuck"
      build: BUILD
    });
  }

  function ladderTile(l) {
    const selected = l.id === active.id;
    return el("button", {
      class: `actionTile ${selected ? "tileSelected" : ""}`.trim(),
      type: "button",
      onClick: () => {
        if (running) return;
        active = l;
        mode = "idle";
        rerender();
      }
    }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [l.title]),
          el("div", { class: "tileSub" }, [`${l.sub} • ${l.minutes} min`]),
        ]),
        el("div", { class: "zoneDot dotGreen" }, []),
      ]),
      el("p", { class: "tileHint" }, [l.hint]),
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Move Forward"]),
        el("p", { class: "p" }, ["Body first → then progress. Timer ends = stop."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function ladderCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Pick a ladder"]),
      el("p", { class: "small" }, ["Don’t browse. Pick one and start."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, LADDERS.map(ladderTile)),
    ]);
  }

  function activeCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Now: ${active.title}`]),
      el("p", { class: "p" }, [active.hint]),
      el("div", { class: "hr" }, []),
      ...active.steps.map(s => el("div", { class: "p", style: "margin-top:6px" }, ["• " + s])),
      el("div", { class: "btnRow", style: "margin-top:12px" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: startTimer,
          disabled: running ? true : false
        }, ["Start"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnDanger", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"]),
      ]),
      el("p", { class: "small", style: "margin-top:10px" }, ["Rule: stop when the timer ends. Don’t expand the mission."]),
    ]);
  }

  function timerCard() {
    if (!running) return null;
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`${active.title} • ${durationMin} min`]),
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

  function doneCard() {
    if (mode !== "done") return null;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Time complete"]),
      el("p", { class: "p" }, ["Did you complete it (or move it forward enough)?"]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: () => {
            logResult("done");
            mode = "logged";
            rerender();
          }
        }, ["Done"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => {
            logResult("stuck");
            mode = "logged";
            rerender();
          }
        }, ["Still stuck"]),
      ]),
    ]);
  }

  function handoffCard() {
    if (mode !== "logged") return null;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Next move"]),
      el("p", { class: "p" }, [
        "Convert this momentum into a simple 3-step plan. You can always jump back to Calm / Stop / Emergency if needed."
      ]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: () => {
            // ✅ Move Forward = “Act” already happened → default Today Plan to Step 2
            setNextIntent("today_plan_step2");
            location.hash = "#/green/today";
          }
        }, ["Today’s Plan"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => { mode = "idle"; rerender(); } }, ["Run Move Forward again"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function recentCard() {
    let log = [];
    try { log = readLog().filter(e => e.kind === "move_forward").slice(0, 6); } catch { log = []; }
    if (!log.length) return null;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Recent Move Forward"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [e.ladderTitle || "Move Forward"]),
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
    wrap.appendChild(ladderCard());
    wrap.appendChild(activeCard());

    const t = timerCard();
    if (t) wrap.appendChild(t);

    const d = doneCard();
    if (d) wrap.appendChild(d);

    const h = handoffCard();
    if (h) wrap.appendChild(h);

    const r = recentCard();
    if (r) wrap.appendChild(r);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
