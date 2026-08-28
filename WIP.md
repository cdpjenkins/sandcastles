# WIP: Export a running game

Export is offered only on a paused game, so saving a beach means pausing
first. The gate was believed to be about coherence — "the export is the beach
the player can see" — but it is not buying that:

- The whole export path (`takeSnapshot` -> `toGameFile` -> `JSON.stringify` ->
  `downloadJson`) is synchronous, with no `await` anywhere. A click handler
  runs to completion before the next `requestAnimationFrame`, so `simStep`
  cannot interleave with it.
- Every `snapshot()` copies its layers with `.slice()`.
- `AutoSaver` already snapshots a *running* game every 5s through the same
  `takeSnapshot()`. If that were unsafe, autosave would have been corrupting
  saves since it shipped.

So a running export already yields a coherent single-frame snapshot. Removing
the gate, and saying in the status which moment was captured.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (368), tsc clean, production build clean.

## Completed

- [x] Step 1: Export is offered whether the game is running or paused. The
      two tests asserting the gate were replaced rather than left, since
      they described the belief the gate was based on.
- [x] Step 2: `exportStatus` names the moment captured as well as the file,
      since a running beach has moved on by the time the file lands. Local
      clock rather than the filename's UTC, because it is read at a glance
      against a running sim. The first test written for it asserted a UTC
      time and would have passed or failed on the runner's timezone.
- [x] Step 3: docs. README and CLAUDE.md both recorded the gate as settled
      behaviour, and CLAUDE.md's "an import arrives paused" note was
      materially wrong once a file could carry `paused: false`.

## Shipped before this

- A menu option to start a new game (`89a274d`..`5510c69`), and the same
  testable-confirmation treatment for import (`2e7aeb7`).
- A gentler swell so a shoreline castle weathers rather than dissolves
  (`966ac94`), with the castle/refraction trade-off recorded (`c3ad8eb`).
