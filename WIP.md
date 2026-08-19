# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Step 9: `loadSnapshot` turns a hostile store into `GameSnapshot | null`.

## Status

⏸️ WAITING - Step 8 complete, suite green (274), tsc clean.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference
- [x] Step 2: `WaterSim` round-trips `flowX`/`flowZ`
- [x] Step 3: `Tide` round-trips its phase
- [x] Step 4: `Waves` round-trips its phase and countdown
- [x] Step 5: `IsoCamera` round-trips zoom and pan
- [x] Step 6: `isValidSnapshot` rejects anything it should not load
- [x] Step 7: a snapshot survives a structured-clone round trip intact
- [x] Step 8: `AutoSaver` writes on schedule, one write at a time

## Blockers

None.

## Next Action

Step 9: `loadSnapshot` - catch everything `store.load()` can do, run the
guard, hand back null so a bad save means a fresh beach rather than a
broken page.
