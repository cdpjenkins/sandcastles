# WIP: Look view shows the absolute water surface elevation

The Look panel shows the bed elevation (labelled `Surface`) and the water
*column* (labelled `Water`), but never the elevation of the water's top —
the number `TerrainMesh` writes as the mesh y. Adding it, and renaming the
two labels that currently sound like it.

Agreed shape:

```
Cell (5, 9)
Sand 3.00  Rock 1.00  Bed 4.00
Depth 0.75  Water top 4.75
Moisture 60%
Sediment 0.20  Source 2.50
Flow 1.40 ↘
```

Dry cells print `Water top —`. No tide or swell reference, so `getLookInfo`
keeps its `Grid` + `WaterSim` dependencies. `bed + water` becomes a named
`Grid` accessor rather than a seventh open-coded site — the sim call sites
keep their locals and are deliberately not migrated.

## Current Step

None - work complete, pending a look in the browser.

## Status

✅ DONE - suite green (294), tsc clean, build clean.

## Completed

- [x] Step 1: `Grid.getWaterSurfaceHeight` returns bed + water as an elevation
- [x] Step 2: `getLookInfo` reports the water surface elevation
- [x] Step 3: the panel prints `Water top`, with `Bed`/`Depth` for the two
      labels that used to sound like it

## Blockers

None.

## Next Action

Hover the wet sand in the browser and confirm the reading. Note the dash
fires on exact zero, not an epsilon: cells holding the swash's residual
film (~1e-6) will read `Depth 0.00  Water top 4.00` rather than a dash.
That is the agreed behaviour, not a defect - but it is the first thing
that will look like one.

Still owed from earlier work: the browser check that `D` selects Dump and
keeps selecting Dump when pressed again, including from Stream mode.
