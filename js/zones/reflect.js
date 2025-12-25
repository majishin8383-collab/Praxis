import { appendLog } from "../storage.js";

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
const KEY = "praxis_reflect_draft";

export function renderReflect() {
  const wrap = el("div", { class: "flowShell" });

  let text = "";
  try { text = localStorage.getItem(KEY) || ""; } catch {}

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["Clarify the Next Move"]),
        el("p", { class: "p" }, ["One or two sentences. Then stop."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function saveDraft(val) {
    text = val;
    try { localStorage.setItem(KEY, text); } catch {}
  }

  function saveEntry() {
    const cleaned = (text || "").trim();
    if (!cleaned) {
      alert("Write one sentence (or skip).");
      return;
    }

    appendLog({ kind: "clarify", when: nowISO(), text: cleaned.slice(0, 400) });

    text = "";
    try { localStorage.removeItem(KEY); } catch {}

    rerender("saved");
  }

  function editor() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Skip this if it makes things worse."]),
      el("p", { class: "p" }, ["What is the next right action?"]),
      el("textarea", {
        style: "width:100%;min-height:120px;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);",
        placeholder: "Example: Do a 10-minute window, then stop.",
        onInput: (e) => saveDraft(e.target.value)
      }, []),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: saveEntry }, ["Save & continue"]),
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { text = ""; try { localStorage.removeItem(KEY); } catch {} ; rerender("edit"); }
        }, ["Clear"]),
      ]),
    ]);
  }

  function saved() {
    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Saved. That’s enough."]),
      el("div", { class: "btnRow" }, [
        el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
        el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ]),
    ]);
  }

  function rerender(mode = "edit") {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(mode === "saved" ? saved() : editor());

    setTimeout(() => {
      const ta = wrap.querySelector("textarea");
      if (ta) ta.value = text;
    }, 0);
  }

  rerender("edit");
  return wrap;
}
