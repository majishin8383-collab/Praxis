// js/zones/green/moveForward.js  (FULL REPLACEMENT)

import { appendLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";
import { grantStabilizeCreditToday, setNextIntent } from "../../state/handoff.js";

const BUILD = "MF-6";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
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

const LADDERS = [
  {
    id: "walk",
    title: "Walk + breathe",
    desc: "Move your body. Let the mind settle behind you.",
    minutes: 5,
    steps: ["Stand up. Shoulders down.", "Walk anywhere (inside is fine).", "In 4 → out 6. Keep moving."]
  },
  {
    id: "reset_body",
    title: "Body reset",
    desc: "Short circuit the loop with simple reps.",
    minutes: 5,
    steps: ["20 slow squats (or chair sits).", "20 wall push-ups (or countertop).", "60s stretch: neck + chest + hips."]
  },
  {
    id: "water_light",
    title: "Water + light",
    desc: "Basic physiology first: hydrate, brighten, regulate.",
    minutes: 3,
    steps: ["Drink a full glass of water.", "Step into brighter light / outside if possible.", "3 slow exhales. Keep eyes soft."]
  },
  {
    id: "clean_3",
    title: "Clean 3 things",
    desc: "Quick environmental control = quick mental control.",
    minutes: 5,
    steps: ["Grab a trash bag or laundry basket.", "Pick up 3 things and put them away.", "Wipe one surface for 60 seconds."]
  },
  {
    id: "micro_task",
    title: "Micro-task (2 minutes)",
    desc: "Small win to restart momentum.",
    minutes: 2,
    steps: ["Pick ONE tiny task (email / dishes / timer).", "Set 2 minutes. Start before thinking.", "When it ends: stop. You win either way."]
  },
  {
    id: "outside_reset",
    title: "Outside reset",
    desc: "Change the scene to change the state.",
    minutes: 7,
    steps: ["Put on shoes (no debate).", "Walk to the end of the street / around building.", "Look far away for 10 seconds. Breathe out longer."]
  }
];

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  // modes: pick -> selected -> running -> early_stop -> done -> logged
  let mode = "pick";
  let selectedLadderId = LADDERS[0].id;

  // timer state
  let running = false;
  let durationMin = 5;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // early stop + checkout state
  let stoppedEarly = false;
  let earlyStopElapsedSec = 0;
  let earlyStopReason = null; // "safe" | "bailed" | null
  let lastOutcome = null;     // "done" | "stuck" | null

  safeAppendLog({ kind: "move_forward_open", when: nowISO(), build: BUILD });

  function stopTick() {
    if (tick) clearInterval(tick);
    tick = null;
  }

  function getSelected() {
    return LADDERS.find(x => x.id === selectedLadderId) || LADDERS[0];
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function goTodayPlanStep2() {
    try { setNextIntent("today_plan_step2"); } catch {}
    location.hash = "#/green/today";
  }

  function selectAndAdvance(id) {
    selectedLadderId = id;
    const ladder = getSelected();
    durationMin = ladder.minutes;
    mode = "selected";
    rerender();
  }

  function startSelected() {
    const ladder = getSelected();

    // ✅ starting Move Forward counts as stabilizing credit for today
    try { grantStabilizeCreditToday(); } catch {}

    running = true;
    stoppedEarly = false;
    earlyStopElapsedSec = 0;
    earlyStopReason = null;
    lastOutcome = null;

    durationMin = ladder.minutes;
    startAt = Date.now();
    endAt = Date.now() + durationMin * 60 * 1000;

    safeAppendLog({
      kind: "move_forward_start",
      when: nowISO(),
      ladderId: ladder.id,
      ladderTitle: ladder.title,
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
      } else {
        updateTimerUI();
      }
    }, 250);

    mode = "running";
    rerender();
  }

  function extend(extraMin) {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const newRemaining = remaining + extraMin * 60 * 1000;
    durationMin = Math.ceil(newRemaining / (60 * 1000));
    endAt = Date.now() + newRemaining;

    safeAppendLog({
      kind: "move_forward_extend",
      when: nowISO(),
      ladderId: selectedLadderId,
      extraMin,
      minutesNow: durationMin,
      build: BUILD
    });

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
      kind: "move_forward_stop",
      when: nowISO(),
      ladderId: selectedLadderId,
      minutesPlanned: durationMin,
      elapsedSec: Math.round(elapsedMs / 1000),
      remainingSec: Math.round(remainingMs / 1000),
      build: BUILD
    });

    mode = "early_stop";
    rerender();
  }

  function logOutcome(outcome) {
    lastOutcome = outcome;
    const ladder = getSelected();

    // ✅ any Move Forward attempt counts as stabilize credit for today
    try { grantStabilizeCreditToday(); } catch {}

    safeAppendLog({
      kind: "move_forward",
      when: nowISO(),
      ladderId: ladder.id,
      ladderTitle: ladder.title,
      minutes: durationMin,
      outcome, // "done" | "stuck"
      stoppedEarly,
      earlyStopReason,
      earlyStopElapsedSec,
      build: BUILD
    });
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Move Forward"]),
        el("p", { class: "p" }, ["Pick one ladder. Start. Stop when the timer ends."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function pickerCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Pick a ladder"]),
      el("p", { class: "small" }, ["Tap one. You’ll start on the next screen."]),
      el("div", { class: "flowShell", style: "margin-top:10px" },
        LADDERS.map(l =>
          el("button", {
            class: "actionTile",
            type: "button",
            onClick: () => selectAndAdvance(l.id),
          }, [
            el("div", { class: "tileTop" }, [
              el("div", {}, [
                el("div", { class: "tileTitle" }, [l.title]),
                el("div", { class: "tileSub" }, [`${l.minutes} min • ${l.desc}`]),
              ]),
              el("div", { class: "zoneDot dotGreen" }, []),
            ]),
            el("p", { class: "tileHint" }, ["Tap to choose"]),
          ])
        )
      ),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: goTodayPlanStep2 }, ["Today’s Plan"]),
      ])
    ]);
  }

  function selectedCard() {
    const ladder = getSelected();
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Do this now"]),
      el("h2", { class: "h2" }, [ladder.title]),
      el("p", { class: "p" }, [ladder.desc]),
      el("div", { class: "flowShell", style: "margin-top:10px" },
        ladder.steps.map(s =>
          el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
            el("div", { style: "font-weight:900;" }, [s]),
          ])
        )
      ),
      el("div", { class: "btnRow", style: "margin-top:12px" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: startSelected }, [`Start • ${ladder.minutes} min`]),
        el("button", { class: "btn", type: "button", onClick: () => { mode = "pick"; rerender(); } }, ["Change ladder"]),
      ]),
      el("p", { class: "small", style: "margin-top:10px" }, ["Rule: stop when the timer ends."])
    ]);
  }

  function runningCard() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Active • ${durationMin} min window`]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        el("div", { class: "progressBar" }, [
          el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => extend(3) }, ["+3 min"]),
          el("button", { class: "btn", type: "button", onClick: () => extend(5) }, ["+5 min"]),
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ])
    ]);
  }

  function statusCard() {
    if (mode === "early_stop") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You moved for ${earlyStopElapsedSec}s. Why are you stopping?`]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { earlyStopReason = "safe"; mode = "done"; rerender(); }
          }, ["I’m okay / situation changed"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { earlyStopReason = "bailed"; logOutcome("stuck"); mode = "logged"; rerender(); }
          }, ["Still stuck / resisting it"]),
        ]),
      ]);
    }

    if (mode === "done") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Check-out"]),
        el("p", { class: "p" }, ["What’s true right now?"]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { logOutcome("done"); mode = "logged"; rerender(); }
          }, ["I did it"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { logOutcome("stuck"); mode = "logged"; rerender(); }
          }, ["Still stuck"]),
        ]),
      ]);
    }

    if (mode === "logged") {
      const done = lastOutcome === "done";
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [
          done
            ? "Good. Turn momentum into a simple plan."
            : earlyStopReason === "bailed"
            ? "Okay. Don’t force it. Change state, then choose again."
            : "Okay. Change state, then choose again."
        ]),
        el("div", { class: "btnRow" }, [
          done
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: goTodayPlanStep2 }, ["Today’s Plan"])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
          done
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/next") }, ["Find Next Step"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
          done
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { mode = "pick"; rerender(); } }, ["Run Move Forward again"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"]),
        ]),
      ]);
    }

    return null;
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    if (mode === "pick") {
      wrap.appendChild(pickerCard());
      return;
    }

    if (mode === "selected") wrap.appendChild(selectedCard());
    if (mode === "running") wrap.appendChild(runningCard());

    const s = statusCard();
    if (s) wrap.appendChild(s);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
