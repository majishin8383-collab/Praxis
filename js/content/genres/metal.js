// js/content/genres/metal.js
// Metal pack (v1) — palm muting, tight picking, stamina
// Requires: js/content/base.js loaded first

window.CONTENT_ADD({
  genres: {
    metal: {
      id: "metal",
      name: "Metal",
      description: "Tight picking, palm muting, speed control, and endurance.",
      starterSkillIds: [
        "metal_palm_muting",
        "metal_alt_picking",
        "metal_gallop_rhythm"
      ],
      backingTrackIds: [
        "bt_metal_E_rhythm",
        "bt_metal_E_lead",
        "bt_metal_D_rhythm",
        "bt_metal_D_lead"
      ]
    }
  },

  skills: {
    metal_palm_muting: {
      id: "metal_palm_muting",
      genre: "metal",
      name: "Palm Muting Control",
      levelBand: "beginner",
      summary: "Learn controlled, punchy palm muting without choking the strings.",
      drills: [
        {
          id: "d_metal_pm_1",
          name: "Palm-muted eighth notes",
          durationSec: 180,
          handednessSafe: true,
          instructions: [
            "Rest the picking-hand palm lightly near the bridge.",
            "Pick steady eighth notes on one string.",
            "Listen for tight attack without buzzing.",
            "Adjust pressure until notes stay clear."
          ],
          suggestedBpm: { start: 70, target: 130, step: 5 },
          media: {
            demoUrl: "https://www.youtube.com/embed/0hXyQmZfYpM",
            dontUrl: "https://www.youtube.com/embed/9jYF2lK9KxY",
            fixUrl: "https://www.youtube.com/embed/7pYF6kU4x2M"
          }
        }
      ]
    },

    metal_alt_picking: {
      id: "metal_alt_picking",
      genre: "metal",
      name: "Alternate Picking",
      levelBand: "beginner",
      summary: "Build speed and accuracy with relaxed alternate picking.",
      drills: [
        {
          id: "d_metal_alt_1",
          name: "Single-string speed control",
          durationSec: 180,
          handednessSafe: true,
          instructions: [
            "Use strict down-up picking.",
            "Keep the picking motion small.",
            "Stay relaxed in wrist and forearm.",
            "Stop immediately if tension builds."
          ],
          suggestedBpm: { start: 80, target: 160, step: 5 },
          media: {
            demoUrl: "https://www.youtube.com/embed/WvYFz8b5p1A",
            dontUrl: "https://www.youtube.com/embed/5Qc426qgSho",
            fixUrl: "https://www.youtube.com/embed/83GZUBdupaI"
          }
        }
      ]
    },

    metal_gallop_rhythm: {
      id: "metal_gallop_rhythm",
      genre: "metal",
      name: "Gallop Rhythm",
      levelBand: "beginner",
      summary: "Master the classic metal gallop feel with clean timing.",
      drills: [
        {
          id: "d_metal_gallop_1",
          name: "Gallop timing control",
          durationSec: 180,
          handednessSafe: true,
          instructions: [
            "Play long-short-short rhythm patterns.",
            "Accent the first note of each group.",
            "Mute unused strings aggressively.",
            "Lock in with the beat—no rushing."
          ],
          suggestedBpm: { start: 90, target: 150, step: 5 },
          media: {
            demoUrl: "https://www.youtube.com/embed/1M8m4zK4XbA",
            dontUrl: "https://www.youtube.com/embed/9jYF2lK9KxY",
            fixUrl: "https://www.youtube.com/embed/7pYF6kU4x2M"
          }
        }
      ]
    }
  },

  backingTracks: {
    // ---------------------------
    // METAL GROOVES — YouTube
    // ---------------------------
    bt_metal_E_rhythm: {
      id: "bt_metal_E_rhythm",
      genre: "metal",
      name: "Metal Groove (E) — Rhythm",
      key: "E",
      feel: "metal",
      recommendedBpm: 120,
      mix: "rhythm",
      note: "Use YouTube controls in the player.",
      youtubeEmbed: "https://www.youtube.com/embed/6G9X2JkR3yE"
    },
    bt_metal_E_lead: {
      id: "bt_metal_E_lead",
      genre: "metal",
      name: "Metal Groove (E) — Lead",
      key: "E",
      feel: "metal",
      recommendedBpm: 120,
      mix: "lead",
      note: "Use YouTube controls in the player.",
      youtubeEmbed: "https://www.youtube.com/embed/6G9X2JkR3yE"
    },

    bt_metal_D_rhythm: {
      id: "bt_metal_D_rhythm",
      genre: "metal",
      name: "Metal Groove (D) — Rhythm",
      key: "D",
      feel: "metal",
      recommendedBpm: 115,
      mix: "rhythm",
      note: "Use YouTube controls in the player.",
      youtubeEmbed: "https://www.youtube.com/embed/4s2z8xKf7ZQ"
    },
    bt_metal_D_lead: {
      id: "bt_metal_D_lead",
      genre: "metal",
      name: "Metal Groove (D) — Lead",
      key: "D",
      feel: "metal",
      recommendedBpm: 115,
      mix: "lead",
      note: "Use YouTube controls in the player.",
      youtubeEmbed: "https://www.youtube.com/embed/4s2z8xKf7ZQ"
    }
  }
});
