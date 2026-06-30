# Plan: M1 — Isometric Beach (pan/zoom)

## Goal

Render a static isometric beach you can pan and zoom; `npm run dev` opens a WebGL canvas with a sand-coloured terrain sloping toward a blue sea edge.

## Acceptance Criteria

- [ ] `npm run dev` opens without errors in the browser
- [ ] Isometric orthographic view of a 256×256 terrain mesh
- [ ] Beach slopes from high ground (sand) down to a sea edge (water colour strip)
- [ ] Pan with middle-mouse drag, zoom with scroll wheel
- [ ] Clicking a cell logs its grid coordinates to the console
- [ ] All unit tests pass (`npm test`)

---

## Steps

### Step 1: Tooling — Vitest, strict TypeScript, clear boilerplate

**Test**: `npm test` runs (passes trivially with a placeholder test).
**Implementation**: Add Vitest + jsdom, add `strict: true` to tsconfig, add `vitest.config.ts`, wipe boilerplate files (`counter.ts`, `style.css`, assets), replace `main.ts` with an empty shell.
**Done when**: `npm test` exits 0; `npm run dev` shows a blank page with no console errors.

---

### Step 2: `src/core/materials.ts` — Material enum and properties

**Test**: `material.test.ts` asserts that `rock` has `erodibility = 0`, `diggable = false`; `sand` has `angleOfRepose = 34` (degrees); `water` is not in the solid materials list.
**Implementation**: `Material` enum (`Rock`, `Sand`, `Gravel`, `Pebble`, `Water`). `MATERIAL_PROPS` record with `erodibility`, `diggable`, `angleOfRepose`, `colour` per material.
**Done when**: Tests pass; `tsc --noEmit` clean.

---

### Step 3: `src/types.ts` — Shared types

**Test**: No runtime behaviour; compile-time only. `tsc --noEmit` passes.
**Implementation**: `GridCoord`, `Vec2`, `CellColumn` interfaces used across modules.
**Done when**: Types importable from other modules; no compiler errors.

---

### Step 4: `src/core/Grid.ts` — Terrain data model

**Test**: `grid.test.ts` asserts: (a) a 256×256 Grid initialises with correct dimensions; (b) `getHeight(x, z)` returns the initial terrain height; (c) `setHeight(x, z, h)` round-trips correctly; (d) out-of-bounds access throws or returns `undefined` (decide and test one).
**Implementation**: `Grid` class wrapping `Float32Array`s for `rockHeight`, `sandHeight`, `waterHeight`, `moisture`. `initBeach()` fills a gentle slope + flat sea strip.
**Done when**: All grid tests pass.

---

### Step 5: `src/render/Renderer.ts` — Three.js scene and lights

**Test**: Manual — `npm run dev` renders a grey background canvas without WebGL errors.
**Implementation**: `Renderer` class: `WebGLRenderer` (antialias, shadow map), ambient + directional light, `render(scene, camera)` method.
**Done when**: No console errors; renderer attaches to `#app`.

---

### Step 6: `src/render/IsoCamera.ts` — Orthographic iso camera + pan/zoom

**Test**: Manual — panning (middle-mouse drag) and zooming (scroll) move/resize the view.
**Implementation**: `IsoCamera` wrapping Three.js `OrthographicCamera` at classic 45°/35.26° iso angles. `onWheel` and `onPointerMove` handlers attached to the canvas.
**Done when**: Camera orbits correctly; zoom clamps to sensible min/max.

---

### Step 7: `src/render/TerrainMesh.ts` — Deformable terrain mesh

**Test**: Manual — a coloured terrain mesh fills the view at the correct iso angle.
**Implementation**: `PlaneGeometry` subdivided to 256×256, vertex Y-positions set from `Grid.getHeight`. Per-vertex colours by material (sand = `#c2a06e`, sea strip = `#3a7bd5`). `updateDirtyRegion(x0,z0,x1,z1)` updates a subset of vertices.
**Done when**: Beach visible with correct slope; no z-fighting.

---

### Step 8: `src/input/Picker.ts` — Raycast cell selection

**Test**: Manual — clicking the canvas logs `{x, z}` grid coordinates to the console.
**Implementation**: `Picker` class: `Raycaster` against the terrain mesh; converts Three.js intersection point to grid coords; emits a `cellPick` event (custom EventTarget or callback).
**Done when**: Clicking anywhere on terrain logs a plausible `{x, z}`.

---

### Step 9: `src/core/Game.ts` + `src/main.ts` — Wire everything together

**Test**: Manual — `npm run dev` delivers the full M1 experience end-to-end.
**Implementation**: `Game` owns `Grid`, `Renderer`, `IsoCamera`, `TerrainMesh`, `Picker`. Fixed-timestep `requestAnimationFrame` loop (sim at 30 Hz, render at 60 fps). `main.ts` creates `new Game()`.
**Done when**: All acceptance criteria confirmed in browser.
