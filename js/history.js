import { readLog } from "./storage.js";

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

function niceKind(kind) {
  const map = {
    calm: "Calm Me Down",
    stop_urge: "Stop the Urge",
    move_forward: "Move Forward",
    focus: "Focus Sprint",
    today_plan: "Today’s Plan",
    direction: "Today’s Direction",
    clarify: "Clarify the Next Move",
  };
  return map[kind] || kind || "Session";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysAgoMs(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function formatDay(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "Unknown date";
  }
}

export function renderHistory() {
  const wrap = el("div", { class: "flowShell" });

  const state = {
    filter: "today", // "today" | "7d" | "all"
  };

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["History"]),
        el("p", { class: "p" }, ["Recent actions. Proof of movement."]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function filterBar() {
    const btn = (id, label) =>
      el("button", {
        class: id === state.filter ? "btn btnPrimary" : "btn",
        type: "button",
        onClick: () => { state.filter = id; rerender(); }
      }, [label]);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["View"]),
      el("div", { class: "btnRow" }, [
        btn("today", "Today"),
        btn("7d", "7 Days"),
        btn("all", "All"),
      ]),
      el("p", { class: "small", style: "margin-top:8px" }, ["Tip: If you’re looping, look at what worked last time."])
    ]);
  }

  function filteredItems() {
    const all = readLog(); // assumed newest-first in this project
    const limit = 120;
    const items = all.slice(0, limit);

    const cutoff =
      state.filter === "today" ? startOfToday()
      : state.filter === "7d" ? daysAgoMs(7)
      : 0;

    if (state.filter === "all") return items;

    return items.filter(e => {
      const t = e.when ? new Date(e.when).getTime() : 0;
      return t >= cutoff;
    });
  }

  function summaryCard(items) {
    if (!items.length) {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["Summary"]),
        el("p", { class: "p" }, ["No entries in this range yet."]),
        el("div", { class: "btnRow" }, [
          el("button", { class: "btn btnPrimary", type: "button", onClick: () => (location.hash = "#/yellow/calm") }, ["Start Calm"]),
          el("button", { class: "btn", type: "button", onClick: () => (location.hash = "#/green/move") }, ["Move Forward"]),
        ])
      ]);
    }

    const counts = items.reduce((acc, e) => {
      const k = e.kind || "other";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Summary"]),
      el("p", { class: "p" }, [`Entries: ${items.length}`]),
      el("p", { class: "small" }, ["Top tools used:"]),
      ...top.map(([k, n]) =>
        el("div", { class: "small", style: "margin-top:6px" }, [`• ${niceKind(k)} — ${n}`])
      ),
    ]);
  }

  function entryRow(e) {
    const title = niceKind(e.kind);
    const when = e.when ? new Date(e.when).toLocaleString() : "";
    const mins = e.minutes != null ? ` • ${e.minutes} min` : "";

    let detail = "";
    if (e.kind === "stop_urge" && e.outcome) detail = ` • ${e.outcome === "passed" ? "Urge passed" : "Still present"}`;
    if (e.kind === "move_forward" && e.label) detail = ` • ${e.label}`;
    if (e.kind === "direction" && e.direction) detail = ` • ${e.direction}`;
    if (e.kind === "today_plan" && e.template) detail = ` • ${e.template}`;
    if (e.kind === "clarify" && e.statement) detail = ` • ${e.statement}`;

    return el("div", { style: "padding:10px 0;border-bottom:1px solid var(--line);" }, [
      el("div", { style: "font-weight:900;" }, [title]),
      el("div", { class: "small" }, [(when + mins + detail).trim()]),
    ]);
  }

  function listCard(items) {
    if (!items.length) {
      return el("div", { class: "card cardPad" }, [
        el("div", { class: "badge" }, ["No entries here"]),
        el("p", { class: "p" }, ["Use any tool once and it will appear."]),
      ]);
    }

    // group by day label
    const groups = [];
    let current = null;

    for (const e of items) {
      const day = e.when ? formatDay(e.when) : "Unknown date";
      if (day !== current) {
        current = day;
        groups.push({ day, entries: [] });
      }
      groups[groups.length - 1].entries.push(e);
    }

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, ["Entries"]),
      ...groups.flatMap(g => ([
        el("div", { class: "h2", style: "margin-top:12px" }, [g.day]),
        ...g.entries.map(entryRow)
      ]))
    ]);
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());

    const items = filteredItems();

    wrap.appendChild(filterBar());
    wrap.appendChild(summaryCard(items));
    wrap.appendChild(listCard(items));
  }

  rerender();
  return wrap;
}
