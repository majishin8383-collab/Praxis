// js/zones/yellow/calm.js (FULL REPLACEMENT)
import { appendLog, setNextIntent } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "CALM-8";

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

export function renderCalm() {
  const wrap = el("div", { class: "flowShell" });

  // modes: idle -> running -> stopped -> done
  let mode = "idle";

  // timer state
  let running = false;
  let durationMin = 2;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // bookkeeping
  let stoppedEarly = false;
  let elapsedSec = 0;

  safeAppendLog({ kind: "calm_open", when: nowISO(), build: BUILD });

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
      if (endAt - Date.now() <= 0) {
        stopTick();
        running = false;
        mode = "done";
        safeAppendLog({
          kind: "calm_end",
          when: nowISO(),
          minutesPlanned: durationMin,
          stoppedEarly: false,
          elapsedSec: durationMin * 60,
          build: BUILD,
        });
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
      stoppedEarly: true,
      elapsedSec,
      build: BUILD,
    });

    mode = "stopped";
    rerender();
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Calm Me Down"]),
        el("p", { class: "p" }, ["Lower intensity first."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => { running = false; stopTick(); location.hash = "#/home"; } }, ["Reset"]),
      ]),
    ]);
  }

  function timerCard() {
    if (!running) {
      return el("div", { class: "card cardPad" }, [
        sectionLabel("Timer"),
        el("p", { class: "p" }, ["A short window. No solving."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => start(2) }, ["Start 2 min"]),
          el("button", { class: "btn", type: "button", onClick: () => start(5) }, ["Start 5 min"]),
          el("button", { class: "btn", type: "button", onClick: () => start(10) }, ["Start 10 min"]),
        ]),
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      sectionLabel(`Active • ${durationMin} min`),
      el("div", { class: "timerBox" }, [
        el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remainingMs())]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function guideCard() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("During the timer"),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Inhale 4"]),
          el("div", { class: "small" }, ["Through the nose. Shoulders down."]),
        ]),
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Exhale 6"]),
          el("div", { class: "small" }, ["A longer exhale can soften intensity."]),
        ]),
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Name 3 things you see"]),
          el("div", { class: "small" }, ["Anchor attention outside the story."]),
        ]),
      ]),
    ]);
  }

  function closureCard() {
    if (mode !== "stopped" && mode !== "done") return null;

    const stateLine = stoppedEarly ? "Stopping here is allowed." : "Nothing else is required of you right now.";

    function goTodayPlan() {
      // Option B: after Stabilize, open Today’s Plan focused on Step 2 (Act),
      // and prefill Step 1 only if it’s empty.
      const label = `${durationMin}-min Calm`;
      try {
        setNextIntent("today_plan_prefill", {
          from: "calm",
          targetStep: 1,
          text: label,
          templateId: "stability",
          defaultToStep: 2,
        });
      } catch {}
      location.hash = "#/green/today";
    }

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Rest"),
      el("p", { class: "p" }, [stateLine]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => { mode = "idle"; rerender(); } }, ["Run Calm again"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
        el("button", { class: "btn", type: "button", onClick: goTodayPlan }, ["Today’s Plan"]),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(timerCard());
    wrap.appendChild(guideCard());

    const c = closureCard();
    if (c) wrap.appendChild(c);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
