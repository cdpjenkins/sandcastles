# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Step 7: a snapshot survives a structured-clone round trip intact.

## Status

⏸️ WAITING - Step 6 complete, suite green (262), tsc clean.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference
- [x] Step 2: `WaterSim` round-trips `flowX`/`flowZ`
- [x] Step 3: `Tide` round-trips its phase
- [x] Step 4: `Waves` round-trips its phase and countdown
- [x] Step 5: `IsoCamera` round-trips zoom and pan
- [x] Step 6: `isValidSnapshot` rejects anything it should not load

## Blockers

None.

## Next Action

Step 7: round-trip a snapshot through `structuredClone` - the same
algorithm IndexedDB serialises with, so it is the closest thing to a proof
of the storage path that jsdom can give us.
