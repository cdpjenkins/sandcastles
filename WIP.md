# WIP: Realistic waves and shoreline

## Current Step

Step 3 of 9: The pressure term is depth-weighted

## Status

⏸️ WAITING - Awaiting commit approval

Test added to `waterSim.test.ts`: a disturbance travels further in deeper water (probe 2 from
WATER_SIM_OPTIONS.md, promoted). RED at `expected 8 to be greater than 8` — depths 5 and 20 spread
identically, the analysis doc's central finding reproduced.

The pressure term is now `GRAVITY * edgeDepth * (hi - hj) * dt`, i.e. `g·h·∂H/∂x`. Two insertions of
`edgeDepth *`; Step 2 had already named the quantity and cleared the flux cap that would have
throttled it.

191 tests pass, `tsc --noEmit` clean. All pre-existing tests still pass.

**Celerity confirmed as `sqrt(g*h)`** by crest tracking: 3/4/6/10/14 cells/s at depths 1/2/5/10/20,
against predictions of 3.13/4.43/7.00/9.90/14.00 (integers are cell-position quantisation, ±1
cell/s). First attempt measured ~40% high at every depth — that was threshold detection catching the
numerical precursor, not a physics error; see LEARNINGS.md.

Stability over 180s of the full sim (one tide period, 9 surges): zero NaN, zero negative water on
every tick. Flux spikes to ~28 on surge ticks and decays to ~1.1 within 5s. Tide correct: sea at
1.200 at t=135s and 2.800 at t=45s, matching 2.0 ± 0.8. Erosion reaches a dynamic equilibrium at
99.0% of initial sand rather than running away.

Refactor assessed: nothing to restructure — the pressure term now reads as the equation it
implements.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [ ] Step 3: Pressure term depth-weighted ← current, awaiting approval
- [ ] Step 4: `getVelocity` returns true velocity
- [ ] Step 5: Depth-dependent drag replaces flat `DAMPING`
- [ ] Step 6: Sea interior simulated; only outer boundary held
- [ ] Step 7: Boundary row driven by a swell oscillator
- [ ] Step 8: Sponge layer absorbs outgoing waves
- [ ] Step 9: Remove the surge injection

## Blockers

None.

## Next Action

Awaiting commit approval for Step 3. Then Step 4: `getVelocity` returns `flux / depth` — now
meaningful, since flux genuinely is `h·u`.

Note for Step 5: in-game shoaling and refraction are physically present but not yet *visible*,
because `DAMPING = 0.95` still kills a wave in ~1s (confirmed: the crest fails threshold detection
at all after 60 cells). Refraction follows mathematically from `c = sqrt(g*h)` over the sloped bed,
but visual confirmation of both has to wait for Step 5.
