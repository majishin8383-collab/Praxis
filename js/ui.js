function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
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

export function setMain(viewNode) {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = "";
  if (viewNode) main.appendChild(viewNode);
}

const TILES = [
  // Yellow zone
  {
    title: "Calm Me Down",
    sub: "Drop intensity fast",
    hint: "2 minutes. Guided.",
    dot: "dotYellow",
    to: "#/yellow/calm",
  },
  {
    title: "Stop the Urge",
    sub: "Pause before acting",
    hint: "Buy time. Add friction.",
    dot: "dotYellow",
    to: "#/yellow/stop",
  },

  // Red zone
  {
    title: "Emergency",
    sub: "Immediate support",
    hint: "Use when safety is at risk.",
    dot: "dotRed",
    to: "#/red/emergency",
  },

  // Green zone
  {
    title: "Move Forward",
    sub: "Body first. Then progress.",
    hint: "Pick a ladder. Do it until the timer ends.",
    dot: "dotGreen",
    to: "#/green/move",
  },
  {
    title: "Find Your Next Step",
    sub: "Tap → go",
    hint: "Choose what’s closest.",
    dot: "dotGreen",
    to: "#/green/next",
  },
  {
    title: "Choose Today’s Direction",
    sub: "Pick a lane for today",
    hint: "Stability / Maintenance / Progress / Recovery.",
    dot: "dotGreen",
    to: "#/green/direction",
  },

  // ✅ Standalone Today Plan tile
  {
    title: "Today’s Plan",
    sub: "Three steps only",
    hint: "Pick a template, then fill 3 moves.",
    dot: "dotGreen",
    to: "#/green/today",
  },

  // Reflect / clarify
  {
    title: "Clarify the Next Move",
    sub: "Lock a move",
    hint: "Tap quickly. End with one action.",
    dot: "dotGreen",
    to: "#/reflect",
  },

  // ✅ NEW: History
  {
    title: "History",
    sub: "See your momentum",
    hint: "Recent sessions + summary.",
    dot: "dotGreen",
    to: "#/history",
  },
];

function tileButton(t) {
  return el(
    "button",
    { class: "actionTile", type: "button", onClick: () => (location.hash = t.to) },
    [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [t.title]),
          el("div", { class: "tileSub" }, [t.sub]),
        ]),
        el("div", { class: `zoneDot ${t.dot}` }, []),
      ]),
      el("p", { class: "tileHint" }, [t.hint]),
    ]
  );
}

export function renderHome() {
  const wrap = el("div", { class: "homeShell" });

  wrap.appendChild(
    el("div", { class: "homeHeader" }, [
      el("h1", { class: "h1" }, ["Reset"]),
      el("p", { class: "p" }, ["Choose the next right action. Praxis will guide the rest."]),
    ])
  );

  wrap.appendChild(el("div", { class: "homeGrid" }, TILES.map(tileButton)));

  return wrap;
}
