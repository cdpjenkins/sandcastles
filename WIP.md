# WIP: Realistic waves and shoreline

## Current Step

Step 10: The swell arrives at an angle, so it can refract

## Status

⏸️ WAITING - Awaiting commit approval

`SWELL_ANGLE = 30°` and an `x` term in the swell phase; `Sponge.step`'s target callback goes per-cell.
Test asserts the angle closes shoreward — RMS(flowX)/RMS(flowZ) is the tangent of the wave's angle
off the shore-normal.

**Refraction works, but only after the period came down.** At 5s the wavelength was `c·T` = 70 cells
against a 56-row sea — under one — and Snell, which assumes depth varies slowly over a wavelength,
simply did not apply: 29.8° → 27.3° where it wanted 30° → 16.3°. At 2s (28-cell wavelength) it works:
32.5° → 19.1° vs Snell's 32.5° → 16.7°. Cost: waves every 2s, so audio and HUD fire 2.5x as often.
User chose that over losing refraction.

Angle is unmeasurable inside ~z=210: the surf zone and the beach's x-roughness swamp it, and a
zero-angle control still reads 7° there. Test probes z=240 and z=210, both seaward of it.

201 tests pass, `tsc --noEmit` clean. Stable at the shipping config: sea error 1.76, no NaN, sand
91.5%. Perf 11.26 ms/tick, 33.8% of the 30 Hz budget.

**A NaN scare that was my own probe.** A scratch stability probe still called the old two-argument
`surfaceAt`, reporting 2.2M NaN cells. The tell was that all four period/angle configs returned
*identical* numbers — including one that had shipped green. Identical output from different inputs
means you are measuring the harness.

Refactor assessed: `angleTangentsAt` measures both rows in one run — two sims blew the 5s test
timeout. Suite is now 9.1s (was 2.4s); the refraction test needs the real 256×256 geometry, since a
smaller grid has no room for a wavelength.

## Completed

- [x] Step 1: Sea held at constant elevation, not constant depth (`c8c4f5b`)
- [x] Step 2: Flux limit becomes a velocity limit (`a46e80b`)
- [x] Step 3: Pressure term depth-weighted (`65ec0ab`)
- [x] Step 4: `getVelocity` returns true velocity (`cc1e597`)
- [x] Step 5: Depth-dependent drag replaces flat `DAMPING` (`edbe95f`)
- [x] Step 6: Sea interior simulated + surge removed (`ff5760e`)
- [x] Step 7: Sponge layer absorbs outgoing waves (`e1efa43`)
- [x] Step 8: Boundary row driven by a swell oscillator (`e4acbd4`)
- [x] Step 9: Make erosion stable enough to tune, then tune it (`a5893da`)
- [ ] Step 10: Oblique swell, so it can refract ← current, awaiting approval

## Blockers

None.

## Next Action

Awaiting commit approval for Step 10. Then Step 11: wire moisture into the angle of repose.

`Slope` uses a flat 20° regardless of wetness, and clamps every wall near the stream to exactly that
(measured: steepest wall 20.8°, and 52.2° with `Slope` off). Real dry sand holds ~34° and wet sand far
steeper — which is why sandcastles stand up. The sim already tracks moisture; it is simply not wired
to `Slope`.
