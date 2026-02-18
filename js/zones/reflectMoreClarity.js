/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/reflectMoreClarity.js (FULL REPLACEMENT)
import { appendLog, consumeNextIntent, setNextIntent } from "../storage.js";

const BUILD = "RFM-02";

const INTENT_REFLECT_MORE_CLARITY = "reflect_more_clarity_v1";
const INTENT_REFLECT_MORE_CLARITY_RETURN = "reflect_more_clarity_return_v1";

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

// Tap-only modes
const MODES = [
  { id: "pattern", label: "Pattern", hint: "One descriptive pattern line." },
  { id: "boundary", label: "Boundary", hint: "One boundary line for today." },
  { id: "value", label: "Value", hint: "One value line that fits." },
  { id: "next", label: "Next smallest step", hint: "One tiny step line." },
];

function loopLabelFromPayload(loopId) {
  const raw = String(loopId || "").trim();
  return raw ? raw : "tension";
}

function buildLine(modeId, loopId) {
  const loop = loopLabelFromPayload(loopId);

  if (modeId === "pattern") return `Pattern: repeat-loop around ${loop}.`;
  if (modeId === "boundary") return "Boundary: no checking, no messaging, no proving—today.";
  if (modeId === "value") return "Value: steadiness over urgency—today.";
  return "Next step: water, breath, or a small reset—one only.";
}

export function renderReflectMoreClarity() {
  const wrap = el("div", { class: "flowShell" });

  // read handoff from Reflect (one-time)
  const intent = consumeNextIntent();
  const payload =
    intent && typeof intent === "object" && String(intent.intent || "") === INTENT_REFLECT_MORE_CLARITY
      ? intent.payload && typeof intent.payload === "object"
        ? intent.payload
        : null
      : null;

  const loop = payload?.loop || null;
  const lens = payload?.lens || null;

  safeAppendLog({ kind: "reflect_more_open_v1", when: nowISO(), build: BUILD });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["One more line"]),
        el("p", { class: "p" }, ["Optional. Pick one. Return to closure."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Back"]),
      ]),
    ]);
  }

  function returnToReflect(modeId, line) {
    try {
      setNextIntent(INTENT_REFLECT_MORE_CLARITY_RETURN, {
        deepenMode: modeId,
        deepenLine: line,
      });
    } catch {}

    safeAppendLog({
      kind: "reflect_more_pick_v1",
      when: nowISO(),
      build: BUILD,
      mode: modeId,
      line,
      loop,
      lens,
    });

    location.hash = "#/reflect";
  }

  function body() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Optional"),
      el("h2", { class: "h2" }, ["One more line"]),
      el("p", { class: "small" }, ["Tap one. Nothing else."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        MODES.map((m) =>
          tile({ label: m.label, hint: m.hint, dot: "dotGreen" }, () => {
            const line = buildLine(m.id, loop);
            returnToReflect(m.id, line);
          })
        )
      ),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Back to Reflect"]),
      ]),
    ]);
  }

  wrap.appendChild(header());
  wrap.appendChild(body());
  return wrap;
}
