# Sandcastles — Development Plan

A 2.5D isometric beach sandbox game. Dig with a bucket and spade, dam streams, build lakes, and watch water erode the sand. Heavy physics simulation, open-ended sandbox (no win condition).

> **For Claude Code:** This is the build spec. Work milestone by milestone (M1 → M7). Each milestone should produce a runnable state. Confirm `npm run dev` works after M1 before proceeding.

---

## Tech Stack

- **Language:** TypeScript, `strict: true`, no `any`.
- **Build tool:** Vite.
- **Rendering:** Three.js (WebGL2).
- **Structure:** Full modular project from the start (layout below).
- **Performance target:** Smooth on a mid-range laptop.

---

## Architecture

### World representation — voxel-on-heightmap hybrid

- Terrain is a dense 2D grid (start at **256×256** cells). Each cell stores stacked material columns.
- Materials per cell: `rock` (immovable base), `gravel`, `sand`, `pebble` markers, plus a `water` height and a `moisture` value.
- Rendered as a **single deformable mesh** (a displaced grid), not individual cubes — keeps draw calls low. Update only changed vertices each frame.

### Water & erosion — grid-based shallow-water (pipe model)

- Each cell exchanges water with its 4 neighbours via virtual "pipes"; flow is proportional to height difference. Conserves volume and naturally produces level lakes and pooling behind dams.
- Chosen over SPH/particle fluid, which looks great but will not hold up on a laptop at this scale.

### Simulation loop

- Fixed-timestep physics (~30 Hz) decoupled from render (60 fps).
- Sim state in typed `Float32Array`s.
- Start on the main thread; keep a clear path to move the sim into a **Web Worker** if profiling demands it.

---

## Project Structure

```
sandcastles/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts                 # bootstrap, game loop
    ├── core/
    │   ├── Game.ts             # orchestrates systems, fixed-timestep loop
    │   ├── Grid.ts             # terrain data model (typed arrays)
    │   └── materials.ts        # Material enum, properties (angle of repose, erodibility)
    ├── render/
    │   ├── Renderer.ts         # Three.js scene, lights, shadows
    │   ├── IsoCamera.ts        # orthographic iso camera + pan/zoom
    │   ├── TerrainMesh.ts      # deformable mesh, partial vertex updates
    │   └── WaterMesh.ts        # water surface rendering
    ├── sim/
    │   ├── WaterSim.ts         # pipe-model shallow water
    │   ├── Erosion.ts          # sediment transport
    │   ├── Moisture.ts         # wet/dry diffusion
    │   ├── Slope.ts            # talus / angle-of-repose slumping
    │   └── Waves.ts            # sea wave events
    ├── input/
    │   ├── Picker.ts           # raycast grid-cell selection
    │   └── Tools.ts            # bucket & spade logic
    └── types.ts                # shared types
```

Each sim system is its own module so it can be built and tested in isolation.

---

## Core Systems (build order)

1. **Grid & terrain mesh** — data model; render a static beach sloping toward the sea.
2. **Isometric camera & controls** — orthographic camera, orbit/pan/zoom, raycasting to pick cells.
3. **Bucket & spade tools** — dig (remove sand/gravel into bucket), dump (place from bucket). Material-aware: rock can't be dug.
4. **Water flow (pipe model)** — streams as continuous sources; water spreads, pools, finds level.
5. **Damming & lakes** — sand/pebbles block flow; verify a dam holds water and a lake fills.
6. **Erosion & sediment** — flowing water lifts sand (not rock), carries it, deposits where flow slows. Velocity-dependent.
7. **Wet/dry sand** — moisture diffuses from water sources; affects colour and dig behaviour (wet sand holds shape, dry collapses).
8. **Sea & waves** — periodic wave sweeps far stronger than streams; erodes aggressively, can wash away sandcastles.
9. **Polish** — pebbles as distinct scatter, audio, particle splashes, lighting/shadows.

---

## Key Physics Details

- **Pipe model:** each cell exchanges water with 4 neighbours via virtual pipes; flow ∝ height difference. Conserves volume; produces lakes and level surfaces.
- **Erosion:** sediment capacity scales with flow velocity. Water erodes when under capacity, deposits when over. Waves get a large multiplier.
- **Slope stability (talus):** sand above a critical angle slumps. Wet sand has a steeper stable angle than dry — this is what makes sandcastles and dams behave believably.

---

## Performance Plan (mid-range laptop)

- Single merged terrain mesh; update only changed vertices each frame.
- Sim in typed `Float32Array`s; budget for Web Worker offload.
- Start at 256×256; profile before scaling up.
- Orthographic camera + a simple shadow map keeps the GPU light.

---

## Milestones

| Milestone | Deliverable |
|-----------|-------------|
| **M1** | Renders an isometric beach you can pan/zoom |
| **M2** | Dig and dump sand with bucket/spade |
| **M3** | A stream flows and pools realistically |
| **M4** | Build a dam → lake fills |
| **M5** | Erosion + wet/dry sand visible |
| **M6** | Waves wash in and reshape the beach |
| **M7** | Polish & audio |

**M1 touches:** `core/`, `render/`, and `input/Picker.ts`.

---

## Getting Started

```bash
npm create vite@latest sandcastles -- --template vanilla-ts
cd sandcastles
npm install three
npm install -D @types/three
npm run dev
```

Then build out the structure above, starting with M1.
