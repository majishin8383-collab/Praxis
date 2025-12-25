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
    id: "overwhelmed",
    label: "Overwhelmed / anxious",
    hint: "Too much in my head. Hard to start.",
    recommend: { title: "Calm Me Down", why: "Lower intensity first.", to: "#/yellow/calm" }
  },
  {
    id: "urge",
    label: "Urge to act / message / react",
    hint: "I feel pulled to do something I’ll regret.",
    recommend: { title: "Stop the Urge", why: "Pause before acting.", to: "#/yellow/stop" }
  },
  {
    id: "stuck",
    label: "Stuck / frozen",
    hint: "I’m not moving, even though I want to.",
    recommend: { title: "Move Forward", why: "Body first. Then progress.", to: "#/green/move" }
  },
  {
    id: "restless",
    label: "Restless / distracted",
    hint: "I can’t settle into anything.",
    recommend: { title: "Move Forward", why: "Burn off noise with motion.", to: "#/green/move" }
  },
  {
    id: "fine",
    label: "I’m okay — just need direction",
    hint: "I want a lane for today.",
    recommend: { title: "Choose Today’s Direction", why: "Pick a lane. Then act.", to: "#/green/direction" }
  },
  {
    id: "dontknow",
    label: "I don’t know",
    hint: "I can’t tell what I need.",
    recommend: { title: "Move Forward", why: "Action creates clarity.", to: "#/green/move" }
  }
];

export function renderNextStep() {
  const wrap = el("div", { class: "flowShell" });

  let selectedId = null;

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Find Your Next Step"]),
        el("p", { class: "p" }, ["Pick what’s closest. Praxis recommends one move."]),
      ]),
      // (Reset button hidden by CSS; safe to keep)
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function optionCard(o) {
    const active = selectedId === o.id;
    return el("button", {
      class: "actionTile",
      type: "button",
      style: active ? "border-color: rgba(86,240,139,.30); background: rgba(86,240,139,.06);" : "",
      onClick: () => { selectedId = o.id; rerender(); }
    }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [o.label]),
          el("div", { class: "tileSub" }, [o.hint]),
        ]),
        el("div", { class: "zoneDot dotGreen" }, []),
      ]),
      el("p", { class: "tileHint" }, ["Tap to select"]),
    ]);
  }

  function recommendation() {
    if (!selectedId) {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Choose one above"]),
        el("p", { class: "p" }, ["No thinking. Just pick what’s closest."]),
      ]);
    }

    const o = OPTIONS.find(x => x.id === selectedId);
    const r = o.recommend;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Recommended next move"]),
      el("h2", { class: "h2" }, [r.title]),
      el("p", { class: "p" }, [r.why]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = r.to) }, ["Go"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
      el("p", { class: "small" }, ["If this feels wrong, pick a different option above."]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    wrap.appendChild(el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Which feels closest right now?"]),
      el("p", { class: "small" }, ["One selection. One recommended action."]),
    ]));

    // options
    const list = el("div", { class: "flowShell" }, OPTIONS.map(optionCard));
    wrap.appendChild(list);

    // recommendation
    wrap.appendChild(recommendation());
  }

  rerender();
  return wrap;
}
