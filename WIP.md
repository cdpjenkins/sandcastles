# WIP: A cell holds moisture in proportion to its sand, up to a wetting depth

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
