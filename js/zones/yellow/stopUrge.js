/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/yellow/stopUrge.js (FULL REPLACEMENT)
import { appendLog, setNextIntent } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "SU-13";

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
  try {
    appendLog(entry);
  } catch {}
}

function sectionLabel(text) {
  // Avoid "badge" UI to comply with GOVERNANCE.md
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
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
      "I’m tied up right now. I’ll get back to you later.",
    ],
  },
  {
    id: "boundary",
    title: "Boundary",
    desc: "Clear. No debate.",
    variants: [
      "I’m taking space and won’t be engaging. Please respect that.",
      "I’m not available for this conversation. Please stop contacting me about it.",
      "I’m stepping back. I won’t respond further right now.",
    ],
  },
  {
    id: "logistics",
    title: "Logistics only",
    desc: "Keep it practical.",
    variants: [
      "I can handle logistics. I’m not discussing anything else.",
      "I’ll respond only to practical logistics. I’m not discussing the relationship.",
      "If this is about logistics, I can reply. Otherwise I’m not engaging.",
    ],
  },
  {
    id: "deescalate",
    title: "De-escalate",
    desc: "Lower heat. Exit cleanly.",
    variants: [
      "I’m not going to argue. I’m stepping away for now.",
      "This isn’t productive. I’m going to pause and revisit later.",
      "I’m going to end this conversation now.",
    ],
  },
];

export function renderStopUrge() {
  const wrap = el("div", { class: "flowShell" });

  // timer state
  let running = false;
  let durationMin = 2;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // scripts state
  let selectedSetId = "neutral";
  let selectedVariantIndex = 0;

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

  function updateTimerUI() {
    const readout = wrap.querySelector("[data-timer-readout]");
    if (readout) readout.textContent = formatMMSS(remainingMs());
  }

  function selectedScriptText() {
    const set = SCRIPT_SETS.find((s) => s.id === selectedSetId) || SCRIPT_SETS[0];
    return {
      setId: set.id,
      setTitle: set.title,
      optionIndex: selectedVariantIndex,
      text: set.variants[selectedVariantIndex] || set.variants[0],
      desc: set.desc,
    };
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

    // Early stop is valid use: go to check-in without interrogation
    mode = "checkin";
    rerender();
  }

  function logOutcome(outcome, note) {
    lastOutcome = outcome;
    const s = selectedScriptText();

    // Canonical event: storage.js decides stabilize credit.
    safeAppendLog({
      kind: "stop_urge",
      when: nowISO(),
      minutes: durationMin,
      outcome, // passed | still_present
      note,
      stoppedEarly,
      elapsedSec,
      scriptSetId: s.setId,
      scriptSetTitle: s.setTitle,
      scriptOption: (s.optionIndex ?? 0) + 1,
      build: BUILD,
    });

    // Non-pushy handoff: if the urge passed, make Today Plan open to Step 2 when they choose it.
    if (outcome === "passed") {
      try {
        setNextIntent("today_plan_step2");
      } catch {}
    }
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Stop the Urge"]),
        el("p", { class: "p" }, ["Pause. Add friction."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
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
        el("p", { class: "p" }, ["A short window. No sending."]),
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
        // NOTE: progress bars intentionally removed per GOVERNANCE.md
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function scriptsPanel() {
    const s = selectedScriptText();

    const setButtons = el(
      "div",
      { class: "btnRow" },
      SCRIPT_SETS.map((set) =>
        el(
          "button",
          {
            class: `btn ${set.id === selectedSetId ? "btnPrimary" : ""}`.trim(),
            type: "button",
            onClick: () => {
              selectedSetId = set.id;
              selectedVariantIndex = 0;
              rerender();
            },
          },
          [set.title]
        )
      )
    );

    const preview = el(
      "div",
      { class: "card cardPad", style: "background:rgba(255,255,255,.04);border:1px solid var(--line);" },
      [
        sectionLabel("Preview"),
        el("p", { class: "p", style: "margin-top:8px;font-weight:800;color:var(--text);" }, [s.text]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => copyToClipboard(s.text) }, ["Copy"]),
        ]),
        el("p", { class: "small", style: "margin-top:8px" }, [
          "If copy is blocked on mobile, it will pop up so you can copy manually.",
        ]),
      ]
    );

    const variants = el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["Options"]),
      el("p", { class: "small" }, [s.desc]),
      el(
        "div",
        { class: "btnRow" },
        (SCRIPT_SETS.find((x) => x.id === selectedSetId)?.variants || []).map((_, idx) =>
          el(
            "button",
            {
              class: `btn ${idx === selectedVariantIndex ? "btnPrimary" : ""}`.trim(),
              type: "button",
              onClick: () => {
                selectedVariantIndex = idx;
                rerender();
              },
            },
            [`Option ${idx + 1}`]
          )
        )
      ),
    ]);

    return el("div", { class: "flowShell" }, [el("h2", { class: "h2" }, ["Scripts"]), setButtons, preview, variants]);
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
      lastOutcome === "passed" ? "Some space opened up." : lastOutcome === "still_present" ? "The pattern slowed." : "A pause happened.";

    const nextStepBtn =
      lastOutcome === "passed"
        ? el(
            "button",
            {
              class: "btn",
              type: "button",
              onClick: () => {
                // intent already set inside logOutcome when passed, but keep resilient
                try {
                  setNextIntent("today_plan_step2");
                } catch {}
                location.hash = "#/green/today";
              },
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

    // scripts are optional support; keep visible but not pushy
    wrap.appendChild(el("div", { class: "card cardPad" }, [scriptsPanel()]));

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
