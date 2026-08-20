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
keep their locals and are deliberately not migrated. One exception followed
later: `Erosion`'s `surfaceSlope` had no locals to keep, so it was migrated
in `5d97987`.

## Current Step

None - work complete and verified.

## Status

✅ DONE - suite green (294), tsc clean, build clean, and confirmed in the
browser on 2026-08-20.

## Completed

- [x] Step 1: `Grid.getWaterSurfaceHeight` returns bed + water as an elevation
- [x] Step 2: `getLookInfo` reports the water surface elevation
- [x] Step 3: the panel prints `Water top`, with `Bed`/`Depth` for the two
      labels that used to sound like it
- [x] Verified by hovering the wet sand. Confirmed as agreed: the dash fires
      on exact zero rather than an epsilon, so a cell holding the swash's
      residual film (~1e-6) reads `Depth 0.00  Water top 4.00` and not a
      dash. Intended behaviour, but the first thing that will look like a
      defect to anyone reading it fresh.

Separately (behaviour-preserving, no browser check needed) — all three
verified bit-exact against the same 400-step golden master:

- [x] `Erosion` holds its three scratch buffers instead of allocating them
      every step (`b96adbd`). Removes ~23 MB/s of garbage at 30 Hz.
- [x] `Grid.getWaterSurfaceHeight` computes its index once (`d1d5fc9`)
- [x] `Erosion.surfaceSlope` reads the named accessor (`5d97987`). The swap
      alone cost ~3.7%; with `d1d5fc9` it lands at ~2.93 ms/step against a
      ~2.99 baseline.

## Blockers

None.

## Next Action

Nothing outstanding. Every browser check is done: the Look panel reading,
the `D` selects Dump check carried over from earlier work, and the
persistence work (discard-and-revisit restores the beach exactly).

Ready for the next piece of work to overwrite this file.
