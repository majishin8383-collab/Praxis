import { readLog } from "./storage.js";

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

function niceKind(kind) {
  const map = {
    calm: "Calm Me Down",
    stop_urge: "Stop the Urge",
    move_forward: "Move Forward",
    focus: "Focus Sprint",
    today_plan: "Today’s Plan",
    direction: "Today’s Direction",
    clarify: "Clarify the Next Move",
  };
  return map[kind] || kind || "Session";
}

export function renderHistory() {
  const wrap = el("div", { class: "flowShell" });
  const log = readLog().slice(0, 50);

  wrap.appendChild(
    el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["History"]),
        el("p", { class: "p" }, ["Recent actions. Proof of movement."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", {
          class: "linkBtn",
          type: "button",
          onClick: () => (location.hash = "#/home"),
        }, ["Reset"]),
      ]),
    ])
  );

  if (!log.length) {
    wrap.appendChild(
      el("div", { class: "card cardPad" }, [
        el("p", { class: "p" }, ["No history yet. Use any tool once and it will appear here."]),
      ])
    );
    return wrap;
  }

  wrap.appendChild(
    el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Recent"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, [niceKind(e.kind)]),
          el("div", { class: "small" }, [
            `${new Date(e.when).toLocaleString()}${e.minutes ? " • " + e.minutes + " min" : ""}`
          ]),
          e.statement
            ? el("div", { class: "small" }, [e.statement])
            : null,
        ])
      )
    ])
  );

  return wrap;
}
