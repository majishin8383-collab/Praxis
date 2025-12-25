import { appendLog } from "../../storage.js";

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
const nowISO = () => new Date().toISOString();

const KEY = "praxis_direction_today";

export function renderDirection() {
  const wrap = el("div", { class: "flowShell" });

  function setDirection(kind) {
    try { localStorage.setItem(KEY, kind); } catch {}
    appendLog({ kind: "direction", when: nowISO(), direction: kind });
    rerender("picked", kind);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Choose Today’s Direction"]),
        el("p", { class: "p" }, ["Pick a lane for today."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function chooser() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["You can change this later."]),
      el("p", { class: "p" }, ["Which one fits today best?"]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => setDirection("Stability") }, ["Stability"]),
        el("button", { class: "btn", type: "button", onClick: () => setDirection("Maintenance") }, ["Maintenance"]),
        el("button", { class: "btn", type: "button", onClick: () => setDirection("Progress") }, ["Progress"]),
        el("button", { class: "btn", type: "button", onClick: () => setDirection("Recovery") }, ["Recovery"]),
      ]),
      el("p", { class: "small" }, ["This sets the shape of your day, not a schedule."]),
    ]);
  }

  function picked(kind) {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, [`Today is a ${kind} day.`]),
      el("p", { class: "p" }, ["Here’s a simple version of today:"]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/today") }, ["Open Today’s Plan"]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => rerender("idle") }, ["Change direction"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function rerender(mode, kind) {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(el("div", { class: "card cardPad" }, [
      mode === "picked" ? picked(kind) : chooser()
    ]));
  }

  rerender("idle");
  return wrap;
}
