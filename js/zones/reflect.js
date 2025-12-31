// js/zones/reflect.js (FULL REPLACEMENT)
import { appendLog, readLog } from "../storage.js";

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

function sectionLabel(text) {
  // Avoid "badge" UI to comply with GOVERNANCE.md
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
}

const STEP1 = [
  { id: "me", label: "Something I said / did", hint: "I keep replaying my side." },
  { id: "them", label: "Something they said / did", hint: "I’m stuck on what it meant." },
  { id: "decision", label: "A decision I’m avoiding", hint: "I don’t want to choose." },
  { id: "future", label: "Fear of a future outcome", hint: "My brain is predicting disaster." },
  { id: "tension", label: "I don’t know — just tension", hint: "I feel off, but can’t name it." },
];

const CONTROL = [
  { id: "actions", label: "My actions", hint: "What I do next." },
  { id: "boundaries", label: "My boundaries", hint: "What I will/won’t engage with." },
  { id: "expectations", label: "My expectations", hint: "What I’m assuming or hoping." },
  { id: "nothing", label: "Nothing right now", hint: "It’s out of my hands today." },
];

// NOTE: Direction + Next Step removed (redundant). Reflect should route to Today’s Plan.
const MOVES = [
  { id: "pause24", label: "Do nothing for 24 hours", hint: "No messages. No checking. No analysis.", to: "#/home" },
  { id: "calm", label: "Calm first (2 minutes)", hint: "Reduce intensity, then decide.", to: "#/yellow/calm" },
  { id: "shield", label: "Stop the Urge", hint: "Pause and add friction.", to: "#/yellow/stop" },
  { id: "move", label: "Move Forward", hint: "Move first. Think later.", to: "#/green/move" },
  { id: "today", label: "Today’s Plan", hint: "Three steps only. Do Step 1.", to: "#/green/today" },
];

function lastClarify() {
  try {
    const entries = readLog().filter((e) => e.kind === "clarify");
    return entries.length ? entries[0] : null; // newest-first
  } catch {
    return null;
  }
}

export function renderReflect() {
  const wrap = el("div", { class: "flowShell" });

  const state = {
    step: 1,
    loop: null,
    control: null,
    move: null,
    statement: "",
  };

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Clarify the Next Move"]),
        el("p", { class: "p" }, ["Three taps. Lock one move. Then do it."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
      ]),
    ]);
  }

  function tile({ label, hint }, onClick, dotClass = "dotGreen") {
    return el("button", { class: "actionTile", type: "button", onClick }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [el("div", { class: "tileTitle" }, [label]), el("div", { class: "tileSub" }, [hint])]),
        el("div", { class: `zoneDot ${dotClass}` }, []),
      ]),
      el("p", { class: "tileHint" }, ["Tap"]),
    ]);
  }

  function setStep(n) {
    state.step = n;
    rerender();
    window.scrollTo(0, 0);
  }

  function buildStatement() {
    const loopLabel = STEP1.find((x) => x.id === state.loop)?.label || "tension";
    const ctrlLabel = CONTROL.find((x) => x.id === state.control)?.label || "my actions";
    const moveLabel = MOVES.find((x) => x.id === state.move)?.label || "Do nothing for 24 hours";

    if (state.move === "pause24") {
      state.statement = "For the next 24 hours, my move is: no contact, no checking, no analysis.";
      return;
    }
    if (state.control === "nothing") {
      state.statement = `This is out of my hands today. My move is: ${moveLabel}.`;
      return;
    }
    state.statement = `I’m looping on: ${loopLabel}. I control: ${ctrlLabel}. My next move is: ${moveLabel}.`;
  }

  function save() {
    try {
      appendLog({
        kind: "clarify",
        when: nowISO(),
        loop: state.loop,
        control: state.control,
        move: state.move,
        statement: state.statement,
      });
    } catch {}
  }

  function lastMoveCard() {
    const last = lastClarify();
    if (!last?.statement) return null;
    const moveTo = MOVES.find((m) => m.id === last.move)?.to || "#/home";

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Last locked move"),
      el("p", { class: "p" }, [last.statement]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = moveTo) }, ["Do it now"]),
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              state.step = 1;
              state.loop = null;
              state.control = null;
              state.move = null;
              state.statement = "";
              rerender();
            },
          },
          ["Run Clarify"]
        ),
      ]),
    ]);
  }

  function step1() {
    const lastCard = lastMoveCard();
    return el("div", {}, [
      lastCard,
      el("div", { class: "card cardPad" }, [
        sectionLabel("Step 1 of 3"),
        el("h2", { class: "h2" }, ["What’s looping?"]),
        el("p", { class: "small" }, ["Pick what fits best."]),
        el("div", { class: "flowShell", style: "margin-top:10px" }, STEP1.map((o) => tile(o, () => { state.loop = o.id; setStep(2); }, "dotGreen"))),
      ]),
    ].filter(Boolean));
  }

  function step2() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Step 2 of 3"),
      el("h2", { class: "h2" }, ["What’s in your control right now?"]),
      el("p", { class: "small" }, ["This reduces rumination fast."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        CONTROL.map((o) => tile(o, () => { state.control = o.id; setStep(3); }, o.id === "nothing" ? "dotYellow" : "dotGreen"))
      ),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(1) }, ["Back"]),
      ]),
    ]);
  }

  function step3() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Step 3 of 3"),
      el("h2", { class: "h2" }, ["Pick the smallest safe move"]),
      el("p", { class: "small" }, ["Tap one to lock it."]),
      el(
        "div",
        { class: "flowShell", style: "margin-top:10px" },
        MOVES.map((m) =>
          tile(
            { label: m.label, hint: m.hint },
            () => {
              state.move = m.id;
              buildStatement();
              save();
              setStep(4);
            },
            (m.id === "shield" || m.id === "calm") ? "dotYellow" : "dotGreen"
          )
        )
      ),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(2) }, ["Back"]),
      ]),
    ]);
  }

  function done() {
    const move = MOVES.find((x) => x.id === state.move) || MOVES[0];
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Locked"),
      el("h2", { class: "h2" }, ["Your next move"]),
      el("p", { class: "p" }, [state.statement]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = move.to) }, ["Do it now"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Home"]),
      ]),
      el("div", { class: "btnRow" }, [
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              state.step = 1;
              state.loop = null;
              state.control = null;
              state.move = null;
              state.statement = "";
              rerender();
            },
          },
          ["Run Clarify again"]
        ),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Rule: once you lock a move, stop. Then do it."]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    if (state.step === 1) wrap.appendChild(step1());
    else if (state.step === 2) wrap.appendChild(step2());
    else if (state.step === 3) wrap.appendChild(step3());
    else wrap.appendChild(done());
  }

  rerender();
  return wrap;
}
