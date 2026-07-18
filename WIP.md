# WIP: Realistic waves and shoreline

## Current Step

Step 4 of 9: `getVelocity` returns true velocity rather than flux

## Status

⏸️ WAITING - Awaiting commit approval

Two tests added: `a shallower cell reports a higher velocity for the same flux` (RED at 0.475 vs
0.475) and `a thin sheet scours more than a deep pool carrying the same flux` (verified RED against
the old code by stashing WaterSim.ts — 0.0396 vs 0.0396).

`getVelocity` now returns `meanFlux / depth`, clamped to `MAX_VELOCITY`. The clamp is needed because
at a wetting front the flux belongs to an edge shared with a far deeper neighbour, so dividing by
this cell's depth overshot to 130.9 where the solver permits 8. Now p100 = 8.000 exactly, zero cells
above it.

**Plan deviation, approved:** `EROSION_K` recalibrated 2.5 → 0.5. Step 4 changed the *units* of what
`Erosion` is fed, so the constant scaling it was silently invalidated: at 2.5 the beach dissolved to
31.5% suspended in 2 minutes. Note my first instinct — match Step 3's 99% equilibrium — was wrong:
under flux-as-velocity the beach's p50 velocity was 0.000 and the only fast water was in the
sand-free sea, so that equilibrium *was* "erosion barely happening". Reproducing it would have
defeated the step. See LEARNINGS.md. User chose 0.5 (6.9% suspended at 120s) from measured options;
final tuning deferred to after Step 7, when real waves make the forcing realistic.

Merged `fast-flowing cell loses sand over time` and `fast-flowing cell loses more than a fifth...` —
identical scenes differing only in threshold, and the tighter one pinned `EROSION_K` to 2.5. Now one
test with a loose floor (< 4.95) that catches erosion being off without locking the knob.

192 tests pass, `tsc --noEmit` clean. Mass conservation verified exact: sand + sediment = 144504 on
every tick across 120s.

Refactor assessed: dropped a provenance comment on `EROSION_K` (belongs in the commit message);
trimmed the clamp comment to the constraint it needs to state.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [x] Step 3: Pressure term depth-weighted (`65ec0ab`)
- [ ] Step 4: `getVelocity` returns true velocity ← current, awaiting approval
- [ ] Step 5: Depth-dependent drag replaces flat `DAMPING`
- [ ] Step 6: Sea interior simulated; only outer boundary held
- [ ] Step 7: Boundary row driven by a swell oscillator
- [ ] Step 8: Sponge layer absorbs outgoing waves
- [ ] Step 9: Remove the surge injection

## Blockers

None.

## Next Action

Awaiting commit approval for Step 4. Then Step 5: Manning drag replaces the flat `DAMPING` — the
step that finally makes Steps 3–5 visible, since waves still die in ~1s.

Carry into Step 5: `EROSION_K = 0.5` is interim, tuned against today's surge-based flow. Step 7
replaces that with real swell, at which point the erosive forcing changes completely and the knob
needs another pass.
