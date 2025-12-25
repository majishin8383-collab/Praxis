import { appendLog } from "../../storage.js";

const BUILD = "EM-2";

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

function go(href) {
  window.location.href = href;
}

function open(url) {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = url;
}

function logOpen() {
  try {
    appendLog({ kind: "emergency_open", when: nowISO() });
  } catch {
    // ignore
  }
}

export function renderEmergency() {
  // ✅ log as soon as the screen renders
  logOpen();

  const wrap = el("div", { class: "flowShell" });

  const header = el("div", { class: "flowHeader" }, [
    el("div", {}, [
      el("h1", { class: "h1" }, ["Emergency"]),
      el("p", { class: "p" }, ["If safety is at risk, get real help now. Praxis will keep this simple."]),
      el("div", { class: "small" }, [`Build ${BUILD}`]),
    ]),
    el("div", { class: "flowMeta" }, [
      el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
    ])
  ]);

  const immediate = el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Immediate help"]),
    el("p", { class: "p" }, [
      "If you might hurt yourself or someone else, or you’re in immediate danger: call emergency services now."
    ]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => go("tel:911") }, ["Call 911"]),
      el("button", { class: "btn", type: "button", onClick: () => go("tel:988") }, ["Call 988 (US)"]),
      el("button", { class: "btn", type: "button", onClick: () => go("sms:988") }, ["Text 988 (US)"]),
    ]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn", type: "button", onClick: () => open("https://988lifeline.org/chat/") }, ["Chat 988 (US)"]),
      el("button", { class: "btn", type: "button", onClick: () => open("https://findahelpline.com/") }, ["Outside the US: find a helpline"]),
    ]),
    el("p", { class: "small", style: "margin-top:10px" }, [
      "If you’re not sure, choose 988 (US) or your local emergency number."
    ]),
  ]);

  const stabilize = el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["2-minute stabilization"]),
    el("p", { class: "p" }, ["Do these in order. No thinking."]),
    el("div", { class: "flowShell" }, [
      el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["1) Change position"]),
        el("div", { class: "small" }, ["Stand up, or sit with both feet on the floor."]),
      ]),
      el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["2) Exhale longer than inhale (x6)"]),
        el("div", { class: "small" }, ["In 4 seconds → out 6 seconds. Repeat 6 times."]),
      ]),
      el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["3) Put distance between you and anything dangerous"]),
        el("div", { class: "small" }, ["Move to a safer room, or step outside near other people."]),
      ]),
      el("div", { style: "padding:10px 0;" }, [
        el("div", { style: "font-weight:900;" }, ["4) Say this out loud"]),
        el("div", { class: "small" }, ["“This is a surge. It will pass. My job is to not act.”"]),
      ]),
    ])
  ]);

  const praxisNext = el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["If you’re safe enough to use Praxis"]),
    el("p", { class: "p" }, ["Pick one. Praxis will guide you."]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
    ]),
    el("p", { class: "small", style: "margin-top:10px" }, [
      "If risk spikes again, come back here and use 911/988 immediately."
    ])
  ]);

  wrap.appendChild(header);
  wrap.appendChild(immediate);
  wrap.appendChild(stabilize);
  wrap.appendChild(praxisNext);

  return wrap;
}
