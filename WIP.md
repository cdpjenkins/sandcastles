# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Browser verification (steps 11-12).

## Status

🟢 GREEN - all 12 steps written, suite green (278), tsc clean, build clean.
Awaiting browser verification.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference
- [x] Step 2: `WaterSim` round-trips `flowX`/`flowZ`
- [x] Step 3: `Tide` round-trips its phase
- [x] Step 4: `Waves` round-trips its phase and countdown
- [x] Step 5: `IsoCamera` round-trips zoom and pan
- [x] Step 6: `isValidSnapshot` rejects anything it should not load
- [x] Step 7: a snapshot survives a structured-clone round trip intact
- [x] Step 8: `AutoSaver` writes on schedule, one write at a time
- [x] Step 9: `loadSnapshot` turns a hostile store into `GameSnapshot | null`
- [x] Step 10: `IndexedDbSnapshotStore` (untested wiring, by necessity)
- [x] Step 11: `Game` restores from a snapshot and drives an `AutoSaver`
- [x] Step 12: lifecycle events trigger a save

## Blockers

None.

## Next Action

Verify in the browser per PLAN.md: a save appears in IndexedDB within ~5s,
a reload restores the beach without the sea lurching, chrome://discards
Discard then revisit restores exactly, and a corrupted record falls back to
a fresh beach.
