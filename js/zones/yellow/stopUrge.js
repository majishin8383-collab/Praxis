import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function nowISO() {
  return new Date().toISOString();
}

// Universal, short, non-escalatory scripts.
const SCRIPTS = [
  {
    label: "Neutral: later",
    text: "Got your message. I’m not available right now. I’ll reply later."
  },
  {
    label: "Boundary",
    text: "I’m taking space and won’t be engaging. Please respect that."
  },
  {
    label: "No explanation",
    text: "I’m not going to discuss this."
  },
  {
    label: "Logistics only",
    text: "I can handle logistics. I’m not discussing anything else."
  }
];

export function renderStopUrge() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
  let baseMin = 2;
  let durationMin = baseMin;
  let endAt = 0;
  let tick = null;

  function stopTick() {
    if (tick) window.clearInterval(tick);
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
    durationMin = min;
    endAt = Date.now() + min * 60 * 1000;

    stopTick();
    tick = window.setInterval(() => {
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

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        window.prompt("Copy this message:", text);
      });
    } else {
      window.prompt("Copy this message:", text);
    }
  }

  function logOutcome(outcome, note) {
    appendLog({
      kind: "stop_urge",
      when: nowISO(),
      minutes: durationMin,
      outcome, // "passed" | "still_present"
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
        el("p", { class: "p" }, ["Your job: don’t send anything during the pause. Let the urge peak and fall."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => startPause(2) }, ["Start 2-minute pause"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(5) }, ["Start 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Start 10 min"]),
        ]),
        el("p", { class: "small" }, ["This is about delay, not perfection."]),
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
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { running = false; stopTick(); rerender("stopped"); }
        }, ["Stop"]),
      ]),
      el("p", { class: "small" }, ["If you feel compelled, copy a script instead of improvising."]),
    ]);
  }

  function scriptsPanel() {
    return el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["Scripts (tap to copy)"]),
      el("p", { class: "p" }, ["Short. Neutral. No explaining."]),
      el("div", { class: "btnRow" }, SCRIPTS.map(s =>
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => copyToClipboard(s.text),
        }, [s.label])
      )),
      el("div", { class: "card cardPad" }, [
        el("div", { class: "small" }, ["Tip: If copy is blocked on mobile, it will pop up so you can copy manually."])
      ])
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
