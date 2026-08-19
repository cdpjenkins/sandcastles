# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Step 8: `AutoSaver` writes on schedule, and only one write at a time.

## Status

⏸️ WAITING - Step 7 complete, suite green (264), tsc clean.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference
- [x] Step 2: `WaterSim` round-trips `flowX`/`flowZ`
- [x] Step 3: `Tide` round-trips its phase
- [x] Step 4: `Waves` round-trips its phase and countdown
- [x] Step 5: `IsoCamera` round-trips zoom and pan
- [x] Step 6: `isValidSnapshot` rejects anything it should not load
- [x] Step 7: a snapshot survives a structured-clone round trip intact

## Blockers

None.

## Next Action

Step 8: `AutoSaver` against a hand-rolled in-memory store. The real content
is the no-overlap rule - a 2 MiB write can outlast the interval.
