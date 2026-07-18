# WIP: Realistic waves and shoreline

## Current Step

Step 2 of 9: The flux limit becomes a velocity limit

## Status

⏸️ WAITING - Awaiting commit approval

Two tests added to `waterSim.test.ts`: the flux ceiling scales with depth rather than a fixed cap,
and a thin sheet cannot develop a large flux however big the drop. Both RED at exactly `4` — the
fixed cap pinning deep and shallow water to the identical flux.

`MAX_FLOW = 4.0` replaced by `MAX_VELOCITY = 8.0`; each edge now clamps to
`MAX_VELOCITY * edgeDepth`, where `edgeDepth` is the mean of the two cell depths. Expressing the
ceiling as a multiplication rather than dividing flux by depth means the `h → 0` guard PLAN.md asked
for comes free: a dry edge gets a ceiling of 0.

`flow does not overshoot into a strong reversal while settling` broke (−3.79 vs its −1.4 threshold).
PLAN.md predicted this for Step 5; it came due at Step 2 because `MAX_FLOW` was suppressing the
slosh too. Verified the underlying behaviour first: 300 steps decay monotonically to 2.000/2.000
with volume drift 1.19e-6, so the cap was truncating a *real* oscillation (natural peak ~8.9), not
masking an instability. Re-derived the test to assert the basin settles.

190 tests pass, `tsc --noEmit` clean. Verified in the full sim loop (water + erosion + moisture +
slope + waves + tide) over 60s: no NaN, no negative water, sea flat, maxFlux 1.7–3.4.

Refactor assessed: named `edgeDepth` in both branches, so the limiter reads as "max flux is velocity
× depth" and Step 3 has the quantity it needs for the pressure term. The x/z branch duplication is
pre-existing and out of scope.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [ ] Step 2: Flux limit becomes a velocity limit ← current, awaiting approval
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

Awaiting commit approval for Step 2. Then Step 3: depth-weight the pressure term — the core change,
where Step 2's headroom actually gets used.
