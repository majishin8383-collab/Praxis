/*! 
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/reflect.js (FULL REPLACEMENT)
import { appendLog, readLog } from "../storage.js";

const BUILD = "RF-10"; // Reflect v1.0 (governance-locked)

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
  // Avoid "badge" UI to comply with GOVERNANCE.md
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

// ---- Reflect v1.0 options (governance-locked) ----
const LOOP_OPTIONS = [
  { id: "me", label: "Something I said / did", hint: "I keep replaying my side." },
  { id: "them", label: "Something they said / did", hint: "I’m stuck on what it meant." },
  { id: "decision", label: "A decision I’m avoiding", hint: "I don’t want to choose." },
  { id: "tension", label: "Unnamed tension", hint: "I feel off, but can’t name it." },
];

const RELEASE_OPTIONS = [
  { id: "decide", label: "I don’t need to decide today", hint: "Decision can wait.", dot: "dotGreen" },
  { id: "respond", label: "I don’t need to respond today", hint: "No reply required now.", dot: "dotGreen" },
  { id: "understand", label: "I don’t need to understand this today", hint: "Meaning can wait.", dot: "dotGreen" },
  { id: "act", label: "I don’t need to act on this today", hint: "Action can wait.", dot: "dotGreen" },
];

function loopLabel(id) {
  return (LOOP_OPTIONS.find((x) => x.id === id)?.label || "Unnamed tension").toLowerCase();
}
function releaseLabel(id) {
  return (RELEASE_OPTIONS.find((x) => x.id === id)?.label || "I don’t need to decide today").replace(/\.$/, "");
}

function lastLocked() {
  try {
    const log = readLog().slice(0, 200);
    const last = log.find((e) => e && e.kind === "reflect_lock_v1" && typeof e.statement === "string");
    return last || null;
  } catch {
    return null;
  }
}

export function renderReflect() {
  const wrap = el("div", { class: "flowShell" });

  // steps: 1 (name loop) -> 2 (release) -> 3 (closure)
  const state = {
    step: 1,
    loop: null,
    release: null,
    statement: "",
    closure: "REST", // governance-safe default
  };

  safeAppendLog({ kind: "reflect_open_v1", when: nowISO(), build: BUILD });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Reflect"]),
        el("p", { class: "p" }, ["Name it. Release demand. Close."]),
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

  function buildStatement() {
    const l = loopLabel(state.loop);
    const r = releaseLabel(state.release);
    // Present tense, descriptive, short.
    state.statement = `I’m looping on: ${l}. ${r}.`;
    // v1.0 keeps closure simple and non-demanding.
    state.closure = "REST";
  }

  function saveLock() {
    safeAppendLog({
      kind: "reflect_lock_v1",
      when: nowISO(),
      build: BUILD,
      loop: state.loop,
      release: state.release,
      statement: state.statement,
      closure: state.closure,
    });
  }

  function lastCard() {
    const last = lastLocked();
    if (!last?.statement) return null;
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Last reflection"),
      el("p", { class: "p" }, [String(last.statement)]),
      el("p", { class: "small", style: "margin-top:8px" }, ["No action required."]),
    ]);
  }

  function step1() {
    return el("div", {}, [
      lastCard(),
      el("div", { class: "card cardPad" }, [
        sectionLabel("Step 1 of 3"),
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
      sectionLabel("Step 2 of 3"),
      el("h2", { class: "h2" }, ["What is not required right now?"]),
      el("p", { class: "small" }, ["Choose one. No further thinking."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        ...RELEASE_OPTIONS.map((o) =>
          tile(
            { label: o.label, hint: o.hint, dot: o.dot },
            () => {
              state.release = o.id;
              buildStatement();
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

  function closureCard() {
    // Non-negotiable closure states: REST / RELIEF / READINESS
    // Reflect v1.0 uses REST only (lowest demand).
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Closure"),
      el("h2", { class: "h2" }, [state.closure]),
      el("p", { class: "p" }, [state.statement]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Nothing is required right now."]),
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
              state.release = null;
              state.statement = "";
              state.closure = "REST";
              rerender();
              window.scrollTo(0, 0);
            },
          },
          ["Reflect again"]
        ),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    if (state.step === 1) wrap.appendChild(step1());
    else if (state.step === 2) wrap.appendChild(step2());
    else wrap.appendChild(closureCard());
  }

  rerender();
  return wrap;
}
