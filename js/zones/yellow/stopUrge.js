// js/zones/yellow/stopUrge.js  (FULL REPLACEMENT)

import { appendLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";
import { grantStabilizeCreditToday, setNextIntent } from "../../state/handoff.js";

const BUILD = "SU-9";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
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

  // timer
  let running = false;
  let durationMin = 2;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // scripts (optional panel)
  let showScripts = false;
  let selectedSetId = "neutral";
  let selectedVariantIndex = 0;

  // modes: idle | running | early_stop | pause_done | logged
  let mode = "idle";
  let lastOutcome = null; // "passed" | "still_present" | null

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
        mode = "pause_done";
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
      kind: "stop_urge_extend",
      when: nowISO(),
      minutesNow: durationMin,
      extraMin,
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
      kind: "stop_urge_stop",
      when: nowISO(),
      minutesPlanned: durationMin,
      elapsedSec: Math.round(elapsedMs / 1000),
      remainingSec: Math.round(remainingMs / 1000),
      build: BUILD
    });

    mode = "early_stop";
    rerender();
  }

  function selectedScriptText() {
    const set = SCRIPT_SETS.find(s => s.id === selectedSetId) || SCRIPT_SETS[0];
    return {
      setId: set.id,
      setTitle: set.title,
      optionIndex: selectedVariantIndex,
      text: set.variants[selectedVariantIndex] || set.variants[0],
      desc: set.desc
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

    // stabilize credit when urge passes (soft guidance only)
    if (outcome === "passed") {
      try { grantStabilizeCreditToday(); } catch {}
    }
  }

  function goTodayPlanStep2() {
    try { setNextIntent("today_plan_step2"); } catch {}
    location.hash = "#/green/today";
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

  function pauseCard() {
    if (!running) {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Pause"]),
        el("p", { class: "p" }, ["Don’t send anything during the pause. Let the urge peak and fall."]),
        el("div", { class: "btnRow", style: "margin-top:10px" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => startPause(2) }, ["Start 2 min"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(5) }, ["Start 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Start 10 min"]),
        ]),
        el("p", { class: "small", style: "margin-top:10px" }, ["Rule: if you’re about to act, start 10 minutes."])
      ]);
    }

    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Pause active • ${durationMin} min window`]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        el("div", { class: "progressBar" }, [
          el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => extend(5) }, ["+5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => extend(10) }, ["+10 min"]),
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function statusCard() {
    if (mode === "early_stop") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You paused for ${earlyStopElapsedSec}s. Why are you stopping?`]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { earlyStopReason = "safe"; mode = "pause_done"; rerender(); }
          }, ["It dropped / situation ended"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { earlyStopReason = "bailed"; mode = "logged"; lastOutcome = "still_present"; rerender(); }
          }, ["Still hot / about to act"]),
        ]),
        el("p", { class: "small", style: "margin-top:10px" }, ["Honesty helps Praxis guide you correctly."]),
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
            onClick: () => { logOutcome("passed", "Urge passed."); mode = "logged"; rerender(); }
          }, ["Urge passed"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { logOutcome("still_present", "Urge still present."); mode = "logged"; rerender(); }
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

      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, [headline]),
        el("div", { class: "btnRow" }, [
          passed
            ? el("button", { class: "btn btnPrimary", type: "button", onClick: goTodayPlanStep2 }, ["Today’s Plan"])
            : el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
          passed
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"])
            : el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Start 10 min"]),
          still
            ? el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"])
            : el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"]),
        ].filter(Boolean)),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => { mode = "idle"; rerender(); } }, ["Run again"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { showScripts = true; rerender(); }
          }, ["Open scripts"])
        ]),
      ]);
    }

    // idle/running helper text (kept minimal)
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Rule"]),
      el("p", { class: "p" }, ["If you’re about to act: start 10 minutes."]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { showScripts = !showScripts; rerender(); }
        }, [showScripts ? "Hide scripts" : "Scripts (optional)"]),
      ])
    ]);
  }

  function scriptsCard() {
    if (!showScripts) return null;

    const set = SCRIPT_SETS.find(s => s.id === selectedSetId) || SCRIPT_SETS[0];
    const text = set.variants[selectedVariantIndex] || set.variants[0];

    const setButtons = el("div", { class: "btnRow" }, SCRIPT_SETS.map(s =>
      el("button", {
        class: `btn ${s.id === selectedSetId ? "btnPrimary" : ""}`.trim(),
        type: "button",
        onClick: () => { selectedSetId = s.id; selectedVariantIndex = 0; rerender(); }
      }, [s.title])
    ));

    const preview = el("div", { class: "card cardPad", style: "background:rgba(255,255,255,.04);border:1px solid var(--line);" }, [
      el("div", { class: "badge" }, ["Preview"]),
      el("p", { class: "p", style: "margin-top:8px;font-weight:800;color:var(--text);" }, [text]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => copyToClipboard(text) }, ["Copy this"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["If copy is blocked on mobile, it will pop up so you can copy manually."])
    ]);

    const variants = el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["Options"]),
      el("p", { class: "small" }, [set.desc]),
      el("div", { class: "btnRow" }, set.variants.map((v, idx) =>
        el("button", {
          class: `btn ${idx === selectedVariantIndex ? "btnPrimary" : ""}`.trim(),
          type: "button",
          onClick: () => { selectedVariantIndex = idx; rerender(); }
        }, [`Option ${idx + 1}`])
      )),
    ]);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Scripts (optional)"]),
      setButtons,
      preview,
      variants,
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => { showScripts = false; rerender(); } }, ["Close scripts"]),
      ])
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(pauseCard());
    wrap.appendChild(statusCard());
    const sc = scriptsCard();
    if (sc) wrap.appendChild(sc);
    if (running) updateTimerUI();
  }

  // if timer ends, mode will flip to pause_done inside interval
  // if they stop early, mode flips to early_stop
  // otherwise default is idle
  mode = "idle";
  rerender();
  return wrap;
}
