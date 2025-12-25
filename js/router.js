import { setMain, renderHome } from "./ui.js";

import { renderCalm } from "./zones/yellow/calm.js";
import { renderStopUrge } from "./zones/yellow/stopUrge.js";
import { renderEmergency } from "./zones/red/emergency.js";

import { renderMoveForward } from "./zones/green/moveForward.js";
import { renderDirection } from "./zones/green/direction.js";
import { renderNextStep } from "./zones/green/nextStep.js";

import { renderFocusSprint } from "./zones/green/focusSprint.js";
import { renderTodayPlan } from "./zones/green/todayPlan.js";

import { renderReflect } from "./zones/reflect.js";

import { renderHistory } from "./history.js";
import { renderOnboarding } from "./onboarding.js"; // ✅ NEW

const routes = new Map([
  ["#/home", () => renderHome()],

  ["#/yellow/calm", () => renderCalm()],
  ["#/yellow/stop", () => renderStopUrge()],
  ["#/red/emergency", () => renderEmergency()],

  ["#/green/move", () => renderMoveForward()],
  ["#/green/direction", () => renderDirection()],
  ["#/green/next", () => renderNextStep()],

  // kept as working tools / internals
  ["#/green/focus", () => renderFocusSprint()],
  ["#/green/today", () => renderTodayPlan()],
  ["#/reflect", () => renderReflect()],

  ["#/history", () => renderHistory()],
  ["#/onboarding", () => renderOnboarding()], // ✅ NEW
]);

function getRoute() {
  const hash = location.hash || "#/home";
  return routes.get(hash) || routes.get("#/home");
}

function onRouteChange() {
  const view = getRoute()();
  setMain(view);
  window.scrollTo(0, 0);
}

export function initRouter() {
  const homeBtn = document.getElementById("navHome");
  homeBtn?.addEventListener("click", () => (location.hash = "#/home"));

  if (!location.hash) location.hash = "#/home";

  window.addEventListener("hashchange", onRouteChange);
  onRouteChange();
}
