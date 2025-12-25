import { COPY } from "./data/copy.js";

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

export function setMain(view) {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = "";
  main.appendChild(view);
}

export function renderHome() {
  const { home } = COPY;

  const wrap = el("div", { class: "homeShell" });

  const header = el("div", { class: "homeHeader" }, [
    el("h1", { class: "h1" }, [home.title]),
    el("p", { class: "p" }, [home.subtitle]),
  ]);

  const grid = el("div", { class: "homeGrid" }, []);

  for (const a of home.actions) {
    const btn = el("button", {
      class: "actionTile",
      type: "button",
      onClick: () => (location.hash = a.to),
    }, [
      el("div", { class: "tileTop" }, [
        el("div", {}, [
          el("div", { class: "tileTitle" }, [a.title]),
          el("div", { class: "tileSub" }, [a.sub]),
        ]),
        el("div", { class: `zoneDot ${a.zone === "red" ? "dotRed" : a.zone === "yellow" ? "dotYellow" : "dotGreen"}` }, []),
      ]),
      el("p", { class: "tileHint" }, [a.hint]),
    ]);

    grid.appendChild(btn);
  }

  wrap.appendChild(header);
  wrap.appendChild(grid);
  return wrap;
}
