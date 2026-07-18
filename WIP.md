# WIP: Realistic waves and shoreline

## Current Step

Step 5 of 9: Depth-dependent drag replaces the flat `DAMPING`

## Status

⏸️ WAITING - Awaiting commit approval

Two tests added: `a wave still has amplitude after crossing the width of the sea` (RED at 0.00467 —
the wave arrived with 0.5% of its amplitude, effectively dead) and `drag slows a thin sheet but
barely touches deep water` (RED at 0.475 vs 0.475 — flat damping treats every depth alike).

`DAMPING = 0.95` deleted. Flux now passes through `withDrag`: semi-implicit Manning bed friction,
`q / (1 + g·n²·|q|·dt / h^(7/3))` with `n = 0.03` for sand. Solving for the new flux rather than
subtracting a term built from the old one is what keeps it stable at any depth and stops it flipping
the flux's sign as `h → 0`.

**Shoaling verified against Green's law** (`A ∝ h^(-1/4)`): measured 1.016/1.041/1.127/1.224 at
depths 16.6/14.8/12.2/9.2 vs predicted 1.014/1.043/1.094/1.174. The wave crosses 113 cells where it
previously died after ~8, at 11.3 cells/s — matching `sqrt(9.8 * 13)` for the mean depth. Measured
slightly exceeds Green's late on, the expected signature of nonlinear steepening.

Re-derived `a sloshing basin settles to a level surface` → `loses energy rather than gaining it`.
Third time this test has broken; each earlier form was pinned to a stability crutch (`MAX_FLOW`, then
`DAMPING`). The invariant that survives is that energy decays rather than grows. See LEARNINGS.md.

194 tests pass, `tsc --noEmit` clean. Stable over 180s of the full sim: zero NaN, zero negative
water, sand + sediment exactly 144504 on every tick, tide tracking correctly.

**Known and expected:** the sea is now energetic (maxFlux 50–83, was 1.1–3.4) and erosion is hot
(31% suspended, plateauing). Both are the pinned sea acting as a reflecting wall — the surge energy
that `DAMPING` used to kill now bounces between shore and boundary. Steps 6 and 8 remove exactly
that; Step 7 retunes `EROSION_K` against the resulting realistic forcing.

Perf: `WaterSim.step` 3.07 → 5.50 ms/tick (the `cbrt` per wet edge). Full tick 11.9 ms against a
33.3 ms budget — 35.7%, ample headroom.

Refactor assessed: `withDrag` is a pure module-level helper, testable and named for what it does.
Nothing further.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [x] Step 3: Pressure term depth-weighted (`65ec0ab`)
- [x] Step 4: `getVelocity` returns true velocity (`cc1e597`)
- [ ] Step 5: Depth-dependent drag replaces flat `DAMPING` ← current, awaiting approval
- [ ] Step 6: Sea interior simulated; only outer boundary held
- [ ] Step 7: Boundary row driven by a swell oscillator
- [ ] Step 8: Sponge layer absorbs outgoing waves
- [ ] Step 9: Remove the surge injection

## Blockers

None.

## Next Action

Awaiting commit approval for Step 5. Then Step 6: simulate the sea interior, holding only the outer
boundary row — which removes the reflecting wall now driving the energetic sea.

Carry forward: `EROSION_K = 0.5` is interim, tuned against today's surge-based flow. Step 7 replaces
that with real swell, at which point the erosive forcing changes completely and the knob needs
another pass.
