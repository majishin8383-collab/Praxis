import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "SU-7";

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

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => window.prompt("Copy this message:", text));
  } else {
    window.prompt("Copy this message:", text);
  }
}

const SCRIPT_SETS = [
  {
    id: "neutral",
    title: "Neutral (later)",
    desc: "Short. Calm. No fuel.",
    variants: [
      "Got your message. I’m not available right now. I’ll reply later.",
      "I saw this. I can’t talk right now. I’ll respond later.",
      "I’m tied up right now. I’ll get back to you later."
    ]
  },
  {
    id: "boundary",
    title: "Boundary",
    desc: "Clear. No debate.",
    variants: [
      "I’m taking space and won’t be engaging. Please respect that.",
      "I’m not available for this conversation. Please stop contacting me about it.",
      "I’m stepping back. I won’t respond further right now."
    ]
  },
  {
    id: "logistics",
    title: "Logistics only",
    desc: "Keep it practical.",
    variants: [
      "I can handle logistics. I’m not discussing anything else.",
      "I’ll respond only to practical logistics. I’m not discussing the relationship.",
      "If this is about logistics, I can reply. Otherwise I’m not engaging."
    ]
  },
  {
    id: "deescalate",
    title: "De-escalate",
    desc: "Lower heat. Exit cleanly.",
    variants: [
      "I’m not going to argue. I’m stepping away for now.",
      "This isn’t productive. I’m going to pause and revisit later.",
      "I’m going to end this conversation now."
    ]
  }
];

export function renderStopUrge() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
  let durationMin = 2;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  let selectedSetId = "neutral";
  let selectedVariantIndex = 0;

  let currentMode = "idle"; // "idle" | "running" | "pause_done" | "early_stop" | "logged"
  let lastOutcome = null;   // "passed" | "still_present" | null

  // early stop telemetry
  let stoppedEarly = false;
  let earlyStopElapsedSec = 0;
  let earlyStopReason = null; // "safe" | "bailed" | null

  safeAppendLog({ kind: "stop_urge_open", when: nowISO(), build: BUILD });

  function stopTick() {
    if (tick) clearInterval(tick);
    tick = null;
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function startPause(min) {
    running = true;
    lastOutcome = null;

    stoppedEarly = false;
    earlyStopElapsedSec = 0;
    earlyStopReason = null;

    durationMin = min;
    startAt = Date.now();
    endAt = Date.now() + min * 60 * 1000;

    safeAppendLog({ kind: "stop_urge_start", when: nowISO(), minutes: min, build: BUILD });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        rerender("pause_done");
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
    rerender("running");
  }

  function selectedScriptText() {
    const set = SCRIPT_SETS.find(s => s.id === selectedSetId) || SCRIPT_SETS[0];
    return {
      setId: set.id,
      setTitle: set.title,
      optionIndex: selectedVariantIndex,
      text: set.variants[selectedVariantIndex] || set.variants[0]
    };
  }

  function logOutcome(outcome, note) {
    lastOutcome = outcome;
    const s = selectedScriptText();

    safeAppendLog({
      kind: "stop_urge",
      when: nowISO(),
      minutes: durationMin,
      outcome,
      note,
      stoppedEarly,
      earlyStopReason,
      earlyStopElapsedSec,
      scriptSetId: s.setId,
      scriptSetTitle: s.setTitle,
      scriptOption: (s.optionIndex ?? 0) + 1,
      build: BUILD
    });
  }

  function stopEarly() {
    const now = Date.now();
    const elapsedMs = startAt ? clamp(now - startAt, 0, durationMin * 60 * 1000) : 0;
    const remainingMs = clamp(endAt - now, 0, durationMin * 60 * 1000);

    stopTick();
    running = false;

    stoppedEarly = true;
    earlyStopElapsedSec = Math.max(0, Math.round(elapsedMs / 1000));

    safeAppendLog({
      kind: "stop_urge_stop",
      when: nowISO(),
      minutesPlanned: durationMin,
      elapsedSec: Math.round(elapsedMs / 1000),
      remainingSec: Math.round(remainingMs / 1000),
      build: BUILD
    });

    rerender("early_stop");
  }

  function recentLogs() {
    const log = readLog().filter(e => e.kind === "stop_urge").slice(0, 6);
    if (!log.length) {
      return el("div", {}, [
        el("h2", { class: "h2" }, ["Recent Stop the Urge sessions"]),
        el("p", { class: "p" }, ["No entries yet. Run it once to create history automatically."]),
      ]);
    }
    return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent Stop the Urge sessions"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Stop the Urge"]),
          el("div", { class: "small" }, [
            `${new Date(e.when).toLocaleString()} • ${e.minutes ?? ""} min • ${
              e.outcome === "passed" ? "Urge passed" : "Urge still present"
            }${e.stoppedEarly ? " • stopped early" : ""}`
          ]),
        ])
      )
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Stop the Urge"]),
        el("p", { class: "p" }, ["Pause. Add friction. Protect your future self."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", {
          class: "linkBtn",
          type: "button",
          onClick: () => { running = false; stopTick(); location.hash = "#/home"; }
        }, ["Reset"]),
      ])
    ]);
  }

  function timerPanel() {
    if (!running) {
      return el("div", { class: "flowShell" }, [
        el("div", { class: "badge" }, ["Default pause: 2 minutes"]),
        el("p", { class: "p" }, ["Don’t send anything during the pause. Let the urge peak and fall."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => startPause(2) }, ["Start 2-minute pause"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(5) }, ["Start 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Start 10 min"]),
        ]),
      ]);
    }

    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "timerBox" }, [
      el("div", { class: "badge" }, [`Pause active • ${durationMin} min window`]),
      el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
      el("div", { class: "progressBar" }, [
        el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => extend(5) }, ["+5 min"]),
        el("button", { class: "btn", type: "button", onClick: () => extend(10) }, ["+10 min"]),
        el("button", { class: "btn", type: "button", onClick: () => stopEarly() }, ["Stop"]),
      ]),
    ]);
  }

  function scriptsPanel() {
    const set = SCRIPT_SETS.find(s => s.id === selectedSetId) || SCRIPT_SETS[0];
    const text = set.variants[selectedVariantIndex] || set.variants[0];

    const setButtons = el("div", { class: "btnRow" }, SCRIPT_SETS.map(s =>
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => { selectedSetId = s.id; selectedVariantIndex = 0; rerender(currentMode); }
      }, [s.title])
    ));

    const preview = el("div", {
      class: "card cardPad",
      style: "background:rgba(255,255,255,.04);border:1px solid var(--line);"
    }, [
      el("div", { class: "badge" }, ["Preview"]),
      el("p", { class: "p", style: "margin-top:8px;font-weight:800;color:var(--text);" }, [text]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => copyToClipboard(text) }, ["Copy this"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["If copy is blocked on mobile, it will pop up so you can copy manually."])
    ]);

    const variants = el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["Options"]),
      el("p", { class: "small" }, [set.desc]),
      el("div", { class: "btnRow" }, set.variants.map((v, idx) =>
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { selectedVariantIndex = idx; rerender(currentMode); }
        }, [`Option ${idx + 1}`])
      )),
    ]);

    return el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["Scripts"]),
      setButtons,
      preview,
      variants,
    ]);
  }

  function statusCard(mode) {
    if (mode === "early_stop") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [
          `You paused for ${earlyStopElapsedSec}s. Why are you stopping?`
        ]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { earlyStopReason = "safe"; rerender("pause_done"); }
          }, ["It dropped / situation ended"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              earlyStopReason = "bailed";
              // route to the “do-not-improvise” path immediately
              rerender("logged");
              lastOutcome = "still_present";
            }
          }, ["I’m still hot / about to act"]),
        ]),
        el("p", { class: "small", style: "margin-top:10px" }, [
          "Honesty helps Praxis guide you correctly."
        ]),
      ]);
    }

    if (mode === "pause_done") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, [stoppedEarly ? "Check-in" : "Pause complete"]),
        el("p", { class: "p" }, ["Choose what’s true right now."]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { logOutcome("passed", "Urge passed."); rerender("logged"); }
          }, ["Urge passed"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { logOutcome("still_present", "Urge still present."); rerender("logged"); }
          }, ["Still present"]),
        ]),
      ]);
    }

    if (mode === "logged") {
      const passed = lastOutcome === "passed";
      const still = lastOutcome === "still_present";

      const headline =
        still && earlyStopReason === "bailed"
          ? "Don’t improvise. Change state or add time."
          : passed
          ? "Good. Convert that win into motion."
          : still
          ? "Okay. Don’t improvise. Change state or add more time."
          : "Logged. Choose the next right action.";

      // If they bailed, we should not pretend it’s logged as passed.
      // If they bailed, we also encourage Emergency as a clean exit option.
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [headline]),
        el("div", { class: "btnRow" }, [
          passed
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),

          passed
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/next") }, ["Find Next Step"])
            : el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Start 10 min"]),

          still
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"]),
        ].filter(Boolean)),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => rerender("idle") }, ["Run again"]),
        ]),
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["When you’re ready"]),
      el("p", { class: "p" }, ["Start a pause. If needed, use a script."]),
    ]);
  }

  function rerender(mode) {
    currentMode = mode;
    wrap.innerHTML = "";
    wrap.appendChild(header());

    const pauseCard = el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Pause"]),
      timerPanel(),
    ]);

    const status = statusCard(mode);
    const scriptsCard = el("div", { class: "card cardPad" }, [scriptsPanel()]);
    const logCard = el("div", { class: "card cardPad" }, [recentLogs()]);

    wrap.appendChild(pauseCard);
    wrap.appendChild(status);
    wrap.appendChild(scriptsCard);
    wrap.appendChild(logCard);

    if (running) updateTimerUI();
  }

  rerender("idle");
  return wrap;
}
