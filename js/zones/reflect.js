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
  // Avoid "badge" UI; keep governance-consistent label style.
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

// Reflect routes to existing tools. No “system hub” pressure.
// Closure state is determined by the move chosen (non-negotiable).
const MOVES = [
  { id: "pause24", label: "Pause for 24 hours", hint: "No messages. No checking.", to: "#/home", closure: "REST", dot: "dotGreen" },
  { id: "calm", label: "Calm first (2 minutes)", hint: "Lower intensity first.", to: "#/yellow/calm", closure: "RELIEF", dot: "dotYellow" },
  { id: "shield", label: "Stop the Urge", hint: "Pause and add friction.", to: "#/yellow/stop", closure: "RELIEF", dot: "dotYellow" },
  { id: "move", label: "Move Forward", hint: "Body first. Then momentum.", to: "#/green/move", closure: "READINESS", dot: "dotGreen" },
  { id: "today", label: "Today’s Plan", hint: "Three steps only.", to: "#/green/today", closure: "READINESS", dot: "dotGreen" },
];

// Optional reflection (tap-only). Only shown AFTER closure is named.
const OPTIONAL_NEED = [
  { id: "space", label: "Space", hint: "Less contact / less input." },
  { id: "clarity", label: "Clarity", hint: "One simple frame." },
  { id: "stability", label: "Stability", hint: "Reduce intensity." },
  { id: "momentum", label: "Momentum", hint: "One small action." },
];

const OPTIONAL_EASIER = [
  { id: "remove_trigger", label: "Remove a trigger", hint: "Mute / block / put away." },
  { id: "reduce_contact", label: "Reduce contact", hint: "Shorter, later, or none." },
  { id: "smaller_step", label: "Smaller step", hint: "Cut it in half." },
  { id: "move_body", label: "Move body", hint: "Walk / water / light." },
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
    closure: null, // REST | RELIEF | READINESS
    // Optional reflection (tap-only)
    need: null,
    easier: null,
  };

  try {
    appendLog({ kind: "reflect_open", when: nowISO() });
  } catch {}

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Reflect"]),
        el("p", { class: "p" }, ["Three taps. One next move."]),
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
    const moveObj = MOVES.find((x) => x.id === state.move) || MOVES[0];

    state.closure = moveObj.closure || "REST";

    if (state.move === "pause24") {
      state.statement = "For 24 hours: no contact, no checking.";
      return;
    }
    if (state.control === "nothing") {
      state.statement = `Out of my hands today. Next: ${moveObj.label}.`;
      return;
    }
    state.statement = `Looping: ${loopLabel}. Control: ${ctrlLabel}. Next: ${moveObj.label}.`;
  }

  function save() {
    try {
      appendLog({
        kind: "clarify",
        when: nowISO(),
        loop: state.loop,
        control: state.control,
        move: state.move,
        closure: state.closure,
        statement: state.statement,
        // optional reflection (safe, descriptive)
        need: state.need || null,
        easier: state.easier || null,
      });
    } catch {}
  }

  function resetLocal() {
    state.step = 1;
    state.loop = null;
    state.control = null;
    state.move = null;
    state.statement = "";
    state.closure = null;
    state.need = null;
    state.easier = null;
  }

  function lastMoveCard() {
    const last = lastClarify();
    if (!last?.statement) return null;

    const moveTo = MOVES.find((m) => m.id === last.move)?.to || "#/home";
    const closure = String(last.closure || "").toUpperCase();
    const closureLabel = closure === "RELIEF" || closure === "READINESS" || closure === "REST" ? closure : null;

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Last"),
      el("p", { class: "p" }, [last.statement]),
      closureLabel ? el("p", { class: "small" }, [`Closure: ${closureLabel}`]) : null,
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = moveTo) }, ["Continue"]),
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              resetLocal();
              rerender();
            },
          },
          ["Clarify again"]
        ),
      ]),
    ].filter(Boolean));
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
      el("h2", { class: "h2" }, ["What’s in your control?"]),
      el("p", { class: "small" }, ["This reduces rumination."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, CONTROL.map((o) => tile(o, () => { state.control = o.id; setStep(3); }, o.id === "nothing" ? "dotYellow" : "dotGreen"))),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(1) }, ["Back"]),
      ]),
    ]);
  }

  function step3() {
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Step 3 of 3"),
      el("h2", { class: "h2" }, ["Pick the smallest safe move"]),
      el("p", { class: "small" }, ["One tap to lock it."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, MOVES.map((m) =>
        tile(
          { label: m.label, hint: m.hint },
          () => {
            state.move = m.id;
            buildStatement();
            try {
              appendLog({ kind: "reflect_lock", when: nowISO(), move: state.move, closure: state.closure });
            } catch {}
            setStep(4);
          },
          m.dot || "dotGreen"
        )
      )),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => setStep(2) }, ["Back"]),
      ]),
    ]);
  }

  function optionalReflectionCard() {
    // Optional by governance: ignorable, tap-only, no evaluation.
    return el("div", { class: "card cardPad" }, [
      sectionLabel("Optional"),
      el("p", { class: "small" }, ["Only if it helps."]),
      el("div", { class: "flowShell", style: "margin-top:10px" }, [
        el("div", { class: "card", style: "padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);" }, [
          el("div", { class: "small" }, ["What do you need most?"]),
          el("div", { class: "flowShell", style: "margin-top:8px" }, OPTIONAL_NEED.map((o) =>
            tile(
              { label: o.label, hint: o.hint },
              () => { state.need = o.id; rerender(); },
              "dotGreen"
            )
          )),
        ]),
        el("div", { class: "card", style: "padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);" }, [
          el("div", { class: "small" }, ["What would make this easier?"]),
          el("div", { class: "flowShell", style: "margin-top:8px" }, OPTIONAL_EASIER.map((o) =>
            tile(
              { label: o.label, hint: o.hint },
              () => { state.easier = o.id; rerender(); },
              "dotGreen"
            )
          )),
        ]),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, [
        state.need ? `Need: ${OPTIONAL_NEED.find((x) => x.id === state.need)?.label || "—"}` : "Need: —",
        "  ",
        state.easier ? `Easier: ${OPTIONAL_EASIER.find((x) => x.id === state.easier)?.label || "—"}` : "Easier: —",
      ]),
    ]);
  }

  function done() {
    const move = MOVES.find((x) => x.id === state.move) || MOVES[0];

    // ✅ Non-negotiable closure state
    const closure = state.closure || "REST";
    const closureLine =
      closure === "REST" ? "REST — nothing else is required." :
      closure === "RELIEF" ? "RELIEF — lower intensity first." :
      "READINESS — one next step is enough.";

    // Save once on entering done (idempotent enough for our purposes)
    if (!state._saved) {
      state._saved = true;
      save();
    }

    return el("div", {}, [
      el("div", { class: "card cardPad" }, [
        sectionLabel("Closure"),
        el("h2", { class: "h2" }, [closure]),
        el("p", { class: "small" }, [closureLine]),
      ]),
      el("div", { class: "card cardPad" }, [
        sectionLabel("Locked"),
        el("p", { class: "p" }, [state.statement]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = move.to) }, ["Continue"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
        ]),
        el("div", { class: "btnRow" }, [
          el("button", {
            class: "btn",
            type: "button",
            onClick: () => {
              resetLocal();
              rerender();
            },
          }, ["Clarify again"]),
        ]),
      ]),
      // Optional reflection AFTER closure is named
      optionalReflectionCard(),
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
