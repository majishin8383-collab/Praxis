// js/zones/green/direction.js  (FULL REPLACEMENT)

import { appendLog } from "../../storage.js";
import { TEMPLATES as BASE_TEMPLATES } from "../../state/templates.js";

const BUILD = "DIR-6";

const KEY_DIR = "praxis_direction_today_v3";

// ✅ MUST match Today Plan primary key (v5)
const KEY_TODAY = "praxis_today_plan_v5";

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
  try { appendLog(entry); } catch {}
}

// Direction needs a dot color; templates.js intentionally doesn’t own UI styling.
// Map dots here.
function dotForTemplateId(id) {
  if (id === "stability") return "dotYellow";
  return "dotGreen";
}

function saveDirection(planId) {
  try { localStorage.setItem(KEY_DIR, String(planId || "")); } catch {}
  safeAppendLog({ kind: "direction", when: nowISO(), direction: String(planId || ""), build: BUILD });
}

function writeTodayPlanFromTemplate(t) {
  // Overwrite steps + template, reset progress (Direction is the explicit “build it for me” flow)
  const s = { template: t.id, a: t.a, b: t.b, c: t.c, doneStep: 0 };
  try { localStorage.setItem(KEY_TODAY, JSON.stringify(s)); } catch {}
  safeAppendLog({
    kind: "direction_seed_today_plan",
    when: nowISO(),
    build: BUILD,
    template: t.id
  });
}

// Enrich base templates with Direction copy (title/sub) while reusing step text.
// If title/sub are missing, fall back to label.
const TEMPLATES = BASE_TEMPLATES.map(t => ({
  ...t,
  title: t.title || t.label,
  sub: t.sub || "",
  dot: dotForTemplateId(t.id),
}));

export function renderDirection() {
  const wrap = el("div", { class: "flowShell" });

  safeAppendLog({ kind: "direction_open", when: nowISO(), build: BUILD });

  function header() {
    return el("div
