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

const KEY = "praxis_today_plan_v1";

function readPlan(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return { a:"", b:"", c:"" };
    const p = JSON.parse(raw);
    return { a: p.a||"", b: p.b||"", c: p.c||"" };
  }catch{
    return { a:"", b:"", c:"" };
  }
}
function savePlan(p){
  try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch{}
}

export function renderTodayPlan(){
  const wrap = el("div",{class:"flowShell"});
  let plan = readPlan();

  function header(){
    return el("div",{class:"flowHeader"},[
      el("div",{},[
        el("h1",{class:"h1"},["Today’s Plan (3 Steps)"]),
        el("p",{class:"p"},["Only the next three moves. If it’s not here, it’s not for today."]),
      ]),
      el("div",{class:"flowMeta"},[
        el("button",{class:"linkBtn",type:"button",onClick:()=>location.hash="#/home"},["Reset"]),
      ])
    ]);
  }

  function row(label, key){
    return el("div",{class:"flowShell"},[
      el("div",{class:"small"},[label]),
      el("input",{
        value: plan[key],
        placeholder: "Keep it small and concrete…",
        style:"width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);",
        onInput:(e)=>{ plan[key]=e.target.value; savePlan(plan); }
      },[])
    ]);
  }

  function save(){
    appendLog({ kind:"today_plan", when: nowISO(), steps: { ...plan } });
    rerender("saved");
  }

  function clear(){
    plan = { a:"", b:"", c:"" };
    savePlan(plan);
    rerender("edit");
  }

  function editor(){
    return el("div",{class:"card cardPad"},[
      el("div",{class:"badge"},["Three steps. Nothing else."]),
      row("Step 1", "a"),
      row("Step 2", "b"),
      row("Step 3", "c"),
      el("div",{class:"btnRow"},[
        el("button",{class:"btn btnPrimary",type:"button",onClick:save},["Save"]),
        el("button",{class:"btn",type:"button",onClick:clear},["Clear"]),
      ]),
      el("p",{class:"small"},["When done: move forward, or reset."]),
    ]);
  }

  function saved(){
    return el("div",{class:"card cardPad"},[
      el("div",{class:"badge"},["Saved."]),
      el("p",{class:"p"},["Good. Keep it simple."]),
      el("div",{class:"btnRow"},[
        el("button",{class:"btn btnPrimary",type:"button",onClick:()=>location.hash="#/green/move"},["Move Forward"]),
        el("button",{class:"btn",type:"button",onClick:()=>location.hash="#/home"},["Reset"]),
      ]),
    ]);
  }

  function rerender(mode){
    wrap.innerHTML="";
    wrap.appendChild(header());
    wrap.appendChild(mode==="saved" ? saved() : editor());
  }

  rerender("edit");
  return wrap;
}
