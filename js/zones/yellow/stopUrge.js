// js/zones/yellow/stopUrge.js (FULL REPLACEMENT)
import { appendLog, setNextIntent } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "SU-15";

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

function sectionLabel(text) {
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
}

const TIMER_LINES = [
  "Don’t act on the urge yet.",
  "Let the wave rise and fall.",
  "Unclench your jaw.",
  "Drop your shoulders.",
  "One slow breath is enough.",
  "You do not need to decide right now.",
  "Look away from the screen for a moment.",
  "Let the urge exist without following it.",
];

export function renderStopUrge() {
  const wrap = el("div", { class: "flowShell" });

  // timer state
  let running = false;
  let durationMin = 2;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // modes: idle | running | checkin | closed
  let mode = "idle";

  // outcomes
  let lastOutcome = null; // "passed" | "still_present" | null
  let stoppedEarly = false;
  let elapsedSec = 0;

  safeAppendLog({ kind: "stop_urge_open", when: nowISO(), build: BUILD });

  function stopTick() {
    if (tick) clearInterval(tick);
    tick = null;
  }

  function remainingMs() {
    return clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
  }

  function timerLine() {
    if (!running || !startAt || !durationMin) return TIMER_LINES[0];
    const elapsedMs = clamp(Date.now() - startAt, 0, durationMin * 60 * 1000);
    const slot = Math.floor(elapsedMs / 15000); // rotate every 15s
    return TIMER_LINES[slot % TIMER_LINES.length];
  }

  function updateTimerUI() {
    const readout = wrap.querySelector("[data-timer-readout]");
    if (readout) readout.textContent = formatMMSS(remainingMs());

    const line = wrap.querySelector("[data-timer-line]");
    if (line) line.textContent = timerLine();
  }

  function startPause(min) {
    running = true;
    lastOutcome = null;
    stoppedEarly = false;
    elapsedSec = 0;

    durationMin = min;
    startAt = Date.now();
    endAt = Date.now() + min * 60 * 1000;

    safeAppendLog({ kind: "stop_urge_start", when: nowISO(), minutes: min, build: BUILD });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      if (endAt - Date.now() <= 0) {
        stopTick();
        running = false;
        mode = "checkin";
        rerender();
      } else {
        updateTimerUI();
      }
    }, 250);

    mode = "running";
    rerender();
  }

  function stopEarly() {
    const now = Date.now();
    const elapsedMs = startAt ? clamp(now - startAt, 0, durationMin * 60 * 1000) : 0;

    stopTick();
    running = false;

    stoppedEarly = true;
    elapsedSec = Math.max(0, Math.round(elapsedMs / 1000));

    safeAppendLog({
      kind: "stop_urge_stop",
      when: nowISO(),
      minutesPlanned: durationMin,
      stoppedEarly: true,
      elapsedSec,
      build: BUILD,
    });

    mode = "checkin";
    rerender();
  }

  function logOutcome(outcome, note) {
    lastOutcome = outcome;

    safeAppendLog({
      kind: "stop_urge",
      when: nowISO(),
      minutes: durationMin,
      outcome, // passed | still_present
      note,
      stoppedEarly,
      elapsedSec,
      build: BUILD,
    });

    if (outcome === "passed") {
      try {
        setNextIntent("today_plan_prefill", {
          from: "stop_urge",
          targetStep: 1,
          text: `${durationMin}-min Stop the Urge`,
          templateId: "stability",
          defaultToStep: 2,
        });
      } catch {}
    }
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Stop the Urge"]),
        el("p", { class: "p" }, ["Pause. Interrupt the impulse."]),
        String(location.search || "").includes("debug=1")
          ? el("div", { class: "small" }, [`Build ${BUILD}`])
          : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el(
          "button",
          {
            class: "linkBtn",
            type: "button",
            onClick: () => {
              running = false;
              stopTick();
              location.hash = "#/home";
            },
          },
          ["Reset"]
        ),
      ]),
    ]);
  }

  function timerPanel() {
    if (!running) {
      return el("div", { class: "card cardPad" }, [
        sectionLabel("Pause"),
        el("p", { class: "p" }, ["A short window. Don’t act on the urge."]),
        el("p", { class: "small", style: "margin-top:8px" }, ["Urges rise, peak, and pass. Let this one move through."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => startPause(2) }, ["Start 2 min"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(5) }, ["Start 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Start 10 min"]),
        ]),
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      sectionLabel(`Active • ${durationMin} min`),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remainingMs())]),
        el("p", { class: "small", "data-timer-line": "1", style: "margin-top:10px;opacity:.95;" }, [timerLine()]),
        el("div", { class: "btnRow", style: "margin-top:10px" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function checkinCard() {
    if (mode !== "checkin") return null;

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Check-in"),
      el("p", { class: "p" }, ["What’s true right now?"]),
      el("div", { class: "btnRow" }, [
        el(
          "button",
          {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => {
              logOutcome("passed", "Urge passed.");
              mode = "closed";
              rerender();
            },
          },
          ["Urge passed"]
        ),
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              logOutcome("still_present", "Urge still present.");
              mode = "closed";
              rerender();
            },
          },
          ["Still present"]
        ),
      ]),
    ]);
  }

  function closureCard() {
    if (mode !== "closed") return null;

    const line =
      lastOutcome === "passed"
        ? "Some space opened up."
        : lastOutcome === "still_present"
          ? "The pattern slowed."
          : "A pause happened.";

    const nextStepBtn =
      lastOutcome === "passed"
        ? el(
            "button",
            {
              class: "btn",
              type: "button",
              onClick: () => (location.hash = "#/green/today"),
            },
            ["Next step"]
          )
        : null;

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Relief"),
      el("p", { class: "p" }, [line]),
      el("div", { class: "btnRow" }, [
        el(
          "button",
          {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => {
              mode = "idle";
              lastOutcome = null;
              rerender();
            },
          },
          ["Run again"]
        ),
        nextStepBtn,
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ].filter(Boolean)),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(timerPanel());

    const chk = checkinCard();
    if (chk) wrap.appendChild(chk);

    const cl = closureCard();
    if (cl) wrap.appendChild(cl);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
