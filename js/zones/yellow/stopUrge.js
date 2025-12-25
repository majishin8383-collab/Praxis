import { appendLog, readLog } from "../../storage.js";
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
  let endAt = 0;
  let tick = null;

  let selectedSetId = "neutral";
  let selectedVariantIndex = 0;

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

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
    durationMin = min;
    endAt = Date.now() + min * 60 * 1000;

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        rerender("pause_done");
      } else updateTimerUI();
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

  function logOutcome(outcome, note) {
    appendLog({
      kind: "stop_urge",
      when: nowISO(),
      minutes: durationMin,
      outcome,
      note
    });
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
            }`
          ]),
          e.note ? el("div", { class: "small" }, [e.note]) : null,
        ])
      )
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Stop the Urge"]),
        el("p", { class: "p" }, ["Pause. Add friction. Protect your future self."]),
      ]),
      // Reset button hidden by CSS; safe to keep
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
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
        el("p", { class: "small" }, ["Delay beats regret."]),
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
        el("button", { class: "btn", type: "button", onClick: () => { running = false; stopTick(); rerender("idle"); } }, ["Stop"]),
      ]),
      el("p", { class: "small" }, ["If compelled: copy a script instead of improvising."]),
    ]);
  }

  function scriptsPanel() {
    const set = SCRIPT_SETS.find(s => s.id === selectedSetId) || SCRIPT_SETS[0];
    const text = set.variants[selectedVariantIndex] || set.variants[0];

    const preview = el("div", {
      class: "card cardPad",
      style: "background:rgba(255,255,255,.04);border:1px solid var(--line);"
    }, [
      el("div", { class: "badge" }, ["Preview"]),
      el("p", { class: "p", style: "margin-top:8px;font-weight:800;color:var(--text);" }, [text]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => copyToClipboard(text) }, ["Copy this"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Tip: If copy is blocked on mobile, it will pop up so you can copy manually."])
    ]);

    const setButtons = el("div", { class: "btnRow" }, SCRIPT_SETS.map(s =>
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => { selectedSetId = s.id; selectedVariantIndex = 0; rerender("idle"); }
      }, [s.title])
    ));

    const variants = el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["Options"]),
      el("p", { class: "small" }, [set.desc]),
      el("div", { class: "btnRow" }, set.variants.map((v, idx) =>
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { selectedVariantIndex = idx; rerender("idle"); }
        }, [`Option ${idx + 1}`])
      )),
    ]);

    return el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["Scripts"]),
      el("p", { class: "p" }, ["Pick a category, preview, then copy."]),
      setButtons,
      preview,
      variants,
    ]);
  }

  function outcomePanel() {
    return el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["After the pause"]),
      el("p", { class: "p" }, ["Choose the truth. This keeps Praxis honest and useful."]),
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
      el("p", { class: "small" }, ["If it’s still present: extend the pause, then choose again."]),
    ]);
  }

  function rerender(mode) {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    const card1 = el("div", { class: "card cardPad" }, [
      el("h2", { class: "h2" }, ["Pause"]),
      timerPanel(),
    ]);

    const card2 = el("div", { class: "card cardPad" }, [scriptsPanel()]);

    const card3 = el("div", { class: "card cardPad" }, [
      mode === "pause_done"
        ? el("div", {}, [
            el("div", { class: "badge" }, ["Pause complete"]),
            el("p", { class: "p" }, ["Good. Now choose what’s true right now."]),
            outcomePanel(),
          ])
        : mode === "logged"
        ? el("div", {}, [
            el("div", { class: "badge" }, ["Saved"]),
            el("p", { class: "p" }, ["Logged. Return Home or run it again."]),
            el("div", { class: "btnRow" }, [
              el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Reset"]),
              el("button", { class: "btn", type: "button", onClick: () => rerender("idle") }, ["Run again"]),
            ]),
          ])
        : el("div", {}, [
            el("div", { class: "badge" }, ["When you’re ready"]),
            el("p", { class: "p" }, ["Start a pause. If needed, use a script."]),
            el("p", { class: "small" }, ["Outcome selection appears when the timer ends."]),
          ])
    ]);

    const logCard = el("div", { class: "card cardPad" }, [recentLogs()]);

    wrap.appendChild(card1);
    wrap.appendChild(card2);
    wrap.appendChild(card3);
    wrap.appendChild(logCard);

    if (running) updateTimerUI();
  }

  rerender("idle");
  return wrap;
}
