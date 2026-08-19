# WIP: survive a browser-initiated restart

Chrome discards backgrounded tabs under memory pressure and reloads the page
from scratch, losing the whole beach. The app has no persistence of any kind.
Adding silent autosave to IndexedDB plus exact restore on load.

Full plan: `PLAN.md`.

## Current Step

Step 3: `Tide` round-trips its phase.

## Status

⏸️ WAITING - Step 2 complete, suite green (245), tsc clean.

## Completed

- [x] Step 1: `Grid` round-trips its six arrays, by copy not by reference
- [x] Step 2: `WaterSim` round-trips `flowX`/`flowZ`

## Blockers

None.

## Next Action

Step 3: snapshot/restore `Tide.elapsed`, so the sea does not teleport on
resume.
