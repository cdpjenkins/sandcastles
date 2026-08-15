# WIP: Pause the simulation

## Current Step

Step 3 of 5: `Game` drives its loop from `SimClock`

## Status

⏸️ WAITING - Step 2 committed, starting Step 3

## Completed

- [x] Step 1: `SimClock` yields the right number of fixed steps
- [x] Step 2: a paused clock yields no steps and banks no time
- [ ] Step 3: `Game` drives its loop from `SimClock` ← current
- [ ] Step 4: the Toolbar carries a Pause toggle
- [ ] Step 5: `P` and the button pause the game

## Blockers

None.

## Next Action

Swap Game's inline accumulator for SimClock, still always unpaused.
