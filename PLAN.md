# Plan: Pause the simulation

## Goal

Pressing **P**, or clicking a **Pause** button in the toolbar, freezes the
simulation; doing it again resumes exactly where it left off.

## Design

### What pause stops, and what it does not

Pause gates `Game.simStep` only. Everything else keeps working:

| Keeps working | Frozen |
| --- | --- |
| Rendering | Water, erosion, moisture, slope |
| Camera pan / zoom | Waves, tide, sea level |
| Look readout | The `wave: Xs` countdown (it only moves in `simStep`) |
| Spade / Dump / Stream | |

Tools stay live deliberately: this is a sandbox, and "pause, then build
carefully" is the natural affordance. Freezing the camera would just read as a
hung game. Nothing outside `simStep` advances on wall-clock time, so gating that
one call is sufficient — verified by reading `loop`: `tide.step` and
`waves.step` are both inside it.

### The trap this feature has to avoid

`loop` runs a fixed-timestep accumulator:

```ts
this.simAccumulator += dt
while (this.simAccumulator >= SIM_STEP) { this.simStep(SIM_STEP); ... }
```

Gate only the `while` and the accumulator keeps growing while paused — a
one-minute pause banks ~3600 frames of `dt` and then floods thousands of
catch-up steps on resume, locking the tab. The accumulator must not advance at
all while paused.

That is the one piece of this feature with real content, and it currently lives
in `Game`, which has no tests (its constructor builds a canvas, a Three.js
renderer and a `Picker`). So extract it.

### `SimClock` — the testable seam

A small class in `src/core/` owning the fixed-timestep accumulator and the
existing `0.1` frame clamp, answering one question: how many sim steps should
run this frame?

```ts
new SimClock(SIM_STEP, MAX_FRAME)
clock.advance(frameSeconds, paused): number   // shape provisional, emerges in TDD
```

This brings the pause guarantee under test *and* pulls the currently-untested
clamp and accumulator in with it. The alternative — an inline `if (!paused)` in
`Game` — is fewer lines but leaves the one thing that can actually break
untested, which this project does not do.

### Toolbar button

Mirrors the existing Look toggle exactly: `data-action="pause"`, `aria-pressed`,
a `setPaused` that syncs without firing, and an `onPauseToggle` handler. The one
deviation: the label swaps `⏸ Pause` / `▶ Resume` rather than staying fixed like
Look's, because pause is a modal state and a stuck-looking game needs an obvious
way out. Flagging it as an inconsistency in case you would rather it match Look.

## Acceptance Criteria

- [ ] `P` toggles pause; the toolbar button toggles pause; the two stay in sync
- [ ] While paused, water / tide / waves / erosion do not advance
- [ ] While paused, the scene still renders and the camera still pans and zooms
- [ ] Resuming runs one normal frame — no burst of catch-up steps
- [ ] The help overlay documents `P`
- [ ] Full suite green, `tsc --noEmit` clean

## Steps

### Step 1: `SimClock` yields the right number of fixed steps for elapsed time

**Test**: a clock advanced by exactly three step-lengths yields three steps;
a partial step yields none and the remainder carries into the next call.
**Implementation**: `SimClock` with the accumulator and the frame clamp.
**Done when**: `simClock.test.ts` green, `Game` not yet touched.

### Step 2: a paused clock yields no steps and banks no time

**Test**: advancing a paused clock across many frames yields zero steps, and the
first frame after resuming yields no more than one.
**Implementation**: paused advances return 0 without touching the accumulator.
**Done when**: the catch-up-burst trap is covered by a failing-then-passing test.

### Step 3: `Game` drives its loop from `SimClock`

**Test**: none — `Game` has no harness. Behaviour-preserving swap, covered by
Step 1's tests plus running the app.
**Implementation**: replace the inline accumulator with `SimClock`, passing
`paused: false` throughout.
**Done when**: suite green and the app still runs unchanged in the browser.

### Step 4: the Toolbar carries a Pause toggle

**Test**: clicking fires `onPauseToggle` with the new state; the button reflects
`aria-pressed`; `setPaused` syncs without firing; the label swaps.
**Implementation**: mirror the Look button.
**Done when**: `toolbar.test.ts` green.

### Step 5: `P` and the button pause the game

**Test**: none — `Game` wiring.
**Implementation**: `paused` field, `togglePause`, `P` in `onKeyDown`,
`toolbar.onPauseToggle`, the `P  Pause / resume` help line, and `setPaused` so
key and button stay in sync.
**Done when**: verified in the browser — sim freezes, camera still moves,
resume does not lurch.

## Notes

- Step 3 is the only step that is not test-first, and it is a mechanical swap of
  untested code for tested code. Steps 1, 2 and 4 are strict RED-GREEN-REFACTOR.
- Optional extra, not in scope unless you want it: show `PAUSED` in the toolbar
  readouts alongside bucket / wave / sea level.
- Commits per step, as we have been doing.
