import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "CALM-4";

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
function safeAppendLog(entry) { try { appendLog(entry); } catch {} }

export function renderCalm() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
  let durationMin = 2;
  let endAt = 0;
  let tick = null;

  let currentMode = "idle"; // idle | running | done | saved

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function start(min) {
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
        currentMode = "done";
        rerender();
      } else updateTimerUI();
    }, 250);

    currentMode = "running";
    rerender();
  }

  function stopEarly() {
    running = false;
    stopTick();
    currentMode = "idle";
    rerender();
  }

  function save(relief = null) {
    safeAppendLog({ kind: "calm", when: nowISO(), minutes: durationMin, relief, build: BUILD });
    currentMode = "saved";
    rerender();
  }

  function recent() {
    const log = readLog().filter(e => e.kind === "calm").slice(0, 6);
    if (!log.length) {
      return el("div", {}, [
        el("h2", { class: "h2" }, ["Recent calm"]),
        el("p", { class: "p" }, ["No entries yet."]),
      ]);
    }
    return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent calm"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Calm"]),
          el("div", { class: "small" }, [`${new Date(e.when).toLocaleString()} • ${e.minutes} min`]),
        ])
      )
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Calm Me Down"]),
        el("p", { class: "p" }, ["Lower intensity. Don’t solve anything yet."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function idleCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["2 minutes"]),
      el("p", { class: "p" }, ["Start. Exhale longer than you inhale. Drop your shoulders. Unclench your jaw."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => start(2) }, ["Start"]),
      ]),
      el("p", { class: "small" }, ["You don’t need to feel calm. Just stay."]),
    ]);
  }

  function runningCard() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Active • ${durationMin} min`]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        el("div", { class: "progressBar" }, [
          el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
        ]),
        el("p", { class: "small" }, ["Stay with it."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function doneCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Time’s up"]),
      el("p", { class: "p" }, ["Good. Don’t overdo it. Continue only if you need to."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => save() }, ["I’m okay"]),
        el("button", { class: "btn", type: "button", onClick: () => start(5) }, ["Continue 5 min"]),
        el("button", { class: "btn", type: "button", onClick: () => start(10) }, ["Continue 10 min"]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["If you’re still spiraling: run Stop the Urge next."]),
    ]);
  }

  function savedCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Saved"]),
      el("p", { class: "p" }, ["Now convert calm into action."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    if (currentMode === "running") wrap.appendChild(runningCard());
    else if (currentMode === "done") wrap.appendChild(doneCard());
    else if (currentMode === "saved") wrap.appendChild(savedCard());
    else wrap.appendChild(idleCard());

    wrap.appendChild(el("div", { class: "card cardPad" }, [recent()]));
    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
