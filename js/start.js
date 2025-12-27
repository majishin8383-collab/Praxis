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

const OPTIONS = [
  {
    label: "Overwhelmed / anxious",
    hint: "Lower intensity first.",
    to: "#/yellow/calm",
    goLabel: "Calm Me Down",
    dot: "dotYellow",
  },
  {
    label: "Urge to act / message / react",
    hint: "Pause before acting.",
    to: "#/yellow/stop",
    goLabel: "Stop the Urge",
    dot: "dotYellow",
  },
  {
    label: "I’m not safe / risk is high",
    hint: "Immediate support.",
    to: "#/red/emergency",
    goLabel: "Emergency",
    dot: "dotRed",
  },
  {
    label: "Stuck / frozen",
    hint: "Body first. Then progress.",
    to: "#/green/move",
    goLabel: "Move Forward",
    dot: "dotGreen",
  },
  {
    label: "Restless / distracted",
    hint: "Discharge energy fast.",
    to: "#/green/move",
    goLabel: "Move Forward",
    dot: "dotGreen",
  },
  {
    label: "I’m okay — I need direction",
    hint: "Pick a lane for today.",
    to: "#/green/direction",
    goLabel: "Choose Today’s Direction",
    dot: "dotGreen",
  },
  {
    label: "I have a day — I need a plan",
    hint: "Three steps only.",
    to: "#/green/today",
    goLabel: "Today’s Plan",
    dot: "dotGreen",
  },
  {
    label: "I don’t know",
    hint: "One tap routes you.",
    to: "#/green/next",
    goLabel: "Find Your Next Step",
    dot: "dotGreen",
  },
];

export function renderStart() {
  const wrap = el("div", { class: "flowShell" });

  const header = el("div", { class: "flowHeader" }, [
    el("div", {}, [
      el("h1", { class: "h1" }, ["Start"]),
      el("p", { class: "p" }, ["How are you feeling right now? Tap the closest match."]),
    ]),
    el("div", { class: "flowMeta" }, [
      el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Skip → Reset"]),
    ]),
  ]);

  function tile(o) {
    return el(
      "button",
      {
        class: "actionTile",
        type: "button",
        onClick: () => (location.hash = o.to),
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

  wrap.appendChild(header);

  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["No thinking. One tap."]),
      el("p", { class: "small" }, ["Praxis routes you to the right tool immediately."]),
    ])
  );

  wrap.appendChild(el("div", { class: "flowShell" }, OPTIONS.map(tile)));

  // Optional: always-visible emergency shortcut (quiet but present)
  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("p", { class: "small" }, ["If you’re at risk of harm:"]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnDanger", type: "button", onClick: () => (location.hash = "#/red/emergency") }, [
          "Emergency",
        ]),
      ]),
    ])
  );

  return wrap;
}
