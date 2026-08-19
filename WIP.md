# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Step 2: `WaterSim` round-trips its flow field.

## Status

⏸️ WAITING - Step 1 complete, suite green (243), tsc clean.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference

## Blockers

None.

## Next Action

Step 2: snapshot/restore `flowX` and `flowZ` on `WaterSim`, excluding the
derived `velocityArr` and the scratch `dirty` mask.
