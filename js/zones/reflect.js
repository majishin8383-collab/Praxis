/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/reflect.js (FULL REPLACEMENT)
import { appendLog, readLog, isPro } from "../storage.js";

const BUILD = "RF-18"; // governance locked: tap-only, low demand, hard closure

// DEV NOTE:
// - Leave "More clarity" UNLOCKED during development.
// - BEFORE SHIP: set DEV_UNLOCK_MORE_CLARITY = false (then Pro gate applies).
const DEV_UNLOCK_MORE_CLARITY = true;

function canMoreClarity() {
  try {
    return DEV_UNLOCK_MORE_CLARITY || isPro();
  } catch {
    return DEV_UNLOCK_MORE_CLARITY;
  }
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

function tile({ label, hint, dot = "dotGreen" }, onClick) {
  return el("button", { class: "actionTile", type: "button", onClick }, [
    el("div", { class: "tileTop" }, [
      el("div", {}, [el("div", { class: "tileTitle" }, [label]), el("div", { class: "tileSub" }, [hint])]),
      el("div", { class: `zoneDot ${dot}` }, []),
    ]),
    el("p", { class: "tileHint" }, ["Tap"]),
  ]);
}

// Step 1: what's looping
const LOOP_OPTIONS = [
  { id: "me", label: "Something I said / did", hint: "I keep replaying my side." },
  { id: "them", label: "Something they said / did", hint: "I’m stuck on what it meant." },
  { id: "decision", label: "A decision I’m avoiding", hint: "I don’t want to choose." },
  { id: "future", label: "Fear of what happens next", hint: "My brain is predicting." },
  { id: "tension", label: "Unnamed tension", hint: "I feel off, can’t name it." },
];

// Step 2: clarity lens
const LENSES = [
  { id: "fear", label: "What the fear is trying to prevent", hint: "Fear is a protector. Name it gently." },
  { id: "need", label: "What I’m needing right now", hint: "Need is present. Keep it small." },
  { id: "story", label: "The sentence my mind keeps repeating", hint: "Name the sentence. Don’t argue it." },
  { id: "control", label: "What I can control today", hint: "One lever. Not the whole situation." },
  { id: "next10", label: "What supports the next 10 minutes", hint: "Support, not strategy." },
];

// Clarify: what the spiral is asking for
const SPIRAL_ASKS = [
  { id: "recheck", label: "Re-check / re-read", hint: "Looking again to feel sure." },
  { id: "reach", label: "Reach out / message", hint: "Trying to close the loop." },
  { id: "replay", label: "Replay / analyze", hint: "Searching for meaning." },
  { id: "fix", label: "Fix / explain", hint: "Trying to repair it." },
  { id: "predict", label: "Predict / catastrophize", hint: "Future scanning." },
];

// More clarity modes (tap-only, one line, returns to closure)
const MORE_CLARITY_MODES = [
  { id: "pattern", label: "Pattern", hint: "One descriptive pattern line." },
  { id: "boundary", label: "Boundary", hint: "One boundary line for today." },
  { id: "value", label: "Value", hint: "One value line that fits." },
  { id: "next", label: "Next smallest step", hint: "One tiny step line." },
];

function loopLabel(id) {
  const raw = LOOP_OPTIONS.find((x) => x.id === id)?.label || "Unnamed tension";
  return String(raw).toLowerCase();
}

function askLine(id) {
  // Descriptive, present tense, no pressure, no “should”.
  switch (id) {
    case "recheck":
      return "The mind is seeking certainty by checking again. Certainty can wait.";
    case "reach":
      return "The mind is seeking relief by reaching out. Relief can wait.";
    case "replay":
      return "The mind is seeking meaning by replaying. Meaning can wait.";
    case "fix":
      return "The mind is seeking repair by fixing. Repair can wait.";
    case "predict":
      return "The mind is seeking safety by predicting. Predicting can wait.";
    default:
      return "The mind is seeking certainty. Certainty can wait.";
  }
}

// Short, descriptive, non-evaluative.
function buildReflection(loopId, lensId) {
  const loop = loopLabel(loopId);

  switch (lensId) {
    case "fear":
      return {
        mirror: `Loop: ${loop}. Fear is present.`,
        ground: "Fear is trying to prevent pain.",
        release: "One step is allowed. The rest can wait.",
      };
    case "need":
      return {
        mirror: `Loop: ${loop}. Need is present.`,
        ground: "Need can be small and still real.",
        release: "Lower intensity first. One step is allowed.",
      };
    case "story":
      return {
        mirror: `Loop: ${loop}. A story is running.`,
        ground: "A story can run without being true.",
        release: "I can pause the story for now.",
      };
    case "control":
      return {
        mirror: `Loop: ${loop}. Control is limited.`,
        ground: "My next action is mine.",
        release: "One lever is enough for today.",
      };
    case "next10":
      return {
        mirror: `Loop: ${loop}. The next 10 minutes matter.`,
        ground: "Support is allowed: water, breath, small motion.",
        release: "The rest can wait.",
      };
    default:
      return {
        mirror: `Loop: ${loop}.`,
        ground: "One step is allowed.",
        release: "The rest can wait.",
      };
  }
}

// One sentence, descriptive, no evaluation.
function buildMoreClarityLine(modeId, loopId, lensId) {
  const loop = loopLabel(loopId);
  const lens = String(lensId || "");

  if (modeId === "pattern") {
    if (lens === "story") return `Pattern: story-loop around ${loop}.`;
    if (lens === "fear") return `Pattern: threat-scan around ${loop}.`;
    return `Pattern: repeat-loop around ${loop}.`;
  }

  if (modeId === "boundary") {
    return "Boundary: no checking, no messaging, no proving—today.";
  }

  if (modeId === "value") {
    return "Value: steadiness over urgency—today.";
  }

  // next
  return "Next step: water, breath, or a small reset—one only.";
}

function lastLocked() {
  try {
    const log = readLog().slice(0, 300);
    return log.find((e) => e && e.kind === "reflect_lock_v4" && typeof e.mirror === "string") || null;
  } catch {
    return null;
  }
}

export function renderReflect() {
  const wrap = el("div", { class: "flowShell" });

  // steps: 1 -> 2 -> 3(closure) -> 4(clarify) -> back to 3
  // optional: 5(more clarity) -> back to 3
  const state = {
    step: 1,
    loop: null,
    lens: null,

    mirror: "",
    ground: "",
    release: "",
    closure: "REST",

    spiralAsk: null,
    spiralLine: "",

    // optional more clarity
    moreMode: null,
    moreLine: "",
  };

  safeAppendLog({ kind: "reflect_open_v4", when: nowISO(), build: BUILD });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Reflect"]),
        el("p", { class: "p" }, ["Name the loop. Get one clear line. Close."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
      ]),
    ]);
  }

  function setStep(n) {
    state.step = n;
    rerender();
    window.scrollTo(0, 0);
  }

  function saveLock() {
    safeAppendLog({
      kind: "reflect_lock_v4",
      when: nowISO(),
      build: BUILD,
      loop: state.loop,
      lens: state.lens,
      mirror: state.mirror,
      ground: state.ground,
      release: state.release,
      closure: state.closure,
      spiralAsk: state.spiralAsk || null,
      moreMode: state.moreMode || null,
      moreLine: state.moreLine || "",
    });
  }

  function saveSpiralAsk() {
    safeAppendLog({
      kind: "reflect_spiral_ask_v4",
      when: nowISO(),
      build: BUILD,
      ask: state.spiralAsk,
      line: state.spiralLine,
      loop: state.loop,
      lens: state.lens,
    });
  }

  function saveMoreClarity() {
    safeAppendLog({
      kind: "reflect_more_clarity_v1",
      when: nowISO(),
      build: BUILD,
      mode: state.moreMode,
      line: state.moreLine,
      loop: state.loop,
      lens: state.lens,
    });
  }

  function lastCard() {
    const last = lastLocked();
    if (!last?.mirror) return null;

    const lines = [String(last.mirror), String(last.ground || ""), String(last.release || "")].filter(Boolean);

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Last reflection"),
      ...lines.map((t, i) =>
        el("p", { class: i === 0 ? "p" : "small", style: i === 0 ? "" : "margin-top:6px;opacity:.9;" }, [t])
      ),
      el("p", { class: "small", style: "margin-top:8px" }, ["Nothing else is required right now."]),
    ]);
  }

  function step1() {
    return el("div", {}, [
      lastCard(),
      el("div", { class: "card cardPad" }, [
        sectionLabel("Step 1 of 2"),
        el("h2", { class: "h2" }, ["What’s looping right now?"]),
        el("p", { class: "small" }, ["Pick what fits best."]),
        el(
          "div",
          { class: "flowShell", style: "margin-top:10px" },
          LOOP_OPTIONS.map((o) =>
            tile(o, () => {
              state.loop = o.id;
              setStep(2);
            })
          )
        ),
      ]),
    ].filter(Boolean));
  }

  function step2() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Step 2 of 2"),
      el("h2", { class: "h2" }, ["What kind of clarity do you need?"]),
      el("p", { class: "small" }, ["One tap. Then we close."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        LENSES.map((l) =>
          tile({ label: l.label, hint: l.hint, dot: "dotGreen" }, () => {
            state.lens = l.id;

            const r = buildReflection(state.loop, state.lens);
            state.mirror = r.mirror;
            state.ground = r.ground;
            state.release = r.release;

            state.closure = "REST";

            // Clear optional notes on new reflection
            state.spiralAsk = null;
            state.spiralLine = "";
            state.moreMode = null;
            state.moreLine = "";

            saveLock();
            setStep(3);
          })
        )
      ),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(1) }, ["Back"]),
      ]),
    ]);
  }

  function closure() {
    const lines = [state.mirror, state.ground, state.release].filter(Boolean);

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Closure"),
      el("h2", { class: "h2" }, [state.closure]),
      ...lines.map((t, i) =>
        el("p", { class: i === 0 ? "p" : "small", style: i === 0 ? "" : "margin-top:6px;opacity:.9;" }, [t])
      ),

      state.spiralLine ? el("p", { class: "small", style: "margin-top:10px;opacity:.9;" }, [state.spiralLine]) : null,
      state.moreLine ? el("p", { class: "small", style: "margin-top:10px;opacity:.9;" }, [state.moreLine]) : null,

      el("p", { class: "small", style: "margin-top:8px" }, ["Nothing else is required right now."]),

      // Single specific tile (requested)
      el("div", { style: "margin-top:10px" }, [
        tile({ label: "Re-check / re-read", hint: "If that pull is present, name it once.", dot: "dotGreen" }, () => {
          state.spiralAsk = "recheck";
          state.spiralLine = askLine("recheck");
          saveSpiralAsk();
          saveLock();
          rerender();
          window.scrollTo(0, 0);
        }),
      ]),

      el(
        "div",
        { class: "btnRow", style: "margin-top:10px" },
        [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, [
            "Back to Home",
          ]),
          el(
            "button",
            {
              class: "btn",
              type: "button",
              onClick: () => {
                state.step = 1;
                state.loop = null;
                state.lens = null;
                state.mirror = "";
                state.ground = "";
                state.release = "";
                state.closure = "REST";
                state.spiralAsk = null;
                state.spiralLine = "";
                state.moreMode = null;
                state.moreLine = "";
                rerender();
                window.scrollTo(0, 0);
              },
            },
            ["Reflect again"]
          ),
          el("button", { class: "btn", type: "button", onClick: () => setStep(4) }, ["Clarify the spiral"]),
          // ✅ Preference-style (not “upgrade”), appears after closure is named
          canMoreClarity() ? el("button", { class: "btn", type: "button", onClick: () => setStep(5) }, ["More clarity"]) : null,
        ].filter(Boolean)
      ),
    ].filter(Boolean));
  }

  function clarifyScreen() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Clarify"),
      el("h2", { class: "h2" }, ["What is the spiral asking for?"]),
      el("p", { class: "small" }, ["Pick one. Then return to closure."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        SPIRAL_ASKS.map((a) =>
          tile({ label: a.label, hint: a.hint, dot: "dotGreen" }, () => {
            state.spiralAsk = a.id;
            state.spiralLine = askLine(a.id);
            saveSpiralAsk();
            saveLock();
            setStep(3);
          })
        )
      ),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(3) }, ["Back"]),
      ]),
    ]);
  }

  function moreClarityScreen() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("More clarity"),
      el("h2", { class: "h2" }, ["One more line"]),
      el("p", { class: "small" }, ["Pick one. Then return to closure."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        MORE_CLARITY_MODES.map((m) =>
          tile({ label: m.label, hint: m.hint, dot: "dotGreen" }, () => {
            state.moreMode = m.id;
            state.moreLine = buildMoreClarityLine(m.id, state.loop, state.lens);
            saveMoreClarity();
            saveLock();
            setStep(3);
          })
        )
      ),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(3) }, ["Back"]),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    if (state.step === 1) wrap.appendChild(step1());
    else if (state.step === 2) wrap.appendChild(step2());
    else if (state.step === 4) wrap.appendChild(clarifyScreen());
    else if (state.step === 5) wrap.appendChild(moreClarityScreen());
    else wrap.appendChild(closure());
  }

  rerender();
  return wrap;
}
