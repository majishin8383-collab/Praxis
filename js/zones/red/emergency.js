import { appendLog, readLog } from "../../storage.js";
import { formatMMSS, clamp } from "../../components/timer.js";

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

function nowISO() {
  return new Date().toISOString();
}

export function renderEmergency() {
  const wrap = el("div", { class: "flowShell" });

  let mode = "start"; // start | pause | actions | logged
  let running = false;
  let durationSec = 60;
  let endAt = 0;
  let tick = null;

  function stopTick() {
    if (tick) window.clearInterval(tick);
    tick = null;
  }

  function updateTimerUI() {
    const remaining = clamp(endAt - Date.now(), 0, durationSec * 1000);
    const pct = 100 * (1 - remaining / (durationSec * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function startPause() {
    mode = "pause";
    running = true;
    endAt = Date.now() + durationSec * 1000;

    stopTick();
    tick = window.setInterval(() => {
      if (!running) return;
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        stopTick();
        running = false;
        mode = "actions";
        rerender();
      } else {
        updateTimerUI();
      }
    }, 200);

    rerender();
  }

  function log(actionTaken) {
    appendLog({
      kind: "emergency",
      when: nowISO(),
      action: actionTaken,
      note: "Used Red Zone interruption flow."
    });
  }

  function recentLogs() {
    const log = readLog().filter(e => e.kind === "emergency").slice(0, 6);

    if (!log.length) {
      return el("div", {}, [
        el("h2", { class: "h2" }, ["Recent emergency uses"]),
        el("p", { class: "p" }, ["No entries yet. Using Red Zone will automatically save a timestamp."]),
      ]);
    }

    return el("div", {}, [
      el("h2", { class: "h2" }, ["Recent emergency uses"]),
      ...log.map(e =>
        el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
          el("div", { style: "font-weight:900;" }, ["Emergency"]),
          el("div", { class: "small" }, [`${new Date(e.when).toLocaleString()} • ${e.action || "used"}`]),
        ])
      )
    ]);
  }

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Emergency"]),
        el("p", { class: "p" }, ["This is for moments when you feel out of control or might hurt yourself or someone else."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Back"]),
      ])
    ]);
  }

  function dangerCard() {
    return el("div", { class: "card cardPad redzone" }, [
      el("div", { class: "badge" }, ["If you or someone else is in immediate danger"]),
      el("div", { class: "btnRow" }, [
        el("a", {
          class: "btn btnDanger",
          href: "tel:911",
          onClick: () => { log("called 911"); }
        }, ["Call 911 now"]),
      ]),
      el("p", { class: "small" }, ["If it’s not immediate danger, use 988 support options below."]),
    ]);
  }

  function startCard() {
    return el("div", { class: "card cardPad redzone" }, [
      el("h2", { class: "h2 redTitle" }, ["Red Zone: Interruption"]),
      el("p", { class: "p" }, [
        "Step 1 is a 60-second pause to interrupt the impulse. During the pause: breathe out longer than you breathe in."
      ]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnDanger", type: "button", onClick: startPause }, ["Start 60-second pause"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { mode = "actions"; rerender(); }
        }, ["Skip to actions"]),
      ]),
      el("p", { class: "small" }, ["No journaling. No analysis. Just reduce harm and get support."]),
    ]);
  }

  function pauseCard() {
    const remaining = clamp(endAt - Date.now(), 0, durationSec * 1000);

    return el("div", { class: "card cardPad redzone" }, [
      el("div", { class: "badge" }, ["Pause active"]),
      el("div", { class: "timerReadout", "data-timer-readout": "1" }, [formatMMSS(remaining)]),
      el("div", { class: "progressBar" }, [
        el("div", { class: "progressFill", "data-progress-fill": "1" }, []),
      ]),
      el("p", { class: "p" }, ["Breathe out slowly. Unclench jaw. Drop shoulders."]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { running = false; stopTick(); mode = "actions"; rerender(); }
        }, ["Go to actions now"]),
      ]),
      el("p", { class: "small" }, ["If there are weapons nearby or you’re around others, create distance first."]),
    ]);
  }

  function actionsCard() {
    return el("div", { class: "card cardPad redzone" }, [
      el("h2", { class: "h2 redTitle" }, ["Actions (pick one now)"]),
      el("p", { class: "p" }, [
        "Choose the smallest action that reduces risk. If you might act on harming yourself or someone else, choose a live human immediately."
      ]),

      el("div", { class: "btnRow" }, [
        el("a", {
          class: "btn btnDanger",
          href: "tel:988",
          onClick: () => { log("called 988"); mode = "logged"; rerender(); }
        }, ["Call 988"]),
        el("a", {
          class: "btn btnDanger",
          href: "sms:988",
          onClick: () => { log("texted 988"); mode = "logged"; rerender(); }
        }, ["Text 988"]),
        el("a", {
          class: "btn",
          href: "https://988lifeline.org/",
          target: "_blank",
          rel: "noopener",
          onClick: () => { log("opened 988 chat/site"); mode = "logged"; rerender(); }
        }, ["Open 988 chat/site"]),
      ]),

      el("div", { class: "hr" }, []),

      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: () => {
            const msg = "I’m not okay. Can you stay with me or call me right now?";
            if (navigator.clipboard?.writeText) navigator.clipboard.writeText(msg).catch(() => {});
            window.prompt("Copy & send this message:", msg);
            log("messaged a trusted person");
            mode = "logged";
            rerender();
          }
        }, ["Message a trusted person"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => {
            log("moved to safer place");
            mode = "logged";
            rerender();
            alert("Move to a safer place: a public room, outside, or near other people. Distance from weapons/means.");
          }
        }, ["Move to a safer place"]),
      ]),

      el("p", { class: "small" }, [
        "If you’re in immediate danger or may harm someone right now, call 911."
      ]),
    ]);
  }

  function loggedCard() {
    return el("div", { class: "card cardPad redzone" }, [
      el("div", { class: "badge" }, ["Saved"]),
      el("p", { class: "p" }, ["Good. Stay with support. If risk spikes, call 911."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/home") }, ["Back to Home"]),
        el("button", { class: "btn", type: "button", onClick: () => { mode = "actions"; rerender(); } }, ["Back to actions"]),
      ]),
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(dangerCard());

    if (mode === "start") wrap.appendChild(startCard());
    if (mode === "pause") wrap.appendChild(pauseCard());
    if (mode === "actions") wrap.appendChild(actionsCard());
    if (mode === "logged") wrap.appendChild(loggedCard());

    wrap.appendChild(el("div", { class: "card cardPad" }, [recentLogs()]));

    if (running) updateTimerUI();
  }

  rerender();
  return wrap;
}
