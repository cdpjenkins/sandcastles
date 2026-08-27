# WIP: A menu option to start a new game

The toolbar can export and import a beach but cannot start a fresh one: a
player who has dug their beach into a state they don't want has no way back
short of clearing site data. Adding a "New game" button that confirms first,
because it destroys the current beach and the next autosave overwrites the
stored one.

Reusing the snapshot restore path rather than adding a `reset()` to each of
Grid, Waves, Tide, WaterSim, Bucket and IsoCamera: `applySnapshot` already
puts every one of those back to a given state, and a fresh game is just a
particular state. That also keeps the set-vs-add trap recorded in CLAUDE.md
from reopening on a third path.

## Current Step

Step 3: Game confirms with the player, then starts the new game.

## Status

⏸️ WAITING - suite green (351), tsc clean.

## Completed

- [x] Step 1: the toolbar offers New game and fires a handler when clicked.
      Ungated like Import rather than paused-only like Export: a player who
      has dug themselves into a beach they don't want should not have to
      pause before being allowed to start over.
- [x] Step 2: `newGameSnapshot` describes an undug beach and `startNewGame`
      lays it over the components. Built from real components rather than a
      literal, so it cannot drift from what a first boot produces. The camera
      is exempt: the new beach is the same world, so moving the view would
      read as a lost position rather than a new game. `STREAM_RATE` moved to
      `Grid` (a property of the beach's layout) and `DEFAULT_CAMERA` out of
      `IsoCamera`, so neither is duplicated.
