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

const routes = new Map([
  ["#/home", renderHome],

  ["#/yellow/calm", renderCalm],
  ["#/yellow/stop", renderStopUrge],
  ["#/red/emergency", renderEmergency],

  ["#/green/move", renderMoveForward],
  ["#/green/direction", renderDirection],
  ["#/green/next", renderNextStep],
  ["#/green/today", renderTodayPlan],

  ["#/reflect", renderReflect],
  ["#/history", renderHistory],
  ["#/onboarding", renderOnboarding],
]);

function getView() {
  const hash = location.hash || "#/home";
  return routes.get(hash) || renderHome;
}

function renderRoute() {
  const view = getView()();
  setMain(view);
  window.scrollTo(0, 0);
}

export function initRouter() {
  const homeBtn = document.getElementById("navHome");
  homeBtn?.addEventListener("click", () => {
    location.hash = "#/home";
  });

  if (!location.hash) location.hash = "#/home";

  window.addEventListener("hashchange", renderRoute);
  renderRoute(); // 🔴 REQUIRED
}
