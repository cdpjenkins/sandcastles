# Plan: Look tool

## Goal

Pressing `L` toggles a fixed corner panel that shows live stats (sand height, water
height, moisture, water velocity/direction, and more) for whichever grid cell the
mouse is currently hovering over.

## Acceptance Criteria

- [ ] Pressing `L` toggles the Look panel on/off
- [ ] While on, panel shows grid coords, rock/sand/surface height, water height,
      moisture, sediment, source rate, and water flow (magnitude + direction arrow)
      for the cell under the mouse cursor
- [ ] Panel updates live as the sim evolves, even without mouse movement
- [ ] Panel shows nothing / a neutral state when the cursor is off the terrain mesh
- [ ] Help overlay (`?`) lists the `L` keybinding
- [ ] All tests still pass

## Steps

### Step 1: `src/input/LookInfo.ts` — `getLookInfo`

**Test**: given a `Grid` and `WaterSim` with known values set at `(x, z)`, `getLookInfo`
returns a struct with matching `x`, `z`, `rockHeight`, `sandHeight`, `surfaceHeight`,
`waterHeight`, `moisture`, `sediment`, `sourceRate`, `flowX`, `flowZ`, `velocity`.

**Implementation**: pure function reading the relevant getters off `Grid`/`WaterSim`.

**Done when**: test passes.

### Step 2: `formatLookInfo`

**Test**: given a known `LookInfo`, returns the expected multi-line string; flow
direction renders as the correct arrow character for each of the 8 compass-free
directions (e.g. flowX>0,flowZ=0 → `→`) and as a neutral marker when flow is ~0.

**Implementation**: pure formatting function in the same file, string-templates the
fields, maps `atan2(flowZ, flowX)` to one of 8 arrow glyphs.

**Done when**: test passes.

### Step 3: `Picker` — hover support

**Test**: none (matches existing untested DOM/raycasting pattern in `Picker.ts`).

**Implementation**: extract the click handler's raycast-to-grid-coord logic into a
reusable `pickAt(clientX, clientY): GridCoord | null`; add `onHover(handler)` that
fires on canvas `mousemove` with the coord (or `null` when off-grid).

**Done when**: click tool behaviour is unchanged in the browser; hovering fires the
new handler.

### Step 4: `Game` — wire up the Look panel

**Test**: none (DOM only, matches the existing help-overlay wiring).

**Implementation**: add a top-right panel div; `l`/`L` keydown toggles a `lookEnabled`
flag and the panel's visibility; track the last-hovered cell via `picker.onHover`;
each render frame, if enabled, refresh panel text via `getLookInfo`/`formatLookInfo`
using current grid/waterSim state; add `L` line to the help overlay.

**Done when**: toggling `L` shows/hides the panel; panel text updates live while
hovering and as the simulation runs.
