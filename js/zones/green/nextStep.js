// js/zones/green/nextStep.js  (FULL REPLACEMENT)

const BUILD = "NS-3";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

const OPTIONS = [
  {
    label: "I’m dysregulated (anxious / intense)",
    hint: "Reduce intensity first.",
    go: "#/yellow/calm",
    goLabel: "Calm Me Down",
    dot: "dotYellow",
  },
  {
    label: "I have an urge to react / message / act",
    hint: "Pause before doing anything.",
    go: "#/yellow/stop",
    goLabel: "Stop the Urge",
    dot: "dotYellow",
  },
  {
    label: "I’m stuck / frozen",
    hint: "Body first. Then progress.",
    go: "#/green/move",
    goLabel: "Move Forward",
    dot: "dotGreen",
  },
  {
    label: "I’m stable — I need a plan",
    hint: "Three steps. One step at a time.",
    go: "#/green/today",
    goLabel: "Today’s Plan",
    dot: "dotGreen",
  },
  {
    label: "I’m stable — I need direction",
    hint: "Pick a lane. Auto-build the plan.",
    go: "#/green/direction",
    goLabel: "Today’s Direction",
    dot: "dotGreen",
  },
];

export function renderNextStep() {
  const wrap = el("div", { class: "flowShell" });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Find Your Next Step"]),
        el("p", { class: "p" }, ["Tap what’s closest. No overthinking."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function tile(o) {
    return el(
      "button",
      {
        class: "actionTile",
        type: "button",
        onClick: () => (location.hash = o.go),
      },
      [
        el("div", { class: "tileTop" }, [
          el("div", {}, [
            el("div", { class: "tileTitle" }, [o.label]),
            el("div", { class: "tileSub" }, [o.goLabel]),
          ]),
          el("div", { class: `zoneDot ${o.dot}` }, []),
        ]),
        el("p", { class: "tileHint" }, [o.hint]),
      ]
    );
  }

  wrap.appendChild(header());

  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Routing tool"]),
      el("p", { class: "small" }, ["Home is for “how do I feel.” This is for “what do I do next.”"]),
    ])
  );

  wrap.appendChild(el("div", { class: "flowShell" }, OPTIONS.map(tile)));

  // Always-available safety link (quiet, but present)
  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("p", { class: "small" }, ["If safety is at risk:"]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnDanger", type: "button", onClick: () => (location.hash = "#/red/emergency") }, [
          "Emergency",
        ]),
      ]),
    ])
  );

  return wrap;
}
