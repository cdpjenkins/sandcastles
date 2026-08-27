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

Step 2: starting a new game restores the beach to a fresh state, after the
player confirms.

## Status

⏸️ WAITING - suite green (343), tsc clean.

## Completed

- [x] Step 1: the toolbar offers New game and fires a handler when clicked.
      Ungated like Import rather than paused-only like Export: a player who
      has dug themselves into a beach they don't want should not have to
      pause before being allowed to start over.
