/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/pro/brain.js (FULL REPLACEMENT)
import { appendLog, consumeNextIntent, setNextIntent } from "../storage.js";
import { getMemorySnapshot } from "../memory.js";

const BUILD = "PB-03";

const INTENT_PRO_BRAIN_CONTEXT = "pro_brain_context_v1";
const INTENT_REFLECT_MORE_CLARITY_RETURN = "reflect_more_clarity_return_v1";
const INTENT_TODAY_PREFILL = "today_plan_prefill";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) {
      node.setAttribute(k, "");
    } else {
      node.setAttribute(k, v);
    }
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
      el("div", {}, [
        el("div", { class: "tileTitle" }, [label]),
        el("div", { class: "tileSub" }, [hint]),
      ]),
      el("div", { class: `zoneDot ${dot}` }, []),
    ]),
    el("p", { class: "tileHint" }, ["Tap"]),
  ]);
}

const MODES = [
  { id: "name", label: "Name the lever", hint: "One controllable lever for today." },
  { id: "protect", label: "What it’s protecting", hint: "What the pattern is trying to prevent." },
  { id: "trade", label: "Trade urgency for steadiness", hint: "One clean replacement behavior." },
  { id: "boundary", label: "Boundary for the next hour", hint: "One boundary line. Nothing extra." },
  { id: "next", label: "Next smallest step", hint: "One action that reduces load." },
];

function buildGuidance(modeId, ctx) {
  const loop = String(ctx?.loop || "tension");
  const lens = String(ctx?.lens || "");
  const deepen = String(ctx?.deepenLine || "").trim();

  switch (modeId) {
    case "name":
      return `Lever: choose one controllable action that lowers the loop around ${loop}.`;
    case "protect":
      return lens === "fear"
        ? "Protection: fear is attempting to prevent pain. That’s its job."
        : "Protection: the system is trying to reduce uncertainty. That’s its job.";
    case "trade":
      return "Swap: one steady behavior replaces one urgency behavior—today.";
    case "boundary":
      return "Boundary: no checking, no contacting, no proving—for the next hour.";
    case "next":
      return deepen
        ? "Next: honor the line you chose. Then stop."
        : "Next: one short action only. No extra decisions.";
    default:
      return "One step is allowed. The rest can wait.";
  }
}

function topKey(map) {
  const entries = Object.entries(map || {}).filter(([, n]) => Number(n) > 0);
  if (!entries.length) return "";
  entries.sort((a, b) => Number(b[1]) - Number(a[1]));
  return String(entries[0][0] || "");
}

function urgeLabel(id) {
  switch (String(id || "")) {
    case "send": return "Send / react";
    case "check": return "Check / reopen";
    case "buy": return "Buy / spend";
    case "argue": return "Argue";
    case "boundary": return "Break a boundary";
    case "other": return "Something else";
    default: return "";
  }
}

function toolLabel(id) {
  switch (String(id || "")) {
    case "calm": return "Calm";
    case "stop": return "Stop the Urge";
    case "move": return "Move Forward";
    case "today": return "Today’s Plan";
    case "reflect": return "Reflect";
    case "emergency": return "Emergency";
    default: return "";
  }
}

function patternLines(snapshot, ctx) {
  const lines = [];
  if (!snapshot || typeof snapshot !== "object") return lines;

  const daysUsedCount = Number(snapshot.daysUsedCount || 0);
  const topTool = toolLabel(topKey(snapshot.tools || {}));
  const topUrge = urgeLabel(topKey(snapshot.stop?.urgeTypes || {}));
  const topOutcome = topKey(snapshot.stop?.outcomes || {});
  const topLoop = topKey(snapshot.reflect?.loops || {});

  if (daysUsedCount >= 3) {
    lines.push(`Pattern: Praxis has been used across ${daysUsedCount} days.`);
  }

  if (topTool) {
    lines.push(`Pattern: ${topTool} has shown up most often.`);
  }

  if (topUrge) {
    lines.push(`Pattern: ${topUrge} is the most common urge so far.`);
  }

  if (topOutcome === "passed") {
    lines.push("Pattern: urges do pass here.");
  } else if (topOutcome === "still_present") {
    lines.push("Pattern: some urges need more than one pass.");
  }

  if (ctx?.loop && topLoop && String(ctx.loop) === String(topLoop)) {
    lines.push("Pattern: this loop has shown up before.");
  }

  return lines.slice(0, 3);
}

export function renderProBrain() {
  const wrap = el("div", { class: "flowShell" });

  const intent = consumeNextIntent();
  const ctx =
    intent &&
    typeof intent === "object" &&
    String(intent.intent || "") === INTENT_PRO_BRAIN_CONTEXT &&
    intent.payload &&
    typeof intent.payload === "object"
      ? intent.payload
      : null;

  const snapshot = getMemorySnapshot();

  const state = {
    mode: null,
    line: "",
  };

  safeAppendLog({ kind: "pro_brain_open_v1", when: nowISO(), build: BUILD });

  function backTo() {
    return ctx && typeof ctx.returnTo === "string" && ctx.returnTo ? ctx.returnTo : "#/home";
  }

  function writeReflectReturnAndGo() {
    if (!state.line) return;
    try {
      setNextIntent(INTENT_REFLECT_MORE_CLARITY_RETURN, {
        deepenMode: state.mode ? `pro_${state.mode}` : "pro_line",
        deepenLine: state.line,
      });
    } catch {}
    location.hash = "#/reflect";
  }

  function sendToTodayPlan() {
    const text = state.line || "One step is allowed. The rest can wait.";
    try {
      setNextIntent(INTENT_TODAY_PREFILL, {
        from: "pro_brain",
        targetStep: 1,
        text,
        templateId: "clarity",
        defaultToStep: 2,
      });
    } catch {}
    location.hash = "#/green/today";
  }

  function goMoveForward() {
    location.hash = "#/green/move";
  }

  function goCalm() {
    location.hash = "#/yellow/calm";
  }

  function choose(modeId) {
    if (!ctx) return;

    const line = buildGuidance(modeId, ctx);
    state.mode = modeId;
    state.line = line;

    safeAppendLog({
      kind: "pro_brain_pick_v1",
      when: nowISO(),
      build: BUILD,
      mode: modeId,
      line,
      loop: ctx.loop || null,
      lens: ctx.lens || null,
    });

    rerender();
    window.scrollTo(0, 0);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Guidance"]),
        el("p", { class: "p" }, ["One line at a time. Tap-only. No spiraling."]),
        String(location.search || "").includes("debug=1")
          ? el("div", { class: "small" }, [`Build ${BUILD}`])
          : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = backTo()) }, ["Back"]),
      ]),
    ]);
  }

  function emptyState() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Context"),
      el("p", { class: "p" }, ["No active context. Start from Reflect."]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/reflect") }, [
          "Go to Reflect",
        ]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
      ]),
    ]);
  }

  function recapCard() {
    if (!ctx) return emptyState();

    const lines = [
      String(ctx.mirror || "").trim(),
      String(ctx.ground || "").trim(),
      String(ctx.release || "").trim(),
      String(ctx.deepenLine || "").trim(),
    ].filter(Boolean);

    return el("div", { class: "card cardPad" }, [
      sectionLabel("What we know"),
      ...lines.map((t, i) =>
        el("p", { class: i === 0 ? "p" : "small", style: i === 0 ? "" : "margin-top:6px;opacity:.9;" }, [t])
      ),
      el("p", { class: "small", style: "margin-top:10px" }, ["Pick one guidance line. Then choose the next move."]),
    ]);
  }

  function patternCard() {
    const lines = patternLines(snapshot, ctx);
    if (!lines.length) return null;

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Pattern noticed"),
      ...lines.map((t, i) =>
        el("p", { class: i === 0 ? "p" : "small", style: i === 0 ? "" : "margin-top:6px;opacity:.9;" }, [t])
      ),
    ]);
  }

  function lineCard() {
    if (!state.line) return null;

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Guidance line"),
      el("p", { class: "p" }, [state.line]),
      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: writeReflectReturnAndGo }, ["Hold this"]),
        el("button", { class: "btn", type: "button", onClick: sendToTodayPlan }, ["Plan it"]),
        el("button", { class: "btn", type: "button", onClick: goMoveForward }, ["Move Forward"]),
        el("button", { class: "btn", type: "button", onClick: goCalm }, ["Calm"]),
      ]),
    ]);
  }

  function modesCard() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Guidance"),
      el("h2", { class: "h2" }, ["Choose one line"]),
      el("p", { class: "small" }, ["Tap-only. No typing. No rabbit holes."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        MODES.map((m) => tile({ label: m.label, hint: m.hint, dot: "dotGreen" }, () => choose(m.id)))
      ),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(recapCard());

    const pc = patternCard();
    if (pc) wrap.appendChild(pc);

    const lc = lineCard();
    if (lc) wrap.appendChild(lc);

    if (ctx) wrap.appendChild(modesCard());
  }

  rerender();
  return wrap;
}
