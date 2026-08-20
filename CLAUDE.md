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

### Advection weights by velocity, not flux — and deep lakes are where it shows

`flowX`/`flowZ` hold *flux* (`depth × velocity`), which the flux ceiling
`MAX_VELOCITY * edgeDepth` makes plain. The self-advection term must weight the momentum gradient by
the transport *velocity* (`flux / depth`), so `WaterSim.step` divides the flux average by the depth
before using it. It was once the flux itself — over-scaled by the whole depth. In shallow water
`flux ≈ velocity` and nothing showed; in a deep, enclosed lake the term ran ~20–40× too strong, fed on
itself once any flow existed, and tore the surface into grid-scale chop. Onset was at depth ≈ 22
(CFL `√(g·h)·dt ≈ 0.5`), which is why it surfaced only when a big `DIG_AMOUNT` let a single dig cut a
pit that deep. Same bug class as sea level above: a value read as the wrong physical quantity.

The divisor is `max(edgeDepth, 1)`, not `edgeDepth`. Weighting by the true velocity everywhere breaks
the *shallow* stream instead: a thin sheet's velocity is high, so the corrected term spreads the flow
and the stream planes a wide flat valley rather than cutting a channel (the erosion channel test
catches this). Capping the divisor at one unit of depth leaves water shallower than that at its stock
flux — channel-cutting is byte-identical — and only attenuates the deep water that was unstable. The
`1` is the crossover depth where flux and velocity read alike; it is coupled to the world's unit scale.

### An edge conducts the water above the sill, not the mean of the two columns

`conductingDepth` takes the mean of the two cells' columns *measured above the higher of the two
beds*. The obvious `(wi + wj) / 2` gives the same answer whenever the bed is flat, which is why it
survived so long — it only diverges where the bed steps, and it is exactly there that it matters. A
sill carrying one unit of head beside a ten-deep lake read as 5.0.

Three things break together, all in the same direction, which is what made the symptom so violent:
the drive `g * edgeDepth * dh` runs over-strong, the `MAX_VELOCITY * edgeDepth` ceiling that would
have caught it lifts by the same factor, and `withDrag` softens by `h^(7/3)` exactly where the water
is thin and friction ought to dominate. Water crossed a breached rim at 30 cells/s, ~4× `MAX_VELOCITY`,
CFL ≈ 1.

Third instance of the same bug class as sea level and the advection flux: a value read as the wrong
physical quantity. Note the pattern — all three hid because the wrong reading agrees with the right
one in the common case (flat bed, flat sea, shallow water) and only parts company at the edges.

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

### Capacity's depth dependence is deliberate, not a units slip

Capacity is compared against `sediment`, an absolute column, while `transportSediment` reads a
concentration to pick its upwind value. That looks like a units slip, and it is why deep cells reach
the deposit branch before shallow ones at equal concentration — but it cannot be "corrected", because
comparing in concentration is *algebraically the same thing* as a discharge-based capacity:

```
concentration vs v·S·K  ⟺  sediment/water vs v·S·K  ⟺  sediment vs (v·water)·S·K  ⟺  sediment vs q·S·K
```

So concentration-consistency and velocity-based capacity cannot both hold while `sediment` is a
conserved column. Pick one. The code picks velocity, deliberately, in `d2da198`, and the absolute
comparison is that choice's consistent partner.

Measured before believing it: under `q·S` no `EROSION_K` forms a channel at all. At 40 the stream
planes the hillside (cut 0.436 beside the channel against an allowed 0.338); at 20 and below it never
incises (floor 0.81, then 0.34, then 3.8e-7, needing > 1). It goes straight from planed to nothing
with no window between. Any comparison that scales with water in the shallow regime makes the channel
discharge-driven, and the channel *is* the shallow regime.

`transportSediment` itself is right: `flow × concentration` is `(h·v)(s/h) = v·s`, the correct
advective flux of a column. There is no arithmetic error here to find.

### Without a threshold of motion, erosion pumps a lake's own waves

A lake's waves are a *standing* wave — the rim reflects — and in a standing wave velocity and surface
slope are in phase with each other: both peak at the nodes, both vanish at the antinodes. So a
capacity of `velocity × slope` scours the nodes and drops the load at the antinodes. Because the
surface is `bed + water`, every bit of that bed movement goes straight into surface elevation:
depositing at an antinode raises the crest, which drives the next cycle harder.

Measured in a closed basin — no outflow, no wet/dry front — 10 deep, kicked with a 0.1 tilt: the
slosh grew to 7.1 in 90s while the lake stripped its own bed from 8000 to 24. Water volume was
*exactly* conserved (15998.0 → 15998.0), so the amplitude came from the bed, not from the water sim.
`sum(Δbed × surfaceAnomaly)` was +31.6; with `CRITICAL_POWER` it is 0.000.

**Stream power cannot tell a lake seiche from wave swash — only an obstacle separates them.** Quiet
lake max power 0.226; flat-beach swash max 0.230 over 45k samples, with *zero* above 0.3. So a
threshold silences flat-beach swash, and that is fine and wanted: a featureless beach in equilibrium
with the swell should not dissolve. What must still erode is a castle, and it does, because an
obstacle steepens the surface: p75 0.42, p90 0.89, p99 3.5, a third of its samples above the
threshold. A castle loses ~56% of its sand to 120s of waves. Check that scene, not flat beach, before
touching `CRITICAL_POWER`.

`CRITICAL_POWER` is a knob coupled to the world's unit scale, and its window is narrow — 0.3–0.4.
Below it the lake still pumps; above it the stream stops cutting its channel.

Four other cures were measured and rejected. All of them reduce the amplification, which is exactly
why they are tempting:

- **Compare concentration rather than absolute sediment** (the mismatch noted above). Real bug, worth
  fixing on its own merits, but only takes the slosh 8.5 → 3.1. Not the pump.
- **Volume-conserving bed exchange** — add the eroded depth to the water column so `H` cannot move.
  Cures the lake perfectly and destroys the channel: it *creates water*, which floods the hillside and
  planes it flat (banks cut 4.01 against a channel floor of 4.12).
- **Sediment volume in the surface**, `H = bed + water + sediment`, the version of the above that does
  not invent water. Worse than doing nothing (5.0) and the channel still goes.
- **Unit stream power `q·S`** — weight by discharge instead of velocity. Reasoning that flux is
  phase-symmetric across crest and trough is wrong: still 3.1, and worse as `EROSION_K` drops.

### The sponge relaxes the surface as well as damping the flux

Both halves are doing work. Damping flux alone takes the wave's momentum and leaves its surface
anomaly to re-radiate: 0.098 reflection against 0.035 for both. Don't simplify one away.

### `SWELL_PERIOD` is coupled to refraction

Refraction is emergent from `c = √(g·h)`, but Snell's law only applies where depth varies slowly over
a wavelength. The sea is 56 rows deep; at a 5s period the wavelength is `c·T` = 70 cells and nothing
bends at all. 2s (~28 cells) works. Lengthening the period silently costs refraction.

### These are knobs. Don't let a test pin one.

`EROSION_K`, `MAX_BED_RATE`, `SWELL_PERIOD`, `SWELL_AMPLITUDE`, `MANNING_N`, `MAX_VELOCITY`.

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

## Persisting the game

The beach survives a Chrome tab discard by snapshotting into IndexedDB:
`GameSnapshot.ts` (shape, guard, `createSnapshot`, `loadSnapshot`), `AutoSaver.ts`
(when to write), `IndexedDbSnapshotStore.ts` (the store). Per-class
`snapshot()`/`restore()` on `Grid`, `WaterSim`, `Waves`, `Tide` and `IsoCamera`.
`PLAN.md` has the design. What was expensive to learn:

### `instanceof` is wrong for anything that came out of storage

Deserialising is a realm crossing by nature, and `value instanceof Float32Array`
is `false` for a perfectly good `Float32Array` from another realm. Under jsdom
the structured clone lands in Node's realm, so the validator rejected every save
it was handed. `isCellArray` brand-checks with `Object.prototype.toString`, which
is realm-independent and still rejects plain arrays and other typed arrays.

A real browser has one realm, so this would never have shown in manual testing —
only the test caught it.

### The store must let go of its connection on `versionchange`

The connection is held for the life of the page. Without releasing it, a second
tab running a newer `DB_VERSION` blocks on `open()` until the first tab closes,
and *that* tab's `onblocked` path silently gives it a fresh beach. Costs two
lines; found by test, not by browsing.

### Resolve a write on the transaction, not the request

`IDBRequest.onsuccess` fires before the transaction commits. Resolving there
reports a save durable while it is still in flight, which frees `AutoSaver` to
start the next one over the top of it.

### `visibilitychange` is the trigger that works — `pagehide`/`freeze` cannot be

IndexedDB writes are async, and a page being frozen or discarded may never commit
one. But Chrome only discards a tab that is *already backgrounded*, and
`visibilitychange` fires the instant it is — minutes before the freeze. That is
what actually saves the beach. The periodic save covers a crash; `pagehide` and
`freeze` are best-effort only. Don't simplify one away in favour of another.

### A save that the guard rejects is the worst failure available

Every save written, every load rejected, autosave silently doing nothing while
looking completely healthy. `Game` cannot be built under jsdom, so the assembly
lives in `createSnapshot` and the test drives it with real components — that
round trip is the thing keeping the feature honest.

### What is deliberately not stored

The seven dirty masks and `WaterSim.velocityArr` (recomputed each step),
`TerrainMesh` (~3 MiB, derived from `Grid`), and `SimClock.accumulator` (≤ 1/30 s).
`rock` *is* stored despite never being mutated by the sim: regenerating it saves
256 KiB of 2 MiB and couples the save format to the noise constants in `Grid.ts`.
Not worth it — recorded so it is not rediscovered as an oversight.

### Sizing rules out localStorage, not just disfavours it

Eight `Float32Array(65536)` is exactly 2.00 MiB. localStorage is string-only, so
base64 needs ~5.6 MB of a ~5 MB quota, synchronously on the main thread.
IndexedDB structured-clones typed arrays natively, so there is no serialisation
format to write at all.

## The Look panel's dash means dry, and dry means exactly zero

`formatLookInfo` prints `Water top —` when `waterDepth === 0`, a strict
comparison and not an epsilon (`LookInfo.ts:34`). `Depth` is printed with
`toFixed(2)`. So a cell holding the swash's residual film — around 1e-6 — reads

```
Depth 0.00  Water top 4.00
```

which looks like a contradiction: no depth, but a water surface anyway. It is
the agreed behaviour. The dash is reserved for cells the sim considers truly
dry, and a film that thin is still wet as far as every other part of the model
is concerned; widening the dash to an epsilon would claim dryness the sim does
not agree with, and the two readings would then disagree about the same cell.

Recorded because it is the first thing in that panel that will look like a
defect, and it is not one.

