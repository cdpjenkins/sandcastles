# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Step 5: `IsoCamera` round-trips zoom and pan.

## Status

⏸️ WAITING - Steps 3-4 complete, suite green (249), tsc clean.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference
- [x] Step 2: `WaterSim` round-trips `flowX`/`flowZ`
- [x] Step 3: `Tide` round-trips its phase
- [x] Step 4: `Waves` round-trips its phase and countdown

## Blockers

None.

## Next Action

Step 5: keep the canvas as a field on `IsoCamera` so `restore` can refresh
the frustum, then snapshot/restore zoom and pan.
