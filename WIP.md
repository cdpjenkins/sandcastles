# WIP: Inland lakes amplify their own waves

Reported: waves in inland lakes get far too strong, worst when a lake starts
spilling, until water breaks out of the far side too.

Two independent causes, both now fixed.

## 1. The shoreline edge conducted the wrong depth — DONE (7ca32b3, 3187e3c)

`WaterSim.step` used `edgeDepth = (wi + wj) / 2`, the mean of the two cells'
water columns, as the depth the edge conducts. That is only the connecting
depth on a flat bed; wherever the bed steps up it overstates it badly. A sill
carrying 1 unit of head beside a 10-deep lake read as 5.0.

Fixed by `conductingDepth` — the mean of the columns standing above the sill.
Identical on a flat bed. Halved the breach shock (max surface range 1.95 ->
0.94 at depth 20) and stopped peak flux scaling with the lake behind the rim.

## 2. Erosion phase-locked to the seiche — DONE (8c3f2eb)

The larger amplifier. `capacity = velocity * EROSION_K * slope` had no floor,
and in a standing wave velocity and slope are in phase with each other, so the
bed was scoured at the nodes and the load dropped at the antinodes. Since the
surface is bed + water, that bed movement went straight into wave amplitude.

Closed basin, no outflow, 10 deep, 0.1 tilt: grew to 7.1 in 90s, bed stripped
8000 -> 24, water volume exactly conserved.

Fixed with `CRITICAL_POWER`, a threshold of motion. The closed lake is now
byte-identical to running with erosion off, bed untouched, phase correlation
exactly 0.000. A breached lake is bounded and stable (0.67 against 0.50 with
erosion off) instead of growing past 1.75 and overtopping.

Four alternatives measured and rejected; all recorded in CLAUDE.md so they are
not retried. The swash/castle discrimination that makes the threshold safe is
recorded there too — check the castle scene, not flat beach, before touching
`CRITICAL_POWER`.

## Status

Both fixes committed, 217 tests green, tsc clean.

`tools.test.ts` has 2 failures from the uncommitted `DIG_AMOUNT = 100` local
edit — unrelated, present before this work started, left untouched.

Probe kept at `scratchpad/lakeProbe.test.ts`.

## Next action

None — the reported bug is fixed on both fronts.

The capacity/concentration "mismatch" was investigated and closed: it is a
deliberate fork, not a bug. Comparing in concentration is algebraically the
same as a discharge-based capacity, and no `EROSION_K` forms a channel under
that law. CLAUDE.md now records the algebra and the sweep so it is not
re-attempted.

One thing noticed and deliberately not done: `WaterSim.step`'s x-edge and
z-edge blocks are ~20 near-identical lines. Pre-existing, and it is a hot loop,
so extraction needs a benchmark first.
