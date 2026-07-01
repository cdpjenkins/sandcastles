# Sandcastles

A 2.5D isometric beach sandbox. Dig sand, build dams, divert streams, and watch waves reshape the shore.

## Running

```bash
npm install
npm run dev
```

Then open the local URL Vite prints. No build step needed for development.

## Controls

| Key / gesture | Action |
|---|---|
| `S` | Spade (dig sand into bucket) |
| `D` | Toggle between Spade and Dump |
| `W` | Water stream (click a cell to place a source) |
| `R` | Reset all water and stream sources |
| `?` | Toggle controls overlay |
| Pinch | Zoom |
| Two-finger drag | Pan |

Click any cell to apply the active tool.

## What's been built

### Terrain (M1)

A 256×256 grid rendered as a single deformable Three.js mesh. The beach slopes from a high sandy dune at the back down to a flat sea at the front. An isometric orthographic camera supports pinch-to-zoom and two-finger pan. Raycasting maps pointer events onto grid cells.

### Bucket and spade tools (M2)

A `Bucket` carries up to 10 units of sand. The Spade tool digs one unit per click from any diggable cell (sand, gravel, pebble — not rock). Dump places one unit back. The HUD shows the current tool and bucket fill level.

### Water flow (M3)

A pipe-model shallow-water simulation runs at 30 Hz. Each cell exchanges water with its four neighbours via virtual pipes; flow is proportional to height difference and conserves volume exactly. Streams are continuous sources placed with the `W` tool. The terrain mesh raises its vertices by the local water height so the water surface is part of the geometry.

### Dams and lakes (M4)

Water obeys the same terrain it flows over, so a ridge of sand naturally dams a stream and a lake fills behind it. Each sim (water, erosion, moisture, slope, waves) returns a per-cell dirty mask; these are combined and used to limit mesh updates to only the cells that actually changed that tick, instead of rebuilding all 65,536 vertices every tick. The `R` key drains all water.

### Erosion and wet/dry sand (M5)

- **Erosion** — each cell has a sediment capacity proportional to flow velocity. Fast water picks up sand; slow water deposits it.
- **Moisture** — cells adjacent to water become wet (darker colour); moisture diffuses and evaporates over time.
- **Slope stability** — sand above 20° angle of repose slumps toward lower neighbours, conserving volume. Towers collapse; dams hold their shape.

### Waves (M6)

Every 20 seconds a wave surge injects 10 units of water across the shore rows. The existing erosion and flow systems handle the rest — wave water moves fast, so it carries significantly more sediment than a stream. Sea cells drain back to their resting level between waves so the water recedes naturally. The HUD shows a countdown to the next wave.

### Polish (M7)

- Per-cell colour noise (a stable position hash) breaks up the flat sand surface.
- Wet sand blends toward a darker colour based on moisture level.
- A short filtered-noise audio burst plays through the Web Audio API when each wave hits.
- Press `?` for a full in-game controls reference.

## Architecture

```
src/
├── audio/
│   └── WaveAudio.ts        Web Audio API wave splash
├── core/
│   ├── Bucket.ts           Bucket data model
│   ├── Game.ts             Fixed-timestep loop, input routing, HUD
│   ├── Grid.ts             256×256 Float32Array terrain data
│   └── materials.ts        Material constants and properties
├── input/
│   ├── Picker.ts           Raycast → grid cell
│   └── Tools.ts            Dig / dump pure functions
├── render/
│   ├── IsoCamera.ts        Orthographic isometric camera
│   ├── Renderer.ts         Three.js scene, lighting, shadows
│   ├── TerrainMesh.ts      Deformable mesh with partial vertex updates
│   ├── cellNoise.ts        Position-hash colour jitter
│   └── sandColour.ts       Moisture-blended sand colour
└── sim/
    ├── combineDirty.ts     OR-combines per-sim dirty masks
    ├── Erosion.ts          Sediment capacity erosion model
    ├── Moisture.ts         Wet/dry diffusion and evaporation
    ├── Slope.ts            Talus / angle-of-repose slumping
    ├── WaterSim.ts         Pipe-model shallow water
    └── Waves.ts            Periodic wave surge and sea drain
```

All simulation state lives in typed `Float32Array` buffers. The sim runs on the main thread at 30 Hz; rendering runs at 60 fps. The architecture keeps a clear path to move the sim into a Web Worker if profiling demands it.

## Tests

110 tests across 14 files, all passing:

```bash
npm test
```

Tests cover every simulation system (water, erosion, moisture, slope, waves) and rendering utilities (sand colour, cell noise) as pure-function unit tests with no DOM or WebGL dependency.
