// js/zones/green/moveForward.js (FULL REPLACEMENT)
import { appendLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

const BUILD = "MF-9";

// light persistence so "Quick start" feels smart without being complex
const KEY_LAST = "praxis_move_forward_last_v1";

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
  {
    id: "walk",
    title: "Walk + breathe",
    desc: "Move your body. Let the mind settle behind you.",
    minutes: 5,
    steps: ["Stand up. Shoulders down.", "Walk anywhere (inside is fine).", "In 4 → out 6. Keep moving."],
  },
  {
    id: "micro_task",
    title: "Micro-task (2 minutes)",
    desc: "Small motion to restart momentum.",
    minutes: 2,
    steps: ["Pick one tiny task.", "Set 2 minutes. Begin.", "When it ends: you can stop."],
  },
  {
    id: "reset_body",
    title: "Body reset",
    desc: "Simple reps to change state.",
    minutes: 5,
    steps: ["20 slow squats (or chair sits).", "20 wall push-ups (or countertop).", "60s stretch: neck + chest + hips."],
  },
  {
    id: "water_light",
    title: "Water + light",
    desc: "Hydrate, brighten, regulate.",
    minutes: 3,
    steps: ["Drink a full glass of water.", "Step into brighter light / outside if possible.", "3 slow exhales. Keep eyes soft."],
  },
  {
    id: "clean_3",
    title: "Clean 3 things",
    desc: "Small order can reduce noise.",
    minutes: 5,
    steps: ["Grab a bag or basket.", "Put away 3 things.", "Wipe one surface for 60 seconds."],
  },
  {
    id: "outside_reset",
    title: "Outside reset",
    desc: "Change the scene to change the state.",
    minutes: 7,
    steps: ["Put on shoes.", "Walk a short loop.", "Look far away for 10 seconds. Exhale longer."],
  },
];

function findLadder(id) {
  return LADDERS.find((x) => x.id === id) || LADDERS[0];
}

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  // modes: pick -> selected -> running -> done
  let mode = "pick";

  // default selection tries to be “smart” but never forces it
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

  function selectAndAdvance(id) {
    selectedLadderId = id;
    setLastLadder(id);
    durationMin = findLadder(id).minutes;
    mode = "selected";
    rerender();
  }

  function logCanonicalMoveForward({ ladder, stoppedEarlyFlag, elapsedSecValue }) {
    // Canonical event used by storage.js to grant stabilize credit.
    safeAppendLog({
      kind: "move_forward",
      when: nowISO(),
      ladderId: ladder?.id || selectedLadderId,
      ladderTitle: ladder?.title || findLadder(selectedLadderId).title,
      minutes: durationMin,
      stoppedEarly: !!stoppedEarlyFlag,
      elapsedSec: Math.max(0, Math.round(Number(elapsedSecValue || 0))),
      build: BUILD,
    });
  }

  function startSelected() {
    const ladder = findLadder(selectedLadderId);

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

        // End telemetry
        safeAppendLog({
          kind: "move_forward_end",
          when: nowISO(),
          ladderId: ladder.id,
          minutesPlanned: durationMin,
          stoppedEarly: false,
          elapsedSec: durationMin * 60,
          build: BUILD,
        });

        // ✅ Canonical completion event (for stabilize credit)
        logCanonicalMoveForward({ ladder, stoppedEarlyFlag: false, elapsedSecValue: durationMin * 60 });

        mode = "done";
        rerender();
      } else {
        updateTimerUI();
      }
    }, 250);

    mode = "running";
    rerender();
  }

  function extend(extraMin) {
    const remaining = remainingMs();
    const newRemaining = remaining + extraMin * 60 * 1000;
    durationMin = Math.ceil(newRemaining / (60 * 1000));
    endAt = Date.now() + newRemaining;

    safeAppendLog({
      kind: "move_forward_extend",
      when: nowISO(),
      ladderId: selectedLadderId,
      extraMin,
      minutesNow: durationMin,
      build: BUILD,
    });

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
      kind: "move_forward_stop",
      when: nowISO(),
      ladderId: selectedLadderId,
      minutesPlanned: durationMin,
      stoppedEarly: true,
      elapsedSec,
      build: BUILD,
    });

    // ✅ Canonical attempt event (still grants credit; “attempt counts”)
    logCanonicalMoveForward({ ladder: findLadder(selectedLadderId), stoppedEarlyFlag: true, elapsedSecValue: elapsedSec });

    mode = "done";
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
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
      ]),
    ]);
  }

  function ladderTile(l) {
    return el(
      "button",
      {
        class: "actionTile",
        type: "button",
        onClick: () => selectAndAdvance(l.id),
      },
      [
        el("div", { class: "tileTop" }, [
          el("div", {}, [
            el("div", { class: "tileTitle" }, [l.title]),
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
    const showResume = !!lastId && recommended.includes(lastId) === false;

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Quick start"),
      el("p", { class: "small" }, ["Pick one. A short timer will hold it."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        ...recommended.map((id) => ladderTile(findLadder(id))),
        showResume ? ladderTile(findLadder(lastId)) : null,
      ].filter(Boolean)),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              showAllLadders = !showAllLadders;
              rerender();
            },
          },
          [showAllLadders ? "Hide ladders" : "More ladders"]
        ),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/today") }, ["Today’s Plan"]),
      ]),
    ]);
  }

  function allLaddersCard() {
    if (!showAllLadders) return null;
    return el("div", { class: "card cardPad" }, [
      sectionLabel("All ladders"),
      el("p", { class: "small" }, ["Pick a different kind of motion."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, LADDERS.map((l) => ladderTile(l))),
    ]);
  }

  function selectedCard() {
    const ladder = findLadder(selectedLadderId);
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Selected"),
      el("h2", { class: "h2" }, [ladder.title]),
      el("p", { class: "p" }, [ladder.desc]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        ladder.steps.map((s) =>
          el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
            el("div", { style: "font-weight:900;" }, [s]),
          ])
        )
      ),
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
        // progress bars intentionally removed per GOVERNANCE.md
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn", type: "button", onClick: () => extend(3) }, ["+3 min"]),
          el("button", { class: "btn", type: "button", onClick: () => extend(5) }, ["+5 min"]),
          el("button", { class: "btn", type: "button", onClick: stopEarly }, ["Stop"]),
        ]),
      ]),
    ]);
  }

  function closureCard() {
    if (mode !== "done") return null;

    // Primary completion state for Move Forward is READINESS.
    // Closure must: name state -> return agency -> release.
    const line = stoppedEarly ? `Some motion happened (${elapsedSec}s).` : "The timer ended.";

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Readiness"),
      el("p", { class: "p" }, [line]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => { mode = "pick"; rerender(); } }, [
          "Choose another ladder",
        ]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
      ]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/today") }, ["Today’s Plan"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    if (mode === "pick") {
      wrap.appendChild(quickStartCard());
      const all = allLaddersCard();
      if (all) wrap.appendChild(all);
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
