import { setMain, renderHome } from "./ui.js";

// Existing working flows
import { renderFocusSprint } from "./zones/green/focusSprint.js";
import { renderTodayPlan } from "./zones/green/todayPlan.js";
import { renderCalm } from "./zones/yellow/calm.js";
import { renderNoContact } from "./zones/yellow/noContactShield.js";
import { renderEmergency } from "./zones/red/emergency.js";
import { renderReflect } from "./zones/reflect.js";

// TEMP BRIDGES (so the new Home tiles work immediately)
// We'll replace these with real screens in the next steps.
function renderMoveForwardBridge() {
  // For now, route "Move Forward" to Focus Sprint (your existing action engine).
  return renderFocusSprint();
}

function renderDirectionBridge() {
  // For now, route "Choose Today’s Direction" to Today’s Plan (existing structure screen).
  return renderTodayPlan();
}

function renderNextStepBridge() {
  // For now, route "Find Your Next Step" to Reset (Home) until we build the decision tool.
  return renderHome();
}

const routes = new Map([
  ["#/home", () => renderHome()],

  // Existing routes
  ["#/green/focus", () => renderFocusSprint()],
  ["#/green/today", () => renderTodayPlan()],
  ["#/yellow/calm", () => renderCalm()],
  ["#/yellow/nocontact", () => renderNoContact()],
  ["#/red/emergency", () => renderEmergency()],
  ["#/reflect", () => renderReflect()],

  // New UX routes (now wired)
  ["#/green/move", () => renderMoveForwardBridge()],
  ["#/green/direction", () => renderDirectionBridge()],
  ["#/green/next", () => renderNextStepBridge()],
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
