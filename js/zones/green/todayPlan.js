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

const KEY = "praxis_today_plan_v2";

function readPlan(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return { a:"", b:"", c:"", template:"" };
    const p = JSON.parse(raw);
    return { a: p.a||"", b: p.b||"", c: p.c||"", template: p.template||"" };
  }catch{
    return { a:"", b:"", c:"", template:"" };
  }
}
function savePlan(p){
  try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch{}
}

const TEMPLATES = [
  {
    id: "stability",
    label: "Stability",
    a: "2-min Calm",
    b: "5-min walk / movement",
    c: "One small maintenance task"
  },
  {
    id: "maintenance",
    label: "Maintenance",
    a: "Clean one area (10 min)",
    b: "Reply to one important thing",
    c: "Prep tomorrow (5 min)"
  },
  {
    id: "progress",
    label: "Progress",
    a: "Start the hard task (25 min)",
    b: "Continue or finish (10–25 min)",
    c: "Quick wrap-up / tidy (5 min)"
  },
  {
    id: "recovery",
    label: "Recovery",
    a: "Eat / hydrate",
    b: "Shower or reset body",
    c: "Early night / low stimulation"
  }
];

export function renderTodayPlan(){
  const wrap = document.createElement("div");
  wrap.className = "flowShell";

  let plan = readPlan();

  function header(){
    return el("div",{class:"flowHeader"},[
      el("div",{},[
        el("h1",{class:"h1"},["Today’s Plan (3 Steps)"]),
        el("p",{class:"p"},["Pick a template or write your own. Keep it small."]),
      ]),
      // Reset button hidden by CSS; safe to keep
      el("div",{class:"flowMeta"},[
        el("button",{class:"linkBtn",type:"button",onClick:()=>location.hash="#/home"},["Reset"]),
      ])
    ]);
  }

  function inputRow(label, key){
    return el("div",{class:"flowShell"},[
      el("div",{class:"small"},[label]),
      el("input",{
        value: plan[key],
        placeholder: "Small + concrete…",
        style:"width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);",
        onInput:(e)=>{ plan[key]=e.target.value; savePlan(plan); }
      },[])
    ]);
  }

  function applyTemplate(t){
    plan = { ...plan, template: t.id, a: t.a, b: t.b, c: t.c };
    savePlan(plan);
    rerender("edit");
  }

  function save(){
    appendLog({ kind:"today_plan", when: nowISO(), template: plan.template || "custom", steps: { a:plan.a, b:plan.b, c:plan.c } });
    rerender("saved");
  }

  function clear(){
    plan = { a:"", b:"", c:"", template:"" };
    savePlan(plan);
    rerender("edit");
  }

  function templatesPanel(){
    return el("div",{class:"card cardPad"},[
      el("div",{class:"badge"},["Templates (tap to fill)"]),
      el("p",{class:"small"},["You can edit after applying."]),
      el("div",{class:"btnRow"}, TEMPLATES.map(t =>
        el("button",{class:"btn",type:"button",onClick:()=>applyTemplate(t)},[t.label])
      )),
      plan.template
        ? el("p",{class:"small",style:"margin-top:8px"},[`Selected: ${plan.template}`])
        : el("p",{class:"small",style:"margin-top:8px"},["Selected: none (custom)"]),
    ]);
  }

  function editor(){
    return el("div",{class:"card cardPad"},[
      el("div",{class:"badge"},["Three steps. Nothing else."]),
      inputRow("Step 1", "a"),
      inputRow("Step 2", "b"),
      inputRow("Step 3", "c"),
      el("div",{class:"btnRow"},[
        el("button",{class:"btn btnPrimary",type:"button",onClick:save},["Save"]),
        el("button",{class:"btn",type:"button",onClick:clear},["Clear"]),
      ]),
      el("p",{class:"small"},["Rule: if it doesn’t fit in 3 steps, it’s not for today."]),
    ]);
  }

  function saved(){
    return el("div",{class:"card cardPad"},[
      el("div",{class:"badge"},["Saved."]),
      el("p",{class:"p"},["Now do Step 1. Not all three."]),
      el("div",{class:"btnRow"},[
        el("button",{class:"btn btnPrimary",type:"button",onClick:()=>location.hash="#/green/move"},["Move Forward"]),
        el("button",{class:"btn",type:"button",onClick:()=>location.hash="#/home"},["Reset"]),
      ]),
      el("p",{class:"small",style:"margin-top:8px"},["If you resist Step 1: run Calm or Stop the Urge first."]),
    ]);
  }

  function rerender(mode){
    wrap.innerHTML="";
    wrap.appendChild(header());
    wrap.appendChild(templatesPanel());
    wrap.appendChild(mode==="saved" ? saved() : editor());
  }

  rerender("edit");
  return wrap;
}
