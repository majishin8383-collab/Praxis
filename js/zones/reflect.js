/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/reflect.js (FULL REPLACEMENT)
import { appendLog, readLog } from "../storage.js";

const BUILD = "RF-13"; // Reflect v1.3 (clarify inline)

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

// ---- Options ----
const LOOP_OPTIONS = [
  { id: "me", label: "Something I said / did", hint: "I keep replaying my side." },
  { id: "them", label: "Something they said / did", hint: "I’m stuck on what it meant." },
  { id: "decision", label: "A decision I’m avoiding", hint: "I don’t want to choose." },
  { id: "future", label: "Fear of what happens next", hint: "My brain is predicting." },
  { id: "tension", label: "Unnamed tension", hint: "I feel off, can’t name it." },
];

// Step 2: clarity lens
const LENSES = [
  { id: "fear", label: "What I’m afraid will happen", hint: "Name the fear. One line." },
  { id: "need", label: "What I’m needing right now", hint: "What would steady me?" },
  { id: "story", label: "What I’m telling myself", hint: "The loop sentence." },
  { id: "control", label: "What I’m trying to control", hint: "Name the lever." },
  { id: "next10", label: "What helps in the next 10 minutes", hint: "Small support. Not a plan." },
];

// Optional: spiral clarify (INLINE in closure)
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

function askLabel(id) {
  return SPIRAL_ASKS.find((x) => x.id === id)?.label || "Replay / analyze";
}

function lastLocked() {
  try {
    const log = readLog().slice(0, 250);
    const last = log.find((e) => e && e.kind === "reflect_lock_v2" && typeof e.reflection === "string");
    return last || null;
  } catch {
    return null;
  }
}

/**
 * Governance-safe reflection builder:
 * - One sentence of clarity
 * - One sentence of agency (small, present tense)
 * No praise, no pressure.
 */
function buildReflection(loopId, lensId) {
  const loop = loopLabel(loopId);

  switch (lensId) {
    case "fear":
      return `Loop: ${loop}. Fear: it won’t resolve. Today I can still take one step.`;
    case "need":
      return `Loop: ${loop}. Need: steadiness. Next: lower intensity and continue.`;
    case "story":
      return `Loop: ${loop}. Story: “I have to know.” I can allow not-knowing today.`;
    case "control":
      return `Loop: ${loop}. Control: my next action. I can choose a smaller action.`;
    case "next10":
      return `Loop: ${loop}. Support: water, breath, and one small motion.`;
    default:
      return `Loop: ${loop}. Today I can take one step.`;
  }
}

export function renderReflect() {
  const wrap = el("div", { class: "flowShell" });

  // steps: 1 -> 2 -> 3(closure)
  const state = {
    step: 1,
    loop: null,
    lens: null,
    reflection: "",
    closure: "REST",
    // inline clarify
    showClarify: false,
    spiralAsk: null,
    spiralLine: "",
  };

  safeAppendLog({ kind: "reflect_open_v2", when: nowISO(), build: BUILD });

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
      kind: "reflect_lock_v2",
      when: nowISO(),
      build: BUILD,
      loop: state.loop,
      lens: state.lens,
      reflection: state.reflection,
      closure: state.closure,
    });
  }

  function saveSpiralAsk() {
    safeAppendLog({
      kind: "reflect_spiral_ask_v2",
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
    if (!last?.reflection) return null;
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Last reflection"),
      el("p", { class: "p" }, [String(last.reflection)]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Nothing else is required."]),
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
      el("h2", { class: "h2" }, ["Pick a clarity lens"]),
      el("p", { class: "small" }, ["One tap. No analysis."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        ...LENSES.map((l) =>
          tile(
            { label: l.label, hint: l.hint, dot: "dotGreen" },
            () => {
              state.lens = l.id;
              state.reflection = buildReflection(state.loop, state.lens);
              state.closure = "REST";
              // reset inline clarify state on new lock
              state.showClarify = false;
              state.spiralAsk = null;
              state.spiralLine = "";
              saveLock();
              setStep(3);
            }
          )
        ),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(1) }, ["Back"]),
      ]),
    ]);
  }

  function clarifyInline() {
    if (!state.showClarify) return null;

    return el("div", { style: "margin-top:10px" }, [
      el("p", { class: "small" }, ["Pick what your brain is asking for."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        SPIRAL_ASKS.map((a) =>
          tile(
            { label: a.label, hint: a.hint, dot: "dotGreen" },
            () => {
              state.spiralAsk = a.id;
              state.spiralLine = `My brain is asking for: ${askLabel(a.id)}. That is not required today.`;
              saveSpiralAsk();
              rerender();
            }
          )
        )
      ),
      state.spiralLine
        ? el(
            "div",
            {
              class: "card",
              style:
                "margin-top:10px;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);",
            },
            [
              el("div", { class: "small", style: "opacity:.85;font-weight:800;" }, ["Clarified"]),
              el("p", { class: "p", style: "margin-top:6px" }, [state.spiralLine]),
            ]
          )
        : null,
    ]);
  }

  function closure() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Closure"),
      el("h2", { class: "h2" }, [state.closure]),
      el("p", { class: "p" }, [state.reflection]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Nothing else is required right now."]),

      // Inline controls (no extra “new tile” below the screen)
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
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
              state.reflection = "";
              state.closure = "REST";
              state.showClarify = false;
              state.spiralAsk = null;
              state.spiralLine = "";
              rerender();
              window.scrollTo(0, 0);
            },
          },
          ["Reflect again"]
        ),
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              state.showClarify = !state.showClarify;
              rerender();
            },
          },
          [state.showClarify ? "Hide clarify" : "Clarify the spiral"]
        ),
      ]),

      // Inline expand/collapse area
      clarifyInline(),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    if (state.step === 1) wrap.appendChild(step1());
    else if (state.step === 2) wrap.appendChild(step2());
    else wrap.appendChild(closure());
  }

  rerender();
  return wrap;
}
