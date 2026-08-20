# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

None - work complete.

## Status

✅ DONE - suite green (289), tsc clean, build clean, and verified in the
browser on 2026-08-20: chrome://discards Discard-then-revisit restores the
beach exactly, the sea does not lurch, and every corruption case falls back
to a fresh beach.

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
- [x] Extra: IndexedDB adapter brought under test; found and fixed a
      versionchange defect that blocked a second tab
- [x] Extra: `createSnapshot` seam so a game-produced snapshot is proven
      loadable

## Blockers

None.

## Next Action

Nothing outstanding on this work. Learnings are recorded in CLAUDE.md under
"Persisting the game".

Still owed from the previous piece of work, which this overwrote: the
browser check that `D` selects Dump and keeps selecting Dump when pressed
again, including from Stream mode.
