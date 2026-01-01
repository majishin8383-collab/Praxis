// js/zones/green/moveForward.js (FULL REPLACEMENT)
import { appendLog, setNextIntent } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "MF-14";

// light persistence so "Quick start" feels smart without being complex
const KEY_LAST = "praxis_move_forward_last_v1";

// Step 3 unlock credit (day stamp)
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
  return el(
    "div",
    { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" },
    [text]
  );
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

const LADDERS = [
  { id: "walk", title: "Walk + breathe", desc: "Move your body. Let the mind settle behind you.", minutes: 5, steps: ["Stand up. Shoulders down.", "Walk anywhere (inside is fine).", "In 4 → out 6. Keep moving."] },
  { id: "micro_task", title: "Micro-task (2 minutes)", desc: "Small motion to restart momentum.", minutes: 2, steps: ["Pick one tiny task.", "Set 2 minutes. Begin.", "When it ends: you can stop."] },
  { id: "reset_body", title: "Body reset", desc: "Simple reps to change state.", minutes: 5, steps: ["20 slow squats (or chair sits).", "20 wall push-ups (or countertop).", "60s stretch: neck + chest + hips."] },
  { id: "water_light", title: "Water + light", desc: "Hydrate, brighten, regulate.", minutes: 3, steps: ["Drink a full glass of water.", "Step into brighter light / outside if possible.", "3 slow exhales. Keep eyes soft."] },
  { id: "clean_3", title: "Clean 3 things", desc: "Small order can reduce noise.", minutes: 5, steps: ["Grab a bag or basket.", "Put away 3 things.", "Wipe one surface for 60 seconds."] },
  { id: "outside_reset", title: "Outside reset", desc: "Change the scene to change the state.", minutes: 7, steps: ["Put on shoes.", "Walk a short loop.", "Look far away for 10 seconds. Exhale longer."] },
];

function findLadder(id) {
  return LADDERS.find((x) => x.id === id) || LADDERS[0];
}

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  // modes: pick -> selected -> running -> closed
  let mode = "pick";

  const last = getLastLadder();
  let selectedLadderId = last && findLadder(last) ? last : LADDERS[0].id;

  // timer state
  let running = false;
  let durationMin = findLadder(selectedLadderId).minutes;
  let startAt = 0;
  let endAt = 0;
  let tick = null;

  // UI state
  let showAllLadders = false;

  // bookkeeping
  let stoppedEarly = false;
  let elapsedSec = 0;

  safeAppendLog({ kind: "move_forward_open", when: nowISO(), build: BUILD });

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

  function goTodayWithPrefill(ladder) {
    const txt = `${ladder.title} (${ladder.minutes} min)`;

    // ✅ Correct mapping: Move Forward → Today Plan Step 3
    try {
      setNextIntent("today_plan_prefill", {
        from: "move_forward",
        targetStep: 3,
        text: txt,
        focusStep: 3,
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

  function startSelected() {
    const ladder = findLadder(selectedLadderId);

    // ✅ Starting a ladder unlocks Today Plan Step 3 (internal, no visible marker)
    grantStep3CreditToday();

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
      build: BUILD,
    });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      if (endAt - Date.now() <= 0) {
        stopTick();
        running = false;

        // reinforce credit
        grantStep3CreditToday();

        safeAppendLog({
          kind: "move_forward_end",
          when: nowISO(),
          ladderId: ladder.id,
          minutesPlanned: durationMin,
          stoppedEarly: false,
          elapsedSec: durationMin * 60,
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

    stopTick();
    running = false;

    stoppedEarly = true;
    elapsedSec = Math.max(0, Math.round(elapsedMs / 1000));

    // reinforce credit
    grantStep3CreditToday();

    safeAppendLog({
      kind: "move_forward_stop",
      when: nowISO(),
      ladderId: selectedLadderId,
      minutesPlanned: durationMin,
      stoppedEarly: true,
      elapsedSec,
      build: BUILD,
    });

    mode = "closed";
    rerender();
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Move Forward"]),
        el("p", { class: "p" }, ["A small motion can change state."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function ladderTile(l, labelOverride = null) {
    return el(
      "button",
      { class: "actionTile", type: "button", onClick: () => selectAndAdvance(l.id) },
      [
        el("div", { class: "tileTop" }, [
          el("div", {}, [
            el("div", { class: "tileTitle" }, [labelOverride || l.title]),
            el("div", { class: "tileSub" }, [`${l.minutes} min • ${l.desc}`]),
          ]),
          el("div", { class: "zoneDot dotGreen" }, []),
        ]),
        el("p", { class: "tileHint" }, ["Tap to choose"]),
      ]
    );
  }

  function quickStartCard() {
    const recommended = ["walk", "micro_task", "reset_body"];
    const lastId = getLastLadder();
    const showResume = !!lastId && !recommended.includes(lastId);

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Quick start"),
      el("p", { class: "small" }, ["Pick one. A short timer will hold it."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        ...recommended.map((id) => ladderTile(findLadder(id))),
        showResume ? ladderTile(findLadder(lastId), "Resume last ladder") : null,
      ].filter(Boolean)),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => { showAllLadders = true; rerender(); } }, ["More ladders"]),
        // Prefill Step 3 using current selection (last/remembered)
        el("button", { class: "btn", type: "button", onClick: () => goTodayWithPrefill(findLadder(selectedLadderId)) }, ["Today’s Plan"]),
      ]),
    ]);
  }

  function allLaddersCard() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("All ladders"),
      el("p", { class: "small" }, ["Pick the kind of motion you need."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, LADDERS.map((l) => ladderTile(l))),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => { showAllLadders = false; rerender(); } }, ["Show fewer ladders"]),
        el("button", { class: "btn", type: "button", onClick: () => goTodayWithPrefill(findLadder(selectedLadderId)) }, ["Today’s Plan"]),
      ]),
    ]);
  }

  function selectedCard() {
    const ladder = findLadder(selectedLadderId);
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Selected"),
      el("h2", { class: "h2" }, [ladder.title]),
      el("p", { class: "p" }, [ladder.desc]),
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
        // Prefill Step 3 with the ladder that actually ran
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => goTodayWithPrefill(ladder) }, ["Today’s Plan"]),
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
