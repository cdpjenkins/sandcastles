# Plan: a seeded beach places its spring where it reaches the sea

## Context

Every beach's spring is at top-centre (`Grid.initSpring`). On the classic beach
that works: the stream reaches the sea at 185s. On seeded beaches it often does
not, because the seed changes the land around a spring that never moves. In the
50-seed sweep behind the beach seeds, only 17 of 50 streams reached the sea
inside 300s; the rest filled a hollow and stayed there.

This plan places a seeded beach's spring where its water will reach the sea.
The classic beach keeps its spring exactly where it is.

### Decisions taken up front

- **Classic is untouched.** `null` still calls `initSpring`. The placement rule
  would move classic's spring too (top-centre scores 28, and plenty of
  top-row spots score 0), and classic is the beach everything was tuned on.
- **Where no top-row spot works, the spring moves down the ridge.** It goes to
  the highest spot whose water reaches the sea, even when that is far down: on
  s46 that is row 135 of 199, so a short stream. Every beach gets a stream that
  arrives. Keeping it high and accepting a pond was the alternative, rejected.
- **Existing seeds change, and that is accepted.** A seed now grows its spring
  somewhere new, so *Restart this beach* on a seeded save made before this, or a
  seed shared before this, gives a different spring. Seeds shipped on
  2026-10-15, so only the developer's own saves are affected. A saved beach still
  loads unchanged - `source` is stored - and there is no generator version and
  no snapshot bump.
- **The spring's choice among equally good spots has its own sub-seed**,
  `seedFromText(seed + ':spring')`, so drawing a spring position consumes nothing
  the rock and sand noise depend on.

### What was measured before planning

All with a scratch probe over the 50 sweep seeds `s1`..`s50` plus classic.

**A static score predicts arrival.** The score is the volume of hollows a spring's
water must fill before it can spill to the sea, read off the terrain alone with
a priority flood - no sim. Against the sweep's 300s arrival times, spring at
top-centre:

| fill volume | reached the sea inside 300s |
|---|---|
| under 70 | 14 of 14 (classic, at 28, included) |
| 130 or more | 4 of 33 |

The four that beat it had more to fill than 240s of spring could supply, so they
found a shorter way - most likely eroding through a hollow's lip. The score is
conservative, which is the safe direction for placing a spring: a low score has
never failed. The gap between 67 (arrived) and 133 (did not) is where the
budget sits; 70 is its known-good edge.

The first version of the score counted any wet cell as the sea, and missed five
seeds whose springs drained into an inland pool lying below sea level - boot
water that is a lake, not the sea. Only water joined to the sea rows counts.

**Every beach has a spot under budget, but a third need it lower on the ridge.**
34 of 51 have one on the top row; the other 17 find their highest at rows 17 to
135 (seaStart is 199).

**One pass is fast enough; a search is not.** Flooding from each candidate took
3s on the worst seeds, which would freeze the click on Start. A single priority
flood from the sea scores every cell at once (below), in at most 71ms, and gave
the same under-70 verdict as the per-candidate search at all 3,162 top-row spots
tested.

## Design

### `fillCost(grid)` - the score for every cell

`src/core/SpringSite.ts`. Returns a `Float32Array` of cell scores.

1. **The sea:** the rows from `seaStart` down, plus any water joined to them. An
   inland pool is not the sea, however low it lies.
2. **Fill:** a priority flood inward from the sea over `rock + sand`. Each cell
   records its fill level (the lowest level water there could drain at) and its
   parent (the cell it was reached from). Following parents is a cell's route
   to the sea.
3. **Hollows:** 4-connected cells standing below their fill level, each with the
   volume `fill - surface` summed over it.
4. **Score:** in flood order, a cell's score is its parent's plus the volume of
   any hollow it enters on the way - so a spring pays once for every hollow on
   its route.

### `springSite(grid, seed)` - where the spring goes

- **Candidates:** land cells (`z < seaStart`), away from the side walls
  (`SPRING_SIDE_MARGIN` cells), scoring at most `MAX_SPRING_FILL = 70`.
- **Highest first:** of those, the ones within a few rows of the highest
  candidate (`SPRING_ROW_BAND`), so the stream is as long as the beach allows.
- **The seed picks among them**, through a small seeded generator (mulberry32)
  on the `':spring'` sub-seed. Deterministic: the same seed, the same spot.
- **Fallback:** if no cell is under budget - it never happened across 51 beaches,
  but the terrain is unbounded - take the lowest-scoring candidate.

`MAX_SPRING_FILL` is coupled to `STREAM_RATE` and to the world's unit scale: it
is roughly "70 seconds of spring", and it was measured, not chosen.

### Where it hooks in

`newGameSnapshot`: classic calls `initSpring` as now; a seed calls
`springSite` and sets that cell's source to `STREAM_RATE`. Boot, import and
restore already carry `source` in the snapshot, so nothing else changes - no
save-format bump.

## Steps

Each step is a RED-GREEN-REFACTOR cycle, committed on its own once `npm test` and
`tsc --noEmit` are clean.

1. **Pin the classic spring.** A test that a classic new game has exactly one
   source, at `(width/2, floor(seaStart * 0.01))`, at `STREAM_RATE`. Today's
   test only compares against `initSpring`, which would move with it.
2. **`fillCost`.** Small hand-built grids: a cell on a slope down to the sea
   scores 0; a cell in a pit scores the pit's volume; a cell upstream of the pit
   scores the same, since its water passes through; an inland pool below sea
   level is a hollow, not the sea; two hollows in a row add up.
3. **`springSite`.** Hand-built grids: prefers a cell that drains to the sea over
   a higher one in a hollow; prefers the highest of the cells under budget; stays
   off the side walls and the sea; same seed, same spot; falls back to the
   lowest score when nothing is under budget.
4. **Seeded new games use it.** A seeded `newGameSnapshot` has exactly one
   source, at `springSite`'s cell; classic still passes step 1; the existing
   `confirmNewGame` and round-trip tests stay green.
5. **Sweep it.** The scratch probe over `s1`..`s50` for 300s with the new
   placement. Expected: every stream reaches the sea. If any does not, stop and
   look at the budget before going on. Record the arrival times.
6. **Verify in the browser.** A few random beaches: the spring is somewhere new,
   its stream reaches the sea, and the new game does not stall on Start.
   Classic still has its spring at top-centre.
7. **CLAUDE.md** - the score and why it is safe, the inland-pool trap, the
   one-pass cost map against the 3s search, the budget's coupling to
   `STREAM_RATE`, and that seeds grew a different spring before this.

## Out of scope

- **More than one spring**, or a seeded `STREAM_RATE`.
- **A generator version in the snapshot.** Decided against above; revisit
  before the *next* thing a seed is made to change.
- **Moving classic's spring.**
