/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/reflect.js (FULL REPLACEMENT)
import { appendLog, readLog, isPro, setNextIntent } from "../storage.js";

const BUILD = "RF-19"; // governance locked: tap-only, low demand, hard closure

// DEV: keep More clarity visible during development.
// PRE-SHIP: set to false to gate behind isPro().
const DEV_UNLOCK_MORE_CLARITY = true;

// One-time handoff intent to the dedicated More Clarity screen
const INTENT_REFLECT_MORE_CLARITY = "reflect_more_clarity_v1";

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

// Step 2: clarity lens (each yields a short, usable reflection + a gentle “release” line)
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

function loopLabel(id) {
  const raw = LOOP_OPTIONS.find((x) => x.id === id)?.label || "Unnamed tension";
  return String(raw).toLowerCase();
}

function askLine(id) {
  // Governance-safe: descriptive, present tense, no pressure, no “should”.
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

// Governance-safe reflection: short, descriptive, non-evaluative.
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
  // More clarity is now its OWN ROUTE: #/reflect/more
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
        el("div", { class: "flowShell", style: "margin-top:10px" }, [
          ...LOOP_OPTIONS.map((o) =>
            tile(o, () => {
              state.loop = o.id;
              setStep(2);
            })
          ),
        ]),
      ]),
    ].filter(Boolean));
  }

  function step2() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Step 2 of 2"),
      el("h2", { class: "h2" }, ["What kind of clarity do you need?"]),
      el("p", { class: "small" }, ["One tap. Then we close."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        ...LENSES.map((l) =>
          tile({ label: l.label, hint: l.hint, dot: "dotGreen" }, () => {
            state.lens = l.id;

            const r = buildReflection(state.loop, state.lens);
            state.mirror = r.mirror;
            state.ground = r.ground;
            state.release = r.release;

            state.closure = "REST";

            state.spiralAsk = null;
            state.spiralLine = "";

            saveLock();
            setStep(3);
          })
        ),
      ]),
      el("div", { class: "btnRow" }, [el("button", { class: "btn", type: "button", onClick: () => setStep(1) }, ["Back"])]),
    ]);
  }

  function canShowMoreClarity() {
    return DEV_UNLOCK_MORE_CLARITY || isPro();
  }

  function goMoreClarity() {
    // Handoff current context to the dedicated screen (future-proof gating + separate file).
    try {
      setNextIntent(INTENT_REFLECT_MORE_CLARITY, {
        from: "reflect",
        loop: state.loop,
        lens: state.lens,
        closure: state.closure,
        mirror: state.mirror,
        ground: state.ground,
        release: state.release,
        spiralAsk: state.spiralAsk || null,
        spiralLine: state.spiralLine || "",
      });
    } catch {}
    location.hash = "#/reflect/more";
  }

  // Closure: one primary state, low demand.
  function closure() {
    const lines = [state.mirror, state.ground, state.release].filter(Boolean);

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Closure"),
      el("h2", { class: "h2" }, [state.closure]),
      ...lines.map((t, i) =>
        el("p", { class: i === 0 ? "p" : "small", style: i === 0 ? "" : "margin-top:6px;opacity:.9;" }, [t])
      ),

      state.spiralLine ? el("p", { class: "small", style: "margin-top:10px;opacity:.9;" }, [state.spiralLine]) : null,

      el("p", { class: "small", style: "margin-top:8px" }, ["Nothing else is required right now."]),

      el("div", { style: "margin-top:10px" }, [
        tile(
          { label: "Re-check / re-read", hint: "If that pull is present, name it once.", dot: "dotGreen" },
          () => {
            state.spiralAsk = "recheck";
            state.spiralLine = askLine("recheck");
            saveSpiralAsk();
            saveLock();
            rerender();
            window.scrollTo(0, 0);
          }
        ),
      ]),

      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Home"]),
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
              rerender();
              window.scrollTo(0, 0);
            },
          },
          ["Reflect again"]
        ),
        el("button", { class: "btn", type: "button", onClick: () => setStep(4) }, ["Clarify the spiral"]),
        canShowMoreClarity()
          ? el("button", { class: "btn", type: "button", onClick: goMoreClarity }, ["More clarity"])
          : null,
      ].filter(Boolean)),
    ].filter(Boolean));
  }

  // Clarify screen: tiles live HERE
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

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    if (state.step === 1) wrap.appendChild(step1());
    else if (state.step === 2) wrap.appendChild(step2());
    else if (state.step === 4) wrap.appendChild(clarifyScreen());
    else wrap.appendChild(closure());
  }

  rerender();
  return wrap;
}
