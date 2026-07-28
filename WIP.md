# WIP: Deep-lake advection instability

## Background

Deep lakes go violently choppy. Instrumented investigation (this session) found
the cause: the self-advection term in `WaterSim.step` uses `vAvg`/`uAvg`, which
are averages of the **flux** arrays (`flowZ`/`flowX`, units m²/s = depth×velocity),
where the advection needs a **velocity** (flux ÷ depth). The term is therefore
over-scaled by ~`edgeDepth`. Harmless in shallow water (flux ≈ velocity); in a
deep lake it is ~20-40× too strong, so once any flow exists the nonlinear term
amplifies instead of transporting. Onset at depth ≈ 22 / CFL ≈ 0.5.

Confirmed causally: dividing the coefficient by `edgeDepth` turned a poke that
blew up 1800× (roughness 0.01 → 18) into a smooth decay at every depth to 40.

The user's uncommitted `DIG_AMOUNT = 10 → 100` lets a single dig reach that
depth, which is why the symptom shows up now.

## Plan

1. RED: deep enclosed lake + one poke → roughness decays, not amplifies. (waterSim.test.ts)
2. GREEN: divide advection coefficient by edgeDepth.
3. Re-derive EROSION_K: the fix shifts the flow field, breaking
   `erosion.test.ts > "a stream cuts a channel..."`. Restore its comparison
   assertion (channel floor vs untouched hillside) without pinning a magnitude.
4. REFACTOR: name the velocity local so flux-vs-velocity is legible at the call site.
5. DOCS: record the bug, the depth-~22/CFL-0.5 threshold, and the DIG_AMOUNT link
   in CLAUDE.md's water-sim section.

## Current step

**Steps 1-4** — stability fix. ✅ DONE, tests green, tsc clean.

- Test `WaterSim deep-water stability > a disturbance in a deep lake dies away
  rather than amplifying` (waterSim.test.ts) added, was RED, now GREEN.
- Fix: advection weights the momentum gradient by `vAvg / max(edgeDepth, 1)`
  (transport velocity, not flux). `max(,1)` leaves thin streams at their stock
  behaviour so channel-cutting is byte-identical, and only attenuates water
  more than a unit deep — the deep-lake regime that was blowing up.
- Comments corrected: `flowX`/`flowZ` are flux, not velocity.
- Erosion channel test still passes (verified the channel stays narrow).

Note: `tools.test.ts` dig tests fail from the uncommitted `DIG_AMOUNT=100` WIP,
unrelated to this change and left untouched.

**Step 5** — CLAUDE.md water-sim note added. ✅ DONE.

Status: ✅ DONE — deep-lake instability fixed, documented, all target tests green.

## Next action

None — this work is complete. (The `DIG_AMOUNT=100` dig-test failures are the
user's separate uncommitted WIP.)
