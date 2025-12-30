// js/zones/yellow/calm.js  (FULL REPLACEMENT)

import { appendLog, grantStabilizeCreditToday, setNextIntent } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "CALM-6";

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

export function renderCalm() {
  const wrap = el("div", { class: "flowShell" });

  // modes: idle -> running -> early_stop -> done -> logged
  let mode = "idle";

  // timer state
  let running = false;
  let durationMin = 2;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // completion state
  let stoppedEarly = false;
  let elapsedSec = 0;

  safeAppendLog({ kind: "calm_open", when: nowISO(), build: BUILD });

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

  function start(min) {
    durationMin = min;
    running = true;
    stoppedEarly = false;
    elapsedSec = 0;

    startAt = Date.now();
    endAt = Date.now() + min * 60 * 1000;

    safeAppendLog({ kind: "calm_start", when: nowISO(), minutes: min, build: BUILD });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        mode = "done";
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
      kind: "calm_stop",
      when: nowISO(),
      minutesPlanned: durationMin,
      elapsedSec,
      build: BUILD
    });

    mode = "early_stop";
    rerender();
  }

  function logAndGoTodayStep2(outcome) {
    // “calm” counts as stabilize credit for today
    try { grantStabilizeCreditToday(); } catch {}

    safeAppendLog({
      kind: "calm",
      when: nowISO(),
      minutes: durationMin,
      outcome, // "calmer" | "not_yet"
      stoppedEarly,
      elapsedSec,
      build: BUILD
    });

    // handoff: default Today Plan to Step 2
    try { setNextIntent("today_plan_step2"); } catch {}
    location.hash = "#/green/today";
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Calm Me Down"]),
        el("p", { class: "p" }, ["Lower intensity first. Then choose your next step."]),
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

  function guideCard() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Do this during the timer"]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Inhale 4"]),
          el("div", { class: "small" }, ["Through the nose. Shoulders down."]),
        ]),
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Exhale 6"]),
          el("div", { class: "small" }, ["Longer exhale tells the body: safe."]),
        ]),
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Name 3 things you see"]),
          el("div", { class: "small" }, ["Anchor attention outside the story."]),
        ]),
      ])
    ]);
  }

  function timerCard() {
    if (!running) {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Choose a window"]),
        el("p", { class: "p" }, ["Start the timer. Don’t “solve” anything during it."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => start(2) }, ["Start 2 min"]),
          el("button", { class: "btn", type: "button", onClick: () => start(5) }, ["Start 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => start(10) }, ["Start 10 min"]),
        ]),
      ]);
    }

    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Active • ${durationMin} min window`]),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
        el("div", { class: "progressBar" }, [
          el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ])
    ]);
  }

  function statusCard() {
    if (mode === "early_stop") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Stopped early"]),
        el("p", { class: "p" }, [`You stayed with it for ${elapsedSec}s. Let’s still do a check-out.`]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => { mode = "done"; rerender(); } }, ["Continue"]),
          el("button", { class: "btn", type: "button", onClick: () => { mode = "idle"; rerender(); } }, ["Back"]),
        ]),
      ]);
    }

    if (mode === "done") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Check-out"]),
        el("p", { class: "p" }, ["What’s true right now?"]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn btnPrimary",
            type: "button",
            onClick: () => { mode = "logged"; logAndGoTodayStep2("calmer"); }
          }, ["Calmer"]),
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => { mode = "logged"; rerender(); }
          }, ["Not yet"]),
        ]),
      ]);
    }

    if (mode === "logged") {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Next move"]),
        el("p", { class: "p" }, ["If you’re not calm yet, don’t debate. Change state."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
          el("button", { class: "btn", type: "button", onClick: () => { mode = "idle"; rerender(); } }, ["Run Calm again"]),
        ]),
      ]);
    }

    return null;
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(timerCard());
    wrap.appendChild(guideCard());
    const s = statusCard();
    if (s) wrap.appendChild(s);
    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
