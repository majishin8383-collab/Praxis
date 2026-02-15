# GOVERNANCE.md

## Praxis — Emotional Integrity & Evolution Charter

This document defines how Praxis is allowed to change.

It exists to protect emotional safety, user trust, and long-term integrity — even as the product grows, monetizes, or attracts outside pressure.

If this document conflicts with speed, growth, or convenience, **this document wins**.

---

## PRIME GOVERNANCE LAW

> **No change may increase emotional demand on a distressed user.**

If a change makes a user:
- decide more
- do more
- perform better
- understand more  
during distress… it must not ship.

---

## CORE PRINCIPLES

Praxis is not optimized for:
- engagement
- streaks
- habit formation
- productivity
- performance

Praxis *is* optimized for:
- emotional safety
- agency
- restraint
- predictability
- trust over time

---

## COMPLETION & CLOSURE (NON-NEGOTIABLE)

Every user-facing flow **must** end with a closure state.

There are exactly three closure states:
- `REST`
- `RELIEF`
- `READINESS`

Rules:
- One primary state per flow
- Soft-shifts are optional and contextual
- Silence is allowed **only after** state is named
- Closure must return agency and release control

If closure is missing, the implementation is invalid.

### Closure requirements checklist (ship gate)
A flow is invalid unless it ends with:
- A named closure state (`REST` / `RELIEF` / `READINESS`)
- A primary next option that **reduces demand** (or ends cleanly)
- No guilt, no push, no “keep going” pressure

---

## VERSIONING PHILOSOPHY

Praxis uses semantic versioning with **emotional meaning**.

### MAJOR (X.0)
Philosophical or architectural change.

May only ship if:
- Emotional contract remains intact
- Closure framework is unchanged or stricter
- No existing tool becomes more demanding
- A rollback plan exists

Major versions should be rare.

### MINOR (X.Y)
Optional capabilities added without emotional demand.

Allowed:
- Paid Insight expansion
- Accessibility improvements
- Optional reflection features

Constraints:
- Must be ignorable
- Must not alter default flows
- Must not add steps to existing tools
- Must not change closure behavior

### PATCH (X.Y.Z)
Bug fixes and safety improvements.

Includes:
- Language softening
- Pressure removal
- Stability fixes
- Consistency corrections

Patch notes should never include the word “new”.

---

## FEATURE ADMISSION TEST (FAT)

Every proposed feature must answer **yes** to all:

1. Does this reduce harm or pressure?
2. Does it function during failure, not just success?
3. Does it remain valid if the user stops early?
4. Could it exist without being noticed?

If any answer is unclear, the feature does not ship.

---

## GROW LAYER PRESERVATION

Growth in Praxis is a **side-effect**, never a destination.

Forbidden:
- Progress dashboards
- Scores, streaks, or achievements
- Comparative language (past vs present)
- Improvement claims

Allowed:
- Rare, descriptive pattern reflections
- Narrative summaries without evaluation
- Optional insight, never during distress

If growth is announced, it is broken.

---

## MONETIZATION RULES

> **Praxis will never monetize dysregulation.**
> Paid invites may appear only after closure states or on Home Tools panel; never during active distress tools.

### Free Tier must always include:
- All Stabilize tools
- All Act tools
- Full closure quality
- Unlimited use
- No degraded language

### Paid features may include:
- Pattern reflection
- Personal language adaptation
- Long-horizon narrative context
- Optional reflection space

Paid features must never provide:
- Faster relief
- Deeper safety
- Priority care
- “Advanced” calming

Care is equal for all users.

---

## LANGUAGE GOVERNANCE

### Closure Language Rules
- Present tense
- Descriptive, not evaluative
- Short (≤ 12 words preferred)
- No praise, motivation, or future pressure

### Forbidden words (partial matches included)

These are **ship-blockers** in user-facing copy unless explicitly quoted from the user.

#### 1) Performance / praise / evaluation
- good job
- proud
- success
- win
- crush
- achieve / achievement
- productive
- progress
- improving
- better
- best
- mastery
- optimize
- maximize
- level up

#### 2) Pressure / coercion / urgency
- do it now
- right now
- immediately
- must
- should
- need to
- have to
- no excuses
- don’t fail
- prove
- commit
- promise
- push through
- keep going
- don’t stop

#### 3) Gamification / tracking pressure
- streak
- score
- points
- rank
- badge
- reward (when framed as performance)
- milestone (when framed as progress pressure)

#### 4) Comparative / improvement framing
- more than yesterday
- better than before
- upgrade your life
- become your best self
- transform yourself
- glow up

#### 5) Manipulative emotional hooks
- you owe it to yourself
- don’t let this slip
- you’ll regret it
- what’s your excuse

> Note: This list is intentionally strict. If something feels “motivational,” it’s probably not allowed.

### Allowed language defaults (preferred)
Use language that preserves agency:
- “If you want…”
- “Choose one…”
- “Stop here…”
- “That’s enough for now.”
- “Return when ready.”
- “Smallest next move.”

---

## UI GOVERNANCE

- Default screen must remain simple.
- Optional controls must be ignorable.
- No dense forms in distressed flows.
- No surprises (especially after a stop-early).
- No UI that implies evaluation or “performance.”

---

## FAILURE & INTERRUPTION RULES

A flow must still be “valid” if the user:
- quits early
- stops the timer early
- closes the tab
- returns later without context

Rules:
- Stop-early must produce closure (REST/RELIEF/READINESS)
- No penalty language
- No “try again” pressure

---

## CHANGE CONTROL

Any change that touches:
- wording
- number of steps
- lock/unlock logic
- default navigation
- closure behavior

…must be reviewed against:
- PRIME GOVERNANCE LAW
- CLOSURE framework
- FAT test
- Forbidden words list

If uncertain: ship nothing, or ship the smallest patch that removes pressure.

---
