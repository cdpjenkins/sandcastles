# WIP: Realistic waves and shoreline

## Current Step

Step 7 of 9: A sponge layer absorbs outgoing waves

## Status

⏸️ WAITING - Awaiting commit approval

New `Sponge`: graded absorbing layer over the outermost 12 rows, ramping in quadratically so its own
leading edge is not a discontinuity to reflect off. Damps flux and relaxes the surface toward the
target, both scaled by the same ramp. Wired into `Game` between `WaterSim` and `Erosion`, dirty mask
folded into the combine.

**Reflection 0.516 → 0.035, ~7% coefficient.** Flux damping alone — what PLAN.md specified — only got
to 0.098: it takes the wave's momentum but leaves the surface anomaly to re-radiate. Relaxing both is
the standard formulation and is what reaches the bar.

**The test was measuring its own noise floor at first.** A one-cell bump is a delta function; it
disperses into a ~0.05 background filling the channel, so the 0.05 threshold could never have passed
however good the sponge was. Profiling showed cells far from the sponge reading *identically* with
and without it — the tell. A smooth cos² hump drops the background to ~0.0003 and makes the
reflection unambiguous.

**I was wrong about the erosion ceiling.** I predicted the sponge would not raise it, since
grid-scale noise has near-zero group velocity and never reaches the boundary. It raises it
substantially: `EROSION_K = 0.25` goes from blowing up at 147s to stable past 360s, and 0.5 now only
spikes transiently and recovers. So much of the instability is larger-scale sloshing the sponge
absorbs. Step 9 has more room than feared — likely 0.25, closer to the 0.5 originally chosen.
`EROSION_K` stays at 0.1 here: this step is the sponge, and erosion is Step 9's.

196 tests pass, `tsc --noEmit` clean. Full sim stable over 360s and calmer with the sponge than
without (maxFlux 11.6 → 7.5 → 4.1, vs 20.5 → 8.4 → 7.3).

Refactor assessed: `Sponge` matches the shape of the other sims — dimensions in the constructor,
dirty mask out of `step`. Nothing to restructure.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [x] Step 3: Pressure term depth-weighted (`65ec0ab`)
- [x] Step 4: `getVelocity` returns true velocity (`cc1e597`)
- [x] Step 5: Depth-dependent drag replaces flat `DAMPING` (`edbe95f`)
- [x] Step 6: Sea interior simulated + surge removed (`ff5760e`)
- [ ] Step 7: Sponge layer absorbs outgoing waves ← current, awaiting approval
- [ ] Step 8: Boundary row driven by a swell oscillator (was Step 7)
- [ ] Step 9: Make erosion stable enough to tune, then tune it

## Blockers

None.

## Next Action

Awaiting commit approval for Step 7. Then Step 8: the swell oscillator — the step that finally puts
waves back.

Resolve first (noted in PLAN.md Step 8): the sponge and the driver want the same rows, and a sponge
relaxing toward flat would eat the swell as fast as it is driven. Likely fix is to relax toward the
desired incident wave rather than toward flat, which needs a per-row target instead of the scalar
`Sponge.step` takes today.
