# WIP: Pause the simulation

## Current Step

Step 2 of 5: a paused clock yields no steps and banks no time

## Status

⏸️ WAITING - Step 1 committed, starting Step 2

## Completed

- [x] Step 1: `SimClock` yields the right number of fixed steps
- [ ] Step 2: a paused clock yields no steps and banks no time ← current
- [ ] Step 3: `Game` drives its loop from `SimClock`
- [ ] Step 4: the Toolbar carries a Pause toggle
- [ ] Step 5: `P` and the button pause the game

## Blockers

None.

## Next Action

Write the paused-clock test: many paused frames yield zero steps and no
catch-up burst on resume.
