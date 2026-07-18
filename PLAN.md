# Plan: Realistic waves and shoreline

Implements the recommendation in `WATER_SIM_OPTIONS.md` §6: fix the pipe model in place rather than
replace it.

## Goal

Swell travels in from deep water, slows and steepens over the shallows, bends to face the beach, and
runs up and washes back — instead of being teleported in four rows from shore.

## Acceptance Criteria

- [ ] At rest, the sea surface is flat at a constant *elevation* across the sloping floor
- [ ] Wave speed scales with depth, measurably close to `c = √(g·h)`
- [ ] A wave launched at the deep boundary arrives at the beach with usable amplitude
- [ ] Crests visibly refract toward shore-parallel as they cross the sloping floor
- [ ] Run-up and backwash are visible on the beach
- [ ] `Erosion` is driven by true velocity (`flux/depth`), so thin fast swash scours harder than a deep slow lagoon
- [ ] Volume is still conserved where it should be, and the sim is still unconditionally robust
- [ ] `npm test` and `tsc --noEmit` clean at every step

## Steps

### Step 1: `Waves` holds the sea at a constant surface elevation rather than a constant depth

Fixes the bug in `WATER_SIM_OPTIONS.md` §7. First, because there is no trustworthy baseline to judge
any wave work against while the sea is a ramp diving to −19.

**Test**: `initBeach()` then one `Waves.step()`; assert the surface elevation at z = 203, 210, 230,
255 is still `grid.seaLevel`. Currently returns −0.33, −2.90, −10.04, −18.91 → RED.
**Implementation**: `Waves.step` takes a surface *elevation* and sets
`water = max(0, elevation − rock − sand)`. Make `Grid.seaLevel` the single source of truth; delete
`Waves.BASE_SEA_LEVEL`. `Game` passes `grid.seaLevel + tide.offset`.
**Done when**: the sea is flat at rest across the sloping floor, and the existing `waves.test.ts`
drain tests pass under the reinterpreted argument.

> Existing `waves.test.ts` builds `rock = 1` grids and asserts drain-to-`seaLevel`. Passing `2.0` as
> an elevation onto `rock = 1` yields depth `1.0` — the same assertion. They should mostly survive,
> but each needs reading rather than assuming.

### Step 2: The flux limit becomes a velocity limit

Must land before Step 3. `MAX_FLOW = 4` caps flux, so once flux means `h·u` a wave in 22-unit water
is capped at `u = 4/22 = 0.18` cells/s — but it needs ≈0.67. The clamp would throttle deep water and
mask Step 3 entirely.

**Test**: a deep channel with a large head difference; assert flux exceeds 4.0 while `|flux/depth|`
stays bounded. Currently clamps at exactly 4.0 → RED.
**Implementation**: replace `clamp(f, ±MAX_FLOW)` with a clamp on `u = f/h`, guarding `h → 0`.
**Done when**: deep water can carry a large flux; the outflow limiter still guarantees non-negative
depth.

> Sizing: this is a safety net, not a physics knob. Particle velocity in a wave of amplitude `a` on
> depth `h` is `u ≈ a·√(g/h)` ≈ 0.67 cells/s for `a=1, h=22`. A limit around 5–10 cells/s never binds
> for real waves and only catches pathological dam-breaks.

### Step 3: The pressure term is depth-weighted

The core change. Highest realism-per-line in the codebase.

**Test**: a 1-unit bump in a flat channel at depths 1, 5, 20; assert the disturbance travels further
in deeper water. Currently reaches x=28 at every depth → RED. (This is probe 2 from
`WATER_SIM_OPTIONS.md`, promoted to a test.)
**Implementation**: `f += g · h_edge · (H_i − H_j) · dt`, with `h_edge` the **mean** depth across the
edge.
**Done when**: measured celerity tracks `√(g·h)` within tolerance at all three depths, and shoaling
and refraction are visible in-game.

> **`h_edge` must be mean or upwind — never `min`.** With `min`, `h_edge = 0` at any wet/dry
> interface and water can never advance onto dry land: no run-up, ever. This one line decides whether
> the whole feature works.

> The pipe model is *well-balanced* by construction: it forces on the free-surface gradient
> `H = b + w`, so at rest `ΔH = 0` and no spurious currents appear over the sloping bed. This is why
> Step 6 is safe.

### Step 4: `getVelocity` returns true velocity rather than flux

Must come after Step 3: dividing by depth only yields velocity once the flux genuinely *is* `h·u`.

**Test**: two cells with equal flux but different depth; assert the shallower reports the higher
velocity. Currently equal → RED.
**Implementation**: `velocityArr[i] = (mean edge flux magnitude) / max(h, ε)`.
**Done when**: erosion scours the swash harder than the lagoon.

> This changes what `Erosion` reads, so `erosion.test.ts` will likely need updating. Those updates
> are a behaviour change, not a fix — review each rather than adjusting numbers until green.

### Step 5: Depth-dependent drag replaces the flat `DAMPING`

**Test**: a disturbance in deep water retains >50% of its amplitude after 1 second (currently 24%);
a second test asserts shallow water still damps strongly; a third asserts stability over 300 steps.
**Implementation**: semi-implicit Manning drag, `q ← q / (1 + g·n²·|q|·dt / h^(7/3))`. This form is
unconditionally stable and cannot flip the flux's sign, which an explicit drag term would at small
`h`. Delete `DAMPING`.
**Done when**: waves survive the crossing; shallow swash still slows realistically; nothing explodes.

> `waterSim.test.ts`'s `flow does not overshoot into a strong reversal while settling` asserts
> `getFlowX > -1.4`. That threshold is tuned to `DAMPING = 0.95` and will need re-deriving here.

### Step 6: The sea interior is simulated, and the surge injection goes with it

**Revised mid-flight (approved).** Originally "hold only the outer boundary row", with the surge
removed at Step 9. That ordering does not work: the old pin was not merely reflecting the surge, it
was **deleting its water every tick**, resetting everything from `seaStart + 4` outward. With an open
sea the surge's ~10,240 units per period have nowhere to go and the sea is destroyed (maxFlux 373,
surface swinging −16 to +26). Shrinking the surge only postpones it — height 10 blows up at ~25s,
height 1 at ~240s — because the real problem is that the sea has **no energy sink at all**: Manning
is negligible at depth 20 and the boundary reflects, so any periodic forcing accumulates without
bound. Measured: tide-only is stable past 300s (maxFlux 4–15, sea flat, water cycling cleanly with
the tide).

**Test**: place a bump mid-sea (z = 230) and step; assert it survives. Currently annihilated → RED.
Delete the surge's own tests along with the surge.
**Implementation**: hold only the outermost row at the target elevation. Delete `SURGE_HEIGHT`,
`SURGE_ROWS` and the injection loop. `seaZ` falls out of `Waves.step`'s signature with them.
**Done when**: disturbances propagate across the sea; the sea settles flat and tracks the tide by
filling and draining through the boundary.

> Keeps `timeUntilWave` / `fired` ticking so `WaveAudio` and the HUD countdown stay wired. For two
> steps that means a wave sound with no wave — odd, but Step 8 gives it a real trigger and it avoids
> tearing out and re-adding the wiring. This is the interim answer to open question 2.

### Step 7: A sponge layer absorbs outgoing waves

**Moved ahead of the swell oscillator.** It was Step 8, on the assumption it was polish. It is not:
it is the energy sink the whole open-sea design depends on, and driving swell into a sea without one
would blow up exactly as the surge does.

**Test**: send a wave seaward; assert its reflected amplitude is attenuated below a threshold. This
is testable without the swell driver — fire a bump at the boundary and watch what returns.
**Implementation**: graded flux damping over the outermost N rows, blending to zero at the interior
edge.
**Done when**: a wave sent at the boundary is absorbed rather than returning; the sea stays calm
under sustained forcing.

### Step 8: The boundary row is driven by a swell oscillator

**Test**: assert the boundary elevation oscillates at the configured period/amplitude, and that an
interior cell several rows inshore oscillates too, phase-lagged. RED: currently static.
**Implementation**: drive the held row at `H = seaLevel + A·sin(2πt/T)`. A single sinusoid first; a
Gerstner sum (`WATER_SIM_OPTIONS.md` §5 option D) is a later refinement if one sinusoid reads too
regular. Retie `fired` to the swell period so `WaveAudio` and the HUD countdown mean something
again — the real answer to open question 2.
**Done when**: waves visibly travel in from deep water, shoal, and run up the beach.

### Step 9: Make erosion stable enough to tune, then tune it against real swell

**Scope grew at Step 6.** This was going to be a knob turn. It is not: erosion can *destabilise the
sim*. Measured on the open sea, with everything else held constant — tide, stream and slope are all
stable indefinitely, and only erosion blows the sim up: `EROSION_K = 0.5` at 122s, `0.25` at 147s,
`0.1` stable past 600s. That is a genuine stability threshold somewhere in (0.1, 0.25), not a slow
fuse.

The likely mechanism is a feedback loop with no brake. Erosion drops the bed by up to
`capacity·dt` in a single step, which is a step change in `H = b + w`, which injects grid-scale
energy. Deep water has essentially no Manning drag to dissipate it, and grid-scale noise has near-zero
group velocity in a staggered scheme, so it does not propagate to the sponge either — it sits and
accumulates, driving velocity up, which drives erosion up.

`EROSION_K = 0.1` is therefore forced for now (1.9% suspended at 120s, plateauing), overriding the
0.5 chosen at Step 4 — 0.5 is not a preference that is available.

**Expect the swell to lower the threshold further**, since it adds energy. So this step likely needs
a *mechanism*, not a number: rate-limit how far the bed may move per step, or add a small interior
dissipation that kills grid-scale noise while leaving physical waves alone (a residual linear damping
of ~0.999/step costs a wave ~11% over a 4s crossing and would kill accumulating noise over ~1000
steps). Decide once the swell is in and the real forcing is visible.

**Test**: a mechanism needs one — e.g. erosion cannot move the bed more than X per step. Tuning does
not.
**Done when**: the shore visibly reshapes over minutes without dissolving, the sand budget plateaus,
and erosion cannot destabilise the sim at any setting a player could reach.

## Then stop and reassess

Steps 1–9 deliver shoaling, refraction, run-up, and backwash — 3 of the 4 phenomena in
`WATER_SIM_OPTIONS.md` §4. **Look at it before deciding anything about breaking waves.**

The argument in §6 is that breaking is mostly a rendering problem: once Step 3 makes crests genuinely
steepen, detecting steepness and drawing foam gets most of the visual payoff for a few percent of a
shock-capturing solver's cost. That's a separate plan, and it should be written only after seeing
Steps 1–9 running.

## Not in scope

- Foam / whitecap rendering (the reassessment above)
- Finite-volume SWE, LBM, particles (`WATER_SIM_OPTIONS.md` §5 B, E, F — all rejected)
- WebGPU (§5 G — the shoreline is wrong for physics reasons, not flops)
- The `max(0, …)` conservation hole in `WaterSim.step` (§3) — real but tiny; note it if it grows

## Risks

| Risk | Assessment |
|---|---|
| **CFL** once damping is gone | At depth 22, `c = √(9.8×22) ≈ 14.7`, so `CFL = 14.7/30 ≈ 0.49` — inside the explicit limit, no substepping needed. Deepening the sea past ≈−40 pushes CFL > 0.65 and would force substepping. |
| Existing tests encode current behaviour | `erosion.test.ts` (Step 4) and the overshoot threshold (Step 5) will need conscious updating. Re-derive them; don't tune to green. |
| Startup transient after unpinning (Step 6) | The sea settles over ~4 s. If it reads badly, initialise the sim at rest rather than adding damping back. |
| Depth-weighting destabilises shallow cells | `h_edge → 0` divides in Steps 2 and 4. Guard with `max(h, ε)` and test at `h = 0`. |
| Realism improves but the game gets worse to play | Waves that erode a castle in 10 s are physically right and no fun. Amplitude/period in Step 7 are game knobs, not physics — tune them freely. |

## Open questions

1. **The waterline moves.** Step 1 makes `Grid.seaLevel = 2.0` (elevation) authoritative and deletes
   `BASE_SEA_LEVEL = 1.0` (depth). This restores `initBeach`'s intent, but the resting sea gains a
   unit of depth at the shoreline and floods roughly the nearest ~10 beach rows — a visible change,
   and the HUD will read `2.00` where it currently reads `1.00`. Is elevation `2.0` the sea level you
   want, or should the constants reconcile at `1.0` instead?

2. **What fires the wave sound?** With continuous swell there's no discrete surge, but `waves.fired`
   currently drives `WaveAudio.play()` and the HUD countdown. Options: fire once per swell period as
   the crest passes a reference row (keeps both, my suggestion); trigger on breaking detection (waits
   for the foam work); or drop the countdown entirely.