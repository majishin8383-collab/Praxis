import { appendLog, readLog } from "../../storage.js";
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

export function renderFocusSprint() {
  const wrap = el("div", { class: "flowShell" });

  let running = false;
  let durationMin = 10;
  let endAt = 0;
  let tick = null;

  function stopTick(){ if(tick) clearInterval(tick); tick=null; }

  function updateTimerUI(){
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    const pct = 100 * (1 - remaining / (durationMin * 60 * 1000));
    const readout = wrap.querySelector("[data-timer-readout]");
    const fill = wrap.querySelector("[data-progress-fill]");
    if (readout) readout.textContent = formatMMSS(remaining);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function start(min){
    running = true;
    durationMin = min;
    endAt = Date.now() + min * 60 * 1000;

    appendLog({ kind:"focus", when: nowISO(), action:"started", minutes:min });

    stopTick();
    tick = setInterval(() => {
      if(!running) return;
      const remaining = endAt - Date.now();
      if(remaining <= 0){
        stopTick();
        running = false;
        appendLog({ kind:"focus", when: nowISO(), action:"completed", minutes:min });
        rerender("done");
      } else updateTimerUI();
    }, 250);

    rerender("running");
  }

  function recent(){
    const log = readLog().filter(e => e.kind === "focus").slice(0,6);
    if(!log.length) return el("div",{},[
      el("h2",{class:"h2"},["Recent focus"]),
      el("p",{class:"p"},["No entries yet."]),
    ]);
    return el("div",{},[
      el("h2",{class:"h2"},["Recent focus"]),
      ...log.map(e => el("div",{style:"padding:10px 0;border-bottom:1px solid var(--line);"},[
        el("div",{style:"font-weight:900;"},["Focus Sprint"]),
        el("div",{class:"small"},[`${new Date(e.when).toLocaleString()} • ${e.minutes} min • ${e.action}`]),
      ]))
    ]);
  }

  function header(){
    return el("div",{class:"flowHeader"},[
      el("div",{},[
        el("h1",{class:"h1"},["Focus Sprint"]),
        el("p",{class:"p"},["A short window for one task. Stop when time ends."]),
      ]),
      el("div",{class:"flowMeta"},[
        el("button",{class:"linkBtn",type:"button",onClick:()=>location.hash="#/home"},["Reset"]),
      ])
    ]);
  }

  function chooser(){
    return el("div",{class:"flowShell"},[
      el("div",{class:"badge"},["Pick one. No optimizing."]),
      el("div",{class:"btnRow"},[
        el("button",{class:"btn btnPrimary",type:"button",onClick:()=>start(10)},["10 minutes"]),
        el("button",{class:"btn",type:"button",onClick:()=>start(25)},["25 minutes"]),
      ]),
      el("p",{class:"small"},["One task only. If it isn’t done, you stop anyway."]),
    ]);
  }

  function runningPanel(){
    const remaining = clamp(endAt - Date.now(), 0, durationMin * 60 * 1000);
    return el("div",{class:"timerBox"},[
      el("div",{class:"badge"},[`Focus • ${durationMin} min`]),
      el("div",{class:"timerReadout","data-timer-readout":"1"},[formatMMSS(remaining)]),
      el("div",{class:"progressBar"},[el("div",{class:"progressFill","data-progress-fill":"1"},[])]),
      el("div",{class:"btnRow"},[
        el("button",{class:"btn",type:"button",onClick:()=>{running=false; stopTick(); rerender("idle");}},["Stop"]),
      ]),
    ]);
  }

  function donePanel(){
    return el("div",{class:"flowShell"},[
      el("div",{class:"badge"},["That counts."]),
      el("div",{class:"btnRow"},[
        el("button",{class:"btn btnPrimary",type:"button",onClick:()=>location.hash="#/green/move"},["Move Forward"]),
        el("button",{class:"btn",type:"button",onClick:()=>location.hash="#/home"},["Reset"]),
      ]),
    ]);
  }

  function rerender(mode){
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(el("div",{class:"card cardPad"},[
      mode==="running" ? runningPanel()
      : mode==="done" ? donePanel()
      : chooser()
    ]));
    wrap.appendChild(el("div",{class:"card cardPad"},[recent()]));
    if(running) updateTimerUI();
  }

  rerender("idle");
  return wrap;
}
