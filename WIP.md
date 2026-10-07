# WIP: List the beach's water sources

A source is a cell with a non-zero `grid.source` rate, and nothing in the game
says where they are. Finding them meant reaching into the running game from
the DevTools console (`game.grid.snapshot().source`, since `e449f4c`), which
is a dev-server-only affordance and no use to a player who has lost track of
a spring they dug.

A toolbar button toggling a panel that lists them, alongside the Look panel
and the help overlay.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (386), tsc clean, production build clean.

## Completed

- [x] Step 1: `getSources` scans the grid for every non-zero source cell,
      reporting the rate rather than assuming `STREAM_RATE`. Scanned rather
      than tracked alongside the layer: five separate paths write `source`,
      so a cached list would have five places to drift.
- [x] Step 2: `formatSourceList` renders it, capped at 20 listed cells with
      the rest counted, and the empty case saying how to dig a source.
- [x] Step 3: a Sources toggle on the toolbar, beside Look and built the
      same way, ungated on pause.
- [x] Step 4: the panel, bottom-right so it misses the Look panel, rescanned
      per frame while open (measured 0.151 ms, 0.9% of a 60fps frame) rather
      than refreshed at the five places that write `source`.
- [x] Step 5: docs. README's controls section and tree, and CLAUDE.md on why
      the list is scanned rather than cached and why the panel's visibility
      stays out of the snapshot.

## Shipped before this

- A console handle on the running game under `npm run dev` (`e449f4c`).
- Export offered on a running game, naming the moment captured
  (`9af657f`..`abf1621`).
