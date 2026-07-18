# WIP: Realistic waves and shoreline

## Current Step

Step 8 of 9: The boundary row is driven by a swell oscillator

## Status

⏸️ WAITING - Awaiting commit approval

New `swell.test.ts`: the boundary row oscillates, and the swell reaches z=210 — 34 rows clear of the
sponge, so it arrived under its own steam. Both RED (static).

`Waves` now owns a swell profile: `surfaceAt(z, seaSurface)` = `seaSurface + A·sin(ωt + k(z − zB))`,
running shoreward so seaward rows lead in phase. It drives the boundary row from that, and `fired`
now marks one crest per swell period — the real answer to open question 2, so `WaveAudio` and the HUD
countdown mean something again.

The sponge/driver tension resolved as designed: `Sponge.step` takes a per-row target callback rather
than a scalar, and `Game` passes the swell profile. The outer rows now both generate and absorb —
only departures from the wave we asked for get damped, so the swell passes through instead of being
eaten.

**Shoaling verified in the real scene**: wave range nearly doubles as it shallows — 0.701 at depth
13.4 → 0.921 at 6.99 → 1.106 at 4.92 → 1.207 at 2.62. Green's invariant (range · h^0.25) holds at
1.34–1.77 across the whole run.

**Run-up verified**: swash edge swings between z=135 and z=168, a 33-row excursion, tracing
142/150/135/153/149/141/146/137/145/138/157/161 per second. Measured at x=64 — my first attempt
probed x=128 and read the spring, which sits at width/2, not the swash.

199 tests pass, `tsc --noEmit` clean. Stable over 360s with swell at `EROSION_K = 0.1` (maxFlux 12.6
→ 7.0 → 8.3).

**Correction to what I said at Step 7**: the swell takes back the erosion headroom the sponge won.
`0.25` is stable to 360s with the sponge alone, but blows up at 296s once swell drives. `0.1` stands,
and Step 9 needs its mechanism after all.

Refactor assessed: `Waves` is a swell profile + boundary driver + crest timer; `Sponge` is unchanged
but for the target callback. Nothing to restructure.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [x] Step 3: Pressure term depth-weighted (`65ec0ab`)
- [x] Step 4: `getVelocity` returns true velocity (`cc1e597`)
- [x] Step 5: Depth-dependent drag replaces flat `DAMPING` (`edbe95f`)
- [x] Step 6: Sea interior simulated + surge removed (`ff5760e`)
- [x] Step 7: Sponge layer absorbs outgoing waves (`e1efa43`)
- [ ] Step 8: Boundary row driven by a swell oscillator ← current, awaiting approval
- [ ] Step 9: Make erosion stable enough to tune, then tune it

## Blockers

None.

## Next Action

Awaiting commit approval for Step 8. Then Step 9: give erosion a stability mechanism, then tune it.

Also outstanding before the feature closes: README's "Waves (M6)" section still describes the
20-second 10-unit surge, which no longer exists.
