export const COPY = {
  home: {
    title: "Reset",
    subtitle: "Tap one. Praxis will guide the next step.",
    actions: [
      // Interrupt / Stabilize (always first)
      { title: "Calm Me Down", sub: "Lower intensity", hint: "Do nothing else for 2 minutes.", zone: "yellow", to: "#/yellow/calm" },
      { title: "Stop the Urge", sub: "Pause before acting", hint: "You don’t need to decide anything yet.", zone: "yellow", to: "#/yellow/nocontact" },
      { title: "Emergency", sub: "Immediate support", hint: "Interrupt before harm. Reach support now.", zone: "red", to: "#/red/emergency" },

      // Re-Enter / Act
      { title: "Move Forward", sub: "Body first. Then progress.", hint: "Pick one. Don’t overthink it.", zone: "green", to: "#/green/move" },
      { title: "Choose Today’s Direction", sub: "Pick a lane for today", hint: "You can change this later.", zone: "green", to: "#/green/direction" },
      { title: "Find Your Next Step", sub: "One clear move forward", hint: "Which feels closest right now?", zone: "green", to: "#/green/next" },

      // Optional (kept available but not emphasized)
      { title: "Clarify the Next Move", sub: "One or two sentences", hint: "Skip if it makes things worse.", zone: "green", to: "#/reflect" },
    ]
  }
};
