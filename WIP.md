# WIP: Shoreline edge conducts the wrong depth

## Background

Inland lakes amplify their waves, worst when one starts spilling. Instrumented
investigation (this session) found two independent causes. This WIP covers the
first; the second (erosion phase-locking to the seiche) is still open.

`WaterSim.step` uses `edgeDepth = (wi + wj) / 2` — the mean of the two cells'
**water columns** — as the depth the edge between them conducts. That is only
the connecting depth when the bed is flat between the two cells. Wherever the
bed steps up (a lake rim, a sill, a breach) the mean overstates it badly:
measured at the moment of breach, a sill carrying 1 unit of head next to a
10-deep lake got `edgeDepth = 5.0`, five times the real conducting depth.

Three consequences, all pushing the same way:

- the drive `g * edgeDepth * dh` runs 5x too strong
- the ceiling `MAX_VELOCITY * edgeDepth` lifts by the same factor, so the
  velocity limiter cannot bite — water entered the rim cell at 30 cells/s,
  ~4x `MAX_VELOCITY`, CFL ~ 1
- `withDrag` gets h=5 instead of h~1, and drag is proportional to 1/h^(7/3),
  so friction is ~40x too weak exactly at the shallow spill where it should
  dominate

Same bug class as the two already in CLAUDE.md: a value read as the wrong
physical quantity.

Confirmed causally: hydrostatic reconstruction halved the breach shock (max
surface range 1.95 -> 0.94 at depth 20). It does **not** stop the growth — that
is the erosion feedback, tracked separately.

## Plan

1. RED: two lakes of different depth behind the same sill, same head over the
   sill, drive the same flow. (waterSim.test.ts)
2. RED: water perched above a lake drains at its own depth, not the lake's.
3. GREEN: `bFace = max(bi, bj)`, `edgeDepth = (max(0, hi - bFace) +
   max(0, hj - bFace)) / 2`. Identical to the current formula on a flat bed,
   so flat-bed behaviour is preserved exactly.
4. REFACTOR: assess.
5. DOCS: record in CLAUDE.md's water-sim section.

## Current step

**Steps 1-4** — conducting-depth fix. ✅ DONE, tests green, tsc clean.

- Two tests added to `waterSim.test.ts` under `WaterSim sill conductance`:
  the flow over a sill is set by the head above it, not the lake behind it;
  and water perched above a lake drains at its own depth. Both verified RED
  against the old formula (4.90 vs 1.63; puddle drained to 1.5e-9).
- Fix: `conductingDepth(surfaceI, bedI, surfaceJ, bedJ)` — the mean of the two
  columns standing above the sill. Byte-identical on a flat bed, so every
  existing flat-bed test and the erosion channel test are untouched.
- Measured effect: breach shock at depth 20 halved (max surface range
  1.95 -> 0.94); peak flux in a spilling lake no longer scales with the lake's
  depth (was 12.5/18.0/26.3 at depths 5/10/20, now ~11.5 flat).

**Step 5** — CLAUDE.md water-sim note. 🔴 TODO.

Note: `tools.test.ts` dig tests fail from the uncommitted `DIG_AMOUNT=100` WIP,
unrelated to this change and left untouched (2 failures before and after).

## Still open: erosion phase-locks to the seiche

The larger amplifier is untouched by this fix. `capacity = velocity *
EROSION_K * surfaceSlope`, and in a standing wave velocity and slope are in
phase with each other — both peak at the nodes, both vanish at the antinodes.
So the bed is scoured at the nodes and the sediment deposited at the antinodes,
and since `H = b + w` with `w` held fixed while the bed moves, every bed
movement transfers one-for-one into surface elevation. Deposit at an antinode
literally raises the crest.

Measured in a **closed** basin (no outflow, no wet/dry front), 10 deep, kicked
with a 0.1 tilt: erosion off decays 0.097 -> 0.028; erosion on grows
0.099 -> 7.106 in 90s. Water volume exactly conserved (15998.0 -> 15998.0), bed
flat -> +/-4 corrugation, correlation `sum(dBed * surfaceAnomaly) = +31.6`.

Probe kept at `scratchpad/lakeProbe.test.ts`.

Likely direction: drive capacity from a time-averaged velocity rather than the
instantaneous one. A seiche's mean velocity is ~zero; a stream's is not, so
that should kill the pump while leaving channel-cutting untouched. `MAX_BED_RATE`
bounds the rate but not the feedback.

## Next action

Step 5: add the CLAUDE.md note for the conducting-depth fix.
