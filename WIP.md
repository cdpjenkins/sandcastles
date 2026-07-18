# WIP: Realistic waves and shoreline

## Current Step

Step 1 of 9: `Waves` holds the sea at a constant surface elevation rather than a constant depth

## Status

⏸️ WAITING - Awaiting commit approval

Test added to `waves.test.ts`: `initBeach()` + one `Waves.step()` leaves the sea surface flat at
`grid.seaLevel` across the sloped floor. RED at 0.57 vs 2.0 (the conflation, reproduced).

`Waves.step` now takes a sea surface *elevation* and derives depth as `max(0, seaSurface - bed)`.
`BASE_SEA_LEVEL` deleted; `Grid.seaLevel` is the single source of truth. `Game` passes
`grid.seaLevel + tide.offset` to both the sim and the HUD.

Existing `waves.test.ts` translated to the new convention (`SEA_SURFACE = 2` elevation over
`BED_HEIGHT = 1`, yielding the same `SEA_DEPTH = 1`) — as PLAN.md predicted, the assertions survived
unchanged.

188 tests pass, `tsc --noEmit` clean. Verified in the real sim loop: z=255 surface went from −18.91
to 2.69 (= 2.0 + 0.693 tide offset); the whole held region spans 2.6928–2.7057, i.e. flat.

Refactor assessed: three lines of production change, consistent with existing style. Nothing to
restructure.

## Completed

- [ ] Step 1: Sea held at constant elevation, not constant depth ← current, awaiting approval
- [ ] Step 2: Flux limit becomes a velocity limit
- [ ] Step 3: Pressure term depth-weighted
- [ ] Step 4: `getVelocity` returns true velocity
- [ ] Step 5: Depth-dependent drag replaces flat `DAMPING`
- [ ] Step 6: Sea interior simulated; only outer boundary held
- [ ] Step 7: Boundary row driven by a swell oscillator
- [ ] Step 8: Sponge layer absorbs outgoing waves
- [ ] Step 9: Remove the surge injection

## Blockers

None.

## Next Action

Awaiting commit approval for Step 1. Then Step 2: the flux limit becomes a velocity limit.
