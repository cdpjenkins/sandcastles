# WIP: List the beach's water sources

A source is a cell with a non-zero `grid.source` rate, and nothing in the game
says where they are. Finding them meant reaching into the running game from
the DevTools console (`game.grid.snapshot().source`, since `e449f4c`), which
is a dev-server-only affordance and no use to a player who has lost track of
a spring they dug.

A toolbar button toggling a panel that lists them, alongside the Look panel
and the help overlay.

## Current Step

Step 2: `formatSourceList` renders the list for the panel.

## Status

🟢 GREEN - suite green (374), tsc clean.

## Completed

- [x] Step 1: `getSources` scans the grid for every non-zero source cell,
      reporting the rate rather than assuming `STREAM_RATE`. Scanned rather
      than tracked alongside the layer: five separate paths write `source`,
      so a cached list would have five places to drift.

## Shipped before this

- A console handle on the running game under `npm run dev` (`e449f4c`).
- Export offered on a running game, naming the moment captured
  (`9af657f`..`abf1621`).
