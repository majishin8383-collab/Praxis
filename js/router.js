// js/router.js
import { setMain, renderHome } from "./ui.js";

import { renderCalm } from "./zones/yellow/calm.js";
import { renderStopUrge } from "./zones/yellow/stopUrge.js";
import { renderEmergency } from "./zones/red/emergency.js";

import { renderMoveForward } from "./zones/green/moveForward.js";
import { renderDirection } from "./zones/green/direction.js";
import { renderNextStep } from "./zones/green/nextStep.js";
import { renderTodayPlan } from "./zones/green/todayPlan.js";

import { renderReflect } from "./zones/reflect.js";
import { renderHistory } from "./history.js";
import { renderOnboarding } from "./onboarding.js";

const routes = {
  "#/home": renderHome,

  "#/yellow/calm": renderCalm,
  "#/yellow/stop": renderStopUrge,
  "#/red/emergency": renderEmergency,

  "#/green/move": renderMoveForward,
  "#/green/direction": renderDirection,
  "#/green/next": renderNextStep,
  "#/green/today": renderTodayPlan,

  "#/reflect": renderReflect,
  "#/history": renderHistory,
  "#/onboarding": renderOnboarding,
};

function renderRoute() {
  const hash = location.hash || "#/home";
  const viewFn = routes[hash] || renderHome;

  try {
    const view = viewFn();
    setMain(view);
  } catch (err) {
    console.error("Router render failed:", err);
    setMain(renderHome()); // 🔒 hard fallback
  }

  window.scrollTo(0, 0);
}

export function initRouter() {
  const homeBtn = document.getElementById("navHome");
  homeBtn?.addEventListener("click", () => {
    location.hash = "#/home";
  });

  if (!location.hash) location.hash = "#/home";

  window.addEventListener("hashchange", renderRoute);
  renderRoute(); // 🔴 THIS WAS THE FAILURE POINT BEFORE
}
