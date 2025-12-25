import { appendLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

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

export function renderMoveForward() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
  let durationMin = 2;
  let endAt = 0;
  let tick = null;

  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function start(min, label) {
    running = true;
    durationMin = min;
    endAt = Date.now() + min * 60 * 1000;

    appendLog({ kind: "move_forward", when: nowISO(), action: "started", minutes: min, label });

    stopTick();
    tick = setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        appendLog({ kind: "move_forward", when: nowISO(), action: "completed", minutes: min, label });
        rerender("done");
      } else updateTimerUI();
    }, 250);

    rerender("running");
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Move Forward"]),
        el("p", { class: "p" }, ["Body first. Then progress."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function chooser() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["Pick one. Don’t overthink it."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => start(2, "Reset your body") }, ["Reset Your Body (2 min)"]),
        el("button", { class: "btn", type: "button", onClick: () => start(5, "Light movement") }, ["Light Movement (5 min)"]),
        el("button", { class: "btn", type: "button", onClick: () => start(10, "One useful thing") }, ["One Useful Thing (10 min)"]),
        el("button", { class: "btn", type: "button", onClick: () => start(25, "Focused work") }, ["Focused Work (25 min)"]),
      ]),
      el("p", { class: "small" }, ["Stop when time ends. That’s the point."]),
    ]);
  }

  function runningPanel() {
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div", { class: "timerBox" }, [
      el("div", { class: "badge" }, [`Move Forward • ${durationMin} min`]),
      el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
      el("div", { class: "progressBar" }, [ el("div", { class: "progressFill", "data-progress-fill": "1" }, []) ]),
      el("p", { class: "small" }, ["Stay with it. You can stop when time ends."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn", type: "button", onClick: () => { running = false; stopTick(); rerender("idle"); } }, ["Stop"]),
      ]),
    ]);
  }

  function donePanel() {
    return el("div", { class: "flowShell" }, [
      el("div", { class: "badge" }, ["That counts."]),
      el("p", { class: "p" }, ["Want to reset, or keep moving?"]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
        el("button", { class: "btn", type: "button", onClick: () => rerender("idle") }, ["Keep moving"]),
      ]),
    ]);
  }

  function rerender(mode) {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(el("div", { class: "card cardPad" }, [
      mode === "running" ? runningPanel()
      : mode === "done" ? donePanel()
      : chooser()
    ]));
    if (running) updateTimerUI();
  }

  rerender("idle");
  return wrap;
}
