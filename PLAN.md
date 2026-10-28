# Plan: a v2 beach generator

## Context

v1 grows every beach the same shape. The seed varies only the rock and sand
noise; the ridge, the sea and the tide are the same on every beach. v2 lets the
seed shape the beach:

- **Seeded sea.** Each beach has its own `seaStart` and `seaLevel`.
- **Seeded tide.** Each beach has its own tidal amplitude and period.
- **Seeded swell.** Some beaches have weaker waves, and some less frequent ones.
  Today's swell is the strongest and most frequent.
- **Seeded ridge.** Some beaches are steep and some flat. Some are rocky and
  some sandy (`sandShare`).
- **Bolder land.** More dunes and outcrops.
- **Scarps.** A few places where the rock is far steeper than sand can ever
  stand. A stream crossing one makes a waterfall.

The sea's groundwork is already done: `Grid.setSea`, `seaStart`/`seaLevel` in
the snapshot, `hasClassic`, the registry and the `gen` labels. The tide and the
swell have none of it. The tide's amplitude and period are fixed when `Game`
builds its `Tide`, the swell's are module constants in `Waves.ts`, and neither
is saved. And the water sim has never run a waterfall. So this plan first
checks that a waterfall works, then gives the tide and the swell the sea's
footing, and only then builds v2.

### Decisions taken up front

- **A waterfall spike comes first.** A cliff's lip is a sill beside a much lower
  cell, which is the geometry behind the `conductingDepth` bug recorded in
  CLAUDE.md. That bug is fixed, but a drop of up to 10 units over one cell is a
  far harsher test than anything tuned so far. If the water sim cannot carry a
  stream over a cliff, scarps are pointless, and fixing that is its own piece of
  work. We find out before building anything.
- **v1 is not touched, except to state its whole sea.** `beachPins.test.ts`
  must hold unchanged through every step. v1's `setSea` call now passes the
  whole sea: the tide's 0.8 and 180 it has always had, and full swell. That is
  how v1 came to set its sea explicitly in the first place, and its output is
  identical. Otherwise v2 starts as a copy of v1, `SpringSiteV1` included, and
  diverges from there. Duplication is the price of freezing.
- **The tide belongs to the beach.** A real tidal range belongs to the place, as
  sea level does. So it is held on `Grid` beside the sea, set by the generator
  and stored in the snapshot.
- **The beach's sea is one value.** It is `BeachSea`: `seaStart`, `seaLevel`,
  the tide's amplitude and period, and the swell's frequency and strength. Six
  values are too many for separate setters, and they are set together and stored
  together.
- **One holder.** `Grid` holds the `BeachSea`. `Tide` and `Waves` keep only
  their clocks and read the rest from the grid. Two copies could disagree after
  an import.
- **The swell is stored as fractions of the maximum; the tide is stored
  absolute.** A beach's swell is `swellFrequency` and `swellStrength`, each a
  fraction (at most 1) of what `SWELL_PERIOD` and `SWELL_AMPLITUDE` give. Those
  two stay the tuning knobs CLAUDE.md lists them as: they set the maximum, and
  every beach scales from it, so retuning castle survival changes how every
  beach plays without changing any beach. That is how `EROSION_K` already
  behaves. The tide is a property of the place and is stored absolute, so
  retuning a tide is a generator change.
- **Today's swell is the harshest.** No beach gets waves stronger or more
  frequent than the ones everything was tuned against. Like the tide's 180s
  minimum, that bounds the stress on the sim from above.
- **The slowest swell is ~4.5s** (`swellFrequency` ≥ 0.78). Its wavelength is
  `SWELL_SPEED × period`: 49 cells at 3.5s, 63 at 4.5s. CLAUDE.md records that
  at 5s (70 cells) the waves did not bend at all. 4.5s keeps some bending. The
  smallest sea (~51 rows) under the slowest swell is the worst case, and the
  sweep runs exactly that.
- **The weakest swell is a third of today's** (`swellStrength` ≥ 0.33). Even
  the calmest beach has visible waves and some castle erosion.
- **Slower is not assumed gentler.** On real beaches, longer waves of the same
  height run further up the sand. So a slow, full-strength swell might wear a
  castle faster per wave even though fewer waves come. The sweep measures it.
- **Amplitude, not range.** High water is `seaLevel + amplitude`. Today's 0.8 is
  an amplitude, which as a range would be 1.6. The name says which, for the same
  reason sea level is named an elevation.
- **Snapshot version 5** replaces the flat `seaStart` and `seaLevel` with a
  `sea: BeachSea`. The 4 -> 5 migration keeps the two values it has and adds a
  tide of 0.8 and 180 and full swell. That is a fact rather than a guess: every
  existing beach has had exactly that. The tide's and the swell's phases survive
  a reload, because each one's `elapsed` and the beach's sea are both stored.
- **No tide period is shorter than 180s.** Every scene in CLAUDE.md was tuned
  against 180s. A longer period over the same amplitude rises more slowly (the
  fastest rise is `2π · amplitude / period`), so it is gentler on all of them.
  Only the amplitude makes a tide harsher. The harshest tide is therefore the
  largest amplitude at 180s, and that is what the sweep stresses.
- **The longest period is set by attention, not physics.** A tide only matters
  if the player sees it turn. At 360s it comes in over three minutes and goes
  out over three more. Any slower and it would barely move during a session.
- **Amplitude and period are drawn independently,** giving fast big tides, slow
  small ones, and everything between. Real tides do not tie them together
  either.
- **Steepness and sand are drawn separately.** `ridgeScale` sets the surface
  ridge (rock plus sand), which mainly sets how fast the stream runs and how
  hard it erodes. `sandShare` sets how much of that ridge is sand, which mainly
  sets soaking and digging. With one effect per knob, the sweep can say which
  knob a failing seed failed on. Two scales, one for rock and one for sand,
  could not. `ridgePower` is shared: a power per layer would vary sand depth
  along the beach in ways that are hard to reason about.
- **Sand behind a scarp must lie under the angle of repose.** The spike's
  first scene thinned the sand to nothing over 3 cells behind the lip, which is
  steeper than sand stands. `Slope` emptied it over the edge and buried the
  face in its own talus: a 10-high cliff was 1.75 high after 300s, away from the
  stream entirely. Behind the lip there is a bench of bare rock, then sand
  thickening by at most 0.3 a cell (`Slope` moves sand beyond 0.625). The foot
  is left alone: sand cannot climb a rock wall. Shaped this way, every dry face
  held exactly, to two decimal places, for 600s.
- **A scarp's height is the surface drop, lip to foot.** Raising the rock by
  `height` left the foot's sand to eat most of it. A 6 raise gave a real drop
  of 1.2, which the stream filled. So the rock above is raised per column by
  whatever makes the drop exactly `height` once the lip is bare.
- **A scarp is a narrow notch, walled at both ends.** On a full-width cliff
  the falling water spread along the whole foot: 116 columns wet under a
  7-column stream, sideways flow 9x the downhill flow, the foot scoured into a
  gutter along the wall. The sim has no vertical momentum, so water lands at
  the foot with nothing carrying it away, and it fills whatever room the foot
  gives it. A notch 24 wide, with the raised ground either side carrying on
  seaward and ramping down at 0.4 a row, stopped the spread at its walls.
- **The foot is not shaped.** A foot sloping away from the face at 0.4 a row
  was tried in the notch and made no difference: the fall dug a pool and built a
  bar below it within minutes either way.
- **A cliff face shows water only where water comes over it** (`86acbbc`,
  already shipped, and true of every cliff a player digs too). The mesh has one
  vertex per cell, so a face is one quad blended from lip to foot, and a pool
  at the foot painted the face blue across its full width. `showsWater` colours
  a wet cell under a face as water only when a cell on the face's top is wet.
- **Scarps stay out of the shore zone,** the 25 rows over which v1 already
  fades the rock to the sea. The swell, refraction and castle survival were all
  tuned there.
- **Nothing aims a scarp at the stream.** The spring sits as high as it can, so
  it will often be above a scarp. A beach whose stream misses every scarp is a
  fine beach. The sweep counts how many streams cross one. With scarps 10 - 40
  wide on a 256-wide beach, that may be few: if waterfalls turn out too rare to
  matter, aiming them comes back as a decision, not a range tweak.
- **v2 has no classic beach** (`hasClassic: false`). *Classic* in the dialog
  stays `CLASSIC_BEACH`, which is v1's.
- **A scarp's place is stored as fractions,** so the shape does not depend on
  the grid it is laid on. `row` is a fraction of the rows a scarp may use - from
  the back of the beach to where its ramps would reach the shore zone - and
  the generator turns it and `xCentre` into cells.
- **The seed draws v2's shape from its own stream:**
  `seedFromText(seed.trim() + ':shape')` through v2's own mulberry32. That is
  separate from the noise, which takes the seed's own hash, and from the spring
  (`':spring'`). The order of the draws is fixed, and becomes part of v2 once it
  ships.
- **Ranges are provisional until the sweep.** Every seeded parameter is
  `min + r * (max - min)`, with its range as a named constant. The figures below
  are starting points, and the sweep sets the real ones.
- **v2 cannot be reached until it is frozen.** `LATEST_GENERATOR` stays 1, and
  the dialog's picker lists only generators up to it. A push partway through
  this plan therefore lets no player grow an unfrozen v2 beach. The bump to 2
  lands together with v2's pins, and that is the moment v2 freezes.
- **Bump only after a sweep passes** step 12's criteria.
- **A generator picker lets a player regrow an old seed.** It is a small `gen`
  dropdown beside the seed field, defaulting to the newest generator. It applies
  only to a typed seed: *Random* always uses the newest, since a random
  old-generator beach serves nothing, and *Restart* keeps the beach's own.

## Design

### The waterfall spike

A scratch probe, run through the same full `Game.simStep` pipeline the sweeps
use. It takes the classic beach and cuts a full-width rock scarp across it
below the spring, at row 60, 1 cell wide. It runs several heights for 300s
each, plus a control run with no scarp. For each run it measures:

- NaN or negative depth.
- The flux over the lip, against the `MAX_VELOCITY * edgeDepth` ceiling.
- Grid-scale chop below the lip: cell-to-cell sign flips in the surface's
  curvature along the stream, compared with the control.
- The plunge pool's deepest standing water, against an onset of ~22 and a
  limit of 11.
- Whether the stream still reaches the sea, and when.

It also writes each scene as a beach file through `toGameFile`, so you can
import it and look at the waterfall in the browser with no change to the game.
That shows whether a heightfield with one very steep cell reads as a waterfall
from the isometric camera.

**Findings** (`waterfall.ts` in the scratchpad). Classic beach, face at row 60,
surface drops of 3, 6 and 10, 600s each, shaped as the decisions above say:

| drop | NaN / negative | drop at 600s, in the stream | dry faces | plunge pool | stream reaches sea | chop below lip |
|---|---|---|---|---|---|---|
| none (control) | none | - | - | 0.9 | 185s | 0.19 |
| 3 | none | 3.00 -> 4.13 | unchanged | 1.96 | 190s | 0.24 |
| 6 | none | 6.00 -> 8.43 | unchanged | 3.05 | 215s | 0.25 |
| 10 | none | 10.00 -> 12.57 | unchanged | 3.09 | 210s | 0.24 |

- **The lip is stable.** The flux over it sits exactly on the
  `MAX_VELOCITY * edgeDepth` ceiling, which is the cap doing its job. The
  step-to-step sign-flip rate of the water below it is 0.04 - 0.06, the
  control's level, so there is no chequerboard.
- **A waterfall pulses.** Water piles up two rows behind the lip and spills over
  in a smooth surge every couple of seconds. The foot's depth swings by up to
  0.6 against the control's 0.008. This is a physical surge, not numerical
  chatter.
- **A waterfall digs its own plunge pool,** scouring the foot by 1.1 - 2.6 in
  600s and dropping that sand as a bar a few rows downstream. Pools reached 3.1
  deep. Still growing at 600s, so the sweep runs scarp-crossing seeds to 900s
  against its limit of 11.
- **The water spreads along the foot of a wide cliff** (see the decision
  above), and the mesh painted that spread up the face. That looked like water
  flowing across the fall rather than down it.

**The notch** (`notch.ts` in the scratchpad). The same face, 24 columns wide
(x 109 - 132) around where the stream crosses, the raised ground either side
ramping down seaward at 0.4 a row, and the foot sloped at 0.4 a row for 6
rows. 600s each:

| drop | NaN / negative | stream at lip | wet at the foot | sideways / downhill at the foot | foot scoured | stream reaches sea |
|---|---|---|---|---|---|---|
| 6 | none | 6 columns | 24 (the notch) | 4.6x | 1.0 - 1.6 | 185s |
| 10 | none | 4 columns | 24 (the notch) | 3.6x | 1.8 - 2.7 | 210s |

The ground beside the notch did not move. With `showsWater`, the face shows
water across 11 - 13 columns of the foot, and the old wide cliff across 11
rather than 116. Checked in the browser: the fall reads as a waterfall from the
game's camera, and the face colouring looks better.

- **Measure the lip against the edge depth from *before* the step.** Taken after
  the step, when the water has already moved, the flux read 8x over the
  ceiling, which it can never be.

### The beach's sea on the grid

```ts
// core/BeachSea.ts
export interface BeachSea {
  seaStart: number
  seaLevel: number        // an elevation
  tideAmplitude: number   // high water is seaLevel + tideAmplitude
  tidePeriod: number      // seconds
  swellFrequency: number  // fraction of the maximum; period = SWELL_PERIOD / this
  swellStrength: number   // fraction of the maximum; amplitude = SWELL_AMPLITUDE * this
}
```

`Grid.setSea(sea: BeachSea)` replaces `setSea(seaStart, seaLevel)`. It throws a
`RangeError` unless:

- `seaStart` is an integer row inside the grid;
- `seaLevel` is finite;
- `tideAmplitude` is finite and at least 0, and `tidePeriod` is finite and
  above 0;
- `swellFrequency` is in (0, 1] and `swellStrength` in [0, 1].

`grid.sea` reads it, and `seaStart` and `seaLevel` keep their getters for the
many readers. A fresh grid's default is today's sea, so every test grid behaves
as now. `isValidSnapshot` applies the same rules, from one shared function so
the two cannot drift apart.

`Tide` keeps `elapsed`, `step`, `snapshot` and `restore`, and its offset reads
the amplitude and period from the grid: `tide.offset(grid)`. `Tide`'s own tests
now pass `new Tide(180, 0.4)`; instead they build a small grid with that sea.

`Waves` likewise keeps `elapsed` and `timeUntilWave`. It reads its period and
amplitude from the grid it is given:

- `waves.period(grid)` and `waves.surfaceAt(grid, x, z, seaSurface)`;
- `step` counts the countdown against the beach's period;
- a new game's `timeUntilWave` starts at the beach's period, not
  `SWELL_PERIOD`.

`Game`'s readers move over: the sea surface in `simStep`, the Sponge's closure,
and the Hud. So do the swell, castle and waves tests. Their grids default to
full swell, so they still test the harshest case.

`seaV1(depth)` returns v1's whole `BeachSea`. v1's generator passes it to
`setSea`. The 3 -> 4 migration takes its two fields from it as now, and 4 -> 5
takes the other four.

### The shape a seed draws

```ts
// generators/v2/ShapeV2.ts
export interface ScarpV2 {
  row: number            // 0 - 1 across the rows a scarp may use, back to front
  xCentre: number        // 0 - 1 across the width
  span: number           // the notch's width in cells, 10 - 40
  height: number         // how far the surface drops over the face
  faceWidth: number      // cells the drop is spread over: 1 or 2
  wobble: number         // seed for the face's meander across the notch
}

export interface ShapeV2 {
  seaFraction: number    // seaStart = floor(depth * seaFraction)
  seaLevel: number
  tideAmplitude: number
  tidePeriod: number
  swellFrequency: number
  swellStrength: number
  ridgeScale: number     // multiplies v1's surface ridge, rock + sand (12 + 9)
  ridgePower: number     // ridge = (1 - t) ** ridgePower; v1 is 2
  sandShare: number      // fraction of the ridge that is sand; v1 is 9/21
  noiseScale: number     // multiplies v1's rock and sand noise amplitudes
  scarps: ScarpV2[]      // 0 to 2
}
export function shapeV2(seed: string): ShapeV2
```

Starting ranges, before the sweep:

| parameter | v1 | v2 range | what bounds it |
|---|---|---|---|
| `seaFraction` | 0.78 (57 sea rows) | 0.74 - 0.80 | The sea needs more than `SPONGE_ROWS` (12) plus a wavelength (49 cells) for refraction, and the land needs room for the stream |
| `seaLevel` | 2.0 | 1.6 - 2.4 | `SWELL_SPEED` assumes a boundary depth of ~20, so `SEA_FLOOR_END_HEIGHT` stays -20 |
| `tideAmplitude` | 0.8 | 0.4 - 1.4 | The water the tide moves (22,822 at 0.8, scaling with amplitude), the swash's reach and castle survival. With `seaLevel`, how low low water and how high high water go |
| `tidePeriod` | 180 | 180 - 360 | Below 180 is untested; above 360 a player would not see it turn |
| `swellFrequency` | 1 (3.5s) | 0.78 - 1 (4.5s - 3.5s) | Above 1 is harsher than anything tuned. Below 0.78 the waves stop bending, and less of each wave is absorbed by the sea's absorbing edge |
| `swellStrength` | 1 (0.15) | 0.5 - 1 | Above 1 is harsher than anything tuned. Set by the sweep: castle wear falls away unevenly with strength, and at a third a castle barely erodes |
| `ridgeScale` | 1.0 | 0.7 - 1.3 | The stream's speed and erosion |
| `ridgePower` | 2 | 1.5 - 2.5 | Where the beach is steep: near the back, or across it |
| `sandShare` | 0.43 | 0.25 - 0.65 | Rocky to sandy. At the sandy end, deep sand soaks the stream and slows its arrival |
| `noiseScale` | 1.0 | 1.0 - 1.6 | Deepest inland water must stay well under the advection-instability onset at ~22. Bolder noise also floors more rock at v1's 0.2: on seed 0, rows 20 - 120, 9% of cells at 1.0 and 32% at 1.6. The sweep should look at those flat floors |
| scarp count | 0 | 0 - 2 | |
| scarp `height` | - | 3 - 10 | The surface drop, lip to foot. All three spiked drops held for 600s, and the pools stayed at 3.9 or less |
| scarp `faceWidth` | - | 1 - 2 | The spike tried only 1. A 2-cell face is unmeasured until the sweep |
| scarp `row` | - | from the back of the beach to 25 rows, plus its side ramps (`height / 0.4`), short of `seaStart` | Out of the shore zone, ramps included |
| scarp span | - | 10 - 40 cells | The fall's pool spreads to the notch's walls, so wider is a wide pool under a narrow fall. The spike ran 24 |

### The generator

`generators/v2/BeachGeneratorV2.ts` contains:

- `beachGeneratorV2 = { version: 2, hasClassic: false, generate }`
- `generateBeachV2(grid, seed)`, which:
  1. draws the shape;
  2. sets the sea, the tide and the swell;
  3. lays out the land (`layBeachV2(grid, shape, noiseSeed)`): ridge, noise,
     then the scarps, then the sand shaped behind their lips;
  4. places the spring with `springSiteV2`.

`generate` throws on a `null` seed, which the guard and `resolveBeach` already
prevent. `generators/v2/SpringSiteV2.ts` is a copy of v1's; its
`MAX_SPRING_FILL` of 70 stays until the sweep says otherwise.

A scarp raises the rock uphill of its face, in each column, by whatever makes
the surface drop from lip to foot exactly `height`, falling over `faceWidth`
cells. Across the beach, the face meanders by a few cells, driven by `wobble`.

The raise covers the whole width uphill of the face, each column outside the
span taking its nearest span column's raise. Outside the span the raised
ground carries on past the face row and ramps back down at `SCARP_SIDE_SLOPE`
(0.4 a row), so the cliff is a notch in a headland and its foot is walled on
both sides. Beside the walls, `SCARP_BENCH` cells are bare rock and the sand
beyond them is capped by the same ramp as behind the lip, so it cannot slide
into the notch.

Behind the lip, `SCARP_BENCH` cells (4 in the spike) are bare rock, and beyond
that the sand is capped at `SCARP_SAND_RAMP` (0.3) per cell of distance, so it
lies under the angle of repose. The foot keeps its sand. A fresh grid holds no
moisture, so there is none to move with the sand.

As built (step 11):

- **Where it goes.** The foot row runs from row 20 (plus the wobble) to the
  last row that keeps the ramps out of the shore zone; `row` picks within that.
  `xCentre` places the notch so it always fits inside the beach.
- **The ramps fall at 0.4 a row from the actual raise, not from `height`.**
  Height is the drop to the foot, so where the foot carries deep sand the
  ground behind must rise further than `height`: across 50 seeds, ramps ran to
  51 rows, a raise of about 20. Sizing the ramp from `height` would have made it
  steeper than 0.4 there. So a scarp is placed on the ground it is cut into,
  and moves uphill if its ramps would reach the shore zone. None had to, across
  50 seeds. `layBeachV2` returns where each scarp went, since only the layout
  knows.
- **The face meanders** up to 2 rows either way, turning every 8 columns.
  A 2-cell face falls half its height on each row.
- **Two scarps are cut in the shape's order;** the second raises everything
  uphill of it, the first included.
- **Sand is settled after cutting.** The ramps' 0.4 lands on top of the beach's
  own slope, and sand over them stood steeper than repose: Slope moved it on
  the first try, 6 - 15 columns out from the notch. Every cell a scarp changed
  has its sand trimmed until it stands no more than 0.6 above a neighbour,
  passing the check on to its neighbours when it lowers one. The noise leaves
  some natural slopes over repose anyway, so the test is that a scarp gives
  Slope nothing new to move.

### The sweep (step 12)

Scratch probes `sweep2.ts`, `swellsweep.ts` and `chopcheck.ts`, through the full
`Game.simStep` pipeline. 50 seeds, `s1`..`s50`, each for 300s or one tide period
and on to 900s for a stream that had not arrived; 10 sea and tide corners on
v1-like land; 10 swell points.

| criterion | v2 | bar (v1) | outcome |
|---|---|---|---|
| NaN or negative depth | none | none (none) | pass |
| open sea vs the tide | seeds 0.04 - 0.24; corners up to 0.317 | 0.3 (0.26) | accepted: one corner, the lowest sea at the highest level with the biggest tide |
| deepest water inland | median 7.1, max 11.52 | 11 (9.4) | bar raised to 12 |
| streams inside 300s | 35 / 50, 13 by 305 - 755s, 2 never | 40 (41, 1 never) | bar lowered to 33, with at most 3 never |
| castle wear, over its flat sea | 0.08 - 1.22x v1's | 2x | pass; the floor of `swellStrength` raised |
| refraction | 0.10 - 0.21 | v1 0.14 by this measure | pass |
| reflected / incident at the sponge | 0.127 - 0.133 | 2x v1's 0.132 | pass |
| flicker below a waterfall | 0.035 - 0.039 | the spike's 0.04 - 0.06 | pass |

- **Deep inland water is shore lakes, not plunge pools.** The four seeds over
  11 already hold 9.6 - 10.8 at boot, in hollows below sea level at rows 169 -
  178, just inland of the shore zone. A higher sea level and a bigger tide than
  v1's lift them: v2's tide reaches 1.4 against v1's 0.8. Half the instability
  onset is 11; 12 still leaves 10 to spare.
- **No knob separates a slow stream from a fast one.** The mean of every
  seeded knob is within a few percent between the 35 that arrived and the 15
  that did not. Waterfalls play a part: 5 of the 11 streams that crossed a
  scarp were slow, against 10 of the 39 that did not. The two that never
  arrived score 61 and 37 on the spring's fill cost, inside its budget of 70,
  as v1's one did. Narrowing a range would not fix it; a route-aware spring
  would, and stays out of scope. A slow or pooling stream is a fine beach.
- **Castle wear is not proportional to swell strength**, because of the
  erosion threshold. Over its flat sea, against v1's: 0.08x at 0.33, 0.22x at
  0.5, 0.32x at 0.66, 0.53x at 0.8. Hence the floor of 0.5. A slow full swell
  is the harshest corner, at 1.22x.
- **Refraction and reflection are measured here relative to v1,** because
  how CLAUDE.md's 0.09 and 0.035 were taken is not recorded. Refraction is
  RMS(flowX) / RMS(flowZ) at row 240 minus at `seaStart` + 11; it is a
  direction, so it does not shrink with amplitude, and the plan's per-strength
  floor does not apply. Reflection splits the wave at row 240 into its
  shoreward and seaward parts.
- **Spatial chop could not referee a waterfall; flicker can.** The spike's
  curvature-flip chop read 0.06 - 0.52 below the 11 waterfalls, but the same
  streams read nearly as high without their cliffs (s12 0.41, s46 0.36): v2's
  streams are busier than classic's. The step-to-step flicker the spike used
  was the same with and without the cliffs and under the spike's control. s16
  reads high only with its cliff, which is the plunge pool's surge.
- **Waterfalls form on 1 beach in 5:** 48 scarps on 34 beaches, 11 crossed.
- **The runs took far longer than measured alone:** 0.45s a simulated second
  for one probe, but up to 15x that with 8 in parallel, or across a sleep.
  Budget hours, not minutes, for a sweep this size.

### The dialog

`NewGameChoice`'s `chosen` gains `generator: number`, and the picker supplies
it. `resolveBeach` uses that generator for a typed seed instead of
`LATEST_GENERATOR`. The picker:

- lists `1..LATEST_GENERATOR`, newest first and selected;
- is enabled only while a seed is being typed;
- goes back to the newest each time the dialog opens.

## Steps

Each step is a RED-GREEN-REFACTOR cycle, committed on its own once `npm test`
and `tsc --noEmit` are clean. Steps 1-3 change no beach: the v1 pins hold, and
the game plays exactly as now.

1. **The waterfall spike.** A scratch probe as above, plus its beach files.
   Nothing is committed beyond the findings in PLAN.md and WIP.md.
   - **Stop here and bring you the table and the files to import.**
   - If the lip is stable and it looks like a waterfall, set the scarp ranges
     from what it found and carry on.
   - If not, scarps come out of this plan and the water-sim fix becomes its own
     piece of work. The rest of the plan goes ahead either way.
2. **The beach's sea lives on the grid.**
   - `BeachSea` and `Grid.setSea(sea)` with today's sea as the default.
   - `Tide.offset(grid)`; `Waves.period(grid)` and `surfaceAt(grid, ...)`.
   - `Game`'s readers moved over.
   - `seaV1` returns the whole sea.
   - Tests:
     - `setSea` validation;
     - the tide follows the grid's amplitude and period;
     - the swell's period and amplitude follow its frequency and strength, and
       a half-strength swell's surface is half as far from the sea's;
     - v1 beaches carry 0.8, 180 and full swell;
     - the pins are unchanged.
3. **Snapshot v5.**
   - `sea: BeachSea` through `createSnapshot`, the guard, `applySnapshot`,
     `newGameSnapshot` (whose `timeUntilWave` starts at the beach's period) and
     `GameFile`.
   - The 4 -> 5 migration, and v1 -> 5 through every step.
   - Tests:
     - a round trip keeps a non-default sea;
     - the guard refuses each out-of-range field;
     - an old file imports with v1's sea;
     - a reload keeps the tide's and the swell's phases.
4. **v2 as a copy of v1.**
   - Copied into `generators/v2/` and registered with `hasClassic: false`.
     `LATEST_GENERATOR` stays 1.
   - Tests:
     - a seed grows identical layers under v1 and v2. This is scaffolding,
       which step 6 removes on purpose.
     - v2 refuses a `null` seed.
     - `generatorFor(2)` finds it.
5. **`shapeV2`.** The seeded parameters as a pure function, not yet used.
   - Tests:
     - every value lies inside its range across many seeds, scarps included;
     - the same seed gives the same shape, and different seeds give different
       shapes;
     - it trims the seed like `noiseSeed`;
     - its stream is independent of the spring's.
6. **Seeded sea.** `generateBeachV2` sets `seaStart` and `seaLevel` from the
   shape.
   - Tests:
     - the grid's sea is the shape's, and the sea rows are water up to that
       level;
     - two seeds give different seas;
     - the sea round-trips through `newGameSnapshot` and `applySnapshot`.
7. **Seeded tide.**
   - Tests: the grid's tide is the shape's; two seeds give different tides;
     every period is at least 180.
8. **Seeded swell.**
   - Tests: the grid's swell is the shape's; two seeds give different swells;
     neither fraction ever exceeds 1.
9. **Seeded ridge and sand share.** `ridgeScale`, `ridgePower` and `sandShare`
   in the land's layout. The layout takes a `ShapeV2`, so a test can pass a
   hand-picked shape rather than search for seeds.
   - Tests (comparisons, not amounts):
     - a high-`ridgeScale` shape's back of the beach stands higher than a low
       one's;
     - a high-`sandShare` shape has deeper sand there over a similar surface.
10. **Bolder land.** `noiseScale` on both noise amplitudes, tested the same way.
11. **Scarps.** Laid out from the shape's `scarps`.
    - Tests on hand-picked shapes:
      - the rock drops by the scarp's height across the face;
      - the lip and its bench are bare rock, and the sand behind them never
        rises faster than the ramp;
      - a fresh scarp beach does not move under one `Slope` step;
      - outside the span, the ground ramps down seaward no steeper than
        `SCARP_SIDE_SLOPE`, and beyond the ramp the rock is the same as the
        layout without the scarp;
      - the foot is walled: at the face row, the ground just outside the span
        stands above the foot;
      - no scarp, ramps included, reaches the shore zone;
      - a shape with no scarps gives the same layout as before this step.
12. **Sweep, then set the ranges.** A scratch probe; the only thing committed is
    the ranges.
    - 50 seeds through the full `Game.simStep` pipeline, for 300s or one tide
      period, whichever is longer, and 900s for any stream that has not
      arrived.
    - **Corners**, each parameter at its min and max:
      - **The sea and the tide.** `seaFraction` × `seaLevel` × `tideAmplitude`
        gives 8 corners. All run at a 180s tide and full swell, which is where
        the stress is. One more at 360s with the largest amplitude checks the
        slow end.
      - **The swell.** `swellFrequency` × `swellStrength` gives 4 corners, on
        v1's sea and tide. At each: the castle scene against its flat-sea
        control, the refraction spread, and the reflection from the sea's
        absorbing edge, measured as CLAUDE.md records.
      - **The worst for refraction.** The smallest sea under the slowest,
        weakest swell.
    - **Also counted:** how many streams cross a scarp, and the chop below each
      lip they cross, measured the spike's way.
    - **Criteria** (v1's figures in brackets):
      - No NaN or negative depth.
      - The open sea's mean surface stays within 0.3 of the tide (0.26).
      - Deepest standing water inland is at most 11, half the instability
        onset (9.4). This includes plunge pools.
      - At least 40 of 50 streams arrive inside 300s (41). Watch the sandy end
        of `sandShare` here.
      - No beach wears a castle down more than twice as fast as classic's,
        measured over its control. A weak swell is allowed to be gentle. A slow
        full-strength one is the corner to watch.
      - Refraction spread, divided by `swellStrength`, is at least 0.05 (0.09).
        Spread shrinks with amplitude by design, so the floor is per unit of
        strength.
      - Reflection from the absorbing edge is at most twice today's (0.035).
      - No lip chops worse than the spike's passing runs.
    - **Stop here and bring you the table.** Narrow any range that fails and
      sweep again. Any change to `MAX_SPRING_FILL` is also decided here.
13. **The generator picker.**
    - `chosen` carries a generator, and `resolveBeach` uses it.
    - The dialog lists `1..LATEST_GENERATOR` with the newest selected. It is
      enabled only for a typed seed and resets on each open.
    - Only `gen 1` is listed until step 14.
14. **Ship v2.**
    - `LATEST_GENERATOR = 2`, and v2's files gain the FROZEN header.
    - `beachPins.test.ts` gains every layer and the whole `BeachSea` of two v2
      seeds, one of them with a scarp, named with `generator: 2` explicitly.
      The v1 pins are unchanged.
15. **Verify in the browser.**
    - *Random* gives a `(gen 2)` beach with a visibly different shape.
    - Over a few beaches:
      - rocky ones and sandy ones;
      - a tide rising visibly higher on some and turning slower on others;
      - gentler or slower waves on some;
      - a scarp, and a seed whose stream falls over one.
    - `salty-gull-42` typed with `gen 1` gives back exactly the v1 beach.
    - *Classic* is still `(gen 1)`, and *Restart* keeps each beach's generator.
    - A reload keeps the tide and the waves where they were.
    - Export names read `gen2`, and an old v1 file still imports.
16. **CLAUDE.md.**
    - What the spike found about waterfalls: why a wide cliff's foot spreads
      sideways (no vertical momentum), the notch, and `showsWater`.
    - The beach's sea as one value with one holder.
    - Tide absolute, swell as fractions, and why each is stored that way.
      `SWELL_PERIOD` and `SWELL_AMPLITUDE` are now the maximum.
    - Amplitude, not range. Why 180s is the tide's minimum period and what
      bounds its maximum; why 4.5s bounds the swell's.
    - Steepness and sand share as separate knobs. Sand behind a lip lies under
      repose, or `Slope` buries the face; height is the surface drop.
    - v2's shape stream, and why its draw order is frozen.
    - The sweep's table, and the ranges with what bounds each one.
    - The picker, and why *Random* ignores it.
    - *Sample over less than 180s* becomes *less than the beach's tide period*.
      180 is still the safe default, since it is the minimum.

## Out of scope

- **A seeded spring rate, or a route-aware spring score.** v2's spring
  placement is v1's, copied.
- **Aiming a scarp at the stream.** Waterfalls happen where they happen.
- **Overhangs or caves.** The ground is a heightfield, so a cliff is at most
  vertical.
- **A shoreline that varies across the beach.** There is still one `seaStart`
  per beach.
- **The swell's direction** (`SWELL_ANGLE`). Refraction depends on it, and it
  stays a sim constant.
- **Showing the tide or the swell in the Hud** beyond the readouts already
  there.
- **Typing a generator into the seed (`gen1:...`).** The picker does this job.

## Follow-on: v2 without scarps

The user did not like the waterfalls in play and asked for them to go. v2 had
not been pushed - `main` was 18 commits ahead of `origin/main`, whose latest is
`e3da65b`, from before this plan - so no player has a v2 beach, and v2 is
treated as still under development: changing it in place breaks nothing
outside this machine. The only v2 beaches are the user's own, from the browser
check; one that had scarps regrows without them on *Restart*, and still loads
unchanged, since a save stores its layers.

Decisions:

- **The scarp code comes out of v2,** rather than drawing zero scarps: a
  frozen generator should not carry code it never runs. The spike, the design
  and the sweep's scarp findings stay above and in git history for a later
  generator to bring them back.
- **Every seed without a scarp is unchanged.** Scarps are the shape's last
  draws, so removing them moves no other value.
- **`showsWater` stays.** It is right for any cliff a player digs.
- **`LATEST_GENERATOR` stays at 2.** The removal, the re-pin and the re-sweep
  happen together, before any push.

Steps:

1. **Remove the scarps from v2 and re-pin.** `ScarpV2`, the scarp draws,
   `cutScarpV2` and its placement, the sand settle, and their tests go;
   `layBeachV2` returns nothing again. s46's pin moves; s37's does not. A
   one-off scratch check confirms every seed of `s1`..`s50` that had no scarp
   grows exactly the beach it did.
2. **Re-sweep the seeds** (a decision point). The 50 seeds through the full
   pipeline, as step 12 ran them. The sea, tide and swell corners had no
   scarps and stand. Bring the user the table if any bar fails.
3. **CLAUDE.md.** The v2 section describes v2 without scarps, keeping what the
   spike taught about waterfalls under a note that v2 does not grow them.

**Re-sweep result** (step 2). The 34 seeds that had scarps were rerun; the 16
that had none grow the same beaches, and the sim is deterministic, so theirs
stand. The corners and swell points never had scarps.

| criterion | with scarps | without | bar |
|---|---|---|---|
| NaN or negative depth | none | none | none |
| open sea vs the tide | max 0.24 | max 0.287 | 0.3 |
| deepest water inland | 11.52 | 11.52, the same shore lakes | 12 |
| streams inside 300s | 35 / 50 | 44 / 50 | 40 again (v1 41) |
| never arrive | 2 | 1 (s50, which never had a scarp) | 3 |

Without scarps v2's streams beat v1's, so the stream bar lowered for the
scarps goes back to 40. The 13 slow streams with scarps are 5 without -
s26, s14, s20, s5, s10, 350 - 585s - and still no knob separates them.

