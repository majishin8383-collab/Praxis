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

const SCRIPTS = [
  { label: "Copy & Send: Later", text: "Got your message. I’m not available to talk right now. I’ll reply later." },
  { label: "Copy & Send: Boundary", text: "I’m taking space right now and won’t be engaging. Please respect that." },
  { label: "Copy & Send: Coparent only", text: "I can discuss anything related to our child. Anything else I’m not engaging with." },
];

export function renderStopUrge() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
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

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => window.prompt("Copy this message:", text));
    } else window.prompt("Copy this message:", text);
  }

  function logOutcome(outcome) {
    appendLog({ kind: "stop_urge", when: nowISO(), minutes: durationMin, outcome });
  }

  function recent() {
    const log = readLog().filter(e => e.kind === "stop_urge").slice(0, 6);
    if (!log.length) return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent uses"]),
      el("p", { class: "p" }, ["No entries yet."]),
    ]);
    return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent uses"]),
      ...log.map(e => el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["Stop the Urge"]),
        el("div", { class: "small" }, [`${new Date(e.when).toLocaleString()} • ${e.minutes} min • ${e.outcome}`]),
      ]))
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Stop the Urge"]),
        el("p", { class: "p" }, ["Pause before acting."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function pausePanel() {
    if (!running) {
      return el("div", { class: "flowShell" }, [
        el("div", { class: "badge" }, ["You do not need to decide anything yet."]),
        el("p", { class: "p" }, ["Start a pause. Don’t send anything during it. Let the urge peak and fall without feeding it."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => startPause(2) }, ["Start pause (2 min)"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(5) }, ["Pause (5 min)"]),
          el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Pause (10 min)"]),
        ]),
        el("p", { class: "small" }, ["Urges rise and fall if you don’t feed them."]),
      ]);
    }

    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);

    return el("div", { class: "timerBox" }, [
      el("div", { class: "badge" }, [`Pause active • ${durationMin} min`]),
      el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
      el("div", { class: "progressBar" }, [ el("div", { class: "progressFill", "data-progress-fill": "1" }, []) ]),
      el("p", { class: "small" }, ["If you feel compelled, use a script instead of improvising."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => extend(5) }, ["Continue pause (+5)"]),
        el("button", { class: "btn", type: "button", onClick: () => extend(10) }, ["Continue (+10)"]),
        el("button", { class: "btn", type: "button", onClick: () => { running = false; stopTick(); rerender("idle"); } }, ["Stop"]),
      ]),
    ]);
  }

  function scriptsPanel() {
    return el("div", { class: "flowShell" }, [
      el("h2", { class: "h2" }, ["Use a script instead of improvising"]),
      el("p", { class: "p" }, ["Copy & send. Keep it short. No explaining."]),
      el("div", { class: "btnRow" }, SCRIPTS.map(s =>
        el("button", { class: "btn", type: "button", onClick: () => copyToClipboard(s.text) }, [s.label])
      )),
      el("div", { class: "card cardPad" }, [
        el("div", { class: "small" }, ["Using a script protects your future self."])
      ]),
    ]);
  }

  function outcomePanel() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["Pause complete"]),
      el("p", { class: "p" }, ["Choose what’s true right now."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => { logOutcome("The urge passed"); rerender("passed"); } }, ["The urge passed"]),
        el("button", { class: "btn", type: "button", onClick: () => { logOutcome("It’s still there"); rerender("still"); } }, ["It’s still there"]),
      ]),
    ]);
  }

  function passedPanel() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["Good. You didn’t act. That matters."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
      ]),
    ]);
  }

  function stillPanel() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["That’s okay. Add more distance."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => startPause(5) }, ["Continue pause (5 min)"]),
        el("button", { class: "btn", type: "button", onClick: () => startPause(10) }, ["Continue pause (10 min)"]),
      ]),
    ]);
  }

  function rerender(mode) {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    wrap.appendChild(el("div", { class: "card cardPad" }, [pausePanel()]));
    wrap.appendChild(el("div", { class: "card cardPad" }, [scriptsPanel()]));
    wrap.appendChild(el("div", { class: "card cardPad" }, [
      mode === "pause_done" ? outcomePanel()
      : mode === "passed" ? passedPanel()
      : mode === "still" ? stillPanel()
      : el("div", { class: "flowShell" }, [el("div", { class: "badge" }, ["When you’re ready"])])
    ]));
    wrap.appendChild(el("div", { class: "card cardPad" }, [recent()]));

    if (running) updateTimerUI();
  }

  rerender("idle");
  return wrap;
}
