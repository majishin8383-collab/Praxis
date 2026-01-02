// js/zones/green/moveForward.js (FULL REPLACEMENT)
import { appendLog, setNextIntent, consumeNextIntent } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "MF-16";

// light persistence so "Quick start" feels smart without being complex
const KEY_LAST = "praxis_move_forward_last_v1";

// Step 3 unlock credit (day stamp) — used by Today Plan
const KEY_TP3_CREDIT_DAY = "praxis_today_plan_step3_credit_day_v1";

// Uses device-local day stamp.
function localDayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function grantStep3CreditToday() {
  try {
    localStorage.setItem(KEY_TP3_CREDIT_DAY, localDayStamp());
  } catch {}
}

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

function safeAppendLog(entry) {
  try {
    appendLog(entry);
  } catch {}
}

function sectionLabel(text) {
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
}

function getLastLadder() {
  try {
    return localStorage.getItem(KEY_LAST) || "";
  } catch {
    return "";
  }
}

function setLastLadder(id) {
  try {
    localStorage.setItem(KEY_LAST, String(id || ""));
  } catch {}
}

/**
 * tpStep mapping:
 * - tpStep: 2 => Act (fills Today Plan Step 2)
 * - tpStep: 3 => Move (fills Today Plan Step 3)
 */
const LADDERS = [
  {
    id: "walk",
    tpStep: 3,
    title: "Walk + breathe",
    desc: "Move your body. Let the mind settle behind you.",
    minutes: 5,
    steps: ["Stand up. Shoulders down.", "Walk anywhere (inside is fine).", "In 4 → out 6. Keep moving."],
  },
  {
    id: "micro_task",
    tpStep: 2,
    title: "Micro-task (2 minutes)",
    desc: "Small motion to restart momentum.",
    minutes: 2,
    steps: ["Pick one tiny task.", "Set 2 minutes. Begin.", "When it ends: you can stop."],
  },
  {
    id: "reset_body",
    tpStep: 3,
    title: "Body reset",
    desc: "Simple reps to change state.",
    minutes: 5,
    steps: ["20 slow squats (or chair sits).", "20 wall push-ups (or countertop).", "60s stretch: neck + chest + hips."],
  },
  {
    id: "water_light",
    tpStep: 2,
    title: "Water + light",
    desc: "Hydrate, brighten, regulate.",
    minutes: 3,
    steps: ["Drink a full glass of water.", "Step into brighter light / outside if possible.", "3 slow exhales. Keep eyes soft."],
  },
  {
    id: "clean_3",
    tpStep: 2,
    title: "Clean 3 things",
    desc: "Small order can reduce noise.",
    minutes: 5,
    steps: ["Grab a bag or basket.", "Put away 3 things.", "Wipe one surface for 60 seconds."],
  },
  {
    id: "outside_reset",
    tpStep: 3,
    title: "Outside reset",
    desc: "Change the scene to change the state.",
    minutes: 7,
    steps: ["Put on shoes.", "Walk a short loop.", "Look far away for 10 seconds. Exhale longer."],
  },
];

function findLadder(id) {
  return LADDERS.find((x) => x.id === id) || LADDERS[0];
}

function ladderPlanText(ladder) {
  return `${ladder.title} (${ladder.minutes} min)`;
}

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  // modes: pick -> selected -> running -> closed
  let mode = "pick";

  // Optional "picker mode" from Today Plan
  // payload: { tpStep: 2 } or { tpStep: 3 }
  let pickerTpStep = 0;
  try {
    const raw = consumeNextIntent();
    if (raw && typeof raw === "object" && raw.intent === "move_forward_pick" && raw.payload) {
      const n = Number(raw.payload.tpStep);
      if (n === 2 || n === 3) pickerTpStep = n;
    }
  } catch {}

  const last = getLastLadder();
  let selectedLadderId = last && findLadder(last) ? last : LADDERS[0].id;

  // timer state
  let running = false;
  let durationMin = findLadder(selectedLadderId).minutes;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // UI state
  let showAllLadders = !!pickerTpStep; // picker mode shows more by default

  // bookkeeping
  let stoppedEarly = false;
  let elapsedSec = 0;

  safeAppendLog({ kind: "move_forward_open", when: nowISO(), build: BUILD, pickerTpStep: pickerTpStep || null });

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

  /**
   * Prefill rule:
   * - Act ladders => fill Step 2, focus Step 2
   * - Move ladders => fill Step 3, focus Step 3
   * Always overwrite in Today Plan (TP-23 enforces).
   */
  function goTodayWithPrefill(ladder, { advanceDone = false } = {}) {
    const step = ladder.tpStep === 3 ? 3 : 2;
    const txt = ladderPlanText(ladder);
    try {
      setNextIntent("today_plan_prefill", {
        from: "move_forward",
        targetStep: step,
        text: txt,
        focusStep: step,
        advanceDoneStep: advanceDone ? step : 0,
      });
    } catch {}
    location.hash = "#/green/today";
  }

  function selectAndAdvance(id) {
    selectedLadderId = id;
    setLastLadder(id);
    durationMin = findLadder(id).minutes;
    mode = "selected";
    rerender();
  }

  function maybeGrantStep3Credit(ladder) {
    // Only “Move” ladders should unlock Step 3
    if (ladder.tpStep === 3) grantStep3CreditToday();
  }

  function startSelected() {
    const ladder = findLadder(selectedLadderId);

    // If they start a “Move” ladder, unlock Step 3 in Today Plan
    maybeGrantStep3Credit(ladder);

    running = true;
    stoppedEarly = false;
    elapsedSec = 0;

    durationMin = ladder.minutes;
    startAt = Date.now();
    endAt = Date.now() + durationMin * 60 * 1000;

    safeAppendLog({
      kind: "move_forward_start",
      when: nowISO(),
      ladderId: ladder.id,
      ladderTitle: ladder.title,
      minutes: durationMin,
      tpStep: ladder.tpStep,
      build: BUILD,
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      if (endAt - Date.now() <= 0) {
        stopTick();
        running = false;

        // reinforce credit on completion
        maybeGrantStep3Credit(ladder);

        safeAppendLog({
          kind: "move_forward_end",
          when: nowISO(),
          ladderId: ladder.id,
          minutesPlanned: durationMin,
          stoppedEarly: false,
          elapsedSec: durationMin * 60,
          tpStep: ladder.tpStep,
          build: BUILD,
        });

        mode = "closed";
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
    const ladder = findLadder(selectedLadderId);

    stopTick();
    running = false;
    stoppedEarly = true;
    elapsedSec = Math.max(0, Math.round(elapsedMs / 1000));

    // reinforce credit even on early stop
    maybeGrantStep3Credit(ladder);

    safeAppendLog({
      kind: "move_forward_stop",
      when: nowISO(),
      ladderId: selectedLadderId,
      minutesPlanned: durationMin,
      stoppedEarly: true,
      elapsedSec,
      tpStep: ladder.tpStep,
      build: BUILD,
    });

    mode = "closed";
    rerender();
  }

  function header() {
    const sub =
      pickerTpStep === 2
        ? "Pick an Act ladder for Today’s Plan Step 2."
        : pickerTpStep === 3
        ? "Pick a Move ladder for Today’s Plan Step 3."
        : "A small motion can change state.";

    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Move Forward"]),
        el("p", { class: "p" }, [sub]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function ladderTile(l, labelOverride = null) {
    const tag = l.tpStep === 3 ? "Move" : "Act";
    return el(
      "button",
      { class: "actionTile", type: "button", onClick: () => selectAndAdvance(l.id) },
      [
        el("div", { class: "tileTop" }, [
          el("div", {}, [
            el("div", { class: "tileTitle" }, [labelOverride || l.title]),
            el("div", { class: "tileSub" }, [`${l.minutes} min • ${tag} • ${l.desc}`]),
          ]),
          el("div", { class: "zoneDot dotGreen" }, []),
        ]),
        el("p", { class: "tileHint" }, ["Tap to choose"]),
      ]
    );
  }

  function filteredLadders() {
    if (pickerTpStep === 2 || pickerTpStep === 3) {
      return LADDERS.filter((l) => l.tpStep === pickerTpStep);
    }
    return LADDERS.slice();
  }

  function quickStartIds() {
    // Quick starts adapt based on picker mode
    if (pickerTpStep === 2) return ["micro_task", "water_light", "clean_3"];
    if (pickerTpStep === 3) return ["walk", "reset_body", "outside_reset"];
    return ["walk", "micro_task", "reset_body"];
  }

  function quickStartCard() {
    const recommended = quickStartIds();
    const lastId = getLastLadder();

    const inFilter = (id) => {
      const l = findLadder(id);
      if (!l) return false;
      if (!pickerTpStep) return true;
      return l.tpStep === pickerTpStep;
    };

    const showResume = !!lastId && !recommended.includes(lastId) && inFilter(lastId);

    return el("div", { class: "card cardPad" }, [
      sectionLabel(pickerTpStep ? "Pick one" : "Quick start"),
      el("p", { class: "small" }, ["Pick one. A short timer will hold it."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        ...recommended.filter(inFilter).map((id) => ladderTile(findLadder(id))),
        showResume ? ladderTile(findLadder(lastId), "Resume last ladder") : null,
      ].filter(Boolean)),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => { showAllLadders = true; rerender(); } }, ["More ladders"]),
        el("button", { class: "btn", type: "button", onClick: () => goTodayWithPrefill(findLadder(selectedLadderId)) }, ["Today’s Plan"]),
      ]),
    ]);
  }

  function allLaddersCard() {
    const list = filteredLadders();
    return el("div", { class: "card cardPad" }, [
      sectionLabel(pickerTpStep ? "Choose a ladder" : "All ladders"),
      el("p", { class: "small" }, [pickerTpStep ? "Pick the right kind of motion." : "Pick the kind of motion you need."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, list.map((l) => ladderTile(l))),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => { showAllLadders = false; rerender(); } }, ["Show fewer ladders"]),
        el("button", { class: "btn", type: "button", onClick: () => goTodayWithPrefill(findLadder(selectedLadderId)) }, ["Today’s Plan"]),
      ]),
    ]);
  }

  function selectedCard() {
    const ladder = findLadder(selectedLadderId);
    const tag = ladder.tpStep === 3 ? "Move" : "Act";
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Selected"),
      el("h2", { class: "h2" }, [ladder.title]),
      el("p", { class: "p" }, [`${tag}. ${ladder.desc}`]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, ladder.steps.map((s) =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [s]),
        ])
      )),
      el("div", { class: "btnRow", style: "margin-top:12px" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: startSelected }, [`Start • ${ladder.minutes} min`]),
        el("button", { class: "btn", type: "button", onClick: () => { mode = "pick"; rerender(); } }, ["Back"]),
      ]),
      el("p", { class: "small", style: "margin-top:10px" }, ["Stopping early is allowed."]),
    ]);
  }

  function runningCard() {
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

  function closureCard() {
    if (mode !== "closed") return null;
    const ladder = findLadder(selectedLadderId);
    const line = stoppedEarly ? `Window closed (${elapsedSec}s).` : "Window closed.";

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Next step"),
      el("p", { class: "p" }, [line]),
      el("div", { class: "btnRow" }, [
        // ✅ Ladder always pushes forward: overwrite correct step + mark it done on open
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => goTodayWithPrefill(ladder, { advanceDone: true }) }, ["Today’s Plan"]),
        el("button", { class: "btn", type: "button", onClick: () => { mode = "pick"; rerender(); } }, ["Run again"]),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    if (mode === "pick") {
      wrap.appendChild(showAllLadders ? allLaddersCard() : quickStartCard());
      return;
    }

    if (mode === "selected") wrap.appendChild(selectedCard());
    if (mode === "running") wrap.appendChild(runningCard());

    const c = closureCard();
    if (c) wrap.appendChild(c);

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
