/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/green/nextStep.js (FULL REPLACEMENT)
import { appendLog, hasStabilizeCreditToday, setNextIntent } from "../../storage.js";

const BUILD = "NS-3";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

const nowISO = () => new Date().toISOString();

function safeAppendLog(entry) {
  try {
    appendLog(entry);
  } catch {}
}

function sectionLabel(text) {
  // Avoid "badge" UI to comply with GOVERNANCE.md
  return el("div", { class: "small", style: "opacity:.85;font-weight:800;letter-spacing:.02em;" }, [text]);
}

export function renderNextStep() {
  const wrap = el("div", { class: "flowShell" });

  const stabilizedToday = (() => {
    try {
      return hasStabilizeCreditToday();
    } catch {
      return false;
    }
  })();

  safeAppendLog({
    kind: "next_step_open",
    when: nowISO(),
    build: BUILD,
    stabilizedToday,
  });

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Find Next Step"]),
        el("p", { class: "p" }, ["No analysis. Pick one next move."]),
        String(location.search || "").includes("debug=1") ? el("div", { class: "small" }, [`Build ${BUILD}`]) : null,
      ].filter(Boolean)),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Home"]),
      ]),
    ]);
  }

  function mainCard() {
    const line = stabilizedToday
      ? "You stabilized today. A simple plan is available."
      : "If you’re not stable yet, start with motion or a pause first.";

    return el("div", { class: "card cardPad" }, [
      sectionLabel("Next"),
      el("p", { class: "p" }, [line]),

      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: () => {
            // If stabilized today, we allow Today’s Plan to open at Step 2 without marking Step 1 done.
            if (stabilizedToday) {
              try { setNextIntent("today_plan_step2"); } catch {}
            }
            location.hash = "#/green/today";
          },
        }, ["Today’s Plan"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => (location.hash = "#/green/move"),
        }, ["Move Forward"]),
      ]),

      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Calm Me Down"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/yellow/stop") }, ["Stop the Urge"]),
      ]),

      el("div", { class: "btnRow", style: "margin-top:10px" }, [
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/reflect") }, ["Clarify"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/red/emergency") }, ["Emergency"]),
      ]),
    ]);
  }

  wrap.appendChild(header());
  wrap.appendChild(mainCard());
  return wrap;
}
