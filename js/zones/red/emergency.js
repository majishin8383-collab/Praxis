import { appendLog, readLog } from "../../storage.js";

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

export function renderEmergency() {
  const wrap = el("div", { class: "flowShell" });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Emergency"]),
        el("p", { class: "p" }, ["If you are at risk of harming yourself or someone else, stop here."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function recent() {
    const log = readLog().filter(e => e.kind === "emergency").slice(0, 6);
    if (!log.length) return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent emergency uses"]),
      el("p", { class: "p" }, ["No entries yet."]),
    ]);
    return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent emergency uses"]),
      ...log.map(e => el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["Emergency"]),
        el("div", { class: "small" }, [`${new Date(e.when).toLocaleString()} • ${e.action || "used"}`]),
      ]))
    ]);
  }

  function log(action) {
    appendLog({ kind: "emergency", when: nowISO(), action });
  }

  const card = el("div", { class: "card cardPad redzone" }, [
    el("div", { class: "badge" }, ["Call for immediate help"]),
    el("p", { class: "small" }, ["In the U.S.: 988 or 911"]),
    el("div", { class: "btnRow" }, [
      el("a", { class: "btn btnDanger", href: "tel:988", onClick: () => log("called 988") }, ["Call 988"]),
      el("a", { class: "btn btnDanger", href: "tel:911", onClick: () => log("called 911") }, ["Call 911"]),
    ]),
    el("div", { class: "hr" }, []),
    el("div", { class: "btnRow" }, [
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => {
          const msg = "I’m not okay. Can you stay with me or call me right now?";
          window.prompt("Copy & send this message:", msg);
          log("messaged someone trusted");
        }
      }, ["Message someone you trust"]),
      el("button", {
        class: "btn",
        type: "button",
        onClick: () => {
          alert("Make the space safer: move to a safer place and create distance from anything that could cause harm.");
          log("made space safer");
        }
      }, ["Make the space safer"]),
    ]),
    el("p", { class: "small" }, ["Praxis is not a replacement for professional care."]),
  ]);

  wrap.appendChild(header());
  wrap.appendChild(card);
  wrap.appendChild(el("div", { class: "card cardPad" }, [recent()]));
  return wrap;
}
