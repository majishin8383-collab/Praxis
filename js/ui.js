import { COPY } from "./data/copy.js";

export function setMain(node) {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = "";
  main.appendChild(node);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
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

function go(hash) {
  location.hash = hash; // simple navigation, no imports
}

function tile(a) {
  const dotClass =
    a.zone === "green" ? "dotGreen" :
    a.zone === "yellow" ? "dotYellow" :
    "dotRed";

  return el("button", {
    class: "actionTile",
    type: "button",
    onClick: () => go(a.to),
  }, [
    el("div", { class: "tileTop" }, [
      el("div", {}, [
        el("div", { class: "tileTitle" }, [a.title]),
        el("div", { class: "tileSub" }, [a.sub]),
      ]),
      el("div", { class: `zoneDot ${dotClass}` }, []),
    ]),
    el("p", { class: "tileHint" }, [a.hint]),
  ]);
}

export function renderHome() {
  return el("div", { class: "flowShell" }, [
    el("div", { class: "homeTop" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, [COPY.home.title]),
        el("p", { class: "p" }, [COPY.home.subtitle]),
      ]),
      el("div", { class: "badge" }, ["Tap-first. Minimal thinking."]),
    ]),
    el("div", { class: "homeGrid" }, COPY.home.actions.map(tile)),
  ]);
}
