import { appendLog } from "../../storage.js";

const BUILD = "EM-3";
const KEY_LAST_EMERGENCY = "praxis_last_emergency_ts";

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

function rememberEmergencyOpened() {
  // Session signal for home suggestions
  try {
    sessionStorage.setItem(KEY_LAST_EMERGENCY, String(Date.now()));
  } catch {}

  // Log for history / analytics
  try {
    appendLog({ kind: "emergency_open", when: nowISO() });
  } catch {}
}

function go(href) {
  window.location.href = href;
}

function open(url) {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = url;
}

export function renderEmergency() {
  rememberEmergencyOpened();

  const wrap = el("div", { class: "flowShell" });

  const header = el("div", { class: "flowHeader" }, [
    el("div", {}, [
      el("h1", { class: "h1" }, ["Emergency"]),
      el("p", { class: "p" }, ["If safety is at risk, get real help now. Don’t handle this alone."]),
      el("div", { class: "small" }, [`Build ${BUILD}`]),
    ]),
    el("div", { class: "flowMeta" }, [
      el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
    ])
  ]);

  const immediate = el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Get help now"]),
    el("p", { class: "p" }, [
      "If you might hurt yourself or someone else, or you’re in immediate danger, contact emergency services right now."
    ]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => go("tel:911") }, ["Call 911"]),
      el("button", { class: "btn", type: "button", onClick: () => go("tel:988") }, ["Call 988 (US)"]),
      el("button", { class: "btn", type: "button", onClick: () => go("sms:988") }, ["Text 988 (US)"]),
    ]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn", type: "button", onClick: () => open("https://988lifeline.org/chat/") }, ["Chat with 988 (US)"]),
      el("button", { class: "btn", type: "button", onClick: () => open("https://findahelpline.com/") }, ["Find a helpline (outside the US)"]),
    ]),
    el("p", { class: "small", style: "margin-top:10px" }, [
      "If you’re unsure which option to choose, 988 (US) or your local emergency number is a good starting point."
    ]),
  ]);

  const stabilize = el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["Stabilize for 2 minutes"]),
    el("p", { class: "p" }, ["Do these steps in order. No analysis."]),
    el("div", { class: "flowShell" }, [
      el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["1) Change your position"]),
        el("div", { class: "small" }, ["Stand up, or sit with both feet flat on the floor."]),
      ]),
      el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["2) Exhale longer than you inhale (×6)"]),
        el("div", { class: "small" }, ["Inhale 4 seconds → exhale 6 seconds. Repeat six times."]),
      ]),
      el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
        el("div", { style: "font-weight:900;" }, ["3) Create distance from danger"]),
        el("div", { class: "small" }, ["Move away from anything you could use to hurt yourself or others."]),
      ]),
      el("div", { style: "padding:10px 0;" }, [
        el("div", { style: "font-weight:900;" }, ["4) Say this out loud"]),
        el("div", { class: "small" }, ["“This is a surge. It will pass. My job is to not act.”"]),
      ]),
    ])
  ]);

  const praxisNext = el("div", { class: "card cardPad" }, [
    el("div", { class: "badge" }, ["If you’re safe enough to continue"]),
    el("p", { class: "p" }, ["Choose one. Praxis will guide you step by step."]),
    el("div", { class: "btnRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
      el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
    ]),
    el("p", { class: "small", style: "margin-top:10px" }, [
      "If risk rises again, return here and contact emergency services immediately."
    ])
  ]);

  wrap.appendChild(header);
  wrap.appendChild(immediate);
  wrap.appendChild(stabilize);
  wrap.appendChild(praxisNext);

  return wrap;
}
