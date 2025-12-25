function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
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
    label: "Overwhelmed / anxious",
    hint: "Lower intensity first.",
    go: "#/yellow/calm",
    goLabel: "Calm Me Down"
  },
  {
    label: "Urge to act / message / react",
    hint: "Pause before acting.",
    go: "#/yellow/stop",
    goLabel: "Stop the Urge"
  },
  {
    label: "Stuck / frozen",
    hint: "Body first. Then progress.",
    go: "#/green/move",
    goLabel: "Move Forward"
  },
  {
    label: "Restless / distracted",
    hint: "Discharge energy fast.",
    go: "#/green/move",
    goLabel: "Move Forward"
  },
  {
    label: "I’m okay — I need direction",
    hint: "Pick a lane for today.",
    go: "#/green/direction",
    goLabel: "Choose Today’s Direction"
  },
  {
    label: "I don’t know",
    hint: "Action creates clarity.",
    go: "#/green/move",
    goLabel: "Move Forward"
  }
];

export function renderNextStep() {
  const wrap = el("div", { class: "flowShell" });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Find Your Next Step"]),
        el("p", { class: "p" }, ["Tap what’s closest. Praxis sends you to the next move."]),
      ]),
      // Reset button hidden by CSS; safe to keep
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function tile(o) {
    return el("button", {
      class: "actionTile",
      type: "button",
      onClick: () => { location.hash = o.go; }
    }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [o.label]),
          el("div", { class: "tileSub" }, [o.goLabel]),
        ]),
        el("div", { class: "zoneDot dotGreen" }, []),
      ]),
      el("p", { class: "tileHint" }, [o.hint]),
    ]);
  }

  wrap.appendChild(header());

  wrap.appendChild(el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["No thinking. One tap."]),
    el("p", { class: "small" }, ["Whatever you tap becomes the next screen."]),
  ]));

  wrap.appendChild(el("div", { class: "flowShell" }, OPTIONS.map(tile)));

  // Optional: emergency link always visible but not noisy
  wrap.appendChild(el("div", { class: "card cardPad" }, [
    el("p", { class: "small" }, ["If you’re at risk of harm:"]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnDanger", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"]),
    ])
  ]));

  return wrap;
}
