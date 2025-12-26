import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "MF-2";

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

const LADDERS = [
  {
    id: "walk",
    title: "Walk + breathe",
    desc: "Move your body. Let the mind settle behind you.",
    minutes: 5,
    steps: [
      "Stand up. Shoulders down.",
      "Walk anywhere (inside is fine).",
      "In 4 → out 6. Keep moving."
    ]
  },
  {
    id: "reset_body",
    title: "Body reset",
    desc: "Short circuit the loop with simple reps.",
    minutes: 5,
    steps: [
      "20 slow squats (or chair sits).",
      "20 wall push-ups (or countertop).",
      "60s stretch: neck + chest + hips."
    ]
  },
  {
    id: "water_light",
    title: "Water + light",
    desc: "Basic physiology first: hydrate, brighten, regulate.",
    minutes: 3,
    steps: [
      "Drink a full glass of water.",
      "Step into brighter light / outside if possible.",
      "3 slow exhales. Keep eyes soft."
    ]
  },
  {
    id: "clean_3",
    title: "Clean 3 things",
    desc: "Quick environmental control = quick mental control.",
    minutes: 5,
    steps: [
      "Grab a trash bag or laundry basket.",
      "Pick up 3 things and put them away.",
      "Wipe one surface for 60 seconds."
    ]
  },
  {
    id: "micro_task",
    title: "Micro-task (2 minutes)",
    desc: "Small win to restart momentum.",
    minutes: 2,
    steps: [
      "Pick ONE tiny task (email / dishes / timer).",
      "Set 2 minutes. Start before thinking.",
      "When it ends: stop. You win either way."
    ]
  },
  {
    id: "outside_reset",
    title: "Outside reset",
    desc: "Change the scene to change the state.",
    minutes: 7,
    steps: [
      "Put on shoes (no debate).",
      "Walk to the end of the street / around building.",
      "Look far away for 10 seconds. Breathe out longer."
    ]
  }
];

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
  let selectedLadderId = LADDERS[0].id;

  let durationMin = 5;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  let currentMode = "pick"; // pick | running | early_stop | done | logged
  let stoppedEarly = false;
  let earlyStopElapsedSec = 0;
  let earlyStopReason = null; // safe | bailed | null
  let lastOutcome = null; // done | stuck | null

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

  function startLadder(ladderId) {
    const ladder = LADDERS.find(x => x.id === ladderId) || LADDERS[0];

    selectedLadderId = ladder.id;
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
        rerender("done");
      } else {
        updateTimerUI();
      }
    }, 250);

    rerender("running");
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

    rerender("running");
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

    rerender("early_stop");
  }

  function logOutcome(outcome) {
    lastOutcome = outcome;

    const ladder = getSelected();

    safeAppendLog({
      kind: "move_forward",
      when: nowISO(),
      ladderId: ladder.id,
      ladderTitle: ladder.title,
      minutes: durationMin,
      outcome, // done | stuck
      stoppedEarly,
      earlyStopReason,
      earlyStopElapsedSec,
      build: BUILD
    });
  }

  function recentLogs() {
    const log = readLog().filter(e => e.kind === "move_forward").slice(0, 6);
    if (!log.length) {
      return el("div", {}, [
        el("h2", { class: "h2" }, ["Recent Move Forward sessions"]),
        el("p", { class: "p" }, ["No entries yet. Run it once to create history automatically."]),
      ]);
    }

    return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent Move Forward sessions"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [e.ladderTitle || "Move Forward"]),
          el("div", { class: "small" }, [
            `${new Date(e.when).toLocaleString()} • ${e.minutes ?? ""} min • ${
              e.outcome === "done" ? "Done" : "Still stuck"
            }${e.stoppedEarly ? " • stopped early" : ""}`
          ]),
        ])
      )
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Move Forward"]),
        el("p", { class: "p" }, ["Tap a ladder. Start moving immediately."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function ladderPickerCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Tap to start"]),
      el("p", { class: "p" }, ["No perfect choice. Tap the closest. Praxis starts it."]),
      el("div", { class: "flowShell" }, LADDERS.map(l =>
        el("button", {
          class: "actionTile",
          type: "button",
          onClick: () => startLadder(l.id) // ✅ tap = start
        }, [
          el("div", { class: "tileTop" }, [
            el("div", {}, [
              el("div", { class: "tileTitle" }, [l.title]),
              el("div", { class: "tileSub" }, [`${l.minutes} min • ${l.desc}`]),
            ]),
            el("div", { class: `zoneDot dotGreen` }, []),
          ]),
          el("p", { class: "tileHint" }, ["Tap to start"]),
        ])
      )),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/today") }, ["Today’s Plan"]),
      ])
    ]);
  }

  function ladderInstructionsCard() {
    const ladder = getSelected();
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Do this now"]),
      el("h2", { class: "h2" }, [ladder.title]),
      el("p", { class: "p" }, [ladder.desc]),
      el("div", { class: "flowShell" }, ladder.steps.map((s) =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [s]),
        ])
      )),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => rerender("pick") }, ["Change ladder"]),
      ])
    ]);
  }

  function timerCard() {
    if (!running) {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Timer"]),
        el("p", { class: "p" }, ["Tap a ladder to begin."]),
      ]);
    }

    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Timer"]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "badge" }, [`Active • ${durationMin} min window`]),
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        el("div", { class: "progressBar" }, [
          el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => extend(3) }, ["+3 min"]),
          el("button", { class: "btn", type: "button", onClick: () => extend(5) }, ["+5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => stopEarly() }, ["Stop"]),
        ]),
      ])
    ]);
  }

  function statusCard(mode) {
    if (mode === "early_stop") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You moved for ${earlyStopElapsedSec}s. Why are you stopping?`]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { earlyStopReason = "safe"; rerender("done"); }
          }, ["I’m okay / situation changed"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { earlyStopReason = "bailed"; logOutcome("stuck"); rerender("logged"); }
          }, ["Still stuck / resisting it"]),
        ]),
      ]);
    }

    if (mode === "done") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Check-out"]),
        el("p", { class: "p" }, ["What’s true right now?"]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => { logOutcome("done"); rerender("logged"); } }, ["I did it"]),
          el("button", { class: "btn", type: "button", onClick: () => { logOutcome("stuck"); rerender("logged"); } }, ["Still stuck"]),
        ]),
      ]);
    }

    if (mode === "logged") {
      const done = lastOutcome === "done";
      const stuck = lastOutcome === "stuck";

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
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/green/today") }, ["Today’s Plan"])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),

          done
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/next") }, ["Find Next Step"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),

          done
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => rerender("pick") }, ["Run Move Forward again"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"]),
        ]),
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Rule"]),
      el("p", { class: "p" }, ["Move first. Thinking comes later."]),
    ]);
  }

  function rerender(mode) {
    currentMode = mode;
    wrap.innerHTML = "";
    wrap.appendChild(header());

    if (mode === "pick") {
      wrap.appendChild(ladderPickerCard());
      wrap.appendChild(el("div", { class: "card cardPad" }, [recentLogs()]));
      return wrap;
    }

    wrap.appendChild(ladderInstructionsCard());
    wrap.appendChild(timerCard());
    wrap.appendChild(statusCard(mode));
    wrap.appendChild(el("div", { class: "card cardPad" }, [recentLogs()]));

    if (running) updateTimerUI();
    return wrap;
  }

  rerender("pick");
  return wrap;
}
