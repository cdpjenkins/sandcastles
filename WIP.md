# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Step 6: `isValidSnapshot` rejects anything it should not load.

## Status

⏸️ WAITING - Step 5 complete, suite green (250), tsc clean.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference
- [x] Step 2: `WaterSim` round-trips `flowX`/`flowZ`
- [x] Step 3: `Tide` round-trips its phase
- [x] Step 4: `Waves` round-trips its phase and countdown
- [x] Step 5: `IsoCamera` round-trips zoom and pan

## Blockers

None.

## Next Action

Step 6: the pure type guard in a new `src/core/GameSnapshot.ts`. Heaviest
test of the change - stale version, wrong dimensions, wrong array lengths,
plain arrays in place of Float32Array, NaN scalars.
