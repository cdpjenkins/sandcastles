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

Step 2: `getLookInfo` reports the water surface elevation

## Status

⏸️ WAITING

## Completed

- [x] Step 1: `Grid.getWaterSurfaceHeight` returns bed + water as an elevation

## Blockers

None.

## Next Action

Write the failing test for `LookInfo.waterSurfaceHeight`.
