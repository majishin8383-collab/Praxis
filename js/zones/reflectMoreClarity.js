/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/reflectMoreClarity.js (NEW FILE)
import { appendLog, consumeNextIntent, isPro } from "../storage.js";

const BUILD = "RFM-01";

// DEV: keep More clarity usable during development.
// PRE-SHIP: set to false to gate behind isPro().
const DEV_UNLOCK_MORE_CLARITY = true;

// (Optional) If reflect.js passes context via setNextIntent(), we can read it here.
// Not required for function, but future-proof.
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

// More clarity modes (tap-only, one line)
const MODES = [
  { id: "pattern", label: "Pattern", hint: "One descriptive pattern line." },
  { id: "boundary", label: "Boundary", hint: "One boundary line for today." },
  { id: "value", label: "Value", hint: "One value line that fits." },
  { id: "next", label: "Next smallest step", hint: "One tiny step line." },
];

function canUseMoreClarity() {
  return DEV_UNLOCK_MORE_CLARITY || isPro();
}

// Governance-safe: one sentence, descriptive, no evaluation, no “should”.
function buildLine(modeId, ctx) {
  const loop = String(ctx?.loopLabel || "").trim();
  const loopPart = loop ? ` around ${loop}` : "";

  if (modeId === "pattern") return `Pattern: repeat-loop${loopPart}.`;
  if (modeId === "boundary") return "Boundary: no checking, no messaging, no proving—today.";
  if (modeId === "value") return "Value: steadiness over urgency—today.";
  return "Next step: water, breath, or a small reset—one only.";
}

export function renderReflectMoreClarity() {
  const wrap = el("div", { class: "flowShell" });

  // Read context if reflect.js handed it off (optional).
  const intent = consumeNextIntent?.() || null;
  let ctx = { loopLabel: "" };

  if (intent && typeof intent === "object" && intent.intent === INTENT_REFLECT_MORE_CLARITY) {
    const p = intent.payload && typeof intent.payload === "object" ? intent.payload : null;
    const loopRaw = typeof p?.loop === "string" ? p.loop : null;
    // loop from reflect.js is an id; we keep it generic here to avoid coupling.
    // If you later want perfect labels, we can pass loopLabel from reflect.js.
    ctx.loopLabel = typeof p?.loopLabel === "string" ? p.loopLabel : (loopRaw ? String(loopRaw) : "");
  }

  safeAppendLog({ kind: "reflect_more_open_v1", when: nowISO(), build: BUILD });

  const state = {
    step: "pick", // pick | closure
    mode: null,
    line: "",
    closure: "REST",
  };

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["More clarity"]),
        el("p", { class: "p" }, ["One tap. One line. Close."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Back"]),
      ]),
    ]);
  }

  function pickScreen() {
    // If gated, we keep demand low and return agency.
    if (!canUseMoreClarity()) {
      return el("div", { class: "card cardPad" }, [
        sectionLabel("Closure"),
        el("h2", { class: "h2" }, ["REST"]),
        el("p", { class: "p" }, ["More clarity is not available in this version."]),
        el("p", { class: "small", style: "margin-top:8px" }, ["Nothing else is required right now."]),
        el("div", { class: "btnRow", style: "margin-top:10px" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/reflect") }, [
            "Back to Reflect",
          ]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Home"]),
        ]),
      ]);
    }

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Pick one"),
      el("h2", { class: "h2" }, ["What kind of clarity fits?"]),
      el("p", { class: "small" }, ["Tap once. No analysis."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        MODES.map((m) =>
          tile({ label: m.label, hint: m.hint, dot: "dotGreen" }, () => {
            state.mode = m.id;
            state.line = buildLine(m.id, ctx);

            safeAppendLog({
              kind: "reflect_more_lock_v1",
              when: nowISO(),
              build: BUILD,
              mode: state.mode,
              line: state.line,
            });

            state.step = "closure";
            rerender();
            window.scrollTo(0, 0);
          })
        )
      ),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Back"]),
      ]),
    ]);
  }

  function closureScreen() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Closure"),
      el("h2", { class: "h2" }, [state.closure]),
      el("p", { class: "p" }, [state.line || "One line is allowed."]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Nothing else is required right now."]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/reflect") }, [
          "Back to Reflect",
        ]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Home"]),
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              state.step = "pick";
              state.mode = null;
              state.line = "";
              rerender();
              window.scrollTo(0, 0);
            },
          },
          ["More clarity again"]
        ),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(state.step === "closure" ? closureScreen() : pickScreen());
  }

  rerender();
  return wrap;
}
