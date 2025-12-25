import { appendLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

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

const LADDERS = [
  {
    id: "reset2",
    title: "Reset Your Body (2 min)",
    sub: "Downshift your nervous system fast",
    minutes: 2,
    steps: [
      "Stand up. Unclench jaw. Drop shoulders.",
      "Breathe slow: in 4, out 6.",
      "Look around: name 5 things you see."
    ]
  },
  {
    id: "move5",
    title: "Move Your Body (5 min)",
    sub: "Discharge energy. Clear mental static",
    minutes: 5,
    steps: [
      "Walk. Pace. Stairs. Any movement counts.",
      "If stuck: do 20 bodyweight squats (or 10).",
      "Drink water when you stop."
    ]
  },
  {
    id: "clean10",
    title: "Make One Area Better (10 min)",
    sub: "Visible progress with almost no thinking",
    minutes: 10,
    steps: [
      "Pick ONE: sink, desk, floor, or laundry pile.",
      "Set timer. Work until it ends.",
      "Stop. Don’t expand the mission."
    ]
  },
  {
    id: "task25",
    title: "One Useful Task (25 min)",
    sub: "A focused window. Then you stop",
    minutes: 25,
    steps: [
      "Choose the smallest real task you’ve been avoiding.",
      "Do only the next step (not the whole thing).",
      "When timer ends: stop or repeat once."
    ]
  }
];

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
  let current = null; // selected ladder object
  let durationMin = 2;
  let endAt = 0;
  let tick = null;

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function start(ladder) {
    current = ladder;
    running = true;
    durationMin = ladder.minutes;
    endAt = Date.now() + ladder.minutes * 60 * 1000;

    appendLog({
      kind: "move_forward",
      when: nowISO(),
      action: "started",
      minutes: durationMin,
      label: ladder.title
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        appendLog({
          kind: "move_forward",
          when: nowISO(),
          action: "completed",
          minutes: durationMin,
          label: ladder?.title || "Move Forward"
        });
        rerender("done");
      } else {
        updateTimerUI();
      }
    }, 250);

    rerender("running");
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Move Forward"]),
        el("p", { class: "p" }, ["Body first. Then progress."]),
      ]),
      // (Reset button hidden by CSS; safe to keep)
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function chooser() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["Pick one. Don’t overthink it."]),
      el("p", { class: "small" }, ["If you can’t choose, pick the first one."]),
      el("div", { class: "flowShell" }, LADDERS.map(l =>
        el("button", {
          class: "actionTile",
          type: "button",
          onClick: () => start(l)
        }, [
          el("div", { class: "tileTop" }, [
            el("div", {}, [
              el("div", { class: "tileTitle" }, [l.title]),
              el("div", { class: "tileSub" }, [l.sub]),
            ]),
            el("div", { class: "zoneDot dotGreen" }, []),
          ]),
          el("p", { class: "tileHint" }, [l.steps[0]]),
        ])
      )),
    ]);
  }

  function runningPanel() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);

    const steps = current?.steps || [];
    return el("div", { class: "timerBox" }, [
      el("div", { class: "badge" }, [`${current?.title || "Move Forward"} • ${durationMin} min`]),
      el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
      el("div", { class: "progressBar" }, [
        el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
      ]),
      steps.length ? el("div", { style: "margin-top:10px" }, [
        el("div", { class: "small" }, ["Do this:"]),
        ...steps.map(s => el("div", { class: "p", style: "margin-top:6px" }, ["• " + s]))
      ]) : null,
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { running = false; stopTick(); rerender("idle"); }
        }, ["Stop"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["You stop when time ends. That’s the rule."]),
    ]);
  }

  function donePanel() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["That counts."]),
      el("p", { class: "p" }, ["Want to reset, or keep moving?"]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
        el("button", { class: "btn", type: "button", onClick: () => rerender("idle") }, ["Run another"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/direction") }, ["Choose today’s direction"]),
      ]),
    ]);
  }

  function rerender(mode) {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    wrap.appendChild(el("div", { class: "card cardPad" }, [
      mode === "running" ? runningPanel()
      : mode === "done" ? donePanel()
      : chooser()
    ]));

    if (running) updateTimerUI();
  }

  rerender("idle");
  return wrap;
}
