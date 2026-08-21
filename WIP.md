# WIP: A wetted cell dries out

Once a cell became wet it stayed wet forever. Measured on a draining slope
(no waves): the wetted area never shrank by a cell in 600s, and the residual
film decayed like `1/t` — 1.24e-4 at 600s, heading for `DRY_DEPTH` (1e-6)
somewhere around 20 hours and never reaching exactly zero.

Two causes. `withDrag` divides the flux by `1 + g·n²·|q|·dt / h^(7/3)`, so at
h = 1e-4 the film is glued down by its own bed friction — correct Manning
physics, and it means drainage can never *finish*. And nothing removes water
anywhere: `grid.water`'s only sink is flowing somewhere else.

Then two strict `> 0` tests turn 1e-4 into "fully wet": `TerrainMesh.ts:81`
paints water colour, and `Moisture.ts:26` pins moisture at 1.0 so the sand
never begins to dry. That second one is the visible symptom.

Fix: a thin-film sink. Below a film depth, drain at a constant rate and clamp
to zero — a *linear* sink reaches zero in finite time, which the drainage law
cannot. Gated on depth so the sea and real puddles are untouched. A new
`Drying` class, matching the one-class-per-process shape of `Moisture` and
`Slope`.

Rejected: thresholding `TerrainMesh`/`Moisture` instead, which would make the
display claim dry while the sim still holds water — exactly the disagreement
CLAUDE.md records under the Look panel dash. Fixing it in the sim makes that
dash *correct*.

## Current Step

Step 3: Game runs the drying step

## Status

🟢 GREEN — suite 301, tsc clean

## Completed

- [x] Step 1: `Drying` drains a sub-film-depth column at a constant rate and
      clamps it to zero, marking the cell dirty on any change. Deliberately
      not the siblings' `DIRTY_EPSILON`: the step that takes the last of the
      film to zero is a change of about 1e-4, and it is the one transition
      that must reach the mesh.
- [x] Step 2: a cell that reaches dry settles its stranded sediment into the
      sand. `Erosion` skips anything below `MIN_WATER_TO_ERODE` (1e-5), so
      the film's load would otherwise sit in a dry cell forever.

## Blockers

None.

## Next Action

Write the failing test for step 3 (Game wiring).
