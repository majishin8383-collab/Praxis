const BUILD = "OB-2";
const KEY_DONE = "praxis_onboarding_done";

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

function markDone() {
  try {
    localStorage.setItem(KEY_DONE, "1");
  } catch {
    // ignore (private mode / storage blocked)
  }
}

export function renderOnboarding() {
  const wrap = el("div", { class: "flowShell" });

  const steps = [
    {
      title: "Praxis is tap-first",
      body: "You shouldn’t have to think to start. Tap a tile. Do the next right action.",
      cta: { label: "Go to Reset", to: "#/home" }
    },
    {
      title: "Use timers to break spirals",
      body: "Calm and Stop the Urge create delay. Delay is the superpower.",
      cta: { label: "Try Calm (2 min)", to: "#/yellow/calm" }
    },
    {
      title: "Lock a move, then do it",
      body: "Clarify is not journaling. It’s choosing one move and executing it.",
      cta: { label: "Try Clarify", to: "#/reflect" }
    }
  ];

  let i = 0;

  function header() {
    return el("div", { class: "flowHeader" }, [
      el("div", {}, [
        el("h1", { class: "h1" }, ["How Praxis Works"]),
        el("p", { class: "p" }, ["20 seconds. Then action."]),
        el("div", { class: "small" }, [`Build ${BUILD}`]),
      ]),
      el("div", { class: "flowMeta" }, [
        el("button", { class: "linkBtn", type: "button", onClick: () => (location.hash = "#/home") }, ["Reset"]),
      ])
    ]);
  }

  function card() {
    const s = steps[i];
    const isLast = i === steps.length - 1;

    return el("div", { class: "card cardPad" }, [
      el("div", { class: "badge" }, [`Step ${i + 1} of ${steps.length}`]),
      el("h2", { class: "h2" }, [s.title]),
      el("p", { class: "p" }, [s.body]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn btnPrimary",
          type: "button",
          onClick: () => (location.hash = s.cta.to)
        }, [s.cta.label]),
      ]),
      el("div", { class: "btnRow" }, [
        el("button", {
          class: "btn",
          type: "button",
          onClick: () => { i = Math.max(0, i - 1); rerender(); }
        }, ["Back"]),
        el("button", {
          class: isLast ? "btn btnPrimary" : "btn",
          type: "button",
          onClick: () => {
            if (isLast) {
              markDone();
              location.hash = "#/home";
              return;
            }
            i = Math.min(steps.length - 1, i + 1);
            rerender();
          }
        }, [isLast ? "Finish" : "Next"]),
      ]),
      isLast
        ? el("p", { class: "small", style: "margin-top:10px" }, [
            "Finish will save this as completed. You can replay anytime."
          ])
        : null
    ].filter(Boolean));
  }

  function rerender() {
    wrap.innerHTML = "";
    wrap.appendChild(header());
    wrap.appendChild(card());
  }

  rerender();
  return wrap;
}
