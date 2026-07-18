# WIP: Realistic waves and shoreline

## Current Step

Step 6 of 9: The sea interior is simulated, and the surge injection goes with it

## Status

⏸️ WAITING - Awaiting commit approval

Test added: `leaves a disturbance in the open sea alone` — RED, the +2 bump was reset straight back
to 13.07 in a single tick.

Only the outermost row is now held, as an open boundary. `SURGE_HEIGHT`, `SURGE_ROWS` and the
injection loop are gone; `seaZ` falls out of `Waves.step`'s signature and `WAVE_SEA_OFFSET` out of
`Game`. `timeUntilWave` / `fired` still tick, so `WaveAudio` and the HUD countdown stay wired — for
two steps that means a wave sound with no wave, until Step 8 gives it a real trigger.

**Two plan changes, both approved, both from things measurement caught:**

1. The surge could not wait for Step 9. The old pin was *deleting* its water every tick; with an open
   sea it destroys everything (maxFlux 373, surface −16 to +26). I first proposed shrinking it and
   was wrong — height 1 merely postpones the blowup to 240s. The sea has no energy sink, so any
   periodic forcing accumulates. PLAN.md reordered: sponge (now Step 7) before swell (now Step 8),
   because the sponge is load-bearing, not polish.

2. `EROSION_K` forced 0.5 → 0.1, overriding the Step 4 choice. Erosion *destabilises the sim*:
   bisected against the open sea, tide/stream/slope are all stable indefinitely and only erosion
   blows up — 0.5 at 122s, 0.25 at 147s, 0.1 stable past 600s. A real threshold, not a slow fuse.
   0.5 is simply not available. See PLAN.md Step 9, whose scope grew accordingly.

Replaced `fast-flowing cell loses a non-negligible amount of sand` with `erodes under moving water
but leaves still water alone`. The magnitude floor needed adjusting twice in two steps — same smell
as the slosh test. A comparison holds at any `EROSION_K` above zero.

194 tests pass, `tsc --noEmit` clean. Verified: full sim stable over 600s (maxFlux 20.5 → 8.4 → 7.3
→ 23.3 → 11.0, oscillating with the tide, not growing); sand + sediment exactly 144504 on every
tick; sea flat and tracking the tide by filling and draining through the boundary (water cycling
174668 ↔ 213767).

Refactor assessed: `Waves` is now purely a boundary condition plus a timer. Nothing to restructure.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [x] Step 3: Pressure term depth-weighted (`65ec0ab`)
- [x] Step 4: `getVelocity` returns true velocity (`cc1e597`)
- [x] Step 5: Depth-dependent drag replaces flat `DAMPING` (`edbe95f`)
- [ ] Step 6: Sea interior simulated + surge removed ← current, awaiting approval
- [ ] Step 7: Sponge layer absorbs outgoing waves (was Step 8)
- [ ] Step 8: Boundary row driven by a swell oscillator (was Step 7)
- [ ] Step 9: Make erosion stable enough to tune, then tune it

## Blockers

None.

## Next Action

Awaiting commit approval for Step 6. Then Step 7: the sponge layer — the energy sink the open sea
needs before any swell can be driven into it.
