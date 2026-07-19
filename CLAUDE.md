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

It also caps *how narrow a gorge the stream can cut*, which is a known and deliberate trade.

### The sponge relaxes the surface as well as damping the flux

Both halves are doing work. Damping flux alone takes the wave's momentum and leaves its surface
anomaly to re-radiate: 0.098 reflection against 0.035 for both. Don't simplify one away.

### `SWELL_PERIOD` is coupled to refraction

Refraction is emergent from `c = √(g·h)`, but Snell's law only applies where depth varies slowly over
a wavelength. The sea is 56 rows deep; at a 5s period the wavelength is `c·T` = 70 cells and nothing
bends at all. 2s (~28 cells) works. Lengthening the period silently costs refraction.

### These are knobs. Don't let a test pin one.

`EROSION_K`, `MAX_BED_RATE`, `SWELL_PERIOD`, `SWELL_AMPLITUDE`, `MANNING_N`, `MAX_VELOCITY`.

Magnitude assertions against them have needed re-deriving five times over. Prefer a comparison — "a
thin sheet scours more than a deep pool carrying the same flux" — or a floor far below any sensible
setting. If a test breaks every time the model improves, it is describing the model's flaws rather
than its behaviour.

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
- **`Float32Array` round-trips break `toEqual`** on struct-returning functions: `1.2` comes back as
  `1.2000000476837158`. Assert fields individually with `toBeCloseTo`.
