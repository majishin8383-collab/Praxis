// js/state/templates.js  (NEW FILE)

export const TEMPLATES = [
  {
    id: "stability",
    label: "Stability",
    title: "Stability Day",
    sub: "Lower intensity and stay steady",
    a: "2-min Calm",
    b: "5-min walk / movement",
    c: "One small maintenance task",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    title: "Maintenance Day",
    sub: "Keep life from sliding backward",
    a: "Clean one area (10 min)",
    b: "Reply to one important thing",
    c: "Prep tomorrow (5 min)",
  },
  {
    id: "progress",
    label: "Progress",
    title: "Progress Day",
    sub: "Do one meaningful thing",
    a: "Start the hard task (25 min)",
    b: "Continue or finish (10–25 min)",
    c: "Quick wrap-up / tidy (5 min)",
  },
  {
    id: "recovery",
    label: "Recovery",
    title: "Recovery Day",
    sub: "Heal + protect the future you",
    a: "Eat / hydrate",
    b: "Shower or reset body",
    c: "Early night / low stimulation",
  },
];

export function getTemplateById(id, fallbackId = "progress") {
  const found = TEMPLATES.find((t) => t.id === id);
  if (found) return found;
  return TEMPLATES.find((t) => t.id === fallbackId) || TEMPLATES[0];
}

export function pickDefaultTemplateId({ stabilizedToday } = {}) {
  // Default is always template-based:
  // - If stabilized today, bias Stability
  // - Otherwise Progress (prevents drift)
  return stabilizedToday ? "stability" : "progress";
}
