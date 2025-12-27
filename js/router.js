/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

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
import { renderOnboarding } from "./onboarding.js";

import { renderStart } from "./start.js";

const KEY_DONE = "praxis_onboarding_done";

function onboardingDone() {
  try {
    return localStorage.getItem(KEY_DONE) === "1";
  } catch {
    return false;
  }
}

const routes = new Map([
  // Start intake
  ["#/start", () => renderStart()],

  // Reset hub (tile grid)
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
  ["#/onboarding", () => renderOnboarding()],
]);

function getRoute() {
  const hash = location.hash || "";
  if (!hash) return routes.get(onboardingDone() ? "#/home" : "#/start");
  return routes.get(hash) || routes.get("#/home");
}

function onRouteChange() {
  const routeFn = getRoute();
  const view = routeFn ? routeFn() : document.createElement("div");
  setMain(view);
  window.scrollTo(0, 0);
}

export function initRouter() {
  // Top nav "Home" button always goes to hub
  const homeBtn = document.getElementById("navHome");
  homeBtn?.addEventListener("click", () => (location.hash = "#/home"));

  // Default landing
  if (!location.hash) {
    location.hash = onboardingDone() ? "#/home" : "#/start";
  }

  window.addEventListener("hashchange", onRouteChange);
  onRouteChange();
}
