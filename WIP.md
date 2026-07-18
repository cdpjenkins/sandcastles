# WIP: Realistic waves and shoreline

## Current Step

Step 9 of 9: Make erosion stable enough to tune, then tune it

## Status

⏸️ WAITING - Awaiting commit approval

`MAX_BED_RATE = 0.3` units/s caps how far erosion or deposition may move the bed per step. Two tests,
both stated as comparisons so they hold at any `EROSION_K`: the bed drop saturates rather than
scaling with velocity (RED at 0.0166 vs 0.0332 — exactly double), and the same for deposition.

**`EROSION_K` restored to 0.5** — the value chosen at Step 4, forced down to 0.1 at Step 6. It now
delivers 6.8% suspended at 120s against the 6.9% it was picked for. Stability is decoupled from it:
sea error 1.36 / 1.24 / 1.20 at 0.5 / 2.0 / 5.0, all intact, erosion still scaling 9.1% / 23.8% /
33.8%.

**Three wrong hypotheses before the diagnosis.** Grid-scale noise (Step 6) — refuted by the sponge
helping, since grid noise never reaches a boundary. Sea sloshing — refuted by measurement: all 98
high-flux cells were on the *beach* at z < 179, sign-coherent rather than checkerboard. It was the
stream incising its channel. `maxFlux > 100` was also a bad failure proxy: a fast stream in a gorge
is not a blowup. The criterion that discriminates is whether the sea departs from where the swell
says it should be.

200 tests pass, `tsc --noEmit` clean. Sand + sediment exactly 144504 on every tick across 300s;
suspension plateaus ~7.2% (150–240s), oscillating with the tide.

**One acceptance criterion is NOT met**: crests do not refract. The physics is there and verified
(`c = √(g·h)`), but `Waves.surfaceAt(z)` has no `x` term, so swell arrives already shore-parallel and
there is nothing to bend. Needs oblique swell — an `x` term in the phase, and a per-cell sponge target
rather than per-row. A small step 10, not a gap in the model.

Refactor assessed: `Math.min(..., MAX_BED_RATE * dt)` appears in both branches, which is the point —
the cap applies either way. Nothing to restructure.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [x] Step 3: Pressure term depth-weighted (`65ec0ab`)
- [x] Step 4: `getVelocity` returns true velocity (`cc1e597`)
- [x] Step 5: Depth-dependent drag replaces flat `DAMPING` (`edbe95f`)
- [x] Step 6: Sea interior simulated + surge removed (`ff5760e`)
- [x] Step 7: Sponge layer absorbs outgoing waves (`e1efa43`)
- [x] Step 8: Boundary row driven by a swell oscillator (`e4acbd4`)
- [ ] Step 9: Make erosion stable enough to tune, then tune it ← current, awaiting approval

## Blockers

None.

## Next Action

Awaiting commit approval for Step 9 — the last planned step.

Then, to close the feature out (planning skill, end-of-feature):
- Refraction is unmet; decide whether oblique swell is worth a step 10.
- README's "Waves (M6)" still describes the 20s/10-unit surge, which no longer exists, and the
  architecture list has no `Sponge.ts`.
- Merge LEARNINGS.md into CLAUDE.md / an ADR, then delete PLAN.md, WIP.md, LEARNINGS.md. Note
  LEARNINGS.md still carries a stale Look-tool section predating this work, with an unmerged
  isoProjection decision in it.
