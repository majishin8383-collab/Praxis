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

export function renderNextStep() {
  const wrap = el("div", { class: "flowShell" });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Find Your Next Step"]),
        el("p", { class: "p" }, ["One clear move forward."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function choice(label, goHash) {
    return el("button", { class: "actionTile", type: "button", onClick: () => (location.hash = goHash) }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [label]),
          el("div", { class: "tileSub" }, ["Tap to take the next step"]),
        ]),
        el("div", { class: "zoneDot dotGreen" }, []),
      ]),
      el("p", { class: "tileHint" }, ["No thinking. Just the next move."]),
    ]);
  }

  const card = el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Which feels closest right now?"]),
    choice("I feel overwhelmed", "#/yellow/calm"),
    choice("I feel restless", "#/green/move"),
    choice("I feel stuck", "#/green/move"),
    choice("I feel okay, but unfocused", "#/green/direction"),
    choice("I don’t know", "#/green/move"),
  ]);

  wrap.appendChild(header());
  wrap.appendChild(card);
  return wrap;
}
