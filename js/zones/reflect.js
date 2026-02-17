/*!
 * Praxis
 * © 2025 Joseph Satmary. All rights reserved.
 * Public demo does not grant a license to use, copy, modify, or distribute.
 */

// js/zones/reflect.js (FULL REPLACEMENT)
import { appendLog, readLog, isPro, setNextIntent } from "../storage.js";

const BUILD = "RF-19"; // governance locked: tap-only, low demand, hard closure

// DEV: keep More clarity visible during development.
// PRE-SHIP: set to false to gate behind isPro().
const DEV_UNLOCK_MORE_CLARITY = true;

// One-time handoff intent to the dedicated More Clarity screen
const INTENT_REFLECT_MORE_CLARITY = "reflect_more_clarity_v1";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node
