# Sandcastles — Claude Instructions

## Commit discipline

**Commit after every completed step, not at the end of a milestone.**

After each RED-GREEN-REFACTOR cycle is done and `npm test` + `tsc --noEmit` are clean:

1. Stage the relevant files
2. Commit immediately
3. Then move to the next step

This keeps every step independently revertable.

## WIP.md discipline

**Update WIP.md after every step.**

- Before starting a step: set status to 🔴 RED and record the current step
- After tests pass: update to 🟢 GREEN
- After refactor assessment: update to ⏸️ WAITING and mark the step complete
- After commit: update Next Action to the next step

WIP.md must always reflect reality. If it doesn't match what's actually happening, update it immediately.

## The water sim

`WATER_SIM_OPTIONS.md` is the analysis behind the current model and is still accurate. What follows
is only what was expensive to learn.

### Sea level is an elevation, never a depth

`Grid.seaLevel` is the single source of truth and means *elevation*. `Waves.step` takes a surface
elevation and derives depth as `max(0, seaSurface - bed)`.

This was wrong once and nothing caught it. The two readings agree numerically while the sea bed is
flat, and only diverge when it slopes — which put the sea surface at −18.91. No test failed, because
`initBeach` and `Waves` were only ever exercised apart. When a value could be read as either, name it
for which it is.

### `MAX_BED_RATE` is load-bearing, not a tuning detail

Erosion can destabilise the water sim. Moving the bed is a step change in `H = b + w`, so an
unbounded scour rate feeds back on itself: scour deepens the stream's channel, the channel speeds the
water, the faster water scours harder. `MAX_BED_RATE` caps how far the bed may move per step, and is
the only reason `EROSION_K` is free to tune — without it, `EROSION_K = 0.25` destroys the sea inside
150s.

It was once believed to cap *how narrow a gorge the stream can cut*. It does not, or not much:
raising it 0.3 → 3.0 moved the channel's depth/width ratio only 0.605 → 0.655. The capacity law sets
the channel's shape; this sets the rate the bed may move. Don't reach for it to fix morphology.

### Erosion capacity needs slope, not just speed

`capacity = velocity * EROSION_K * surfaceSlope`. Speed alone cannot tell a channel from a sheet
wash — a thin film racing over flat ground moves as fast as the thalweg — so without the slope term
every wet cell scours alike and the stream planes a wide flat valley instead of cutting a gorge
(depth/width 0.087 against 0.390 with it).

Two other laws were measured and rejected, both plausible enough to try again if this is forgotten:

- **`v * h`**, the pre-`d2da198` law, cuts the best gorge of anything tried (0.605). But it makes
  capacity a function of discharge alone, so it claims a deep still pool and a racing sheet carrying
  the same water scour identically. That is the bug `d2da198` existed to fix.
- **`h * S`**, shear stress, has no velocity term at all. Sweeping the forcing flux over 100× left
  its erosion identical at every value: still water on a hillside would scour as hard as a torrent.
  `τ = ρghS` only encodes velocity through the *friction* slope; a slope read from instantaneous
  geometry is not that.

Capacity is compared against `sediment`, an absolute column, while `transportSediment` works in
concentration. That mismatch is still present and is why deep cells reach the deposit branch before
shallow ones at equal concentration.

### The sponge relaxes the surface as well as damping the flux

Both halves are doing work. Damping flux alone takes the wave's momentum and leaves its surface
anomaly to re-radiate: 0.098 reflection against 0.035 for both. Don't simplify one away.

### `SWELL_PERIOD` is coupled to refraction

Refraction is emergent from `c = √(g·h)`, but Snell's law only applies where depth varies slowly over
a wavelength. The sea is 56 rows deep; at a 5s period the wavelength is `c·T` = 70 cells and nothing
bends at all. 2s (~28 cells) works. Lengthening the period silently costs refraction.

### The rivers are wide because of the wetted width, not the deposition rate

Measured on the game scene, not a synthetic hillside — the two disagree, so measure on the beach.

Deposition looks like the culprit and isn't. Two thirds of all the sand the stream picks up goes
straight back down (47,647 eroded against 32,052 deposited over 120s), and 44% of those deposits are
pinned at `MAX_BED_RATE`. But `DEPOSITION_K = 0` leaves the channel the same width and the same
depth (at z=80, 2.633 over 38 cells becomes 2.633 over 36), and ×10 changes nothing either. Sand and
sediment balance to 0.1 in 144,504, so nothing is inventing sand.

What actually sets the shape, in order of weight:

- **The bed is at bedrock across most of the river's width** — 31 of 38 cut cells at z=80, 87 of 109
  at z=100. `initBeach` leaves only ~3 units of sand on those rows and the stream strips it in well
  under 120s. The `sand > 0` guard then blocks the erode branch, so the channel can only widen.
- **`MAX_BED_RATE` saturates, so incision is uniform across the wetted width.** Capacity in the
  channel is 6–12 against a load of 0.2–1.6, so `capacity - sediment` is 5–50× the cap and the
  `Math.min` takes `MAX_BED_RATE * dt` on 76–96% of steps right across the section. Every wet cell
  drops at the same rate, which is why the floor is a smooth pan rather than a V. The capacity law is
  inert here. This does *not* mean raising the cap helps — that only strips to bedrock faster.
- **`Slope` widens it by about a factor of two** (at z=80, 38 cells cut becomes 84).

So the lever for a narrower river is sand depth to cut into and lateral confinement, not any erosion
knob. On a synthetic hillside with 10+ units of sand the same model reaches depth/width 0.9.

### `SLUMP_RATE` is a weak lever, and slower is not better

It was `TRANSFER_FRACTION`, applied per *step* with no `dt`, which put the slumping rate on `SIM_HZ`:
0.5 per step at 30 Hz is 15/s, fast enough to project a bank onto the repose slope within one step.

Fixing that is worth it — the rate is now a property of the sand — but it buys less than it looks
like. 15/s → 1/s narrows the river a tenth and deepens it a fifth; 1/s → 0.5/s buys nothing further
and only makes a dug wall stand around sluggishly. Slumping widens the channel by happening at all,
and no rate switches that off. `Slope` off entirely is still narrower than the slowest rate swept.

Repose also puts a hard floor under the width: `2 * depth / tan(32°)` ≈ 3.2 × depth, so a 3-unit sand
layer cannot hold a channel narrower than about 10 cells whatever else changes.

### These are knobs. Don't let a test pin one.

`EROSION_K`, `MAX_BED_RATE`, `SWELL_PERIOD`, `SWELL_AMPLITUDE`, `MANNING_N`, `MAX_VELOCITY`,
`SLUMP_RATE`.

Magnitude assertions against them have needed re-deriving five times over. Prefer a comparison — "the
ground ten cells from the channel is untouched" — or a floor far below any sensible setting. If a test
breaks every time the model improves, it is describing the model's flaws rather than its behaviour.

A comparison is not automatically safe, though. See the saturation trap below: "a thin sheet scours
more than a deep pool carrying the same flux" is a comparison, and it still cannot referee anything.

### Screen-space directions go through `isoProjection`

The camera is a fixed isometric (45° yaw, ~35.26° pitch), so a world `+x` flow moves down-right on
screen, not right. Anything drawing a direction — flow arrows, wind, particles — reuses
`worldToScreenDirection` rather than re-deriving the basis.

## Measuring the water sim

It is easy to measure wrongly, and each of these produced a confident wrong answer first:

- **Track the crest, not a threshold.** An explicit scheme lets a vanishing precursor run one cell per
  step ahead of the wave — 30 cells/s here — so a tight threshold reports celerity ~40% high. A bias
  that is near-constant across a swept parameter is a measurement artifact; a physics error varies
  with the parameter.
- **Launch a smooth hump, not a single raised cell.** A one-cell bump is a delta function and
  disperses into a background that can sit *above* the threshold you are testing against.
- **Sample over less than 180s**, or the tide (±0.8) swamps what you meant to measure.
- **High flux is not failure.** A stream carving a gorge has high flux and is working as intended. Ask
  whether the *sea* departs from where the swell says it should be, and whether depth is NaN or
  negative.
- **Keep scratch probes' signatures current.** Identical results across configurations that should
  differ means you are measuring the harness, not the sim.
- **Check whether `MAX_BED_RATE` has swallowed what you are comparing.** Both readings landing on
  exactly `MAX_BED_RATE * dt` (0.01 at 30 Hz) means you measured the cap, not the thing you varied.
  This makes `a thin sheet scours more than a deep pool carrying the same flux` unable to referee a
  capacity law at all: at any `EROSION_K` large enough to cut a gorge, both its readings pin at the
  ceiling. It passes today only because `EROSION_K = 40` sits right at that boundary. The trap is
  worse than a plain wrong answer, because a law can appear to *pass* on one scene by saturating on
  one side and not the other — that is how `u * S` was first, wrongly, said to preserve it. Sweep the
  forcing until both sides come off the ceiling before believing any comparison of erosion amounts.
- **`Float32Array` round-trips break `toEqual`** on struct-returning functions: `1.2` comes back as
  `1.2000000476837158`. Assert fields individually with `toBeCloseTo`.
