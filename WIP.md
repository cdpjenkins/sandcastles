# WIP: Choose the beach a new game starts on

Classic, restart this beach, random, or a typed seed. Plan in `PLAN.md`; the
50-seed sweep found nothing to constrain.

## Current Step

None - step 5 done.

## Next Action

Step 6: `resolveSeed` and seeded `newGameSnapshot` / `startNewGame` /
`confirmNewGame`.

## Status

⏸️ WAITING - suite green (484), tsc clean. `Game` already holds the seed
and adopts it on restore, import and new game; nothing sets one but classic
yet.

## Completed

- [x] Step 1: pin the classic beach
- [x] Step 2: seeded noise
- [x] Step 3: `seedFromText` and `noiseSeed`
- [x] Step 4: `randomSeed`
- [x] Step 5: snapshot v3 carries the seed
- [ ] Step 6: `resolveSeed` and seeded new game
- [ ] Step 7: `NewGameDialog`
- [ ] Step 8: the Hud shows the seed
- [ ] Step 9: wire into `Game`
- [ ] Step 10: verify in the browser
- [ ] Step 11: CLAUDE.md

## Shipped before this

- The swell tests get a 20s timeout (`887934e`).

---

# Previous: The swell tests stop timing out

`swell.test.ts` runs a full beach for 12-20s of sim per test: 2-3.5s alone,
over the 5s default under a full parallel suite. A 20s timeout on the
describe, matching `castle.test.ts`.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (462) three runs in a row, tsc clean.

## Shipped before this

- Digging out the last of the sand leaves no water behind (`da590f7`).

---

# Previous: Digging out all the sand leaves no water behind

`dig` computed what stays as `moisture - added * waterPerSand`, which can
leave a float remainder (~1e-18) when `added` is the whole of the sand.
Under water nothing dries it, so rock went on holding water it cannot.

## Current Step

None - work complete.

## Status

⏸️ WAITING - tsc clean; 461/462, the one failure the swell test's known 5s
timeout under full-suite load (passes alone).

## Completed

- [x] Step 1: zero the moisture when a dig takes the last of the sand.

## Shipped before this

- Deep sand takes seconds to soak (`f34d383`).

---

# Previous: Deep sand takes seconds to soak

`SOAK_RATE` 1.0 -> 0.05: a 15-deep dune fills in 3s rather than five steps.
Four moisture tests restated against a step's soaking rather than amounts
that only fitted under the old rate.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (461), tsc clean. Front-advance probe within a
cell of before. Browser-checked by the user: looks good.

## Shipped before this

- Water soaks into sand at a rate (`e1a69fc`).

---

# Previous: Water soaks into sand at a rate

A wet cell absorbs at most `SOAK_RATE * dt` a step: infiltration is a
surface rate, so deep sand, which holds more, takes more steps to fill. At
1.0/s a unit of sand fills in one step and a 15-deep dune in five.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (461), tsc clean. Front-advance probe unchanged by
the rate (fronts are thinner than a step's soaking).

## Completed

- [x] Step 1: `SOAK_RATE` in `Moisture.step`.

## Shipped before this

- Moisture is water held in the sand (`d6e1ea3`..`736eeeb`).

---

# Previous: Moisture is an absolute amount of water

`grid.moisture` holds water, spread evenly through the cell's sand, rather
than a 0-1 fraction. Capacity is `POROSITY * sand` with no wetting-depth cap.
Saturation (`moisture / capacity`) is derived for the colours and Look panel.

Decided (with the user):

- No cap: water is spread through the whole sand depth.
- The bucket carries damp sand, so a dump returns the water a dig took.
- Dry sand dumped in mixes evenly (replaces the dry-layer-on-top model).
- Drying is an absolute rate, so deep sand dries slower.
- Damp spreads by moving water between cells; wet cells top up from the
  water column.
- Sand moved by slumping or erosion carries its water.
- v1 saves migrate, preserving each cell's saturation.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (459), tsc clean. Browser-checked by the user
(with `SOAK_RATE` 0.05): looks good.

Step 1 notes: `Moisture.step` reads each cell once into working arrays -
1.40 ms/step on the full beach against 1.49 before (a getter-per-pass first
draft was 4.1). Boot absorbs 50 of 189,702 water into the sea bed's sand.

## Steps

- [x] Step 1: absolute moisture, display, snapshot v2 + migration
- [x] Step 2: dig/dump carry water in the bucket
- [x] Step 3: `Slope` moves water with sand
- [x] Step 4: `Erosion` releases eroded sand's water to the column
- [x] Step 5: CLAUDE.md, with the front re-measured under the uncapped model

## Shipped before this

- Dumped sand is dry (`a59e88d`).

---

# Previous: Dumped sand is dry

Dry sand dumped on a cell lies on top. The wetting layer is the top
`WET_DEPTH`, so after a dump it holds the new dry sand plus whatever of the
old damp sand is still within `WET_DEPTH` of the surface; moisture is that
mix. The damp sand pushed below the layer is buried, like absorbed water,
never returned.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (439), tsc clean.

## Completed

- [x] Step 1: `moistureAfterDrySand` in `Moisture.ts`, used by `dump`.
      `Game` already redraws the dumped cell, colour included.

## Shipped before this

- A cell holds moisture in proportion to its sand (`dbd263d`).

---

# Previous: A cell holds moisture in proportion to its sand, up to a wetting depth

Capacity = `SATURATION_DEPTH * min(sand / WET_DEPTH, 1)`: sand at least
`WET_DEPTH` deep holds what every cell held before, thinner sand holds pro
rata, bare rock holds nothing. Moisture stays a 0-1 fraction of capacity.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (432), tsc clean.

## Completed

- [x] Step 1: capacity from sand depth in `Moisture.step`. Checked that
      saturation lands on exactly 1 across 200 sand depths x 1000 starting
      moistures, so no wet cell is charged twice.

## Shipped before this

- Evaporation back to 0.00002 (`2e835f0`).

---

# Previous: Evaporation back to 0.00002

`EVAPORATION_RATE` 0.00128 -> 0.00002, undoing the 64x speed-up of
`e9113ee`. The 1s test runs from that commit stay: they hold at either rate.

## Current Step

None - work complete.

## Status

⏸️ WAITING - tsc clean; 427/428, the one failure the swell test's known 5s
timeout under full-suite load.

## Shipped before this

- Wetting dry sand consumes water (`9f5e9d7`).

---

# Previous: Wetting dry sand consumes water

Moisture is water held in the sand. Taking a cell from moisture 0 to 1 costs
`SATURATION_DEPTH` of the water column above it; damp sand costs pro rata. A
film thinner than the shortfall is soaked up whole and the cell goes dry,
settling its sediment just as `Evaporation` does.

## Current Step

None - work complete.

## Status

⏸️ WAITING - tsc clean; 427/428, the one failure the swell test's known 5s
timeout under full-suite load.

## Completed

- [x] Step 1: absorption in `Moisture.step`; sediment settling shared with
      `Evaporation` via `settleSediment`. Front-advance probe: slows a sheet
      ~10%, does not stall it.

## Shipped before this

- Evaporation runs 64x faster (`e9113ee`).

---

# Previous: Evaporation runs 64x faster

`EVAPORATION_RATE` 0.00002 -> 0.00128. `evaporation.test.ts` runs two of its
checks for 1s rather than 60s, so they no longer assume a slow rate.

## Current Step

None - work complete.

## Status

⏸️ WAITING - tsc clean; 419/420, the one failure being the swell test's 5s
timeout under full-suite load (passes alone, and flakes on main too).

## Shipped before this

- The HUD sits immediately below the toolbar (`f715663`).

---

# Previous: The HUD sits immediately below the toolbar

The HUD (bucket, wave, sea level, status) moves from the bottom-left corner
to directly under the toolbar.

Decided:

- **A shared fixed column, not a fixed `top` offset.** The toolbar wraps, so
  its height is not a constant - a HUD at `top: <n>px` would sit under a
  one-row bar and on top of a two-row one. `stackTopLeft` puts both in one
  `position:fixed` flex column, so the HUD follows the bar's real height.
- **The column is `pointer-events:none`.** It is as wide as the toolbar, so
  the empty space beside the HUD would otherwise swallow clicks meant for
  the beach. The toolbar re-enables them for itself.
- Neither the toolbar nor the HUD is fixed itself any more: a fixed child
  escapes the column and the two overlap again.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (420), tsc clean.

Browser-checked by hand: at a narrow window the toolbar wraps to two rows and
the HUD moves down with it. Still untried: that a click on the beach right
beside the HUD reaches it (the column's `pointer-events:none`).

## Completed

- [x] Step 1: `stackTopLeft` puts the toolbar and HUD in one fixed,
      click-through column; neither places itself any more. README updated.

## Shipped before this

- Press and hold to dig or dump (`7cbba62`..`0c72f4c`).
- A toolbar that fits the screen (`be91f10`..`6f3e113`).
